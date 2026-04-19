import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import requests

logger = logging.getLogger(__name__)

def send_email(gmail_address: str, gmail_app_password: str, subject: str, body: str):
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = gmail_address
        msg["To"] = gmail_address
        msg.attach(MIMEText(body, "plain"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(gmail_address, gmail_app_password)
            server.sendmail(gmail_address, gmail_address, msg.as_string())
        logger.info(f"Email sent: {subject}")
    except Exception as e:
        logger.error(f"Email failed: {e}")

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

def _notion_headers(token: str) -> dict:
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Notion-Version": "2022-06-28",
    }

def _normalize_page_id(page_id: str) -> str:
    """Notion page IDs work with or without hyphens, but normalize to no-hyphen form."""
    return page_id.strip().replace("-", "").strip("/").split("/")[-1].split("?")[0]

def test_notion_connection(token: str, page_id: str) -> dict:
    """Returns {"ok": True} or {"ok": False, "error": "human readable reason"}."""
    try:
        pid = _normalize_page_id(page_id)
        resp = requests.get(
            f"https://api.notion.com/v1/pages/{pid}",
            headers=_notion_headers(token),
            timeout=10
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

def _rich_text(text: str) -> list:
    """Parse inline markdown (bold, italic, inline code) into Notion rich_text array."""
    import re
    result = []
    # Pattern matches **bold**, *italic*, `code` in order
    pattern = re.compile(r'(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)')
    last = 0
    for m in pattern.finditer(text):
        if m.start() > last:
            result.append({"type": "text", "text": {"content": text[last:m.start()]}})
        raw = m.group(0)
        if raw.startswith("**"):
            result.append({"type": "text", "text": {"content": m.group(2)}, "annotations": {"bold": True}})
        elif raw.startswith("*"):
            result.append({"type": "text", "text": {"content": m.group(3)}, "annotations": {"italic": True}})
        else:
            result.append({"type": "text", "text": {"content": m.group(4)}, "annotations": {"code": True}})
        last = m.end()
    if last < len(text):
        result.append({"type": "text", "text": {"content": text[last:]}})
    return result or [{"type": "text", "text": {"content": text}}]

def _md_to_notion_blocks(content: str) -> list:
    """Convert markdown text to Notion block objects."""
    import re
    blocks = []
    lines = content.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i]

        # Fenced code block
        if line.strip().startswith("```"):
            lang = line.strip()[3:].strip() or "plain text"
            code_lines = []
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                code_lines.append(lines[i])
                i += 1
            blocks.append({
                "object": "block", "type": "code",
                "code": {"rich_text": [{"type": "text", "text": {"content": "\n".join(code_lines)[:2000]}}], "language": lang}
            })
            i += 1
            continue

        # Headings
        if line.startswith("### "):
            blocks.append({"object": "block", "type": "heading_3", "heading_3": {"rich_text": _rich_text(line[4:])}})
        elif line.startswith("## "):
            blocks.append({"object": "block", "type": "heading_2", "heading_2": {"rich_text": _rich_text(line[3:])}})
        elif line.startswith("# "):
            blocks.append({"object": "block", "type": "heading_1", "heading_1": {"rich_text": _rich_text(line[2:])}})

        # Blockquote
        elif line.startswith("> "):
            blocks.append({"object": "block", "type": "quote", "quote": {"rich_text": _rich_text(line[2:])}})

        # Horizontal rule
        elif re.match(r'^[-*_]{3,}$', line.strip()):
            blocks.append({"object": "block", "type": "divider", "divider": {}})

        # Bullet list
        elif re.match(r'^[-*+] ', line):
            blocks.append({"object": "block", "type": "bulleted_list_item", "bulleted_list_item": {"rich_text": _rich_text(line[2:])}})

        # Numbered list
        elif re.match(r'^\d+\. ', line):
            text = re.sub(r'^\d+\. ', '', line)
            blocks.append({"object": "block", "type": "numbered_list_item", "numbered_list_item": {"rich_text": _rich_text(text)}})

        # Empty line — skip
        elif not line.strip():
            pass

        # Paragraph
        else:
            blocks.append({"object": "block", "type": "paragraph", "paragraph": {"rich_text": _rich_text(line)}})

        i += 1
    return blocks

def send_notion(token: str, page_id: str, title: str, content: str) -> tuple[bool, str]:
    """Returns (success, error_message). error_message is empty on success."""
    try:
        pid = _normalize_page_id(page_id)
        headers = _notion_headers(token)

        children = [
            {"object": "block", "type": "heading_2", "heading_2": {"rich_text": [{"type": "text", "text": {"content": title[:2000]}}]}},
            {"object": "block", "type": "divider", "divider": {}},
            *_md_to_notion_blocks(content),
            {"object": "block", "type": "divider", "divider": {}},
        ]

        BATCH = 100
        url = f"https://api.notion.com/v1/blocks/{pid}/children"
        for i in range(0, len(children), BATCH):
            resp = requests.patch(url, headers=headers, json={"children": children[i:i+BATCH]}, timeout=15)
            if not resp.ok:
                err = resp.json().get("message", resp.text[:200])
                logger.error(f"Notion API error {resp.status_code}: {err}")
                return False, f"Notion error {resp.status_code}: {err}"
        logger.info(f"Notion saved: {title}")
        return True, ""
    except Exception as e:
        logger.error(f"Notion failed: {e}")
        return False, str(e)
