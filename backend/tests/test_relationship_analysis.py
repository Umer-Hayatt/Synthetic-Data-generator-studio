from copy import deepcopy
import json
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from pandas.testing import assert_frame_equal
from app.main import app
from app.api import relationships, intelligence
from app.core.ai import AIRouter
from app.core.store import FrameStore
from app.core.relationship_analysis import analyze, normalize
from app.models.relationship_analysis import AnalysisRequest, NormalizeRequest, EntitySuggestions
from app.models.spec import DatasetSpec
from app.engines.tabular import generate
from test_ai import Fake


def commerce():
    return pd.DataFrame({'order_id': [1, 2, 3, 3], 'customer_id': [11, 22, 11, 11],
        'customer_name': ['Synthetic A', 'Synthetic B', 'Synthetic A', 'Synthetic A'],
        'product_id': [7, 8, 8, 8], 'product_name': ['Widget', 'Gadget', 'Gadget', 'Gadget'],
        'quantity': [2, 1, 4, 4]})


def request(**kwargs):
    return AnalysisRequest(dataset_id='synthetic', source_table='OrderItems', **kwargs)


def test_full_data_dependencies_and_duplicate_rows_roundtrip():
    frame = commerce()
    proposed = analyze(frame, request(), AIRouter([]))
    assert proposed['ai_status'] == 'no_key'
    assert {e['name'] for e in proposed['entities'] if e['valid']} == {'Customers', 'Products'}
    entities = [{k: e[k] for k in ('name', 'key', 'columns')} for e in proposed['entities']]
    args = NormalizeRequest(dataset_id='synthetic', source_table='OrderItems', accepted=True, entities=entities)
    tables, spec, integrity = normalize(frame, args)
    assert len(tables['OrderItems']) == 4 and len(tables['Customers']) == 2
    assert integrity['surrogate_key'] == '__row_id'
    joined = tables['OrderItems'].merge(tables['Customers'], on='customer_id').merge(tables['Products'], on='product_id')
    joined = joined.sort_values('__row_id')[frame.columns].reset_index(drop=True)
    assert_frame_equal(joined, frame, check_exact=True)
    second, _, _ = normalize(frame, args)
    for name in tables:
        assert_frame_equal(tables[name], second[name])
    assert sum(len(t.foreign_keys) for t in spec.tables) == 2


def test_conflict_beyond_preview_is_rejected_without_printing_values():
    frame = pd.concat([commerce().iloc[:1]] * 30, ignore_index=True)
    frame.loc[29, 'customer_name'] = 'SYNTHETIC_SECRET_MARKER'
    proposed = analyze(frame, request(), AIRouter([]))
    customer = next(e for e in proposed['entities'] if e['key'] == 'customer_id')
    assert not customer['valid'] and customer['conflicting_keys'] == {'customer_name': 1}
    assert 'SYNTHETIC_SECRET_MARKER' not in json.dumps(proposed)
    with pytest.raises(ValueError, match='conflicting'):
        normalize(frame, NormalizeRequest(dataset_id='synthetic', accepted=True,
            entities=[{'name': 'Customers', 'key': 'customer_id', 'columns': ['customer_name']}]))


def test_ai_receives_only_metadata_and_hallucinations_do_not_override_valid_candidates():
    class Provider:
        def generate_structured(self, prompt, schema):
            assert 'Synthetic A' not in prompt and 'Widget' not in prompt and 'synthetic-token' not in prompt
            return schema.model_validate({'entities': [
                {'name': 'Hallucination', 'key': 'customer_id', 'columns': ['nonexistent']},
                {'name': 'Invented', 'key': 'fake_id', 'columns': ['fake_name']}], 'questions': []})
    result = analyze(commerce(), AnalysisRequest(dataset_id='synthetic-token'), Provider())
    assert next(e for e in result['entities'] if e['key'] == 'customer_id')['valid']
    assert not next(e for e in result['entities'] if e['key'] == 'fake_id')['valid']


def test_no_relationships_asks_questions_and_never_invents_commerce():
    result = analyze(pd.DataFrame({'name': ['A', 'B'], 'age': [20, 30]}), request(), AIRouter([]))
    assert result['entities'] == [] and result['status'] == 'needs_clarification' and result['questions']


def test_clarification_mapping_is_checked_and_null_keys_rejected():
    frame = pd.DataFrame({'person': [1, 1, 2], 'display': ['A', 'A', 'B'], 'reading': [4, 5, 6]})
    mapping = [{'name': 'People', 'key': 'person', 'columns': ['display']}]
    result = analyze(frame, request(entities=mapping), AIRouter([]))
    assert result['entities'][0]['valid']
    frame.loc[0, 'person'] = None
    assert not analyze(frame, request(entities=mapping), AIRouter([]))['entities'][0]['valid']


