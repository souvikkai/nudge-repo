from __future__ import annotations

from datetime import datetime
from typing import Optional, List, Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.models.mvp import ItemFinalTextSource, ItemSourceType, ItemStatus


CANONICAL_TEXT_MAX_CHARS = 200_000


class ItemCreateRequest(BaseModel):
    url: Optional[str] = Field(default=None, min_length=1, max_length=4096)
    pasted_text: Optional[str] = Field(default=None, min_length=1, max_length=CANONICAL_TEXT_MAX_CHARS)
    prefer_pasted_text: bool = False

    @model_validator(mode="after")
    def _validate_at_least_one(self) -> "ItemCreateRequest":
        if not self.url and not self.pasted_text:
            raise ValueError("Require at least one of url or pasted_text.")
        return self


class ItemCreateResponse(BaseModel):
    id: UUID
    status: ItemStatus


class ItemListEntry(BaseModel):
    id: UUID
    status: ItemStatus
    status_detail: Optional[str]
    source_type: ItemSourceType
    requested_url: Optional[str]
    final_text_source: Optional[ItemFinalTextSource]
    title: Optional[str]
    created_at: datetime
    updated_at: datetime


class ItemContentOut(BaseModel):
    user_pasted_text: Optional[str]
    extracted_text: Optional[str]
    canonical_text: Optional[str]
    updated_at: datetime


class ItemDetailResponse(ItemListEntry):
    content: Optional[ItemContentOut] = None


class ItemListResponse(BaseModel):
    items: List[ItemListEntry]
    next_cursor: Optional[str] = None


class ItemTextPatchRequest(BaseModel):
    pasted_text: str = Field(min_length=1, max_length=CANONICAL_TEXT_MAX_CHARS)
