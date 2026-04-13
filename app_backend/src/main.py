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
from database import delete_session, fetch_all_pdfs, get_sessions, get_chat, update_session_name, get_pdf
from RAG import generate_response
from document_processing import chunk_and_store_document

logger = logging.getLogger('main')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get('/prompt')
async def prompt(
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
async def app_get_pdf(
    name: str
):
    pdf_path = get_pdf_path(name)
    with pymupdf.open(pdf_path) as doc:
        pdf_bytes = doc.tobytes()

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
    )
    

@app.get('/get_sessions')
async def app_get_sessions(
    user_id: str|None = None,
):
    return get_sessions(user_id)
    

@app.get('/get_chat')
async def app_get_chat(
    session_id: str
):
    return get_chat(session_id)
    

@app.get('/remove_session')
async def app_remove_session(
    session_id: str,
):
    return delete_session(session_id)


@app.post('/update_session_name')
def app_update_session_name(
    session_id: str,
    new_name: str
):
    update_session_name(session_id, new_name)
    return {"message": f"Session with ID '{session_id}' renamed to '{new_name}' successfully."}


@app.get('/get_pdf')
async def app_get_pdf(
    filename: str
):
    return get_pdf(filename)


@app.get('/fetch_all_pdfs')
async def app_fetch_all_pdfs():
    return fetch_all_pdfs()


file_path = Path(os.environ["MOUNT_PATH"])
@app.post('/process_pdf')
async def app_process_pdf(
    filename: str,
) -> None:
    files = file_path.rglob(filename)
    for file in files:
        chunk_and_store_document(file)


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())