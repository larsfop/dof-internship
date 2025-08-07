from openai.types.responses.response import Response
import pymupdf
import redis
import numpy as np
from openai import OpenAI
from argparse import ArgumentParser

from redis.commands.search.query import Query
from redis.commands.search.field import TextField, TagField, VectorField
from redis.commands.search.index_definition import IndexDefinition, IndexType
from redis.commands.json.path import Path
import re


class VectorDatabase:
    def __init__(
        self,
        document: str,
        chat_model: str = 'gpt-4.1',
        vector_model: str = 'text-embedding-3-large',
        vector_db_index: str = 'test_index',
        section_depth: int = 1,
        ai_summary: bool = False
    ) -> None:
        self.openai: OpenAI = OpenAI()
        self.redis: redis.Redis = redis.Redis(
            host='192.168.0.41',
            port=6379,
            decode_responses=True
        )
        self.index_name: str = vector_db_index
        self.doc: pymupdf.Document = pymupdf.open(document)

        self.chat_model: str = chat_model
        self.vector_model: str = vector_model
        self.ai_summary: bool = ai_summary

        self.rec: pymupdf.Rect = pymupdf.Rect(72, 72, 523, 770)
        
        self.section = None
        self.subsection = None
        self.section_depth = section_depth
        self.section_regex = re.compile(
            r'^Section\s\d' if section_depth == 0 else r'^\d' + r'+[.]\d' * section_depth + r'\s'
        )
        self.content = ''
        self.output = {}
        
        
    def summary_content(self) -> Response:
        response = self.openai.responses.create(
            model=self.chat_model,
            input=[
            {
                'role': 'system',
                'content': 'Write the response in a concise and clear manner using only the provided text for context, focusing on the key points of the text and including all relevant variables and standards, write the response in raw text.'  
            },
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'input_text',
                        'text': f'Create a summary of the text and make sure to include all mentions of variables and standards, do not use any context outside the given text: {self.content}'
                    }
                ]
            }
        ]
        )
        
        self.content = response.output_text
        
        return response
    
    
    def create_database(self) -> None:
        try:
            self.redis.ft(self.index_name).dropindex(True)
        except:
            pass
        
        attributes = {
            'text-embedding-3-large': {
                'TYPE': 'FLOAT32',
                'DIM': 3072,
                'DISTANCE_METRIC': 'COSINE'
            },
            'text-embedding-3-small': {
                'TYPE': 'FLOAT32',
                'DIM': 1536,
                'DISTANCE_METRIC': 'COSINE'
            }
        }
        
        schema = (
            TagField('document'),
            TagField("section"),
            TagField('subsection'),
            TagField('startpage'),
            TagField('endpage'),
            # TextField("content"),
            VectorField("embedding", "HNSW", attributes[self.vector_model])
        )

        self.redis.ft(self.index_name).create_index(
            schema,
            definition=IndexDefinition(
                prefix=["sec:"], index_type=IndexType.HASH
            )
        )
        
        
    def read_into_vector_database(
        self,
        start_page: int = 0,
        end_page: int = -1,
        recreate: bool = False,
    ) -> None:
        if recreate:
            print('Recreating the vector database index...')
            self.create_database()
        
        self.start_page = start_page
        end_page = end_page if end_page != -1 else self.doc.page_count
        for self.page in self.doc[start_page:end_page]:
            if  not self.read_page():
                break
            
        if self.subsection:
            print(f'Section {self.section} subsection {self.subsection}; Page {self.start_page}:{self.page.number - 1}')
            self.fill_database(self.start_page, self.page.number - 1)


    def read_page(self) -> bool:
        text = self.page.get_text("text", clip=self.rec)
        
        if text.startswith('Annex'):
            print(f'Annex found on page {self.page.number}, stopping read.')
            return False
        
        text = re.sub(r'B.*\nB', lambda x: x.group(0)[1:-2], text)
        text = re.sub(r'\n..', lambda x: x.group(0)[1:], text)
        text = [block.strip() for block in text.split('\n')]
        
        for i, block in enumerate(text):
            self.read_block(block, i)
            
        return True


    def read_block(self, block: str, index: int) -> None:
        # If the page starts with a section or subsection fill the data before continuing
        if index == 0 and (block.startswith('Section') or self.section_regex.match(block)):
            if self.section:
                print(f'Section {self.section} subsection {self.subsection}; Page {self.start_page}:{self.page.number - 1}')
                self.fill_database(self.start_page, self.page.number - 1)

            self.subsection = None
            self.content = ''
            
        if block.startswith('Section'):
            self.section = block
            self.output[self.section] = {}
        elif self.section_regex.match(block):
            if self.subsection:
                print(f'Section {self.section} subsection {self.subsection}; Page {self.start_page}:{self.page.number}')
                self.fill_database(self.start_page, self.page.number)

            self.start_page = self.page.number
            self.subsection = block
            self.content = ''
        else:
            self.content += block + '\n'
            
            
    def fill_database(self, start_page: int, end_page: int) -> None:
        if self.ai_summary:
            # Get AI summary of the content
            response = self.summary_content()
            
        # Get the embedding for the content
        embedding = self.openai.embeddings.create(
            input=self.content,
            model=self.vector_model
        )
        
        # Store the embeddings, content and metadata in a dictionary
        self.output[self.section][self.subsection] = {
            'document': self.doc.name,
            'section': self.section,
            'subsection': self.subsection,
            'startpage': start_page,
            'endpage': end_page,
            'embedding': np.array(embedding.data[0].embedding, dtype=np.float32).tobytes(),
            'content': self.content
        }
        
        # And fill the Redis database with the data
        self.redis.hset(
            f'sec:{re.search(r'^\d+(\.\d+)*', self.subsection).group(0)}',
            mapping=self.output[self.section][self.subsection]
        )
        
        
if __name__ == '__main__':
    import argcomplete
    parser = ArgumentParser(description="Read a document into a vector database.")
    
    parser.add_argument(
        'document', type=str, nargs='?', default='ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf', help='Path to the document to read into the vector database.'
    )
    parser.add_argument(
        '-cm', '--chatmodel', type=str, default='gpt-4.1', help='Chat model to use for AI summaries.'
    )
    parser.add_argument(
        '-vm', '--vectormodel', type=str, default='text-embedding-3-large', help='Vector model to use for embeddings.'
    )
    parser.add_argument(
        '-i', '--index', type=str, default='vector_db', help='Name of the vector database index.'
    )
    parser.add_argument(
        '-d', '--depth', type=int, default=1, help='Depth of the section hierarchy to read.'
    )
    parser.add_argument(
        '-ai', '--aisummary', action='store_true', help='Use AI to summarize the content.'
    )
    parser.add_argument(
        '-s', '--startpage', type=int, default=0, help='Start page to read from the document.'
    )
    parser.add_argument(
        '-e', '--endpage', type=int, default=-1, help='End page to read from the document. Use -1 for the last page.'
    )
    parser.add_argument(
        '--recreate', action='store_true', help='Recreate the vector database index.'
    )

    argcomplete.autocomplete(parser, exclude=['--chatmodel', '--vectormodel', '--index', '--depth', '--aisummary'])
    args = parser.parse_args()
    
    db = VectorDatabase(
        document=args.document,
        chat_model=args.chatmodel,
        vector_model=args.vectormodel,
        vector_db_index=args.index,
        section_depth=args.depth,
        ai_summary=args.aisummary
    )
    
    db.read_into_vector_database(
        start_page=args.startpage,
        end_page=args.endpage,
        recreate=args.recreate
    )