import pytest
import asyncio
from unittest.mock import patch
from fastapi import HTTPException


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro)


def test_valid_token_returns_uid():
    with patch("auth.dependencies.verify_id_token", return_value={"uid": "user-abc"}):
        from auth.dependencies import get_current_user
        result = run(get_current_user("Bearer valid_token_here"))
        assert result == "user-abc"


def test_invalid_token_raises_401():
    with patch("auth.dependencies.verify_id_token", side_effect=Exception("token invalid")):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            run(get_current_user("Bearer bad_token"))
        assert exc.value.status_code == 401


def test_missing_bearer_raises_401():
    with patch("auth.dependencies.verify_id_token"):
        from auth.dependencies import get_current_user
        with pytest.raises(HTTPException) as exc:
            run(get_current_user("not-a-bearer-token"))
        assert exc.value.status_code == 401


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
