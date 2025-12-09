from langchain_core.vectorstores.base import VectorStoreRetriever
from langchain_milvus import Milvus
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain_core.documents import Document
from langchain_core.runnables.schema import StreamEvent
from langchain_core.prompts import ChatPromptTemplate, HumanMessagePromptTemplate
from langchain_core.messages import HumanMessage
from langchain_core.callbacks import UsageMetadataCallbackHandler
from langchain_core.callbacks.base import BaseCallbackHandler

from uuid import uuid4
import os
import re
import json
from _collections_abc import AsyncIterator
from typing import Self, Tuple, List, Dict
from pydantic import BaseModel

from logger.logger import Logger
from database import new_response
from pdf import create_pdfs_from_embeddings
from config.config import load_config, Config, RAGConfig
from pydantic_classes import MetadataCallback, ResponseOutput, RerankResults


DATA_PATH = os.environ['DATA_PATH']
CONFIG: Config = load_config(DATA_PATH + 'config.yaml')
CONFIG_RAG: RAGConfig = CONFIG.rag_config


db_uri = f'http://{os.environ["MILVUS_HOST"]}:{os.environ["MILVUS_PORT"]}'
vector_db = Milvus(
    embedding_function=OpenAIEmbeddings(model=CONFIG_RAG.embedding_model),
    connection_args={
        'uri': db_uri,
        'token': 'root:Milvus',
        'db_name': CONFIG_RAG.vector_db_name
    },
    index_params={
        "index_type": CONFIG_RAG.index_type,
        "metric_type": CONFIG_RAG.metric_type,
    },
    consistency_level="Strong"
)
retriever = vector_db.as_retriever(
    search_type=CONFIG_RAG.search_type,
    search_kwargs=CONFIG_RAG.search_kwargs
)

llm = {}
for model in CONFIG_RAG.llm_models:
    llm[model] = ChatOpenAI(
        model=model,
        api_key=os.environ['OPENAI_API_KEY'],
        streaming=True,
    )

rerank_llm = ChatOpenAI(
    model='gpt-4.1',
    temperature=0,
)
rerank_prompt = ChatPromptTemplate.from_messages([
    ('system', 'You are an expert at reranking documents with score between 0 and 1 based on their relevance to a user query.'),
    ('user',
        'Query:\n{query}\n\n'
        'Documents:\n{documents}\n\n'
        'Return a JSON object containing a list of {schema}.'
    )
])

rerank_chain = rerank_prompt | rerank_llm.with_structured_output(schema=RerankResults)


def format_documents(documents: List[Document]) -> List[Dict[str, str]]:
    """
    Formats a list of Document objects into a list of dictionaries.
    
    :param documents: List of Document objects to format
    :type documents: List[Document]
    :return: List of dictionaries with document content and metadata
    :rtype: List[Dict[str, str]]
    """
    return [
        {'document': doc.page_content, 'metadata': doc.metadata} for doc in documents
    ]


def generate_response_from_prompt(
    prompt: str,
    llm_model: str,
    embed_depth: int
) -> ResponseOutput:
    pdf_data = retrieve_documents(
        prompt,
        embed_depth,
    )

    response = generate_response(
        prompt,
        llm_model,
        pdf_data
    )

    return response


def retrieve_documents(
    prompt: str, 
    k: int = 0, 
    rerank: bool = True, 
    **kwargs
) -> str|None:
    
    pdf_data = []
    if k == 0:
        return []

    vector_results = retriever.invoke(prompt, k=k, **kwargs)

    if rerank:
        formatted_docs = format_documents(vector_results)
        callback = MetadataCallback()
        results: RerankResults = rerank_chain.invoke(
            {
                'query': prompt,
                'documents': formatted_docs,
                'schema': 'RerankedDocument objects'
            },
            config={'callbacks': [callback]}
        )
        # results.fill_metadata(callback)

        print(results, flush=True)

    if len(vector_results) > 0:
        pdf_data = create_pdfs_from_embeddings(results)

    return pdf_data

    
def generate_response(
    prompt: str, 
    llm_model: str, 
    pdf_data: str|None = None
) -> ResponseOutput:
    
    prompt_template = ChatPromptTemplate.from_messages([
        (
            'system',
            'You answer the questions only using provided PDF document pages.\n'\
            'Use document names from provided documents: {document_name}\n'\
            # 'Provide only valid HTML output, no markdown and do not create a HTML style or title.\n'\
        ),
        HumanMessage(content=[
            {
                'type': 'file', 
                'source_type': 'base64',
                'mime_type': 'application/pdf', 
                'data': pdf['data'],
                'filename': pdf['name']
            }
             for pdf in pdf_data]),
        (
            'user',
            'Question: {prompt}\n\n'\
        )
    ])

    callback = MetadataCallback()
    response: ResponseOutput = (prompt_template | llm[llm_model].with_structured_output(schema=ResponseOutput)).invoke(
        {
            'prompt': prompt, 
            'document_name': [pdf['name'] for pdf in pdf_data], 
            },
            config={'callbacks': [callback]}
        )

    response.fill_metadata(callback)
    
    print(callback, flush=True)

    # Hard update the label and pdf page numbers after response generation, since ai is a bit of a dum-dum
    for pdf in pdf_data:
        response.update_citation_pages(pdf['pages'], pdf['page_labels'], pdf['name'])

    return response
