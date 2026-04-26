import os
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-testing-only")
os.environ.setdefault("COOKIE_SECURE", "false")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")
os.environ.setdefault("BACKEND_URL", "http://localhost:8000")

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from database import Base, get_db
from auth.router import router
import auth.models  # noqa: F401 — registers User table


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/auth")
    app.dependency_overrides[get_db] = override_db
    return TestClient(app)


def test_signup_returns_access_token(client):
    resp = client.post("/auth/signup", json={"email": "a@b.com", "password": "secret123"})
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


def test_signup_sets_refresh_cookie(client):
    resp = client.post("/auth/signup", json={"email": "cookie@b.com", "password": "secret123"})
    assert "refresh_token" in resp.cookies


def test_signup_duplicate_email_returns_400(client):
    client.post("/auth/signup", json={"email": "dup@b.com", "password": "pass1234"})
    resp = client.post("/auth/signup", json={"email": "dup@b.com", "password": "pass5678"})
    assert resp.status_code == 400


def test_signup_short_password_returns_400(client):
    resp = client.post("/auth/signup", json={"email": "short@b.com", "password": "abc"})
    assert resp.status_code == 400


def test_login_returns_access_token(client):
    client.post("/auth/signup", json={"email": "login@b.com", "password": "pass1234"})
    resp = client.post("/auth/login", json={"email": "login@b.com", "password": "pass1234"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password_returns_401(client):
    client.post("/auth/signup", json={"email": "wp@b.com", "password": "rightpass"})
    resp = client.post("/auth/login", json={"email": "wp@b.com", "password": "wrongpass"})
    assert resp.status_code == 401


def test_login_unknown_email_returns_401(client):
    resp = client.post("/auth/login", json={"email": "nobody@b.com", "password": "pass1234"})
    assert resp.status_code == 401


def test_logout_clears_refresh_cookie(client):
    client.post("/auth/signup", json={"email": "logout@b.com", "password": "pass1234"})
    resp = client.post("/auth/logout")
    assert resp.status_code == 200
    set_cookie = resp.headers.get("set-cookie", "")
    assert "refresh_token" in set_cookie


def test_refresh_with_valid_cookie_returns_new_access_token(client):
    client.post("/auth/signup", json={"email": "ref@b.com", "password": "pass1234"})
    resp = client.post("/auth/refresh")
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_refresh_with_no_cookie_returns_401():
    # Fresh client — no cookies
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)

    def override_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(router, prefix="/auth")
    app.dependency_overrides[get_db] = override_db
    fresh = TestClient(app)
    resp = fresh.post("/auth/refresh")
    assert resp.status_code == 401
