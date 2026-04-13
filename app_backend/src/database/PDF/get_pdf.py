import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def get_pdf(filename: str) -> dict[str, str]|None:
    try:
        data = CURSOR.execute(
            "SELECT * FROM pdfs WHERE documentName = %s",
            (filename,)
        ).fetchone()
        if data:
            return data
        else:
            logger.warning(f"PDF with name '{filename}' not found in database.")
            return None
    except psycopg.Error:
        logger.exception("Error fetching PDF path")
        CONNECTION.rollback()
        return None