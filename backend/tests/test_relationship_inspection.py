"""Relationship evidence uses complete generated output, never preview samples."""
import json
from dataclasses import replace
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.store import store
from app.api.jobs import artifacts


def request_for(frames, storage='frame', **fk_overrides):
    tokens = (store.put_many(frames, 'generated') if storage == 'frame' else
              {name: artifacts.write([frame.to_json(orient='records', lines=True).encode()], 'jsonl').id
               for name, frame in frames.items()})
    body = {'source_dataset_id': tokens['Parents'], 'storage': storage,
            'tables': [{'name': name, 'dataset_id': token, 'primary_key': 'id',
                        'foreign_keys': [] if name == 'Parents' else [{
                            'column': 'parent_id', 'reference_table': 'Parents', 'reference_column': 'id',
                            'cardinality': '1:N', **fk_overrides}]}
                       for name, token in tokens.items()]}
    if storage == 'artifact':
        manifest = artifacts.write([json.dumps({'tables': tokens}).encode()], 'json')
        body['manifest_id'] = manifest.id
    return body, tokens


@pytest.mark.parametrize('storage', ['frame', 'artifact'])
def test_full_rows_actual_counts_cardinality_and_zero_child_parents(storage):
    frames = {'Parents': pd.DataFrame({'id': [1, 2, 3]}),
              'Children': pd.DataFrame({'id': range(71), 'parent_id': [1] * 35 + [2] * 35 + [99]})}
    body, tokens = request_for(frames, storage)
    try:
        result = TestClient(app).post('/api/v1/relationships/inspect', json=body)
        assert result.status_code == 200, result.text
        result = result.json()
        assert [t['row_count'] for t in result['tables']] == [3, 71]
        link = result['links'][0]
        assert link['orphan_rows'] == 1 and link['matched_rows'] == 70
        assert link['min_children'] == 0 and link['max_children'] == 35
        assert not link['verified'] and not result['links_verified']
        assert link['cardinality'] is None
    finally:
        if storage == 'artifact':
            for token in [*tokens.values(), body['manifest_id']]:
                artifacts.delete(token)


def test_observed_cardinality_is_measured_and_declared_bounds_can_fail():
    frames = {'Parents': pd.DataFrame({'id': [1, 2]}),
              'Children': pd.DataFrame({'id': [1, 2, 3], 'parent_id': [1, 1, 2]})}
    body, _ = request_for(frames)
    client = TestClient(app)
    result = client.post('/api/v1/relationships/inspect', json=body).json()
    assert result['links'][0]['cardinality'] == '1:N'
    assert result['links'][0]['verified'] and result['keys_verified']
    body['tables'][1]['foreign_keys'][0]['cardinality'] = '1:1'
    result = client.post('/api/v1/relationships/inspect', json=body).json()
    assert result['links'][0]['cardinality'] == '1:N'
    assert not result['links_verified']
    body['tables'][1]['foreign_keys'][0].update(cardinality='1:N', max_children=1)
    assert not client.post('/api/v1/relationships/inspect', json=body).json()['links_verified']


def test_duplicate_missing_parent_keys_and_null_foreign_keys_are_explicit():
    frames = {'Parents': pd.DataFrame({'id': [1, 1, None]}),
              'Children': pd.DataFrame({'id': [1, 2], 'parent_id': [1, None]})}
    body, _ = request_for(frames)
    result = TestClient(app).post('/api/v1/relationships/inspect', json=body).json()
    assert not result['keys_verified']
    assert not result['links'][0]['parent_key_unique']
    assert result['links'][0]['null_rows'] == 1
    assert not result['links'][0]['verified']


def test_scalar_types_do_not_create_boolean_integer_false_links():
    frames = {'Parents': pd.DataFrame({'id': [True]}),
              'Children': pd.DataFrame({'id': [1], 'parent_id': [1]})}
    body, _ = request_for(frames)
    result = TestClient(app).post('/api/v1/relationships/inspect', json=body).json()
    assert result['links'][0]['orphan_rows'] == 1


def test_mixed_boolean_and_integer_keys_remain_distinct_for_uniqueness_and_links():
    frames = {'Parents': pd.DataFrame({'id': pd.Series([True, 1], dtype=object)}),
              'Children': pd.DataFrame({'id': [1, 2], 'parent_id': pd.Series([True, 1], dtype=object)})}
    body, _ = request_for(frames)
    result = TestClient(app).post('/api/v1/relationships/inspect', json=body).json()
    assert result['keys_verified'] and result['links_verified']
    assert result['links'][0]['cardinality'] == '1:1'
    assert result['links'][0]['orphan_rows'] == 0


def test_no_links_are_invented_from_overlapping_ids_and_expired_source_rejected():
    body, _ = request_for({'Parents': pd.DataFrame({'id': [1, 2]}),
                           'Children': pd.DataFrame({'id': [1, 2], 'parent_id': [1, 2]})})
    body['tables'][1]['foreign_keys'] = []
    client = TestClient(app)
    assert client.post('/api/v1/relationships/inspect', json=body).json()['links'] == []
    body['source_dataset_id'] = 'expired-token'
    assert client.post('/api/v1/relationships/inspect', json=body).status_code == 404


def test_artifact_manifest_rejects_mixed_snapshots_and_aggregate_limit(monkeypatch):
    from app.api import relationships
    frames = {'Parents': pd.DataFrame({'id': [1, 2]}),
              'Children': pd.DataFrame({'id': [1, 2, 3], 'parent_id': [1, 1, 2]})}
    body, tokens = request_for(frames, 'artifact')
    extra = artifacts.write([b'{"id": 1}\n'], 'jsonl')
    try:
        client = TestClient(app)
        body['tables'][1]['dataset_id'] = extra.id
        assert client.post('/api/v1/relationships/inspect', json=body).status_code == 400
        body['tables'][1]['dataset_id'] = tokens['Children']
        body['source_dataset_id'] = extra.id
        assert client.post('/api/v1/relationships/inspect', json=body).status_code == 400
        body['source_dataset_id'] = tokens['Parents']
        monkeypatch.setattr(relationships, 'settings', replace(relationships.settings, max_cells=7))
        assert client.post('/api/v1/relationships/inspect', json=body).status_code == 400
    finally:
        for token in [*tokens.values(), body['manifest_id'], extra.id]:
            artifacts.delete(token)
