"""Boundary checks for outages and expiry, without real sleeps or model calls."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.api import intelligence
from app.core.ai import AIRouter
from app.core.store import FrameStore


def test_core_flow_remains_available_without_ai(monkeypatch):
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([]))
    with TestClient(app) as client:
        ai = client.post('/api/v1/ai/spec', json={'prompt': 'Create ten customers'})
        assert ai.status_code == 200
        assert ai.json()['reason'] == 'no_key'
        upload = client.post('/api/v1/ingest', files={'file': ('small.csv', b'id,amount\n1,10\n2,20\n3,30')})
        assert upload.status_code == 200
        generated = client.post('/api/v1/generate', json={'spec': upload.json()['spec']})
        assert generated.status_code == 200
        token = generated.json()['dataset_id']
        assert client.get('/api/v1/preview', params={'dataset_id': token}).status_code == 200
        assert client.post('/api/v1/evaluate/quality', json={
            'reference_id': upload.json()['dataset_id'], 'generated_id': token}).status_code == 200
        for fmt in ('csv', 'json'):
            assert client.get('/api/v1/export/'+fmt, params={'dataset_id': token}).status_code == 200


def test_expired_tokens_at_all_api_boundaries(monkeypatch):
    from app.api import ingest, generate, export, evaluate
    clock = [100.0]
    monkeypatch.setattr('app.core.store.time.monotonic', lambda: clock[0])
    store = FrameStore(ttl=10)
    for module in (ingest, generate, export, evaluate):
        monkeypatch.setattr(module, 'store', store)
    with TestClient(app) as client:
        upload = client.post('/api/v1/ingest', files={'file': ('small.csv', b'x,y\n1,a\n2,b')}).json()
        generated = client.post('/api/v1/generate', json={'spec': upload['spec']}).json()
        clock[0] += 11
        for token in (upload['dataset_id'], generated['dataset_id']):
            for route in ('preview', 'export/csv', 'export/json'):
                assert client.get('/api/v1/'+route, params={'dataset_id': token}).status_code == 404
        assert client.post('/api/v1/evaluate/quality', json={
            'reference_id': upload['dataset_id'], 'generated_id': generated['dataset_id']}).status_code == 404

