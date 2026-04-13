import tomllib
import json
import threading
from typing import Optional, Any
from pydantic import BaseModel, Field
from pathlib import Path
from watchdog.observers.polling import PollingObserver
from watchdog.events import FileSystemEventHandler
import os
import logging
import logging.config
import atexit

class LLMConfig(BaseModel):
    model: str
    kwargs: Optional[dict] = Field(default_factory=dict)


class RAGConfig(BaseModel):
    llm_models: dict[str, LLMConfig]
    embedding_model: str
    embedding_dimensions: int
    collection_name: str
    index_type: str
    metric_type: str
    search_type: str
    search_kwargs: Optional[dict] = Field(default_factory=dict)


class PartitionConfig(BaseModel):
    pdf_dir_path: str
    output_dir_path: str
    strategy: str
    crop: list[int] = Field(default_factory=list)


data_path = Path(os.environ['DATA_PATH'])
config_path = data_path / 'configs'


class _Config:
    rag: RAGConfig
    logger: dict[str, Any]
    partition: PartitionConfig
    prompts: dict


def _load_logger(config: dict[str, Any]) -> None:
    logging.config.dictConfig(config)

    queue_handler = logging.getHandlerByName('queue_handler')
    if queue_handler is not None:
        queue_handler.listener.start()
        atexit.register(queue_handler.listener.stop)


def _load_config(cfg: _Config) -> None:
    with open(config_path / 'config.toml', 'rb') as file:
        config_data = tomllib.load(file)
        cfg.rag = RAGConfig(**config_data['rag_config'])
        cfg.logger = config_data['logger_config']
        cfg.partition = PartitionConfig(**config_data['partition_config'])

    with open(config_path / 'prompts.json', 'rb') as f:
        cfg.prompts = json.load(f)


class _ConfigReloadHandler(FileSystemEventHandler):
    _WATCHED = {'config.toml', 'prompts.json'}
    _lock = threading.Lock()

    def on_modified(self, event):
        if not event.is_directory and Path(event.src_path).name in self._WATCHED:
            logger.info(f"Configuration file '{event.src_path}' modified. Reloading configuration and logger.")
            with self._lock:
                _load_config(CONFIG)
                _load_logger(CONFIG.logger)


CONFIG = _Config()
_load_config(CONFIG)
_load_logger(CONFIG.logger)

logger = logging.getLogger("main")
logger.info("Configuration and logger loaded successfully.")

_observer = PollingObserver(timeout=5)
_observer.schedule(_ConfigReloadHandler(), str(config_path), recursive=False)
_observer.daemon = True
_observer.start()