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
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip)
