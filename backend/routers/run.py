from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import os, json
from database import get_db
from models import History
from routers.prompts import load_prompts
from routers.settings import get_setting

router = APIRouter()

PROVIDER_DEFAULTS = {
    "anthropic": "claude-opus-4-6",
    "openai": "gpt-4o",
}

class RunRequest(BaseModel):
    prompt_id: str
    inputs: dict
    provider: str = "anthropic"
    model: Optional[str] = None  # None → use provider default

def _call_llm(provider: str, model: str, content: str, db: Session) -> str:
    if provider == "openai":
        from openai import OpenAI
        api_key = get_setting(db, "openai_api_key")
        if not api_key:
            raise HTTPException(status_code=500, detail="OpenAI API key not set. Add it in Settings.")
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": content}],
            max_tokens=4096
        )
        return response.choices[0].message.content
    else:  # anthropic
        import anthropic
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")
        client = anthropic.Anthropic(api_key=api_key)
        message = client.messages.create(
            model=model,
            max_tokens=4096,
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

    provider = req.provider or "anthropic"
    model = req.model or PROVIDER_DEFAULTS.get(provider, "claude-opus-4-6")

    result = _call_llm(provider, model, filled, db)

    entry = History(
        prompt_id=req.prompt_id,
        prompt_name=prompt["name"],
        inputs=json.dumps(req.inputs),
        result=result,
        source="manual"
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return {"result": result, "history_id": entry.id}
