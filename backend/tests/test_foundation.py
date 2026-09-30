import json
import time
from threading import Event
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.adapters.streaming import batches, profile_source
from app.core.artifacts import LocalArtifactStore
from app.core.jobs import InMemoryJobStore, LocalJobExecutor
from app.main import app


def wait(store, token):
    for _ in range(200):
        job = store.get(token)
        if job['status'] in ('complete', 'failed', 'cancelled'):
            return job
        time.sleep(.01)
    raise AssertionError('Job did not finish')


@pytest.mark.parametrize('format', ['csv', 'json', 'jsonl', 'parquet', 'xlsx'])
def test_batches_and_representative_profile(tmp_path, format):
    frame = pd.DataFrame({'id': range(101), 'value': range(101)})
    path = tmp_path / ('data.' + format)
    if format == 'csv': frame.to_csv(path, index=False)
    elif format == 'parquet': frame.to_parquet(path, row_group_size=20)
    elif format == 'xlsx': frame.to_excel(path, index=False)
    else: frame.to_json(path, orient='records', lines=format == 'jsonl')
    parts = list(batches(path, format, batch_rows=7))
    assert sum(map(len, parts)) == 101
    assert max(map(len, parts)) <= 7
    profile = profile_source(path, format, sample_rows=13)
    assert profile['row_count'] == 101 and profile['sample_rows'] == 13
    assert profile['approximate']


def test_artifact_quota_expiry_and_paths(tmp_path, monkeypatch):
    clock = [1000.0]
    monkeypatch.setattr('app.core.artifacts.time.time', lambda: clock[0])
    store = LocalArtifactStore(tmp_path, max_bytes=2048, ttl=.02)
    artifact = store.write([b'hello'], 'txt')
    with pytest.raises(KeyError): store.get('../private')
    with pytest.raises(ValueError): store.write([b'x' * 4096], 'txt')
    assert not list(tmp_path.glob('*.part'))
    with store.pin(artifact.id):
        clock[0] += .03
        store.cleanup()
        assert store.get(artifact.id)
    store.cleanup()
    with pytest.raises(KeyError): store.get(artifact.id)


def test_job_failure_cancel_and_capacity(tmp_path):
    artifacts = LocalArtifactStore(tmp_path)
    store = InMemoryJobStore()
    executor = LocalJobExecutor(store, artifacts, capacity=1)
    started, release = Event(), Event()
    def operation(progress, outputs):
        outputs.append(artifacts.write([b'partial'], 'txt').id)
        started.set()
        release.wait(2)
        progress('generating', .5)
    job = executor.submit(operation)
    assert started.wait(2)
    with pytest.raises(ValueError): executor.submit(operation)
    executor.cancel(job['job_id'])
    release.set()
    assert wait(store, job['job_id'])['status'] == 'cancelled'
    assert not list(tmp_path.iterdir())
    def bad(progress, outputs): raise ValueError('secret source row')
    job = executor.submit(bad)
    result = wait(store, job['job_id'])
    assert result['status'] == 'failed' and 'secret' not in result['error']
    executor.shutdown()


def test_async_ingest_api(monkeypatch, tmp_path):
    from app.api import jobs as api
    artifacts = LocalArtifactStore(tmp_path)
    store = InMemoryJobStore()
    executor = LocalJobExecutor(store, artifacts)
    monkeypatch.setattr(api, 'artifacts', artifacts)
    monkeypatch.setattr(api, 'jobs', store)
    monkeypatch.setattr(api, 'executor', executor)
    client = TestClient(app)
    response = client.post('/api/v1/jobs/ingest?filename=data.csv', content=b'a,b\n1,x\n2,y\n')
    assert response.status_code == 202
    result = wait(store, response.json()['job_id'])
    assert result['status'] == 'complete'
    profile_id = result['artifacts'][-1]
    assert client.get('/api/v1/artifacts/' + profile_id).status_code == 200
    assert client.get('/api/v1/artifacts/' + profile_id + '/download').json()['row_count'] == 2
    executor.shutdown()


def test_missing_and_expired_artifact_download_returns_404(monkeypatch, tmp_path):
    from app.api import jobs as api
    clock = [1000.0]
    monkeypatch.setattr('app.core.artifacts.time.time', lambda: clock[0])
    artifacts = LocalArtifactStore(tmp_path, ttl=10)
    monkeypatch.setattr(api, 'artifacts', artifacts)
    client = TestClient(app)
    assert client.get('/api/v1/artifacts/missing/download').status_code == 404
    artifact = artifacts.write([b'{"id":1}\n'], 'jsonl')
    assert client.get(f'/api/v1/artifacts/{artifact.id}/download').status_code == 200
    clock[0] += 11
    for suffix in ('', '?format=csv'):
        response = client.get(f'/api/v1/artifacts/{artifact.id}/download{suffix}')
        assert response.status_code == 404
        assert 'expired' in response.json()['detail']
