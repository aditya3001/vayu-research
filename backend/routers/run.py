from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import json
from database import get_db
from models import History
from routers.prompts import load_prompts
from routers.settings import get_setting
import config

router = APIRouter()

class RunRequest(BaseModel):
    prompt_id: str
    inputs: dict
    provider: Optional[str] = None
    model: Optional[str] = None

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
    prompts = load_prompts()
    prompt = next((p for p in prompts if p["id"] == req.prompt_id), None)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    filled = prompt["prompt_text"]
    for key, val in req.inputs.items():
        filled = filled.replace(f"[{key}]", val)

    provider, model = config.resolve_model(req.provider, req.model)

    result = _call_llm(provider, model, filled, db)

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

    notion_saved = False
    auto_save = get_setting(db, "auto_save_notion") == "true"
    if auto_save:
        notion_token = config.NOTION_TOKEN
        notion_page_id = config.NOTION_PAGE_ID or get_setting(db, "notion_page_id")
        if notion_token and notion_page_id:
            from notifier import send_notion_page
            from datetime import datetime
            date_str = datetime.utcnow().strftime('%Y-%m-%d')
            title = f"{prompt['name']} — {date_str}"
            inputs_summary = ", ".join(f"{k}: {v}" for k, v in req.inputs.items() if v)
            notion_saved, _ = send_notion_page(
                notion_token, notion_page_id, title, result,
                metadata={"Date": date_str, "Model": f"{provider}/{model}", "Source": "manual", "Inputs": inputs_summary},
            )

    return {"result": result, "history_id": entry.id, "model": model, "provider": provider, "notion_saved": notion_saved}
