from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres import PostgresSaver  
from langgraph.store.postgres import PostgresStore

from pydantic_classes import State
from graph_nodes import generate_response_or_retrieve_documents, retrieve_documents, generate_answer, summary_node

def setup_graph(
    checkpointer: PostgresSaver,
    store: PostgresStore
) -> CompiledStateGraph:
    checkpointer.setup()
    store.setup()

    builder = StateGraph(State)
    builder.add_node(retrieve_documents)
    builder.add_node(generate_answer)
    builder.add_node(summary_node)

    builder.add_conditional_edges(
        START,
        generate_response_or_retrieve_documents()
    )
    builder.add_edge('retrieve_documents', 'summary_node')
    builder.add_edge('summary_node', 'generate_answer')
    builder.add_edge('generate_answer', END)

    graph = builder.compile(
        checkpointer=checkpointer,
        store=store
    )

    return graph


def generate_response(
    prompt: str,
    user_id: str,
    session_id: str
):
    config = {
        'configurable': {
            'user_id': user_id,
            'thread_id': session_id
        }
    }

    graph = setup_graph(
        checkpointer=PostgresSaver(),
        store=PostgresStore()
    )

    for chunk in graph.stream(
        {
            'messages': {
                'role': 'user',
                'content': prompt
            }
        },
        config
    ):
        yield chunk
