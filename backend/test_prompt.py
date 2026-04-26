"""
End-to-end prompt test — runs a real prompt through the full stack.
Usage:
    python test_prompt.py                                    # default prompt, model from .env
    python test_prompt.py mega-stock-research-framework      # different prompt
    python test_prompt.py --model openrouter/auto            # override model (paid)

    python test_prompt.py custom                             # custom prompt (edit CUSTOM_TEXT below)
    python test_prompt.py custom --text "What is 2+2?"      # inline custom text
    python test_prompt.py custom --file my_prompt.txt       # custom text from file
    python test_prompt.py custom --model openrouter/auto    # custom + paid model
"""
import sys, unittest
from dotenv import load_dotenv
load_dotenv(override=True)

from fastapi.testclient import TestClient
from main import app

_base_client = TestClient(app, raise_server_exceptions=True)

# Sign up a test user and get an access token for authenticated requests
_TEST_EMAIL = "test_prompt_user@example.com"
_TEST_PASSWORD = "testpassword123"

def _get_auth_client():
    """Return a TestClient with Authorization header pre-set."""
    # Try signup first; if already exists, login instead
    r = _base_client.post("/api/auth/signup", json={"email": _TEST_EMAIL, "password": _TEST_PASSWORD})
    if r.status_code not in (200, 400):
        raise RuntimeError(f"Auth setup failed: {r.status_code} {r.text}")
    if r.status_code == 400:
        r = _base_client.post("/api/auth/login", json={"email": _TEST_EMAIL, "password": _TEST_PASSWORD})
        if r.status_code != 200:
            raise RuntimeError(f"Auth login failed: {r.status_code} {r.text}")
    token = r.json()["access_token"]
    return TestClient(app, raise_server_exceptions=True, headers={"Authorization": f"Bearer {token}"})

client = _get_auth_client()

# ── Parse custom flags before unittest consumes argv ──────────────────────────
_override_model = None
_custom_text = None
_run_custom = False

i = 1
while i < len(sys.argv):
    arg = sys.argv[i]
    if arg == "--model" and i + 1 < len(sys.argv):
        _override_model = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    elif arg == "--text" and i + 1 < len(sys.argv):
        _custom_text = sys.argv[i + 1]
        del sys.argv[i:i + 2]
    elif arg == "--file" and i + 1 < len(sys.argv):
        with open(sys.argv[i + 1]) as f:
            _custom_text = f.read()
        del sys.argv[i:i + 2]
    elif arg == "custom":
        _run_custom = True
        del sys.argv[i]
    else:
        i += 1


# ── PromptRunnerTest ──────────────────────────────────────────────────────────

class PromptRunnerTest(unittest.TestCase):
    """
    Runs a library prompt end-to-end: API → LLM → history save.
    MODEL=None means use whatever .env / LIVE_MODE resolves.
    """

    PROMPT_ID = "post-market-nifty-report"
    INPUTS = {"INSERT DATE": "19 Apr 2026"}
    MODEL = _override_model

    def _print_section(self, title: str, body: str, width: int = 72):
        print(f"\n{'─' * width}")
        print(f"  {title}")
        print(f"{'─' * width}")
        print(body[:600] + (" …" if len(body) > 600 else ""))

    def test_01_config(self):
        """Active model and provider are returned."""
        r = client.get("/api/config")
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertIn("provider", data)
        self.assertIn("model", data)
        print(f"\n  provider={data['provider']}  model={data['model']}  live_mode={data.get('live_mode')}")

    def test_02_prompt_exists(self):
        """Prompt can be fetched by ID."""
        r = client.get(f"/api/prompts/{self.PROMPT_ID}")
        self.assertEqual(r.status_code, 200, f"Prompt '{self.PROMPT_ID}' not found")
        data = r.json()
        self.assertEqual(data["id"], self.PROMPT_ID)
        print(f"\n  name={data['name']}")
        print(f"  placeholders={data.get('placeholders')}")

    def test_03_run_prompt(self):
        """Prompt runs end-to-end and returns a non-empty result."""
        body = {"prompt_id": self.PROMPT_ID, "inputs": self.INPUTS}
        if self.MODEL:
            body["provider"] = "openrouter"
            body["model"] = self.MODEL
            print(f"\n  model override: {self.MODEL}")
        r = client.post("/api/run", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()

        self.assertIn("result", data)
        self.assertGreater(len(data["result"]), 100, "Result looks too short")
        self.assertIn("history_id", data)

        self._print_section(
            f"Result  (model={data['provider']}/{data['model']}  history_id={data['history_id']})",
            data["result"],
        )
        self.__class__._last_history_id = data["history_id"]

    def test_04_history_saved(self):
        """Result was persisted in history."""
        history_id = getattr(self.__class__, "_last_history_id", None)
        if not history_id:
            self.skipTest("test_03 did not run")
        r = client.get("/api/history")
        self.assertEqual(r.status_code, 200)
        ids = [h["id"] for h in r.json()]
        self.assertIn(history_id, ids, "Run was not saved to history")
        print(f"\n  history_id={history_id} found in history ✓")


# ── CustomPromptTest ──────────────────────────────────────────────────────────

# Default text used when no --text / --file is given
_DEFAULT_CUSTOM_TEXT = """\
Explain DNS working
"""

class CustomPromptTest(unittest.TestCase):
    """
    Sends raw prompt text straight to /api/run/raw — no prompts.json needed.
    Edit CUSTOM_TEXT below, or pass --text / --file on the command line.
    """

    CUSTOM_TEXT = 'What is 2+2?'
    MODEL = _override_model

    def _print_section(self, title: str, body: str, width: int = 72):
        print(f"\n{'─' * width}")
        print(f"  {title}")
        print(f"{'─' * width}")
        print(body[:600] + (" …" if len(body) > 600 else ""))

    def test_01_custom_run(self):
        """Raw prompt text is sent to the LLM and returns a result."""
        body = {"text": self.CUSTOM_TEXT}
        if self.MODEL:
            body["provider"] = "openrouter"
            body["model"] = self.MODEL
        print(f"\n  prompt ({len(self.CUSTOM_TEXT)} chars): {self.CUSTOM_TEXT[:120].strip()} …")

        r = client.post("/api/run/raw", json=body)
        self.assertEqual(r.status_code, 200, r.text)
        data = r.json()

        self.assertIn("result", data)
        self.assertGreater(len(data["result"]), 20, "Result looks too short")

        self._print_section(
            f"Result  (model={data['provider']}/{data['model']}  elapsed={data['elapsed']}s)",
            data["result"],
        )

    def test_02_empty_text_rejected(self):
        """Empty text returns 422 (Pydantic validation) or 400."""
        r = client.post("/api/run/raw", json={"text": "   "})
        self.assertIn(r.status_code, (400, 422), f"Expected 400 or 422, got {r.status_code}")
        print(f"\n  empty text correctly rejected with {r.status_code}: {r.json()['detail']}")


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Pick which suite to run
    if _run_custom:
        suite = unittest.TestLoader().loadTestsFromTestCase(CustomPromptTest)
    else:
        # Allow overriding prompt_id positionally: python test_prompt.py <prompt_id>
        if len(sys.argv) > 1 and not sys.argv[1].startswith("-"):
            PromptRunnerTest.PROMPT_ID = sys.argv.pop(1)
            PromptRunnerTest.INPUTS = {}
        suite = unittest.TestLoader().loadTestsFromTestCase(PromptRunnerTest)

    runner = unittest.TextTestRunner(verbosity=2)
    runner.run(suite)
