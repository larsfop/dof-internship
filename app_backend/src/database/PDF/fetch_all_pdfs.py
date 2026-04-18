import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def fetch_all_pdfs() -> list[dict[str, str]]:
    try:
        data = CURSOR.execute(
            """
                SELECT
                    id,
                    document_name,
                    document_path,
                    category
                FROM pdfs
        """
        ).fetchall()
        return data
    except psycopg.Error:
        logger.exception("Error fetching all PDFs")
        CONNECTION.rollback()
        return []