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
from config.config import RAGConfig


class MetadataCallback(BaseCallbackHandler):
    def __init__(self):
        self.metadata = {}

    def on_llm_start(self, serialized, prompts, **kwargs):
        self.metadata["run_id"] = str(kwargs.get("run_id"))
        self.metadata["model_name"] = serialized['kwargs'].get("model_name")

    def on_llm_end(self, response, run_id, **kwargs):
        print(response.generations[0][0].generation_info, flush=True)
        metadata = response.generations[0][0].generation_info

        if metadata:
            self.metadata["run_id"] = str(run_id)
            self.metadata["model_name"] = metadata.get("model_name", "")

            usage = metadata.get("token_usage", {})
            self.metadata["prompt_tokens"] = usage.get("prompt_tokens", 0)
            self.metadata["completion_tokens"] = usage.get("completion_tokens", 0)
            self.metadata["total_tokens"] = usage.get("total_tokens", 0)
            # self.metadata['input_token_details'] = usage.get("input_token_details", {})


class Citations(BaseModel):
    document_name: str
    page_labels: List[str]
    pdf_page_numbers: List[int]


class ResponseMetadata(BaseModel):
    run_id: str
    model_name: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ResponseOutput(BaseModel):
    content: str
    summary_title: str
    citations: List[Citations]
    response_metadata: ResponseMetadata


    def fill_metadata(self, metadata: MetadataCallback) -> None:
        self.response_metadata = ResponseMetadata(
            run_id=metadata.metadata.get('run_id', ''),
            model_name=metadata.metadata.get('model_name', ''),
            prompt_tokens=metadata.metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.metadata.get('completion_tokens', 0),
            total_tokens=metadata.metadata.get('total_tokens', 0),
    )


    def update_citation_pages(self, new_pdf_pages: list[int], new_page_labels: list[str], document_name: str) -> None:
        for citation in self.citations:
            print(citation.model_dump(), flush=True)
            if citation.document_name == document_name:
                print(citation.pdf_page_numbers, citation.page_labels, flush=True)
                try:
                    try:
                        citation.pdf_page_numbers = [new_pdf_pages[page - 1] + 1 for page in citation.pdf_page_numbers]
                        citation.page_labels = [new_page_labels[page - 1] for page in citation.pdf_page_numbers]
                    except:
                        citation.pdf_page_numbers = [new_pdf_pages[new_page_labels.index(page_label)] for page_label in citation.page_labels]
                        citation.page_labels = [new_page_labels[new_pdf_pages.index(page)] for page in citation.pdf_page_numbers]
                except:
                    print(f"Could not update citation pages for document {document_name}", flush=True)


class RerankedDocument(BaseModel):
    pk: str
    document_name: str
    pages: List[int]
    page_labels: List[int]
    score: float


    def values(self) -> Tuple[str, List[int], List[int], float]:
        return (self.document_name, self.pages, self.page_labels, self.score)
    

class RerankResults(BaseModel):
    documents: List[RerankedDocument]
    # response_metadata: ResponseMetadata


    def fill_metadata(self, metadata: MetadataCallback) -> None:
        self.response_metadata = ResponseMetadata(
            run_id=metadata.metadata.get('run_id', ''),
            model_name=metadata.metadata.get('model_name', ''),
            prompt_tokens=metadata.metadata.get('prompt_tokens', 0),
            completion_tokens=metadata.metadata.get('completion_tokens', 0),
            total_tokens=metadata.metadata.get('total_tokens', 0),
    )


    def __getitem__(self, index: int) -> RerankedDocument:
        return self.documents[index]
    

    def __iter__(self):
        for doc in self.documents:
            yield doc
    

    def __len__(self) -> int:
        return len(self.documents)
    

    def filter_by_score(self, threshold: float) -> Self:
        filtered_docs = [doc for doc in self.documents if doc.score > threshold]
        return RerankResults(documents=filtered_docs)
    

    def merge_same_documents(self):
        for i in range(len(self.documents)):
            for j in range(len(self.documents) - 1, i, -1):
                if self.documents[i].document_name == self.documents[j].document_name:
                    # Merge page labels and pages
                    self.documents[i].page_labels = list(set(self.documents[i].page_labels + self.documents[j].page_labels))
                    self.documents[i].pages = list(set(self.documents[i].pages + self.documents[j].pages))
                    # Remove the duplicate document
                    del self.documents[j]

        return self


def setup_RAG(config: RAGConfig) -> Tuple[VectorStoreRetriever, ChatOpenAI]:
    db_uri = f'http://{os.environ["MILVUS_HOST"]}:{os.environ["MILVUS_PORT"]}'
    vector_db = Milvus(
        embedding_function=OpenAIEmbeddings(model=config.embedding_model),
        connection_args={
            'uri': db_uri,
            'token': 'root:Milvus',
            'db_name': config.vector_db_name
        },
        index_params={
            "index_type": config.index_type,
            "metric_type": config.metric_type,
        },
        consistency_level="Strong"
    )
    retriever = vector_db.as_retriever(
        search_type=config.search_type,
        search_kwargs=config.search_kwargs
    )

    llm = {}
    for model in config.llm_models:
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

    return retriever, llm, rerank_chain


def format_documents(documents: List[Document]) -> List[Dict[str, str]]:
    return [
        {'document': doc.page_content, 'metadata': doc.metadata} for doc in documents
    ]


def retrieve_documents(retriever: VectorStoreRetriever, prompt: str, k: int = 0, rerank=None, **kwargs) -> str|None:
    pdf_data = []
    if k == 0:
        return []

    vector_results = retriever.invoke(prompt, k=k, **kwargs)

    if rerank is not None:
        formatted_docs = format_documents(vector_results)
        callback = MetadataCallback()
        results: RerankResults = rerank.invoke(
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


def generate_session_name(llm: ChatOpenAI, prompt: str) -> str:
    response = llm.invoke(
        [{
            'role': 'system',
            'content': 'Summarize this user input and response into a short chat title. Ignore the HTML formatting off the user input.'
        },
        {
            'role': 'user',
            'content': prompt
        }]
    )
    return response.content



    
def generate_response(prompt: str, llm: ChatOpenAI, pdf_data: str|None = None) -> ResponseOutput:
    prompt_template = ChatPromptTemplate.from_messages([
        (
            'system',
            'You answer the questions only using provided PDF document pages.\n'\
            'Use document names from provided documents: {document_name}\n'\
            'Provide only valid HTML output, no markdown and do not create a HTML style or title.\n'\
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
    response: ResponseOutput = (prompt_template | llm.with_structured_output(schema=ResponseOutput)).invoke(
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
