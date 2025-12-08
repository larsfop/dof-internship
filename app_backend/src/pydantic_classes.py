from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    user_id: str
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


class User(BaseModel):
    userID: str
    username: str


class UserInDB(User):
    hashed_password: str