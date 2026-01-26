from __future__ import annotations

import os
import subprocess
import uuid
from urllib.parse import urlencode, urlsplit, urlunsplit, parse_qsl

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

#NOTE: This test expects a running Postgres and DATABASE_URL set.
#It uses a per-test schema for isolation.


def _add_query_param(url: str, key: str, value: str) -> str:
    parts = urlsplit(url)
    q = dict(parse_qsl(parts.query, keep_blank_values=True))
    q[key] = value
    return urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(q), parts.fragment))


@pytest.fixture
def migrated_db_url() -> str:
    base_url = os.environ["DATABASE_URL"]
    schema = f"test_{uuid.uuid4().hex}"

    #Ensure connections use an isolated schema via Postgres 'options'
    #(safe for Alembic + ORM; avoids cross-test table collisions).
    test_url = _add_query_param(base_url, "options", f"-csearch_path={schema},public")

    #Run alembic upgrade in a subprocess with DATABASE_URL overridden
    env = dict(os.environ)
    env["DATABASE_URL"] = test_url

    #Create schema first
    engine = create_engine(test_url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    engine.dispose()

    subprocess.check_call(["alembic", "upgrade", "head"], env=env)

    yield test_url

    #Teardown: drop schema cascade
    engine = create_engine(test_url, pool_pre_ping=True)
    with engine.connect() as conn:
        conn.exec_driver_sql(f'DROP SCHEMA IF EXISTS "{schema}" CASCADE')
    engine.dispose()


def test_models_crud_relationships(migrated_db_url: str) -> None:
    from app.models.mvp import (
        User,
        Item,
        ItemContent,
        ExtractionAttempt,
        ItemStatus,
        ItemSourceType,
        ItemFinalTextSource,
    )

    engine = create_engine(migrated_db_url, pool_pre_ping=True)

    with Session(engine) as session:
        #Create user
        user = User()
        session.add(user)
        session.flush()

        #Create item + content + attempts
        item = Item(
            user_id=user.id,
            status=ItemStatus.queued,
            source_type=ItemSourceType.url,
            requested_url="https://example.com/post",
            status_detail=None,
            final_text_source=None,
            title=None,
        )
        item.content = ItemContent(
            user_pasted_text=None,
            extracted_text="hello extracted",
            canonical_text="hello canonical",
        )
        item.extraction_attempts.append(
            ExtractionAttempt(
                attempt_no=1,
                result="ok",
                http_status=200,
                final_url="https://example.com/post",
                content_length=1234,
            )
        )

        session.add(item)
        session.commit()

        #Relationship checks
        loaded_item = session.scalar(select(Item).where(Item.id == item.id))
        assert loaded_item is not None
        assert loaded_item.user.id == user.id
        assert loaded_item.content is not None
        assert loaded_item.content.canonical_text == "hello canonical"
        assert len(loaded_item.extraction_attempts) == 1
        assert loaded_item.extraction_attempts[0].attempt_no == 1

        #Update final_text_source to ensure enum works
        loaded_item.status = ItemStatus.succeeded
        loaded_item.final_text_source = ItemFinalTextSource.extracted_from_url
        session.commit()

        reloaded = session.scalar(select(Item).where(Item.id == item.id))
        assert reloaded is not None
        assert reloaded.status == ItemStatus.succeeded
        assert reloaded.final_text_source == ItemFinalTextSource.extracted_from_url

    engine.dispose()
