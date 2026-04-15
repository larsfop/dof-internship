import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def fetch_pdfs(filename: str) -> list[dict[str, str]]|None:
    try:
        data = CURSOR.execute(
            "SELECT * FROM pdfs WHERE documentName LIKE %s",
            (f'{filename}%',)
        ).fetchall()
        if data:
            return data
        else:
            logger.warning(f"PDF with name '{filename}' not found in database.")
            return None
    except psycopg.Error:
        logger.exception("Error fetching PDF path")
        CONNECTION.rollback()
        return None