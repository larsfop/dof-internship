from langchain_core.documents import Document
from langchain_postgres import PGVector
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from openai import RateLimitError
import psycopg
from collections import defaultdict
from typing import Iterator
from psycopg import Connection, Cursor
import base64
import numpy as np
import pymupdf
import time
from tqdm import tqdm

from class_objects import PartitionConfig

IMAGE_MODEL = ChatOpenAI(model_name='o4-mini', service_tier='flex')
TABLE_MODEL = ChatOpenAI(model_name='o4-mini', service_tier='flex')

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


def iter_by_sections(data: list[dict], start_index: int = 0) -> Iterator[tuple[str, list[dict]]]:
    sections = defaultdict(list)

    for item in data[start_index:]:
        section = item['sections'][-1]
        sections[section].append(item)

    for section, items in sections.items():
        yield section, items


def image_to_base64(image: dict, pdf: pymupdf) -> str:
    page_index = image['page_indices'][0]
    page = pdf[page_index]

    scale = page.rect.width / image['width']
    coords = np.asarray(image['coordinates']) * scale
    rect = pymupdf.Rect(coords[0,:].tolist(), coords[1,:].tolist())

    pix = page.get_pixmap(clip=rect, dpi=150)

    img_b64 = base64.b64encode(pix.tobytes()).decode('utf-8')

    return img_b64


def image_document(image_data: dict, texts: list[dict], pdf: pymupdf.Document) -> Document:
    document_name = image_data['document_name']
    sections = image_data['sections']
    img_b64 = image_to_base64(image_data, pdf)        

    while True:
        try:
            response = IMAGE_MODEL.invoke(
                [
                    {
                        'role': 'user',
                        'content': [
                            { 
                                "type": "text", 
                                "text": (
                                    'You are an expert at analysing and describing images for RAG vector store.\n'
                                    'Create a detailed description on the input image.\n'
                                    'Keep token usage around 400-600 tokens.\n'
                                    'Use the additional text for context if relevant:\n'
                                    f'{". ".join([text["content"] for text in texts])}'
                                )
                            },
                            {
                                "type": "image_url",
                                "image_url": {'url': f"data:image/png;base64,{img_b64}"}
                            }
                        ]
                    }
                ]
            )
            time.sleep(0.1)  # Placeholder for actual API call
        except RateLimitError:
            print('Token quota reached!')
            user_input = input('Continue creating vectors? (y/n): ').strip().lower()
            if user_input == 'y':
                continue
            else:
                break
        else:
            break

    return Document(
        page_content=response.content,
        metadata={
            'document_name': document_name,
            'page_indices': image_data['page_indices'],
            'page_labels': image_data['page_labels'],
            'type': 'image',
            'sections': sections
        }
    )


def table_document(table_data: dict, texts: list[dict], pdf: pymupdf.Document) -> Document:
    document_name = table_data['document_name']
    sections = table_data['sections']
    img_b64 = image_to_base64(table_data, pdf)

    while True:
        try:
            response = TABLE_MODEL.invoke(
                [
                    {
                        'role': 'user',
                        'content': [
                            { 
                                "type": "text", 
                                "text": (
                                    'You are an expert at analysing and describing tables for RAG vector store.\n'
                                    'Create a detailed description on the input table.\n'
                                    'Keep token usage around 400-600 tokens.\n'
                                    'Use the additional text for context if relevant:\n'
                                    f'{". ".join([text["content"] for text in texts])}'
                                )
                            },
                            {
                                "type": "image_url",
                                "image_url": {'url': f"data:image/png;base64,{img_b64}"}
                            }
                        ]
                    }
                ]
            )
            time.sleep(0.1)  # Placeholder for actual API call
        except RateLimitError:
            print('Token quota reached!')
            user_input = input('Continue creating vectors? (y/n): ').strip().lower()
            if user_input == 'y':
                continue
            else:
                break
        else:
            break
        
    return Document(
        page_content=response.content,
        metadata={
            'document_name': document_name,
            'page_indices': table_data['page_indices'],
            'page_labels': table_data['page_labels'],
            'type': 'table',
            'sections': sections
        }
    )


def prepare_documents(data: list[dict], pdf: pymupdf.Document, start_index: int = 0) -> list[Document]:
    try:
        documents = []
        document_name = data[0]['document_name']
        image_count = 0
        table_count = 0
        text_count = 0
        total_count = 0
        with (
            tqdm(total=len(data), unit='chunk', position=0) as pbar,
            tqdm(total=0, position=1, bar_format='{desc}', desc="Processing Sections") as count_bar
        ):
            pbar.update(start_index)
            for sections, chunks in iter_by_sections(data, start_index):
                pbar.set_postfix(section=sections if sections else 'No Section')
                texts = [item for item in chunks if item['type'] == 'text']
                for chunk in chunks:
                    chunk_type = chunk['type']
                    if chunk_type == 'image':
                        document = image_document(chunk, texts, pdf)
                    elif chunk_type == 'table':
                        document = table_document(chunk, texts, pdf)
                    else:
                        document = Document(
                            chunk['content'],
                            metadata={
                                'document_name': document_name,
                                'page_indices': chunk['page_indices'],
                                'page_labels': chunk['page_labels'],
                                'type': 'text',
                                'sections': sections
                            }
                        )
                    documents.append(document)
                    pbar.update(1)
                    count_bar.set_description_str(
                        f'Chunk types processed: '
                        f'Images: {(image_count := image_count + 1 if chunk_type == "image" else image_count)}; '
                        f'Tables: {(table_count := table_count + 1 if chunk_type == "table" else table_count)}; '
                        f'Texts: {(text_count := text_count + 1 if chunk_type == "text" else text_count)}'
                    )

    except KeyboardInterrupt:
        print('Process interrupted by user. Returning documents created so far.')
    finally:
        return documents


def add_documents_to_vector_store(
        documents: list[Document],
        document_name: str, 
        config: PartitionConfig, 
    ) -> list[Document]:
    connection_url = 'postgresql+psycopg://postgres:admin125@localhost:5435/postgres?sslmode=disable'
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

    vector_store.add_documents(
        documents,
        ids=[f'{document_name}:{i}' for i in range(len(documents))]
    )

    return documents