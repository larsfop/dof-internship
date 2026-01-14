from langchain_core.documents import Document
from langchain_postgres import PGVector
from langchain_openai import OpenAIEmbeddings
import psycopg
from collections import defaultdict
from typing import Iterator
from psycopg import Connection, Cursor

from class_objects import PartitionConfig

def clear_vector_store(connection: Connection, cursor: Cursor, document_name: str, collection_name: str) -> None:
    cursor.execute(
        """
            DELETE FROM langchain_pg_embedding
            WHERE collection_id = (
                SELECT uuid FROM langchain_pg_collection WHERE name = %s
            ) 
            AND id LIKE %s;
        """,
        (collection_name, f'{document_name}%')
    )
    connection.commit()


def iter_by_sections(data: list[dict]) -> Iterator[tuple[str, list[dict]]]:
    sections = defaultdict(list)

    for item in data:
        section = item['sections'][-1]
        sections[section].append(item)

    for section, items in sections.items():
        yield section, items


def get_text_index(data: list[dict]) -> int|None:
    return next(
        (i for i, item in enumerate(data) if item['type'] == 'text'),
        None
    )


def prepare_documents(data: list[dict]) -> list[Document]:
    documents = []
    for section, items in iter_by_sections(data):
        index = get_text_index(items)
        if index is None:
            continue

        documents.extend([
            Document(
                item['content'],
                metadata={
                    'document_name': item['document_name'],
                    'page_indices': ';'.join(map(str, item['page_indices'])),
                    'page_labels': ';'.join(map(str, item['page_labels'])),
                    'type': item['type'],
                    'sections': ';'.join(item['sections']),
                }
            ) for item in items[index:]
        ])

    return documents


def add_documents_to_vector_store(data: list[dict], document_name: str, config: PartitionConfig) -> None:
    connection_url = 'postgresql://postgres:admin125@localhost:5435/postgres?sslmode=disable'
    collection_name = config.collection_name

    embeddings = OpenAIEmbeddings(model=config.embedding_model)
    vector_store = PGVector(
        embeddings=embeddings,
        embedding_length=config.embedding_dimension,
        distance_strategy=config.distance_metric,
        collection_name=collection_name,
        connection=connection_url,
    )
    
    con = psycopg.connect(connection_url)
    cur = con.cursor()

    # Delete existing entries for the document
    clear_vector_store(con, cur, document_name, collection_name)

    documents = prepare_documents(data)

    vector_store.add_documents(
        documents,
        ids=[f'{document_name}:{i}' for i in range(len(documents))]
    )