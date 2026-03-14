from __future__ import annotations

from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.mvp import User
from app.settings import settings


def _parse_uuid(value: str) -> UUID:
    try:
        return UUID(value)
    except Exception as e:  #noqa: BLE001
        raise HTTPException(status_code=400, detail="Invalid X-User-Id header (must be UUID).") from e


def get_current_user_id(
    db: Session = Depends(get_db),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> UUID:
    """
    Minimal MVP auth:

    -If X-User-Id header is present, use it (must be a UUID string).
    -Otherwise, fall back to a fixed DEV_USER_ID from env (for local/dev friendliness).

    User existence policy:
    -We *lazily create* the user row if it does not exist yet.
      This keeps the MVP dev flow simple (no separate "create user" step).
    """
    user_id = _parse_uuid(x_user_id) if x_user_id else settings.dev_user_id

    #Ensure user exists (This is lazy creation).
    existing = db.get(User, user_id)
    if existing is None:
        db.add(User(id=user_id))
        db.commit()

    return user_id
