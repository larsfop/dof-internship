import psycopg
import logging

from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")


def remove_from_semantic_cache(cache_id: str) -> None:
    try:
        CURSOR.execute("DELETE FROM cache_citations WHERE cache_id = %s;", (cache_id,))
        CURSOR.execute("UPDATE responses SET cache_id = NULL WHERE cache_id = %s;", (cache_id,))
        CURSOR.execute("DELETE FROM semantic_cache WHERE id = %s;", (cache_id,))
        CONNECTION.commit()
        logger.info(f"Semantic cache entry with ID '{cache_id}' removed successfully.")
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception(f"Error removing semantic cache entry with ID '{cache_id}'")