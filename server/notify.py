"""Email alerts (specs.md §4).

Who receives each alert, and whether it is on, lives in the
`notification_settings` table and is edited on Admin → Notifications.
Sending happens on a background thread so a visitor never waits on email, and
a failed email never fails the request that triggered it.
"""

import html as html_lib
import os
import threading
import time
import traceback
from collections import defaultdict, deque
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from zoneinfo import ZoneInfo

import mailer
from logger import log_event
from supabase_client import get_supabase

EASTERN = ZoneInfo("America/New_York")

# Order here is the order on the Notifications tab.
ALERTS = {
    "contact_submission": {
        "label": "New contact form",
        "description": "Someone sends the contact form (including the Let's Talk and Discuss a similar project pop-ups).",
    },
    "intake_completed": {
        "label": "New project intake",
        "description": "A Tell us about your project (/discuss) conversation finishes.",
    },
    "field_post_created": {
        "label": "New In the Field post",
        "description": "A crew member posts photos or videos.",
    },
    "field_post_deleted": {
        "label": "In the Field post deleted",
        "description": "A post is removed.",
    },
    "failed_logins": {
        "label": "Repeated failed sign-ins",
        "description": "5 wrong passwords from one device or network within 15 minutes. At most one email per hour per source.",
    },
    "server_error": {
        "label": "Server error",
        "description": "Something on the server crashes or the AI service fails. At most one email per hour per error.",
    },
    "user_changes": {
        "label": "User account changes",
        "description": "A user is created, changes role, is deactivated or has a password reset. Starts working when user accounts are added.",
    },
    "weekly_digest": {
        "label": "Weekly digest",
        "description": "Monday morning summary of visits, leads, posts and site health for the past week.",
    },
}

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="notify")
_lock = threading.Lock()


# ---------------------------------------------------------------- formatting

def site_url(path: str = "") -> str | None:
    base = (os.environ.get("FRONTEND_URL") or "").rstrip("/")
    return f"{base}{path}" if base else None


def eastern_now() -> str:
    return datetime.now(EASTERN).strftime("%a %b %-d, %Y at %-I:%M %p ET")


def render(
    heading: str,
    fields: list[tuple[str, str | None]] = (),
    sections: list[tuple[str, str | None]] = (),
    link: tuple[str, str | None] | None = None,
    image_url: str | None = None,
    footer: str | None = None,
) -> tuple[str, str]:
    """Build (text, html) for a plain alert email. All values are escaped."""
    esc = html_lib.escape
    text = [heading, ""]
    parts = [f'<h2 style="font-size:18px;margin:0 0 16px">{esc(heading)}</h2>']

    rows = [(k, v) for k, v in fields if v not in (None, "")]
    if rows:
        parts.append('<table style="border-collapse:collapse;margin-bottom:16px">')
        for k, v in rows:
            text.append(f"{k}: {v}")
            parts.append(
                f'<tr><td style="padding:4px 16px 4px 0;color:#666;vertical-align:top;white-space:nowrap">{esc(k)}</td>'
                f'<td style="padding:4px 0;white-space:pre-wrap">{esc(str(v))}</td></tr>'
            )
        parts.append("</table>")
        text.append("")

    for title, body in sections:
        if not body:
            continue
        text += [title.upper(), body, ""]
        parts.append(
            f'<p style="margin:16px 0 4px;color:#666;font-size:12px;text-transform:uppercase;letter-spacing:.08em">{esc(title)}</p>'
            f'<div style="white-space:pre-wrap;line-height:1.5">{esc(body)}</div>'
        )

    if image_url:
        parts.append(f'<p><img src="{esc(image_url)}" alt="" style="max-width:320px;border-radius:4px"></p>')

    if link and link[1]:
        text.append(f"{link[0]}: {link[1]}")
        parts.append(f'<p style="margin-top:20px"><a href="{esc(link[1])}">{esc(link[0])}</a></p>')

    if footer:
        text += ["", footer]
        parts.append(f'<p style="margin-top:24px;color:#999;font-size:12px">{esc(footer)}</p>')

    html = (
        '<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;'
        'font-size:14px;color:#222;max-width:640px">' + "".join(parts) + "</body></html>"
    )
    return "\n".join(text).strip() + "\n", html


# ---------------------------------------------------------------- settings

def get_setting(alert_type: str) -> dict:
    res = (
        get_supabase()
        .table("notification_settings")
        .select("alert_type, enabled, recipients")
        .eq("alert_type", alert_type)
        .limit(1)
        .execute()
    )
    if res.data:
        return res.data[0]
    return {"alert_type": alert_type, "enabled": False, "recipients": []}


