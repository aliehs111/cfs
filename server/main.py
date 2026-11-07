import os
from dotenv import load_dotenv

load_dotenv()

import traceback

from fastapi import FastAPI, Request, status
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.exceptions import HTTPException as StarletteHTTPException

from auth import ensure_dev_admin
from intake_store import start_sweeper
from limiter import limiter
from logger import log_event
from notify import report_server_error
from routes.projects import router as projects_router
from routes.intake import router as intake_router
from routes.contact import router as contact_router
from routes.admin import router as admin_router
from routes.chat import router as chat_router
from routes.field import router as field_router
from routes.account import router as account_router
from routes.users import router as users_router

app = FastAPI(title="Cavalier Flooring API")
app.state.limiter = limiter


async def on_rate_limited(request: Request, exc: RateLimitExceeded):
    log_event("rate_limit.hit", level="warning", route=request.url.path,
              metadata={"limit": str(exc.detail)})
    return _rate_limit_exceeded_handler(request, exc)


async def on_http_error(request: Request, exc: StarletteHTTPException):
    # Routes report their own failures as HTTPException(500, ...). Log and alert
    # on those; 4xx (bad input, wrong password, not found) are normal.
    if exc.status_code >= 500:
        report_server_error(f"{request.method} {request.url.path}", str(exc.detail))
    return await http_exception_handler(request, exc)


async def on_unhandled_error(request: Request, exc: Exception):
    report_server_error(
        f"{request.method} {request.url.path}",
        f"{type(exc).__name__}: {exc}",
        traceback.format_exc(),
    )
    return JSONResponse(status_code=500, content={"detail": "server_error"})


@app.on_event("startup")
def _start_background_jobs():
    start_sweeper()
    try:
        ensure_dev_admin()
    except Exception:
        traceback.print_exc()


app.add_exception_handler(RateLimitExceeded, on_rate_limited)
app.add_exception_handler(StarletteHTTPException, on_http_error)
app.add_exception_handler(Exception, on_unhandled_error)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["POST", "GET", "DELETE", "PATCH", "PUT"],
    allow_headers=["*"],
)

app.include_router(projects_router, prefix="/api")
app.include_router(intake_router, prefix="/api")
app.include_router(contact_router, prefix="/api")
app.include_router(admin_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(field_router, prefix="/api")
app.include_router(account_router, prefix="/api")
app.include_router(users_router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


def _device(ua: str) -> str:
    ua = ua.lower()
    if "ipad" in ua or "tablet" in ua or ("android" in ua and "mobile" not in ua):
        return "tablet"
    if "mobi" in ua or "iphone" in ua or "android" in ua:
        return "phone"
    return "desktop"


def _browser(ua: str) -> str:
    ua = ua.lower()
    if "edg/" in ua:
        return "Edge"
    if "firefox" in ua or "fxios" in ua:
        return "Firefox"
    if "chrome" in ua or "crios" in ua:
        return "Chrome"
    if "safari" in ua:
        return "Safari"
    return "Other"


BOT_MARKERS = ("bot", "crawler", "spider", "slurp", "headless", "lighthouse", "preview")


@app.post("/api/track/visit", status_code=status.HTTP_204_NO_CONTENT)
async def track_visit(request: Request, payload: dict | None = None):
    """Page views for the Logs tab and weekly digest. No IP addresses stored."""
    payload = payload or {}
    ua = request.headers.get("user-agent", "")
    if not ua or any(m in ua.lower() for m in BOT_MARKERS):
        return None
    path = str(payload.get("path") or "/")[:300]
    referrer = str(payload.get("referrer") or "")[:500]
    log_event("page.visit", route=path, metadata={
        "path": path,
        "referrer": referrer,
        "device": _device(ua),
        "browser": _browser(ua),
    })
    return None
