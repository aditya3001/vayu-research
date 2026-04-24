import pytest
from unittest.mock import patch
from fastapi import HTTPException


@pytest.mark.asyncio
async def test_valid_token_returns_uid():
    with patch("auth.dependencies.verify_id_token", return_value={"uid": "user-abc"}):
        from auth.dependencies import get_current_user
        result = await get_current_user("Bearer valid_token_here")
        assert result == "user-abc"


@pytest.mark.asyncio
async def test_invalid_token_raises_401():
    with patch("auth.dependencies.verify_id_token", side_effect=Exception("token invalid")):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            await get_current_user("Bearer bad_token")
        assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_missing_bearer_raises_401():
    with patch("auth.dependencies.verify_id_token"):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            await get_current_user("not-a-bearer-token")
        assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_empty_token_raises_401():
    with patch("auth.dependencies.verify_id_token"):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            await get_current_user("Bearer ")
        assert exc.value.status_code == 401
        assert "Missing token" in exc.value.detail


def test_missing_header_raises_422():
    """FastAPI raises 422 when a required Header is absent."""
    from fastapi import FastAPI, Depends
    from fastapi.testclient import TestClient
    from auth.dependencies import get_current_user

    app = FastAPI()

    @app.get("/test")
    async def handler(uid: str = Depends(get_current_user)):
        return {"uid": uid}

    client = TestClient(app)
    response = client.get("/test")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_firebase_infra_error_returns_503():
    from firebase_admin import exceptions as fb_exceptions
    with patch("auth.dependencies.verify_id_token", side_effect=fb_exceptions.FirebaseError("INTERNAL", "cert fetch failed")):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            await get_current_user("Bearer sometoken")
        assert exc.value.status_code == 503


@pytest.mark.asyncio
async def test_401_includes_www_authenticate_header():
    with patch("auth.dependencies.verify_id_token", side_effect=Exception("bad")):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            await get_current_user("Bearer badtoken")
        assert exc.value.headers.get("WWW-Authenticate") == "Bearer"
