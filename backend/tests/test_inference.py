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


def test_sensitive_detector_clear_positives():
    frame = pd.DataFrame({
        'email': ['alice@example.com', 'bob@example.com'],
        'phone': ['+1 555-123-4567', '+1 555-987-6543'],
        'customer_name': ['Alice Smith', 'Bob Jones'],
        'first_name': ['Alice', 'Bob'],
        'ssn': ['123-45-6789', '987-65-4321'],
        'passport_number': ['A12345678', 'B98765432'],
        'home_address': ['123 Elm St', '456 Oak Ave'],
        'date_of_birth': ['1990-01-01', '1995-05-20'],
        'card_number': ['4111-2222-3333-4444', '5555-6666-7777-8888'],
        'bank_account': ['1234567890', '9876543210'],
    })
    schema = {col['name']: col for col in infer_schema(frame)}
    for col_name in frame.columns:
        assert schema[col_name]['is_sensitive'] is True, f"{col_name} should be flagged as sensitive"
        assert schema[col_name]['sensitive_category'] is not None


def test_sensitive_detector_clear_negatives():
    frame = pd.DataFrame({
        'id': [1, 2, 3],
        'order_id': [101, 102, 103],
        'product_name': ['Laptop', 'Mouse', 'Keyboard'],
        'company_name': ['Acme Inc', 'Beta LLC', 'Gamma Co'],
        'price': [19.99, 49.99, 99.00],
        'status': ['pending', 'completed', 'cancelled'],
        'created_at': ['2023-01-01', '2023-01-02', '2023-01-03'],
        'payment_method': ['Credit card', 'Bank transfer', 'Mailed check'],
    })
    schema = {col['name']: col for col in infer_schema(frame)}
    for col_name in frame.columns:
        assert schema[col_name]['is_sensitive'] is False, f"{col_name} should NOT be flagged as sensitive"
        assert schema[col_name]['sensitive_category'] is None


def test_sensitive_detector_mixed_table():
    from app.core.profiling import fit_spec

    frame = pd.DataFrame({
        'order_id': [1, 2, 3],
        'customer_name': ['Alice', 'Bob', 'Charlie'],
        'email': ['alice@corp.com', 'bob@corp.com', 'charlie@corp.com'],
        'ssn': ['111-11-1111', '222-22-2222', '333-33-3333'],
        'product_name': ['Widget A', 'Widget B', 'Widget C'],
        'price': [10.5, 20.0, 30.25],
        'status': ['new', 'shipped', 'delivered'],
    })
    schema = {col['name']: col for col in infer_schema(frame)}
    sensitive_cols = {col['name'] for col in schema.values() if col['is_sensitive']}
    assert sensitive_cols == {'customer_name', 'email', 'ssn'}

    # Verify auto_privacy configures privacy rules for sensitive columns
    spec = fit_spec(frame, auto_privacy=True)
    spec_cols = {c.name: c for c in spec.tables[0].columns}
    assert spec_cols['customer_name'].privacy_rule is not None
    assert spec_cols['email'].privacy_rule is not None
    assert spec_cols['ssn'].privacy_rule is not None
    assert spec_cols['order_id'].privacy_rule is None
    assert spec_cols['product_name'].privacy_rule is None
    assert spec_cols['price'].privacy_rule is None
    assert spec_cols['status'].privacy_rule is None
