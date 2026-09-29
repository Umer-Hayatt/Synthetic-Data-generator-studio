"""Local opaque artifact storage. Single-process adapter; no user-supplied paths."""
from contextlib import contextmanager
from dataclasses import asdict, dataclass
import json
from pathlib import Path
import re
from threading import RLock
import time
from typing import Protocol
from uuid import uuid4


@dataclass(frozen=True)
class Artifact:
    id: str
    format: str
    size: int
    created_at: float
    expires_at: float


class ArtifactStore(Protocol):
    def get(self, artifact_id: str) -> Artifact: ...
    def delete(self, artifact_id: str) -> None: ...
    def cleanup(self) -> None: ...
    def write(self, chunks, format: str) -> Artifact: ...
    def open(self, artifact_id: str): ...


class LocalArtifactStore:
    def __init__(self, root, max_bytes=2 * 1024**3, ttl=86400):
        self.root = Path(root).resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.max_bytes, self.ttl = max_bytes, ttl
        self.lock = RLock()
        self.pinned = {}

    def path(self, artifact_id):
        if not re.fullmatch('[a-f0-9]{32}', artifact_id):
            raise KeyError('Artifact not found.')
        return self.root / artifact_id

    def usage(self):
        return sum(p.stat().st_size for p in self.root.iterdir() if p.is_file())

    def begin(self):
        return uuid4().hex

    def append(self, artifact_id, chunk):
        with self.lock:
            if self.usage() + len(chunk) + 1024 > self.max_bytes:
                raise ValueError('Artifact disk quota exceeded.')
            with self.path(artifact_id).with_suffix('.part').open('ab') as stream:
                stream.write(chunk)

    def commit(self, artifact_id, format):
        with self.lock:
            path = self.path(artifact_id)
            partial = path.with_suffix('.part')
            now = time.time()
            artifact = Artifact(artifact_id, format, partial.stat().st_size, now, now+self.ttl)
            partial.replace(path)
            path.with_suffix('.json').write_text(json.dumps(asdict(artifact)), encoding='utf-8')
            return artifact

    def write(self, chunks, format):
        token = self.begin()
        try:
            for chunk in chunks:
                self.append(token, chunk)
            return self.commit(token, format)
        except BaseException:
            self.delete(token)
            raise

    def get(self, artifact_id):
        with self.lock:
            path = self.path(artifact_id)
            try:
                artifact = Artifact(**json.loads(path.with_suffix('.json').read_text(encoding='utf-8')))
            except FileNotFoundError:
                raise KeyError('Artifact not found.') from None
            if artifact.expires_at <= time.time() and not self.pinned.get(artifact_id):
                self.delete(artifact_id)
                raise KeyError('Artifact expired.')
            return artifact

    @contextmanager
    def pin(self, artifact_id):
        with self.lock:
            self.get(artifact_id)
            self.pinned[artifact_id] = self.pinned.get(artifact_id, 0) + 1
        try:
            yield self.path(artifact_id)
        finally:
            with self.lock:
                self.pinned[artifact_id] -= 1
                if not self.pinned[artifact_id]:
                    del self.pinned[artifact_id]

    @contextmanager
    def open(self, artifact_id):
        with self.pin(artifact_id) as path:
            with path.open('rb') as stream:
                yield stream

    def delete(self, artifact_id):
        with self.lock:
            if self.pinned.get(artifact_id):
                return
            path = self.path(artifact_id)
            for item in (path, path.with_suffix('.json'), path.with_suffix('.part')):
                item.unlink(missing_ok=True)

    def cleanup(self):
        with self.lock:
            for path in self.root.glob('*.json'):
                try:
                    self.get(path.stem)
                except KeyError:
                    pass
            for path in self.root.glob('*.part'):
                if path.stat().st_mtime + self.ttl < time.time():
                    self.delete(path.stem)
