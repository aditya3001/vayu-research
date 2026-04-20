import re
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests
import config

logger = logging.getLogger(__name__)


# ── Email ─────────────────────────────────────────────────────────────────────

def send_email(gmail_address: str, gmail_app_password: str, subject: str, body: str):
    try:
        recipient = config.EMAIL_TO or gmail_address
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = gmail_address
        msg["To"] = recipient
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP_SSL(config.SMTP_HOST, config.SMTP_PORT) as server:
            server.login(gmail_address, gmail_app_password)
            server.sendmail(gmail_address, recipient, msg.as_string())
        logger.info(f"Email sent: {subject}")
    except Exception as e:
        logger.error(f"Email failed: {e}")


# ── Telegram ──────────────────────────────────────────────────────────────────

def send_telegram(bot_token: str, chat_id: str, text: str):
    try:
        MAX = 4096
        chunks = [text[i:i+MAX] for i in range(0, len(text), MAX)]
        for chunk in chunks:
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            requests.post(url, json={"chat_id": chat_id, "text": chunk, "parse_mode": "Markdown"}, timeout=10)
        logger.info(f"Telegram sent ({len(chunks)} chunks)")
    except Exception as e:
        logger.error(f"Telegram failed: {e}")


# ── Notion ────────────────────────────────────────────────────────────────────

def _notion_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": config.NOTION_API_VERSION,
    }

def _normalize_page_id(page_id: str) -> str:
    return page_id.strip().replace("-", "").strip("/").split("/")[-1].split("?")[0]

def _rich_text(text: str) -> list:
    """Parse inline markdown (*italic*, **bold**, `code`) into Notion rich_text objects."""
    parts = []
    pattern = r'(\*\*[^*]+?\*\*|\*[^*]+?\*|`[^`]+?`)'
    for seg in re.split(pattern, text):
        if not seg:
            continue
        if seg.startswith('**') and seg.endswith('**'):
            parts.append({"type": "text", "text": {"content": seg[2:-2]}, "annotations": {"bold": True}})
        elif seg.startswith('*') and seg.endswith('*'):
            parts.append({"type": "text", "text": {"content": seg[1:-1]}, "annotations": {"italic": True}})
        elif seg.startswith('`') and seg.endswith('`'):
            parts.append({"type": "text", "text": {"content": seg[1:-1]}, "annotations": {"code": True}})
        else:
            # Chunk plain text to Notion's 2000-char limit per text object
            for i in range(0, max(len(seg), 1), 2000):
                parts.append({"type": "text", "text": {"content": seg[i:i+2000]}})
    return parts or [{"type": "text", "text": {"content": ""}}]

def _md_to_notion_blocks(md: str) -> list:
    """Convert markdown text to a list of Notion block objects."""
    blocks = []
    for line in md.split('\n'):
        s = line.strip()
        if not s:
            continue
        if s.startswith('### '):
            blocks.append({"object": "block", "type": "heading_3", "heading_3": {"rich_text": _rich_text(s[4:])}})
        elif s.startswith('## '):
            blocks.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text(s[3:])}})
        elif s.startswith('# '):
            blocks.append({"object": "block", "type": "heading_1", "heading_1": {"rich_text": _rich_text(s[2:])}})
        elif s.startswith(('- ', '* ')):
            blocks.append({"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(s[2:])}})
        elif re.match(r'^\d+\.\s', s):
            blocks.append({"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": _rich_text(re.sub(r'^\d+\.\s', '', s))}})
        elif s in ('---', '***', '___'):
            blocks.append({"object": "block", "type": "divider", "divider": {}})
        else:
            blocks.append({"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rich_text(s)}})
    return blocks

def test_notion_connection(token: str, page_id: str) -> dict:
    """Returns {"ok": True, "page_title": ...} or {"ok": False, "error": ...}."""
    try:
        pid = _normalize_page_id(page_id)
        resp = requests.get(
            f"https://api.notion.com/v1/pages/{pid}",
            headers=_notion_headers(token),
            timeout=config.NOTION_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            title_parts = data.get("properties", {}).get("title", {}).get("title", [])
            page_title = title_parts[0]["plain_text"] if title_parts else "(untitled)"
            return {"ok": True, "page_title": page_title}
        elif resp.status_code == 401:
            return {"ok": False, "error": "Invalid token. Check NOTION_TOKEN in your .env."}
        elif resp.status_code == 403:
            return {"ok": False, "error": "Integration does not have access to this page. Open the page in Notion → ··· menu → Connections → add your integration."}
        elif resp.status_code == 404:
            return {"ok": False, "error": "Page not found. Check NOTION_PAGE_ID — copy the 32-char ID from the page URL, not the full URL."}
        else:
            return {"ok": False, "error": f"Notion returned {resp.status_code}: {resp.text[:200]}"}
    except Exception as e:
        return {"ok": False, "error": f"Could not reach Notion API: {e}"}

def send_notion_page(
    token: str,
    parent_page_id: str,
    title: str,
    content: str,
    metadata: dict | None = None,
) -> tuple[bool, str]:
    """
    Create a new child page under parent_page_id.
    Content is rendered as proper Notion blocks (headings, bullets, etc).
    metadata dict keys become a callout at the top of the page.
    Returns (success, error_message).
    """
    try:
        pid = _normalize_page_id(parent_page_id)
        headers = _notion_headers(token)

        children = []

        # Metadata callout (date, model, source, inputs)
        if metadata:
            meta_text = "\n".join(f"{k}: {v}" for k, v in metadata.items() if v)
            if meta_text:
                children.append({
                    "object": "block",
                    "type": "callout",
                    "callout": {
                        "rich_text": [{"type": "text", "text": {"content": meta_text}}],
                        "icon": {"type": "emoji", "emoji": "📋"},
                        "color": "gray_background",
                    },
                })
                children.append({"object": "block", "type": "divider", "divider": {}})

        children.extend(_md_to_notion_blocks(content))

        # Create the page with the first batch of children (Notion limit: 100 per request)
        BATCH = 100
        page_body = {
            "parent": {"page_id": pid},
            "properties": {
                "title": {"title": [{"type": "text", "text": {"content": title[:2000]}}]}
            },
            "children": children[:BATCH],
        }
        resp = requests.post(
            "https://api.notion.com/v1/pages",
            headers=headers,
            json=page_body,
            timeout=config.NOTION_TIMEOUT,
        )
        if not resp.ok:
            err = resp.json().get("message", resp.text[:200])
            logger.error(f"Notion create page error {resp.status_code}: {err}")
            return False, f"Notion error {resp.status_code}: {err}"

        # Append remaining blocks to the newly created page
        new_page_id = resp.json()["id"]
        for i in range(BATCH, len(children), BATCH):
            r2 = requests.patch(
                f"https://api.notion.com/v1/blocks/{new_page_id}/children",
                headers=headers,
                json={"children": children[i:i+BATCH]},
                timeout=config.NOTION_TIMEOUT,
            )
            if not r2.ok:
                err = r2.json().get("message", r2.text[:200])
                return False, f"Notion error appending blocks: {err}"

        logger.info(f"Notion page created: {title}")
        return True, ""
    except Exception as e:
        logger.error(f"Notion failed: {e}")
        return False, str(e)
