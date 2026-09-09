from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from dotenv import load_dotenv
import asyncio
import os
import time
from collections import defaultdict

load_dotenv(dotenv_path="backend/.env")

SECRET_KEY = os.getenv("JWT_SECRET")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 24 * 60

# Cookie Secure flag: set COOKIE_SECURE=true when serving over HTTPS
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() in ("1", "true", "yes")

# In-memory login rate limit: 5 attempts / 5 minutes per IP
_LOGIN_MAX_ATTEMPTS = 5
_LOGIN_WINDOW_SECONDS = 300
_login_attempts = defaultdict(list)

# Per-account limit: stops a distributed attack (many IPs, one target email).
# Threshold stays high on purpose so a real user typing a wrong password
# repeatedly is never locked out; the window is short and self-clearing.
_ACCOUNT_MAX_ATTEMPTS = 25
_ACCOUNT_WINDOW_SECONDS = 900
_account_attempts = defaultdict(list)

# Progressive delay after repeated failures: cheap for a human, expensive for
# a script. Capped so the UI never looks frozen.
_BACKOFF_FREE_ATTEMPTS = 2
_BACKOFF_MAX_SECONDS = 3.0

# Keys of IPs / emails that stopped attacking are dropped periodically so the
# dictionaries cannot grow without bound.
_PURGE_INTERVAL_SECONDS = 600
_last_purge = 0.0


def _account_key(email) -> str:
    return str(email or "").strip().lower()


def _recent(hits, window: float, now: float) -> list:
    cutoff = now - window
    return [t for t in hits if t > cutoff]


def _purge_stale(now: float) -> None:
    global _last_purge
    if now - _last_purge < _PURGE_INTERVAL_SECONDS:
        return
    _last_purge = now
    for store, window in ((_login_attempts, _LOGIN_WINDOW_SECONDS),
                          (_account_attempts, _ACCOUNT_WINDOW_SECONDS)):
        for key in [k for k, hits in store.items()
                    if not _recent(hits, window, now)]:
            store.pop(key, None)


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )


def cookie_secure() -> bool:
    return COOKIE_SECURE


def _client_ip(request) -> str:
    # Nginx overwrites X-Real-IP with $remote_addr (not client-controlled).
    real_ip = request.headers.get("x-real-ip")
    if real_ip and real_ip.strip():
        return real_ip.strip()
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        # Last hop is appended by our Nginx ($proxy_add_x_forwarded_for).
        return forwarded.split(",")[-1].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def check_login_rate_limit(request, email=None) -> None:
    """Raise 429 if this IP, or this target account, exceeded the window."""
    now = time.time()
    _purge_stale(now)

    ip = _client_ip(request)
    ip_recent = _recent(_login_attempts[ip], _LOGIN_WINDOW_SECONDS, now)
    _login_attempts[ip] = ip_recent
    if len(ip_recent) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in a few minutes.",
        )

    key = _account_key(email)
    if not key:
        return
    account_recent = _recent(_account_attempts[key], _ACCOUNT_WINDOW_SECONDS, now)
    _account_attempts[key] = account_recent
    if len(account_recent) >= _ACCOUNT_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts on this account. Please try again later.",
        )


def record_failed_login(request, email=None) -> None:
    now = time.time()
    _login_attempts[_client_ip(request)].append(now)
    key = _account_key(email)
    if key:
        _account_attempts[key].append(now)


def clear_login_attempts(request, email=None) -> None:
    _login_attempts.pop(_client_ip(request), None)
    key = _account_key(email)
    if key:
        _account_attempts.pop(key, None)


async def apply_login_backoff(request, email=None) -> None:
    """
    Sleep a little before answering a failed login. The first attempts are
    free, then the wait grows and is capped. Non-blocking (asyncio).
    """
    now = time.time()
    ip_fails = len(_recent(_login_attempts[_client_ip(request)],
                           _LOGIN_WINDOW_SECONDS, now))
    key = _account_key(email)
    account_fails = (
        len(_recent(_account_attempts[key], _ACCOUNT_WINDOW_SECONDS, now))
        if key
        else 0
    )
    fails = max(ip_fails, account_fails)
    if fails <= _BACKOFF_FREE_ATTEMPTS:
        return
    delay = min(0.5 * (2 ** (fails - _BACKOFF_FREE_ATTEMPTS - 1)),
                _BACKOFF_MAX_SECONDS)
    await asyncio.sleep(delay)
