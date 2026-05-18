from __future__ import annotations

import importlib
import os
import subprocess
import uuid
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine


def _add_query_param(url: str, key: str, value: str) -> str:
    parts = urlsplit(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q[key] = value
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


@pytest.fixture
def api_client() -> TestClient:
    """
    Creates an isolated schema, applies alembic migrations, then boots the FastAPI app
    with DATABASE_URL pointed at that schema (via search_path).
    """
    base_url = os.environ["DATABASE_URL"]
    schema = f"test_{uuid.uuid4().hex}"
    test_url = _add_query_param(base_url, "options", f"-csearch_path={schema},public")

    #Create schema first
    engine = create_engine(test_url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    engine.dispose()

    #Apply migrations
    env = dict(os.environ)
    env["DATABASE_URL"] = test_url
    subprocess.check_call(["alembic", "upgrade", "head"], env=env)

    #Boot app using this test DATABASE_URL
    os.environ["DATABASE_URL"] = test_url
    os.environ.setdefault("DEV_USER_ID", "00000000-0000-0000-0000-000000000001")

    #Reload settings/db/main so module-level engine binds to the test DB
    import app.settings as settings_mod
    import app.db as db_mod
    import app.main as main_mod

    importlib.reload(settings_mod)
    importlib.reload(db_mod)
    importlib.reload(main_mod)

    client = TestClient(main_mod.app)

    yield client

    #Teardown schema cascade
    engine = create_engine(test_url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    engine.dispose()
