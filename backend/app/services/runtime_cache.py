from __future__ import annotations

from collections.abc import Callable
from threading import RLock
from time import monotonic
from typing import cast

_cache: dict[str, tuple[float, object]] = {}
_lock = RLock()


def cached_result[T](key: str, factory: Callable[[], T], ttl_seconds: float = 30.0) -> T:
    """Return an instance-local cached value and coalesce concurrent cold requests."""
    now = monotonic()
    with _lock:
        cached = _cache.get(key)
        if cached is not None and cached[0] > now:
            return cast(T, cached[1])
        value = factory()
        _cache[key] = (now + ttl_seconds, value)
        return value


def invalidate_runtime_cache() -> None:
    with _lock:
        _cache.clear()
