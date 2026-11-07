"""Admin → Projects: add, edit, hide and delete gallery projects (specs.md §10).

Photos use the same pipeline as In the Field: the browser asks for a signed
upload URL, shrinks the photo and uploads it straight to Supabase Storage
(bucket `project-images`), then saves the project with the uploaded paths.
Files are deleted from storage when a photo or project is removed.
"""

import os
import re
import traceback
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

import auth
from logger import log_event
from supabase_client import get_supabase

router = APIRouter()
require_admin = auth.require_roles(*auth.ADMIN_ROLES)

TABLE = "projects"
BUCKET = "project-images"
MAX_IMAGES = 10
IMAGE_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
# Must match the filter buttons in client/src/pages/ProjectsPage.jsx.
PROJECT_TYPES = ["Healthcare", "Retail", "Multi-family", "Office / Corporate", "Higher Education"]
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PATH_RE = re.compile(r"^\d{4}/\d{2}/[0-9a-f]{32}\.(jpg|png|webp)$")


def _public_prefix() -> str:
    return f"{os.environ['SUPABASE_URL'].rstrip('/')}/storage/v1/object/public/{BUCKET}/"


def _url_for(path: str) -> str:
    return _public_prefix() + path


def _path_for(url: str) -> str | None:
    """The storage path for one of our uploaded images, or None (e.g. an outside link)."""
    prefix = _public_prefix()
    return url[len(prefix):] if url.startswith(prefix) else None


def _with_images(row: dict) -> dict:
    row["images"] = [{"url": u, "path": _path_for(u)} for u in (row.get("image_urls") or [])]
    return row


def _remove_files(paths: list[str]) -> None:
    if not paths:
        return
    try:
        get_supabase().storage.from_(BUCKET).remove(paths)
    except Exception:
        # The project is already updated; an orphaned file is harmless.
        traceback.print_exc()


@router.get("/admin/projects")
async def list_projects(actor: dict = Depends(require_admin)):
    rows = get_supabase().table(TABLE).select("*").order("created_at", desc=True).execute().data or []
    return {"projects": [_with_images(r) for r in rows], "project_types": PROJECT_TYPES}


class UploadUrlPayload(BaseModel):
    content_type: str


@router.post("/admin/projects/upload-url")
async def upload_url(payload: UploadUrlPayload, actor: dict = Depends(require_admin)):
    content_type = payload.content_type.split(";")[0].strip().lower()
    ext = IMAGE_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="Use JPEG, PNG or WebP photos.")
    now = datetime.now(timezone.utc)
    path = f"{now:%Y/%m}/{uuid.uuid4().hex}.{ext}"
    try:
        signed = get_supabase().storage.from_(BUCKET).create_signed_upload_url(path)
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"upload_url_failed: {type(exc).__name__}")
    base = os.environ["SUPABASE_URL"].rstrip("/")
    return {"path": path, "upload_url": f"{base}/storage/v1/object/upload/sign/{BUCKET}/{path}?token={signed['token']}"}


class ImageRef(BaseModel):
    path: str | None = None  # a photo uploaded through this page
    url: str | None = None   # an existing photo already on the project


class ProjectPayload(BaseModel):
    name: str = Field(max_length=200)
    slug: str = Field(max_length=120)
    project_type: str | None = None
    flooring_type: str | None = Field(default=None, max_length=300)
    location: str | None = Field(default=None, max_length=200)
    year: int | None = None
    square_footage: int | None = None
    short_description: str | None = Field(default=None, max_length=600)
    long_description: str | None = Field(default=None, max_length=10000)
    is_public: bool = True
    images: list[ImageRef] = []


