from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from openai import RateLimitError
from collections import defaultdict
from typing import Iterator
import base64
import numpy as np
import pymupdf
import time
import logging
from pathlib import Path

from database import get_vector_store, store_pdf, clear_pdf_from_store
from ai_models import get_partition_model

logger = logging.getLogger('main')

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

    model = get_partition_model()

    while True:
        try:
            response = model.invoke(
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
            logger.warning('Token quota reached!')
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

    model = get_partition_model()

    while True:
        try:
            response = model.invoke(
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
            logger.warning('Token quota reached!')
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
        for sections, chunks in iter_by_sections(data, start_index):
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

    except KeyboardInterrupt:
        logger.warning('Process interrupted by user. Returning documents created so far.')
    finally:
        return documents


def add_documents_to_vector_store(
        documents: list[Document],
        file_path: Path,
    ) -> list[Document]:
    document_name = file_path.stem
    vector_store = get_vector_store()

    # Delete existing entries for the document
    clear_pdf_from_store(document_name)

    vector_store.add_documents(
        documents,
        ids=[f'{document_name}:{i}' for i in range(len(documents))]
    )

    category = file_path.parent.stem if file_path.parent.stem != 'pdfs' else None

    store_pdf(file_path.name, str(file_path), category=category)

    return documents