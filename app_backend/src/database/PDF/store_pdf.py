import psycopg
import logging

from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def store_pdf(name: str, path: str, category: str | None = None) -> None:
    try:
        CURSOR.execute(
            """
                INSERT INTO pdfs (id, document_name, document_path, category)
                VALUES (gen_random_uuid(), %s, %s, %s)
                ON CONFLICT (document_name) DO UPDATE SET document_path = EXCLUDED.document_path, category = EXCLUDED.category;
            """,
            (name, path, category)
        )
        CONNECTION.commit()
    except psycopg.Error:
        logger.exception(f"Error storing PDF '{name}' in database.")
        CONNECTION.rollback()