def _clean(payload: ProjectPayload, existing: dict | None) -> dict:
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(status_code=400, detail="Give the project a name.")
    slug = payload.slug.strip().lower()
    if not SLUG_RE.match(slug):
        raise HTTPException(status_code=400, detail="The web address can only use lowercase letters, numbers and dashes.")
    if payload.project_type and payload.project_type not in PROJECT_TYPES:
        raise HTTPException(status_code=400, detail="Pick a project type from the list.")
    this_year = datetime.now().year
    if payload.year is not None and not (1950 <= payload.year <= this_year + 3):
        raise HTTPException(status_code=400, detail=f"Year should be between 1950 and {this_year + 3}.")
    if payload.square_footage is not None and not (0 < payload.square_footage <= 10_000_000):
        raise HTTPException(status_code=400, detail="Square footage looks wrong.")
    if len(payload.images) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"Up to {MAX_IMAGES} photos per project.")

    allowed_existing = set((existing or {}).get("image_urls") or [])
    urls = []
    for img in payload.images:
        if img.path:
            if not PATH_RE.match(img.path):
                raise HTTPException(status_code=400, detail="invalid_image_path")
            urls.append(_url_for(img.path))
        elif img.url and img.url in allowed_existing:
            urls.append(img.url)
        else:
            raise HTTPException(status_code=400, detail="invalid_image")

    text = lambda v: (" ".join(v.split()) if v else None) or None  # noqa: E731
    return {
        "name": name,
        "slug": slug,
        "project_type": payload.project_type or None,
        "flooring_type": text(payload.flooring_type),
        "location": text(payload.location),
        "year": payload.year,
        "square_footage": payload.square_footage,
        "short_description": (payload.short_description or "").strip() or None,
        "long_description": (payload.long_description or "").strip() or None,
        "is_public": payload.is_public,
        "image_urls": urls,
    }


def _check_slug_free(slug: str, project_id: str | None) -> None:
    rows = get_supabase().table(TABLE).select("id").eq("slug", slug).execute().data or []
    if any(r["id"] != project_id for r in rows):
        raise HTTPException(status_code=400, detail="Another project already uses that web address. Change it slightly.")


@router.post("/admin/projects")
async def create_project(payload: ProjectPayload, actor: dict = Depends(require_admin)):
    row = _clean(payload, None)
    _check_slug_free(row["slug"], None)
    saved = get_supabase().table(TABLE).insert(row).execute().data[0]
    log_event("project.created", route="/api/admin/projects", actor_id=actor["id"], entity_type="project",
              entity_id=saved["id"], message=f"{saved['name']} ({'public' if saved['is_public'] else 'hidden'})",
              metadata={"photos": len(row["image_urls"])})
    return {"project": _with_images(saved)}


def _load(project_id: str) -> dict:
    try:
        uuid.UUID(project_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="project_not_found")
    rows = get_supabase().table(TABLE).select("*").eq("id", project_id).limit(1).execute().data
    if not rows:
        raise HTTPException(status_code=404, detail="project_not_found")
    return rows[0]


@router.put("/admin/projects/{project_id}")
async def update_project(project_id: str, payload: ProjectPayload, actor: dict = Depends(require_admin)):
    existing = _load(project_id)
    row = _clean(payload, existing)
    _check_slug_free(row["slug"], project_id)
    saved = get_supabase().table(TABLE).update(row).eq("id", project_id).execute().data[0]

    removed = [u for u in (existing.get("image_urls") or []) if u not in row["image_urls"]]
    _remove_files([p for p in (_path_for(u) for u in removed) if p])

    changed = sorted(k for k, v in row.items() if existing.get(k) != v)
    log_event("project.updated", route=f"/api/admin/projects/{project_id}", actor_id=actor["id"],
              entity_type="project", entity_id=project_id, message=f"{saved['name']}: {', '.join(changed) or 'no changes'}",
              metadata={"changed": changed, "photos_removed": len(removed)})
    return {"project": _with_images(saved)}


@router.delete("/admin/projects/{project_id}")
async def delete_project(project_id: str, actor: dict = Depends(require_admin)):
    existing = _load(project_id)
    get_supabase().table(TABLE).delete().eq("id", project_id).execute()
    _remove_files([p for p in (_path_for(u) for u in (existing.get("image_urls") or [])) if p])
    log_event("project.deleted", route=f"/api/admin/projects/{project_id}", actor_id=actor["id"],
              entity_type="project", entity_id=project_id, message=existing.get("name"),
              metadata={"slug": existing.get("slug"), "photos": len(existing.get("image_urls") or [])})
    return {"status": "ok"}


class DiscardPayload(BaseModel):
    paths: list[str]


@router.post("/admin/projects/discard-uploads")
async def discard_uploads(payload: DiscardPayload, actor: dict = Depends(require_admin)):
    """Delete photos uploaded in the form but never saved (the admin pressed Cancel)."""
    paths = [p for p in payload.paths[:MAX_IMAGES] if PATH_RE.match(p)]
    in_use = set()
    for r in get_supabase().table(TABLE).select("image_urls").execute().data or []:
        in_use.update(_path_for(u) for u in (r.get("image_urls") or []))
    _remove_files([p for p in paths if p not in in_use])
    return {"status": "ok"}
