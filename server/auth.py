"""User accounts: passwords, sessions and role checks (specs.md §1).

Modeled on EventOps (backend/auth.py), with one difference: the session is
sent as an `Authorization: Bearer <token>` header, not a cookie, because the
site and API are on different domains until the domain move and iPhone Safari
blocks cross-site cookies.

Token: "<user_id>.<session_version>.<issued_at>.<hmac>" signed with
SESSION_SECRET. Every request re-reads the user, so deactivating someone or
resetting their password (which bumps session_version) signs them out at once.
"""

import base64
import hashlib
import hmac
import os
import secrets
import threading
import time
from collections import defaultdict, deque

from fastapi import Header, HTTPException

from supabase_client import get_supabase

TABLE = "app_users"
ROLES = ("dev_admin", "admin", "poster", "user")
ADMIN_ROLES = ("dev_admin", "admin")
POSTER_ROLES = ("dev_admin", "admin", "poster")
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30
MIN_PASSWORD_LENGTH = 10
USER_COLUMNS = (
    "id, first_name, last_name, email, role, must_change_password, active, "
    "last_sign_in_at, created_at, created_by"
)


# ---------------------------------------------------------------- passwords

_SCRYPT = {"n": 2**14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=64, **_SCRYPT)
    return "scrypt${n}${r}${p}${salt}${hash}".format(
        **_SCRYPT,
        salt=base64.b64encode(salt).decode(),
        hash=base64.b64encode(digest).decode(),
    )


def verify_password(password: str, stored: str | None) -> bool:
    try:
        _, n, r, p, salt_b64, hash_b64 = (stored or "").split("$")
        digest = hashlib.scrypt(
            password.encode(), salt=base64.b64decode(salt_b64),
            n=int(n), r=int(r), p=int(p), dklen=64,
        )
        return hmac.compare_digest(digest, base64.b64decode(hash_b64))
    except Exception:
        return False


# Checked against when the email doesn't exist, so unknown emails take as long
# as known ones and response timing doesn't reveal who has an account.
_DUMMY_HASH = hash_password(secrets.token_hex(16))

# No look-alike characters (0/O, 1/l/I).
_ALPHABET_LOWER = "abcdefghijkmnpqrstuvwxyz"
_ALPHABET_UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
_DIGITS = "23456789"


def temporary_password() -> str:
    """Like abcd-EFGH-2345."""
    pick = lambda chars, k: "".join(secrets.choice(chars) for _ in range(k))  # noqa: E731
    return f"{pick(_ALPHABET_LOWER, 4)}-{pick(_ALPHABET_UPPER, 4)}-{pick(_DIGITS, 4)}"


def check_new_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Use at least {MIN_PASSWORD_LENGTH} characters.")
    if len(password) > 200:
        raise HTTPException(status_code=400, detail="That password is too long.")


# ---------------------------------------------------------------- sessions

def _secret() -> bytes:
    secret = os.environ.get("SESSION_SECRET")
    if not secret:
        raise HTTPException(status_code=500, detail="server misconfigured (SESSION_SECRET)")
    return secret.encode()


def _sign(payload: str) -> str:
    return hmac.new(_secret(), f"acct:{payload}".encode(), hashlib.sha256).hexdigest()


def make_token(user: dict) -> str:
    payload = f"{user['id']}.{user.get('session_version', 1)}.{int(time.time())}"
    return f"{payload}.{_sign(payload)}"


def _parse_token(token: str) -> tuple[str, int] | None:
    try:
        user_id, version, issued, sig = token.split(".")
        payload = f"{user_id}.{version}.{issued}"
        if not hmac.compare_digest(_sign(payload), sig):
            return None
        if time.time() - int(issued) > SESSION_TTL_SECONDS:
            return None
        return user_id, int(version)
    except (ValueError, AttributeError):
        return None


def public_user(user: dict) -> dict:
    return {k: user.get(k) for k in (
        "id", "first_name", "last_name", "email", "role", "must_change_password",
        "active", "last_sign_in_at", "created_at",
    )} | {"name": full_name(user)}


def full_name(user: dict | None) -> str:
    if not user:
        return ""
    return f"{user.get('first_name') or ''} {user.get('last_name') or ''}".strip()


def get_user(user_id: str) -> dict | None:
    res = get_supabase().table(TABLE).select("*").eq("id", user_id).limit(1).execute()
    return res.data[0] if res.data else None


def get_user_by_email(email: str) -> dict | None:
    res = get_supabase().table(TABLE).select("*").eq("email", email.strip().lower()).limit(1).execute()
    return res.data[0] if res.data else None


def user_from_header(authorization: str | None) -> dict | None:
    """The signed-in, active user for this Authorization header, or None."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    parsed = _parse_token(authorization[7:].strip())
    if not parsed:
        return None
    user_id, version = parsed
    user = get_user(user_id)
    if not user or not user.get("active") or user.get("session_version", 1) != version:
        return None
    return user


def require_roles(*roles: str, allow_password_change_pending: bool = False):
    """FastAPI dependency: the signed-in user, who must have one of `roles`
    (any role if none given). 401 = not signed in; 403 = signed in but not allowed."""

    def dependency(authorization: str | None = Header(default=None)) -> dict:
        user = user_from_header(authorization)
        if not user:
            raise HTTPException(status_code=401, detail="unauthorized")
        if user.get("must_change_password") and not allow_password_change_pending:
            raise HTTPException(status_code=403, detail="must_change_password")
        if roles and user["role"] not in roles:
            raise HTTPException(status_code=403, detail="forbidden")
        return user

    return dependency


# ---------------------------------------------------------------- sign-in throttling

LOGIN_LIMIT = 5
LOGIN_WINDOW_SECONDS = 15 * 60
_attempts: dict[str, deque] = defaultdict(deque)
_lock = threading.Lock()


def _recent(key: str, now: float) -> deque:
    q = _attempts[key]
    while q and now - q[0] > LOGIN_WINDOW_SECONDS:
        q.popleft()
    return q


def login_blocked(email: str, ip: str) -> bool:
    now = time.time()
    with _lock:
        return any(len(_recent(k, now)) >= LOGIN_LIMIT for k in (f"email:{email}", f"ip:{ip}"))


def record_login_attempt_failed(email: str, ip: str) -> None:
    now = time.time()
    with _lock:
        for k in (f"email:{email}", f"ip:{ip}"):
            _recent(k, now).append(now)


def clear_login_failures(email: str) -> None:
    with _lock:
        _attempts.pop(f"email:{email}", None)


# ---------------------------------------------------------------- bootstrap

def ensure_dev_admin() -> None:
    """Create the developer account from env vars if no dev_admin exists yet."""
    email = (os.environ.get("DEV_ADMIN_EMAIL") or "").strip().lower()
    password = os.environ.get("DEV_ADMIN_PASSWORD") or ""
    if not (email and password):
        return
    sb = get_supabase()
    if sb.table(TABLE).select("id").eq("role", "dev_admin").limit(1).execute().data:
        return
    name = (os.environ.get("DEV_ADMIN_NAME") or "CTX 201").split(" ", 1)
    sb.table(TABLE).insert({
        "first_name": name[0],
        "last_name": name[1] if len(name) > 1 else "",
        "email": email,
        "role": "dev_admin",
        "password_hash": hash_password(password),
        "must_change_password": True,
    }).execute()
    print(f"Created dev_admin account for {email}")
