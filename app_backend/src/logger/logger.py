from typing import Callable, Self
import os
from langchain_core.documents import Document
import json
import csv
from pathlib import Path
import textwrap
import logging


class Logger:
    def __init__(
            self,
            logger: logging.Logger,
            user_id: str,
            session_id: str,
            entry_id: str,
        ) -> None:

        self.user_id = user_id
        self.session_id = session_id
        self.logger = logger

        self.json_text = {
            'entry_id': entry_id,
            'input_page_count': 0,
            'vector_search': [],
            'response': {}
        }

        self.path = Path(f'logs/users/{self.user_id}/{self.session_id}.log')

        if not self.path.exists():
            with open(self.path, 'w') as f:
                self.log_metadata(f)

    def log_metadata(self, file) -> None:
        metadata = {
            'user_id': self.user_id,
            'session_id': self.session_id,
            'entries': []
        }
        json.dump(metadata, file, indent=4)
        file.flush()

    def end(self) -> None:
        with open(self.path, 'r+') as log_file:
            is_empty = self.file_seek_entry_list_end(log_file)

            prefix = '\n'
            if not is_empty:
                prefix = ',\n'

            self.json_text = json.dumps(self.json_text, indent=4)
            self.json_text = textwrap.indent(self.json_text, '        ')
            log_file.write(prefix + self.json_text + '\n    ]\n}')
            log_file.close()


    def file_seek_entry_list_end(self, file) -> bool:
        file.seek(0, os.SEEK_END)
        i = file.tell() - 1
        while i > 0:
            file.seek(i)
            if file.read(1) == ']':
                file.seek(i - 1)
                if file.read(1) == '[':
                    file.seek(i)
                    return True

                j = i - 1
                while j > 0:
                    file.seek(j)
                    if file.read(1) == '}':
                        file.seek(j + 1)
                        return False
                    j -= 1

            i -= 1

        raise Exception('Invalid JSON file structure')


    def log_vector_search(
            self,
            data: list[Document]
        ):

        for i, embed in enumerate(data, start=1):
            self.json_text['vector_search'].append({'embed_rank': i} | embed.metadata)
            self.logger.info(f'Embed rank: {i} - '
                             f'Document: {embed.metadata["Document"]} - '
                             f'Pages: {embed.metadata["pages"]} - '
                             f'Page Labels: {embed.metadata["page_labels"]} - '
                             f'ID: {embed.metadata["pk"]}',
                            extra={'user': self.user_id}
            )

    def log_input_page_count(self, count: int) -> None:
        self.json_text['input_page_count'] = count
        self.logger.info(f'Pages loaded for input: {count}', extra={'user': self.user_id})

    def log_response(
            self,
            data: dict
        ):

        self.json_text['response'] = data

        self.end()

    def log_info(self, message: str) -> None:
        self.logger.info(message, extra={'user': self.user_id})