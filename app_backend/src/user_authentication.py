from typing import Annotated
import jwt
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash
import os
from uuid import uuid4
from fastapi import HTTPException, status, Depends
from fastapi.security import OAuth2PasswordBearer

from pydantic_classes import Token, TokenData, User, UserInDB
from database import fetch_user, create_user


password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password, hashed_password) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password) -> str:
    return password_hash.hash(password)


def authenticate_user(username: str, password: str) -> UserInDB|bool:
    user = fetch_user(username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, os.environ['API_SECRET_KEY'], algorithm=os.environ['API_ALGORITHM'])
    return encoded_jwt


def login_for_access_token(form_data) -> Token:
    user = authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username}
    )
    return Token(user_id=user.userID, access_token=access_token, token_type="bearer")


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> UserInDB:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    print(f"Decoding token: {token}", flush=True)
    try:
        payload = jwt.decode(token, os.environ['API_SECRET_KEY'], algorithms=[os.environ['API_ALGORITHM']])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except InvalidTokenError:
        raise credentials_exception
    user = fetch_user(username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


def create_new_user(username: str, password: str, user_id: str|None = None) -> None:
    create_user(
        uuid4() if user_id is None else user_id,
        username,
        get_password_hash(password)
    )