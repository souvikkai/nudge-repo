from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional, Sequence, Tuple
from urllib.parse import urlparse

import httpx
import trafilatura
from bs4 import BeautifulSoup
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import SessionLocal


from app.models.mvp import ( 
    ExtractionAttempt,
    Item,
    ItemContent,
    ItemFinalTextSource,
    ItemSourceType,
    ItemStatus,
)

logger = logging.getLogger("app.worker")


# ----------------------------
#Configuration
# ----------------------------
@dataclass(frozen=True)
class WorkerConfig:
    poll_seconds: int = int(os.getenv("WORKER_POLL_SECONDS", "3"))
    batch_size: int = int(os.getenv("WORKER_BATCH_SIZE", "5"))
    connect_timeout: float = float(os.getenv("WORKER_HTTP_CONNECT_TIMEOUT", "5"))
    read_timeout: float = float(os.getenv("WORKER_HTTP_READ_TIMEOUT", "20"))
    max_bytes: int = int(os.getenv("WORKER_MAX_BYTES", "2000000"))
    user_agent: str = os.getenv("WORKER_USER_AGENT", "NudgeBot/0.1")
    min_chars: int = 600
    max_chars: int = 200_000
    stale_processing_minutes: int = 15
    max_attempts: int = 2


# ----------------------------
#Error classification
# ----------------------------
RETRYABLE_HTTP_STATUSES = {429, 500, 501, 502, 503, 504}
#408 is treated like timeout (retryable)
NON_RETRYABLE_4XX = set(range(400, 500)) - {408, 429}


@dataclass(frozen=True)
class FetchResult:
    ok: bool
    final_url: Optional[str]
    http_status: Optional[int]
    content_type: Optional[str]
    body_bytes: Optional[bytes]
    error_code: Optional[str]
    error_detail: Optional[str]
    retryable: bool


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _short_detail(msg: str, limit: int = 180) -> str:
    msg = (msg or "").strip()
    return msg if len(msg) <= limit else msg[: limit - 3] + "..."


def _is_probably_invalid_url(url: str) -> bool:
    try:
        p = urlparse(url)
    except Exception:
        return True
    if p.scheme not in {"http", "https"}:
        return True
    if not p.netloc:
        return True
    return False


# ----------------------------
#HTML extraction
# ----------------------------
def _extract_with_trafilatura(html: str) -> Optional[str]:
    try:
        text = trafilatura.extract(html)
        if text:
            text = text.strip()
        return text or None
    except Exception:
        #Treat as no result and fall back.
        return None


def _extract_with_bs4_visible_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")

    #Drop non-visible / non-content elements.
    for tag in soup(["script", "style", "noscript", "template", "svg", "canvas", "iframe"]):
        tag.decompose()

    text = soup.get_text(separator="\n")
    #Normalizez whitespace and remove excessive blank lines.
    lines = [ln.strip() for ln in text.splitlines()]
    lines = [ln for ln in lines if ln]
    return "\n".join(lines).strip()


def extract_readable_text(html: str, cfg: WorkerConfig) -> Tuple[Optional[str], Optional[str]]:
    """
    Returns (text, error_code_if_any).
    """
    text = _extract_with_trafilatura(html)
    if not text:
        text = _extract_with_bs4_visible_text(html)

    text = (text or "").strip()
    if not text:
        return None, "empty_extraction"

    if len(text) < cfg.min_chars:
        return None, "too_short"

    if len(text) > cfg.max_chars:
        text = text[: cfg.max_chars]

    return text, None


