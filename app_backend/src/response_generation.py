from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres import PostgresSaver  
import os
import orjson

from pydantic_classes import State, ResponseMetadata, ResponseOutput
from graph_nodes import cache_node, generate_response_or_retrieve_documents, retrieve_documents, generate_answer, summary_node
from database import new_response, new_citation, new_semantic_cache_embedding

def setup_graph(
    checkpointer: PostgresSaver
) -> CompiledStateGraph:
    checkpointer.setup()

    builder = StateGraph(State)
    builder.add_node('semantic_cache', cache_node)
    builder.add_node('use_rag', generate_response_or_retrieve_documents)
    builder.add_node(retrieve_documents)
    builder.add_node(generate_answer)
    builder.add_node('summary', summary_node)

    builder.add_edge(START, 'semantic_cache')
    builder.add_edge('retrieve_documents', 'generate_answer')
    builder.add_edge('generate_answer', 'summary')
    builder.add_edge('summary', END)

    graph = builder.compile(
        checkpointer=checkpointer,
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
    # db_uri = 'postgresql://postgres:admin125@localhost:5435/postgres?sslmode=disable'
    callback = ResponseMetadata()
    print("Starting graph execution...", flush=True)
    with PostgresSaver.from_conn_string(db_uri) as checkpointer:
        config = {
            'configurable': {
                'thread_id': session_id
            }
        }

        graph = setup_graph(
            checkpointer
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
            for node, content in chunk.items():
                if node == 'semantic_cache':
                    if content is None:
                        print("No cache hit.", flush=True)
                        continue

                    data = content['cache']
                    print("Cache hit found. Score: ", data['similarity_score'], flush=True)
                    yield orjson.dumps({
                        'node': node,
                        'content': data
                    })

                elif node == 'summary':
                    yield orjson.dumps({
                        'node': node,
                    })

                elif node == 'generate_answer':
                    response: ResponseOutput = content['parsed']
                    yield orjson.dumps({
                        'node': node,
                        'content': response.model_dump(),
                        'metadata': callback.as_dict()
                    })

                    insert_into_database(
                        prompt,
                        user_id,
                        session_id,
                        response,
                        callback
                    )

        print("Graph execution completed.", flush=True)
        print("Token usage:", callback.token_usage, flush=True)


def insert_into_database(
    prompt: str,
    user_id: str,
    session_id: str,
    response: ResponseOutput,
    callback: ResponseMetadata
):
    # Store response and citations in the database
    new_response(
        user_id=user_id,
        session_id=session_id,
        response_id=str(callback.run_id),
        session_name=response.summary_title,
        prompt=prompt,
        response=response.response
    )

    for citation in response.citations:
        new_citation(
            response_id=str(callback.run_id),
            document_name=citation.document_name,
            page_labels=';'.join(map(str, citation.page_labels)),
            pdf_pages=';'.join(map(str, citation.pdf_page_indices))
        )

    new_semantic_cache_embedding(
        prompt, 
        response
    )
