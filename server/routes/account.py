"""Sign in, who am I, change password (specs.md §1)."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

import auth
from limiter import client_ip
from logger import log_event
from notify import record_login_failure
from routes.users import user_change_alert
from supabase_client import get_supabase

router = APIRouter()


class LoginPayload(BaseModel):
    email: str
    password: str


@router.post("/auth/login")
async def login(request: Request, payload: LoginPayload):
    email = payload.email.strip().lower()
    ip = client_ip(request)
    if auth.login_blocked(email, ip):
        raise HTTPException(status_code=429, detail="Too many attempts. Wait 15 minutes and try again.")

    user = auth.get_user_by_email(email) if email else None
    ok = auth.verify_password(payload.password, user["password_hash"] if user else auth._DUMMY_HASH)
    if not (user and ok):
        auth.record_login_attempt_failed(email, ip)
        record_login_failure("account", ip, "/api/auth/login", email=email or None)
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    if not user.get("active"):
        log_event("auth.login_failed", level="warning", route="/api/auth/login", actor_id=user["id"],
                  message="Deactivated account", metadata={"email": email})
        raise HTTPException(status_code=403, detail="This account has been deactivated. Ask an admin.")

    auth.clear_login_failures(email)
    now = datetime.now(timezone.utc).isoformat()
    get_supabase().table(auth.TABLE).update({"last_sign_in_at": now}).eq("id", user["id"]).execute()
    log_event("auth.signed_in", route="/api/auth/login", actor_id=user["id"],
              message=auth.full_name(user), metadata={"role": user["role"]})
    user["last_sign_in_at"] = now
    return {"token": auth.make_token(user), "user": auth.public_user(user)}


@router.get("/auth/me")
async def me(user: dict = Depends(auth.require_roles(allow_password_change_pending=True))):
    return {"user": auth.public_user(user)}


class PasswordPayload(BaseModel):
    current_password: str
    new_password: str


@router.post("/auth/password")
async def change_password(
    payload: PasswordPayload,
    user: dict = Depends(auth.require_roles(allow_password_change_pending=True)),
):
    if not auth.verify_password(payload.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Your current password isn't right.")
    auth.check_new_password(payload.new_password)
    if payload.new_password == payload.current_password:
        raise HTTPException(status_code=400, detail="Choose a different password from the current one.")

    first_time = bool(user.get("must_change_password"))
    version = int(user.get("session_version") or 1) + 1  # signs out other devices
    res = get_supabase().table(auth.TABLE).update({
        "password_hash": auth.hash_password(payload.new_password),
        "must_change_password": False,
        "session_version": version,
    }).eq("id", user["id"]).execute()
    updated = (res.data or [user])[0]

    log_event("auth.password_changed", route="/api/auth/password", actor_id=user["id"],
              entity_type="user", entity_id=user["id"], message=auth.full_name(user),
              metadata={"first_sign_in": first_time})
    if first_time:
        user_change_alert(user, updated, "Finished first sign-in (chose their own password)")
    return {"token": auth.make_token(updated), "user": auth.public_user(updated)}
