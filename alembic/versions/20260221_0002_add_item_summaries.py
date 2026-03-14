"""add item_summaries + summary_attempts

Revision ID: 20260221_0002
Revises: 20260125_0001
Create Date: 2026-02-21
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = "20260221_0002"
down_revision = "20260125_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # -------------------------
    # item_summaries
    # -------------------------
    op.create_table(
        "item_summaries",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("model_key", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=True),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("input_chars_original", sa.Integer(), nullable=False),
        sa.Column("input_chars_used", sa.Integer(), nullable=False),
        sa.Column("output_words", sa.Integer(), nullable=False),
        sa.Column("summary_text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint(
            "model_key IN ('strong','mid','budget')",
            name="ck_item_summaries_model_key",
        ),
        sa.CheckConstraint(
            "input_chars_original >= 0 AND input_chars_used >= 0",
            name="ck_item_summaries_input_chars_nonneg",
        ),
        sa.CheckConstraint(
            "output_words >= 0",
            name="ck_item_summaries_output_words_nonneg",
        ),
    )

    # Basic indexes
    op.create_index("ix_item_summaries_item_id", "item_summaries", ["item_id"])
    op.create_index("ix_item_summaries_user_id", "item_summaries", ["user_id"])
    op.create_index("ix_item_summaries_created_at", "item_summaries", ["created_at"])

    # Required ordered indexes (Postgres-specific)
    op.execute(
        "CREATE INDEX ix_item_summaries_item_created_at_desc "
        "ON item_summaries (item_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX ix_item_summaries_user_created_at_desc "
        "ON item_summaries (user_id, created_at DESC)"
    )

    # -------------------------
    # summary_attempts (append-only)
    # -------------------------
    op.create_table(
        "summary_attempts",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column(
            "item_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("items.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("attempt_no", sa.Integer(), nullable=False),
        sa.Column("model_key", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=True),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column(
            "started_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("finished_at", postgresql.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        # Keep attempt_no usable across model benchmarking.
        sa.UniqueConstraint(
            "item_id",
            "model_key",
            "attempt_no",
            name="uq_summary_attempts_item_model_attempt_no",
        ),
        sa.CheckConstraint(
            "model_key IN ('strong','mid','budget')",
            name="ck_summary_attempts_model_key",
        ),
        sa.CheckConstraint(
            "status IN ('succeeded','failed')",
            name="ck_summary_attempts_status",
        ),
    )

    # Required indexes
    op.create_index("ix_summary_attempts_item_id", "summary_attempts", ["item_id"])
    op.create_index(
        "ix_summary_attempts_item_attempt_no",
        "summary_attempts",
        ["item_id", "attempt_no"],
    )
    op.create_index("ix_summary_attempts_created_at", "summary_attempts", ["created_at"])


def downgrade() -> None:
    # Drop indexes first (including raw SQL ones)
    op.drop_index("ix_summary_attempts_created_at", table_name="summary_attempts")
    op.drop_index("ix_summary_attempts_item_attempt_no", table_name="summary_attempts")
    op.drop_index("ix_summary_attempts_item_id", table_name="summary_attempts")
    op.drop_table("summary_attempts")

    op.execute("DROP INDEX IF EXISTS ix_item_summaries_user_created_at_desc")
    op.execute("DROP INDEX IF EXISTS ix_item_summaries_item_created_at_desc")

    op.drop_index("ix_item_summaries_created_at", table_name="item_summaries")
    op.drop_index("ix_item_summaries_user_id", table_name="item_summaries")
    op.drop_index("ix_item_summaries_item_id", table_name="item_summaries")
    op.drop_table("item_summaries")