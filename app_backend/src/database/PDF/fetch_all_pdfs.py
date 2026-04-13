import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def fetch_all_pdfs() -> list[dict[str, str]]:
    try:
        data = CURSOR.execute(
            """
                SELECT
                    id,
                    documentName as name,
                    documentPath as  path,
                    category
                FROM pdfs
        """
        ).fetchall()
        return data
    except psycopg.Error:
        logger.exception("Error fetching all PDFs")
        CONNECTION.rollback()
        return []