from fastapi import FastAPI, Response
from fastapi.responses import StreamingResponse, FileResponse
import uvicorn
import asyncio

from vectorDB import chatbot_pipeline
from pdf import dbx_handler, pdf

dbx = dbx_handler()

chatbot = chatbot_pipeline()
chatbot.setup_retriever()

app = FastAPI()

@app.get("/query")
async def query(query: str, embed_depth: int):
    pdf_data = None
    if embed_depth > 0:
        embeds = chatbot.retrieve(query, k=embed_depth)

        newdoc = pdf()
        for embed in embeds:
            doc_name = embed.metadata['Document']
            pages = embed.metadata['pages']

            doc = dbx.get_pdf_document(doc_name)
            newdoc.insert_pages(doc, list(map(int, pages.split(';'))))

        pdf_data = newdoc.as_base64()

    return StreamingResponse(
        chatbot.response(query, pdf_data),
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
    

async def main():
    config = uvicorn.Config("main:app", port=8000, log_level="info", reload=True)
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(main())