import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def get_sessions(user_id: str) -> list[dict]:
    if not user_id:
        logger.error("User ID is None or empty when fetching sessions.")
        return []
    try:
        CURSOR.execute(
            "SELECT session_id, name, created_at, updated_at FROM sessions WHERE user_id = %s ORDER BY updated_at ASC",
            (user_id,)
        )
        sessions = CURSOR.fetchall()
        return sessions
    except psycopg.Error:
        logger.exception("Error fetching sessions")
        CONNECTION.rollback()
        return []