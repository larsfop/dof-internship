import psycopg
from uuid import uuid4
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from RAG.pydantic_classes import ResponseOutput
from ..cursor import CURSOR, CONNECTION
from ai_models import get_cache_embedding_model

logger = logging.getLogger("database")

embed_model = get_cache_embedding_model()

def new_semantic_cache(prompt: str, response: "ResponseOutput") -> None:
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
                    "(cache_id, document_name, page_labels, page_indices) "
                    "VALUES (%s, %s, %s, %s)"
                ),
                (
                    uuid_str,
                    citation.document_name,
                    ';'.join(map(str, citation.page_labels)),
                    ';'.join(map(str, citation.page_indices))
                )
            )

        CONNECTION.commit()
        logger.info(f"Semantic cache entry added successfully.")
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception(f"Error adding semantic cache entry")