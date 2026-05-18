from __future__ import annotations

from datetime import datetime, timezone

import pytest

from app.db import SessionLocal
from app.worker.worker import WorkerConfig, FetchResult, process_item

from app.models.mvp import User
from app.models.mvp import (  #type: ignore
    ExtractionAttempt,
    Item,
    ItemContent,
    ItemFinalTextSource,
    ItemSourceType,
    ItemStatus,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _fake_fetcher_success(_: str, __: WorkerConfig) -> FetchResult:
    #Create HTML with >600 chars of visible text.
    body = ("<html><body><h1>Title</h1><p>" + ("hello " * 200) + "</p></body></html>").encode("utf-8")
    return FetchResult(
        ok=True,
        final_url="https://example.com/final",
        http_status=200,
        content_type="text/html; charset=utf-8",
        body_bytes=body,
        error_code=None,
        error_detail=None,
        retryable=False,
    )


@pytest.mark.parametrize("initial_status", [ItemStatus.processing])
def test_worker_process_item_success_creates_attempt_and_content(initial_status) -> None:
    cfg = WorkerConfig()

    with SessionLocal() as db:
        user = User()
        db.add(user)
        db.commit()
        db.refresh(user)

        item = Item(
            user_id=user.id,  
            source_type=ItemSourceType.url,
            status=initial_status,
            status_detail="processing",
            requested_url="https://example.com/article",
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        item_id = item.id

    process_item(item_id, cfg, fetcher=_fake_fetcher_success)

    with SessionLocal() as db:
        item = db.query(Item).filter(Item.id == item_id).one()
        assert item.status == ItemStatus.succeeded
        assert item.final_text_source == ItemFinalTextSource.extracted_from_url
        assert item.status_detail is None

        attempts = (
            db.query(ExtractionAttempt)
            .filter(ExtractionAttempt.item_id == item_id)
            .order_by(ExtractionAttempt.attempt_no.asc())
            .all()
        )
        assert len(attempts) == 1
        assert attempts[0].attempt_no == 1
        assert attempts[0].result == "success"
        assert attempts[0].http_status == 200

        content = db.query(ItemContent).filter(ItemContent.item_id == item_id).one()
        assert content.canonical_text is not None
        assert len(content.canonical_text) >= cfg.min_chars
        assert content.extracted_text == content.canonical_text
