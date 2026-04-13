import base64
import os
import pymupdf
from typing import Optional, Self
from langchain_core.documents import Document
from pydantic import BaseModel, Field
from typing import List, Tuple
from pathlib import Path

from pydantic_classes import DocumentPDF


class pdf:
    def __init__(self, file_data: bytes = None) -> None:
        self.doc = pymupdf.open(stream=file_data, filetype='pdf')
        self.page_count = self.doc.page_count
        self.inserted_pages = {}


    def __enter__(self) -> Self:
        return self
    

    def __exit__(self, exc_type, exc_value, traceback) -> None:
        self.doc.close()


    def insert_pages(self, doc: Self, page_numbers: list[int]) -> None:
        try:
            self.inserted_pages[doc.name]
        except KeyError:
            self.inserted_pages[doc.name] = []

        pages = self.inserted_pages[doc.name]
        for i in page_numbers:
            if i in pages:
                continue
            pages.append(i)

            self.doc.insert_pdf(doc, from_page=i, to_page=i)
            self.page_count = self.doc.page_count


    def as_bytes(self) -> bytes:
        return self.doc.tobytes()
    

    def as_base64(self) -> str:
        return base64.b64encode(self.doc.tobytes()).decode('utf-8')


    def __len__(self) -> int:
        return self.page_count


def get_pdf_path(name: str) -> Path:
    path = Path(os.environ['DATA_PATH']) / 'PDFs'
    try:
        return next(path.rglob(name))
    except StopIteration:
        raise FileNotFoundError(f"No PDF found with name: {name} in path: {path}")


def create_pdfs_from_embeddings(documents: list):
    filtered_docs = documents.filter_by_score(0.95).merge_same_documents()

    pdf_data = []
    for i, document in enumerate(filtered_docs, start=1):
        with pdf() as newdoc:
            name, pages, page_labels, score = document.values()
            print(f'Processing embedding {i}/{len(filtered_docs)} for document: {name} with pages {pages} and page labels {page_labels}', flush=True)
            
            pdf_path = get_pdf_path(name)
            with pymupdf.open(pdf_path) as doc:
                newdoc.insert_pages(doc, pages)

            newdoc.doc.save(os.environ['DATA_PATH'] + f'temp_{i}.pdf')
            
            pdf_data.append(
                DocumentPDF(
                    name=name,
                    pages=pages,
                    pageLabels=page_labels,
                    data=newdoc.as_base64()
                )
            )

    return pdf_data