from __future__ import annotations

import secrets
import urllib.request
import json
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models.mvp import MagicToken, User
from app.settings import settings

router = APIRouter(prefix="/auth", tags=["auth"])

TOKEN_EXPIRY_MINUTES = 15


class RequestLoginBody(BaseModel):
    email: str


class VerifyResponse(BaseModel):
    token: str
    user_id: str
    email: str


def _send_magic_link_email(to_email: str, magic_link: str) -> None:
    """Send magic link email via Resend API."""
    payload = json.dumps({
        "from": "Nudge <nudge@resend.dev>",
        "to": [to_email],
        "subject": "Your Nudge login link",
        "html": f"""
        <div style="font-family: serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="font-size: 2rem; margin-bottom: 8px;">Nudge</h1>
            <p style="color: #b3322a; font-size: 0.75rem; letter-spacing: 0.2em; text-transform: uppercase; margin-bottom: 32px;">
                For things worth coming back to.
            </p>
            <p style="font-size: 1rem; color: #333; margin-bottom: 24px;">
                Click the link below to sign in. This link expires in 15 minutes.
            </p>
            <a href="{magic_link}"
               style="display: inline-block; background: #000; color: #fff; padding: 12px 24px;
                      text-decoration: none; border-radius: 8px; font-size: 0.9rem; margin-bottom: 24px;">
                Sign in to Nudge
            </a>
            <p style="font-size: 0.8rem; color: #999; margin-top: 24px;">
                If you didn't request this, you can safely ignore this email.
            </p>
        </div>
        """,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {settings.resend_api_key}",
            "User-Agent": "Nudge/1.0",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        if resp.status not in (200, 201):
            raise RuntimeError(f"Resend returned status {resp.status}")


@router.post("/request-login")
def request_login(
    body: RequestLoginBody,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Request a magic link login email.
    Creates user if they don't exist yet.
    """
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address.")

    # Find or create user
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        user = User(id=uuid4(), email=email)
        db.add(user)
        db.commit()
        db.refresh(user)

    # Create magic token
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=TOKEN_EXPIRY_MINUTES)
    magic_token = MagicToken(
        id=uuid4(),
        user_id=user.id,
        token=token,
        expires_at=expires_at,
        used=False,
    )
    db.add(magic_token)
    db.commit()

    # Build magic link
    frontend_url = settings.frontend_url.rstrip("/")
    magic_link = f"{frontend_url}/auth/verify?token={token}"

    # Send email
    try:
        _send_magic_link_email(email, magic_link)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {e}")

    return JSONResponse({"message": "Check your email for a login link."})


@router.get("/verify")
def verify_token(
    token: str,
    db: Session = Depends(get_db),
) -> JSONResponse:
    """
    Verify a magic token and return a session JWT.
    """
    now = datetime.now(timezone.utc)

    magic_token = db.scalar(
        select(MagicToken).where(MagicToken.token == token)
    )

    if magic_token is None:
        raise HTTPException(status_code=400, detail="Invalid or expired login link.")

    if magic_token.used:
        raise HTTPException(status_code=400, detail="This login link has already been used.")

    if magic_token.expires_at < now:
        raise HTTPException(status_code=400, detail="This login link has expired.")

    # Mark token as used
    magic_token.used = True
    db.commit()

    # Get user
    user = db.get(User, magic_token.user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")

    # Create simple JWT session token
    import base64
    import hmac
    import hashlib

    payload = f"{user.id}:{user.email}:{int(now.timestamp())}"
    signature = hmac.new(
        settings.jwt_secret.encode(),
        payload.encode(),
        hashlib.sha256,
    ).hexdigest()
    session_token = base64.urlsafe_b64encode(
        f"{payload}:{signature}".encode()
    ).decode()

    return JSONResponse({
        "token": session_token,
        "user_id": str(user.id),
        "email": user.email,
    })