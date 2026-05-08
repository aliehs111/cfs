import traceback
from fastapi import APIRouter, HTTPException
from supabase_client import get_supabase

router = APIRouter()


@router.get("/projects")
async def list_projects():
    """List public projects for the gallery, newest first."""
    try:
        supabase = get_supabase()
        result = (
            supabase.table("projects")
            .select("*")
            .eq("is_public", True)
            .order("created_at", desc=True)
            .execute()
        )
        return {"projects": result.data}
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"projects_fetch_failed: {type(exc).__name__}: {exc}")


@router.get("/projects/{slug}")
async def get_project(slug: str):
    """Fetch a single public project by slug."""
    try:
        supabase = get_supabase()
        result = (
            supabase.table("projects")
            .select("*")
            .eq("slug", slug)
            .eq("is_public", True)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"project_fetch_failed: {type(exc).__name__}: {exc}")

    if not result.data:
        raise HTTPException(status_code=404, detail="project_not_found")
    return {"project": result.data[0]}
