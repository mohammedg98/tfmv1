from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import HTTPException, status
from dotenv import load_dotenv
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
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host or "unknown"
    return "unknown"


def check_login_rate_limit(request) -> None:
    """Raise 429 if this IP exceeded login attempts in the window."""
    ip = _client_ip(request)
    now = time.time()
    cutoff = now - _LOGIN_WINDOW_SECONDS
    recent = [t for t in _login_attempts[ip] if t > cutoff]
    _login_attempts[ip] = recent
    if len(recent) >= _LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many login attempts. Please try again in a few minutes.",
        )


def record_failed_login(request) -> None:
    ip = _client_ip(request)
    _login_attempts[ip].append(time.time())


def clear_login_attempts(request) -> None:
    ip = _client_ip(request)
    _login_attempts.pop(ip, None)
