import psycopg
from uuid import uuid4
from langchain_openai import OpenAIEmbeddings
import logging

from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

embed_model = OpenAIEmbeddings(model='text-embedding-3-small')

def new_semantic_cache(prompt: str, response) -> None:
    uuid_str = str(uuid4())
    prompt = prompt.lower()
    embeddings = embed_model.embed_query(prompt)
    try:
        CURSOR.execute(
            (
                "INSERT INTO semantic_cache "
                "(id, prompt, response, summary_title, embedding) "
                "VALUES (%s, %s, %s, %s, %s)"
            ),
            (uuid_str, prompt, response.response, response.summary_title, embeddings)
        )
        
        for citation in response.citations:
            CURSOR.execute(
                (
                    "INSERT INTO cache_citations "
                    "(cacheID, documentName, pageLabels, pdfPages) "
                    "VALUES (%s, %s, %s, %s)"
                ),
                (
                    uuid_str,
                    citation.documentName,
                    ';'.join(map(str, citation.pageLabels)),
                    ';'.join(map(str, citation.pdfPages))
                )
            )

        CONNECTION.commit()
        logger.info(f"Semantic cache entry added successfully.")
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception(f"Error adding semantic cache entry")