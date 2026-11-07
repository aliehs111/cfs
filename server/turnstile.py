"""Cloudflare Turnstile bot check (specs.md §5).

The page gets a one-time token from Cloudflare (usually invisibly) and sends it
with the form. We ask Cloudflare whether it's valid before saving anything or
calling Claude.

Railway variable (cfs-server): TURNSTILE_SECRET_KEY.
If it isn't set, checks are skipped (so local development works without keys)
and a warning is logged once. Production must have it set.

Cloudflare's test keys, for local development:
  site key   1x00000000000000000000AA              (client: always passes)
  secret     1x0000000000000000000000000000000AA   (server: always passes)
  secret     2x0000000000000000000000000000000AA   (server: always fails)
"""

import os
import traceback

import httpx
from fastapi import HTTPException

from logger import log_event

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
_warned = False


def configured() -> bool:
    return bool(os.environ.get("TURNSTILE_SECRET_KEY"))


async def require_human(token: str | None, ip: str, route: str) -> None:
    """Raise 400 unless Cloudflare confirms the token. No-op if not configured."""
    global _warned
    secret = os.environ.get("TURNSTILE_SECRET_KEY")
    if not secret:
        if not _warned:
            _warned = True
            print("TURNSTILE_SECRET_KEY not set: bot checks are OFF")
            log_event("spam.check_disabled", level="warning", route=route,
                      message="TURNSTILE_SECRET_KEY is not set, so bot checks are off")
        return

    if not token:
        _reject(route, "missing token")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            res = await client.post(VERIFY_URL, data={"secret": secret, "response": token, "remoteip": ip})
            result = res.json()
    except Exception:
        # If Cloudflare itself is unreachable, let real people through rather
        # than losing a lead; the honeypot and rate limits still apply.
        traceback.print_exc()
        log_event("spam.check_unavailable", level="warning", route=route,
                  message="Could not reach Cloudflare Turnstile; allowed the request")
        return
    if not result.get("success"):
        _reject(route, ", ".join(result.get("error-codes") or []) or "failed")


def _reject(route: str, reason: str) -> None:
    log_event("spam.rejected", level="warning", route=route, message=f"Bot check failed: {reason}")
    raise HTTPException(
        status_code=400,
        detail="We couldn't confirm you're not a bot. Please refresh the page and try again.",
    )
