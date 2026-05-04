from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.postgres import PostgresSaver
from langchain_core.callbacks.base import BaseCallbackHandler
from openai import RateLimitError, BadRequestError
import orjson
import logging
from pydantic import BaseModel, Field
from time import time
from uuid import uuid4

from .pydantic_classes import State, ResponseOutput
from database import new_response, new_citation, new_semantic_cache, POSTGRES_URL
from .graph_nodes import cache_node, generate_response_or_retrieve_documents, retrieve_documents, generate_answer, get_summary_node
from config import CONFIG

logger = logging.getLogger("RAG")

def extract_token_usage(result) -> dict[str, int]:
    if result.llm_output and "token_usage" in result.llm_output:
        return result.llm_output["token_usage"]

    # fallback to first generation
    gen = result.generations[0][0]
    return gen.usage_metadata


class TokenUsage(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    reasoning_tokens: int = 0


class ResponseMetadata(BaseCallbackHandler):
    run_id: str = ''
    token_usage: TokenUsage = TokenUsage()

    def on_llm_end(self, response, run_id, **kwargs):
        self.run_id = run_id

        token_usage = extract_token_usage(response)

        self.token_usage.prompt_tokens += token_usage.get('prompt_tokens', 0)
        self.token_usage.completion_tokens += token_usage.get('completion_tokens', 0)
        self.token_usage.total_tokens += token_usage.get('total_tokens', 0)

        details = token_usage.get('completion_tokens_details', {})
        self.token_usage.reasoning_tokens += details.get('reasoning_tokens', 0)


    def __repr__(self):
        return (
            f'ResponseMetadata(run_id={self.run_id}, '
            f'TokenUsage({self.token_usage}))'
        )
    

    def as_dict(self) -> dict[str, int]:
        return {
            'run_id': self.run_id,
            'token_usage': self.token_usage.model_dump()
        }
    

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
    session_id: str,
    response_id: str|None = None,
    check_cache: bool = True,
):
    start_time = time()
    logger.info(f"Generating response for session_id: {session_id}, user_id: {user_id}, prompt: {prompt}")

    callback = ResponseMetadata()
    with PostgresSaver.from_conn_string(POSTGRES_URL) as checkpointer:
        config = {
            'configurable': {
                'thread_id': session_id
            }
        }

        graph = setup_graph(checkpointer)
        graph = graph.with_config({'callbacks': [callback]})

        try:
            for chunk in graph.stream(
                {
                    'messages': {
                        'role': 'user',
                        'content': prompt
                    },
                    'check_cache': check_cache and CONFIG.rag.use_cache
                },
                config
            ):
                for node, content in chunk.items():
                    logger.info((
                        f"Run ID: {callback.run_id} - "
                        f"Node: {node}, Tokens generated this session {session_id}:" 
                        f" Prompt tokens: {callback.token_usage.prompt_tokens}" 
                        f" - Completion tokens: {callback.token_usage.completion_tokens}" 
                        f" - Total tokens: {callback.token_usage.total_tokens}" 
                    ))

                    if node == 'semantic_cache':
                        if content is None:
                            logger.info(f"No semantic cache hit for prompt: {prompt}")
                            continue
                        else:
                            logger.info(f"Semantic cache hit for prompt: {prompt}")

                        data = content['cache']

                        response = ResponseOutput(**data)
                        response_id = response_id if response_id else str(uuid4())

                        yield orjson.dumps({
                            'node': node,
                            'content': data,
                            'response_id': response_id,
                            'metadata': callback.as_dict()
                        }) + b"\n"

                    elif node == 'generate_answer':
                        response: ResponseOutput = content['parsed']
                        response_id = response_id if response_id else callback.run_id
                        yield orjson.dumps({
                            'node': node,
                            'content': response.model_dump(),
                            'response_id': response_id,
                            'metadata': callback.as_dict()
                        }) + b"\n"

                        if check_cache:
                            new_semantic_cache(
                                prompt, 
                                response
                            )

        except RateLimitError as e:
            logger.error(f"OpenAI rate limit / quota exceeded for session {session_id}: {e}")
            yield orjson.dumps({'node': 'error', 'error': 'rate_limit'}) + b"\n"
            return
        except BadRequestError as e:
            logger.error(f"OpenAI bad request (context too long?) for session {session_id}: {e}")
            yield orjson.dumps({'node': 'error', 'error': 'bad_request'}) + b"\n"
            return

        insert_into_database(
            prompt,
            user_id,
            session_id,
            response,
            response_id
        )
        
    logger.info(f"Finished generating response in {time() - start_time:.2f} seconds")


def insert_into_database(
    prompt: str,
    user_id: str,
    session_id: str,
    response: ResponseOutput,
    response_id: str,
):
    new_response(
        user_id=user_id,
        session_id=session_id,
        response_id=response_id,
        session_name=response.summary_title,
        prompt=prompt,
        response=response.response,
        cache_id=response.cache_id
    )

    for citation in response.citations:
        new_citation(
            response_id=response_id,
            document_name=citation.document_name,
            page_labels=';'.join(map(str, citation.page_labels)),
            page_indices=';'.join(map(str, citation.page_indices))
        )