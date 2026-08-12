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
)
from ..utils.database import db
import bcrypt

router = APIRouter()
security = HTTPBearer()

MIN_PASSWORD_LENGTH = 8


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
async def signup(user: User):
    if len(user.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )

    if db.users.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already in use")

    hashed_password = bcrypt.hashpw(user.password.encode("utf-8"), bcrypt.gensalt())
    user_dict = user.dict()
    user_dict["password"] = hashed_password.decode("utf-8")

    result = db.users.insert_one(user_dict)
    return {"message": "Account created successfully", "id": str(result.inserted_id)}


@router.post("/login")
async def login(user: UserLogin, response: Response, request: Request):
    check_login_rate_limit(request)

    db_user = db.users.find_one({"email": user.email})
    if not db_user or not bcrypt.checkpw(
        user.password.encode("utf-8"), db_user["password"].encode("utf-8")
    ):
        record_failed_login(request)
        raise HTTPException(status_code=401, detail="Invalid email or password")

    clear_login_attempts(request)
    token = create_access_token({"userId": str(db_user["_id"])})
    _set_jwt_cookie(response, token)
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
