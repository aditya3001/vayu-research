import os
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError, ExpiredSignatureError

_raw_key = os.environ.get("JWT_SECRET_KEY", "")
if not _raw_key:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not set. "
        "Generate a strong random key with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
    )
SECRET_KEY = _raw_key
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30


class TokenExpiredError(Exception):
    pass


class TokenInvalidError(Exception):
    pass


def create_access_token(user_id: int, expires_minutes: int = ACCESS_TOKEN_EXPIRE_MINUTES) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=expires_minutes),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "iat": now,
        "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises TokenExpiredError or TokenInvalidError.

    NOTE: This function does not validate the token type ("access" vs "refresh").
    Callers must check payload["type"] themselves to enforce the expected token type.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Convert sub back to int for convenience
        if "sub" in payload and isinstance(payload["sub"], str):
            payload["sub"] = int(payload["sub"])
        return payload
    except ExpiredSignatureError:
        raise TokenExpiredError("Token has expired")
    except JWTError:
        raise TokenInvalidError("Token is invalid")
