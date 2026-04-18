from langgraph.types import Command
from typing import Literal
from langchain_core.prompts import ChatPromptTemplate
from langchain_openai import ChatOpenAI
from pydantic import BaseModel, Field
import logging

from ..pydantic_classes import State
from ai_models import get_check_model
from config import CONFIG

logger = logging.getLogger("RAG")
model = ChatOpenAI(
    model="gpt-5.4",
    temperature=0,
)

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
    chain = prompt | model.with_structured_output(schema=CheckResponse)
    response: CheckResponse = chain.invoke({'question': question})
    logger.info(f"Response: {response} - Decided to {'retrieve documents' if response.retrieve_documents == 'yes' else 'generate answer'}")
    if response.retrieve_documents == 'yes':
        return Command(goto='retrieve_documents')
    else:
        return Command(goto='generate_answer')
    