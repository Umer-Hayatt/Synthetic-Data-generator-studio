"""Complete table inspection and linked-record filtering at the HTTP boundary."""
import io
import json
import pandas as pd
from fastapi.testclient import TestClient
from app.main import app
from app.core.store import store
from app.api.jobs import artifacts


def test_frame_pages_and_link_filters_use_complete_rows():
    frame = pd.DataFrame({'id': range(1, 71), 'customer_id': [i % 7 for i in range(70)],
                          'label': [f'Row {i}' for i in range(70)]})
    token = store.put(frame, 'generated')
    client = TestClient(app)
    page = client.get('/api/v1/preview', params={'dataset_id': token, 'offset': 50, 'limit': 25}).json()
    assert page['row_count'] == 70 and len(page['rows']) == 20
    assert page['rows'][-1]['id'] == 70
    response = client.get('/api/v1/preview', params={'dataset_id': token, 'offset': 8, 'limit': 25,
                          'filter_column': 'customer_id', 'filter_value': json.dumps(6)})
    assert response.status_code == 200
    filtered = response.json()
    assert filtered['row_count'] == 10 and filtered['total_row_count'] == 70
    assert len(filtered['rows']) == 2 and all(row['customer_id'] == 6 for row in filtered['rows'])
    assert len(client.get('/api/v1/export/json', params={'dataset_id': token}).json()) == 70
    for params in [{'filter_column': 'missing', 'filter_value': '6'},
                   {'filter_column': 'customer_id'},
                   {'filter_column': 'customer_id', 'filter_value': '{}'},
                   {'filter_column': 'customer_id', 'filter_value': 'invalid-json'}]:
        assert client.get('/api/v1/preview', params={'dataset_id': token, **params}).status_code == 400


def test_artifact_pages_and_filters_report_actual_totals():
    rows = [{'id': i + 1, 'customer_id': f'C{i % 7}', 'name': f'Name {i}'} for i in range(70)]
    artifact = artifacts.write(['\n'.join(json.dumps(row) for row in rows).encode()], 'jsonl')
    try:
        client = TestClient(app)
        response = client.get(f'/api/v1/artifacts/{artifact.id}/rows', params={'offset': 50, 'limit': 25})
        assert response.status_code == 200
        page = response.json()
        assert page['row_count'] == page['total_row_count'] == 70
        assert page['rows'] == rows[50:]
        filtered = client.get(f'/api/v1/artifacts/{artifact.id}/rows', params={
            'offset': 8, 'limit': 25, 'filter_column': 'customer_id', 'filter_value': json.dumps('C6')}).json()
        assert filtered['row_count'] == 10 and filtered['total_row_count'] == 70
        assert len(filtered['rows']) == 2 and all(row['customer_id'] == 'C6' for row in filtered['rows'])
        missing = client.get(f'/api/v1/artifacts/{artifact.id}/rows', params={
            'filter_column': 'unknown', 'filter_value': '1'})
        assert missing.status_code == 400
        assert len(pd.read_csv(io.BytesIO(client.get(
            f'/api/v1/artifacts/{artifact.id}/download', params={'format': 'csv'}).content))) == 70
    finally:
        artifacts.delete(artifact.id)


def test_artifact_preview_rejects_documents_and_reports_expiration():
    client = TestClient(app)
    artifact = artifacts.write([b'{"id": 1, "nested": {"value": 1}}\n'], 'jsonl')
    try:
        assert client.get(f'/api/v1/artifacts/{artifact.id}/rows').status_code == 400
    finally:
        artifacts.delete(artifact.id)
    assert client.get(f'/api/v1/artifacts/{artifact.id}/rows').status_code == 404
