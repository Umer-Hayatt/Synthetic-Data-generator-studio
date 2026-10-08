from fastapi.testclient import TestClient
from app.main import app
from app.core.ai import AIRouter, AIError
from app.api import intelligence
from test_ai import Fake
import pytest
import json


def test_prompt_spec_review_and_outage(monkeypatch):
    spec = {'name':'shop','version':'2.0','tables':[{'name':'customers','row_count':100000,
            'columns':[{'name':'id','dtype':'integer','constraints':{'unique':True,'auto_increment':True}}],
            'primary_key':'id'}]}
    monkeypatch.setattr(intelligence,'get_router',lambda:AIRouter([Fake([spec])]))
    client = TestClient(app)
    result = client.post('/api/v1/ai/spec',json={'prompt':'Create 100000 customers'}).json()
    assert result['status'] == 'review_required'
    assert result['spec']['tables'][0]['row_count'] == 100000
    # When no key, reason is safe code 'no_key' and a fallback draft is returned
    monkeypatch.setattr(intelligence,'get_router',lambda:AIRouter([]))
    no_key = client.post('/api/v1/ai/spec',json={'prompt':'100 bank customers'}).json()
    assert no_key['status'] == 'review_required'
    assert no_key['reason'] == 'no_key'
    assert no_key.get('fallback_used') is True
    assert 'spec' in no_key
    assert client.post('/api/v1/ai/suggestions',json={'spec':spec}).json()['status'] == 'deterministic'


def test_malformed_spec_falls_back_to_draft(monkeypatch):
    """AI returns an empty table list — endpoint must return fallback draft, not an error."""
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([{'tables': []}])]))
    result = TestClient(app).post('/api/v1/ai/spec', json={'prompt': '50 hospital patients'}).json()
    # Should be review_required with fallback, NOT unavailable
    assert result['status'] == 'review_required'
    assert result.get('fallback_used') is True
    assert 'spec' in result
    assert result['spec']['tables'][0]['name'] == 'Patients'


@pytest.mark.parametrize('rows', [1, 5001, 100000])
def test_draft_preserves_requested_row_count(monkeypatch, rows):
    draft = {'name': 'customers', 'tables': [{'name': 'customers', 'row_count': rows,
        'columns': [{'name': 'id', 'dtype': 'integer', 'is_primary_key': True}]}]}
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([draft])]))
    result = TestClient(app).post('/api/v1/ai/spec', json={'prompt': f'Create {rows} customers'}).json()
    assert result['status'] == 'review_required'
    assert result['spec']['tables'][0]['row_count'] == rows


@pytest.mark.parametrize('rows', [0, -1, 10000001])
def test_invalid_draft_counts_are_rejected_not_silently_changed(monkeypatch, rows):
    draft = {'tables': [{'name': 'customers', 'row_count': rows,
        'columns': [{'name': 'id', 'dtype': 'integer', 'is_primary_key': True}]}]}
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([draft])]))
    result = TestClient(app).post('/api/v1/ai/spec', json={'prompt': 'Create customers'}).json()
    # AI returned invalid rows → falls back to rule-based draft (review_required)
    assert result['status'] == 'review_required'
    assert result.get('fallback_used') is True


# ---------------------------------------------------------------------------
# Per-reason-code fallback tests (no live API)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize('ai_error_kind,expected_safe_reason', [
    ('missing_credential', 'no_key'),
    ('invalid_credential', 'auth_failed'),
    ('invalid_configuration', 'no_key'),
    ('rate_limit', 'rate_limited'),
    ('timeout', 'timeout'),
    ('network', 'timeout'),
    ('malformed_output', 'invalid_output'),
    ('provider_error', 'invalid_output'),
])
def test_all_ai_failure_reasons_return_fallback_draft(monkeypatch, ai_error_kind, expected_safe_reason):
    class FailingRouter:
        def generate_structured(self, *args, **kwargs):
            raise AIError(ai_error_kind)

    monkeypatch.setattr(intelligence, 'get_router', lambda: FailingRouter())
    client = TestClient(app)
    result = client.post('/api/v1/ai/spec', json={'prompt': '100 bank customers with balance and credit score'}).json()
    response_text = json.dumps(result).lower()

    # Must be a usable draft
    assert result['status'] == 'review_required', f"Expected review_required, got: {result}"
    assert result.get('fallback_used') is True
    assert result['reason'] == expected_safe_reason
    assert 'spec' in result
    assert len(result['spec']['tables']) > 0
    assert len(result['spec']['tables'][0]['columns']) > 0

    # Notice must mention AI unavailability — but must never tell user to upload a file
    notice = result.get('notice', '').lower()
    assert 'ai unavailable' in notice
    assert 'upload' not in notice
    assert 'manual schema' not in notice
    assert 'uploaded-data' not in notice

    # Verify wording across entire response
    assert 'upload a file' not in response_text
    assert 'upload an existing' not in response_text
    assert 'use manual schema' not in response_text
    assert 'uploaded-data profiling' not in response_text


