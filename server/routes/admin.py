import asyncio
from datetime import datetime, timezone
import os
import re
import hmac
import hashlib
import time
import traceback
from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from pydantic import BaseModel
from supabase_client import get_supabase

import mailer
from limiter import client_ip
from logger import log_event
from notify import ALERTS, eastern_now, record_login_failure, render

router = APIRouter()

COOKIE_NAME = "cavalier_admin_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days


def _admin_password() -> str:
    pw = os.environ.get("ADMIN_PASSWORD")
    if not pw:
        raise HTTPException(status_code=500, detail="server misconfigured")
    return pw


def _signing_key() -> bytes:
    secret = os.environ.get("ADMIN_SESSION_SECRET") or _admin_password()
    return secret.encode()


def _make_token() -> str:
    timestamp = str(int(time.time()))
    sig = hmac.new(_signing_key(), timestamp.encode(), hashlib.sha256).hexdigest()
    return f"{timestamp}.{sig}"


def _verify_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    timestamp_str, sig = token.split(".", 1)
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False
    if time.time() - timestamp > SESSION_TTL_SECONDS:
        return False
    expected = hmac.new(_signing_key(), timestamp_str.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, sig)


def _is_production() -> bool:
    return os.environ.get("ENV", "").lower() == "production"


class LoginPayload(BaseModel):
    password: str


@router.post("/admin/login")
async def admin_login(request: Request, payload: LoginPayload, response: Response):
    if not hmac.compare_digest(payload.password.encode(), _admin_password().encode()):
        record_login_failure("admin", client_ip(request), "/api/admin/login")
        raise HTTPException(status_code=401, detail="unauthorized")
    log_event("auth.signed_in", route="/api/admin/login", metadata={"login": "admin"})
    response.set_cookie(
        key=COOKIE_NAME,
        value=_make_token(),
        httponly=True,
        secure=_is_production(),
        samesite="none" if _is_production() else "lax",
        max_age=SESSION_TTL_SECONDS,
        path="/",
    )
    return {"status": "ok"}


@router.post("/admin/logout")
async def admin_logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"status": "ok"}


@router.get("/admin/session")
async def admin_session(cavalier_admin_session: str | None = Cookie(default=None)):
    if not _verify_token(cavalier_admin_session):
        raise HTTPException(status_code=401, detail="unauthorized")
    return {"status": "ok"}


@router.get("/admin/contacts")
async def list_contacts(cavalier_admin_session: str | None = Cookie(default=None)):
    if not _verify_token(cavalier_admin_session):
        raise HTTPException(status_code=401, detail="unauthorized")
    try:
        supabase = get_supabase()
        res = supabase.table("contacts").select("*").order("created_at", desc=True).execute()
        return {"contacts": res.data or []}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"contacts_fetch_failed: {type(exc).__name__}")


@router.get("/admin/intakes")
async def list_intakes(cavalier_admin_session: str | None = Cookie(default=None)):
    if not _verify_token(cavalier_admin_session):
        raise HTTPException(status_code=401, detail="unauthorized")
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


def _require_admin(token: str | None) -> None:
    if not _verify_token(token):
        raise HTTPException(status_code=401, detail="unauthorized")


@router.get("/admin/notifications")
async def list_notifications(cavalier_admin_session: str | None = Cookie(default=None)):
    _require_admin(cavalier_admin_session)
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
    cavalier_admin_session: str | None = Cookie(default=None),
):
    _require_admin(cavalier_admin_session)
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
        "updated_by": "admin",
    }
    try:
        res = get_supabase().table("notification_settings").upsert(row).execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"notifications_save_failed: {type(exc).__name__}")

    log_event("notifications.updated", route=f"/api/admin/notifications/{alert_type}",
              entity_type="notification_setting", entity_id=alert_type,
              metadata={"enabled": payload.enabled, "recipients": recipients})
    saved = (res.data or [row])[0]
    return {"alert_type": alert_type, "enabled": saved["enabled"], "recipients": saved["recipients"]}


@router.post("/admin/notifications/{alert_type}/test")
async def test_notification(alert_type: str, cavalier_admin_session: str | None = Cookie(default=None)):
    """Send a sample to this alert's recipients, even if the alert is switched off."""
    _require_admin(cavalier_admin_session)
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
    log_event("alert.test_sent", metadata={"alert_type": alert_type, "recipients": len(recipients)})
    return {"status": "sent", "recipients": recipients}
