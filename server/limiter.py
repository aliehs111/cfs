from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def client_ip(request: Request) -> str:
    """The visitor's IP, not Railway's proxy.

    Behind Railway, request.client.host is the proxy, so every visitor would
    share one rate limit. Use the proxy's headers instead. The LAST entry of
    X-Forwarded-For is the one added by Railway's edge (earlier entries can be
    faked by the client).
    """
    # NOTE (Nov 20 2026): X-Real-IP is trusted first. That is only safe if
    # Railway's edge overwrites it on every request; if it passes a visitor's
    # own X-Real-IP through, a visitor could fake it and dodge every rate
    # limit. Not yet confirmed; check Railway's docs or send a request with a
    # made-up X-Real-IP and see what the server logs. Behavior left unchanged.
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)
