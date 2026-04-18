from langchain_core.prompts import ChatPromptTemplate
import logging

from config import CONFIG
from ..pydantic_classes import GradeResults, State
from ..pdf import create_pdfs_from_embeddings
from ai_models import get_check_model
from database import get_vector_retriever

logger = logging.getLogger("RAG")

def retrieve_documents(state: State):

    question = state['messages'][-1].content
    documents = get_vector_retriever().invoke(question)

    logger.info(
        f"Retrieved {len(documents)} documents:\n"\
        f"{'\n'.join([f'{doc.metadata['document_name']} ; Pages: {doc.metadata['page_indices']}' for doc in documents])}\n"
    )

    prompt = ChatPromptTemplate.from_messages([
        (key, value) for item in CONFIG.prompts['retrieval_prompt'] for key, value in item.items()
    ])

    chain = prompt | get_check_model().with_structured_output(schema=GradeResults)
    response: GradeResults = chain.invoke({
        'question': question,
        'documents': [{'document': doc.page_content, 'metadata': doc.metadata} for doc in documents]
    })

    logger.info(
        f"Grading results for retrieved documents:\n"\
        f"{'\n'.join([f'{doc.document_name} ; Score: {doc.score} ; page indices: {doc.page_indices}' for doc in response.documents])}\n"
    )

    pdf_data = create_pdfs_from_embeddings(response)

    return {'documents': pdf_data}