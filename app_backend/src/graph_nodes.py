
from typing import Literal, List, Dict
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.documents import Document
from langchain_postgres import PGVector
from langchain_core.runnables.config import RunnableConfig
from langchain_core.messages import HumanMessage, AIMessage, trim_messages
from langgraph.store.memory import BaseStore
from langgraph.types import Command
from langmem import create_search_memory_tool, create_manage_memory_tool
from langmem.short_term import SummarizationNode

import os
import psycopg
from pathlib import Path

from pydantic_classes import CheckResponse, State, GradeResults, DocumentPDF, ResponseMetadata, ResponseOutput
from pdf import create_pdfs_from_embeddings
from config.config import load_config, Config, RAGConfig
from database import fetch_from_semantic_cache

DATA_PATH = Path(os.environ['DATA_PATH'])
# DATA_PATH = Path('../volumes/data/')
CONFIG: Config = load_config(DATA_PATH / 'config.yaml')
CONFIG_RAG: RAGConfig = CONFIG.rag_config

# Setup RAG vector database
db_uri = 'postgresql+psycopg://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
    user=os.environ['POSTGRES_USER'],
    password=os.environ['POSTGRES_PASSWORD'],
)
# db_uri = 'postgresql+psycopg://postgres:admin125@localhost:5435/postgres?sslmode=disable'
embeddings = OpenAIEmbeddings(model='text-embedding-3-large')
vector_store = PGVector(
    embeddings=embeddings,
    embedding_length=3072,
    connection=db_uri,
    collection_name='document_store',
    use_jsonb=True,
)
retriever = vector_store.as_retriever(
    search_type=CONFIG_RAG.search_type,
    search_kwargs=CONFIG_RAG.search_kwargs
)

# Setup LLMs
model = ChatOpenAI(model='gpt-4.1')
summary_model = model.bind(max_tokens=512)

# Output response model
response_model = ChatOpenAI(
    model='o4-mini',
)

# Model to check if document retrieval is necessary and rerank documents
check_model = ChatOpenAI(
    model='gpt-4.1',
    temperature=0
)

# Setup memory tools and nodes

summary_node = SummarizationNode(
    token_counter=model.get_num_tokens_from_messages,
    model=summary_model,
    max_tokens=1024,
    max_tokens_before_summary=128,
    max_summary_tokens=512,
)

def cache_node(state: State) -> Command[Literal['summary', 'use_rag']]:
    state['cache'] = None
    prompt = state['messages'][-1].content

    # Check semantic cache for similar prompt
    data = fetch_from_semantic_cache(prompt)
    print(data, flush=True)

    if data is None or data['similarity_score'] < 0.8:
        return Command(goto='use_rag')
    
    return Command(
        update={
            'messages': data['response'],
            'cache': data
        },
        goto='summary'
    )


check_prompt = (
    'You are an expert at determining whether a user query requires retrieving documents.\n'
    'Determine wether it is necessary to retrieve documents relevant to Eurocodes or the CADiNP language from the SOFiSTiK documentation '
    'in order to answer the user query accurately.\n'
    'Give a binary scrore "yes" or "no" to decide to retrieve documents or not.\n'
    'User question: {question}'
)


def generate_response_or_retrieve_documents(state: State) -> Command[Literal['generate_answer', 'retrieve_documents']]:
    """Determine whether to generate an answer or retrieve documents based on the prompt."""

    question = state['messages'][-1].content

    prompt = check_prompt.format(question=question)    
    response = check_model.with_structured_output(schema=CheckResponse).invoke(
        [{'role': 'user', 'content': prompt}]
    )
    
    if response.retrieve_documents == 'yes':
        print("Retrieving documents for the user query.", flush=True)
        return Command(goto='retrieve_documents')
    else:
        print("Generating answer without document retrieval.", flush=True)
        return Command(goto='generate_answer')
    

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


grade_prompt = (
    'You are an expert at reranking documents with score between 0 and 1 based on their relevance to a user query.\n'
    'Question: {question}\n\n'
    'Documents:\n{documents}\n\n'
)

def retrieve_documents(state: State):

    question = state['messages'][-1].content
    documents = retriever.invoke(question)

    for doc in documents:
        print(f'Document: {doc.metadata["document_name"]} ; Pages: {doc.metadata["page_indices"]}', flush=True)

    prompt = grade_prompt.format(
        question=question,
        documents=format_documents(documents)
    )

    response: GradeResults = (
        check_model
        .with_structured_output(schema=GradeResults
        ).invoke([{'role': 'user', 'content': prompt}])
    )

    for result in response:
        print(f'Document: {result.document_name} ; Pages: {result.pages} ; Score: {result.score}', flush=True)

    pdf_data = create_pdfs_from_embeddings(response)

    return {'documents': pdf_data}


def create_prompt(question: str, documents: list[DocumentPDF], summary: str):
    document_names = ", ".join([doc.name for doc in documents])
    prompt = [
        {
            "role": "system",
            "content": (
                "You are an assistant for question-answering tasks.\n"
                "Use provided documents to answer the question as accurately as possible.\n"
                "Provide only valid HTML output, no markdown and do not create a HTML style or title.\n"
                f"Use the following document names: {document_names}\n"
                f'Summary of previous prompts: {summary}'
            )
        
        },
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": f"Question: {question}"
                }
            ]
        }
    ]
    for doc in documents:
        prompt[1]["content"].append(
            {
                "type": "file",
                "source_type": "base64",
                "mime_type": "application/pdf",
                "data": doc.data,
                "filename": doc.name
            }
        )
    return prompt


def generate_answer(
    state: State,
    config: RunnableConfig,
    *,
    store: BaseStore,
):
    """Generate an answer based on the provided context and question.
    
    :param state: The current message state containing user messages and context
    :type state: MessagesState
    """

    question = state['messages'][-1].content
    short_term_memory = trim_messages(
        state['messages'][:-1],
        max_tokens=2048,
        token_counter=model.get_num_tokens_from_messages,
    )

    docs = state.get('documents', [])
    summary = state.get('context', '')

    prompt = create_prompt(question, docs, summary)

    # response = response_model.invoke(state['messages'] + prompt)
    response: ResponseOutput = (
        response_model.with_structured_output(ResponseOutput
        ).invoke(short_term_memory + prompt)    
    )

    for pdf in docs:
        print(pdf.name, pdf.pages, pdf.page_labels)
        response.update_citation_pages(
            new_pdf_pages=pdf.pages,
            new_page_labels=pdf.page_labels,
            document_name=pdf.name
        )

    return {'messages': [response.response], 'parsed': response, 'documents': []}

