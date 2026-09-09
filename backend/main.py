import logging
import os
import uuid
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exception_handlers import http_exception_handler
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from backend.routes import user_routes
from backend.data_managment import router as data_router
from backend.data_managment import init_connection_pool

logger = logging.getLogger(__name__)

app = FastAPI()

# Same ceiling as the Upload page check (200 MB), enforced server-side so a
# direct API call cannot bypass the browser limit.
MAX_REQUEST_BYTES = 200 * 1024 * 1024

# Dev setup: the CRA server (3000) calls the API (8000), so those two are a
# legitimate cross-origin pair. The production entry point is listed too, so
# the origin is trusted even if a reverse proxy rewrites the Host header.
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://46.62.212.226",
]

# Extra production origins, e.g. CSRF_TRUSTED_ORIGINS=https://my-domain.com
_EXTRA_TRUSTED_ORIGINS = {
    origin.strip().rstrip("/").lower()
    for origin in os.getenv("CSRF_TRUSTED_ORIGINS", "").split(",")
    if origin.strip()
}

CSRF_PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def handle_options(request: Request, call_next):
    if request.method == "OPTIONS":
        return JSONResponse(status_code=200)
    return await call_next(request)


@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared = int(content_length)
        except ValueError:
            declared = 0
        if declared > MAX_REQUEST_BYTES:
            return JSONResponse(
                status_code=413,
                content={
                    "detail": "File is too large. Maximum allowed size is 200 MB."
                },
            )
    return await call_next(request)


def _request_origin(request: Request) -> str | None:
    """Origin of the caller, as reported by the browser itself.

    The Origin header cannot be forged from JavaScript, which is what makes it
    usable as a CSRF signal. Referer is only a fallback for the rare browsers
    that omit Origin on same-origin requests.
    """
    origin = request.headers.get("origin")
    if origin:
        return origin.strip().rstrip("/").lower()

    referer = request.headers.get("referer")
    if referer:
        parts = urlsplit(referer.strip())
        if parts.scheme and parts.netloc:
            return f"{parts.scheme}://{parts.netloc}".lower()

    return None


def _is_trusted_origin(origin: str, request: Request) -> bool:
    if origin in _EXTRA_TRUSTED_ORIGINS or origin in {
        o.lower() for o in ALLOWED_ORIGINS
    }:
        return True

    # Same-origin call: covers production behind Nginx without any config,
    # since Nginx forwards the public Host header.
    host = (request.headers.get("host") or "").strip().lower()
    return bool(host) and urlsplit(origin).netloc == host


@app.middleware("http")
async def verify_request_origin(request: Request, call_next):
    """CSRF guard: refuse state-changing calls coming from another site.

    Complements the SameSite=Lax cookie by enforcing the check server-side,
    so protection survives a future move to SameSite=None (separate domains).
    """
    if request.method in CSRF_PROTECTED_METHODS:
        origin = _request_origin(request)
        # No Origin and no Referer means a non-browser client (curl, tests).
        # A browser always sends one on these methods, so an attacker cannot
        # reach this branch to bypass the check.
        if origin is not None and not _is_trusted_origin(origin, request):
            return JSONResponse(
                status_code=403,
                content={"detail": "Request blocked: untrusted origin."},
            )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Set-Cookie"]
)

@app.exception_handler(StarletteHTTPException)
async def sanitize_server_errors(request: Request, exc: StarletteHTTPException):
    """Keep raw exception text server-side on 5xx, return a reference instead.

    Handlers across the codebase pass `str(e)`, `e.pgerror` or a traceback as
    the 500 detail, which exposes SQL, table names and filesystem paths.
    Statuses below 500 are untouched: those messages are deliberate user
    feedback and the frontend keys some of its logic on them.
    """
    if exc.status_code < 500:
        return await http_exception_handler(request, exc)

    reference = uuid.uuid4().hex[:12]
    logger.error(
        "Server error %s on %s %s: %s",
        reference,
        request.method,
        request.url.path,
        exc.detail,
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": "An internal error occurred. Please try again.",
            "reference": reference,
        },
    )


@app.exception_handler(Exception)
async def sanitize_unhandled_errors(request: Request, exc: Exception):
    reference = uuid.uuid4().hex[:12]
    logger.exception(
        "Unhandled error %s on %s %s", reference, request.method, request.url.path
    )
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred. Please try again.",
            "reference": reference,
        },
    )


@app.on_event("startup")
async def startup_event():
    init_connection_pool()
    print("✅ Startup + CORS chargé")

# Routes
app.include_router(user_routes.router, prefix="/api/users")
app.include_router(data_router)

@app.get("/")
def read_root():
    return {"message": "Bienvenue sur l'API"}
