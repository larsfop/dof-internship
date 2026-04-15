import os
import logging
from langchain_postgres import PGVector

from config import CONFIG, cache_with_config_key
from ai_models import get_embedding_model

logger = logging.getLogger("main")

POSTGRES_URL = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)

@cache_with_config_key(CONFIG, 'rag')
def get_vector_store():
    embeddings = get_embedding_model()
    return PGVector(
        embeddings=embeddings,
        embedding_length=CONFIG.rag.embedding_dimensions,
        connection=POSTGRES_URL,
        collection_name=CONFIG.rag.collection_name,
        distance_strategy=CONFIG.rag.metric_type,
        use_jsonb=True,
        logger=logger,
    )