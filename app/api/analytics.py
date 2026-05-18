from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models.mvp import Item, SummaryAttempt

router = APIRouter(prefix="/analytics", tags=["analytics"])


def _percentile_from_sorted(values: list[int], q: float) -> float | None:
    """Linear interpolation percentile on sorted values (0 <= q <= 1)."""
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    if n == 1:
        return float(s[0])
    pos = (n - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return float(s[lo])
    return float(s[lo] + (s[hi] - s[lo]) * (pos - lo))


def _tier_key(row: Any) -> tuple[str, str | None, str | None]:
    return (row.model_key, row.provider, row.model)


def _per_tier_stats_postgresql(db: Session, user_id: UUID) -> list[dict[str, Any]]:
    p50 = func.percentile_cont(0.5).within_group(SummaryAttempt.latency_ms.asc())
    p95 = func.percentile_cont(0.95).within_group(SummaryAttempt.latency_ms.asc())
    stmt = (
        select(
            SummaryAttempt.model_key,
            SummaryAttempt.provider,
            SummaryAttempt.model,
            func.count().label("total_calls"),
            func.sum(case((SummaryAttempt.status == "succeeded", 1), else_=0)).label("success_count"),
            func.sum(case((SummaryAttempt.status == "failed", 1), else_=0)).label("failure_count"),
            func.avg(SummaryAttempt.latency_ms).label("avg_latency_ms"),
            p50.label("p50_latency_ms"),
            p95.label("p95_latency_ms"),
        )
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(Item.user_id == user_id)
        .group_by(SummaryAttempt.model_key, SummaryAttempt.provider, SummaryAttempt.model)
    )
    rows = db.execute(stmt).all()
    out: list[dict[str, Any]] = []
    for row in rows:
        out.append(
            {
                "model_key": row.model_key,
                "provider": row.provider,
                "model": row.model,
                "total_calls": int(row.total_calls or 0),
                "success_count": int(row.success_count or 0),
                "failure_count": int(row.failure_count or 0),
                "avg_latency_ms": float(row.avg_latency_ms) if row.avg_latency_ms is not None else None,
                "p50_latency_ms": float(row.p50_latency_ms) if row.p50_latency_ms is not None else None,
                "p95_latency_ms": float(row.p95_latency_ms) if row.p95_latency_ms is not None else None,
            }
        )
    return out


def _per_tier_stats_python(db: Session, user_id: UUID) -> list[dict[str, Any]]:
    agg_stmt = (
        select(
            SummaryAttempt.model_key,
            SummaryAttempt.provider,
            SummaryAttempt.model,
            func.count().label("total_calls"),
            func.sum(case((SummaryAttempt.status == "succeeded", 1), else_=0)).label("success_count"),
            func.sum(case((SummaryAttempt.status == "failed", 1), else_=0)).label("failure_count"),
            func.avg(SummaryAttempt.latency_ms).label("avg_latency_ms"),
        )
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(Item.user_id == user_id)
        .group_by(SummaryAttempt.model_key, SummaryAttempt.provider, SummaryAttempt.model)
    )
    agg_rows = { _tier_key(r): r for r in db.execute(agg_stmt).all() }

    lat_stmt = (
        select(
            SummaryAttempt.model_key,
            SummaryAttempt.provider,
            SummaryAttempt.model,
            SummaryAttempt.latency_ms,
        )
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(
            Item.user_id == user_id,
            SummaryAttempt.latency_ms.isnot(None),
        )
    )
    latencies_by_key: dict[tuple[str, str | None, str | None], list[int]] = {}
    for row in db.execute(lat_stmt).all():
        if row.latency_ms is None:
            continue
        key = (row.model_key, row.provider, row.model)
        latencies_by_key.setdefault(key, []).append(int(row.latency_ms))

    out: list[dict[str, Any]] = []
    for key, r in agg_rows.items():
        lats = latencies_by_key.get(key, [])
        out.append(
            {
                "model_key": r.model_key,
                "provider": r.provider,
                "model": r.model,
                "total_calls": int(r.total_calls or 0),
                "success_count": int(r.success_count or 0),
                "failure_count": int(r.failure_count or 0),
                "avg_latency_ms": float(r.avg_latency_ms) if r.avg_latency_ms is not None else None,
                "p50_latency_ms": _percentile_from_sorted(lats, 0.5),
                "p95_latency_ms": _percentile_from_sorted(lats, 0.95),
            }
        )
    return out


def _per_tier_stats(db: Session, user_id: UUID) -> list[dict[str, Any]]:
    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        try:
            return _per_tier_stats_postgresql(db, user_id)
        except Exception:
            return _per_tier_stats_python(db, user_id)
    return _per_tier_stats_python(db, user_id)


@router.get("/")
def get_analytics(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
) -> dict[str, Any]:
    total_attempts = db.scalar(
        select(func.count())
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(Item.user_id == user_id)
    )
    total_attempts = int(total_attempts or 0)

    success_count = db.scalar(
        select(func.count())
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(Item.user_id == user_id, SummaryAttempt.status == "succeeded")
    )
    success_count = int(success_count or 0)

    success_rate = (success_count / total_attempts) if total_attempts else 0.0

    per_tier = _per_tier_stats(db, user_id)

    user_attempt_join = (
        select(SummaryAttempt.route_reason, func.count().label("cnt"))
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(Item.user_id == user_id)
        .group_by(SummaryAttempt.route_reason)
    )
    route_reason_breakdown: dict[str, int] = {}
    fallback_retry_count = 0
    for row in db.execute(user_attempt_join).all():
        rr = row.route_reason
        cnt = int(row.cnt or 0)
        key = rr if rr is not None else "(null)"
        route_reason_breakdown[key] = cnt
        if rr is not None and rr.startswith("fallback_from_"):
            fallback_retry_count += cnt

    failure_rows = db.scalars(
        select(SummaryAttempt.error_detail)
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(
            Item.user_id == user_id,
            SummaryAttempt.status == "failed",
            SummaryAttempt.error_detail.isnot(None),
        )
    ).all()
    failure_category_breakdown: dict[str, int] = {}
    for ed in failure_rows:
        if not ed or not str(ed).strip():
            cat = "(empty)"
        else:
            cat = str(ed).split(":", 1)[0].strip() or "(empty)"
        failure_category_breakdown[cat] = failure_category_breakdown.get(cat, 0) + 1

    avg_cost_stmt = (
        select(
            SummaryAttempt.model_key,
            func.avg(SummaryAttempt.estimated_cost_usd).label("avg_cost"),
        )
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(
            Item.user_id == user_id,
            SummaryAttempt.estimated_cost_usd.isnot(None),
        )
        .group_by(SummaryAttempt.model_key)
    )
    avg_estimated_cost_usd_by_model_key: list[dict[str, Any]] = []
    for row in db.execute(avg_cost_stmt).all():
        avg_estimated_cost_usd_by_model_key.append(
            {
                "model_key": row.model_key,
                "avg_estimated_cost_usd": float(row.avg_cost) if row.avg_cost is not None else None,
            }
        )

    today_utc = datetime.now(timezone.utc).date()
    start_utc = today_utc - timedelta(days=13)
    start_dt = datetime.combine(start_utc, datetime.min.time(), tzinfo=timezone.utc)

    day_bucket = func.date_trunc("day", SummaryAttempt.created_at)
    daily_stmt = (
        select(day_bucket.label("day"), func.count().label("cnt"))
        .select_from(SummaryAttempt)
        .join(Item, SummaryAttempt.item_id == Item.id)
        .where(Item.user_id == user_id, SummaryAttempt.created_at >= start_dt)
        .group_by(day_bucket)
    )
    counts_by_day: dict[Any, int] = {}
    for row in db.execute(daily_stmt).all():
        day_val = row.day
        if isinstance(day_val, datetime):
            d = day_val.date()
        else:
            d = day_val
        counts_by_day[d] = int(row.cnt or 0)

    daily_counts: list[dict[str, Any]] = []
    for i in range(14):
        d = start_utc + timedelta(days=i)
        daily_counts.append({"date": d.isoformat(), "count": counts_by_day.get(d, 0)})

    return {
        "total_attempts": total_attempts,
        "success_rate": success_rate,
        "per_tier": per_tier,
        "daily_counts": daily_counts,
        "route_reason_breakdown": route_reason_breakdown,
        "failure_category_breakdown": failure_category_breakdown,
        "fallback_retry_count": fallback_retry_count,
        "avg_estimated_cost_usd_by_model_key": avg_estimated_cost_usd_by_model_key,
    }
