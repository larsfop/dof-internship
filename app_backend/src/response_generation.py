from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres import PostgresSaver  
from langgraph.store.postgres import PostgresStore
import os
import orjson
from dataclasses import asdict

from pydantic_classes import State, ResponseMetadata, ResponseOutput
from graph_nodes import generate_response_or_retrieve_documents, retrieve_documents, generate_answer, summary_node
from database import new_response, new_citation

def setup_graph(
    checkpointer: PostgresSaver,
    store: PostgresStore
) -> CompiledStateGraph:
    checkpointer.setup()
    store.setup()

    builder = StateGraph(State)
    builder.add_node(retrieve_documents)
    builder.add_node(generate_answer)
    builder.add_node('summary', summary_node)

    builder.add_conditional_edges(
        START,
        generate_response_or_retrieve_documents
    )
    builder.add_edge('retrieve_documents', 'summary')
    builder.add_edge('summary', 'generate_answer')
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
    db_uri = 'postgresql://{user}:{password}@postgres:5432/postgres?sslmode=disable'.format(
        user=os.environ['POSTGRES_USER'],
        password=os.environ['POSTGRES_PASSWORD'],
    )
    callback = ResponseMetadata()
    with (
        PostgresSaver.from_conn_string(db_uri) as checkpointer,
        PostgresStore.from_conn_string(
            db_uri,
            index={
                'dims': 1536,
                'embed': 'openai:text-embedding-3-small'
            }
        ) as store
    ):
        config = {
            'configurable': {
                'user_id': user_id,
                'thread_id': session_id
            }
        }

        graph = setup_graph(
            checkpointer,
            store
        )
        graph = graph.with_config(
            {'callbacks': [callback]}
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
            # print('\n\n', chunk, '\n\n', flush=True)
            for node, content in chunk.items():
                if node == 'summary':
                    yield orjson.dumps({
                        'node': node,
                    })
                elif node == 'generate_answer':
                    response: ResponseOutput = content['parsed']
                    yield orjson.dumps({
                        'node': node,
                        'response': response.model_dump(),
                        'metadata': callback.as_dict()
                    })

        print("Graph execution completed.", flush=True)
        print("Token usage:", callback.token_usage, flush=True)

        # Store response and citations in the database
        new_response(
            user_id=user_id,
            session_id=session_id,
            response_id=str(callback.run_id),
            session_name=response.summary_title,
            prompt=prompt,
            response=response.answer
        )

        for citation in response.citations:
            new_citation(
                response_id=str(callback.run_id),
                document_name=citation.document_name,
                page_labels=';'.join(map(str, citation.page_labels)),
                pdf_pages=','.join(map(str, citation.pdf_page_indices))
            )
