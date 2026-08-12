from pydantic import BaseModel, EmailStr
from typing import Optional

class User(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserInDB(User):
    id: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str