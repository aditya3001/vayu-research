# Vayu Research

A personal financial research tool that runs curated prompts against any LLM and delivers results via History, Notion, Email, or Telegram.

Built around the **Vayu Capital AI Prompt Library** — 20 hand-crafted prompts across 5 categories of financial research.

---

## Features

- **Prompt Runner** — Fill in placeholders, submit to your chosen model, view formatted markdown output
- **History** — Every run saved to SQLite; searchable, downloadable as `.md` with YAML frontmatter
- **Schedules** — Cron-based automation; auto-deliver results via Email or Telegram
- **Notion** — Save any result to a Notion page, manually or automatically after each run
- **Multi-provider** — Switch between Anthropic, OpenAI, and OpenRouter from a single env var
- **Settings** — Runtime toggles for notifications; integration status at a glance

## Prompt Categories

| Category | Prompts |
|---|---|
| Market Intelligence & Technical Analysis | Daily market note, post-market wrap, sector rotation, breakout scanner, stock technical deep-dive |
| Fundamental Research & Sector Analysis | Sector report, earnings analysis, competitive landscape, 3-statement forensics |
| Quick Research Tools | Stock one-pager, market pulse, peer comparison, financial health check, red flag detector, DRHP decoder |
| Advanced Research Frameworks | Mega stock research framework, financial statement master analysis |
| Visual Design & Presentations | PPT and infographic prompt starters |

---

## Tech Stack

| | |
|---|---|
| Backend | FastAPI + SQLAlchemy + APScheduler |
| Database | SQLite (zero-config) / Postgres (production) |
| Frontend | React 18 + Vite + React Router |
| LLM | Anthropic SDK / OpenAI SDK / OpenRouter |
| Delivery | Gmail SMTP · Telegram Bot API · Notion API |

---

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/aditya3001/vayu-research.git
cd vayu-research
cp .env.example .env
# Edit .env — at minimum set DEFAULT_PROVIDER and the matching API key
```

### 2. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev   # → http://localhost:5173
```

---

## Configuration

All configuration lives in `.env`. See [`.env.example`](.env.example) for every variable with documentation.

### Minimum setup (pick one provider)

```env
# OpenRouter — recommended, access to every model with one key
DEFAULT_PROVIDER=openrouter
DEFAULT_MODEL=anthropic/claude-opus-4-6
OPENROUTER_API_KEY=sk-or-...

# Or Anthropic directly
DEFAULT_PROVIDER=anthropic
DEFAULT_MODEL=claude-opus-4-6
ANTHROPIC_API_KEY=sk-ant-...

# Or OpenAI
DEFAULT_PROVIDER=openai
DEFAULT_MODEL=gpt-4o
OPENAI_API_KEY=sk-...
```

### OpenRouter free models

Append `:free` to any supported model:

```env
DEFAULT_MODEL=meta-llama/llama-4-maverick:free
DEFAULT_MODEL=deepseek/deepseek-r1:free
DEFAULT_MODEL=google/gemini-2.5-pro:free
```

Browse all models at [openrouter.ai/models](https://openrouter.ai/models).

### Optional integrations

```env
# Notion
NOTION_TOKEN=secret_...
NOTION_PAGE_ID=32-char-id-from-page-url

# Email (Gmail)
GMAIL_ADDRESS=you@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Telegram
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

---

## Deployment (Railway)

Build the frontend first — FastAPI serves it as static files:

```bash
cd frontend && npm run build
```

Then deploy the repo to Railway. Set all `.env` variables as Railway environment variables. The app starts with:

```
uvicorn main:app --host 0.0.0.0 --port $PORT
```

---

## Project Structure

```
vayu-research/
├── .env.example          # All config variables documented
├── backend/
│   ├── config.py         # Central env-var config with typed defaults
│   ├── main.py           # FastAPI app + static file serving
│   ├── models.py         # History, Schedule, Setting ORM models
│   ├── scheduler.py      # APScheduler — cron jobs, LLM calls, notifications
│   ├── notifier.py       # Email, Telegram, Notion delivery
│   ├── data/prompts.json # All prompts with metadata and placeholder definitions
│   └── routers/          # API routes: prompts, run, history, schedules, settings
└── frontend/
    └── src/
        ├── components/   # PromptRunner, HistoryPage, SchedulesPage, SettingsPage
        ├── api.js        # Axios API layer
        └── index.css     # Global styles + markdown prose theme
```
