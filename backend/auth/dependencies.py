import logging
from fastapi import Header, HTTPException
from firebase_admin import exceptions as fb_exceptions
from firebase_admin.auth import ExpiredIdTokenError, RevokedIdTokenError
from .firebase import verify_id_token

logger = logging.getLogger(__name__)

async def get_current_user(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(
            status_code=401,
            detail="Missing token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        decoded = verify_id_token(token)
        return decoded["uid"]
    except (ExpiredIdTokenError, RevokedIdTokenError):
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except fb_exceptions.FirebaseError as e:
        logger.error("Firebase infrastructure error during token verification: %s", e)
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    except Exception as e:
        logger.error("Unexpected error during token verification: %s", e)
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
