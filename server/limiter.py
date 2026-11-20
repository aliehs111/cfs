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
    # Tested on Railway Nov 20 2026: a request sent with a made-up
    # "X-Real-IP: 1.2.3.4" still arrived with the visitor's real IP, so
    # Railway's edge overwrites X-Real-IP and it can't be faked. (The last
    # X-Forwarded-For entry turned out to be a Railway edge address, not the
    # visitor, so the fallback below would be wrong on Railway; it is only
    # reached if X-Real-IP is ever missing, e.g. a different host.)
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)
