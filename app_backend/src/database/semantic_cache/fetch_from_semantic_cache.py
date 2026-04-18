import psycopg
import logging
from ..cursor import CURSOR, CONNECTION
from ai_models import get_cache_embedding_model

logger = logging.getLogger("database")

embed_model = get_cache_embedding_model()

def fetch_from_semantic_cache(prompt: str) -> dict|None:
    embeddings = embed_model.embed_query(prompt.lower())
    try:
        data = CURSOR.execute(
            """
                SELECT s.id::text as cache_id, s.response, s.summary_title as summary_title,
                1 - (s.embedding <-> %s::vector) AS similarity_score,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'document_name', c.document_name,
                            'page_labels', c.page_labels,
                            'page_indices', c.page_indices
                        )
                    ) FILTER (WHERE c.cache_id IS NOT NULL), '[]'
                ) as citations
                FROM semantic_cache s
                LEFT JOIN cache_citations c
                    ON c.cache_id = s.id
                GROUP BY s.id
                ORDER BY similarity_score DESC
                LIMIT 1
            """,
            (embeddings, )
        ).fetchone()

        if not data:
            return None
        
        for citation in data['citations']:
            if (citation):
                citation['page_labels'] = list(map(str, citation['page_labels'].split(';')))
                citation['page_indices'] = list(map(int, citation['page_indices'].split(';')))

        return data
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception(f"Error fetching from semantic cache with prompt: {prompt}")