import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def get_sessions(user_id: str) -> list[dict]:
    if not user_id:
        logger.error("User ID is None or empty when fetching sessions.")
        return []
    try:
        CURSOR.execute(
            "SELECT sessionID, name, createdAt, updatedAt FROM sessions WHERE userID = %s ORDER BY updatedAt ASC",
            (user_id,)
        )
        sessions = CURSOR.fetchall()
        return sessions
    except psycopg.Error:
        logger.exception("Error fetching sessions")
        CONNECTION.rollback()
        return []