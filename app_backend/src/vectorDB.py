from langchain_milvus import Milvus
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document

import tiktoken
import pymupdf
from uuid import uuid4
import os
import re
import json
import asyncio

from logger.logger import Logger
from database import new_response


class chatbot_pipeline:
    def __init__(
            self,
            embedding_model: str = "text-embedding-3-large",
            vector_db_name: str = "document_embeddings",
            db_uri: str = None,
            llm_model: str = "o4-mini",
        ) -> None:

        host = os.environ['MILVUS_HOST']
        port = os.environ['MILVUS_PORT']

        if not db_uri:
            db_uri = f'http://{host}:{port}'

        self.vector_store = Milvus(
            embedding_function=OpenAIEmbeddings(model=embedding_model),
            connection_args={
                'uri': db_uri,
                'token': 'root:Milvus',
                'db_name': vector_db_name
            },
            index_params={
                "index_type": "FLAT",
                "metric_type": "L2",
            },
            consistency_level="Strong"
        )

        # self.llm = ChatOpenAI(
        #     model=llm_model,
        #     api_key=os.environ['OPENAI_API_KEY'],
        #     streaming=True,
        # )
        self.llm = {
            'o4-mini': ChatOpenAI(
                model='o4-mini',
                api_key=os.environ['OPENAI_API_KEY'],
                streaming=True,
            ),
            'gpt-4.1': ChatOpenAI(
                model='gpt-4.1',
                api_key=os.environ['OPENAI_API_KEY'],
                streaming=True,
            )
        }

        self.page_label_regex = re.compile(r'^\d{1,3}')


    def extract_page_label(self, page: pymupdf.Page) -> str|None:
        if page.number % 2:
            label = page.get_textbox(pymupdf.Rect(42, 784, 100, 808)).strip()
        else:
            label = page.get_textbox(pymupdf.Rect(400, 784, 564, 808)).strip()

        match = self.page_label_regex.search(label)
        
        return match

    def fill_vector_store(
            self, 
            document,
            name: str,
            chunk_size: int = 800,
            chunk_overlap: int = 400,
            tokenizer: str = "cl100k_base",
        ) -> None:

        tokenizer = tiktoken.get_encoding(tokenizer)
        rec: pymupdf.Rect = pymupdf.Rect(42, 72, 563, 772)

        doc = pymupdf.open(
            stream=document,
            filetype='pdf'
        )
        
        token_buffer = []
        page_buffer = []
        page_labels = []
        documents = []
        for page in doc:
            page_label = self.extract_page_label(page)
            # Skip page without valid label (e.g., title page, blank pages)
            if not page_label:
                continue

            page_label = page_label.group(0)

            text = page.get_textbox(rec).strip()
            tokens = tokenizer.encode(text)
            token_buffer.extend(tokens)
            page_buffer.append(page.number)
            page_labels.append(page_label)

            while len(token_buffer) >= chunk_size + chunk_overlap:
                chunk_tokens = token_buffer[:chunk_size + chunk_overlap]
                chunk_content = tokenizer.decode(chunk_tokens)

                # Create document from chunk
                metadata = {
                    'Document': name,
                    'pages': ';'.join(map(str, page_buffer)),
                    'page_labels': ';'.join(page_labels),
                }
                document = Document(
                    page_content=chunk_content,
                    metadata=metadata
                )

                documents.append(document)

                # Remove used tokens from buffer, keeping overlap tokens
                del token_buffer[:chunk_size + chunk_overlap // 2]


                if token_buffer:
                    page_buffer = page_buffer[-1:]
                    page_labels = page_labels[-1:]
                else:
                    page_buffer = []
                    page_labels = []


        if token_buffer:
            chunk_content = tokenizer.decode(token_buffer)

            metadata = {
                'Document': name,
                'pages': ';'.join(map(str, page_buffer)),
                'page_labels': ';'.join(page_labels),
            }
            document = Document(
                page_content=chunk_content,
                metadata=metadata
            )

            documents.append(document)

        self.vector_store.add_documents(
            documents,
            ids=[str(uuid4()) for _ in range(len(documents))]
        )

    def setup_retriever(
        self,
        search_type: str = "similarity",
        k: int = 10,
        **kwargs,
    ) -> None:

        self.retriever = self.vector_store.as_retriever(
            search_type=search_type,
            search_kwargs={
                'k': k,
                **kwargs,
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
        user_id: str,
        session_id: str,
        session_name: str,
        model: str,
        pdf_data: str|None = None,
        logger: None|Logger = None,
        page_corrections: dict|None = None
    ):
        is_streaming = False
        msg = [
            {
                'role': 'developer',
                'content': 'Provide output in valid HTML only, no markdown, do not create a HTML style or title. If you use a page from the input file, reference the document always on its own line, section and the document page number like this: <cite>Reference: "info" page 1.</cite>'
            },
            {
                'role': 'user',
                'content': [
                    {
                        'type': 'text',
                        'text': query
                    }
                ]
            }
        ]

        if pdf_data:
            msg[1]['content'].insert(0, {
                'type': 'file',
                'source_type': 'base64',
                'data': pdf_data,
                'mime_type': 'application/pdf',
                'filename': 'document.pdf'
            })

        if session_name.strip() == '':
            response = self.llm[model].invoke(
                [{
                    'role': 'system',
                    'content': 'Summarize this message into a short chat title.'
                },
                {
                    'role': 'user',
                    'content': query
                }]
            )
            session_name = response.content

        async for event in self.llm[model].astream_events(msg):
            if event['event'] == 'on_chat_model_start':
                logger.log_info(f'Response generation started')
                yield json.dumps({
                    'event': event['event'],
                    'id': event['run_id'],
                    'session_name': session_name
                }) + '\n'
            elif event['event'] == 'on_chat_model_stream':
                if not is_streaming:
                    is_streaming = True
                    logger.log_info(f'Begin response stream')
                yield json.dumps({
                    'event': event['event'],
                    'content': event['data']['chunk'].content
                }) + '\n'
            elif event['event'] == 'on_chat_model_end':
                data = event['data']['output']

                output = {
                    'response_id': event['run_id'],
                    'model': data.response_metadata['model_name'],
                    'token_usage': data.usage_metadata,
                    'content': data.content
                }

                if logger:
                    logger.log_response(output)

                logger.log_info(f'Response generation ended'
                                f' - Response ID: {event["run_id"]}'
                                f' - Token Usage: Input Tokens: {data.usage_metadata["input_tokens"]}, Output Tokens: {data.usage_metadata["output_tokens"]}, Total Tokens: {data.usage_metadata["total_tokens"]}'
                )

                if page_corrections:
                    output['page_corrections'] = page_corrections

                # Store response in database
                new_response(
                    user_id=user_id,
                    session_id=session_id,
                    response_id=event['run_id'],
                    session_name=session_name,
                    prompt=query,
                    response=data.content
                )

                yield json.dumps({'event': event['event']} | output) + '\n'
