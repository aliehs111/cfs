"""My email alerts: each admin chooses which alerts go to their own email.

This edits the same `notification_settings.recipients` lists as Admin →
Notifications (which also manages shared inboxes and other people); this page
only ever adds or removes the signed-in admin's own address.
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
from logger import log_event
from notify import ALERTS
from supabase_client import get_supabase

router = APIRouter()
require_admin = auth.require_roles(*auth.ADMIN_ROLES)

# Shown first: what most admins want.
SUGGESTED = ["contact_submission", "field_post_created"]


def _settings() -> dict[str, dict]:
    rows = get_supabase().table("notification_settings").select("alert_type, enabled, recipients").execute().data or []
    return {r["alert_type"]: r for r in rows}


@router.get("/me/alerts")
async def my_alerts(user: dict = Depends(require_admin)):
    email = user["email"].lower()
    rows = _settings()
    order = SUGGESTED + [k for k in ALERTS if k not in SUGGESTED]
    return {
        "email": email,
        "alerts": [
            {
                "alert_type": key,
                "label": ALERTS[key]["label"],
                "description": ALERTS[key]["description"],
                "suggested": key in SUGGESTED,
                "enabled": bool(rows.get(key, {}).get("enabled", False)),
                "subscribed": email in [r.lower() for r in (rows.get(key, {}).get("recipients") or [])],
            }
            for key in order
        ],
    }


class Subscription(BaseModel):
    subscribed: bool


@router.put("/me/alerts/{alert_type}")
async def set_my_alert(alert_type: str, payload: Subscription, user: dict = Depends(require_admin)):
    if alert_type not in ALERTS:
        raise HTTPException(status_code=404, detail="unknown_alert")
    email = user["email"].lower()
    row = _settings().get(alert_type) or {"alert_type": alert_type, "enabled": True, "recipients": []}
    recipients = [r for r in (row.get("recipients") or []) if r.lower() != email]
    if payload.subscribed:
        recipients.append(email)
    get_supabase().table("notification_settings").upsert({
        "alert_type": alert_type,
        "enabled": row.get("enabled", True),
        "recipients": recipients,
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": auth.full_name(user),
    }).execute()
    log_event("notifications.updated", route=f"/api/me/alerts/{alert_type}", actor_id=user["id"],
              entity_type="notification_setting", entity_id=alert_type,
              message=f"{auth.full_name(user)} {'subscribed to' if payload.subscribed else 'unsubscribed from'} {ALERTS[alert_type]['label']}")
    return {"alert_type": alert_type, "subscribed": payload.subscribed}


def move_recipient(old: str, new: str) -> None:
    """When an account's email changes, keep its alert subscriptions."""
    old, new = old.lower(), new.lower()
    for key, row in _settings().items():
        recipients = row.get("recipients") or []
        if old in [r.lower() for r in recipients]:
            updated = []
            for r in recipients:
                value = new if r.lower() == old else r
                if value.lower() not in [u.lower() for u in updated]:
                    updated.append(value)
            get_supabase().table("notification_settings").update({"recipients": updated}).eq("alert_type", key).execute()
