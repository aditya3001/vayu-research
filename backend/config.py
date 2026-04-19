"""
Central configuration — reads all env vars with typed defaults.
All other modules import from here instead of calling os.environ directly.
"""
import os

# ── LLM ───────────────────────────────────────────────────────────────────────
DEFAULT_PROVIDER    = os.environ.get("DEFAULT_PROVIDER", "anthropic")
DEFAULT_MODEL       = os.environ.get("DEFAULT_MODEL", "")           # empty → per-provider default
LLM_MAX_TOKENS      = int(os.environ.get("LLM_MAX_TOKENS", "4096"))

PROVIDER_DEFAULTS = {
    "anthropic":  "claude-opus-4-6",
    "openai":     "gpt-4o",
    "openrouter": "anthropic/claude-opus-4-6",
}

def resolve_model(provider: str | None = None, model: str | None = None) -> tuple[str, str]:
    """Return (provider, model), applying env-var defaults when either is None/empty."""
    p = provider or DEFAULT_PROVIDER or "anthropic"
    m = model or DEFAULT_MODEL or PROVIDER_DEFAULTS.get(p, "claude-opus-4-6")
    return p, m

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
# If EMAIL_TO is set, results are delivered there; otherwise sent to GMAIL_ADDRESS
EMAIL_TO            = os.environ.get("EMAIL_TO", "") or GMAIL_ADDRESS

# ── Telegram ──────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN  = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID    = os.environ.get("TELEGRAM_CHAT_ID", "")

# ── Notion ────────────────────────────────────────────────────────────────────
NOTION_TOKEN        = os.environ.get("NOTION_TOKEN", "")
NOTION_PAGE_ID      = os.environ.get("NOTION_PAGE_ID", "")
NOTION_API_VERSION  = os.environ.get("NOTION_API_VERSION", "2022-06-28")
NOTION_TIMEOUT      = int(os.environ.get("NOTION_TIMEOUT", "15"))
