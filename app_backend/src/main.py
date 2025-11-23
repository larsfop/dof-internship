
import io
from contextlib import redirect_stdout, redirect_stderr

f = io.StringIO()

with redirect_stdout(f), redirect_stderr(f):
    import sqlite3
    from fastapi import FastAPI, Response
    from fastapi.responses import StreamingResponse
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
    import asyncio
    import os
    from langchain_core.documents import Document
    import logging
    from pymilvus import MilvusClient, MilvusException, DataType
    import argparse

    from vectorDB import chatbot_pipeline
    from pdf import dbx_handler, pdf
    from logger.logger import Logger

os.environ['PYTHONUNBUFFERED'] = '1'

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.environ['DATABASE_URL']
CONNECTION = sqlite3.connect(DATABASE_URL, check_same_thread=False)
CURSOR = CONNECTION.cursor()

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


def create_pdfs_from_embeddings(embeddings: list[Document]):
    map_func = lambda label, page: (label, int(page) + 1)
    page_corrections = {}

    newdoc = pdf()
    for i, embed in enumerate(embeddings):
        print(f'Processing embedding {i+1}/{len(embeddings)} for document:', embed.metadata['Document'], flush=True)
        doc_name = embed.metadata['Document']
        pages = embed.metadata['pages']
        page_labels = embed.metadata['page_labels']

        dbx = dbx_handler()
        doc = dbx.get_pdf_document(doc_name)
        newdoc.insert_pages(doc, list(map(int, pages.split(';'))))

        if doc_name not in page_corrections:
            page_corrections[doc_name] = {}

        page_corrections[doc_name].update(
            dict(
                map(
                    map_func,
                    page_labels.split(';'),
                    pages.split(';')
                )
            )
        )

    return newdoc, page_corrections


@app.get("/query")
async def query(
    prompt: str, 
    embed_depth: int = 0,
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

    chatbot = chatbot_pipeline()
    chatbot.setup_retriever()

    pdf_data = None
    page_corrections = None
    if embed_depth > 0:
        embeds = chatbot.retrieve(prompt, k=embed_depth)

        logger.log_vector_search(embeds)

        newdoc, page_corrections = create_pdfs_from_embeddings(embeds)
        pdf_data = newdoc.as_base64()

        logger.log_input_page_count(newdoc.page_count)

    return StreamingResponse(
        chatbot.response(
            prompt, 
            user_id,
            session_id,
            session_name,
            model, 
            pdf_data, 
            logger=logger, 
            page_corrections=page_corrections
        ),
        media_type='text/event-stream'
    )


@app.get("/pdf")
def get_pdf(name: str):
    dbx = dbx_handler()

    doc = dbx.get_pdf_document(name)
    pdf_bytes = doc.tobytes()
    doc.close()

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
        return [{"sessionID": s[0], "sessionName": s[1]} for s in sessions]
    except sqlite3.Error as e:
        return e
    

@app.get('/get_chat')
def get_chat(session_id: str):
    try:
        CURSOR.execute("SELECT prompt, response FROM responses WHERE sessionID = ? ORDER BY timestamp DESC", (session_id,))
        entries = CURSOR.fetchall()
        return [{"input": e[0], "output": e[1]} for e in entries]
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
def root():
    return {"status": "ok"}


def main_dev():
    DATABASE_URL = "sqlite:///app/data/app.db"
    con = sqlite3.connect(DATABASE_URL)

async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Start the backend server.")
    parser.add_argument(
        '--dev', action='store_true', help='Run the server in local development mode.' 
    )

    args = parser.parse_args()
    if args.dev:
        main_dev()
    else:
        asyncio.run(main())