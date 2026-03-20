from __future__ import annotations

import base64
import hashlib
import hmac
from uuid import UUID

from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.mvp import User
from app.settings import settings


def _validate_session_token(token: str) -> UUID:
    """
    Validate a session token and return the user_id.
    Token format: base64(user_id:email:timestamp:signature)
    """
    try:
        decoded = base64.urlsafe_b64decode(token.encode()).decode()
        parts = decoded.rsplit(":", 1)
        if len(parts) != 2:
            raise ValueError("Invalid token format")
        payload, signature = parts
        expected_signature = hmac.new(
            settings.jwt_secret.encode(),
            payload.encode(),
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("Invalid token signature")
        user_id_str = payload.split(":")[0]
        return UUID(user_id_str)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.") from e


def get_current_user_id(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> UUID:
    """
    Auth resolution order:
    1. Authorization: Bearer <session_token> — real auth via magic link
    2. X-User-Id header — legacy dev fallback
    3. settings.dev_user_id — local dev fallback
    """
    # Real auth via session token
    if authorization and authorization.startswith("Bearer "):
        token = authorization.removeprefix("Bearer ").strip()
        user_id = _validate_session_token(token)
        existing = db.get(User, user_id)
        if existing is None:
            raise HTTPException(status_code=401, detail="User not found.")
        return user_id

    # Legacy dev fallback via X-User-Id header
    if x_user_id:
        try:
            user_id = UUID(x_user_id)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid X-User-Id header.") from e
        existing = db.get(User, user_id)
        if existing is None:
            db.add(User(id=user_id))
            db.commit()
        return user_id

    # Local dev fallback
    user_id = settings.dev_user_id
    existing = db.get(User, user_id)
    if existing is None:
        db.add(User(id=user_id))
        db.commit()
    return user_id