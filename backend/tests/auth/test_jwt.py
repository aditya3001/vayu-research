import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")

import pytest
from auth.jwt_utils import (
    create_access_token,
    create_refresh_token,
    decode_token,
    TokenExpiredError,
    TokenInvalidError,
)


def test_access_token_round_trip():
    token = create_access_token(user_id=42)
    payload = decode_token(token)
    assert payload["sub"] == 42
    assert payload["type"] == "access"


def test_refresh_token_round_trip():
    token = create_refresh_token(user_id=7)
    payload = decode_token(token)
    assert payload["sub"] == 7
    assert payload["type"] == "refresh"


def test_expired_token_raises_token_expired_error():
    token = create_access_token(user_id=1, expires_minutes=-1)
    with pytest.raises(TokenExpiredError):
        decode_token(token)


def test_tampered_token_raises_token_invalid_error():
    token = create_access_token(user_id=1)
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(TokenInvalidError):
        decode_token(tampered)


def test_garbage_string_raises_token_invalid_error():
    with pytest.raises(TokenInvalidError):
        decode_token("not.a.valid.token")


def test_access_and_refresh_tokens_are_different():
    access = create_access_token(user_id=1)
    refresh = create_refresh_token(user_id=1)
    assert access != refresh
