import sqlite3
import json
from fastapi import FastAPI, Response, Depends, status, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
import uvicorn
import asyncio
import os
import logging
import pymupdf
from typing import Annotated
from pathlib import Path

from pdf import get_pdf_path
from logger.logger import setup_logger
from database import delete_session, get_sessions, get_chat, update_session_name
from user_authentication import login_for_access_token, get_current_user, create_new_user
from pydantic_classes import Token, UserInDB
from response_generation import generate_response

setup_logger(Path(os.environ['DATA_PATH']) / 'configs/logger_config.toml')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/token")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    return login_for_access_token(form_data)


@app.get('/prompt')
async def prompt(
    user: Annotated[UserInDB, Depends(get_current_user)],
    prompt: str, 
    user_id: str = 'test_user',
    session_id: str = 'test_session',
):
    response = generate_response(
        prompt,
        user_id,
        session_id
    )
    return StreamingResponse(response, media_type='text/event-stream')


@app.get("/pdf")
async def get_pdf(
    user: Annotated[UserInDB, Depends(get_current_user)],
    name: str
):
    pdf_path = get_pdf_path(name)
    with pymupdf.open(pdf_path) as doc:
        pdf_bytes = doc.tobytes()

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
    )


@app.get('/create_user')
async def create_user(
    user: Annotated[UserInDB, Depends(get_current_user)],
    username: str, 
    password: str, 
    user_id: str|None = None
):
    create_new_user(username, password, user_id)
    

@app.get('/get_sessions')
async def app_get_sessions(
    user: Annotated[UserInDB, Depends(get_current_user)]
):
    return get_sessions(user.userID)
    

@app.get('/get_chat')
async def app_get_chat(
    user: Annotated[UserInDB, Depends(get_current_user)],
    session_id: str
):
    return get_chat(session_id)
    

@app.get('/remove_session')
async def app_remove_session(
    user: Annotated[UserInDB, Depends(get_current_user)],
    session_id: str,
):
    return delete_session(session_id)


@app.post('/update_session_name')
def app_update_session_name(
    user: Annotated[UserInDB, Depends(get_current_user)],
    session_id: str,
    new_name: str
):
    update_session_name(session_id, new_name)
    return {"message": f"Session with ID '{session_id}' renamed to '{new_name}' successfully."}


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())