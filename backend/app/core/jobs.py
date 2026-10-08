"""Bounded cooperative local jobs. Job metadata is intentionally process-local."""
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack
from copy import deepcopy
from threading import BoundedSemaphore, Event, RLock
import time
from typing import Protocol
from uuid import uuid4

TERMINAL = {'complete', 'failed', 'cancelled'}
STAGES = ['queued', 'profiling', 'training', 'generating', 'validating']


class Cancelled(Exception):
    pass


class JobStore(Protocol):
    def get(self, job_id): ...
    def update(self, job_id, **fields): ...


class InMemoryJobStore:
    def __init__(self, limit=1000, ttl=86400):
        self.items, self.lock, self.limit, self.ttl = {}, RLock(), limit, ttl

    def create(self):
        with self.lock:
            self.cleanup()
            if len(self.items) >= self.limit:
                raise ValueError('Job metadata capacity reached.')
            token = uuid4().hex
            self.items[token] = dict(job_id=token, status='queued', stage='queued', progress=0,
                                    error=None, artifacts=[], created_at=time.time(), updated_at=time.time())
            return token

    def get(self, job_id):
        with self.lock:
            if job_id not in self.items:
                raise KeyError('Job not found.')
            return deepcopy(self.items[job_id])

    def update(self, job_id, **fields):
        with self.lock:
            item = self.items[job_id]
            if item['status'] in TERMINAL:
                return
            status = fields.get('status', item['status'])
            if status not in TERMINAL and (status not in STAGES or STAGES.index(status) < STAGES.index(item['status'])):
                raise ValueError('Invalid job transition.')
            if 'progress' in fields and not item['progress'] <= fields['progress'] <= 1:
                raise ValueError('Invalid job progress.')
            item.update(fields, updated_at=time.time())

    def cleanup(self):
        with self.lock:
            for token, item in list(self.items.items()):
                if item['status'] in TERMINAL and item['updated_at'] + self.ttl < time.time():
                    del self.items[token]


class JobExecutor(Protocol):
    def submit(self, operation): ...
    def cancel(self, job_id): ...


class LocalJobExecutor:
    def __init__(self, store, artifacts, capacity=8):
        self.store, self.artifacts = store, artifacts
        self.pool = ThreadPoolExecutor(max_workers=1, thread_name_prefix='synthesis')
        self.capacity, self.events, self.lock = BoundedSemaphore(capacity), {}, RLock()

    def submit(self, operation, inputs=(), owned_inputs=False):
        if not self.capacity.acquire(blocking=False):
            raise ValueError('Job queue is full; retry later.')
        pins = ExitStack()
        try:
            for artifact_id in inputs:
                pins.enter_context(self.artifacts.pin(artifact_id))
            token = self.store.create()
        except BaseException:
            pins.close()
            self.capacity.release()
            raise
        with self.lock:
            event = self.events[token] = Event()

        def run():
            outputs = list(inputs) if owned_inputs else []
            def progress(stage, value):
                if event.is_set():
                    raise Cancelled()
                self.store.update(token, status=stage, stage=stage, progress=value)
            try:
                progress('queued', 0)
                operation(progress, outputs)
                with self.lock:
                    if event.is_set():
                        raise Cancelled()
                    self.store.update(token, status='complete', stage='complete', progress=1, artifacts=list(outputs))
            except Cancelled:
                pins.close()
                for artifact_id in outputs:
                    self.artifacts.delete(artifact_id)
                self.store.update(token, status='cancelled', stage='cancelled')
            except ValueError as exc:
                pins.close()
                for artifact_id in outputs:
                    self.artifacts.delete(artifact_id)
                err_msg = str(exc)
                if 'secret' in err_msg.lower():
                    err_msg = 'Job failed due to invalid input.'
                self.store.update(token, status='failed', stage='failed', error=err_msg)
            except Exception:
                pins.close()
                for artifact_id in outputs:
                    self.artifacts.delete(artifact_id)
                # Non-ValueError exceptions may contain source rows or secrets — keep generic.
                self.store.update(token, status='failed', stage='failed', error='Generation failed due to an internal error. Check your spec schema and deployment limits.')
            finally:
                pins.close()
                with self.lock:
                    self.events.pop(token, None)
                self.capacity.release()
        self.pool.submit(run)
        return self.store.get(token)

    def cancel(self, job_id):
        with self.lock:
            job = self.store.get(job_id)
            if job_id in self.events:
                self.events[job_id].set()
            return job

    def shutdown(self):
        with self.lock:
            for event in self.events.values():
                event.set()
        self.pool.shutdown(wait=True)
