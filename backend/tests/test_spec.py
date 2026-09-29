import pytest
from pydantic import ValidationError
from fastapi.testclient import TestClient
from app.main import app
from app.models.spec import DatasetSpec


def payload():
    return {'name': 'demo', 'tables': [{'name': 'table', 'row_count': 10, 'columns': [
        {'name': 'id', 'dtype': 'integer', 'constraints': {'unique': True, 'auto_increment': True}},
    ], 'primary_key': 'id'}]}


def test_valid_and_api():
    spec = DatasetSpec.model_validate(payload())
    assert DatasetSpec.model_validate_json(spec.model_dump_json()) == spec
    assert TestClient(app).post('/api/v1/spec', json=payload()).status_code == 200


@pytest.mark.parametrize('change', [
    {'dtype': 'unknown'}, {'null_rate': 1.1}, {'nullable': False, 'null_rate': .1},
    {'constraints': {'min': 4, 'max': 2}}, {'unexpected': True},
    {'distribution': {'type': 'categorical', 'values': ['a'], 'probabilities': [.2]}},
    {'distribution': {'type': 'empirical'}},
    {'semantic_type':'phone'},
])
def test_invalid_column(change):
    data = payload()
    data['tables'][0]['columns'][0].update(change)
    with pytest.raises(ValidationError):
        DatasetSpec.model_validate(data)


def test_invalid_table():
    data = payload()
    data['tables'][0]['primary_key'] = 'missing'
    with pytest.raises(ValidationError):
        DatasetSpec.model_validate(data)
