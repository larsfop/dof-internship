from openai.types.responses.response import Response
import pymupdf
import redis
import numpy as np
import json
import base64
from openai import OpenAI
import tiktoken
from argparse import ArgumentParser
from tqdm import tqdm

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
        vector_db_index: str = 'vector_index',
        section_depth: int = 1,
        ai_summary: bool = False,
        recreate: bool = False
    ) -> None:
        self.openai: OpenAI = OpenAI()
        self.redis: redis.Redis = redis.Redis(
            host='192.168.0.41',
            port=6379,
            decode_responses=True
        )
        self.index_name: str = vector_db_index
        self.doc: pymupdf.Document = pymupdf.open(document)
        self.config = json.load(open("redis_db_config.json"))

        prefixes = {
            'ns-en-1992-1-1_2004+a1_2014+na_2024_en_002.pdf': 'EC2:',
            'ns-en-1993-1-3_2006+na_2015_en_001.pdf': 'EC3:',
            'ns-en-1995-1-1_2004+a2_2014+na_2024_en_001.pdf': 'EC5:',
        }
        self.prefix = prefixes[self.doc.name]

        self.chat_model: str = chat_model
        self.vector_model: str = vector_model
        self.ai_summary: bool = ai_summary
        self.tokenizer = tiktoken.get_encoding('cl100k_base')

        self.rec: pymupdf.Rect = pymupdf.Rect(42, 72, 563, 772)
        
        self.section = False
        self.subsection = None
        self.section_depth = section_depth
        self.section_regex = re.compile(
            r'^(SECTION\s\d\d?|Section\s\d\d?|\d\d?)\s+[A-Z].+[a-zA-Z]$' if section_depth == 0 else r'^\d' + r'+[.]\d' * section_depth + r'\s'
            #r'^Section\s\d' if section_depth == 0 else r'^\d' + r'+[.]\d' * section_depth + r'\s'
        )
        self.content = ''
        self.header = ''

        self.token_buffer = []
        self.page_buffer = []
        self.output = []

        if recreate:
            keys = self.redis.scan_iter(f'{self.prefix}*')
            for key in keys:
                self.redis.delete(key)

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
    
    
    def create_index(self) -> None:
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
            # TagField("section"),
            TagField('start_page'),
            TagField('end_page'),
            # TextField("content"),
            VectorField(
                "embedding", 
                "FLAT", 
                attributes[self.vector_model]
            )
        )

        definition = IndexDefinition(
            prefix=['EC2:', 'EC3:', 'EC5:'], 
            index_type=IndexType.HASH
        )

        self.redis.ft(self.index_name).create_index(
            fields=schema,
            definition=definition
        )
        
        
    def read_into_vector_database(
        self,
        chunk_size: int = 800,
        chunk_overlap: int = 400,
        start_page: int = 0,
        end_page: int = -1,
    ) -> None:
        for self.page in self.doc[start_page:end_page]:
            self.read_page(chunk_size, chunk_overlap)
            
        if self.token_buffer:
            chunk_text = self.tokenizer.decode(self.token_buffer)
            self.output.append({
                'document': self.doc.name,
                'start_page': self.page_buffer[0],
                'end_page': self.page_buffer[-1],
                'text': chunk_text,
            })

        self.fill_database()


    def read_page(self, chunk_size: int, chunk_overlap: int) -> bool:
        text = self.page.get_text('text', clip=self.rec)
        tokens = self.tokenizer.encode(text)
        self.token_buffer.extend(tokens)
        self.page_buffer.extend([self.page.number] * len(tokens))

        start = 0
        while len(self.token_buffer) - start >= chunk_size:
            end = start + chunk_size
            chunk_tokens = self.token_buffer[start:end]
            chunk_pages = self.page_buffer[start:end]
            chunk_text = self.tokenizer.decode(chunk_tokens)
            self.output.append({
                'document': self.doc.name,
                'start_page': chunk_pages[0],
                'end_page': chunk_pages[-1],
                'text': chunk_text,
            })
            start += chunk_size - chunk_overlap

        if start > 0:
            self.token_buffer = self.token_buffer[start:]
            self.page_buffer = self.page_buffer[start:]


    def read_span(self, span: dict, index: int) -> None:
        font = span['font']
        size = span['size']
        text = span['text']

        if text.strip():
            if 'bold' in font.lower() and not 'times' in font.lower() and size > 10:
                if abs(span['origin'][1] - self.origin_y) > 15:
                    if not self.section_regex.match(self.header.strip()):
                        self.content += self.header.strip() + ' '
                        self.header = ''


                text = ' '.join(text.split())
                self.header += text.strip() + ' '
                self.origin_y = span['origin'][1]

            else:
                self.content += text.strip() + ' '

            if self.section_regex.match(self.header.strip()):
                if self.section:
                    page = self.page.number if self.origin_y > 120 else self.page.number - 1
                    print(f'Section: {self.section.strip()}; Page {self.start_page}:{page}')
                    self.fill_database(
                        self.start_page,
                        page
                    )

                self.start_page = self.page.number
                self.section = self.header.strip()
                self.header = ''
                self.content = ''



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
            
            
    def fill_database(self) -> None:
        for i, output in enumerate(tqdm(self.output, desc='Filling vector database')):
            if self.ai_summary:
                # Get AI summary of the content
                response = self.summary_content()
                
            # Get the embedding for the content
            embedding = self.openai.embeddings.create(
                input=output['text'],
                model=self.vector_model
            )
            
            # And fill the Redis database with the data
            self.redis.hset(
                self.prefix + str(i),
                mapping={
                    'document': output['document'],
                    'start_page': output['start_page'],
                    'end_page': output['end_page'],
                    'embedding': np.array(embedding.data[0].embedding, dtype=np.float32).tobytes(),
                }
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
        '-i', '--index', type=str, default='vector_index', help='Name of the vector database index.'
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
    parser.add_argument(
        '--create-index', action='store_true', help='Create the vector database index.'
    )

    argcomplete.autocomplete(parser, exclude=['--chatmodel', '--vectormodel', '--index', '--depth', '--aisummary'])
    args = parser.parse_args()
    
    db = VectorDatabase(
        document=args.document,
        chat_model=args.chatmodel,
        vector_model=args.vectormodel,
        vector_db_index=args.index,
        section_depth=args.depth,
        ai_summary=args.aisummary,
        recreate=args.recreate
    )

    if args.create_index:
        db.create_index()
    else:
        db.read_into_vector_database(
            start_page=args.startpage,
            end_page=args.endpage,
        )