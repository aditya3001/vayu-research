import threading
import firebase_admin
from firebase_admin import credentials, auth as _auth
from .config import get_service_account_path

_init_lock = threading.Lock()

def _init() -> None:
    try:
        firebase_admin.get_app()
    except ValueError:
        with _init_lock:
            try:
                firebase_admin.get_app()
            except ValueError:
                cred = credentials.Certificate(get_service_account_path())
                firebase_admin.initialize_app(cred)

def verify_id_token(token: str) -> dict:
    _init()
    return _auth.verify_id_token(token)
