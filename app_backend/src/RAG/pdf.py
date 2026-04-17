import base64
import os
import pymupdf
from pydantic import BaseModel
from typing import List
import logging

from config import CONFIG
from .pydantic_classes import GradeResults
from database import fetch_pdfs

logger = logging.getLogger('main')

class DocumentPDF(BaseModel):
    name: str
    pages: List[int]
    pageLabels: List[str]
    data: str


def create_pdfs_from_embeddings(documents: GradeResults) -> list[DocumentPDF]:
    documents = [doc for doc in documents if doc.score >= CONFIG.rag.score_threshold]

    pdf_data: dict[str, dict[str, list[int]|pymupdf.Document]] = {}
    for i, document in enumerate(documents, start=1):
        logger.info(f'Processing embedding {i}/{len(documents)} for document: {document.document_name} with pages {document.page_indices} and page labels {document.page_labels}')
        if not document.document_name in pdf_data:
            pdf_data[document.document_name] = {
                'page_indices': [],
                'page_labels': [],
                'pdf': pymupdf.Document()
            }

        pdfs = fetch_pdfs(document.document_name)
        if not pdfs:
            logger.warning(f"No PDF found for document: {document.document_name}. Skipping.")
            continue

        for pdf in pdfs:
            with pymupdf.open(pdf['documentpath']) as doc:
                for j, page_index in enumerate(document.page_indices):
                    if page_index in pdf_data[document.document_name]['page_indices']:
                        continue

                    pdf_data[document.document_name]['pdf'].insert_pdf(doc, from_page=page_index, to_page=page_index)
                    pdf_data[document.document_name]['page_indices'].append(page_index)
                    pdf_data[document.document_name]['page_labels'].append(document.page_labels[j])

    for i, doc in enumerate(pdf_data.values(), start=1):
        doc['pdf'].save(os.environ['DATA_PATH'] + f'temp_{i}.pdf')

    return [
        DocumentPDF(
            name=document_name,
            pages=doc['page_indices'],
            pageLabels=doc['page_labels'],
            data=base64.b64encode(doc['pdf'].tobytes()).decode('utf-8')
        ) for document_name, doc in pdf_data.items()
    ]