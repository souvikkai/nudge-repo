#Test summary 

from __future__ import annotations

from uuid import uuid4

import pytest
from sqlalchemy import select

from app.db import SessionLocal
from app.models.mvp import Item, ItemContent, ItemStatus, ItemSummary, SummaryAttempt
from app.api.items import MAX_INPUT_CHARS


def _mock_generate_summary_factory(expected_max_chars: int | None = None):
    def _mock_generate_summary(text: str, model_key: str, prompt_version: str):
        if expected_max_chars is not None:
            assert len(text) <= expected_max_chars
        # Deterministic, valid-format output.
        return {
            "text": (
                "Thesis: This is a mocked summary.\n"
                "Key points:\n"
                "- Point one.\n"
                "- Point two.\n"
                "Why it matters: Testing plumbing."
            ),
            "provider": "mock-provider",
            "model": f"mock-model-{model_key}",
            "latency_ms": 7,
        }

    return _mock_generate_summary


def test_summary_invalid_model_key_returns_400(api_client, monkeypatch) -> None:
    # Create a succeeded item (pasted_text path -> succeeded).
    user_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    r = api_client.post(
        "/items",
        headers={"X-User-Id": user_id},
        json={"source_type": "pasted_text", "pasted_text": "Hello", "prefer_pasted_text": True},
    )
    assert r.status_code == 200
    item_id = r.json()["id"]

    # Mock LLM anyway (should not be called due to early validation).
    import app.llm.client as client_mod

    monkeypatch.setattr(client_mod, "generate_summary", _mock_generate_summary_factory())

    resp = api_client.post(
        f"/items/{item_id}/summary?model_key=invalid",
        headers={"X-User-Id": user_id},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Invalid model_key"


def test_summary_item_not_found_for_user_returns_404(api_client, monkeypatch) -> None:
    user_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
    import app.llm.client as client_mod

    monkeypatch.setattr(client_mod, "generate_summary", _mock_generate_summary_factory())

    missing_id = str(uuid4())
    resp = api_client.post(
        f"/items/{missing_id}/summary?model_key=mid",
        headers={"X-User-Id": user_id},
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Item not found."


def test_summary_status_not_succeeded_returns_409(api_client, monkeypatch) -> None:
    user_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    # Create a URL item -> queued
    r = api_client.post(
        "/items",
        headers={"X-User-Id": user_id},
        json={"url": "https://example.com"},
    )
    assert r.status_code == 200
    item_id = r.json()["id"]

    import app.llm.client as client_mod

    monkeypatch.setattr(client_mod, "generate_summary", _mock_generate_summary_factory())

    resp = api_client.post(
        f"/items/{item_id}/summary?model_key=mid",
        headers={"X-User-Id": user_id},
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Item is not in succeeded status."


def test_summary_success_persists_rows_and_returns_text_plain(api_client, monkeypatch) -> None:
    user_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    # Create succeeded item
    r = api_client.post(
        "/items",
        headers={"X-User-Id": user_id},
        json={"source_type": "pasted_text", "pasted_text": "Hello world", "prefer_pasted_text": True},
    )
    assert r.status_code == 200
    item_id = r.json()["id"]

    import app.llm.client as client_mod

    monkeypatch.setattr(client_mod, "generate_summary", _mock_generate_summary_factory())

    resp = api_client.post(
        f"/items/{item_id}/summary?model_key=budget",
        headers={"X-User-Id": user_id},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "text/plain; charset=utf-8"
    body = resp.text
    assert "Thesis:" in body
    assert "Key points:" in body

    # Verify DB rows
    db = SessionLocal()
    try:
        srow = db.scalar(
            select(ItemSummary).where(
                ItemSummary.item_id == item_id,
                ItemSummary.model_key == "budget",
            ).order_by(ItemSummary.created_at.desc(), ItemSummary.id.desc())
        )
        assert srow is not None
        assert srow.model_key == "budget"
        assert srow.summary_text.strip() == body.strip()
        assert srow.output_words <= 120

        # If summary_attempts exists, verify attempt_no/status
        arow = db.scalar(
            select(SummaryAttempt).where(
                SummaryAttempt.item_id == item_id,
                SummaryAttempt.model_key == "budget",
            ).order_by(SummaryAttempt.created_at.asc(), SummaryAttempt.id.asc())
        )
        assert arow is not None
        assert arow.attempt_no == 1
        assert arow.status == "succeeded"
    finally:
        db.close()


def test_summary_truncation_persists_input_chars_used_lte_cap(api_client, monkeypatch) -> None:
    user_id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"

    # Create succeeded item first (with small pasted text)
    r = api_client.post(
        "/items",
        headers={"X-User-Id": user_id},
        json={"source_type": "pasted_text", "pasted_text": "seed", "prefer_pasted_text": True},
    )
    assert r.status_code == 200
    item_id = r.json()["id"]

    # Overwrite canonical_text in DB to exceed MAX_INPUT_CHARS
    db = SessionLocal()
    try:
        item = db.scalar(select(Item).where(Item.id == item_id))
        assert item is not None
        assert item.status == ItemStatus.succeeded
        assert item.content is not None

        long_text = "a" * (MAX_INPUT_CHARS + 1234)
        item.content.canonical_text = long_text
        db.add(item)
        db.commit()
    finally:
        db.close()

    import app.llm.client as client_mod

    # Ensure the LLM stub receives already-truncated input.
    monkeypatch.setattr(client_mod, "generate_summary", _mock_generate_summary_factory(expected_max_chars=MAX_INPUT_CHARS))

    resp = api_client.post(
        f"/items/{item_id}/summary?model_key=mid",
        headers={"X-User-Id": user_id},
    )
    assert resp.status_code == 200

    # Verify persisted input_chars_used <= MAX_INPUT_CHARS
    db2 = SessionLocal()
    try:
        srow = db2.scalar(
            select(ItemSummary).where(
                ItemSummary.item_id == item_id,
                ItemSummary.model_key == "mid",
            ).order_by(ItemSummary.created_at.desc(), ItemSummary.id.desc())
        )
        assert srow is not None
        assert srow.input_chars_used <= MAX_INPUT_CHARS
        assert srow.input_chars_original > MAX_INPUT_CHARS
    finally:
        db2.close()
