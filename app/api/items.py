from __future__ import annotations

from datetime import datetime, timezone
import logging
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.settings import settings
from app.models.mvp import (
    Item,
    ItemContent,
    ItemSummary,
    ItemFinalTextSource,
    ItemSourceType,
    ItemStatus,
    SummaryAttempt,
)
from app.schemas.items import (
    ItemCreateRequest,
    ItemCreateResponse,
    ItemDetailResponse,
    ItemListEntry,
    ItemListResponse,
    ItemTextPatchRequest,
    ItemContentOut,
)
from app.llm.prompts import DEFAULT_PROMPT_VERSION, get_prompt
from app.llm.routing import choose_model_key

router = APIRouter(prefix="/items", tags=["items"])

logger = logging.getLogger(__name__)


MAX_INPUT_CHARS = 20_000
WORD_CAP = 200
ALLOWED_MODEL_KEYS = {"strong", "mid", "budget"}


def _encode_cursor(created_at: datetime, item_id: UUID) -> str:
    return f"{created_at.isoformat()}|{item_id}"


def _decode_cursor(cursor: str) -> tuple[datetime, UUID]:
    try:
        ts_str, id_str = cursor.split("|", 1)
        return datetime.fromisoformat(ts_str), UUID(id_str)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid cursor.") from e


