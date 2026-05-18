import os

import pytest
from sqlalchemy import text
from app.db import engine


@pytest.mark.skipif(
    not os.getenv("DATABASE_URL"),
    reason="DATABASE_URL not set; skipping DB smoke test.",
)
def test_db_select_1() -> None:
    with engine.connect() as conn:
        val = conn.execute(text("SELECT 1")).scalar_one()
    assert val == 1
