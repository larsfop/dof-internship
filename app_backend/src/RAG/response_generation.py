from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres import PostgresSaver  
import orjson
import logging
from functools import cache

logger = logging.getLogger("main")

from pydantic_classes import State, ResponseMetadata, ResponseOutput
from database import new_response, new_citation, new_semantic_cache, POSTGRES_URL
from .graph_nodes import cache_node, generate_response_or_retrieve_documents, retrieve_documents, generate_answer, get_summary_node

# @cache
def setup_graph(
    checkpointer: PostgresSaver
) -> CompiledStateGraph:
    checkpointer.setup()

    builder = StateGraph(State)
    builder.add_node('semantic_cache', cache_node)
    builder.add_node('use_rag', generate_response_or_retrieve_documents)
    builder.add_node(retrieve_documents)
    builder.add_node(generate_answer)
    builder.add_node('summary', get_summary_node())

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
    logger.info(f"Generating response for session_id: {session_id}, user_id: {user_id}, prompt: {prompt}")

    callback = ResponseMetadata()
    with PostgresSaver.from_conn_string(POSTGRES_URL) as checkpointer:
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
                        continue

                    data = content['cache']

                    response = ResponseOutput(**data)

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

                    # new_semantic_cache_embedding(
                    #     prompt, 
                    #     response
                    # )

        insert_into_database(
            prompt,
            user_id,
            session_id,
            response,
            callback
        )


def insert_into_database(
    prompt: str,
    user_id: str,
    session_id: str,
    response: ResponseOutput,
    callback: ResponseMetadata
):
    new_response(
        user_id=user_id,
        session_id=session_id,
        response_id=str(callback.run_id),
        session_name=response.summaryTitle,
        prompt=prompt,
        response=response.response
    )

    for citation in response.citations:
        new_citation(
            response_id=str(callback.run_id),
            document_name=citation.documentName,
            page_labels=';'.join(map(str, citation.pageLabels)),
            pdf_pages=';'.join(map(str, citation.pdfPages))
        )