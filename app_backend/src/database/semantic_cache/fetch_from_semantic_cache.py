import psycopg
import logging
from langchain_openai import OpenAIEmbeddings
from ..cursor import CURSOR, CONNECTION

logger = logging.getLogger("main")

embed_model = OpenAIEmbeddings(model='text-embedding-3-small')

def fetch_from_semantic_cache(prompt: str) -> dict|None:
    embeddings = embed_model.embed_query(prompt.lower())
    try:
        data = CURSOR.execute(
            """
                SELECT s.response, s.summary_title,
                1 - (s.embedding <-> %s::vector) AS similarity_score,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'documentName', c.documentName,
                            'pageLabels', c.pageLabels,
                            'pdfPages', c.pdfPages
                        )
                    ) FILTER (WHERE c.cacheID IS NOT NULL), '[]'
                ) as citations
                FROM semantic_cache s
                LEFT JOIN cache_citations c
                    ON c.cacheID = s.id
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
                citation['pdf_page_indices'] = list(map(int, citation['pdf_page_indices'].split(';')))

        return data
    except psycopg.Error:
        CONNECTION.rollback()
        logger.exception("Error fetching from semantic cache")