import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")

import pytest
from fastapi import HTTPException
from auth.jwt_utils import create_access_token, create_refresh_token
from auth.dependencies import get_current_user


@pytest.mark.asyncio
async def test_valid_token_returns_user_id():
    token = create_access_token(user_id=42)
    result = await get_current_user(authorization=f"Bearer {token}")
    assert result == "42"


@pytest.mark.asyncio
async def test_expired_token_raises_401():
    token = create_access_token(user_id=1, expires_minutes=-1)
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_tampered_token_raises_401():
    token = create_access_token(user_id=1)
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=f"Bearer {tampered}")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_bearer_prefix_raises_401():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Token somevalue")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_empty_token_raises_401():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer ")
    assert exc.value.status_code == 401
    assert "Missing token" in exc.value.detail


@pytest.mark.asyncio
async def test_401_includes_www_authenticate_header():
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization="Bearer garbage")
    assert exc.value.headers.get("WWW-Authenticate") == "Bearer"


@pytest.mark.asyncio
async def test_refresh_token_rejected_as_access():
    """A refresh token must not be accepted where an access token is expected."""
    token = create_refresh_token(user_id=1)
    with pytest.raises(HTTPException) as exc:
        await get_current_user(authorization=f"Bearer {token}")
    assert exc.value.status_code == 401
