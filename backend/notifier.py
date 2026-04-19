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

def send_notion(token: str, page_id: str, title: str, content: str) -> tuple[bool, str]:
    """Returns (success, error_message). error_message is empty on success."""
    try:
        pid = _normalize_page_id(page_id)
        headers = _notion_headers(token)
        MAX_BLOCK = 1900
        children = [{
            "object": "block",
            "type": "heading_2",
            "heading_2": {"rich_text": [{"type": "text", "text": {"content": title[:2000]}}]}
        }]
        for line in content.split("\n"):
            if not line.strip():
                continue
            for i in range(0, max(1, len(line)), MAX_BLOCK):
                chunk = line[i:i+MAX_BLOCK]
                children.append({
                    "object": "block",
                    "type": "paragraph",
                    "paragraph": {"rich_text": [{"type": "text", "text": {"content": chunk}}]}
                })
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
