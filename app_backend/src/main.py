from fastapi import FastAPI
from fastapi.responses import StreamingResponse
import uvicorn
import asyncio

from vectorDB import chatbox_pipeline
from pdf import dbx_handler, pdf

dbx = dbx_handler()
    
# chatbot = chatbox_pipeline()
# chatbot.setup_retriever()

app = FastAPI()

@app.get("/query")
async def query(query: str, embed_depth: int):
    chatbot = chatbox_pipeline()
    chatbot.setup_retriever()
    embeds = chatbot.retrieve(query, k=embed_depth)

    newdoc = pdf()
    for embed in embeds:
        doc_name = embed.metadata['Document']
        page_start = embed.metadata['page_start']
        page_end = embed.metadata['page_end']

        doc = dbx.get_pdf_document(doc_name)
        newdoc.insert_pages(doc, start=page_start, end=page_end)

    return StreamingResponse(chatbot.stream_response())

async def main():
    config = uvicorn.Config("main:app", port=8000, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())