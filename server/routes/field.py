"""In the Field — staff-posted photos and videos from job sites.

Public:  GET  /api/field/posts
Staff:   POST /api/field/login | /logout, GET /api/field/session
         POST /api/field/upload-url   -> signed URL; the browser uploads the file
                                         straight to Supabase Storage (keeps large
                                         videos off this server)
         POST /api/field/posts        -> create a post from uploaded files
         DELETE /api/field/posts/{id}

Staff sign in with FIELD_PASSWORD (separate from ADMIN_PASSWORD so it can be
shared with crews and rotated without touching admin). An admin session is
also accepted for every staff action.
"""

import hashlib
import hmac
import os
import time
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Cookie, HTTPException, Request, Response
from pydantic import BaseModel, Field

from limiter import client_ip, limiter
from logger import log_event
from notify import alert, eastern_now, record_login_failure, render, site_url
from routes.admin import _is_production, _signing_key, _verify_token as _verify_admin_token
from supabase_client import get_supabase

router = APIRouter()

BUCKET = "field-media"
TABLE = "field_posts"
COOKIE_NAME = "cavalier_field_session"
SESSION_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days — crews post from their phones
MAX_MEDIA_PER_POST = 10
PAGE_SIZE = 12

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
}


# ---------------------------------------------------------------- auth

def _field_password() -> str:
    pw = os.environ.get("FIELD_PASSWORD")
    if not pw:
        raise HTTPException(status_code=500, detail="server misconfigured")
    return pw


def _sign(timestamp: str) -> str:
    # "field:" prefix keeps these tokens from being valid admin tokens.
    return hmac.new(_signing_key(), f"field:{timestamp}".encode(), hashlib.sha256).hexdigest()


def _make_token() -> str:
    timestamp = str(int(time.time()))
    return f"{timestamp}.{_sign(timestamp)}"


def _verify_field_token(token: str | None) -> bool:
    if not token or "." not in token:
        return False
    timestamp_str, sig = token.split(".", 1)
    try:
        timestamp = int(timestamp_str)
    except ValueError:
        return False
    if time.time() - timestamp > SESSION_TTL_SECONDS:
        return False
    return hmac.compare_digest(_sign(timestamp_str), sig)


def _require_staff(field_token: str | None, admin_token: str | None) -> None:
    if _verify_field_token(field_token) or _verify_admin_token(admin_token):
        return
    raise HTTPException(status_code=401, detail="unauthorized")


class LoginPayload(BaseModel):
    password: str


@router.post("/field/login")
@limiter.limit("10/minute")
async def field_login(request: Request, payload: LoginPayload, response: Response):
    if not hmac.compare_digest(payload.password.encode(), _field_password().encode()):
        record_login_failure("field", client_ip(request), "/api/field/login")
        raise HTTPException(status_code=401, detail="unauthorized")
    log_event("auth.signed_in", route="/api/field/login", metadata={"login": "field"})
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


@router.post("/field/logout")
async def field_logout(response: Response):
    response.delete_cookie(
        COOKIE_NAME,
        path="/",
        secure=_is_production(),
        samesite="none" if _is_production() else "lax",
    )
    return {"status": "ok"}


@router.get("/field/session")
async def field_session(
    cavalier_field_session: str | None = Cookie(default=None),
    cavalier_admin_session: str | None = Cookie(default=None),
):
    _require_staff(cavalier_field_session, cavalier_admin_session)
    return {"status": "ok"}


# ---------------------------------------------------------------- storage helpers

def _public_url(path: str) -> str:
    base = os.environ["SUPABASE_URL"].rstrip("/")
    return f"{base}/storage/v1/object/public/{BUCKET}/{path}"


def _media_type(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower()
    return "video" if ext in {"mp4", "mov", "webm"} else "image"


# ---------------------------------------------------------------- staff actions

class UploadUrlPayload(BaseModel):
    content_type: str


@router.post("/field/upload-url")
async def create_upload_url(
    payload: UploadUrlPayload,
    cavalier_field_session: str | None = Cookie(default=None),
    cavalier_admin_session: str | None = Cookie(default=None),
):
    _require_staff(cavalier_field_session, cavalier_admin_session)

    content_type = payload.content_type.split(";")[0].strip().lower()
    ext = EXTENSIONS.get(content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="unsupported_file_type")

    now = datetime.now(timezone.utc)
    path = f"{now:%Y/%m}/{uuid.uuid4().hex}.{ext}"
    try:
        signed = get_supabase().storage.from_(BUCKET).create_signed_upload_url(path)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"upload_url_failed: {type(exc).__name__}")

    base = os.environ["SUPABASE_URL"].rstrip("/")
    return {
        "path": path,
        "upload_url": f"{base}/storage/v1/object/upload/sign/{BUCKET}/{path}?token={signed['token']}",
    }


class MediaItem(BaseModel):
    path: str


class CreatePostPayload(BaseModel):
    caption: str = Field(default="", max_length=2000)
    location: str = Field(default="", max_length=200)
    author: str = Field(default="", max_length=100)
    media: list[MediaItem]


