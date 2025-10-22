from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import asyncio
import os
from uuid import uuid4
from langchain_core.documents import Document

from vectorDB import chatbot_pipeline
from pdf import dbx_handler, pdf
from logger.logger import Logger

os.environ['PYTHONUNBUFFERED'] = '1'

dbx = dbx_handler()

chatbot = chatbot_pipeline()
chatbot.setup_retriever()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def create_pdfs_from_embeddings(embeddings: list[Document]):
    map_func = lambda label, page: (label, int(page) + 1)
    page_corrections = {}

    newdoc = pdf()
    for embed in embeddings:
        doc_name = embed.metadata['Document']
        pages = embed.metadata['pages']
        page_labels = embed.metadata['page_labels']

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
    query: str, 
    embed_depth: int = 0,
    model: str = 'o4-mini',
    user_id: str = 'test_user',
    session_id: str = 'test_session',
    entry_id: str = 'test_entry'
):

    logger = Logger(user_id=user_id, session_id=session_id, entry_id=entry_id)
    pdf_data = None
    page_corrections = None
    if embed_depth > 0:
        embeds = chatbot.retrieve(query, k=embed_depth)

        logger.log_vector_search(embeds)

        newdoc, page_corrections = create_pdfs_from_embeddings(embeds)
        pdf_data = newdoc.as_base64()

        logger.log_input_page_count(newdoc.page_count)

    return StreamingResponse(
        chatbot.response(query, model, pdf_data, logger=logger, page_corrections=page_corrections),
        media_type='text/event-stream'
    )


@app.get("/pdf")
def get_pdf(name: str):
    doc = dbx.get_pdf_document(name)
    pdf_bytes = doc.tobytes()
    doc.close()

    return Response(
        content=pdf_bytes,
        media_type='application/pdf',
    )
    

@app.get("/")
def root():
    return {"status": "ok"}


async def main():
    config = uvicorn.Config("main:app", port=8015, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())