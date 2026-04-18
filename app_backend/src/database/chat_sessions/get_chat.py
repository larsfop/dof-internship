import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("database")

def get_chat(session_id: str) -> list[dict]:
    try:
        responses = CURSOR.execute(
            """
            SELECT
                r.prompt,
                r.response,
                r.response_id,
                r.cache_id,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'document_name', c.document_name,
                            'page_labels', c.page_labels,
                            'page_indices', c.page_indices
                        )
                    ) FILTER (WHERE c.response_id IS NOT NULL), '[]'
                ) as citations
            FROM responses r
            LEFT JOIN citations c
                ON r.response_id = c.response_id
            WHERE r.session_id = %s
            GROUP BY r.response_id
            ORDER BY r.timestamp ASC
            """,
            (session_id,)
        ).fetchall()

        for response in responses:
            for citation in response['citations']:
                if (citation):
                    citation['page_labels'] = list(map(str, citation['page_labels'].split(';')))
                    citation['page_indices'] = list(map(int, citation['page_indices'].split(';')))

        return responses
    except psycopg.Error:
        logger.exception(f"Error fetching chat for session_id: {session_id}")
        CONNECTION.rollback()