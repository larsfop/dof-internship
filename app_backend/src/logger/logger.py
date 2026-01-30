import logging
import tomllib
import atexit
from pathlib import Path
import json

def setup_logger(config_path: Path) -> None:
    with config_path.open('rb') as f:
        config = tomllib.load(f)

    logging.config.dictConfig(config)

    queue_handler = logging.getHandlerByName('queue_handler')
    if queue_handler is not None:
        queue_handler.listener.start()
        atexit.register(queue_handler.listener.stop)