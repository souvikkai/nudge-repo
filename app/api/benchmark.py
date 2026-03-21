from __future__ import annotations

import concurrent.futures
import time
from datetime import datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models.mvp import Item, ItemStatus, SummaryAttempt
from app.settings import settings

router = APIRouter(prefix="/benchmark", tags=["benchmark"])

# Cost estimates per 1000 tokens (approximate)
COST_PER_1K_TOKENS = {
    "deepseek": 0.00014,  # DeepSeek ~$0.14 per 1M tokens
}

def _estimate_tokens(text: str) -> int:
    # Rough estimate: 1 token ≈ 4 characters
    return len(text) // 4

def _estimate_cost(input_text: str, output_text: str, provider: str) -> float:
    input_tokens = _estimate_tokens(input_text)
    output_tokens = _estimate_tokens(output_text)
    total_tokens = input_tokens + output_tokens
    rate = COST_PER_1K_TOKENS.get(provider, 0.001)
    return round((total_tokens / 1000) * rate, 6)

def _run_single_tier(
    text: str,
    model_key: str,
    prompt_version: str,
    item_id: UUID,
    db_session_factory,
) -> dict:
    from app.llm.client import generate_summary
    from app.db import SessionLocal

    started_at = datetime.now(timezone.utc)
    try:
        result = generate_summary(text, model_key, prompt_version)
        finished_at = datetime.now(timezone.utc)

        summary_text = result.get("text", "")
        provider = result.get("provider", "unknown")
        model = result.get("model", "unknown")
        latency_ms = result.get("latency_ms", 0)
        word_count = len([w for w in summary_text.split() if w])
        cost = _estimate_cost(text, summary_text, provider)

        # Log to summary_attempts
        try:
            with SessionLocal() as db:
                max_attempt = db.scalar(
                    select(SummaryAttempt.attempt_no)
                    .where(
                        SummaryAttempt.item_id == item_id,
                        SummaryAttempt.model_key == model_key,
                    )
                    .order_by(SummaryAttempt.attempt_no.desc())
                    .limit(1)
                )
                attempt_no = (max_attempt or 0) + 1
                attempt = SummaryAttempt(
                    item_id=item_id,
                    attempt_no=attempt_no,
                    model_key=model_key,
                    provider=provider,
                    model=model,
                    prompt_version=prompt_version,
                    started_at=started_at,
                    finished_at=finished_at,
                    status="succeeded",
                    latency_ms=latency_ms,
                )
                db.add(attempt)
                db.commit()
        except Exception:
            pass  # Don't fail benchmarking if logging fails

        return {
            "model_key": model_key,
            "provider": provider,
            "model": model,
            "latency_ms": latency_ms,
            "word_count": word_count,
            "estimated_cost_usd": cost,
            "summary": summary_text,
            "status": "success",
            "error": None,
        }

    except Exception as e:
        return {
            "model_key": model_key,
            "provider": "unknown",
            "model": "unknown",
            "latency_ms": None,
            "word_count": None,
            "estimated_cost_usd": None,
            "summary": None,
            "status": "error",
            "error": str(e),
        }


@router.post("/{item_id}")
def run_benchmark(
    item_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> dict:
    """
    Run the same article through all 3 model tiers simultaneously.
    Returns side-by-side comparison of latency, cost, word count, and output.
    """
    item = db.scalar(select(Item).where(Item.id == item_id, Item.user_id == user_id))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found.")

    if item.status != ItemStatus.succeeded:
        raise HTTPException(status_code=409, detail="Item must be in succeeded status to benchmark.")

    canonical_text = None
    if item.content is not None:
        canonical_text = item.content.canonical_text

    if not canonical_text or not canonical_text.strip():
        raise HTTPException(status_code=409, detail="Item has no text to benchmark.")

    text = canonical_text[:20_000]
    prompt_version = "v0"
    model_keys = ["strong", "mid", "budget"]

    # Run all 3 tiers in parallel
    from app.db import SessionLocal
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = {
            executor.submit(
                _run_single_tier, text, key, prompt_version, item_id, SessionLocal
            ): key
            for key in model_keys
        }
        for future in concurrent.futures.as_completed(futures):
            results.append(future.result())

    # Sort by model_key order: strong, mid, budget
    order = {"strong": 0, "mid": 1, "budget": 2}
    results.sort(key=lambda r: order.get(r["model_key"], 99))

    return {
        "item_id": str(item_id),
        "input_chars": len(text),
        "input_tokens_estimate": _estimate_tokens(text),
        "prompt_version": prompt_version,
        "results": results,
    }