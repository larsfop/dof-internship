from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import HumanMessage, trim_messages
from langchain_core.runnables.config import RunnableConfig
from langgraph.store.memory import BaseStore

from ..utils import get_model, get_response_model, State, ResponseOutput
from config import CONFIG

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
        HumanMessage([
            {'type': 'text', 'text': CONFIG.prompts['response_prompt'][1]['human'][0]},
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
    chain = prompt | get_response_model().with_structured_output(ResponseOutput)
    response = chain.invoke({
        'summary': summary,
        'document_names': ", ".join([doc.name for doc in docs]),
        'question': question
    })

    for pdf in docs:
        response.update_citation_pages(
            new_pdf_pages=pdf.pages,
            new_page_labels=pdf.pageLabels,
            document_name=pdf.name
        )

    return {'messages': [response.response], 'parsed': response, 'documents': []}