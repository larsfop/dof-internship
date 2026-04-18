from langgraph.types import Command
from typing import Literal
import logging

from ..pydantic_classes import State
from database import fetch_from_semantic_cache

logger = logging.getLogger("RAG")

def cache_node(state: State) -> Command[Literal['summary', 'retrieve_documents']]:
    state['cache'] = None

    if not state['check_cache']:
        return Command(goto='retrieve_documents')

    prompt = state['messages'][-1].content

    # Check semantic cache for similar prompt
    data = fetch_from_semantic_cache(prompt)

    if data:
        logger.debug(f"cache result for prompt '{prompt}': Score: {data['similarity_score']}")

    if data is None or data['similarity_score'] < 0.8:
        return Command(goto='retrieve_documents')
    
    return Command(
        update={
            'messages': data['response'],
            'cache': data
        },
        goto='summary'
    )