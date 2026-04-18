from langchain_core.vectorstores import VectorStoreRetriever
import logging

from config import CONFIG
from .vector_store import get_vector_store

logger = logging.getLogger("database")

def get_vector_retriever() -> VectorStoreRetriever:
    vector_store = get_vector_store()

    return vector_store.as_retriever(
        search_type=CONFIG.rag.search_type,
        search_kwargs=CONFIG.rag.search_kwargs,
    )