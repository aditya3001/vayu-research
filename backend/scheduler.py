from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import json, logging, time
from datetime import datetime
import config

logger = logging.getLogger("scheduler")
scheduler = BackgroundScheduler(timezone=config.SCHEDULER_TIMEZONE)

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
            logger.info(f"[SCHED:{schedule_id}] skipped — inactive or missing")
            return

        logger.info(f"[SCHED:{schedule_id}] starting '{schedule.prompt_name}' (prompt={schedule.prompt_id})")

        prompts = load_prompts()
        prompt = next((p for p in prompts if p["id"] == schedule.prompt_id), None)
        if not prompt:
            logger.error(f"[SCHED:{schedule_id}] prompt not found: {schedule.prompt_id}")
            return

        inputs = json.loads(schedule.inputs)
        filled = prompt["prompt_text"]
        for key, val in inputs.items():
            filled = filled.replace(f"[{key}]", val)

        category = prompt.get("category", "")
        provider, model = config.resolve_model_for_category(category, schedule.provider, schedule.model_name)
        logger.info(f"[SCHED:{schedule_id}] category={category} calling {provider}/{model} — prompt_len={len(filled)} chars")

        t0 = time.perf_counter()
        if provider == "openrouter":
            from openai import OpenAI
            if not config.OPENROUTER_API_KEY:
                logger.error(f"[SCHED:{schedule_id}] OPENROUTER_API_KEY not set")
                return
            headers = {"X-Title": config.OPENROUTER_APP_NAME}
            if config.OPENROUTER_SITE_URL:
                headers["HTTP-Referer"] = config.OPENROUTER_SITE_URL
            client = OpenAI(api_key=config.OPENROUTER_API_KEY, base_url="https://openrouter.ai/api/v1", default_headers=headers)
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": filled}],
                max_tokens=config.LLM_MAX_TOKENS,
            )
            result = response.choices[0].message.content
        elif provider == "openai":
            from openai import OpenAI
            api_key = config.OPENAI_API_KEY or get_setting(db, "openai_api_key", schedule.user_id)
            if not api_key:
                logger.error(f"[SCHED:{schedule_id}] OpenAI API key not set")
                return
            oai = OpenAI(api_key=api_key)
            response = oai.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": filled}],
                max_tokens=config.LLM_MAX_TOKENS,
            )
            result = response.choices[0].message.content
        else:  # anthropic
            import anthropic
            api_key = config.ANTHROPIC_API_KEY or get_setting(db, "anthropic_api_key", schedule.user_id)
            client = anthropic.Anthropic(api_key=api_key)
            message = client.messages.create(
                model=model,
                max_tokens=config.LLM_MAX_TOKENS,
                messages=[{"role": "user", "content": filled}]
            )
            result = message.content[0].text
        elapsed = time.perf_counter() - t0
        logger.info(f"[SCHED:{schedule_id}] response in {elapsed:.1f}s — {len(result)} chars")

        entry = History(
            prompt_id=schedule.prompt_id,
            prompt_name=schedule.prompt_name,
            inputs=schedule.inputs,
            result=result,
            source="scheduled",
            model_used=f"{provider}/{model}"
        )
        db.add(entry)
        schedule.last_run_at = datetime.utcnow()
        db.commit()
        logger.info(f"[SCHED:{schedule_id}] saved to history")

        cat_page_id = config.CATEGORY_CONFIG.get(category, {}).get("notion_page_id", "")
        notion_page_id = cat_page_id or config.NOTION_PAGE_ID or get_setting(db, "notion_page_id", schedule.user_id)
        if notion_page_id:
            from notifier import send_notion_page
            from datetime import datetime as _dt
            date_str = _dt.utcnow().strftime('%Y-%m-%d')
            title = f"{schedule.prompt_name} — {date_str}"
            inputs_summary = ", ".join(f"{k}: {v}" for k, v in inputs.items() if v)
            meta = {"Date": date_str, "Model": f"{provider}/{model}", "Category": category, "Source": "scheduled", "Inputs": inputs_summary}
            ok, err = send_notion_page(config.NOTION_TOKEN, notion_page_id, title, result, metadata=meta)
            if ok:
                logger.info(f"[SCHED:{schedule_id}] Notion page saved")
            else:
                logger.warning(f"[SCHED:{schedule_id}] Notion save failed: {err}")

        subject = f"[Vayu Research] {schedule.prompt_name} — {datetime.utcnow().strftime('%Y-%m-%d')}"

        if schedule.notify_email:
            email_enabled = get_setting(db, "email_enabled", schedule.user_id) != "false"
            if not email_enabled:
                logger.info(f"[SCHED:{schedule_id}] email notifications disabled globally — skipping")
            elif config.GMAIL_ADDRESS and config.GMAIL_APP_PASSWORD:
                send_email(config.GMAIL_ADDRESS, config.GMAIL_APP_PASSWORD, subject, result)
                logger.info(f"[SCHED:{schedule_id}] email sent to {config.EMAIL_TO}")
            else:
                logger.warning(f"[SCHED:{schedule_id}] email skipped — GMAIL_ADDRESS/GMAIL_APP_PASSWORD not set")

        if schedule.notify_telegram:
            telegram_enabled = get_setting(db, "telegram_enabled", schedule.user_id) != "false"
            if not telegram_enabled:
                logger.info(f"[SCHED:{schedule_id}] Telegram notifications disabled globally — skipping")
            elif config.TELEGRAM_BOT_TOKEN and config.TELEGRAM_CHAT_ID:
                send_telegram(config.TELEGRAM_BOT_TOKEN, config.TELEGRAM_CHAT_ID, f"*{schedule.prompt_name}*\n\n{result}")
                logger.info(f"[SCHED:{schedule_id}] Telegram message sent")
            else:
                logger.warning(f"[SCHED:{schedule_id}] Telegram skipped — BOT_TOKEN/CHAT_ID not set")

        logger.info(f"[SCHED:{schedule_id}] done — elapsed={elapsed:.1f}s")

    except Exception as e:
        logger.error(f"[SCHED:{schedule_id}] job failed: {e}", exc_info=True)
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
        trigger = _make_trigger(schedule)
        logger.info(f"[SCHED:{schedule.id}] registered '{schedule.prompt_name}' — {schedule.frequency} at {schedule.run_time}")

def unregister_schedule(schedule_id: int):
    job_id = f"schedule_{schedule_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
        logger.info(f"[SCHED:{schedule_id}] unregistered")

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
    logger.info(f"Scheduler started — timezone={config.SCHEDULER_TIMEZONE} jobs={len(scheduler.get_jobs())}")
