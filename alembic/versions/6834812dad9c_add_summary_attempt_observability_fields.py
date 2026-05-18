"""add summary attempt observability fields

Revision ID: 6834812dad9c
Revises: 20260320_0003
Create Date: 2026-05-17 16:48:50.120730

"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa



# revision identifiers, used by Alembic.
revision = '6834812dad9c'
down_revision = '20260320_0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('summary_attempts', sa.Column('input_tokens_est', sa.Integer(), nullable=True))
    op.add_column('summary_attempts', sa.Column('output_tokens_est', sa.Integer(), nullable=True))
    op.add_column('summary_attempts', sa.Column('estimated_cost_usd', sa.Float(), nullable=True))
    op.add_column('summary_attempts', sa.Column('route_reason', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('summary_attempts', 'route_reason')
    op.drop_column('summary_attempts', 'estimated_cost_usd')
    op.drop_column('summary_attempts', 'output_tokens_est')
    op.drop_column('summary_attempts', 'input_tokens_est')
