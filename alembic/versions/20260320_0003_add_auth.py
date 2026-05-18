"""add auth - email on users and magic_tokens table

Revision ID: 20260320_0003
Revises: 20260221_0002
Create Date: 2026-03-20
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260320_0003"
down_revision = "20260221_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add email to users (nullable first, we'll backfill dev user)
    op.add_column(
        "users",
        sa.Column("email", sa.Text(), nullable=True, unique=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # magic_tokens table
    op.create_table(
        "magic_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("token", sa.Text(), nullable=False, unique=True),
        sa.Column("expires_at", postgresql.TIMESTAMP(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            postgresql.TIMESTAMP(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_magic_tokens_token", "magic_tokens", ["token"], unique=True)
    op.create_index("ix_magic_tokens_user_id", "magic_tokens", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_magic_tokens_user_id", table_name="magic_tokens")
    op.drop_index("ix_magic_tokens_token", table_name="magic_tokens")
    op.drop_table("magic_tokens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_column("users", "email")