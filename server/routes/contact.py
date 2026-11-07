import re
import traceback
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from limiter import client_ip, limiter
from turnstile import require_human
from logger import log_event
from notify import alert, eastern_now, render, site_url
from supabase_client import get_supabase

router = APIRouter()


class ContactPayload(BaseModel):
    name: str
    company: str = ""
    email: str
    phone: str = ""
    message: str = ""
    # Honeypot: a hidden field real visitors never see. Bots fill it in.
    cf_extra: str = ""
    # Cloudflare Turnstile token (specs.md §5).
    turnstile_token: str | None = None


MAX_MESSAGE_LENGTH = 8000  # generous: includes the attached /discuss exchange
URL_RE = re.compile(r"https?://\S+|www\.\S+", re.IGNORECASE)


def _looks_like_spam(name: str, message: str) -> str | None:
    """A reason to reject, or None. Kept loose: a real lead must never be lost."""
    if URL_RE.search(name):
        return "link in name"
    links = URL_RE.findall(message)
    if len(links) > 5:
        return "too many links"
    if links and not URL_RE.sub("", message).strip():
        return "message is only links"
    return None


@router.post("/contact")
@limiter.limit("5/hour;20/day")
async def submit_contact(request: Request, payload: ContactPayload):
    if payload.cf_extra.strip():
        # Pretend it worked so the bot moves on; save nothing.
        log_event("spam.rejected", level="warning", route="/api/contact",
                  message="Contact form honeypot filled")
        return {"status": "ok"}

    if not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required.")
    if len(payload.message) > MAX_MESSAGE_LENGTH or len(payload.name) > 200:
        raise HTTPException(status_code=400, detail="That message is too long. Please shorten it or call us.")
    reason = _looks_like_spam(payload.name, payload.message)
    if reason:
        log_event("spam.rejected", level="warning", route="/api/contact", message=f"Contact form: {reason}")
        raise HTTPException(status_code=400, detail="Please remove the links from your message and try again.")
    await require_human(payload.turnstile_token, client_ip(request), "/api/contact")

    row = {
        "name": payload.name.strip(),
        "company": payload.company.strip() or None,
        "email": payload.email.strip(),
        "phone": payload.phone.strip() or None,
        "message": payload.message.strip() or None,
    }
    try:
        res = get_supabase().table("contacts").insert(row).execute()
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="contact_save_failed")

    contact_id = (res.data or [{}])[0].get("id")
    log_event("contact.submitted", route="/api/contact", entity_type="contact", entity_id=contact_id,
              message=f"{row['name']}" + (f" ({row['company']})" if row["company"] else ""))

    who = row["name"] + (f" ({row['company']})" if row["company"] else "")
    text, html = render(
        "New website inquiry",
        [
            ("Name", row["name"]),
            ("Company", row["company"]),
            ("Email", row["email"]),
            ("Phone", row["phone"]),
            ("Received", eastern_now()),
        ],
        [("Message", row["message"])],
        link=("Open the admin page", site_url("/admin")),
        footer="Reply to this email to answer them directly.",
    )
    alert("contact_submission", f"New website inquiry: {who}", text, html, reply_to=row["email"])

    return {"status": "ok"}
