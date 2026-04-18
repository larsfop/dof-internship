from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import AIMessage, HumanMessage, trim_messages
from langchain_core.runnables.config import RunnableConfig
from langgraph.store.memory import BaseStore
import logging

from ..pydantic_classes import State, ResponseOutput
from ..pdf import DocumentPDF
from ai_models import get_model, get_response_model
from config import CONFIG

logger = logging.getLogger("RAG")

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
        token_counter=get_model().get_num_tokens_from_messages,
    )

    docs = state.get('documents', [])
    summary = state.get('context', '')

    prompt = ChatPromptTemplate.from_messages([
        *short_term_memory,
        ('system', CONFIG.prompts['response_prompt'][0]['system']),
        ('human', CONFIG.prompts['response_prompt'][1]['human']),
        HumanMessage([
            *[
                {
                    "type": "file",
                    "source_type": "base64",
                    "mime_type": "application/pdf",
                    "data": doc.data,
                    "filename": doc.name
                } for doc in docs
            ]
        ])
    ])

    formatted_prompt = prompt.format_messages(
        summary=summary,
        document_names=", ".join([doc.name for doc in docs]),
        question=question
    )[:-1]
    logger.debug((
        f"Invoking model with prompt:\n"
        f"{'\n\n'.join([message.pretty_repr() for message in formatted_prompt])}\n"
    ))
    chain = prompt | get_response_model().with_structured_output(ResponseOutput)
    response: ResponseOutput = chain.invoke({
        'summary': summary,
        'document_names': ", ".join([doc.name for doc in docs]),
        'question': question
    })
    
    logger.debug(f"Citations before formatting: {response.citations}")
    format_citation_pages(response, docs)

    logger.debug(f"Generated response:\n{response.response}")
    logger.debug(f"Citations after formatting: {response.citations}")
    return {'messages': [AIMessage(response.response)], 'parsed': response, 'documents': []}


def format_citation_pages(response: ResponseOutput, documents: list[DocumentPDF]):
    for pdf in documents:
        if not pdf.name in response:
            continue

        citation = response[pdf.name]
        try:
            new_page_labels = [pdf.page_labels[index] for index in citation.page_indices]
            new_page_indices = [pdf.page_indices[index] + 1 for index in citation.page_indices]
        except:
            try:
                new_page_indices = [index for index, label in zip(pdf.page_indices, pdf.page_labels) if label in citation.page_labels]
                new_page_labels = [label for label in pdf.page_labels if label in citation.page_labels]
            except:
                logger.error(f"Failed to format citation pages for document {pdf.name} with indices {citation.page_indices} and labels {citation.page_labels}")
                new_page_indices = citation.page_indices
                new_page_labels = citation.page_labels

        citation.page_indices = new_page_indices
        citation.page_labels = new_page_labels