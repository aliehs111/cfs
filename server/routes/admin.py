import os
import hmac
import hashlib
import time
import traceback
from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel
from supabase_client import get_supabase

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
async def admin_login(payload: LoginPayload, response: Response):
    if payload.password != _admin_password():
        raise HTTPException(status_code=401, detail="unauthorized")
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
