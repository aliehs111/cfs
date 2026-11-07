"""Weekly digest email (specs.md §4): the last 7 days compared with the 7 before.

Built from the `logs` table plus the contacts / project_responses / field_posts
tables. Sent by weekly_digest.py (Railway cron) and by "Send test" on
Admin → Notifications.
"""

import os
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from notify import EASTERN, render, site_url
from supabase_client import get_supabase

PAGE = 1000  # Supabase returns at most 1000 rows per request


def _fetch_all(table: str, columns: str, since: datetime, until: datetime) -> list[dict]:
    rows, start = [], 0
    while True:
        res = (
            get_supabase().table(table).select(columns)
            .gte("created_at", since.isoformat()).lt("created_at", until.isoformat())
            .order("created_at").range(start, start + PAGE - 1).execute()
        )
        batch = res.data or []
        rows += batch
        if len(batch) < PAGE:
            return rows
        start += PAGE


def _change(now: int, before: int) -> str:
    if before == 0:
        return f"{now}" if now == 0 else f"{now} (none the week before)"
    pct = round((now - before) / before * 100)
    sign = "+" if pct >= 0 else ""
    return f"{now} ({sign}{pct}% vs {before} the week before)"


def _own_host() -> str:
    return urlparse(os.environ.get("FRONTEND_URL") or "").netloc.lower()


def _local(ts: str) -> str:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(EASTERN)
    return dt.strftime("%a %b %-d")


def build_digest(now: datetime | None = None) -> tuple[str, str, str]:
    now = now or datetime.now(timezone.utc)
    start = now - timedelta(days=7)
    prev_start = start - timedelta(days=7)

    logs = _fetch_all("logs", "event, level, metadata, created_at", prev_start, now)
    def when(r):
        return datetime.fromisoformat(r["created_at"].replace("Z", "+00:00"))

    this_week = [r for r in logs if when(r) >= start]
    last_week = [r for r in logs if when(r) < start]

    def count(rows, event):
        return sum(1 for r in rows if r["event"] == event)

    visits = [r for r in this_week if r["event"] == "page.visit"]
    pages = Counter((r.get("metadata") or {}).get("path", "?") for r in visits)
    devices = Counter((r.get("metadata") or {}).get("device", "?") for r in visits)
    own = _own_host()
    referrers = Counter()
    for r in visits:
        host = urlparse((r.get("metadata") or {}).get("referrer") or "").netloc.lower()
        if host and host != own:
            referrers[host.removeprefix("www.")] += 1

    contacts = _fetch_all("contacts", "name, company, created_at", start, now)
    contacts_prev = _fetch_all("contacts", "id", prev_start, start)
    intakes = _fetch_all("project_responses", "id", start, now)
    intakes_prev = _fetch_all("project_responses", "id", prev_start, start)
    posts = _fetch_all("field_posts", "author, created_at", start, now)

    start_label = start.astimezone(EASTERN).strftime("%b %-d")
    end_label = now.astimezone(EASTERN).strftime("%b %-d, %Y")

    fields = [
        ("Week", f"{start_label} – {end_label}"),
        ("Page visits", _change(len(visits), count(last_week, "page.visit"))),
        ("Contact form leads", _change(len(contacts), len(contacts_prev))),
        ("Project intakes", _change(len(intakes), len(intakes_prev))),
        ("Chat conversations", _change(count(this_week, "chat.started"), count(last_week, "chat.started"))),
        ("In the Field posts", str(len(posts))),
        ("New comments", str(count(this_week, "comment.created"))),
    ]

    def lines(counter: Counter, n=5):
        return "\n".join(f"{v:>4}  {k}" for k, v in counter.most_common(n)) or "None"

    lead_lines = "\n".join(
        f"{_local(c['created_at'])}  {c.get('name') or '—'}" + (f" ({c['company']})" if c.get("company") else "")
        for c in contacts
    ) or "None this week"
    post_lines = "\n".join(
        f"{_local(p['created_at'])}  {p.get('author') or 'No name'}" for p in posts
    ) or "None this week"

    health = {
        "Server errors": count(this_week, "server.error"),
        "Failed sign-ins": count(this_week, "auth.login_failed"),
        "Alert emails that failed to send": count(this_week, "alert.failed"),
        "Spam rejected": count(this_week, "spam.rejected"),
        "Rate limit hits": count(this_week, "rate_limit.hit"),
    }
    health_text = "\n".join(f"{k}: {v}" for k, v in health.items())

    sections = [
        ("Leads", lead_lines),
        ("In the Field posts", post_lines),
        ("Top pages", lines(pages)),
        ("Where visitors came from", lines(referrers)),
        ("Devices", lines(devices)),
        ("Site health", health_text),
    ]
    subject = f"Cavalier website weekly: {len(contacts)} lead{'s' if len(contacts) != 1 else ''}, {len(visits)} visits"
    text, html = render(
        "Cavalier website — weekly digest",
        fields,
        sections,
        link=("Open the admin page", site_url("/admin")),
        footer="Visits exclude staff pages and known bots. Turn this email off or change who gets it on Admin → Notifications.",
    )
    return subject, text, html
