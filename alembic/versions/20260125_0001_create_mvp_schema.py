"""create mvp schema

Revision ID: 20260125_0001
Revises:
Create Date: 2026-01-25
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

#revision identifiers, used by Alembic.
revision = "20260125_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    #Enums (Postgres native types)
    item_status = postgresql.ENUM(
        "queued",
        "processing",
        "needs_user_text",
        "succeeded",
        "failed",
        name="item_status",
    )
    item_source_type = postgresql.ENUM(
        "url",
        "pasted_text",
        name="item_source_type",
    )
    item_final_text_source = postgresql.ENUM(
        "extracted_from_url",
        "user_pasted_text",
        name="item_final_text_source",
    )

    item_status.create(op.get_bind(), checkfirst=True)
    item_source_type.create(op.get_bind(), checkfirst=True)
    item_final_text_source.create(op.get_bind(), checkfirst=True)

    #users
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # items
    op.create_table(
        "items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("status", item_status, nullable=False),
        sa.Column("status_detail", sa.Text(), nullable=True),
        sa.Column("source_type", item_source_type, nullable=False),
        sa.Column("requested_url", sa.Text(), nullable=True),
        sa.Column("final_text_source", item_final_text_source, nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    #item_content (1:1 PK/FK)
    op.create_table(
        "item_content",
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("user_pasted_text", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("canonical_text", sa.Text(), nullable=True),
        sa.Column(
            "updated_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    #extraction_attempts
    op.create_table(
        "extraction_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column(
            "started_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("finished_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("result", sa.Text(), nullable=True),
        sa.Column("error_code", sa.Text(), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("http_status", sa.Integer(), nullable=True),
        sa.Column("final_url", sa.Text(), nullable=True),
        sa.Column("content_length", sa.Integer(), nullable=True),
        sa.UniqueConstraint("item_id", "attempt_no", name="uq_extraction_attempts_item_attempt_no"),
    )

    #Indexes (minimum + polling-friendly)
    op.create_index("ix_items_user_id", "items", ["user_id"])
    op.create_index("ix_items_status", "items", ["status"])
    op.create_index("ix_items_created_at", "items", ["created_at"])
    op.create_index("ix_extraction_attempts_item_id", "extraction_attempts", ["item_id"])

    #Ordered indexes for polling (Postgres-specific)
    op.execute("CREATE INDEX ix_items_user_created_at_desc ON items (user_id, created_at DESC)")
    op.execute(
        "CREATE INDEX ix_items_user_status_created_at_desc ON items (user_id, status, created_at DESC)"
    )


def downgrade() -> None:
    #Drop polling indexes first (they are raw SQL)
    op.execute("DROP INDEX IF EXISTS ix_items_user_status_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_items_user_created_at_desc")

    op.drop_index("ix_extraction_attempts_item_id", table_name="extraction_attempts")
    op.drop_index("ix_items_created_at", table_name="items")
    op.drop_index("ix_items_status", table_name="items")
    op.drop_index("ix_items_user_id", table_name="items")

    op.drop_table("extraction_attempts")
    op.drop_table("item_content")
    op.drop_table("items")
    op.drop_table("users")

    #Drop enums last
    postgresql.ENUM(name="item_final_text_source").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="item_source_type").drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM(name="item_status").drop(op.get_bind(), checkfirst=True)
