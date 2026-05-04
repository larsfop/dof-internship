from fastapi import FastAPI, Response, Depends, status, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import os
import logging
import pymupdf
from pathlib import Path

from database import delete_session, fetch_all_pdfs, get_sessions, get_chat, update_session_name, fetch_pdfs, clear_pdf_from_store, remove_from_semantic_cache
from RAG import generate_response
from document_processing import chunk_and_store_document
from config import CONFIG, add_filename_to_config, remove_filename_from_config 

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
    response_id: str|None = None,
    check_cache: bool = True,
):
    response = generate_response(
        prompt,
        user_id,
        session_id,
        response_id,
        check_cache,
    )
    return StreamingResponse(response, media_type='text/event-stream')


@app.get("/pdf")
async def app_get_pdf(
    name: str
):
    pdfs = fetch_pdfs(name)

    pdf_path = pdfs[0]['document_path']
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


@app.get('/remove_cache')
async def app_remove_cache(
    cache_id: str,
):
    remove_from_semantic_cache(cache_id)
    return {"message": f"Semantic cache entry with ID '{cache_id}' removed successfully."}


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


_file_path = Path(os.environ["MOUNT_PATH"])
@app.post('/remove_pdf')
async def app_remove_pdf(
    name: str,
):
    pdfs = fetch_pdfs(name)
    if not pdfs:
        return {"message": f"No PDF found with name '{name}'."}
    logger.info(f"Removing {len(pdfs)} PDFs with name '{name}' from store.")

    for pdf in pdfs:
        clear_pdf_from_store(pdf['document_name'][:-4])

    documents = CONFIG.partition.documents
    pdf_names = [pdf['document_name'] for pdf in pdfs]
    for doc in documents:
        files = list(_file_path.rglob(doc))

        if not files:
            logger.warning(f"No files found matching '{doc}' on mount '{_file_path}'.")
            continue

        for file in files:
            if not file.name in pdf_names:
                logger.info(f"'{doc}' not contributing to removed PDFs, skipping.")
                break
        else:
            logger.info(f"documents in config '{doc}' removed from store.")
            remove_filename_from_config(doc)
    
    return {"message": f"PDF '{name}' removed successfully."}


@app.post("/store_pdfs")
async def app_store_pdfs(
    filename: str,
    is_partitioning: bool = True,
    is_chunking: bool = True,
    is_vector_storing: bool = True,
    load_checkpoint: bool = True,
    recreate: bool = False
):
    if not filename.endswith('.pdf'):
        filename += '.pdf'

    files = list(_file_path.rglob(filename))
    logger.info(f"Found {len(files)} files matching '{filename}'")
    if not files:
        logger.warning(f"No files found matching '{filename}' on mount '{_file_path}'.")
        return {"message": f"No PDFs found with name '{filename}'."}

    old_files = fetch_all_pdfs()
    old_files = [file["document_name"] for file in old_files]

    n_new_files = 0
    for i, file in enumerate(files, start=1):
        logger.info(f"Processing file {i}/{len(files)}: '{file.name}'")

        if file.name in old_files and not recreate:
            logger.info(f"PDF '{file.name}' already exists in the database. Skipping.")
            continue
        token_quota_reached = chunk_and_store_document(
            file,
            is_partitioning,
            is_chunking,
            is_vector_storing,
            load_checkpoint
        )

        if token_quota_reached:
            break
        
        n_new_files += 1
        
    if token_quota_reached:
        return {"message": f"Token quota reached while processing '{filename}'. Processed {n_new_files} new files before reaching the limit."}

    if n_new_files > 0:
        add_filename_to_config(filename)
    else:
        logger.warning(f"All PDFs with name '{filename}' already exist in the database. No new files processed.")
        return {"message": f"All PDFs with name '{filename}' already exist. No new files processed."}

    logger.info(f"Processed {n_new_files} new files.")
    return {"message": f"PDF '{filename}' processed and stored successfully."}


@app.post("/process_all_pdfs")
def app_process_all_pdfs(
    is_partitioning: bool = True,
    is_chunking: bool = True,
    is_vector_storing: bool = True,
    load_checkpoint: bool = True,
    recreate: bool = False
):
    documents = CONFIG.partition.documents
    existing_pdfs = fetch_all_pdfs()
    existing_pdfs = [pdf["document_name"] for pdf in existing_pdfs]

    files: list[Path] = list(set().union(*[list(_file_path.rglob(doc)) for doc in documents]))
    processed_files = []
    for i, file in enumerate(files, start=1):
        logger.info(f"Processing file {i}/{len(files)}: '{file.name}'")

        # Skip already processed files
        if file.name in processed_files:
            continue

        # Skip files that exist in the database
        if file.name in existing_pdfs and not recreate:
            continue

        token_quota_reached = chunk_and_store_document(
            file,
            is_partitioning,
            is_chunking,
            is_vector_storing,
            load_checkpoint
        )
        processed_files.append(file.name)

        if token_quota_reached:
            break

    logger.info(f"Processed {len(processed_files)} files.")

    return {"message": "All PDFs processed and stored successfully."}


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())