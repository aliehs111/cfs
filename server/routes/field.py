"""In the Field — staff-posted photos and videos from job sites, with comments.

Public:   GET  /api/field/posts                 (posts + their comments; ?q= keyword search)
          GET  /api/field/featured              (featured video posts for a section)
Admins:   POST /api/field/posts/{id}/feature    -> feature / unfeature a video post
Posters:  POST /api/field/upload-url            -> signed URL; the browser uploads the file
                                                   straight to Supabase Storage (keeps large
                                                   videos off this server)
          POST /api/field/posts                 -> create a post from uploaded files
          PATCH/DELETE /api/field/posts/{id}    -> own posts (admins: any)
Accounts: POST /api/field/posts/{id}/comments   -> comment or reply (any signed-in role)
          PATCH/DELETE /api/field/comments/{id} -> own comments (admins can delete any)

Everyone signs in with their own account (specs.md §1). The shared
FIELD_PASSWORD was retired Nov 2026.

Sections (Nov 19 2026): each post belongs to one page. "field" is In the
Field; "day-in-the-life" is A Day in the Life (tongue-in-cheek photos of what
crews walk into). GET /api/field/posts?section=... lists one section. Needs
the `section` column (schema.sql, "SECTIONS" block); until it's added,
In the Field keeps working and A Day in the Life is simply empty.
"""

import os
import re
import traceback
import uuid
from datetime import datetime, timezone

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

import auth
from limiter import limiter
from logger import log_event
from notify import alert, eastern_now, render, site_url
from supabase_client import get_supabase

router = APIRouter()

BUCKET = "field-media"
TABLE = "field_posts"
COMMENTS = "field_comments"
MAX_MEDIA_PER_POST = 10
MAX_COMMENT_LENGTH = 2000
PAGE_SIZE = 12

DEFAULT_SECTION = "field"
SECTION_PAGES = {
    "field": ("In the Field", "/in-the-field"),
    "day-in-the-life": ("A Day in the Life", "/day-in-the-life"),
}
Section = Literal["field", "day-in-the-life"]

EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
}

require_poster = auth.require_roles(*auth.POSTER_ROLES)
require_account = auth.require_roles()  # any role, password already changed
require_admin = auth.require_roles(*auth.ADMIN_ROLES)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _check_uuid(value: str, what: str) -> None:
    try:
        uuid.UUID(value)
    except ValueError:
        raise HTTPException(status_code=404, detail=f"{what}_not_found")


def _can_manage(user: dict, owner_id: str | None) -> bool:
    """Owners manage their own things; admins manage everything."""
    return user["role"] in auth.ADMIN_ROLES or (owner_id is not None and owner_id == user["id"])


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
async def create_upload_url(payload: UploadUrlPayload, staff: dict = Depends(require_poster)):

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
    media: list[MediaItem]
    section: Section = DEFAULT_SECTION


@router.post("/field/posts")
async def create_post(payload: CreatePostPayload, staff: dict = Depends(require_poster)):

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
        "author": auth.full_name(staff),
        "user_id": staff["id"],
        "media": media,
    }
    # Only set when not the default, so In the Field posting keeps working
    # even before the `section` column has been added.
    if payload.section != DEFAULT_SECTION:
        row["section"] = payload.section
    try:
        res = get_supabase().table(TABLE).insert(row).execute()
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"post_create_failed: {type(exc).__name__}")

    post = (res.data or [row])[0]
    _post_created_alert(post, media, staff)
    return {"post": post}


