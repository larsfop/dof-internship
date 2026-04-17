from langgraph.types import Command
from typing import Literal

from ..pydantic_classes import State
from database import fetch_from_semantic_cache

def cache_node(state: State) -> Command[Literal['summary', 'use_rag']]:
    state['cache'] = None
    prompt = state['messages'][-1].content

    # Check semantic cache for similar prompt
    data = fetch_from_semantic_cache(prompt)

    if data is None or data['similarity_score'] < 0.8:
        return Command(goto='use_rag')
    
    return Command(
        update={
            'messages': data['response'],
            'cache': data
        },
        goto='summary'
    )