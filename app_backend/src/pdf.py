from dropbox import DropboxOAuth2FlowNoRedirect, Dropbox
import base64
import os
import subprocess
import pymupdf
from typing import Self


class dbx_handler:
    def __init__(
            self, 
        ) -> None:

        self.pdf_documents = {}
        self.dbx = Dropbox(
            oauth2_refresh_token=os.environ['DROPBOX_REFRESH_TOKEN'],
            app_key=os.environ['DROPBOX_API_KEY']
        )

   
    def download_file_to_memory(self, name: str):
        path = self.search_files(name)
        _, res = self.dbx.files_download(path)
        return res.content
    

    def search_files(self, name: str) -> str:
        results = self.dbx.files_search('/wip_lo', name, max_results=1)
        path = results.matches[0].metadata.path_lower
        return path


    def get_pdf_document(self, name: str) -> pymupdf.Document:
        if name in self.pdf_documents:
            file_data = self.pdf_documents[name]
        else:
            file_data = self.download_file_to_memory(name)
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


    def insert_pages(self, doc: Self, start: int = 0, end: int = -1) -> None:
        if end == -1:
            end = doc.page_count

        try:
            self.inserted_pages[doc.name]
        except KeyError:
            self.inserted_pages[doc.name] = []

        pages = self.inserted_pages[doc.name]
        for i in range(start, end + 1):
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
