from __future__ import annotations

import html
import logging
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

import httpx
from sqlalchemy import select

from app.db import SessionLocal
from app.models.mvp import Item, ItemStatus, ItemSummary, User
from app.settings import settings

logger = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"
DIGEST_SUBJECT = "Your Nudge digest"
FROM_ADDRESS = "Nudge <onboarding@resend.dev>"


def _item_display_title(item: Item) -> str:
    if item.title and item.title.strip():
        return item.title.strip()
    if item.requested_url and item.requested_url.strip():
        try:
            host = urlparse(item.requested_url.strip()).hostname
            if host:
                return host.removeprefix("www.")
        except Exception:
            pass
        return item.requested_url.strip()
    return "Text note"


def _build_digest_html(rows: list[tuple[Item, ItemSummary]]) -> str:
    parts: list[str] = [
        "<!DOCTYPE html>",
        "<html><head><meta charset=\"utf-8\" /></head><body style=\"font-family:system-ui,sans-serif;line-height:1.5;color:#111;\">",
        f"<h1 style=\"font-size:1.25rem;\">{html.escape(DIGEST_SUBJECT)}</h1>",
        "<ul style=\"padding-left:1.25rem;\">",
    ]
    for item, summary in rows:
        title = html.escape(_item_display_title(item))
        body = html.escape(summary.summary_text).replace("\n", "<br/>")
        parts.append(
            f"<li style=\"margin-bottom:1rem;\"><strong>{title}</strong>"
            f"<p style=\"margin:0.35rem 0 0 0;\">{body}</p></li>"
        )
    parts.append("</ul></body></html>")
    return "".join(parts)


def _collect_digest_rows(db, user: User, week_start: datetime) -> list[tuple[Item, ItemSummary]]:
    """Succeeded items from the last 7 days with at least one summary (latest summary per item)."""
    items = db.scalars(
        select(Item).where(
            Item.user_id == user.id,
            Item.status == ItemStatus.succeeded,
            Item.created_at >= week_start,
        )
    ).all()

    rows: list[tuple[Item, ItemSummary]] = []
    for item in items:
        summary = db.scalar(
            select(ItemSummary)
            .where(
                ItemSummary.item_id == item.id,
                ItemSummary.user_id == user.id,
            )
            .order_by(ItemSummary.created_at.desc())
            .limit(1)
        )
        if summary is not None:
            rows.append((item, summary))
    return rows


def send_weekly_digest() -> None:
    if not settings.resend_api_key or not settings.resend_api_key.strip():
        logger.error("RESEND_API_KEY is not set; cannot send digest emails.")
        return

    week_start = datetime.now(timezone.utc) - timedelta(days=7)

    with SessionLocal() as db:
        users = db.scalars(select(User).where(User.email.isnot(None))).all()

        for user in users:
            email = (user.email or "").strip()
            if not email:
                continue

            try:
                rows = _collect_digest_rows(db, user, week_start)
            except Exception as e:
                logger.exception("digest: failed to load items for user %s: %s", user.id, e)
                continue

            if not rows:
                logger.info("digest: skip user %s (%s) — no items with summaries this week", user.id, email)
                continue

            html_body = _build_digest_html(rows)
            payload = {
                "from": FROM_ADDRESS,
                "to": [email],
                "subject": DIGEST_SUBJECT,
                "html": html_body,
            }
            headers = {
                "Authorization": f"Bearer {settings.resend_api_key}",
                "Content-Type": "application/json",
            }
            try:
                with httpx.Client(timeout=30.0) as client:
                    resp = client.post(RESEND_URL, json=payload, headers=headers)
                if resp.is_success:
                    logger.info(
                        "digest: sent OK for user %s (%s) — %d item(s)",
                        user.id,
                        email,
                        len(rows),
                    )
                else:
                    logger.error(
                        "digest: Resend failed for user %s (%s): %s %s — %s",
                        user.id,
                        email,
                        resp.status_code,
                        resp.reason_phrase,
                        resp.text[:500],
                    )
            except httpx.HTTPError as e:
                logger.error("digest: HTTP error for user %s (%s): %s", user.id, email, e)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    send_weekly_digest()
