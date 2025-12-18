from dropbox import Dropbox
from dropbox.files import FileMetadata
import base64
import os
import pymupdf
from typing import Optional, Self
from langchain_core.documents import Document
from pydantic import BaseModel, Field
from typing import List, Tuple
from pathlib import Path

from pydantic_classes import DocumentPDF


class dbx_handler:
    def __init__(
            self, 
        ) -> None:

        self.pdf_documents = {}
        self.dbx = Dropbox(
            oauth2_refresh_token=os.environ['DROPBOX_REFRESH_TOKEN'],
            app_key=os.environ['DROPBOX_API_KEY']
        )


    def download_file_to_memory(self, file: str|FileMetadata) -> tuple[FileMetadata, bytes]:
        if isinstance(file, FileMetadata):
            path = file.path_lower
        else:
            path = self.search_files(file)

        metadata, res = self.dbx.files_download(path)
        return metadata, res.content
    

    def search_files(self, name: str) -> str:
        results = self.dbx.files_search('/wip_lo', name, max_results=1)
        path = results.matches[0].metadata.path_lower
        return path
    

    def list_files(self, folder: str = '') -> list[FileMetadata]:
        results = self.dbx.files_list_folder(folder, recursive=True)
        entries = results.entries

        while results.has_more:
            results = self.dbx.files_list_folder_continue(results.cursor)
            entries.extend(results.entries)

        return [entry for entry in entries if isinstance(entry, FileMetadata)]
    

    def get_pdf_document(self, name: str) -> pymupdf.Document:
        if name in self.pdf_documents:
            file_data = self.pdf_documents[name]
        else:
            _, file_data = self.download_file_to_memory(name)
            self.pdf_documents[name] = file_data

        doc = pymupdf.open(
            filename=name,
            stream=file_data,
            filetype='pdf'
        )

        return doc


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


class PDFMetadata(BaseModel):
    name: str
    page_labels: List[int]
    pages: List[int]
    data: str


class PDFData(BaseModel):
    documents: Optional[List[PDFMetadata]] = Field(default_factory=list)


    def append(self, metadata: PDFMetadata) -> None:
        self.documents.append(metadata)


def get_pdf_path(name: str) -> Path:
    path = Path(os.environ['DATA_PATH']) / 'PDFs'
    try:
        return next(path.rglob(name))
    except StopIteration:
        raise FileNotFoundError(f"No PDF found with name: {name} in path: {path}")


def create_pdfs_from_embeddings(documents: list):
    filtered_docs = documents.filter_by_score(0.95).merge_same_documents()

    pdf_data = []
    for i, document in enumerate(filtered_docs):
        with pdf() as newdoc:
            name, pages, page_labels, score = document.values()
            print(f'Processing embedding {i+1}/{len(filtered_docs)} for document: {name} with pages {pages} and page labels {page_labels}', flush=True)
            
            pdf_path = get_pdf_path(name)
            with pymupdf.open(pdf_path) as doc:
                newdoc.insert_pages(doc, pages)

            newdoc.doc.save(os.environ['DATA_PATH'] + f'temp_{i}.pdf')
            
            pdf_data.append(
                DocumentPDF(
                    name=name,
                    pages=pages,
                    page_labels=page_labels,
                    data=newdoc.as_base64()
                )
            )

    return pdf_data