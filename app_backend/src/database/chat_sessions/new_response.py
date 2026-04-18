from datetime import datetime
import logging
import psycopg
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def new_response(user_id: str, session_id: str, response_id: str, session_name: str, prompt: str, response: str, cache_id: str | None = None) -> None:
    date_time = datetime.now().isoformat()
    new_session(session_id, user_id, session_name, date_time)

    try:
        CURSOR.execute("UPDATE sessions SET updated_at = %s WHERE session_id = %s", (date_time, session_id))
        CURSOR.execute(
            """
                INSERT INTO responses (response_id, session_id, prompt, response, cache_id, timestamp)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (response_id) 
                DO UPDATE SET prompt = EXCLUDED.prompt, response = EXCLUDED.response, cache_id = EXCLUDED.cache_id
            """,
            (response_id, session_id, prompt, response, cache_id, date_time)
        )
        CONNECTION.commit()
        logger.info(f"Response with ID \'{response_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Error adding response with ID \'{response_id}\'")
        CONNECTION.rollback()


def new_session(session_id: str, user_id: str, name: str, date_time: str|None = None) -> None:
    date_time = datetime.now().isoformat() if date_time is None else date_time
    try:
        CURSOR.execute(
            """
                INSERT INTO sessions (session_id, user_id, name, created_at, updated_at) 
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO NOTHING
            """,
            (session_id, user_id, name, date_time, date_time)
        )
        CONNECTION.commit()
        logger.info(f"Session \'{name}\' with ID \'{session_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Error adding session \'{name}\' with ID \'{session_id}\'")
        CONNECTION.rollback()