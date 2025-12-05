import yaml
from typing import ClassVar, Optional
from dataclasses import dataclass, asdict, field


@dataclass
class RAGConfig:
    llm_models: list[str]
    embedding_model: str
    vector_db_name: str
    index_type: str
    metric_type: str
    search_type: str
    search_kwargs: Optional[dict] = field(default_factory=dict)


    def as_dict(self) -> dict:
        return asdict(self)


@dataclass
class Config:
    rag_config: RAGConfig

    def __post_init__(self):
        self.rag_config = RAGConfig(**self.rag_config)

    
    def as_dict(self) -> dict:
        return asdict(self)


def load_config(config_path: str) -> Config:
    with open(config_path, 'r') as file:
        config_data = yaml.safe_load(file)

    return Config(**config_data)


if __name__ == "__main__":
    config = load_config('config.yaml')
    print(config)