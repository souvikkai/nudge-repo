from __future__ import annotations

from typing import Generator
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.settings import settings


def _with_default_sslmode(database_url: str) -> str:
    """
    Ensure sslmode=require for non-local hosts unless the URL already specifies sslmode.

    Notes:
    -Neon requires TSL/SSL.
    -But local docker Postgres commonly does not run with TSL/SSL enabled.
    -If the you explicitly sets sslmode in DATABASE_URL, we respect it.
    """
    parts = urlsplit(database_url)
    host = parts.hostname or ""

    #Respect explicit sslmode if present.
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    if "sslmode" in query:
        return database_url

    is_local = host in {"localhost", "127.0.0.1"} or host.endswith(".local")
    if is_local:
        return database_url

    query["sslmode"] = "require"
    new_query = urlencode(query, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


DATABASE_URL = _with_default_sslmode(settings.database_url)

#These are settings for serverless Postgress/conservative for Neon:
# -small pool_size
# -no overflow bursts
# -pre_ping to avoid stale connections
# -recycle to reduce long-lived idle connections
engine: Engine = create_engine(
    DATABASE_URL,
    pool_size=2,
    max_overflow=0,
    pool_timeout=30,
    pool_pre_ping=True,
    pool_recycle=300,
)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False, class_=Session)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency that provides a short-lived SQLAlchemy Session.

    IMPORTANT: Don't perform network I/O (e.g., URL fetch) inside DB transactions.
    Don't wanna tie up scares DB connections in small pool or increase chance of timeout
    Keep transactions short; commit/rollback explicitly in request handlers/workers.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
