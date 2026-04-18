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
