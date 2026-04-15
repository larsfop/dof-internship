import psycopg
import logging
from ..cursor import CURSOR, CONNECTION
from config import CONFIG

logger = logging.getLogger("main")

def clear_pdf_from_store(filename: str):
    collection_name = CONFIG.rag.collection_name
    try:
        CURSOR.execute(
            """
                DELETE FROM langchain_pg_embedding
                WHERE collection_id = (
                    SELECT uuid FROM langchain_pg_collection WHERE name = %s
                ) 
                AND id LIKE %s;
            """,
            (collection_name, f'{filename}%')
        )

        CURSOR.execute(
            """
                DELETE FROM pdfs
                WHERE documentName LIKE %s;
            """,
            (f'{filename}%',)
        )

        CONNECTION.commit()
    except psycopg.Error:
        logger.exception(f"Error clearing vector store for document '{filename}' in collection '{collection_name}'.")
        CONNECTION.rollback()