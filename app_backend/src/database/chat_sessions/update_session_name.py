import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def update_session_name(session_id: str, new_name: str) -> None:
    try:
        CURSOR.execute(
            "UPDATE sessions SET name = %s WHERE sessionID = %s",
            (new_name, session_id)
        )
        CONNECTION.commit()
        logger.info(f"Session with ID \'{session_id}\' renamed to \'{new_name}\' successfully.")
    except psycopg.Error:
        logger.exception(f"Error renaming session with ID \'{session_id}\' to \'{new_name}\'")
        CONNECTION.rollback()
