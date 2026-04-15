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
    pageLabels: List[int]
    data: str


def create_pdfs_from_embeddings(documents: GradeResults) -> list[DocumentPDF]:
    documents = [doc for doc in documents if doc.score >= CONFIG.rag.score_threshold]

    pdf_data = []
    with pymupdf.open() as newdoc:
        for i, document in enumerate(documents, start=1):
            logger.info(f'Processing embedding {i}/{len(documents)} for document: {document.document_name} with pages {document.page_indices} and page labels {document.page_labels}')

            pdfs = fetch_pdfs(document.document_name)
            if not pdfs:
                logger.warning(f"No PDF found for document: {document.document_name}. Skipping.")
                continue

            for pdf in pdfs:
                with pymupdf.open(pdf['documentpath']) as doc:
                    for page_index in document.page_indices:
                        newdoc.insert_pdf(doc, from_page=page_index, to_page=page_index)

        newdoc.save(os.environ['DATA_PATH'] + f'temp_{i}.pdf')

        pdf_data.append(DocumentPDF(
            name=document.document_name,
            pages=document.page_indices,
            pageLabels=document.page_labels,
            data=base64.b64encode(newdoc.tobytes()).decode('utf-8')
        ))

    return pdf_data