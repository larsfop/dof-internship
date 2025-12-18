
import io
from contextlib import redirect_stdout, redirect_stderr

f = io.StringIO()

# with redirect_stdout(f), redirect_stderr(f):
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

from vectorDB import generate_response_from_prompt
from pdf import dbx_handler, pdf, get_pdf_path
from logger.logger import Logger
from config.config import load_config, Config
from database import new_response, new_citation
from vector_store import query_cache, new_cache_entry
from user_authentication import login_for_access_token, get_current_user, create_new_user
from pydantic_classes import Token, UserInDB
from response_generation.response_generation import generate_response


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


os.environ['PYTHONUNBUFFERED'] = '1'

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
# RETRIEVER, LLM_MODELS, RERANK_CHAIN = setup_RAG(CONFIG.rag_config)


@app.post("/token")
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    return login_for_access_token(form_data)


@app.get("/users/me/", response_model=UserInDB)
async def read_users_me(
    current_user: Annotated[UserInDB, Depends(get_current_user)],
) -> UserInDB:
    return current_user


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
    return response


@app.get("/query")
async def query(
    user: Annotated[UserInDB, Depends(get_current_user)],
    prompt: str, 
    embed_depth: int = 0,
    cache: bool = False,
    model: str = 'o4-mini',
    user_id: str = 'test_user',
    session_id: str = 'test_session',
    session_name: str = '',
    entry_id: str = 'test_entry'
):
    if user_id not in user_loggers:
        os.makedirs(f'logs/users/{user_id}', exist_ok=True)
        setup_logger(user_id)

    logger = Logger(
        logger=user_loggers[user_id],
        user_id=user_id, 
        session_id=session_id, 
        entry_id=entry_id
    )
    logger.log_info(f'Initiating query - Prompt: {prompt} - Model: {model} - Embed Depth: {embed_depth}')

    if cache:
        cached_result = query_cache(prompt, CONFIG.rag_config)
        if cached_result is not None:
            content, score = cached_result
            return {
                'event': 'cached_response',
                'content': content,
                'score': score
            }

    response = generate_response_from_prompt(
        prompt,
        model,
        embed_depth,
    )

    new_response(
        user_id=user_id,
        session_id=session_id,
        response_id=response.response_metadata.run_id,
        session_name=session_name if session_name.strip() != '' else response.summary_title,
        prompt=prompt,
        response=response.content
    )

    for citation in response.citations:
        new_citation(
            response_id=response.response_metadata.run_id,
            document_name=citation.document_name,
            page_labels=';'.join(citation.page_labels),
            pdf_pages=','.join(map(str, citation.pdf_page_numbers))
        )

    return response


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
                json_group_array(
                    json_object(
                        'documentName', c.documentName,
                        'pageLabels', c.pageLabels,
                        'pdfPages', c.pdfPages
                    )
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
    

@app.get("/")
def root(
    user: Annotated[UserInDB, Depends(get_current_user)]
):
    return {"status": "ok"}


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())