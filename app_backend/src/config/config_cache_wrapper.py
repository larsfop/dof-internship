import functools
from pydantic import BaseModel

def cache_with_config_key(config: BaseModel, *watched_keys: str):
    """Cache that invalidates when specified config keys change.

    Supports dot-notation for nested keys, e.g. 'rag.embedding_dimensions'.
    """
    def _get_nested(obj, key):
        for part in key.split('.'):
            obj = getattr(obj, part)
        return obj

    def _to_hashable(val):
        if hasattr(val, 'model_dump_json'):
            return val.model_dump_json()
        return val

    def decorator(func):
        memo = {}

        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            # Build cache key: function args + current config values (evaluated at call time)
            config_snapshot = tuple(_to_hashable(_get_nested(config, k)) for k in watched_keys)
            key = (args, frozenset(kwargs.items()), config_snapshot)

            if key not in memo:
                memo.clear()  # old config = stale cache, wipe it
                memo[key] = func(*args, **kwargs)

            return memo[key]
        return wrapper
    return decorator