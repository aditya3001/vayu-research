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

def send_notion(token: str, page_id: str, title: str, content: str) -> bool:
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Notion-Version": "2022-06-28",
        }
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
        # Notion limits 100 children per request — batch if needed
        BATCH = 100
        url = f"https://api.notion.com/v1/blocks/{page_id}/children"
        for i in range(0, len(children), BATCH):
            resp = requests.patch(url, headers=headers, json={"children": children[i:i+BATCH]}, timeout=15)
            resp.raise_for_status()
        logger.info(f"Notion saved: {title}")
        return True
    except Exception as e:
        logger.error(f"Notion failed: {e}")
        return False