@pytest.mark.parametrize('prompt,expected_rows,expected_table,expected_cols', [
    ('5000 university students with GPA, semester, attendance and fee status', 5000, 'Students', ['id', 'full_name', 'email', 'semester', 'gpa', 'attendance', 'fee_status']),
    ('250 bank customers with account numbers, balance and credit score', 250, 'BankCustomers', ['id', 'full_name', 'email', 'account_number', 'account_type', 'balance', 'credit_score']),
    ('1000 retail products with categories, SKU and unit price', 1000, 'Products', ['id', 'product_name', 'category', 'sku', 'unit_price', 'stock_quantity']),
    ('50 hospital patients with diagnosis, room number and admission date', 50, 'Patients', ['id', 'patient_name', 'gender', 'diagnosis', 'room_number', 'admission_date']),
    ('500 company employees with department, salary and hire date', 500, 'Employees', ['id', 'full_name', 'email', 'department', 'job_title', 'salary', 'hire_date']),
    ('120 commercial flights with airline, origin, destination and status', 120, 'Flights', ['id', 'flight_number', 'airline', 'origin', 'destination', 'departure_time', 'status']),
    ('300 library books with author, ISBN and publication year', 300, 'Books', ['id', 'title', 'author', 'isbn', 'genre', 'publication_year', 'is_available']),
    ('80 real-estate listings with address, property type and price', 80, 'RealEstate', ['id', 'address', 'city', 'property_type', 'price', 'bedrooms', 'bathrooms']),
    ('2000 IoT sensor readings with temperature and humidity telemetry', 2000, 'SensorReadings', ['id', 'device_id', 'timestamp', 'temperature', 'humidity', 'status']),
    ('150 restaurant orders with food items, quantity and total price', 150, 'RestaurantOrders', ['id', 'customer_name', 'item_name', 'category', 'quantity', 'total_price', 'order_status']),
])
def test_fallback_generator_varied_prompts(monkeypatch, prompt, expected_rows, expected_table, expected_cols):
    import json
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([]))
    client = TestClient(app)
    result = client.post('/api/v1/ai/spec', json={'prompt': prompt}).json()

    assert result['status'] == 'review_required'
    assert result.get('fallback_used') is True
    assert 'spec' in result

    table = result['spec']['tables'][0]
    assert table['name'] == expected_table
    assert table['row_count'] == expected_rows
    assert len(table['columns']) >= len(expected_cols)

    col_names = [c['name'] for c in table['columns']]
    for expected_col in expected_cols:
        assert expected_col in col_names, f"Expected column {expected_col} missing in {table['name']}"

    # Assert every column has valid dtype and semantic type
    for col in table['columns']:
        assert col['dtype'] in {'integer', 'float', 'string', 'boolean', 'datetime'}
        assert col['semantic_type'] in {
            'id', 'email', 'phone', 'person_name', 'money',
            'categorical', 'numeric', 'datetime', 'generic_text', 'address'
        }

    # Assert never asks or instructs to upload a file
    response_text = json.dumps(result).lower()
    assert 'upload a file' not in response_text
    assert 'upload an existing' not in response_text
    assert 'use manual schema' not in response_text
    assert 'uploaded-data profiling' not in response_text
