import asyncio
import os
import re
import traceback
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
import mailer
from logger import log_event
from notify import ALERTS, eastern_now, render
from supabase_client import get_supabase

router = APIRouter()

# Every admin endpoint requires a signed-in admin or dev_admin account (specs.md §1).
# The old shared ADMIN_PASSWORD login was removed Nov 2026.
require_admin = auth.require_roles(*auth.ADMIN_ROLES)


@router.get("/admin/contacts")
async def list_contacts(actor: dict = Depends(require_admin)):
    try:
        supabase = get_supabase()
        res = supabase.table("contacts").select("*").order("created_at", desc=True).execute()
        return {"contacts": res.data or []}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"contacts_fetch_failed: {type(exc).__name__}")


@router.get("/admin/intakes")
async def list_intakes(actor: dict = Depends(require_admin)):
    try:
        supabase = get_supabase()
        res = (
            supabase.table("project_responses")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return {"intakes": res.data or []}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"intakes_fetch_failed: {type(exc).__name__}")


# ---------------------------------------------------------------- notifications (specs.md §4)

EMAIL_RE = re.compile(r"^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$")


@router.get("/admin/notifications")
async def list_notifications(actor: dict = Depends(require_admin)):
    try:
        res = get_supabase().table("notification_settings").select("*").execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"notifications_fetch_failed: {type(exc).__name__}")
    rows = {r["alert_type"]: r for r in (res.data or [])}
    return {
        "email_configured": mailer.configured(),
        "sender": os.getenv("SMTP_FROM") or os.getenv("SMTP_USER") or None,
        "alerts": [
            {
                "alert_type": key,
                "label": meta["label"],
                "description": meta["description"],
                "enabled": bool(rows.get(key, {}).get("enabled", False)),
                "recipients": rows.get(key, {}).get("recipients") or [],
                "updated_at": rows.get(key, {}).get("updated_at"),
            }
            for key, meta in ALERTS.items()
        ],
    }


class NotificationUpdate(BaseModel):
    enabled: bool
    recipients: list[str]


@router.put("/admin/notifications/{alert_type}")
async def update_notification(
    alert_type: str,
    payload: NotificationUpdate,
    actor: dict = Depends(require_admin),
):
    if alert_type not in ALERTS:
        raise HTTPException(status_code=404, detail="unknown_alert")

    recipients: list[str] = []
    for raw in payload.recipients:
        email = raw.strip().lower()
        if not email:
            continue
        if not EMAIL_RE.match(email) or len(email) > 254:
            raise HTTPException(status_code=400, detail=f"Not a valid email address: {raw.strip()}")
        if email not in recipients:
            recipients.append(email)
    if len(recipients) > 25:
        raise HTTPException(status_code=400, detail="Up to 25 recipients per alert.")

    row = {
        "alert_type": alert_type,
        "enabled": payload.enabled,
        "recipients": recipients,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": auth.full_name(actor),
    }
    try:
        res = get_supabase().table("notification_settings").upsert(row).execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"notifications_save_failed: {type(exc).__name__}")

    log_event("notifications.updated", route=f"/api/admin/notifications/{alert_type}", actor_id=actor["id"],
              entity_type="notification_setting", entity_id=alert_type,
              metadata={"enabled": payload.enabled, "recipients": recipients})
    saved = (res.data or [row])[0]
    return {"alert_type": alert_type, "enabled": saved["enabled"], "recipients": saved["recipients"]}


@router.post("/admin/notifications/{alert_type}/test")
async def test_notification(alert_type: str, actor: dict = Depends(require_admin)):
    """Send a sample to this alert's recipients, even if the alert is switched off."""
    meta = ALERTS.get(alert_type)
    if not meta:
        raise HTTPException(status_code=404, detail="unknown_alert")
    if not mailer.configured():
        raise HTTPException(status_code=400, detail="Email isn't set up on the server (SMTP_USER and SMTP_PASS).")

    res = (
        get_supabase().table("notification_settings").select("recipients")
        .eq("alert_type", alert_type).limit(1).execute()
    )
    recipients = (res.data[0].get("recipients") if res.data else None) or []
    if not recipients:
        raise HTTPException(status_code=400, detail="Add at least one recipient first.")

    if alert_type == "weekly_digest":
        from digest import build_digest
        subject, text, html = await asyncio.to_thread(build_digest)
        subject = f"[Test] {subject}"
    else:
        subject = f"[Test] {meta['label']}"
        text, html = render(
            f"Test: {meta['label']}",
            [("Alert", meta["label"]), ("Sent to", ", ".join(recipients)), ("Sent", eastern_now())],
            [("When this alert is sent", meta["description"])],
            footer="This is a test from Admin → Notifications on the Cavalier website.",
        )
    try:
        await asyncio.to_thread(mailer.send, recipients, subject, text, html)
    except Exception as exc:
        traceback.print_exc()
        log_event("alert.failed", level="error", message=f"Test: {type(exc).__name__}: {exc}",
                  metadata={"alert_type": alert_type, "test": True})
        # 400, not 5xx: a bad email setting shouldn't also fire a server-error alert.
        raise HTTPException(status_code=400, detail=f"Email failed to send: {type(exc).__name__}: {exc}")
    log_event("alert.test_sent", actor_id=actor["id"], metadata={"alert_type": alert_type, "recipients": len(recipients)})
    return {"status": "sent", "recipients": recipients}


