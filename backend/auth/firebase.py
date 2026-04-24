import firebase_admin
from firebase_admin import credentials, auth as _auth
from auth.config import get_service_account_path

def _init() -> None:
    if not firebase_admin._apps:
        cred = credentials.Certificate(get_service_account_path())
        firebase_admin.initialize_app(cred)

def verify_id_token(token: str) -> dict:
    _init()
    return _auth.verify_id_token(token)
