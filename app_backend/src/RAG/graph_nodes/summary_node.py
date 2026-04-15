from langmem.short_term import SummarizationNode
from ai_models import get_summary_model, get_model


def get_summary_node() -> SummarizationNode:
    return SummarizationNode(
        token_counter=get_model().get_num_tokens_from_messages,
        model=get_summary_model(),
        max_tokens=1024,
        max_tokens_before_summary=128,
        max_summary_tokens=512,
    )