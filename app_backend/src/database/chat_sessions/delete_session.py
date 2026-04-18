import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def delete_session(session_id: str) -> None:
    try:
        CURSOR.execute(
            """
                DELETE FROM citations c USING responses r
                WHERE c.response_id = r.response_id AND r.session_id = %s
            """, 
            (session_id, )
        )
        CURSOR.execute("DELETE FROM responses WHERE session_id = %s", (session_id,))
        CURSOR.execute("DELETE FROM sessions WHERE session_id = %s", (session_id,))
        CONNECTION.commit()
        logger.info(f"Session with ID \'{session_id}\' deleted successfully.")
    except psycopg.Error:
        logger.exception(f"Error deleting session with ID \'{session_id}\'")
        CONNECTION.rollback()