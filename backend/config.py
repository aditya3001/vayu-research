"""
Central configuration — reads all env vars with typed defaults.
All other modules import from here instead of calling os.environ directly.
"""
import os, json
from pathlib import Path

# ── LLM ───────────────────────────────────────────────────────────────────────
DEFAULT_PROVIDER    = os.environ.get("DEFAULT_PROVIDER", "anthropic")
DEFAULT_MODEL       = os.environ.get("DEFAULT_MODEL", "")           # empty → per-provider default
LLM_MAX_TOKENS      = int(os.environ.get("LLM_MAX_TOKENS", "4096"))

# LIVE_MODE=live  → paid model  (LIVE_MODEL)
# LIVE_MODE=demo  → free model  (DEMO_MODEL)
LIVE_MODE           = os.environ.get("LIVE_MODE", "demo").strip().lower()
_OPENROUTER_LIVE    = os.environ.get("DEFAULT_LIVE_MODEL", "openrouter/auto")
_OPENROUTER_DEMO    = os.environ.get("DEFAULT_DEMO_MODEL", "google/gemma-3-27b-it:free")

PROVIDER_DEFAULTS = {
    "anthropic":  "claude-opus-4-6",
    "openai":     "gpt-4o",
    "openrouter": _OPENROUTER_LIVE if LIVE_MODE == "live" else _OPENROUTER_DEMO,
}

# ── Category config ───────────────────────────────────────────────────────────
# Maps category → { provider, model, notion_db_id }
_CATEGORY_CONFIG_PATH = Path(__file__).parent / "data" / "category_config.json"

def _load_category_config() -> dict:
    try:
        return json.loads(_CATEGORY_CONFIG_PATH.read_text())
    except Exception:
        return {}

CATEGORY_CONFIG: dict = _load_category_config()

def resolve_model(provider: str | None = None, model: str | None = None) -> tuple[str, str]:
    """Return (provider, model) applying env-var defaults when either is None/empty."""
    p = provider or DEFAULT_PROVIDER or "anthropic"
    if p == "openrouter" and not model:
        m = _OPENROUTER_LIVE if LIVE_MODE == "live" else _OPENROUTER_DEMO
    else:
        m = model or DEFAULT_MODEL or PROVIDER_DEFAULTS.get(p, "claude-opus-4-6")
    return p, m

def resolve_model_for_category(
    category: str,
    req_provider: str | None = None,
    req_model: str | None = None,
) -> tuple[str, str]:
    """
    Model resolution priority:
      1. Per-request override (req_provider / req_model)
      2. Category config  (category_config.json)
      3. Global default   (LIVE_MODE / DEMO_MODEL / DEFAULT_MODEL)
    """
    if req_model:
        return resolve_model(req_provider, req_model)
    cat = CATEGORY_CONFIG.get(category, {})
    cat_model = cat.get("live_model") if LIVE_MODE == "live" else cat.get("demo_model")
    if cat_model:
        return resolve_model(cat.get("provider"), cat_model)
    return resolve_model(req_provider, req_model)

# ── API Keys ──────────────────────────────────────────────────────────────────
ANTHROPIC_API_KEY   = os.environ.get("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY      = os.environ.get("OPENAI_API_KEY", "")
OPENROUTER_API_KEY  = os.environ.get("OPENROUTER_API_KEY", "")

# ── OpenRouter extras (used for rate-limit tier + attribution) ────────────────
OPENROUTER_SITE_URL = os.environ.get("OPENROUTER_SITE_URL", "")
OPENROUTER_APP_NAME = os.environ.get("OPENROUTER_APP_NAME", "Vayu Research")

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL        = os.environ.get("DATABASE_URL", "sqlite:///./vayu.db")

# ── Scheduler ─────────────────────────────────────────────────────────────────
SCHEDULER_TIMEZONE  = os.environ.get("SCHEDULER_TIMEZONE", "Asia/Kolkata")

# ── Email (SMTP) ──────────────────────────────────────────────────────────────
GMAIL_ADDRESS       = os.environ.get("GMAIL_ADDRESS", "")
GMAIL_APP_PASSWORD  = os.environ.get("GMAIL_APP_PASSWORD", "")
SMTP_HOST           = os.environ.get("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT           = int(os.environ.get("SMTP_PORT", "465"))
EMAIL_TO            = os.environ.get("EMAIL_TO", "") or GMAIL_ADDRESS

# ── Telegram ──────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN  = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID    = os.environ.get("TELEGRAM_CHAT_ID", "")

# ── Notion ────────────────────────────────────────────────────────────────────
NOTION_TOKEN        = os.environ.get("NOTION_TOKEN", "")
NOTION_PAGE_ID      = os.environ.get("NOTION_PAGE_ID", "")
NOTION_API_VERSION  = os.environ.get("NOTION_API_VERSION", "2022-06-28")
NOTION_TIMEOUT      = int(os.environ.get("NOTION_TIMEOUT", "15"))