# ---------------------------------------------------------------- logs (specs.md §12)

LOG_PAGE_SIZE = 50
LOG_CATEGORIES = {
    "visits": ["page."],
    "leads": ["contact.", "intake."],
    "chat": ["chat."],
    "field": ["field_post.", "comment."],
    "accounts": ["auth.", "user."],
    "admin": ["notifications."],
    "email": ["alert."],
    "protection": ["rate_limit.", "spam."],
    "errors": ["server."],
}
# Shown to dev_admin only: stack traces, and who/where a failed sign-in came from.
DEV_ONLY_METADATA = {"traceback", "ip", "email"}


def _safe_search(q: str) -> str:
    return re.sub(r"[%,()*\\\\]", " ", q).strip()[:100]


@router.get("/admin/logs")
async def list_logs(
    category: str = "activity",
    level: str | None = None,
    actor_id: str | None = None,
    since: str | None = None,
    until: str | None = None,
    q: str | None = None,
    before: str | None = None,
    actor: dict = Depends(require_admin),
):
    """Newest first, LOG_PAGE_SIZE at a time. Pass the last row's created_at as `before`.
    category: "activity" (everything except page visits), "all", or a LOG_CATEGORIES key."""
    query = (
        get_supabase().table("logs")
        .select("id, created_at, level, event, route, message, metadata, actor_id, entity_type, entity_id")
        .order("created_at", desc=True)
        .limit(LOG_PAGE_SIZE + 1)
    )
    if category == "activity":
        query = query.neq("event", "page.visit")
    elif category in LOG_CATEGORIES:
        query = query.or_(",".join(f"event.like.{p}*" for p in LOG_CATEGORIES[category]))
    elif category != "all":
        raise HTTPException(status_code=400, detail="Unknown category.")
    if level in ("info", "warning", "error"):
        query = query.eq("level", level)
    if actor_id:
        query = query.eq("actor_id", actor_id)
    if since:
        query = query.gte("created_at", since)
    if until:
        query = query.lt("created_at", until)
    if q and _safe_search(q):
        query = query.ilike("message", f"%{_safe_search(q)}%")
    if before:
        query = query.lt("created_at", before)
    try:
        rows = query.execute().data or []
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Could not load logs: {type(exc).__name__}")

    page = rows[:LOG_PAGE_SIZE]
    ids = {r["actor_id"] for r in page if r.get("actor_id")}
    names = {}
    if ids:
        users = get_supabase().table(auth.TABLE).select("id, first_name, last_name").in_("id", list(ids)).execute()
        names = {u["id"]: auth.full_name(u) for u in (users.data or [])}
    is_dev = actor["role"] == "dev_admin"
    for r in page:
        r["actor_name"] = names.get(r.get("actor_id")) if r.get("actor_id") else None
        if not is_dev and isinstance(r.get("metadata"), dict):
            r["metadata"] = {k: v for k, v in r["metadata"].items() if k not in DEV_ONLY_METADATA}
    return {"logs": page, "has_more": len(rows) > LOG_PAGE_SIZE}


def _count(table: str, since: datetime, **eq) -> int:
    query = get_supabase().table(table).select("id", count="exact").gte("created_at", since.isoformat())
    for k, v in eq.items():
        query = query.eq(k, v)
    return query.limit(1).execute().count or 0


@router.get("/admin/logs/summary")
async def logs_summary(actor: dict = Depends(require_admin)):
    from zoneinfo import ZoneInfo
    now = datetime.now(timezone.utc)
    eastern = now.astimezone(ZoneInfo("America/New_York"))
    month_start = eastern.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    try:
        return {
            "visits_week": _count("logs", week_ago, event="page.visit"),
            "leads_month": _count("contacts", month_start),
            "intakes_month": _count("project_responses", month_start),
            "posts_month": _count("field_posts", month_start),
            "errors_day": _count("logs", now - timedelta(days=1), level="error"),
        }
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=f"Could not load summary: {type(exc).__name__}")
