import pandas as pd
from app.core.inference import infer_schema


def test_types_statistics_and_semantics():
    frame = pd.DataFrame({
        'user_id': [1, 2, 3, 4], 'email': ['a@b.com'] * 4,
        'phone': ['+1 222 333 4444'] * 4, 'full_name': ['Jane Doe'] * 4,
        'income': [1.5, 2.5, None, 4.5], 'active': [True, False, True, False],
        'date': ['2020-01-01', '2020-01-02', None, '2020-01-04'],
        'group': ['a', 'b', 'a', 'b'], 'empty': [None] * 4,
    })
    schema = {col['name']: col for col in infer_schema(frame)}
    assert schema['user_id']['semantic_type'] == 'id'
    assert schema['email']['semantic_type'] == 'email'
    assert schema['phone']['semantic_type'] == 'phone'
    assert schema['full_name']['semantic_confidence'] < 1
    assert schema['income']['dtype'] == 'float'
    assert schema['income']['null_rate'] == 0.25
    assert schema['income']['min'] == 1.5
    assert schema['active']['dtype'] == 'boolean'
    assert schema['date']['dtype'] == 'datetime'
    assert len(schema['group']['category_frequencies']) == 2
    assert schema['empty']['semantic_type'] == 'generic_text'
    assert schema['empty']['null_rate'] == 1


def test_generic_fallback_and_determinism():
    frame = pd.DataFrame({'description': ['hello world', 'something else', 'third text']})
    assert infer_schema(frame) == infer_schema(frame)
    assert infer_schema(frame)[0]['semantic_type'] == 'generic_text'
