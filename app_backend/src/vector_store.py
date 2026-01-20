from langchain_core.vectorstores.base import VectorStoreRetriever
from langchain_milvus import Milvus
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.runnables.schema import StreamEvent

from uuid import uuid4
import os
import re
import json
from _collections_abc import AsyncIterator
from typing import Tuple
import tiktoken
import pymupdf

from logger.logger import Logger
from database import new_response
from pdf import create_pdfs_from_embeddings
from config.config import RAGConfig


def new_cache_entry(prompt: str, response: str, config: RAGConfig) -> None:
    db_uri = f'http://{os.environ["MILVUS_HOST"]}:{os.environ["MILVUS_PORT"]}'
    vector_store = Milvus(
        collection_name='response_cache',
        embedding_function=OpenAIEmbeddings(model=config.embedding_model),
        connection_args={
            'uri': db_uri,
            'token': 'root:Milvus',
            'db_name': config.vector_db_name
        },
        index_params={
            'index_type': config.index_type,
            'metric_type': config.metric_type,
        },
        consistency_level='Strong'
    )

    vector_store.add_documents(
        [Document(page_content=prompt, metadata={'response': response, 'prompt': prompt})],
        ids=[str(uuid4())]
    )


def query_cache(prompt: str, config: RAGConfig) -> Tuple[str, float]|None:
    db_uri = f'http://{os.environ["MILVUS_HOST"]}:{os.environ["MILVUS_PORT"]}'
    vector_store = Milvus(
        collection_name='response_cache',
        embedding_function=OpenAIEmbeddings(model=config.embedding_model),
        connection_args={
            'uri': db_uri,
            'token': 'root:Milvus',
            'db_name': config.vector_db_name
        },
        index_params={
            'index_type': config.index_type,
            'metric_type': config.metric_type,
        },
        consistency_level='Strong'
    )

    results = vector_store.similarity_search_with_relevance_scores(
        prompt,
        k=1,
        score_threshold=0.8
    )

    if results:
        response, score = results[0]
        return response.metadata['response'], score
    
    return None