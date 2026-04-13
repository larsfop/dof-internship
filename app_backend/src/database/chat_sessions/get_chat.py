import psycopg
import logging
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

def get_chat(session_id: str) -> list[dict]:
    try:
        responses = CURSOR.execute(
            """
            SELECT
                r.prompt,
                r.response,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'documentName', c.documentName,
                            'pageLabels', c.pageLabels,
                            'pdfPages', c.pdfPages
                        )
                    ) FILTER (WHERE c.responseID IS NOT NULL), '[]'
                ) as citations
            FROM responses r
            LEFT JOIN citations c
                ON r.responseID = c.responseID
            WHERE r.sessionID = %s
            GROUP BY r.responseID
            ORDER BY r.timestamp ASC
            """,
            (session_id,)
        ).fetchall()

        for response in responses:
            for citation in response['citations']:
                if (citation):
                    citation['pageLabels'] = list(map(str, citation['pageLabels'].split(';')))
                    citation['pdfPages'] = list(map(int, citation['pdfPages'].split(';')))

        return responses
    except psycopg.Error:
        logger.exception("Error fetching chat")
        CONNECTION.rollback()