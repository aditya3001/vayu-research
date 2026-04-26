import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from auth.models import User
from auth.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenExpiredError,
    TokenInvalidError,
)
from auth.password import hash_password, verify_password
from auth.oauth import (
    build_github_auth_url,
    build_google_auth_url,
    verify_oauth_state,
    exchange_github_code,
    exchange_google_code,
    create_exchange_code,
    redeem_exchange_code,
    FRONTEND_URL,
)

logger = logging.getLogger(__name__)
router = APIRouter()

COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "false").lower() == "true"
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")


# ── Cookie helpers ────────────────────────────────────────────────────────────

def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=30 * 24 * 3600,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(key="refresh_token", path="/")


def _get_or_create_oauth_user(db: Session, email: str, provider: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(email=email, provider=provider)
        db.add(user)
        db.commit()
        db.refresh(user)
    return user


# ── Schemas ───────────────────────────────────────────────────────────────────

class EmailAuthRequest(BaseModel):
    email: str
    password: str


class ExchangeRequest(BaseModel):
    code: str


# ── Email / Password ──────────────────────────────────────────────────────────

@router.post("/signup")
def signup(body: EmailAuthRequest, response: Response, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = User(
        email=body.email.lower(),
        provider="email",
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.post("/login")
def login(body: EmailAuthRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


# ── Token management ──────────────────────────────────────────────────────────

@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
    except (TokenExpiredError, TokenInvalidError):
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user = db.query(User).filter(User.id == payload["sub"]).first()
    if not user:
        _clear_refresh_cookie(response)
        raise HTTPException(status_code=401, detail="User not found")
    # Rotate: issue new refresh token
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}


@router.post("/logout")
def logout(response: Response):
    _clear_refresh_cookie(response)
    return {"ok": True}


# ── OAuth — GitHub ────────────────────────────────────────────────────────────

@router.get("/github")
def github_login():
    callback_url = f"{BACKEND_URL}/api/auth/callback/github"
    url, _ = build_github_auth_url(callback_url)
    return RedirectResponse(url=url)


@router.get("/callback/github")
def github_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    callback_url = f"{BACKEND_URL}/api/auth/callback/github"
    try:
        user_info = exchange_github_code(code, callback_url)
    except Exception as e:
        logger.error("GitHub OAuth exchange failed: %s", e)
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")
    user = _get_or_create_oauth_user(db, email=user_info["email"], provider="github")
    exchange_code = create_exchange_code(user.id)
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?code={exchange_code}")


# ── OAuth — Google ────────────────────────────────────────────────────────────

@router.get("/google")
def google_login():
    callback_url = f"{BACKEND_URL}/api/auth/callback/google"
    url, _ = build_google_auth_url(callback_url)
    return RedirectResponse(url=url)


@router.get("/callback/google")
def google_callback(code: str, state: str, db: Session = Depends(get_db)):
    if not verify_oauth_state(state):
        raise HTTPException(status_code=400, detail="Invalid state parameter")
    callback_url = f"{BACKEND_URL}/api/auth/callback/google"
    try:
        user_info = exchange_google_code(code, callback_url)
    except Exception as e:
        logger.error("Google OAuth exchange failed: %s", e)
        return RedirectResponse(url=f"{FRONTEND_URL}/login?error=oauth_failed")
    user = _get_or_create_oauth_user(db, email=user_info["email"], provider="google")
    exchange_code = create_exchange_code(user.id)
    return RedirectResponse(url=f"{FRONTEND_URL}/auth/callback?code={exchange_code}")


# ── One-time code exchange ────────────────────────────────────────────────────

@router.post("/exchange")
def exchange_code(body: ExchangeRequest, response: Response, db: Session = Depends(get_db)):
    user_id = redeem_exchange_code(body.code)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired exchange code")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")
    _set_refresh_cookie(response, create_refresh_token(user.id))
    return {"access_token": create_access_token(user.id), "token_type": "bearer"}
