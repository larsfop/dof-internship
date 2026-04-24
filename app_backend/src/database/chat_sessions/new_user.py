import logging
import psycopg
from ..cursor import CURSOR, CONNECTION

def new_user(user_id: str) -> None:
    try:
        CURSOR.execute(
            """
                INSERT INTO users (user_id) 
                VALUES (%s)
                ON CONFLICT (user_id) DO NOTHING
            """,
            (user_id,)
        )
        CONNECTION.commit()
        logging.info(f"User with ID \'{user_id}\' added successfully.")
    except psycopg.Error:
        logging.exception(f"Error adding user with ID \'{user_id}\'")
        CONNECTION.rollback()