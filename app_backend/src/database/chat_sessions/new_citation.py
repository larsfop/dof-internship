import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def new_citation(response_id: str, document_name: str, page_labels: str, page_indices: str) -> None:
    try:
        CURSOR.execute(
            "INSERT INTO citations (response_id, document_name, page_labels, page_indices) VALUES (%s, %s, %s, %s)",
            (response_id, document_name, page_labels, page_indices)
        )
        CONNECTION.commit()
        logger.info(f"Citation for response ID \'{response_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Citation for response ID \'{response_id}\' already exists.")
        CONNECTION.rollback()