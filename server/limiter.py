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
    # visitor: the header arrived as "<visitor>, <Railway edge>". So the
    # fallback below takes the entry just before the last one. Entries before
    # that can be faked by the visitor. Only reached if X-Real-IP is ever
    # missing.)
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        hops = [h.strip() for h in forwarded.split(",") if h.strip()]
        if hops:
            return hops[-2] if len(hops) >= 2 else hops[0]
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)
