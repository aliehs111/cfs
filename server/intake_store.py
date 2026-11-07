"""Save /discuss conversations and send their alert (specs.md §4).

Every turn is saved (one row per conversation, keyed by the conversation_id the
page sends), so a visitor who leaves after the AI's clarifying question is still
recorded. One email per conversation:
  - finished conversations: right away
  - unfinished ones: once the visitor has been quiet for ABANDON_AFTER, found by
    a sweep of the database every minute (so a deploy or restart doesn't lose
    them; at worst the email is a minute or two late)
`alerted_at` is claimed with a conditional update, so a conversation is never
emailed twice.
"""

import threading
import time
import traceback
from datetime import datetime, timedelta, timezone

from logger import log_event
from notify import alert, eastern_now, render, site_url
from supabase_client import get_supabase

TABLE = "project_responses"
ABANDON_AFTER = timedelta(minutes=10)
SWEEP_EVERY_SECONDS = 60
LOG_RETENTION_DAYS = 90  # stated in the privacy policy (client/src/pages/PrivacyPage.jsx)
CLEANUP_EVERY_SECONDS = 24 * 60 * 60
ROLE_LABELS = {"owner": "Owner / Facility", "specifier": "GC / Specifier"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def transcript_text(transcript: list[dict]) -> str:
    parts = []
    for m in transcript or []:
        who = "Visitor" if m.get("role") == "user" else "Cavalier (AI)"
        parts.append(f"{who}:\n{(m.get('content') or '').strip()}")
    return "\n\n".join(parts)


def save_turn(conversation_id: str | None, role: str | None, transcript: list[dict],
              complete: bool) -> None:
    """Save the conversation so far. Never raises."""
    first_user = next((m["content"] for m in transcript if m["role"] == "user"), "").strip()
    last_ai = next((m["content"] for m in reversed(transcript) if m["role"] == "assistant"), "").strip()
    row = {
        "project_description": first_user,
        "ai_output": last_ai,
        "role": role,
        "transcript": transcript,
        "status": "complete" if complete else "in_progress",
        "updated_at": _now().isoformat(),
    }
    try:
        table = get_supabase().table(TABLE)
        if conversation_id:
            row["conversation_id"] = conversation_id
            res = table.upsert(row, on_conflict="conversation_id").execute()
        elif complete:
            # A page loaded before this change doesn't send an id: keep the old
            # behavior of saving only finished conversations.
            res = table.insert(row).execute()
        else:
            return
    except Exception as exc:
        traceback.print_exc()
        from notify import report_server_error
        report_server_error("POST /api/project-intake (save)", f"{type(exc).__name__}: {exc}")
        return

    saved = (res.data or [row])[0]
    turns = sum(1 for m in transcript if m["role"] == "user")
    log_event("intake.completed" if complete else "intake.turn", route="/api/project-intake",
              entity_type="project_response", entity_id=saved.get("id"),
              metadata={"role": role, "turns": turns})
    if complete and saved.get("id"):
        send_intake_alert(saved, finished=True)


def _claim(row_id: str) -> bool:
    """Mark the row as emailed; False if something else already did."""
    res = (
        get_supabase().table(TABLE)
        .update({"alerted_at": _now().isoformat()})
        .eq("id", row_id)
        .is_("alerted_at", "null")
        .execute()
    )
    return bool(res.data)


def send_intake_alert(row: dict, finished: bool) -> None:
    try:
        if not _claim(row["id"]):
            return
        role_label = ROLE_LABELS.get(row.get("role"), "Not given")
        transcript = row.get("transcript") or [
            {"role": "user", "content": row.get("project_description") or ""},
            {"role": "assistant", "content": row.get("ai_output") or ""},
        ]
        turns = sum(1 for m in transcript if m.get("role") == "user")
        preview = " ".join((row.get("project_description") or "").split())[:60]
        status = "Finished" if finished else "Left without finishing (didn't answer the last question)"
        text, html = render(
            "New project intake" if finished else "Project intake — left without finishing",
            [
                ("Visitor", role_label),
                ("Status", status),
                ("Visitor replies", str(turns)),
                ("Sent", eastern_now()),
            ],
            [("Conversation", transcript_text(transcript))],
            link=("Open the admin page", site_url("/admin")),
            footer="This visitor may not have left contact details. If they also send the contact form, that arrives as a separate email.",
        )
        prefix = "Project intake" if finished else "Project intake (unfinished)"
        alert("intake_completed", f"{prefix}: {role_label} — {preview}", text, html)
    except Exception:
        traceback.print_exc()


def sweep_once() -> None:
    now = _now()
    res = (
        get_supabase().table(TABLE)
        .select("*")
        .eq("status", "in_progress")
        .is_("alerted_at", "null")
        .lt("updated_at", (now - ABANDON_AFTER).isoformat())
        .gt("updated_at", (now - timedelta(days=2)).isoformat())
        .limit(50)
        .execute()
    )
    for row in res.data or []:
        log_event("intake.abandoned", route="/api/project-intake", entity_type="project_response",
                  entity_id=row["id"], metadata={"role": row.get("role")})
        send_intake_alert(row, finished=False)


def delete_old_logs() -> None:
    """Delete `logs` rows older than LOG_RETENTION_DAYS."""
    cutoff = (_now() - timedelta(days=LOG_RETENTION_DAYS)).isoformat()
    get_supabase().table("logs").delete().lt("created_at", cutoff).execute()


_started = False


def start_sweeper() -> None:
    global _started
    if _started:
        return
    _started = True

    def loop():
        last_cleanup = 0.0
        while True:
            time.sleep(SWEEP_EVERY_SECONDS)
            try:
                sweep_once()
            except Exception:
                traceback.print_exc()
            # Once a day (and shortly after each restart).
            if time.time() - last_cleanup > CLEANUP_EVERY_SECONDS:
                last_cleanup = time.time()
                try:
                    delete_old_logs()
                except Exception:
                    traceback.print_exc()

    threading.Thread(target=loop, name="intake-sweeper", daemon=True).start()
