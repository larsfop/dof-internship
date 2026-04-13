from langchain_openai import ChatOpenAI
from config import CONFIG


def get_model() -> ChatOpenAI:
    rag_config = CONFIG.rag
    return ChatOpenAI(
        model=rag_config.llm_models['summary_model'].model,
        **rag_config.llm_models['summary_model'].kwargs,
    )


def get_summary_model() -> ChatOpenAI:
    return get_model().bind(max_tokens=512)


def get_response_model() -> ChatOpenAI:
    rag_config = CONFIG.rag
    return ChatOpenAI(
        model=rag_config.llm_models['response_model'].model,
        **rag_config.llm_models['response_model'].kwargs,
    )


def get_check_model() -> ChatOpenAI:
    rag_config = CONFIG.rag
    return ChatOpenAI(
        model=rag_config.llm_models['retriever_model'].model,
        **rag_config.llm_models['retriever_model'].kwargs,
    )