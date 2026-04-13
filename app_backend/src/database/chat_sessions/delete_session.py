import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def delete_session(session_id: str) -> None:
    try:
        CURSOR.execute(
            """
                DELETE FROM citations c USING responses r
                WHERE c.responseID = r.responseID AND r.sessionID = %s
            """, 
            (session_id, )
        )
        CURSOR.execute("DELETE FROM responses WHERE sessionID = %s", (session_id,))
        CURSOR.execute("DELETE FROM sessions WHERE sessionID = %s", (session_id,))
        CONNECTION.commit()
        logger.info(f"Session with ID \'{session_id}\' deleted successfully.")
    except psycopg.Error:
        logger.exception(f"Error deleting session with ID \'{session_id}\'")
        CONNECTION.rollback()