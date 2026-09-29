import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.store import FrameStore


def test_upload_generate_preview_export_flow():
    with TestClient(app) as client:
        upload = client.post('/api/v1/ingest', files={'file': ('x.csv', b'x,y\n1,a\n2,b\n3,a')}).json()
        spec = upload['spec']
        spec['tables'][0]['row_count'] = 1100
        response = client.post('/api/v1/generate', json={'spec': spec, 'preview_limit': 3})
        assert response.status_code == 200, response.text
        generated = response.json()
        assert len(generated['preview']) == 3
        token = generated['dataset_id']
        quality = client.post('/api/v1/evaluate/quality', json={
            'reference_id':upload['dataset_id'], 'generated_id':token})
        assert quality.status_code == 200
        assert quality.json()['score_status'] == 'available'
        preview = client.get('/api/v1/preview', params={'dataset_id':token,'offset':1098,'limit':10}).json()
        assert len(preview['rows']) == 2
        for format in ('csv','json'):
            response = client.get(f'/api/v1/export/{format}', params={'dataset_id':token})
            assert response.status_code == 200
            assert ('text/csv' if format == 'csv' else 'application/json') in response.headers['content-type']
            assert len(pd.read_csv(io.StringIO(response.text)) if format == 'csv' else response.json()) == 1100
        assert client.get('/api/v1/preview', params={'dataset_id':'missing'}).status_code == 404
        assert client.get('/api/v1/export/csv', params={'dataset_id': upload['dataset_id']}).status_code == 404


def test_store_limits_and_expiry(monkeypatch):
    clock = [100.0]
    monkeypatch.setattr('app.core.store.time.monotonic', lambda: clock[0])
    store = FrameStore(max_bytes=10000, ttl=10)
    token = store.put(pd.DataFrame({'x':[1]}), 'reference')
    assert len(store.get(token)) == 1
    clock[0] += 11
    with pytest.raises(KeyError):
        store.get(token)
    with pytest.raises(ValueError):
        FrameStore(max_bytes=1).put(pd.DataFrame({'x':[1]}), 'reference')