# ---------------------------------------------------------------- sending

_throttle: dict[str, dict] = {}


def _check_throttle(key: str, seconds: int) -> tuple[bool, int]:
    """(send now?, how many were held back since the last send)."""
    now = time.time()
    with _lock:
        entry = _throttle.get(key)
        if entry and now - entry["last"] < seconds:
            entry["held"] += 1
            return False, 0
        held = entry["held"] if entry else 0
        _throttle[key] = {"last": now, "held": 0}
        return True, held


def send_now(alert_type: str, subject: str, text: str, html: str | None = None,
             reply_to: str | None = None) -> str:
    """Send synchronously. Returns "sent", "disabled" or "no_recipients". Raises on email failure."""
    setting = get_setting(alert_type)
    if not setting.get("enabled"):
        return "disabled"
    recipients = [r for r in (setting.get("recipients") or []) if r]
    if not recipients:
        return "no_recipients"
    mailer.send(recipients, subject, text, html, reply_to)
    log_event("alert.sent", message=subject, metadata={"alert_type": alert_type, "recipients": len(recipients)})
    return "sent"


def _deliver(alert_type, subject, text, html, reply_to):
    try:
        if not mailer.configured():
            log_event("alert.skipped", level="warning", message="Email is not set up (SMTP_USER/SMTP_PASS)",
                      metadata={"alert_type": alert_type, "subject": subject})
            return
        send_now(alert_type, subject, text, html, reply_to)
    except Exception as exc:
        traceback.print_exc()
        # Logged, not alerted: an email failure can't be reported by email.
        # It shows in the Logs tab and the weekly digest.
        log_event("alert.failed", level="error", message=f"{type(exc).__name__}: {exc}",
                  metadata={"alert_type": alert_type, "subject": subject})


def alert(alert_type: str, subject: str, text: str, html: str | None = None,
          reply_to: str | None = None, throttle_key: str | None = None,
          throttle_seconds: int = 3600) -> None:
    """Queue an alert email. Never raises, never blocks."""
    try:
        if throttle_key:
            ok, held = _check_throttle(f"{alert_type}:{throttle_key}", throttle_seconds)
            if not ok:
                return
            if held:
                note = f"This happened {held} more time{'s' if held != 1 else ''} since the last alert."
                text = f"{text}\n{note}\n"
                if html:
                    html = html.replace("</body>", f"<p><strong>{html_lib.escape(note)}</strong></p></body>")
        _executor.submit(_deliver, alert_type, subject, text, html, reply_to)
    except Exception:
        traceback.print_exc()


# ---------------------------------------------------------------- shared alert helpers

FAILED_LOGIN_LIMIT = 5
FAILED_LOGIN_WINDOW = 15 * 60
_failures: dict[str, deque] = defaultdict(deque)


def record_login_failure(kind: str, ip: str, route: str, email: str | None = None) -> None:
    """Log a failed sign-in; alert when one source hits the limit. kind: "account" | "field"."""
    log_event("auth.login_failed", level="warning", route=route,
              metadata={"login": kind, "ip": ip, **({"email": email} if email else {})})
    key = f"{kind}:{ip}"
    now = time.time()
    with _lock:
        q = _failures[key]
        q.append(now)
        while q and now - q[0] > FAILED_LOGIN_WINDOW:
            q.popleft()
        count = len(q)
    if count < FAILED_LOGIN_LIMIT:
        return
    label = {"admin": "Admin", "field": "In the Field", "account": "Website sign-in"}.get(kind, kind)
    text, html = render(
        f"Repeated failed sign-ins: {label}",
        [
            ("Sign-in page", label),
            ("From IP", ip),
            ("Email tried", email),
            ("Failed attempts", f"{count} in the last 15 minutes"),
            ("When", eastern_now()),
        ],
        footer="If this wasn't someone on the team, consider changing the password.",
    )
    alert("failed_logins", f"Repeated failed sign-ins on {label}", text, html, throttle_key=key)


def report_server_error(route: str, error: str, detail: str | None = None) -> None:
    """Log an error and alert (throttled per route + error)."""
    log_event("server.error", level="error", route=route, message=error,
              metadata={"traceback": detail[-8000:]} if detail else None)
    text, html = render(
        "Server error on the Cavalier website",
        [("Where", route), ("Error", error), ("When", eastern_now())],
        footer="Full details are in the server logs (Railway → cfs-server → Logs).",
    )
    alert("server_error", f"Server error: {route}", text, html, throttle_key=f"{route}:{error[:120]}")