@router.post("", response_model=ItemCreateResponse)
def create_item(
    body: ItemCreateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> ItemCreateResponse:
    #Decide creation modality (source_type) and initial state.
    #- If user prefers pasted text (and provided it), we can immediately succeed.
    #- Otherwise, if url exists, queue it for worker extraction.
    if body.pasted_text and (body.prefer_pasted_text or not body.url):
        item = Item(
            user_id=user_id,
            status=ItemStatus.succeeded,
            source_type=ItemSourceType.pasted_text,
            requested_url=None,
            final_text_source=ItemFinalTextSource.user_pasted_text,
            status_detail=None,
            title=None,
        )
        item.content = ItemContent(
            user_pasted_text=body.pasted_text,
            extracted_text=None,
            canonical_text=body.pasted_text,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        #Dev convenience addition:
        #- Canonical processing still happens in the worker process (`python -m app.worker`).
        #- In dev, we also "nudge" the worker by running one batch via BackgroundTasks.
        if settings.environment == "dev":
            from app.worker.worker import run_once
            background_tasks.add_task(run_once)

        return ItemCreateResponse(id=item.id, status=item.status)

    #Otherwise: create queued item from URL (store pasted text if provided as fallback input)
    item = Item(
        user_id=user_id,
        status=ItemStatus.queued,
        source_type=ItemSourceType.url,
        requested_url=body.url,
        final_text_source=None,
        status_detail=None,
        title=None,
    )
    item.content = ItemContent(
        user_pasted_text=body.pasted_text,
        extracted_text=None,
        canonical_text=None,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return ItemCreateResponse(id=item.id, status=item.status)


@router.get("", response_model=ItemListResponse)
def list_items(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
) -> ItemListResponse:
    stmt = select(Item).where(Item.user_id == user_id).order_by(Item.created_at.desc(), Item.id.desc())

    if cursor:
        cur_created_at, cur_id = _decode_cursor(cursor)
        #Keyset pagination: strictly "older than" the cursor tuple.
        stmt = stmt.where(
            (Item.created_at < cur_created_at)
            | ((Item.created_at == cur_created_at) & (Item.id < cur_id))
        )

    rows = db.scalars(stmt.limit(limit + 1)).all()
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = _encode_cursor(last.created_at, last.id)
        rows = rows[:limit]

    items = [
        ItemListEntry(
            id=r.id,
            status=r.status,
            status_detail=r.status_detail,
            source_type=r.source_type,
            requested_url=r.requested_url,
            final_text_source=r.final_text_source,
            title=r.title,
            created_at=r.created_at,
            updated_at=r.updated_at,
        )
        for r in rows
    ]
    return ItemListResponse(items=items, next_cursor=next_cursor)


@router.get("/{item_id}", response_model=ItemDetailResponse)
def get_item(
    item_id: UUID,
    include_content: bool = Query(default=False),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> ItemDetailResponse:
    item = db.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    content_out = None
    if include_content and item.content is not None:
        content_out = ItemContentOut(
            user_pasted_text=item.content.user_pasted_text,
            extracted_text=item.content.extracted_text,
            canonical_text=item.content.canonical_text,
            updated_at=item.content.updated_at,
        )

    return ItemDetailResponse(
        id=item.id,
        status=item.status,
        status_detail=item.status_detail,
        source_type=item.source_type,
        requested_url=item.requested_url,
        final_text_source=item.final_text_source,
        title=item.title,
        created_at=item.created_at,
        updated_at=item.updated_at,
        content=content_out,
    )


@router.patch("/{item_id}/text", response_model=ItemDetailResponse)
def patch_item_text(
    item_id: UUID,
    body: ItemTextPatchRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> ItemDetailResponse:
    item = db.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    if item.status != ItemStatus.needs_user_text:
        raise HTTPException(status_code=409, detail="Item is not in needs_user_text status.")

    if item.content is None:
        item.content = ItemContent()

    item.content.user_pasted_text = body.pasted_text
    item.content.canonical_text = body.pasted_text
    item.final_text_source = ItemFinalTextSource.user_pasted_text
    item.status = ItemStatus.succeeded
    item.status_detail = None

    db.add(item)
    db.commit()
    db.refresh(item)

    return get_item(item_id=item.id, include_content=True, db=db, user_id=user_id)

def _count_words(s: str) -> int:
    # Simple whitespace tokenization is sufficient for enforcing a hard word cap.
    return len([w for w in s.split() if w])


def _truncate_to_words(s: str, max_words: int) -> str:
    words = [w for w in s.split() if w]
    if len(words) <= max_words:
        return s
    # Truncate at word limit first
    truncated = " ".join(words[:max_words])
    # Then find the last complete sentence ending
    for ending in [". ", ".\n", "! ", "!\n", "? ", "?\n"]:
        last = truncated.rfind(ending)
        if last > len(truncated) // 2:  # only if not too early
            return truncated[:last + 1].strip()
    return truncated


def _estimate_tokens(text: str) -> int:
    # Rough estimate: 1 token ≈ 4 characters
    return len(text) // 4


def _estimate_cost(input_text: str, output_text: str, provider: str) -> float:
    input_tokens = _estimate_tokens(input_text)
    output_tokens = _estimate_tokens(output_text)
    total_tokens = input_tokens + output_tokens
    rate = 0.00014 if (provider or "").strip().lower() == "deepseek" else 0.001
    return round((total_tokens / 1000) * rate, 6)


def _classify_summary_error(error: Exception) -> str:
    msg = str(error).lower()
    if "timeout" in msg:
        return "provider_timeout"
    if "rate limit" in msg:
        return "rate_limit"
    if "empty" in msg:
        return "empty_summary"
    if "provider" in msg:
        return "provider_error"
    return "unknown_error"


def _fallback_model_key(model_key: str) -> str | None:
    k = (model_key or "").strip().lower()
    if k == "budget":
        return "mid"
    if k == "mid":
        return "strong"
    if k == "strong":
        return None
    return None


@router.get("/{item_id}/summary")
def get_item_summary(
    item_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> PlainTextResponse:
    """
    Return the most recent cached summary for an item, if one exists.
    Returns 404 if no summary has been generated yet.
    Response is text/plain (NOT JSON).
    """
    item = db.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    summary = db.scalar(
        select(ItemSummary)
        .where(ItemSummary.item_id == item_id)
        .order_by(ItemSummary.created_at.desc())
        .limit(1)
    )

    if summary is None:
        raise HTTPException(status_code=404, detail="No summary found for this item.")

    return PlainTextResponse(summary.summary_text, media_type="text/plain")

@router.post("/{item_id}/summary")
def create_item_summary(
    item_id: UUID,
    model_key: Optional[str] = Query(default=None),
    prompt_version: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> PlainTextResponse:
    """
    Generate and persist a distilled summary for a single item.

    Response is text/plain (NOT JSON).
    """
    effective_prompt_version = prompt_version or DEFAULT_PROMPT_VERSION
    try:
        get_prompt(effective_prompt_version)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid prompt_version")

    item = db.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    if item.status != ItemStatus.succeeded:
        raise HTTPException(status_code=409, detail="Item is not in succeeded status.")

    canonical_text = None
    if item.content is not None:
        canonical_text = item.content.canonical_text

    if canonical_text is None or not canonical_text.strip():
        # Chosen consistently as 409 per task instruction.
        raise HTTPException(status_code=409, detail="Item has no canonical_text to summarize.")

    if model_key is not None and model_key.strip() != "":
        effective_model_key = model_key.strip().lower()
        route_reason = "manual_model_key"
    else:
        effective_model_key, route_reason = choose_model_key(canonical_text, task_type="item_summary")

    try:
        settings.get_model_config(effective_model_key)
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid model_key") from e

    input_chars_original = len(canonical_text)
    truncated = canonical_text[:MAX_INPUT_CHARS]
    input_chars_used = len(truncated)
    input_tokens_est = _estimate_tokens(truncated)

    # summary_attempts (append-only) — record start
    started_at = datetime.now(timezone.utc)
    attempt_no = None
    attempt_row = None
    try:
        # attempt_no increments per (item_id, model_key)
        max_attempt = db.scalar(
            select(func.max(SummaryAttempt.attempt_no)).where(
                SummaryAttempt.item_id == item.id,
                SummaryAttempt.model_key == effective_model_key,
            )
        )
        attempt_no = (max_attempt or 0) + 1

        attempt_row = SummaryAttempt(
            item_id=item.id,
            attempt_no=attempt_no,
            model_key=effective_model_key,
            provider=None,
            model=None,
            prompt_version=effective_prompt_version,
            started_at=started_at,
            finished_at=None,
            status="failed",  # will flip to succeeded on success
            error_detail=None,
            latency_ms=None,
            input_tokens_est=input_tokens_est,
            route_reason=route_reason,
        )
        db.add(attempt_row)
        db.commit()
        db.refresh(attempt_row)
    except Exception:
        # If attempt logging fails, we still proceed with summary generation.
        db.rollback()

    from app.llm.client import generate_summary

    def _mark_attempt_failed(row: SummaryAttempt | None, err: Exception) -> None:
        if row is None:
            return
        failure_code = _classify_summary_error(err)
        error_detail = f"{failure_code}: {str(err)}"
        try:
            row.finished_at = datetime.now(timezone.utc)
            row.status = "failed"
            row.error_detail = error_detail
            db.add(row)
            db.commit()
        except Exception:
            db.rollback()

    try:
        result = generate_summary(truncated, effective_model_key, effective_prompt_version)
        model_for_summary = effective_model_key
        attempt_for_summary = attempt_row
    except HTTPException:
        raise
    except Exception as e:
        _mark_attempt_failed(attempt_row, e)
        fb = _fallback_model_key(effective_model_key)
        if fb is None:
            raise HTTPException(status_code=500, detail="Summary generation failed.") from e
        try:
            settings.get_model_config(fb)
        except Exception as err_cfg:  # noqa: BLE001
            raise HTTPException(status_code=400, detail="Invalid model_key") from err_cfg

        started_fb = datetime.now(timezone.utc)
        attempt_row_fb: SummaryAttempt | None = None
        try:
            max_fb = db.scalar(
                select(func.max(SummaryAttempt.attempt_no)).where(
                    SummaryAttempt.item_id == item.id,
                    SummaryAttempt.model_key == fb,
                )
            )
            attempt_no_fb = (max_fb or 0) + 1
            attempt_row_fb = SummaryAttempt(
                item_id=item.id,
                attempt_no=attempt_no_fb,
                model_key=fb,
                provider=None,
                model=None,
                prompt_version=effective_prompt_version,
                started_at=started_fb,
                finished_at=None,
                status="failed",
                error_detail=None,
                latency_ms=None,
                input_tokens_est=input_tokens_est,
                route_reason=f"fallback_from_{effective_model_key}",
            )
            db.add(attempt_row_fb)
            db.commit()
            db.refresh(attempt_row_fb)
        except Exception:
            db.rollback()

        try:
            result = generate_summary(truncated, fb, effective_prompt_version)
            model_for_summary = fb
            attempt_for_summary = attempt_row_fb
        except HTTPException:
            raise
        except Exception as e2:
            _mark_attempt_failed(attempt_row_fb, e2)
            raise HTTPException(status_code=500, detail="Summary generation failed.") from e2

    try:
        provider = result.get("provider")
        model = result.get("model")
        latency_ms = result.get("latency_ms")

        # Enforce word cap (hard). If the model exceeds, truncate.
        summary_text = str(result.get("text", "")).strip()
        if _count_words(summary_text) > WORD_CAP:
            summary_text = _truncate_to_words(summary_text, WORD_CAP)

        output_words = _count_words(summary_text)
        output_tokens_est = _estimate_tokens(summary_text)
        estimated_cost_usd = _estimate_cost(
            truncated, summary_text, str(provider) if provider is not None else ""
        )

        # Persist canonical summary row
        summary_row = ItemSummary(
            item_id=item.id,
            user_id=user_id,
            model_key=model_for_summary,
            provider=provider,
            model=model,
            prompt_version=effective_prompt_version,
            input_chars_original=input_chars_original,
            input_chars_used=input_chars_used,
            output_words=output_words,
            summary_text=summary_text,
        )
        db.add(summary_row)

        # Update attempt row on success
        finished_at = datetime.now(timezone.utc)
        if attempt_for_summary is not None:
            attempt_for_summary.provider = provider
            attempt_for_summary.model = model
            attempt_for_summary.finished_at = finished_at
            attempt_for_summary.latency_ms = latency_ms
            attempt_for_summary.status = "succeeded"
            attempt_for_summary.error_detail = None
            attempt_for_summary.output_tokens_est = output_tokens_est
            attempt_for_summary.estimated_cost_usd = estimated_cost_usd
            db.add(attempt_for_summary)

        db.commit()

        logger.info(
            "summary_generated item_id=%s model_key=%s provider=%s model=%s input_chars_used=%s output_words=%s latency_ms=%s",
            str(item.id),
            model_for_summary,
            provider,
            model,
            input_chars_used,
            output_words,
            latency_ms,
        )

        return PlainTextResponse(summary_text, media_type="text/plain")

    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        _mark_attempt_failed(attempt_for_summary, e)
        raise HTTPException(status_code=500, detail="Summary generation failed.") from e
