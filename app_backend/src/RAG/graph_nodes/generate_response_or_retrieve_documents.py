from langgraph.types import Command
from typing import Literal
from langchain_core.prompts import ChatPromptTemplate
from pydantic import BaseModel, Field

from ..utils import get_check_model, State
from config import CONFIG

class CheckResponse(BaseModel):
    """Determine whether to retrieve documents or generate an answer."""
    retrieve_documents: Literal['yes', 'no'] = Field(
        description="Whether to retrieve documents ('yes' or 'no')"
    )


def generate_response_or_retrieve_documents(state: State) -> Command[Literal['generate_answer', 'retrieve_documents']]:
    """Determine whether to generate an answer or retrieve documents based on the prompt."""

    question = state['messages'][-1].content


    prompt = ChatPromptTemplate.from_messages([
        (key, value) for item in CONFIG.prompts['check_prompt'] for key, value in item.items()
    ])
    chain = prompt | get_check_model().with_structured_output(schema=CheckResponse)
    response = chain.invoke({'question': question})
    
    if response.retrieve_documents == 'yes':
        return Command(goto='retrieve_documents')
    else:
        return Command(goto='generate_answer')
    