from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
import anthropic
import os
import json
from database import get_db
from models import History
from routers.prompts import load_prompts

router = APIRouter()

class RunRequest(BaseModel):
    prompt_id: str
    inputs: dict

@router.post("/run")
def run_prompt(req: RunRequest, db: Session = Depends(get_db)):
    prompts = load_prompts()
    prompt = next((p for p in prompts if p["id"] == req.prompt_id), None)
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")

    filled = prompt["prompt_text"]
    for key, val in req.inputs.items():
        filled = filled.replace(f"[{key}]", val)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        messages=[{"role": "user", "content": filled}]
    )
    result = message.content[0].text

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
