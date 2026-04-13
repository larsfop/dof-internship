
from langchain_openai import OpenAIEmbeddings
from langchain_postgres import PGVector
import os
import logging

from config import CONFIG

_cached_retriever = None
_cached_rag_config = None

logger = logging.getLogger("main")

def get_vector_retriever():
    global _cached_retriever, _cached_rag_config
    rag_config = CONFIG.rag
    if _cached_retriever is None or _cached_rag_config != rag_config:
        db_uri = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
            user=os.environ['POSTGRES_USER'],
            password=os.environ['POSTGRES_PASSWORD'],
        )
        # db_uri = 'postgresql+psycopg://postgres:admin125@localhost:5435/postgres?sslmode=disable'
        embeddings = OpenAIEmbeddings(model=rag_config.embedding_model)
        vector_store = PGVector(
            embeddings=embeddings,
            embedding_length=rag_config.embedding_dimensions,
            connection=db_uri,
            collection_name=rag_config.collection_name,
            distance_strategy=rag_config.metric_type,
            use_jsonb=True,
            logger=logger,
        )
        _cached_retriever = vector_store.as_retriever(
            search_type=rag_config.search_type,
            search_kwargs=rag_config.search_kwargs,
        )
        _cached_rag_config = rag_config
    return _cached_retriever