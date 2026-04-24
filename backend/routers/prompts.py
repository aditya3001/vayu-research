from fastapi import APIRouter, Depends
from pathlib import Path
import json, re
from auth import get_current_user

router = APIRouter()

PROMPTS_FILE = Path(__file__).parent.parent / "data" / "prompts.json"

def load_prompts():
    with open(PROMPTS_FILE) as f:
        prompts = json.load(f)
    # Auto-extract placeholders if not already set
    for p in prompts:
        if not p.get("placeholders"):
            found = re.findall(r'\[([^\]]+)\]', p["prompt_text"])
            p["placeholders"] = list(dict.fromkeys(found))  # dedupe, preserve order
    return prompts

@router.get("/prompts")
def list_prompts(_: str = Depends(get_current_user)):
    prompts = load_prompts()
    grouped = {}
    for p in prompts:
        cat = p["category"]
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append(p)
    return grouped

@router.get("/prompts/{prompt_id}")
def get_prompt(prompt_id: str, _: str = Depends(get_current_user)):
    prompts = load_prompts()
    for p in prompts:
        if p["id"] == prompt_id:
            return p
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Prompt not found")