def test_nested_entities_preserve_source_and_cycles_are_rejected():
    frame = pd.DataFrame({'item_id': [1, 2, 3], 'order_id': [1, 1, 2], 'customer_id': [4, 4, 5],
                          'customer_name': ['A', 'A', 'B'], 'order_status': ['paid'] * 3})
    entities = [{'name': 'Orders', 'key': 'order_id', 'columns': ['order_status', 'customer_id']},
                {'name': 'Customers', 'key': 'customer_id', 'columns': ['customer_name']}]
    outputs, spec, _ = normalize(frame, NormalizeRequest(dataset_id='synthetic', source_table='Items', entities=entities, accepted=True))
    assert next(t for t in spec.tables if t.name == 'Orders').foreign_keys[0].reference_table == 'Customers'
    assert outputs['Items'].item_id.tolist() == [1, 2, 3]
    cyclic = [{'name': 'Orders', 'key': 'order_id', 'columns': ['customer_id']},
              {'name': 'Customers', 'key': 'customer_id', 'columns': ['order_id']}]
    with pytest.raises(ValueError):
        normalize(frame, NormalizeRequest(dataset_id='synthetic', entities=cyclic, accepted=True))


def test_normalization_api_acceptance_source_kind_exports_and_expiry(monkeypatch):
    storage = FrameStore()
    monkeypatch.setattr(relationships, 'store', storage)
    monkeypatch.setattr(relationships, 'get_router', lambda: AIRouter([]))
    from app.api import generate as generation, export
    monkeypatch.setattr(generation, 'store', storage)
    monkeypatch.setattr(export, 'store', storage)
    client = TestClient(app)
    token = storage.put(commerce(), 'generated')
    body = {'dataset_id': token, 'source_table': 'Items'}
    analysis = client.post('/api/v1/relationships/analyze', json=body).json()
    body['entities'] = [{k: e[k] for k in ('name', 'key', 'columns')} for e in analysis['entities']]
    assert client.post('/api/v1/relationships/normalize', json=body).status_code == 400
    normalized = client.post('/api/v1/relationships/normalize', json={**body, 'accepted': True})
    assert normalized.status_code == 200
    for table in normalized.json()['tables']:
        preview = client.get('/api/v1/preview', params={'dataset_id': table['dataset_id'], 'limit': 100}).json()
        assert len(preview['rows']) == table['row_count']
        assert client.get('/api/v1/export/csv', params={'dataset_id': table['dataset_id']}).status_code == 200
    assert_frame_equal(storage.get(token, 'generated'), commerce())
    wrong = storage.put(commerce(), 'reference')
    assert client.post('/api/v1/relationships/analyze', json={'dataset_id': wrong}).status_code == 404
    assert client.post('/api/v1/relationships/analyze', json={'dataset_id': 'expired'}).status_code == 404


def test_atomic_snapshot_capacity_failure_leaves_no_partial_tables():
    storage = FrameStore(max_bytes=500)
    frame = pd.DataFrame({'value': ['x' * 1000]})
    with pytest.raises(ValueError):
        storage.put_many({'A': frame, 'B': frame}, 'relational')
    assert storage.entries == {}


@pytest.mark.parametrize('seed', [7, 22, 91])
def test_flat_prompt_entities_preserve_intent_counts_and_dependencies(monkeypatch, seed):
    draft = {'name': 'shop', 'seed': seed, 'main_table': 'Orders', 'tables': [
        {'name': 'Customers', 'row_count': 5, 'columns': [
            {'name': 'id', 'dtype': 'integer', 'is_primary_key': True},
            {'name': 'name', 'dtype': 'string', 'semantic_type': 'person_name'}]},
        {'name': 'Orders', 'row_count': 20, 'columns': [
            {'name': 'id', 'dtype': 'integer', 'is_primary_key': True},
            {'name': 'customer_id', 'dtype': 'integer', 'is_foreign_key': True, 'reference_table': 'Customers', 'reference_column': 'id'},
            {'name': 'amount', 'dtype': 'float'}]}]}
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([deepcopy(draft)])]))
    response = TestClient(app).post('/api/v1/ai/spec', json={'prompt': '5 Customers with names related to 20 Orders'}).json()
    assert response['status'] == 'review_required', response
    data_spec = DatasetSpec.model_validate(response['spec'])
    assert len(data_spec.tables) == 1 and data_spec.tables[0].name == 'Orders'
    assert data_spec.tables[0].row_count == 20
    assert data_spec.tabular_entities[0].entity_count == 5
    frame = generate(data_spec)
    assert frame.customer_id.nunique() == 5
    assert frame.groupby('customer_id').customer_name.nunique().eq(1).all()
    assert_frame_equal(frame, generate(data_spec))