# ----------------------------
#HTTP fetch
# ----------------------------
def fetch_url(url: str, cfg: WorkerConfig) -> FetchResult:
    if _is_probably_invalid_url(url):
        return FetchResult(
            ok=False,
            final_url=None,
            http_status=None,
            content_type=None,
            body_bytes=None,
            error_code="invalid_url",
            error_detail="URL appears invalid. Please double-check it.",
            retryable=False,
        )

    headers = {"User-Agent": cfg.user_agent, "Accept": "text/html,application/xhtml+xml"}
    timeout = httpx.Timeout(connect=cfg.connect_timeout, read=cfg.read_timeout, write=cfg.read_timeout, pool=cfg.read_timeout)

    try:
        with httpx.Client(follow_redirects=True, headers=headers, timeout=timeout) as client:
            #Stream to enforce max_bytes cap.
            with client.stream("GET", url) as resp:
                status = resp.status_code
                final_url = str(resp.url)
                ctype = resp.headers.get("content-type")

                #Status-based classification.
                if status in RETRYABLE_HTTP_STATUSES:
                    return FetchResult(
                        ok=False,
                        final_url=final_url,
                        http_status=status,
                        content_type=ctype,
                        body_bytes=None,
                        error_code=f"http_{status}",
                        error_detail=f"Upstream returned HTTP {status}.",
                        retryable=True,
                    )
                if status in NON_RETRYABLE_4XX:
                    return FetchResult(
                        ok=False,
                        final_url=final_url,
                        http_status=status,
                        content_type=ctype,
                        body_bytes=None,
                        error_code=f"http_{status}",
                        error_detail=f"Upstream returned HTTP {status}.",
                        retryable=False,
                    )
                if status == 408:
                    return FetchResult(
                        ok=False,
                        final_url=final_url,
                        http_status=status,
                        content_type=ctype,
                        body_bytes=None,
                        error_code="timeout",
                        error_detail="Request timed out (HTTP 408).",
                        retryable=True,
                    )

                if ctype and ("text/html" not in ctype.lower() and "application/xhtml+xml" not in ctype.lower()):
                    return FetchResult(
                        ok=False,
                        final_url=final_url,
                        http_status=status,
                        content_type=ctype,
                        body_bytes=None,
                        error_code="non_html",
                        error_detail="Link does not look like an HTML page (non-HTML content type).",
                        retryable=False,
                    )

                data = bytearray()
                for chunk in resp.iter_bytes():
                    if not chunk:
                        continue
                    data.extend(chunk)
                    if len(data) > cfg.max_bytes:
                        return FetchResult(
                            ok=False,
                            final_url=final_url,
                            http_status=status,
                            content_type=ctype,
                            body_bytes=None,
                            error_code="max_bytes_exceeded",
                            error_detail="Page is too large to process.",
                            retryable=False,
                        )

                return FetchResult(
                    ok=True,
                    final_url=final_url,
                    http_status=status,
                    content_type=ctype,
                    body_bytes=bytes(data),
                    error_code=None,
                    error_detail=None,
                    retryable=False,
                )

    except httpx.TimeoutException as e:
        return FetchResult(
            ok=False,
            final_url=None,
            http_status=None,
            content_type=None,
            body_bytes=None,
            error_code="timeout",
            error_detail=_short_detail(str(e) or "Request timed out."),
            retryable=True,
        )
    except httpx.RequestError as e:
        #DNS, connection errors, TLS, etc.
        return FetchResult(
            ok=False,
            final_url=None,
            http_status=None,
            content_type=None,
            body_bytes=None,
            error_code="connection_error",
            error_detail=_short_detail(str(e) or "Connection error."),
            retryable=True,
        )
    except Exception as e:
        return FetchResult(
            ok=False,
            final_url=None,
            http_status=None,
            content_type=None,
            body_bytes=None,
            error_code="unexpected_fetch_error",
            error_detail=_short_detail(str(e) or "Unexpected fetch error."),
            retryable=False,
        )


# ----------------------------
#DB helpers
# ----------------------------
def _get_next_attempt_no(db: Session, item_id) -> int:
    current_max = db.query(func.max(ExtractionAttempt.attempt_no)).filter(ExtractionAttempt.item_id == item_id).scalar()
    return int(current_max or 0) + 1


def _get_or_create_item_content(db: Session, item_id) -> ItemContent:
    content = db.query(ItemContent).filter(ItemContent.item_id == item_id).one_or_none()
    if content is None:
        content = ItemContent(item_id=item_id)
        db.add(content)
        db.flush()
    return content


def requeue_stale_processing(db: Session, cfg: WorkerConfig) -> int:
    """
    Re-queue items stuck in processing beyond stale threshold.

    Must be called inside a short transaction.
    """
    stale_before = _utcnow() - timedelta(minutes=cfg.stale_processing_minutes)

    #assumes items.updated_at exists and is updated on status change
    stale_items = (
        db.query(Item)
        .filter(Item.status == ItemStatus.processing)
        .filter(Item.updated_at < stale_before)
        .all()
    )
    for it in stale_items:
        it.status = ItemStatus.queued
        it.status_detail = "requeued after stale processing"
    return len(stale_items)


