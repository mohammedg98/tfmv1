from fastapi import APIRouter, HTTPException, status, Response, Request
from fastapi.security import HTTPBearer
from bson import ObjectId
from ..models.user import User, UserLogin
from ..utils.auth import (
    create_access_token,
    verify_token,
    cookie_secure,
    check_login_rate_limit,
    record_failed_login,
    clear_login_attempts,
    apply_login_backoff,
)
from ..utils.database import db
import bcrypt
import logging
from datetime import datetime

router = APIRouter()
security = HTTPBearer()

MIN_PASSWORD_LENGTH = 8

logger = logging.getLogger(__name__)


def _audit_ip(request) -> str:
    """Real client IP behind Nginx (X-Real-IP is set by the proxy, not the client)."""
    try:
        real_ip = request.headers.get("x-real-ip")
        if real_ip and real_ip.strip():
            return real_ip.strip()
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[-1].strip()
        if request.client:
            return request.client.host or "unknown"
    except Exception:
        pass
    return "unknown"


def _audit_auth(action: str, request, user_id: str = None, email: str = None) -> None:
    """Trace login attempts. Never raises."""
    ip = _audit_ip(request)
    logger.info("AUDIT action=%s user=%s ip=%s", action, user_id or email, ip)
    try:
        db.admin_audit.insert_one(
            {
                "action": action,
                "admin_id": user_id,
                "target": email,
                "result": "SUCCESS" if action.endswith("SUCCESS") else "FAILURE",
                "ip": ip,
                "timestamp": datetime.utcnow(),
                "details": {},
            }
        )
    except Exception as audit_err:
        logger.warning("Could not persist audit entry: %s", audit_err)


def _set_jwt_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="jwt",
        value=token,
        httponly=True,
        secure=cookie_secure(),
        samesite="Lax",
        max_age=24 * 60 * 60,
        path="/",
    )


def _clear_jwt_cookie(response: Response) -> None:
    response.delete_cookie(
        key="jwt",
        path="/",
        httponly=True,
        secure=cookie_secure(),
        samesite="Lax",
    )


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(user: User, request: Request):
    check_login_rate_limit(request)
    record_failed_login(request)

    if len(user.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )

    if db.users.find_one({"email": user.email}):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists. Please log in.",
        )

    hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
    user_dict = user.dict()
    user_dict["password"] = hashed_password.decode("utf-8")
    user_dict["is_admin"] = False

    result = db.users.insert_one(user_dict)
    return {"message": "Account created successfully", "id": str(result.inserted_id)}


@router.post("/login")
async def login(user: UserLogin, response: Response, request: Request):
    check_login_rate_limit(request, user.email)

    db_user = db.users.find_one({"email": user.email})
    if not db_user or not bcrypt.checkpw(
        user.password.encode("utf-8"), db_user["password"].encode("utf-8")
    ):
        record_failed_login(request, user.email)
        _audit_auth("LOGIN_FAILURE", request, None, user.email)
        await apply_login_backoff(request, user.email)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    clear_login_attempts(request, user.email)
    token = create_access_token({"userId": str(db_user["_id"])})
    _set_jwt_cookie(response, token)
    _audit_auth("LOGIN_SUCCESS", request, str(db_user["_id"]), user.email)
    return {"message": "Login successful"}


@router.get("/me")
async def get_current_user(request: Request):
    token = request.cookies.get("jwt")
    if not token:
        raise HTTPException(status_code=403, detail="User not authenticated")

    payload = verify_token(token)
    user_id = payload["userId"]

    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid userId format")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "name": user.get("name"),
        "email": user.get("email"),
        "id": str(user["_id"]),
    }


@router.get("/current-user3")
async def get_current_user3(request: Request):
    token = request.cookies.get("jwt")
    if not token:
        raise HTTPException(status_code=403, detail="User not authenticated")

    payload = verify_token(token)
    user_id = payload["userId"]

    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid userId format")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": user_id,
        "email": user.get("email"),
        "name": user.get("name"),
        "is_admin": user.get("is_admin", False),
    }


@router.get("/current-user")
async def get_current_user2(request: Request):
    token = request.cookies.get("jwt")
    if not token:
        raise HTTPException(status_code=403, detail="User not authenticated")

    payload = verify_token(token)
    user_id = payload["userId"]

    try:
        user = db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid userId format")

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user_id


@router.post("/logout")
async def logout(response: Response, request: Request):
    _clear_jwt_cookie(response)
    return {"message": "Logout successful"}


@router.get("/check-token")
async def check_token(request: Request):
    token = request.cookies.get("jwt")
    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    try:
        payload = verify_token(token)
        return {"valid": True, "userId": payload["userId"]}
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def get_user_from_db(user_id: str):
    """Fetch a user from the database."""
    try:
        return db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


@router.get("/check-admin")
async def check_admin_status(request: Request):
    token = request.cookies.get("jwt")
    if not token:
        return {"is_admin": False}

    try:
        payload = verify_token(token)
        user_id = payload["userId"]
        user = db.users.find_one({"_id": ObjectId(user_id)})

        return {
            "is_admin": user.get("is_admin", False) if user else False,
            "user_id": user_id,
        }
    except Exception:
        return {"is_admin": False}
