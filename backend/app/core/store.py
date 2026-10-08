"""Process-local, bounded TTL scratch space; opaque tokens are not durable IDs."""
import time
import secrets
from threading import RLock
import pandas as pd
from app.core.config import settings


class FrameStore:
    def __init__(self, max_bytes=settings.cache_max_bytes, ttl=settings.cache_ttl_seconds):
        self.max_bytes, self.ttl = max_bytes, ttl
        self.entries = {}
        self.lock = RLock()

    def cleanup(self):
        with self.lock:
            now = time.monotonic()
            for key in list(self.entries):
                if self.entries[key][0] <= now:
                    del self.entries[key]

    def put(self, frame: pd.DataFrame, kind: str) -> str:
        size = int(frame.memory_usage(index=True, deep=True).sum())
        with self.lock:
            self.cleanup()
            if size > self.max_bytes or sum(entry[1] for entry in self.entries.values()) + size > self.max_bytes:
                raise ValueError('Ephemeral memory capacity exceeded; retry after datasets expire.')
            token = secrets.token_urlsafe(24)
            self.entries[token] = (time.monotonic() + self.ttl, size, kind, frame.copy(deep=True))
            return token

    def get(self, token: str, kind: str | None = None) -> pd.DataFrame:
        with self.lock:
            self.cleanup()
            entry = self.entries.get(token)
            if entry is None or (kind is not None and entry[2] != kind):
                raise KeyError('Dataset token is missing, expired, or has the wrong kind; upload/generate again.')
            return entry[3].copy(deep=True)

    def put_many(self, frames: dict[str, pd.DataFrame], kind: str) -> dict[str, str]:
        """Publish a normalized snapshot atomically; capacity failure leaves no partial tables."""
        sizes = {name: int(frame.memory_usage(index=True, deep=True).sum()) for name, frame in frames.items()}
        with self.lock:
            self.cleanup()
            if sum(sizes.values()) + sum(entry[1] for entry in self.entries.values()) > self.max_bytes:
                raise ValueError('Ephemeral memory capacity exceeded; retry after datasets expire.')
            staged = {name: (secrets.token_urlsafe(24), frame.copy(deep=True)) for name, frame in frames.items()}
            expires = time.monotonic() + self.ttl
            self.entries.update({token: (expires, sizes[name], kind, frame) for name, (token, frame) in staged.items()})
            return {name: token for name, (token, _) in staged.items()}


store = FrameStore()
