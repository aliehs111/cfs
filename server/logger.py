"""Write events to the `logs` table (specs.md §12).

Logging must never break or slow down a request: rows are written on a
background thread and every failure is swallowed (printed to the server log).

Event names are "<area>.<what>", e.g. "contact.submitted", "field_post.deleted",
"auth.login_failed", "page.visit", "server.error".
"""

import traceback
from concurrent.futures import ThreadPoolExecutor

from supabase_client import get_supabase

_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="log")


def _insert(row: dict) -> None:
    try:
        get_supabase().table("logs").insert(row).execute()
    except Exception:
        traceback.print_exc()


def log_event(
    event: str,
    *,
    level: str = "info",
    message: str | None = None,
    route: str | None = None,
    actor_id: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    metadata: dict | None = None,
    wait: bool = False,
) -> None:
    """Record one event. Returns immediately unless wait=True (for scripts)."""
    row = {"level": level, "event": event}
    if message is not None:
        row["message"] = message[:2000]
    if route:
        row["route"] = route
    if actor_id:
        row["actor_id"] = actor_id
    if entity_type:
        row["entity_type"] = entity_type
    if entity_id:
        row["entity_id"] = str(entity_id)
    if metadata:
        row["metadata"] = metadata
    try:
        if wait:
            _insert(row)
        else:
            _executor.submit(_insert, row)
    except Exception:
        traceback.print_exc()