def _post_created_alert(post: dict, media: list[dict], staff: dict) -> None:
    author = post.get("author") or "someone on the team"
    photos = sum(1 for m in media if m["type"] == "image")
    videos = len(media) - photos
    counts = ", ".join(
        f"{n} {label}{'s' if n != 1 else ''}" for n, label in ((photos, "photo"), (videos, "video")) if n
    )
    thumb = next((m["url"] for m in media if m["type"] == "image"), None)
    page_name, page_path = SECTION_PAGES.get(post.get("section") or DEFAULT_SECTION, SECTION_PAGES[DEFAULT_SECTION])
    log_event("field_post.created", route="/api/field/posts", entity_type="field_post",
              actor_id=staff["id"], entity_id=post.get("id"), message=f"By {author} on {page_name}: {counts}")
    text, html = render(
        f"New {page_name} post by {author}",
        [
            ("Posted by", post.get("author")),
            ("Location", post.get("location")),
            ("Files", counts),
            ("Posted", eastern_now()),
        ],
        [("Caption", post.get("caption"))],
        link=(f"See it on {page_name}", site_url(page_path)),
        image_url=thumb,
    )
    alert("field_post_created", f"New {page_name} post by {author}", text, html)


@router.delete("/field/posts/{post_id}")
async def delete_post(post_id: str, staff: dict = Depends(require_poster)):
    _check_uuid(post_id, "post")

    supabase = get_supabase()
    try:
        res = (
            supabase.table(TABLE)
            .select("media, caption, location, author, user_id, created_at")
            .eq("id", post_id)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise HTTPException(status_code=404, detail="post_not_found")
        deleted = res.data[0]
        if not _can_manage(staff, deleted.get("user_id")):
            raise HTTPException(status_code=403, detail="You can only delete your own posts.")
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

    deleted_by = auth.full_name(staff)
    log_event("field_post.deleted", route=f"/api/field/posts/{post_id}", entity_type="field_post",
              actor_id=staff["id"],
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


class UpdatePostPayload(BaseModel):
    caption: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=200)
    # Optional: the post's photos/videos in order. Existing ones are kept or
    # dropped (dropped files are deleted); new ones come from /upload-url.
    media: list[MediaItem] | None = None
    # Optional: move the post to the other page.
    section: Section | None = None


@router.patch("/field/posts/{post_id}")
async def update_post(post_id: str, payload: UpdatePostPayload, staff: dict = Depends(require_poster)):
    _check_uuid(post_id, "post")
    sb = get_supabase()
    res = sb.table(TABLE).select("id, user_id, author, media").eq("id", post_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="post_not_found")
    existing = res.data[0]
    if not _can_manage(staff, existing.get("user_id")):
        raise HTTPException(status_code=403, detail="You can only edit your own posts.")

    changes: dict = {}
    for key in ("caption", "location"):
        value = getattr(payload, key)
        if value is not None:
            changes[key] = value.strip()
    if payload.section is not None:
        changes["section"] = payload.section

    removed_paths: list[str] = []
    if payload.media is not None:
        if not payload.media:
            raise HTTPException(status_code=400, detail="A post needs at least one photo or video. Delete the post instead.")
        if len(payload.media) > MAX_MEDIA_PER_POST:
            raise HTTPException(status_code=400, detail=f"Up to {MAX_MEDIA_PER_POST} files per post.")
        current = {m["path"]: m for m in (existing.get("media") or []) if m.get("path")}
        media = []
        for item in payload.media:
            path = item.path.strip()
            if path in current:
                media.append(current[path])
                continue
            name = path.rsplit("/", 1)[-1]
            if ".." in path or path.count("/") != 2 or name.rsplit(".", 1)[-1] not in EXTENSIONS.values():
                raise HTTPException(status_code=400, detail="invalid_media_path")
            media.append({"path": path, "url": _public_url(path), "type": _media_type(path)})
        kept = {m["path"] for m in media}
        removed_paths = [p for p in current if p not in kept]
        changes["media"] = media

    if not changes:
        raise HTTPException(status_code=400, detail="Nothing to change.")
    updated = sb.table(TABLE).update(changes).eq("id", post_id).execute().data[0]
    if removed_paths:
        try:
            sb.storage.from_(BUCKET).remove(removed_paths)
        except Exception:
            traceback.print_exc()  # the post is already updated; orphans are harmless

    by_other = existing.get("user_id") != staff["id"]
    log_event("field_post.edited", route=f"/api/field/posts/{post_id}", actor_id=staff["id"],
              entity_type="field_post", entity_id=post_id,
              message=f"Edited by {auth.full_name(staff)}" + (f" (post by {existing.get('author') or 'someone else'})" if by_other else ""),
              metadata={"fields": sorted(changes), "files_removed": len(removed_paths),
                        "files_now": len(changes.get("media") or existing.get("media") or [])})
    updated["comments"] = _comments_for([post_id]).get(post_id, [])
    return {"post": updated}


# ---------------------------------------------------------------- comments

def _public_comment(c: dict, names: dict[str, str]) -> dict:
    deleted = bool(c.get("deleted_at"))
    return {
        "id": c["id"],
        "post_id": c["post_id"],
        "parent_id": c.get("parent_id"),
        "user_id": None if deleted else c.get("user_id"),
        "author": None if deleted else names.get(c.get("user_id"), "Former team member"),
        "body": None if deleted else c.get("body"),
        "deleted": deleted,
        "created_at": c.get("created_at"),
        "edited_at": None if deleted else c.get("edited_at"),
    }


def _names_for(user_ids: set[str]) -> dict[str, str]:
    if not user_ids:
        return {}
    res = (
        get_supabase().table(auth.TABLE).select("id, first_name, last_name")
        .in_("id", list(user_ids)).execute()
    )
    return {u["id"]: auth.full_name(u) for u in (res.data or [])}


def _comments_for(post_ids: list[str]) -> dict[str, list[dict]]:
    if not post_ids:
        return {}
    rows = (
        get_supabase().table(COMMENTS)
        .select("id, post_id, parent_id, user_id, body, created_at, edited_at, deleted_at")
        .in_("post_id", post_ids).order("created_at").execute().data or []
    )
    # A removed comment with no live replies has nothing left to show.
    live_parents = {r["parent_id"] for r in rows if r.get("parent_id") and not r.get("deleted_at")}
    rows = [r for r in rows if not r.get("deleted_at") or r["id"] in live_parents]
    names = _names_for({r["user_id"] for r in rows if r.get("user_id")})
    by_post: dict[str, list[dict]] = {}
    for r in rows:
        by_post.setdefault(r["post_id"], []).append(_public_comment(r, names))
    return by_post


def _clean_body(body: str) -> str:
    body = body.strip()
    if not body:
        raise HTTPException(status_code=400, detail="Write something first.")
    if len(body) > MAX_COMMENT_LENGTH:
        raise HTTPException(status_code=400, detail=f"Comments are limited to {MAX_COMMENT_LENGTH} characters.")
    return body


class CommentPayload(BaseModel):
    body: str
    parent_id: str | None = None


@router.post("/field/posts/{post_id}/comments")
@limiter.limit("30/hour")
async def create_comment(request: Request, post_id: str, payload: CommentPayload,
                         user: dict = Depends(require_account)):
    _check_uuid(post_id, "post")
    body = _clean_body(payload.body)
    sb = get_supabase()
    if not sb.table(TABLE).select("id").eq("id", post_id).eq("is_public", True).limit(1).execute().data:
        raise HTTPException(status_code=404, detail="post_not_found")
    if payload.parent_id:
        _check_uuid(payload.parent_id, "comment")
        parent = sb.table(COMMENTS).select("post_id, parent_id, deleted_at").eq("id", payload.parent_id) \
            .limit(1).execute().data
        if not parent or parent[0]["post_id"] != post_id:
            raise HTTPException(status_code=404, detail="comment_not_found")
        if parent[0].get("parent_id"):
            raise HTTPException(status_code=400, detail="Reply to the original comment instead.")
        if parent[0].get("deleted_at"):
            raise HTTPException(status_code=400, detail="That comment was removed.")
    row = sb.table(COMMENTS).insert({
        "post_id": post_id, "parent_id": payload.parent_id, "user_id": user["id"], "body": body,
    }).execute().data[0]
    log_event("comment.created", route=f"/api/field/posts/{post_id}/comments", actor_id=user["id"],
              entity_type="field_comment", entity_id=row["id"],
              message=f"{auth.full_name(user)}: {body[:120]}",
              metadata={"post_id": post_id, "reply": bool(payload.parent_id)})
    return {"comment": _public_comment(row, {user["id"]: auth.full_name(user)})}


def _load_comment(comment_id: str) -> dict:
    _check_uuid(comment_id, "comment")
    rows = get_supabase().table(COMMENTS).select("*").eq("id", comment_id).limit(1).execute().data
    if not rows or rows[0].get("deleted_at"):
        raise HTTPException(status_code=404, detail="comment_not_found")
    return rows[0]


class EditCommentPayload(BaseModel):
    body: str


@router.patch("/field/comments/{comment_id}")
async def edit_comment(comment_id: str, payload: EditCommentPayload, user: dict = Depends(require_account)):
    comment = _load_comment(comment_id)
    # Authors edit their own; admins can edit anyone's.
    if not _can_manage(user, comment["user_id"]):
        raise HTTPException(status_code=403, detail="You can only edit your own comments.")
    body = _clean_body(payload.body)
    row = get_supabase().table(COMMENTS).update({"body": body, "edited_at": _now()}) \
        .eq("id", comment_id).execute().data[0]
    by_other = comment["user_id"] != user["id"]
    log_event("comment.edited", route=f"/api/field/comments/{comment_id}", actor_id=user["id"],
              entity_type="field_comment", entity_id=comment_id,
              message=(f"Admin edit by {auth.full_name(user)}: " if by_other else "") + body[:120],
              metadata={"author_id": comment["user_id"], "previous": (comment.get("body") or "")[:500]} if by_other else None)
    names = _names_for({row["user_id"]})
    return {"comment": _public_comment(row, names)}


@router.delete("/field/comments/{comment_id}")
async def delete_comment(comment_id: str, user: dict = Depends(require_account)):
    comment = _load_comment(comment_id)
    if not _can_manage(user, comment["user_id"]):
        raise HTTPException(status_code=403, detail="You can only delete your own comments.")
    # Soft delete keeps reply threads intact; the text is hidden from the site
    # but kept for the record.
    get_supabase().table(COMMENTS).update({"deleted_at": _now(), "deleted_by": user["id"]}) \
        .eq("id", comment_id).execute()
    log_event("comment.deleted", route=f"/api/field/comments/{comment_id}", actor_id=user["id"],
              entity_type="field_comment", entity_id=comment_id,
              message=f"Removed by {auth.full_name(user)}",
              metadata={"author_id": comment["user_id"], "body": (comment.get("body") or "")[:200]})
    return {"status": "ok"}


# ---------------------------------------------------------------- public feed

BASE_COLUMNS = "id, caption, location, author, user_id, media, created_at"
SEARCH_FIELDS = ("caption", "location", "author")
MAX_FEATURED = 10


def _search_filter(q: str) -> str | None:
    """A PostgREST filter where every word in `q` appears in the caption,
    location or poster name (any mix, case-insensitive). Characters that mean
    something in PostgREST filters are dropped rather than escaped."""
    words = re.sub(r"[^\w\s'&-]", " ", q).split()[:8]
    if not words:
        return None
    groups = [
        "or(" + ",".join(f"{field}.ilike.*{word}*" for field in SEARCH_FIELDS) + ")"
        for word in words
    ]
    return f"and({','.join(groups)})"


def _list_query(before: str | None, section: str | None, search: str | None, featured_column: bool):
    """One page of public posts, newest first.
    section=None: no section filter (only before the `section` column exists).
    featured_column=False: before the `featured_at` column exists.
    Without a search, featured posts are left out (they show at the top of the
    page instead). A search covers every post, featured ones included."""
    columns = BASE_COLUMNS + (", section" if section else "") + (", featured_at" if featured_column else "")
    query = get_supabase().table(TABLE).select(columns).eq("is_public", True)
    if section:
        query = query.eq("section", section)
    if search:
        query = query.or_(search)
    elif featured_column:
        query = query.is_("featured_at", "null")
    query = query.order("created_at", desc=True).limit(PAGE_SIZE + 1)
    if before:
        query = query.lt("created_at", before)
    return query.execute()


def _attach_comments(posts: list[dict]) -> None:
    try:
        comments = _comments_for([p["id"] for p in posts])
    except Exception:
        # Comments are secondary: show the posts even if they can't load.
        traceback.print_exc()
        comments = {}
    for p in posts:
        p["comments"] = comments.get(p["id"], [])


@router.get("/field/posts")
async def list_posts(before: str | None = None, section: Section = DEFAULT_SECTION,
                     q: str = Query(default="", max_length=100)):
    """Newest first, PAGE_SIZE at a time, for one page (section). Pass the last
    post's created_at as `before`. `q` is a keyword search."""
    search = _search_filter(q)
    if q.strip() and not search:
        return {"posts": [], "has_more": False}
    # Newest schema first; fall back if a column hasn't been added yet.
    attempts = [(section, True), (section, False)]
    if section == DEFAULT_SECTION:
        attempts.append((None, False))  # before the `section` column existed
    res = None
    for sec, featured_column in attempts:
        try:
            res = _list_query(before, sec, search, featured_column)
            break
        except Exception:
            traceback.print_exc()
    if res is None:
        if section != DEFAULT_SECTION:
            # Most likely the `section` column hasn't been added (schema.sql).
            return {"posts": [], "has_more": False}
        raise HTTPException(status_code=500, detail="posts_fetch_failed")

    rows = res.data or []
    posts = rows[:PAGE_SIZE]
    _attach_comments(posts)
    return {"posts": posts, "has_more": len(rows) > PAGE_SIZE}


@router.get("/field/featured")
async def list_featured(section: Section = DEFAULT_SECTION):
    """Featured video posts for one page, most recently featured first."""
    try:
        res = (
            get_supabase().table(TABLE)
            .select(BASE_COLUMNS + ", section, featured_at")
            .eq("is_public", True).eq("section", section)
            .not_.is_("featured_at", "null")
            .order("featured_at", desc=True).limit(MAX_FEATURED)
            .execute()
        )
    except Exception:
        # Most likely the `featured_at` column hasn't been added (schema.sql).
        traceback.print_exc()
        return {"posts": []}
    posts = res.data or []
    _attach_comments(posts)
    return {"posts": posts}


class FeaturePayload(BaseModel):
    featured: bool


@router.post("/field/posts/{post_id}/feature")
async def feature_post(post_id: str, payload: FeaturePayload, admin: dict = Depends(require_admin)):
    """Admins only: put a video post in (or take it out of) the featured spot."""
    _check_uuid(post_id, "post")
    sb = get_supabase()
    rows = sb.table(TABLE).select("id, author, media").eq("id", post_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="post_not_found")
    if payload.featured and not any(m.get("type") == "video" for m in rows[0].get("media") or []):
        raise HTTPException(status_code=400, detail="Only posts with a video can be featured.")
    try:
        updated = sb.table(TABLE).update({"featured_at": _now() if payload.featured else None}) \
            .eq("id", post_id).execute().data[0]
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"feature_failed: {type(exc).__name__}")
    log_event("field_post.featured" if payload.featured else "field_post.unfeatured",
              route=f"/api/field/posts/{post_id}/feature", actor_id=admin["id"],
              entity_type="field_post", entity_id=post_id,
              message=f"{'Featured' if payload.featured else 'Unfeatured'} by {auth.full_name(admin)}"
                      f" (post by {rows[0].get('author') or 'no name'})")
    updated["comments"] = _comments_for([post_id]).get(post_id, [])
    return {"post": updated}