@router.post("/field/posts")
async def create_post(
    payload: CreatePostPayload,
    cavalier_field_session: str | None = Cookie(default=None),
    cavalier_admin_session: str | None = Cookie(default=None),
):
    _require_staff(cavalier_field_session, cavalier_admin_session)

    if not payload.media:
        raise HTTPException(status_code=400, detail="At least one photo or video is required.")
    if len(payload.media) > MAX_MEDIA_PER_POST:
        raise HTTPException(status_code=400, detail=f"Up to {MAX_MEDIA_PER_POST} files per post.")

    media = []
    for item in payload.media:
        path = item.path.strip()
        # Only accept paths shaped like the ones /upload-url hands out.
        name = path.rsplit("/", 1)[-1]
        if ".." in path or path.count("/") != 2 or name.rsplit(".", 1)[-1] not in EXTENSIONS.values():
            raise HTTPException(status_code=400, detail="invalid_media_path")
        media.append({"path": path, "url": _public_url(path), "type": _media_type(path)})

    row = {
        "caption": payload.caption.strip(),
        "location": payload.location.strip(),
        "author": payload.author.strip(),
        "media": media,
    }
    try:
        res = get_supabase().table(TABLE).insert(row).execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"post_create_failed: {type(exc).__name__}")

    post = (res.data or [row])[0]
    _post_created_alert(post, media)
    return {"post": post}


def _post_created_alert(post: dict, media: list[dict]) -> None:
    author = post.get("author") or "someone on the team"
    photos = sum(1 for m in media if m["type"] == "image")
    videos = len(media) - photos
    counts = ", ".join(
        f"{n} {label}{'s' if n != 1 else ''}" for n, label in ((photos, "photo"), (videos, "video")) if n
    )
    thumb = next((m["url"] for m in media if m["type"] == "image"), None)
    log_event("field_post.created", route="/api/field/posts", entity_type="field_post",
              entity_id=post.get("id"), message=f"By {author}: {counts}")
    text, html = render(
        f"New In the Field post by {author}",
        [
            ("Posted by", post.get("author")),
            ("Location", post.get("location")),
            ("Files", counts),
            ("Posted", eastern_now()),
        ],
        [("Caption", post.get("caption"))],
        link=("See it on In the Field", site_url("/in-the-field")),
        image_url=thumb,
    )
    alert("field_post_created", f"New In the Field post by {author}", text, html)


@router.delete("/field/posts/{post_id}")
async def delete_post(
    post_id: str,
    cavalier_field_session: str | None = Cookie(default=None),
    cavalier_admin_session: str | None = Cookie(default=None),
):
    _require_staff(cavalier_field_session, cavalier_admin_session)
    try:
        uuid.UUID(post_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="post_not_found")

    supabase = get_supabase()
    try:
        res = (
            supabase.table(TABLE)
            .select("media, caption, location, author, created_at")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="post_not_found")
        deleted = res.data[0]
        paths = [m["path"] for m in (deleted.get("media") or []) if m.get("path")]
        supabase.table(TABLE).delete().eq("id", post_id).execute()
    except HTTPException:
        raise
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"post_delete_failed: {type(exc).__name__}")

    if paths:
        try:
            supabase.storage.from_(BUCKET).remove(paths)
        except Exception:
            # Post is already gone from the site; orphaned files are harmless.
            traceback.print_exc()

    # Until user accounts exist (§1), all we know is which password was used.
    deleted_by = "an admin" if _verify_admin_token(cavalier_admin_session) else "someone signed in to In the Field"
    log_event("field_post.deleted", route=f"/api/field/posts/{post_id}", entity_type="field_post",
              entity_id=post_id, message=f"Deleted by {deleted_by}",
              metadata={"author": deleted.get("author"), "caption": (deleted.get("caption") or "")[:200]})
    created = deleted.get("created_at") or ""
    text, html = render(
        "An In the Field post was deleted",
        [
            ("Deleted by", deleted_by),
            ("Originally posted by", deleted.get("author")),
            ("Originally posted", created[:10]),
            ("Location", deleted.get("location")),
            ("Files removed", str(len(paths))),
            ("Deleted", eastern_now()),
        ],
        [("Caption", deleted.get("caption"))],
    )
    alert("field_post_deleted", f"In the Field post deleted ({deleted.get('author') or 'no name'})", text, html)
    return {"status": "ok"}


# ---------------------------------------------------------------- public feed

@router.get("/field/posts")
async def list_posts(before: str | None = None):
    """Newest first, PAGE_SIZE at a time. Pass the last post's created_at as `before`."""
    try:
        query = (
            get_supabase()
            .table(TABLE)
            .select("id, caption, location, author, media, created_at")
            .eq("is_public", True)
            .order("created_at", desc=True)
            .limit(PAGE_SIZE + 1)
        )
        if before:
            query = query.lt("created_at", before)
        res = query.execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"posts_fetch_failed: {type(exc).__name__}")

    rows = res.data or []
    return {"posts": rows[:PAGE_SIZE], "has_more": len(rows) > PAGE_SIZE}