def claim_batch(db: Session, cfg: WorkerConfig) -> Sequence[Item]:
    """
    Claim a batch of queued URL items using row locking.

    IMPORTANT: This runs inside a short transaction (caller commits quickly).
    Network I/O MUST happen after commit.
    """
    items = (
        db.query(Item)
        .filter(Item.status == ItemStatus.queued)
        .filter(Item.source_type == ItemSourceType.url)
        .order_by(Item.created_at.asc())
        .with_for_update(skip_locked=True)
        .limit(cfg.batch_size)
        .all()
    )

    for it in items:
        it.status = ItemStatus.processing
        it.status_detail = "processing"
        #relies on your model to auto-update updated_at; otherwise it's still fine for MVP

    return items


#-----------------------------
#Item processing
#-----------------------------
def _status_transition_log(item_id, from_status, to_status, detail: Optional[str]) -> None:
    logger.info(
        "item_id=%s transition %s -> %s detail=%s",
        item_id,
        from_status,
        to_status,
        detail,
    )


def process_item(
    item_id,
    cfg: WorkerConfig,
    fetcher: Callable[[str, WorkerConfig], FetchResult] = fetch_url,
) -> None:
    """
    Process one item by id.

    This function performs network I/O outside DB transactions and
    uses short transactions for DB writes.

    Idempotency:
    -item_content is created if missing, else updated.
    -attempt_no is computed from existing attempts + 1.
    """
    started_at = _utcnow()

    #Read item metadata (short txn)
    with SessionLocal() as db:
        item = db.query(Item).filter(Item.id == item_id).one_or_none()
        if item is None:
            logger.warning("item_id=%s missing; skipping", item_id)
            return

        if item.source_type != ItemSourceType.url:
            logger.info("item_id=%s source_type=%s not url; skipping", item_id, item.source_type)
            return

        #Only process if still in processing (it was claimed).
        if item.status != ItemStatus.processing:
            logger.info("item_id=%s status=%s not processing; skipping", item_id, item.status)
            return

        url = item.requested_url
        if not url:
            #Treat as non-retryable.
            attempt_no = _get_next_attempt_no(db, item.id)
            finished_at = _utcnow()
            db.add(
                ExtractionAttempt(
                    item_id=item.id,
                    attempt_no=attempt_no,
                    started_at=started_at,
                    finished_at=finished_at,
                    result="error",
                    error_code="missing_link",
                    error_detail="Missing link on ite.",
                    http_status=None,
                    final_url=None,
                    content_length=None,
                )
            )
            item.status = ItemStatus.needs_user_text
            item.status_detail = "We couldn't read this link. Please paste the text instead."
            db.commit()
            _status_transition_log(item.id, ItemStatus.processing, ItemStatus.needs_user_text, item.status_detail)
            return

    #Network fetch + extraction (NO DB locks held)
    fetch = fetcher(url, cfg)

    extracted_text: Optional[str] = None
    extraction_error_code: Optional[str] = None
    if fetch.ok and fetch.body_bytes is not None:
        #Decode best-effort for HTML
        try:
            html = fetch.body_bytes.decode("utf-8", errors="replace")
        except Exception:
            html = fetch.body_bytes.decode(errors="replace")

        extracted_text, extraction_error_code = extract_readable_text(html, cfg)

    finished_at = _utcnow()

    #Write attempt + update final state (short txn)
    with SessionLocal() as db:
        item = db.query(Item).filter(Item.id == item_id).one_or_none()
        if item is None:
            logger.warning("item_id=%s missing on write-back; skipping", item_id)
            return

        attempt_no = _get_next_attempt_no(db, item.id)

        #Build attempt record
        attempt = ExtractionAttempt(
            item_id=item.id,
            attempt_no=attempt_no,
            started_at=started_at,
            finished_at=finished_at,
            result="success" if (fetch.ok and extracted_text) else "error",
            error_code=None,
            error_detail=None,
            http_status=fetch.http_status,
            final_url=fetch.final_url,
            content_length=(len(fetch.body_bytes) if fetch.body_bytes is not None else None),
        )

        #Determine outcome
        if fetch.ok and extracted_text:
            content = _get_or_create_item_content(db, item.id)
            content.extracted_text = extracted_text
            content.canonical_text = extracted_text
            item.final_text_source = ItemFinalTextSource.extracted_from_url
            prev = item.status
            item.status = ItemStatus.succeeded
            item.status_detail = None

            db.add(attempt)
            db.commit()

            logger.info(
                "item_id=%s attempt_no=%s success chars=%s",
                item.id,
                attempt_no,
                len(extracted_text),
            )
            _status_transition_log(item.id, prev, ItemStatus.succeeded, None)
            return

        #Failure path: classify retryable vs non-retryable
        error_code = fetch.error_code
        error_detail = fetch.error_detail

        #If fetch succeeded but extraction failed, classify as non-retryable (too_short, empty_extraction)
        if fetch.ok:
            error_code = extraction_error_code or "extraction_failed"
            if error_code == "too_short":
                error_detail = "We couldn't extract enough readable text from this page."
            elif error_code == "empty_extraction":
                error_detail = "We couldn't extract readable text from this page."
            else:
                error_detail = error_detail or "Extraction failed."

            retryable = False
        else:
            retryable = bool(fetch.retryable)

        attempt.error_code = error_code
        attempt.error_detail = _short_detail(error_detail or "Error")

        db.add(attempt)

        prev = item.status
        if retryable and attempt_no < cfg.max_attempts:
            #Retry by returning to queued.
            item.status = ItemStatus.queued
            item.status_detail = _short_detail(f"retrying: {attempt.error_code}")
            db.commit()

            logger.warning(
                "item_id=%s attempt_no=%s retryable_error=%s http_status=%s -> requeued",
                item.id,
                attempt_no,
                attempt.error_code,
                fetch.http_status,
            )
            _status_transition_log(item.id, prev, ItemStatus.queued, item.status_detail)
            return

        #Non-retryable OR max attempts reached
        item.status = ItemStatus.needs_user_text
        item.status_detail = _short_detail(
            "We couldn't read this link. Please open it and paste the article text here."
        )
        db.commit()

        logger.warning(
            "item_id=%s attempt_no=%s nonretryable_error=%s http_status=%s -> needs_user_text",
            item.id,
            attempt_no,
            attempt.error_code,
            fetch.http_status,
        )
        _status_transition_log(item.id, prev, ItemStatus.needs_user_text, item.status_detail)


