
import io
from contextlib import redirect_stdout, redirect_stderr

f = io.StringIO()

with redirect_stdout(f), redirect_stderr(f):
    import sqlite3
    import json
    from fastapi import FastAPI, Response, Depends, status, HTTPException
    from fastapi.responses import StreamingResponse
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
    import jwt
    from jwt.exceptions import InvalidTokenError
    from pwdlib import PasswordHash
    import uvicorn
    import asyncio
    import os
    from langchain_core.documents import Document
    import logging
    from pymilvus import MilvusClient, MilvusException, DataType
    import pymupdf
    from typing import Annotated
    from pydantic import BaseModel

    from vectorDB import setup_RAG, retrieve_documents, generate_response, generate_session_name
    from pdf import dbx_handler, pdf, get_pdf_path
    from logger.logger import Logger
    from config.config import load_config, Config
    from database import new_response, new_citation
    from vector_store import query_cache, new_cache_entry


os.environ['PYTHONUNBUFFERED'] = '1'

# SECRET_KEY = 'f185065827e4120fd9f1e8724f633e2676a883e49df2b34fb1865fcd3b979fb6'
SECRET_KEY = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
ALGORITHM = 'HS256'


users = {
    "test_user": {
        "username": "test_user",
        "hashed_password": "$argon2id$v=19$m=65536,t=3,p=4$wagCPXjifgvUFBzq4hqe3w$CYaIb8sB+wtD+Vu/P4uod1+Qof8h+1g7bbDlBID48Rc",
    }
}

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


class User(BaseModel):
    username: str


class UserInDB(User):
    hashed_password: str


password_hash = PasswordHash.recommended()

app = FastAPI()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

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
RETRIEVER, LLM_MODELS, RERANK_CHAIN = setup_RAG(CONFIG.rag_config)


def verify_password(plain_password, hashed_password):
    return password_hash.verify(plain_password, hashed_password)


def get_password_hash(password):
    return password_hash.hash(password)


def get_user(db, username: str):
    if username in db:
        user_dict = db[username]
        return UserInDB(**user_dict)
    

def authenticate_user(db, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except InvalidTokenError:
        raise credentials_exception
    user = get_user(users, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return current_user


@app.post("/token")
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
) -> Token:
    user = authenticate_user(users, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(
        data={"sub": user.username}
    )
    return Token(access_token=access_token, token_type="bearer")


@app.get("/users/me/", response_model=User)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    return current_user


@app.get("/users/me/items/")
async def read_own_items(
    current_user: Annotated[User, Depends(get_current_active_user)],
):
    return [{"item_id": "Foo", "owner": current_user.username}]


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


async def stream_handler(stream, prompt: str, user_id: str, session_id: str, session_name: str, model: str, cache: bool):
    async for event in stream:
        output = stream_event_handler(event)
        if output is None:
            continue

        if event['event'] == 'on_chat_model_end':
            print('Response generation completed.', flush=True)
            response = event['data']['output'].content

            if session_name.strip() == '':
                session_name = generate_session_name(LLM_MODELS[model], prompt + '\n' + response)

            new_response(
                user_id=user_id,
                session_id=session_id,
                response_id=event['run_id'],
                session_name=session_name,
                prompt=prompt,
                response=response
            )

            if cache:
                new_cache_entry(prompt, response, CONFIG.rag_config)

            output['session_name'] = session_name
            
        yield json.dumps(output) + '\n'


@app.get("/query")
async def query(
    token: Annotated[str, Depends(oauth2_scheme)],
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

    pdf_data = retrieve_documents(
        RETRIEVER, 
        prompt, 
        embed_depth,
        rerank=RERANK_CHAIN
    )

    response = generate_response(
        prompt,
        LLM_MODELS[model],
        pdf_data
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
def get_pdf(name: str):
    pdf_path = get_pdf_path(name)
    with pymupdf.open(pdf_path) as doc:
        pdf_bytes = doc.tobytes()

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
    )


@app.get('/connect')
def connect(url: str):
    try:
        sqlite3.connect(url)
        return {"status": "success", "message": "Database connection successful."}
    except sqlite3.Error as e:
        return {"status": "error", "message": str(e), "url": url}


@app.get('/create_user')
def create_user(userID: str, username: str):
    try:
        CURSOR.execute("INSERT INTO users (userID, username) VALUES (?, ?)", (userID, username))
        CONNECTION.commit()
        return {"status": "success", "message": f"User '{username}' with ID '{userID}' added successfully."}
    except sqlite3.IntegrityError:
        return {"status": "warning", "message": f"User '{username}' with ID '{userID}' already exists."}
    

@app.get('/get_sessions')
def get_sessions(user_id: str):
    try:
        CURSOR.execute("SELECT sessionID, name FROM sessions WHERE userID = ? ORDER BY updatedAt DESC", (user_id,))
        sessions = CURSOR.fetchall()
        return sessions
    except sqlite3.Error as e:
        return e
    

@app.get('/get_chat')
def get_chat(session_id: str):
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
def remove_session(session_id: str):
    try:
        CURSOR.execute("DELETE FROM responses WHERE sessionID = ?", (session_id,))
        CURSOR.execute("DELETE FROM sessions WHERE sessionID = ?", (session_id,))
        CONNECTION.commit()
        return {"status": "success", "message": f"Session with ID '{session_id}' and its responses removed successfully."}
    except sqlite3.Error as e:
        return {"status": "error", "message": str(e)}
    

@app.get("/")
def root(
    user: Annotated[User, Depends(get_current_active_user)]
):
    return {"status": "ok"}


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())