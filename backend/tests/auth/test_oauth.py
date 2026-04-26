import os
os.environ.setdefault("GITHUB_CLIENT_ID", "test-github-id")
os.environ.setdefault("GITHUB_CLIENT_SECRET", "test-github-secret")
os.environ.setdefault("GOOGLE_CLIENT_ID", "test-google-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-google-secret")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from auth.oauth import (
    create_exchange_code,
    redeem_exchange_code,
    build_github_auth_url,
    build_google_auth_url,
    store_oauth_state,
    verify_oauth_state,
)


def test_exchange_code_round_trip():
    code = create_exchange_code(user_id=99)
    assert isinstance(code, str) and len(code) > 10
    assert redeem_exchange_code(code) == 99


def test_exchange_code_single_use():
    code = create_exchange_code(user_id=5)
    assert redeem_exchange_code(code) == 5
    assert redeem_exchange_code(code) is None  # already redeemed


def test_exchange_code_expired_returns_none():
    code = create_exchange_code(user_id=3, ttl_seconds=-1)
    assert redeem_exchange_code(code) is None


def test_oauth_state_round_trip():
    state = store_oauth_state()
    assert verify_oauth_state(state) is True


def test_invalid_state_rejected():
    assert verify_oauth_state("not-a-real-state") is False


def test_state_single_use():
    state = store_oauth_state()
    assert verify_oauth_state(state) is True
    assert verify_oauth_state(state) is False  # consumed


def test_github_auth_url_contains_expected_parts():
    url, state = build_github_auth_url(callback_url="http://localhost:8000/api/auth/callback/github")
    assert "github.com/login/oauth/authorize" in url
    assert state in url
    assert "client_id=test-github-id" in url


def test_google_auth_url_contains_expected_parts():
    url, state = build_google_auth_url(callback_url="http://localhost:8000/api/auth/callback/google")
    assert "accounts.google.com/o/oauth2/v2/auth" in url
    assert state in url
    assert "client_id=test-google-id" in url