# ----------------------------
# Runner
# ----------------------------
def _claim_and_process_batch(cfg: WorkerConfig) -> int:
    #1) Short transaction: stale recovery + claim queued -> processing
    with SessionLocal() as db:
        requeued = requeue_stale_processing(db, cfg)
        if requeued:
            logger.info("requeued_stale_processing=%s", requeued)

        claimed = claim_batch(db, cfg)
        claimed_ids = [it.id for it in claimed]
        if claimed_ids:
            logger.info("claimed_batch size=%s ids=%s", len(claimed_ids), claimed_ids)

        db.commit()

    #2). Process each item outside locks (each does its own short DB writes)
    for item_id in claimed_ids:
        try:
            process_item(item_id, cfg)
        except Exception as e:
            #Rare internal failure: record as failed if we can, otherwise just log.
            logger.exception("item_id=%s internal_error=%s", item_id, e)
            try:
                with SessionLocal() as db:
                    item = db.query(Item).filter(Item.id == item_id).one_or_none()
                    if item is not None:
                        #record an attempt for internal error
                        started_at = _utcnow()
                        finished_at = _utcnow()
                        attempt_no = _get_next_attempt_no(db, item.id)
                        db.add(
                            ExtractionAttempt(
                                item_id=item.id,
                                attempt_no=attempt_no,
                                started_at=started_at,
                                finished_at=finished_at,
                                result="error",
                                error_code="internal_error",
                                error_detail=_short_detail(str(e)),
                                http_status=None,
                                final_url=None,
                                content_length=None,
                            )
                        )
                        item.status = ItemStatus.failed
                        item.status_detail = "Internal error while processing."
                        db.commit()
            except Exception:
                logger.exception("item_id=%s failed_to_persist_internal_error", item_id)

    return len(claimed_ids)


def run_once() -> None:
    cfg = WorkerConfig()
    processed = _claim_and_process_batch(cfg)
    logger.info("run_once processed=%s", processed)


def run_forever() -> None:
    cfg = WorkerConfig()
    logger.info(
        "worker_start poll_seconds=%s batch_size=%s connect_timeout=%s read_timeout=%s max_bytes=%s",
        cfg.poll_seconds,
        cfg.batch_size,
        cfg.connect_timeout,
        cfg.read_timeout,
        cfg.max_bytes,
    )

    while True:
        processed = _claim_and_process_batch(cfg)
        #Even if less than batch size, we just sleep and poll again.
        if processed == 0:
            time.sleep(cfg.poll_seconds)
        else:
            #Small yield to avoid tight loops when backlog is huge
            time.sleep(0.1)
