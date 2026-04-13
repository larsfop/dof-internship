import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def new_citation(response_id: str, document_name: str, page_labels: str, pdf_pages: str) -> None:
    try:
        CURSOR.execute(
            "INSERT INTO citations (responseID, documentName, pageLabels, pdfPages) VALUES (%s, %s, %s, %s)",
            (response_id, document_name, page_labels, pdf_pages)
        )
        CONNECTION.commit()
        logger.info(f"Citation for response ID \'{response_id}\' added successfully.")
    except psycopg.Error:
        logger.exception(f"Citation for response ID \'{response_id}\' already exists.")
        CONNECTION.rollback()