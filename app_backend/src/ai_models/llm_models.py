from langchain_openai import ChatOpenAI, OpenAIEmbeddings
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


def get_embedding_model() -> OpenAIEmbeddings:
    rag_config = CONFIG.rag
    return OpenAIEmbeddings(model=rag_config.embedding_model)


def get_partition_model() -> ChatOpenAI:
    partition_model = CONFIG.partition.llm_model
    return ChatOpenAI(
        model=partition_model.model,
        **partition_model.kwargs,
    )


if __name__ == "__main__":
    model = get_check_model()
    response = model.invoke("What is 2+2?")
    print(response)