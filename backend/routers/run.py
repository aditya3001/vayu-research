from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy.orm import Session
from typing import Optional
import json, logging, time
from database import get_db
from models import History
from routers.prompts import load_prompts
from routers.settings import get_setting
import config

router = APIRouter()
logger = logging.getLogger("run")

VALID_PROVIDERS = {"anthropic", "openai", "openrouter"}
MAX_INPUT_CHARS = 10_000
MAX_RAW_CHARS   = 50_000


class RunRequest(BaseModel):
    prompt_id: str
    inputs: dict
    provider: Optional[str] = None
    model: Optional[str] = None

    @field_validator("prompt_id")
    @classmethod
    def prompt_id_nonempty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("prompt_id must not be empty")
        return v.strip()

    @field_validator("provider")
    @classmethod
    def provider_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(VALID_PROVIDERS)}")
        return v

    @field_validator("model")
    @classmethod
    def model_nonempty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("model must not be empty when provided")
        return v.strip() if v else v

    @field_validator("inputs")
    @classmethod
    def inputs_valid(cls, v: dict) -> dict:
        for key, val in v.items():
            if not isinstance(key, str):
                raise ValueError("input keys must be strings")
            if not isinstance(val, str):
                raise ValueError(f"input value for '{key}' must be a string")
            if len(val) > MAX_INPUT_CHARS:
                raise ValueError(f"input '{key}' exceeds {MAX_INPUT_CHARS} characters")
        return v


class RawRunRequest(BaseModel):
    text: str
    provider: Optional[str] = None
    model: Optional[str] = None

    @field_validator("text")
    @classmethod
    def text_valid(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be empty")
        if len(v) > MAX_RAW_CHARS:
            raise ValueError(f"text exceeds {MAX_RAW_CHARS} characters")
        return v

    @field_validator("provider")
    @classmethod
    def provider_valid(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_PROVIDERS:
            raise ValueError(f"provider must be one of {sorted(VALID_PROVIDERS)}")
        return v

    @field_validator("model")
    @classmethod
    def model_nonempty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("model must not be empty when provided")
        return v.strip() if v else v


def _call_llm(provider: str, model: str, content: str, db: Session) -> str:
    if provider == "openrouter":
        from openai import OpenAI
        api_key = config.OPENROUTER_API_KEY
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenRouter API key not set. Add OPENROUTER_API_KEY to .env.")
        headers = {"X-Title": config.OPENROUTER_APP_NAME}
        if config.OPENROUTER_SITE_URL:
            headers["HTTP-Referer"] = config.OPENROUTER_SITE_URL
        client = OpenAI(api_key=api_key, base_url="https://openrouter.ai/api/v1", default_headers=headers)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": content}],
            max_tokens=config.LLM_MAX_TOKENS,
        )
        return response.choices[0].message.content
    elif provider == "openai":
        from openai import OpenAI
        api_key = config.OPENAI_API_KEY or get_setting(db, "openai_api_key")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not set. Add OPENAI_API_KEY to .env.")
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": content}],
            max_tokens=config.LLM_MAX_TOKENS,
        )
        return response.choices[0].message.content
    else:  # anthropic
        import anthropic
        api_key = config.ANTHROPIC_API_KEY or get_setting(db, "anthropic_api_key")
        if not api_key:
            raise HTTPException(status_code=500, detail="Anthropic API key not set. Add ANTHROPIC_API_KEY to .env.")
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=model,
            max_tokens=config.LLM_MAX_TOKENS,
            messages=[{"role": "user", "content": content}]
        )
        return message.content[0].text


@router.post("/run")
def run_prompt(req: RunRequest, db: Session = Depends(get_db)):
    logger.info(f"[RUN] prompt={req.prompt_id} inputs={list(req.inputs.keys())}")

    prompts = load_prompts()
    prompt = next((p for p in prompts if p["id"] == req.prompt_id), None)
    if not prompt:
        logger.warning(f"[RUN] prompt not found: {req.prompt_id}")
        raise HTTPException(status_code=404, detail="Prompt not found")

    # Validate all required placeholders are provided
    missing = [p for p in (prompt.get("placeholders") or []) if not req.inputs.get(p, "").strip()]
    if missing:
        raise HTTPException(status_code=422, detail=f"Missing required inputs: {missing}")

    filled = prompt["prompt_text"]
    for key, val in req.inputs.items():
        filled = filled.replace(f"[{key}]", val)

    category = prompt.get("category", "")
    provider, model = config.resolve_model_for_category(category, req.provider, req.model)
    logger.info(f"[RUN] category={category} calling {provider}/{model} — prompt_len={len(filled)} chars")

    t0 = time.perf_counter()
    try:
        result = _call_llm(provider, model, filled, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[RUN] LLM call failed ({provider}/{model}): {e}")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")
    elapsed = time.perf_counter() - t0
    logger.info(f"[RUN] response received in {elapsed:.1f}s — {len(result)} chars")

    entry = History(
        prompt_id=req.prompt_id,
        prompt_name=prompt["name"],
        inputs=json.dumps(req.inputs),
        result=result,
        source="manual",
        model_used=f"{provider}/{model}"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    logger.info(f"[RUN] saved to history id={entry.id}")

    notion_saved = False
    auto_save = get_setting(db, "auto_save_notion") == "true"
    if auto_save:
        notion_token = config.NOTION_TOKEN
        if notion_token:
            from notifier import send_notion_page
            from datetime import datetime
            date_str = datetime.utcnow().strftime('%Y-%m-%d')
            title = f"{prompt['name']} — {date_str}"
            inputs_summary = ", ".join(f"{k}: {v}" for k, v in req.inputs.items() if v)
            meta = {"Date": date_str, "Model": f"{provider}/{model}", "Category": category, "Source": "manual", "Inputs": inputs_summary}

            cat_page_id = config.CATEGORY_CONFIG.get(category, {}).get("notion_page_id", "")
            notion_page_id = cat_page_id or config.NOTION_PAGE_ID or get_setting(db, "notion_page_id")
            if notion_page_id:
                logger.info(f"[RUN] saving to Notion page={notion_page_id[:8]}… (category={category or 'default'})")
                notion_saved, notion_err = send_notion_page(notion_token, notion_page_id, title, result, metadata=meta)
            else:
                logger.debug("[RUN] auto_save_notion enabled but no notion_page_id configured")
                notion_err = ""

            if notion_token and notion_page_id:
                if notion_saved:
                    logger.info("[RUN] Notion save OK")
                else:
                    logger.warning(f"[RUN] Notion save failed: {notion_err}")

    logger.info(f"[RUN] done — prompt={req.prompt_id} model={provider}/{model} elapsed={elapsed:.1f}s notion={notion_saved}")
    return {"result": result, "history_id": entry.id, "model": model, "provider": provider, "notion_saved": notion_saved}


@router.post("/run/raw")
def run_raw(req: RawRunRequest, db: Session = Depends(get_db)):
    provider, model = config.resolve_model(req.provider, req.model)
    logger.info(f"[RAW] calling {provider}/{model} — prompt_len={len(req.text)} chars")

    t0 = time.perf_counter()
    try:
        result = _call_llm(provider, model, req.text, db)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[RAW] LLM call failed ({provider}/{model}): {e}")
        raise HTTPException(status_code=502, detail=f"LLM error: {e}")
    elapsed = time.perf_counter() - t0
    logger.info(f"[RAW] response in {elapsed:.1f}s — {len(result)} chars")

    return {"result": result, "model": model, "provider": provider, "elapsed": round(elapsed, 2)}