def test_offline_enrollment_prompt_has_input_specific_relations(monkeypatch):
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([]))
    response = TestClient(app).post('/api/v1/ai/spec', json={'prompt': '40 enrollments for 10 students and 5 courses'}).json()
    spec = DatasetSpec.model_validate(response['spec'])
    frame = generate(spec)
    assert len(frame) == 40 and frame.student_id.nunique() == 10 and frame.course_id.nunique() == 5
    assert frame.groupby('student_id').student_name.nunique().eq(1).all()
    assert frame.groupby('course_id').course_name.nunique().eq(1).all()
    proposed = analyze(frame, request(), AIRouter([]))
    assert all(e['valid'] for e in proposed['entities'])


def test_commerce_upload_preserves_evidenced_dependencies_then_splits_generated_rows(monkeypatch):
    monkeypatch.setattr(relationships, 'get_router', lambda: AIRouter([]))
    client = TestClient(app)
    uploaded = client.post('/api/v1/ingest', files={'file': ('commerce.csv', commerce().to_csv(index=False).encode(), 'text/csv')}).json()
    assert {e['key'] for e in uploaded['spec']['tabular_entities']} == {'customer_id', 'product_id'}
    generated = client.post('/api/v1/generate', json={'spec': uploaded['spec']}).json()
    assert generated['dataset_id'] != uploaded['dataset_id']
    proposed = client.post('/api/v1/relationships/analyze', json={'dataset_id': generated['dataset_id']}).json()
    assert len(proposed['entities']) == 2 and all(e['valid'] for e in proposed['entities'])
    entities = [{k: e[k] for k in ('name', 'key', 'columns')} for e in proposed['entities']]
    result = client.post('/api/v1/relationships/normalize', json={'dataset_id': generated['dataset_id'], 'accepted': True, 'entities': entities})
    assert result.status_code == 200, result.json()
    assert result.json()['integrity']['lossless']


def test_jsonl_analysis_checks_all_rows_and_rejects_unsupported_size(monkeypatch, tmp_path):
    from dataclasses import replace
    from app.core.artifacts import LocalArtifactStore
    artifacts = LocalArtifactStore(tmp_path)
    monkeypatch.setattr(relationships, 'artifacts', artifacts)
    monkeypatch.setattr(relationships, 'get_router', lambda: AIRouter([]))
    frame = pd.concat([commerce().iloc[:1]] * 30, ignore_index=True)
    frame.loc[29, 'customer_name'] = 'Different synthetic name'
    artifact = artifacts.write([frame.to_json(orient='records', lines=True).encode()], 'jsonl')
    client = TestClient(app)
    body = {'dataset_id': artifact.id, 'storage': 'artifact'}
    response = client.post('/api/v1/relationships/analyze', json=body)
    assert response.status_code == 200
    assert response.json()['row_count'] == 30
    assert not next(e for e in response.json()['entities'] if e['key'] == 'customer_id')['valid']
    monkeypatch.setattr(relationships, 'settings', replace(relationships.settings, max_rows=20))
    assert client.post('/api/v1/relationships/analyze', json=body).status_code == 400


def test_provider_schema_is_simple_but_response_validation_remains_strict():
    schema = EntitySuggestions.model_json_schema()
    assert '$defs' not in schema and 'pattern' not in json.dumps(schema)
    with pytest.raises(ValueError):
        EntitySuggestions.model_validate({'entities': [{'name': 'Invalid entity name', 'key': 'id', 'columns': ['name']}]})
    with pytest.raises(ValueError):
        EntitySuggestions.model_validate({'entities': [{'name': 'People', 'key': 'id', 'columns': ['id']}]})


def test_declared_non_person_entity_attributes_do_not_use_person_name_heuristics(monkeypatch):
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([]))
    response = TestClient(app).post('/api/v1/ai/spec', json={'prompt': '40 enrollments for 10 students and 5 courses'}).json()
    spec = DatasetSpec.model_validate(response['spec'])
    frame = generate(spec)
    assert frame.student_name.str.split().str.len().le(4).all()
    assert frame.course_name.str.endswith('.').all()
    assert frame.groupby('course_id').course_name.nunique().eq(1).all()


def test_batched_artifact_generation_preserves_entities_across_pages(monkeypatch):
    from app.engines.registry import StatisticalSynthesizer
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([]))
    response = TestClient(app).post('/api/v1/ai/spec', json={'prompt': '40 enrollments for 10 students and 5 courses'}).json()
    spec = DatasetSpec.model_validate(response['spec'])
    engine = StatisticalSynthesizer().fit(spec)
    frame = pd.concat(engine.generate_batches(7), ignore_index=True)
    assert_frame_equal(frame, generate(spec), check_exact=True)
    assert frame.student_id.nunique() == 10 and frame.groupby('student_id').student_name.nunique().eq(1).all()
    spec.tables[0].row_count = 50001
    with pytest.raises(ValueError, match='complete snapshot'):
        list(engine.generate_batches(7))
