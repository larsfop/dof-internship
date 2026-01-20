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

from pdf import get_pdf_path
from logger.logger import Logger
from config.config import load_config, Config
from database import new_response, new_citation
from vector_store import query_cache, new_cache_entry
from user_authentication import login_for_access_token, get_current_user, create_new_user
from pydantic_classes import Token, UserInDB
from response_generation import generate_response


user_loggers = {}
def setup_logger(user_id: str) -> None:
    """
    Setup logging for a specific user.

    Args:
        user_id (str): The ID of the user.

    """

    # Create logger
    user_logger = logging.getLogger(f'user_{user_id}')
    user_logger.setLevel(logging.INFO)

    # Create console handler
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(user)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        defaults={'user': user_id}
    ))
    user_logger.addHandler(handler)

    # Create file handler
    handler = logging.FileHandler(f'logs/users/{user_id}/app.log', mode='a', encoding='utf-8')
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(levelname)s - %(user)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S',
        defaults={'user': user_id}
    ))
    user_logger.addHandler(handler)

    user_loggers[user_id] = user_logger


# os.environ['PYTHONUNBUFFERED'] = '1'

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def dict_factory(cursor, row):
    fields = [column[0] for column in cursor.description]
    return {key: value for key, value in zip(fields, row)}


DATA_PATH = os.environ['DATA_PATH']
CONNECTION = sqlite3.connect(DATA_PATH + 'app.db', check_same_thread=False)
CONNECTION.row_factory = dict_factory
CURSOR = CONNECTION.cursor()

CONFIG: Config = load_config(DATA_PATH + 'config.yaml')


@app.post("/token")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    return login_for_access_token(form_data)


# @app.get("/users/me/", response_model=UserInDB)
# async def read_users_me(
#     current_user: Annotated[UserInDB, Depends(get_current_user)],
# ) -> UserInDB:
#     return current_user


@app.get('/prompt')
def prompt(
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
def get_pdf(
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
def create_user(
    user: Annotated[UserInDB, Depends(get_current_user)],
    username: str, 
    password: str, 
    user_id: str|None = None
):
    create_new_user(username, password, user_id)
    

@app.get('/get_sessions')
def get_sessions(
    user: Annotated[UserInDB, Depends(get_current_user)]
):
    try:
        CURSOR.execute("SELECT sessionID, name FROM sessions WHERE userID = ? ORDER BY updatedAt DESC", (user.userID,))
        sessions = CURSOR.fetchall()
        return sessions
    except sqlite3.Error as e:
        return e
    

@app.get('/get_chat')
def get_chat(
    user: Annotated[UserInDB, Depends(get_current_user)],
    session_id: str
):
    try:
        responses = CURSOR.execute("""
            SELECT 
                r.prompt, 
                r.response,
                COALESCE(
                    json_group_array(
                        CASE
                            WHEN c.responseID IS NOT NULL THEN
                                json_object(
                                    'documentName', c.documentName,
                                    'pageLabels', c.pageLabels,
                                    'pdfPages', c.pdfPages
                                )
                        END
                    ),
                    '[]'
                ) AS citations
            FROM responses r
            LEFT JOIN citations c
                ON r.responseID = c.responseID
            WHERE r.sessionID = ?
            GROUP BY r.responseID
            ORDER BY r.timestamp
            """,
            (session_id,)
        ).fetchall()

        for row in responses:
            row['citations'] = json.loads(row['citations'])
            
            # Handle case where there are no citations
            if row['citations'][0] is None:
                row['citations'] = []

        return responses
    except sqlite3.Error as e:
        return e
    

@app.get('/remove_session')
def remove_session(
    user: Annotated[UserInDB, Depends(get_current_user)],
    session_id: str,
):
    try:
        CURSOR.execute("DELETE FROM responses WHERE sessionID = ?", (session_id,))
        CURSOR.execute("DELETE FROM sessions WHERE sessionID = ?", (session_id,))
        CONNECTION.commit()
        return {"status": "success", "message": f"Session with ID '{session_id}' and its responses removed successfully."}
    except sqlite3.Error as e:
        return {"status": "error", "message": str(e)}
    

async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())