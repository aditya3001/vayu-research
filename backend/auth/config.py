import os

def get_service_account_path() -> str:
    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    if not path:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_PATH is not set. "
            "Download the service account JSON from Firebase console and set the path."
        )
    if not os.path.isfile(path):
        raise RuntimeError(
            f"Firebase service account file not found at: {path}. "
            "Check that FIREBASE_SERVICE_ACCOUNT_PATH points to a valid JSON file."
        )
    return path
