from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_user_id
from app.db import get_db
from app.models.mvp import (
    Item,
    ItemContent,
    ItemFinalTextSource,
    ItemSourceType,
    ItemStatus,
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

router = APIRouter(prefix="/items", tags=["items"])


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
