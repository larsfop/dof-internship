from langchain_milvus import Milvus
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document

import tiktoken
import pymupdf
from uuid import uuid4
import os

"""

Module for vector database operations.
Handles:
- Connecting to Milvus
- Setting up collections
- Performing vector searches
- Document preparation
- Generating GPT responses

"""



class chatbox_pipeline:
    def __init__(
            self,
            embedding_model: str = "text-embedding-3-large",
            vector_db_host: str = "localhost",
            vector_db_port: str = "19530",
            vector_db_name: str = "document_embeddings",
            llm_model: str = "o4-mini",
        ) -> None:

        host = os.environ['MILVUS_HOST']
        port = os.environ['MILVUS_PORT']

        self.vector_store = Milvus(
            embedding_function=OpenAIEmbeddings(model=embedding_model),
            connection_args={
                'uri': f'http://{host}:{port}',
                'token': 'root:Milvus',
                'db_name': vector_db_name
            },
            index_params={
                "index_type": "FLAT",
                "metric_type": "L2",
            },
            consistency_level="Strong"
        )

        self.llm = ChatOpenAI(
            model=llm_model,
            api_key=os.environ['OPENAI_API_KEY'],
            streaming=True,
        )


    def fill_vector_store(
            self, 
            *documents,
            chunk_size: int = 1600,
            chunk_overlap: int = 400,
            tokenizer: str = "cl100k_base",
        ) -> None:

        tokenizer = tiktoken.get_encoding(tokenizer)
        rec: pymupdf.Rect = pymupdf.Rect(42, 72, 563, 772)

        for document in documents:
            doc = pymupdf.open(document)
            
            token_buffer = []
            page_buffer = []
            for page in doc:
                text = page.get_text('text', clip=rec)
                tokens = tokenizer.encode(text)
                token_buffer.extend(tokens)
                page_buffer.extend([page.number] * len(tokens))

                start = 0
                while len(token_buffer) - start >= chunk_size:
                    end = start + chunk_size
                    chunk_tokens = token_buffer[start:end]
                    chunk_pages = page_buffer[start:end]
                    chunk_text = tokenizer.decode(chunk_tokens)
                    start += chunk_size - chunk_overlap

                    metadata = {
                        'Document': doc.name,
                        'page_start': chunk_pages[0],
                        'page_end': chunk_pages[-1],
                    }
                    self.vector_store.add_documents(
                        documents=[Document(page_content=chunk_text, metadata=metadata)],
                        ids=[str(uuid4())]
                    )

                if start > 0:
                    token_buffer = token_buffer[start:]
                    page_buffer = page_buffer[start:]

        
    def setup_retriever(
        self,
        search_type: str = "mmr",
        k: int = 10,
        fetch_k: int = 100,
        lambda_mult: float = 0.5,
    ) -> None:

        self.retriever = self.vector_store.as_retriever(
            search_type=search_type,
            search_kwargs={
                'k': k,
                'fetch_k': fetch_k,
                'lambda_mult': lambda_mult,
            }
        )


    def retrieve(
            self,
            query: str,
            k: int = 10,
            **kwargs,
        ) -> list[Document]:

        if not hasattr(self, 'retriever'):
            raise ValueError("Retriever not set up. Call setup_retriever() first.")
        
        results = self.retriever.invoke(
            query,
            k=k,
            **kwargs
        )

        return results


    async def response(
        self,
        query: str,
        pdf_data: bytes
        ):
        
        msg = [
                {
                    'role': 'developer',
                    'content': 'Provide output in valid HTML only, no markdown, do not create a HTML style or title. If you use a page from the input file, reference the document always on its own line, section and the document page number like this: <cite>Reference: "info" page 1.</cite>'
                },
                {
                    'role': 'user',
                    'content': [
                        {
                            'type': 'file',
                            'source_type': 'base64',
                            'data': pdf_data,
                            'mime_type': 'application/pdf',
                            'filename': 'document.pdf'
                        },
                        {
                            'type': 'text',
                            'text': query
                        }
                    ]
                }
            ]

        async for event in self.llm.astream_events(msg):
            if event['event'] == 'on_chat_model_start':
                continue
                # print(event['event'])
            elif event['event'] == 'on_chat_model_stream':
                # print(event['data']['chunk'].content, end='', flush=True)
                yield event
            elif event['event'] == 'on_chat_model_end':
                # print()
                # print(event['event'])
                yield event
