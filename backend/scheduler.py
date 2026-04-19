from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import os, json, logging
from datetime import datetime

logger = logging.getLogger(__name__)
scheduler = BackgroundScheduler()

def _run_scheduled_job(schedule_id: int):
    from database import SessionLocal
    from models import Schedule, History
    from routers.prompts import load_prompts
    from routers.settings import get_setting
    from notifier import send_email, send_telegram

    db = SessionLocal()
    try:
        schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
        if not schedule or not schedule.is_active:
            return

        prompts = load_prompts()
        prompt = next((p for p in prompts if p["id"] == schedule.prompt_id), None)
        if not prompt:
            logger.error(f"Prompt {schedule.prompt_id} not found for schedule {schedule_id}")
            return

        inputs = json.loads(schedule.inputs)
        filled = prompt["prompt_text"]
        for key, val in inputs.items():
            filled = filled.replace(f"[{key}]", val)

        DEFAULTS = {"anthropic": "claude-opus-4-6", "openai": "gpt-4o"}
        provider = schedule.provider or get_setting(db, "default_provider") or "anthropic"
        model = schedule.model_name or get_setting(db, "default_model") or DEFAULTS.get(provider, "claude-opus-4-6")

        if provider == "openai":
            from openai import OpenAI
            api_key = os.environ.get("OPENAI_API_KEY") or get_setting(db, "openai_api_key")
            if not api_key:
                logger.error(f"OpenAI API key not set for schedule {schedule_id}")
                return
            oai = OpenAI(api_key=api_key)
            response = oai.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": filled}],
                max_tokens=4096
            )
            result = response.choices[0].message.content
        else:
            import anthropic
            api_key = os.environ.get("ANTHROPIC_API_KEY") or get_setting(db, "anthropic_api_key")
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model=model,
                max_tokens=4096,
                messages=[{"role": "user", "content": filled}]
            )
            result = message.content[0].text

        entry = History(
            prompt_id=schedule.prompt_id,
            prompt_name=schedule.prompt_name,
            inputs=schedule.inputs,
            result=result,
            source="scheduled"
        )
        db.add(entry)
        schedule.last_run_at = datetime.utcnow()
        db.commit()

        subject = f"[Vayu Research] {schedule.prompt_name} — {datetime.utcnow().strftime('%Y-%m-%d')}"

        if schedule.notify_email:
            gmail = os.environ.get("GMAIL_ADDRESS")
            pwd = os.environ.get("GMAIL_APP_PASSWORD")
            if gmail and pwd:
                send_email(gmail, pwd, subject, result)
            else:
                logger.warning(f"Email notification skipped: GMAIL_ADDRESS/GMAIL_APP_PASSWORD not set in env")

        if schedule.notify_telegram:
            token = os.environ.get("TELEGRAM_BOT_TOKEN")
            chat = os.environ.get("TELEGRAM_CHAT_ID")
            if token and chat:
                send_telegram(token, chat, f"*{schedule.prompt_name}*\n\n{result}")
            else:
                logger.warning(f"Telegram notification skipped: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set in env")

    except Exception as e:
        logger.error(f"Scheduled job {schedule_id} failed: {e}")
    finally:
        db.close()

def _make_trigger(schedule) -> CronTrigger:
    hour, minute = schedule.run_time.split(":")
    if schedule.frequency == "daily":
        return CronTrigger(hour=int(hour), minute=int(minute))
    elif schedule.frequency == "weekdays":
        return CronTrigger(day_of_week="mon-fri", hour=int(hour), minute=int(minute))
    elif schedule.frequency == "weekly":
        dow = schedule.day_of_week or "monday"
        return CronTrigger(day_of_week=dow[:3], hour=int(hour), minute=int(minute))
    return CronTrigger(hour=int(hour), minute=int(minute))

def register_schedule(schedule):
    job_id = f"schedule_{schedule.id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    if schedule.is_active:
        scheduler.add_job(
            _run_scheduled_job,
            trigger=_make_trigger(schedule),
            args=[schedule.id],
            id=job_id,
            replace_existing=True
        )

def unregister_schedule(schedule_id: int):
    job_id = f"schedule_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)

def start_scheduler():
    from database import SessionLocal
    from models import Schedule
    db = SessionLocal()
    try:
        active = db.query(Schedule).filter(Schedule.is_active == True).all()
        for s in active:
            register_schedule(s)
    finally:
        db.close()
    scheduler.start()
    logger.info(f"Scheduler started with {len(scheduler.get_jobs())} jobs")
