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

"""
def extract_page_label(page: pymupdf.Page) -> str|None:
    if page.number % 2:
        label = page.get_textbox(pymupdf.Rect(42, 784, 100, 808)).strip()
    else:
        label = page.get_textbox(pymupdf.Rect(400, 784, 564, 808)).strip()

    match = self.page_label_regex.search(label)
    
    return match

def fill_vector_store(
        self, 
        document,
        name: str,
        chunk_size: int = 800,
        chunk_overlap: int = 400,
        tokenizer: str = "cl100k_base",
    ) -> None:

    tokenizer = tiktoken.get_encoding(tokenizer)
    rec: pymupdf.Rect = pymupdf.Rect(42, 72, 563, 772)

    doc = pymupdf.open(
        stream=document,
        filetype='pdf'
    )
    
    token_buffer = []
    page_buffer = []
    page_labels = []
    documents = []
    for page in doc:
        page_label = self.extract_page_label(page)
        # Skip page without valid label (e.g., title page, blank pages)
        if not page_label:
            continue

        page_label = page_label.group(0)

        text = page.get_textbox(rec).strip()
        tokens = tokenizer.encode(text)
        token_buffer.extend(tokens)
        page_buffer.append(page.number)
        page_labels.append(page_label)

        while len(token_buffer) >= chunk_size + chunk_overlap:
            chunk_tokens = token_buffer[:chunk_size + chunk_overlap]
            chunk_content = tokenizer.decode(chunk_tokens)

            # Create document from chunk
            metadata = {
                'Document': name,
                'pages': ';'.join(map(str, page_buffer)),
                'page_labels': ';'.join(page_labels),
            }
            document = Document(
                page_content=chunk_content,
                metadata=metadata
            )

            documents.append(document)

            # Remove used tokens from buffer, keeping overlap tokens
            del token_buffer[:chunk_size + chunk_overlap // 2]


            if token_buffer:
                page_buffer = page_buffer[-1:]
                page_labels = page_labels[-1:]
            else:
                page_buffer = []
                page_labels = []


    if token_buffer:
        chunk_content = tokenizer.decode(token_buffer)

        metadata = {
            'Document': name,
            'pages': ';'.join(map(str, page_buffer)),
            'page_labels': ';'.join(page_labels),
        }
        document = Document(
            page_content=chunk_content,
            metadata=metadata
        )

        documents.append(document)

    self.vector_store.add_documents(
        documents,
        ids=[str(uuid4()) for _ in range(len(documents))]
    )
"""

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