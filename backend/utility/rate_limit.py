import time
from collections import defaultdict, deque


class InMemoryRateLimiter:
    """Sliding-window limiter: at most `max_requests` per `window_seconds` for each key."""

    def __init__(self, max_requests: int, window_seconds: int):
        self._max_requests = max_requests
        self._window_seconds = window_seconds
        self._hits: dict[str, deque] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] >= self._window_seconds:
            hits.popleft()
        if len(hits) >= self._max_requests:
            return False
        hits.append(now)
        return True

    def reset(self) -> None:
        self._hits.clear()
