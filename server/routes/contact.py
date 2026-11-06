import traceback
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from limiter import limiter
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


@router.post("/contact")
@limiter.limit("5/hour;20/day")
async def submit_contact(request: Request, payload: ContactPayload):
    if payload.cf_extra.strip():
        # Pretend it worked so the bot moves on; save nothing.
        return {"status": "ok"}

    if not payload.name.strip() or not payload.email.strip():
        raise HTTPException(status_code=400, detail="Name and email are required.")

    try:
        supabase = get_supabase()
        supabase.table("contacts").insert({
            "name": payload.name.strip(),
            "company": payload.company.strip() or None,
            "email": payload.email.strip(),
            "phone": payload.phone.strip() or None,
            "message": payload.message.strip() or None,
        }).execute()
    except Exception:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="contact_save_failed")

    return {"status": "ok"}
