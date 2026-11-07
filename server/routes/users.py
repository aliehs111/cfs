"""Admin → Users: create users, change roles, reset passwords, deactivate (specs.md §1).

Rules (same as EventOps):
- Only admin and dev_admin can manage users.
- Only a dev_admin can grant dev_admin or touch a dev_admin account.
- Nobody can change their own role or deactivate themselves.
- No hard delete: deactivate instead, so the logs always say who did what.
"""

import re
import traceback

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import auth
from logger import log_event
from notify import alert, eastern_now, render, site_url
from supabase_client import get_supabase

router = APIRouter()

EMAIL_RE = re.compile(r"^[^@\s,;<>]+@[^@\s,;<>]+\.[^@\s,;<>]+$")
ROLE_LABELS = {"dev_admin": "Developer admin", "admin": "Admin", "poster": "Poster", "user": "User"}
require_admin = auth.require_roles(*auth.ADMIN_ROLES)


def user_change_alert(actor: dict, target: dict, what: str) -> None:
    by = "themselves" if actor["id"] == target["id"] else auth.full_name(actor)
    text, html = render(
        f"User account change: {auth.full_name(target)}",
        [
            ("Account", f"{auth.full_name(target)} <{target.get('email')}>"),
            ("Change", what),
            ("Role now", ROLE_LABELS.get(target.get("role"), target.get("role"))),
            ("Done by", by),
            ("When", eastern_now()),
        ],
        link=("Open Admin → Users", site_url("/admin")),
    )
    alert("user_changes", f"User account change: {auth.full_name(target)} — {what}", text, html)


def _clean_email(raw: str) -> str:
    email = raw.strip().lower()
    if not EMAIL_RE.match(email) or len(email) > 254:
        raise HTTPException(status_code=400, detail="Enter a valid email address.")
    return email


def _clean_name(raw: str, field: str) -> str:
    name = " ".join(raw.split())
    if not name:
        raise HTTPException(status_code=400, detail=f"{field} is required.")
    return name[:80]


def _check_role_allowed(actor: dict, role: str) -> None:
    if role not in auth.ROLES:
        raise HTTPException(status_code=400, detail="Unknown role.")
    if role == "dev_admin" and actor["role"] != "dev_admin":
        raise HTTPException(status_code=403, detail="Only the developer admin can grant that role.")


def _load_target(actor: dict, user_id: str) -> dict:
    target = auth.get_user(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    if target["role"] == "dev_admin" and actor["role"] != "dev_admin":
        raise HTTPException(status_code=403, detail="Only the developer admin can change that account.")
    return target


@router.get("/admin/users")
async def list_users(actor: dict = Depends(require_admin)):
    res = get_supabase().table(auth.TABLE).select(auth.USER_COLUMNS).order("first_name").execute()
    users = [auth.public_user(u) for u in (res.data or [])]
    grantable = [r for r in auth.ROLES if r != "dev_admin" or actor["role"] == "dev_admin"]
    return {"users": users, "grantable_roles": grantable, "me": actor["id"]}


class CreateUser(BaseModel):
    first_name: str
    last_name: str
    email: str
    role: str


@router.post("/admin/users")
async def create_user(payload: CreateUser, actor: dict = Depends(require_admin)):
    email = _clean_email(payload.email)
    _check_role_allowed(actor, payload.role)
    if auth.get_user_by_email(email):
        raise HTTPException(status_code=400, detail="There's already an account with that email.")

    temp = auth.temporary_password()
    row = {
        "first_name": _clean_name(payload.first_name, "First name"),
        "last_name": _clean_name(payload.last_name, "Last name"),
        "email": email,
        "role": payload.role,
        "password_hash": auth.hash_password(temp),
        "must_change_password": True,
        "created_by": actor["id"],
    }
    try:
        res = get_supabase().table(auth.TABLE).insert(row).execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"user_create_failed: {type(exc).__name__}")
    user = res.data[0]

    log_event("user.created", route="/api/admin/users", actor_id=actor["id"], entity_type="user",
              entity_id=user["id"], message=f"{auth.full_name(user)} ({payload.role})",
              metadata={"email": email, "role": payload.role})
    user_change_alert(actor, user, f"Account created as {ROLE_LABELS[payload.role]}")
    # The temporary password is returned once, here, and never stored in plain text.
    return {"user": auth.public_user(user), "temporary_password": temp}


class UpdateUser(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    role: str | None = None
    active: bool | None = None


@router.patch("/admin/users/{user_id}")
async def update_user(user_id: str, payload: UpdateUser, actor: dict = Depends(require_admin)):
    target = _load_target(actor, user_id)
    changes: dict = {}
    described: list[str] = []

    if payload.first_name is not None:
        changes["first_name"] = _clean_name(payload.first_name, "First name")
    if payload.last_name is not None:
        changes["last_name"] = _clean_name(payload.last_name, "Last name")
    if payload.email is not None:
        email = _clean_email(payload.email)
        if email != target["email"]:
            other = auth.get_user_by_email(email)
            if other and other["id"] != target["id"]:
                raise HTTPException(status_code=400, detail="There's already an account with that email.")
            changes["email"] = email
            described.append(f"Email changed from {target['email']} to {email}")
    if changes.get("first_name", target["first_name"]) != target["first_name"] or \
       changes.get("last_name", target["last_name"]) != target["last_name"]:
        described.append(f"Name changed from {auth.full_name(target)}")

    if payload.role is not None and payload.role != target["role"]:
        if target["id"] == actor["id"]:
            raise HTTPException(status_code=403, detail="You can't change your own role.")
        _check_role_allowed(actor, payload.role)
        changes["role"] = payload.role
        described.append(f"Role changed from {ROLE_LABELS[target['role']]} to {ROLE_LABELS[payload.role]}")

    if payload.active is not None and payload.active != target["active"]:
        if target["id"] == actor["id"]:
            raise HTTPException(status_code=403, detail="You can't deactivate yourself.")
        changes["active"] = payload.active
        described.append("Reactivated" if payload.active else "Deactivated")
        if not payload.active:
            changes["session_version"] = int(target.get("session_version") or 1) + 1

    changes = {k: v for k, v in changes.items() if v != target.get(k)}
    if not changes:
        return {"user": auth.public_user(target)}

    res = get_supabase().table(auth.TABLE).update(changes).eq("id", user_id).execute()
    updated = res.data[0]
    what = "; ".join(described) or "Details updated"
    log_event("user.updated", route=f"/api/admin/users/{user_id}", actor_id=actor["id"],
              entity_type="user", entity_id=user_id, message=f"{auth.full_name(updated)}: {what}",
              metadata={k: v for k, v in changes.items() if k != "session_version"})
    user_change_alert(actor, updated, what)
    return {"user": auth.public_user(updated)}


@router.post("/admin/users/{user_id}/reset-password")
async def reset_password(user_id: str, actor: dict = Depends(require_admin)):
    target = _load_target(actor, user_id)
    temp = auth.temporary_password()
    res = get_supabase().table(auth.TABLE).update({
        "password_hash": auth.hash_password(temp),
        "must_change_password": True,
        "session_version": int(target.get("session_version") or 1) + 1,  # signs them out everywhere
    }).eq("id", user_id).execute()
    updated = res.data[0]
    log_event("user.password_reset", route=f"/api/admin/users/{user_id}/reset-password",
              actor_id=actor["id"], entity_type="user", entity_id=user_id, message=auth.full_name(updated))
    user_change_alert(actor, updated, "Password reset (signed out everywhere)")
    return {"user": auth.public_user(updated), "temporary_password": temp}
