import traceback
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase_client import get_supabase

router = APIRouter()


class ContactPayload(BaseModel):
    name: str
    company: str = ""
    email: str
    phone: str = ""
    message: str = ""


@router.post("/contact")
async def submit_contact(payload: ContactPayload):
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
