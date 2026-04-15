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
from database import delete_session, fetch_all_pdfs, get_sessions, get_chat, update_session_name, fetch_pdfs, clear_pdf_from_store
from RAG import generate_response
from document_processing import chunk_and_store_document
from config import add_filename_to_config, CONFIG

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
    return fetch_pdfs(filename)


@app.get('/fetch_all_pdfs')
async def app_fetch_all_pdfs():
    return fetch_all_pdfs()


file_path = Path(os.environ["MOUNT_PATH"])
@app.post('/process_pdf')
async def app_process_pdf(
    filename: str,
):
    files = file_path.rglob(filename)
    for file in files:
        chunk_and_store_document(file)
    return {"message": f"PDF '{filename}' processed and stored successfully."}


@app.post('/remove_pdf')
async def app_remove_pdf(
    name: str,
):
    pdfs = fetch_pdfs(name)
    if not pdfs:
        return {"message": f"No PDF found with name '{name}'."}

    # for pdf in pdfs:
    #     clear_pdf_from_store(pdf['documentname'][:-4])

    documents = CONFIG.partition.documents
    old_files = set()
    for i, doc in enumerate(documents):
        files = file_path.rglob(doc)

        relevant_files = [
            file for file in files if not file.name in old_files
        ]
        if not relevant_files:
            logger.warning(f"No files found matching '{doc}' on mount '{file_path}'.")
            continue

        for pdf in pdfs:
            if not pdf['documentname'] in relevant_files:
                break
        else:
            logger.info(f"documents in config '{doc}' removed from store.")
    
    return {"message": f"PDF '{name}' removed successfully."}


@app.post("/store_pdfs")
async def app_store_pdfs(
    filename: str,
):
    if not filename.endswith('.pdf'):
        filename += '.pdf'

    files = list(file_path.rglob(filename))
    logger.info(f"Found {len(files)} files matching '{filename}'")
    if not files:
        logger.warning(f"No files found matching '{filename}' on mount '{file_path}'.")
        return {"message": f"No PDFs found with name '{filename}'."}

    old_files = fetch_all_pdfs()
    old_files = [file["name"] for file in old_files]

    n_new_files = 0
    for file in files:
        if file.name in old_files:
            logger.info(f"PDF '{file.name}' already exists in the database. Skipping.")
            continue
        chunk_and_store_document(file.name)
        n_new_files += 1

    if n_new_files > 0:
        add_filename_to_config(filename)

    logger.info(f"Processed {n_new_files} new files.")
    return {"message": f"PDF '{filename}' processed and stored successfully."}


@app.post("/process_all_pdfs")
def app_process_all_pdfs():
    documents = CONFIG.partition.documents

    processed_files = []
    for doc in documents:
        files = file_path.rglob(doc)

        for file in files:
            if file.name in processed_files:
                logger.info(f"PDF '{file.name}' already processed. Skipping.")
                continue

            chunk_and_store_document(file)
            processed_files.append(file.name)

    logger.info(f"Processed {len(processed_files)} files.")

    return {"message": "All PDFs processed and stored successfully."}


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())