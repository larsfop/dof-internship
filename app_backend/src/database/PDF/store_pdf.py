import psycopg
import logging

from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def store_pdf(name: str, path: str, category: str | None = None) -> None:
    try:
        CURSOR.execute(
            """
                INSERT INTO pdfs (id, documentName, documentPath, category)
                VALUES (gen_random_uuid(), %s, %s, %s)
                ON CONFLICT (documentName) DO UPDATE SET documentPath = EXCLUDED.documentPath, category = EXCLUDED.category;
            """,
            (name, path, category)
        )
        CONNECTION.commit()
    except psycopg.Error:
        logger.exception(f"Error storing PDF '{name}' in database.")
        CONNECTION.rollback()