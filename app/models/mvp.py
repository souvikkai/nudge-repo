from __future__ import annotations

import enum
from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from sqlalchemy import (
    ForeignKey,
    Integer,
    Text,
    Enum as SAEnum,
)
from sqlalchemy.dialects.postgresql import UUID as PGUUID, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.models.base import Base


class ItemStatus(str, enum.Enum):
    queued = "queued"
    processing = "processing"
    needs_user_text = "needs_user_text"
    succeeded = "succeeded"
    failed = "failed"


class ItemSourceType(str, enum.Enum):
    url = "url"
    pasted_text = "pasted_text"


class ItemFinalTextSource(str, enum.Enum):
    extracted_from_url = "extracted_from_url"
    user_pasted_text = "user_pasted_text"


class User(Base):
    __tablename__ = "users"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    items: Mapped[List["Item"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class Item(Base):
    __tablename__ = "items"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    user_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[ItemStatus] = mapped_column(
        SAEnum(ItemStatus, name="item_status", native_enum=True),
        nullable=False,
        index=True,
    )

    status_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    source_type: Mapped[ItemSourceType] = mapped_column(
        SAEnum(ItemSourceType, name="item_source_type", native_enum=True),
        nullable=False,
    )

    requested_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    final_text_source: Mapped[Optional[ItemFinalTextSource]] = mapped_column(
        SAEnum(ItemFinalTextSource, name="item_final_text_source", native_enum=True),
        nullable=True,
    )

    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(back_populates="items")

    content: Mapped[Optional["ItemContent"]] = relationship(
        back_populates="item",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    extraction_attempts: Mapped[List["ExtractionAttempt"]] = relationship(
        back_populates="item",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="ExtractionAttempt.attempt_no",
    )


class ItemContent(Base):
    __tablename__ = "item_content"

    # 1:1 key (PK/FK) to items.id
    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        primary_key=True,
    )

    user_pasted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    extracted_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    canonical_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    item: Mapped["Item"] = relationship(back_populates="content")


class ExtractionAttempt(Base):
    __tablename__ = "extraction_attempts"

    id: Mapped[UUID] = mapped_column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)

    item_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("items.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    attempt_no: Mapped[int] = mapped_column(Integer, nullable=False)

    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True), nullable=True)

    result: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    error_code: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_detail: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    http_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    final_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    content_length: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    item: Mapped["Item"] = relationship(back_populates="extraction_attempts")
