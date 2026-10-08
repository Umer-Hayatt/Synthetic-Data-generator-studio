import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.core.ai import AIRouter
from app.api import intelligence
from app.engines.tabular import generate
from app.models.spec import DatasetSpec
from test_ai import Fake

client = TestClient(app)

PROMPTS_AND_CONFIGS = [
    (
        "80 university students with GPA, semester, attendance and fee status",
        80,
        {
            "name": "Students",
            "locale": "en_US",
            "tables": [{
                "name": "Students",
                "row_count": 80,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "name", "dtype": "string", "semantic_type": "person_name"},
                    {"name": "email", "dtype": "string", "semantic_type": "email", "unique": True},
                    {"name": "gpa", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 2.0, "max_value": 4.0, "distribution_type": "uniform"},
                    {"name": "semester", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 1, "max_value": 8},
                    {"name": "attendance", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 60.0, "max_value": 100.0},
                    {"name": "fee_status", "dtype": "string", "semantic_type": "categorical", "categories": ["Paid", "Pending", "Overdue"], "weights": [0.6, 0.3, 0.1]}
                ]
            }]
        }
    ),
    (
        "100 restaurant orders with total, price, quantity, order_status, created_at",
        100,
        {
            "name": "RestaurantOrders",
            "locale": "en_US",
            "tables": [{
                "name": "RestaurantOrders",
                "row_count": 100,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "quantity", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 1, "max_value": 10},
                    {"name": "price", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 5.0, "max_value": 50.0},
                    {"name": "total", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 5.0, "max_value": 500.0},
                    {"name": "order_status", "dtype": "string", "semantic_type": "categorical", "categories": ["Completed", "Pending", "Cancelled"], "weights": [0.7, 0.2, 0.1]},
                    {"name": "created_at", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2023-01-01", "date_max": "2023-12-31"}
                ]
            }]
        }
    ),
    (
        "90 retail banking customers with age, balance, credit_score, account_type",
        90,
        {
            "name": "BankCustomers",
            "locale": "en_US",
            "tables": [{
                "name": "BankCustomers",
                "row_count": 90,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "full_name", "dtype": "string", "semantic_type": "person_name"},
                    {"name": "age", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 18, "max_value": 75},
                    {"name": "balance", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 100.0, "max_value": 50000.0, "distribution_type": "normal", "mean": 12000.0, "std": 4000.0},
                    {"name": "credit_score", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 300, "max_value": 850},
                    {"name": "account_type", "dtype": "string", "semantic_type": "categorical", "categories": ["Checking", "Savings", "Investment"], "weights": [0.5, 0.35, 0.15]}
                ]
            }]
        }
    ),
    (
        "110 store products with sku, category, unit_price, stock_quantity",
        110,
        {
            "name": "Products",
            "locale": "en_US",
            "tables": [{
                "name": "Products",
                "row_count": 110,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "sku", "dtype": "string", "semantic_type": "id", "unique": True},
                    {"name": "category", "dtype": "string", "semantic_type": "categorical", "categories": ["Electronics", "Apparel", "Home", "Books"], "weights": [0.3, 0.3, 0.2, 0.2]},
                    {"name": "unit_price", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 9.99, "max_value": 499.99},
                    {"name": "stock_quantity", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 0, "max_value": 200}
                ]
            }]
        }
    ),
    (
        "75 hospital patients with admission_date, discharge_date, age, department",
        75,
        {
            "name": "Patients",
            "locale": "en_US",
            "tables": [{
                "name": "Patients",
                "row_count": 75,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "patient_name", "dtype": "string", "semantic_type": "person_name"},
                    {"name": "age", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 1, "max_value": 95},
                    {"name": "department", "dtype": "string", "semantic_type": "categorical", "categories": ["Cardiology", "Neurology", "Pediatrics", "Oncology"], "weights": [0.3, 0.25, 0.25, 0.2]},
                    {"name": "admission_date", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2023-01-01", "date_max": "2023-06-30"},
                    {"name": "discharge_date", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2023-01-02", "date_max": "2023-07-31"}
                ]
            }]
        }
    ),
    (
        "85 tech employees with department, salary, performance_rating, start_date",
        85,
        {
            "name": "Employees",
            "locale": "en_US",
            "tables": [{
                "name": "Employees",
                "row_count": 85,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "name", "dtype": "string", "semantic_type": "person_name"},
                    {"name": "email", "dtype": "string", "semantic_type": "email", "unique": True},
                    {"name": "department", "dtype": "string", "semantic_type": "categorical", "categories": ["Engineering", "Product", "Sales", "HR"], "weights": [0.4, 0.2, 0.3, 0.1]},
                    {"name": "salary", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 50000.0, "max_value": 200000.0, "distribution_type": "skewed", "mean": 95000.0, "std": 25000.0, "skew": 3.0},
                    {"name": "performance_rating", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 1.0, "max_value": 5.0},
                    {"name": "start_date", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2018-01-01", "date_max": "2023-12-31"}
                ]
            }]
        }
    ),
    (
        "65 commercial flights with origin, destination, departure_time, arrival_time, ticket_price",
        65,
        {
            "name": "Flights",
            "locale": "en_US",
            "tables": [{
                "name": "Flights",
                "row_count": 65,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "flight_number", "dtype": "string", "semantic_type": "id", "unique": True},
                    {"name": "origin", "dtype": "string", "semantic_type": "categorical", "categories": ["JFK", "LAX", "ORD", "DFW"], "weights": [0.25, 0.25, 0.25, 0.25]},
                    {"name": "destination", "dtype": "string", "semantic_type": "categorical", "categories": ["LHR", "HND", "CDG", "DXB"], "weights": [0.3, 0.3, 0.2, 0.2]},
                    {"name": "departure_time", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2024-01-01", "date_max": "2024-06-01"},
                    {"name": "arrival_time", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2024-01-01", "date_max": "2024-06-02"},
                    {"name": "ticket_price", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 150.0, "max_value": 1200.0}
                ]
            }]
        }
    ),
    (
        "70 library books with genre, pages, publish_year, rating",
        70,
        {
            "name": "Books",
            "locale": "en_US",
            "tables": [{
                "name": "Books",
                "row_count": 70,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "isbn", "dtype": "string", "semantic_type": "id", "unique": True},
                    {"name": "title", "dtype": "string", "semantic_type": "generic_text"},
                    {"name": "genre", "dtype": "string", "semantic_type": "categorical", "categories": ["Fiction", "Non-Fiction", "Sci-Fi", "Mystery"], "weights": [0.35, 0.3, 0.2, 0.15]},
                    {"name": "pages", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 50, "max_value": 1200},
                    {"name": "publish_year", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 1950, "max_value": 2024},
                    {"name": "rating", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 1.0, "max_value": 5.0}
                ]
            }]
        }
    ),
    (
        "95 real estate properties with price, bedrooms, square_feet, property_type",
        95,
        {
            "name": "RealEstate",
            "locale": "en_US",
            "tables": [{
                "name": "RealEstate",
                "row_count": 95,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "property_type", "dtype": "string", "semantic_type": "categorical", "categories": ["Single Family", "Condo", "Townhouse"], "weights": [0.5, 0.3, 0.2]},
                    {"name": "bedrooms", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 1, "max_value": 6},
                    {"name": "square_feet", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 450.0, "max_value": 5500.0},
                    {"name": "price", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 120000.0, "max_value": 1500000.0}
                ]
            }]
        }
    ),
    (
        "150 IoT sensor readings with temperature, humidity, pressure, timestamp",
        150,
        {
            "name": "SensorReadings",
            "locale": "en_US",
            "tables": [{
                "name": "SensorReadings",
                "row_count": 150,
                "columns": [
                    {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                    {"name": "device_id", "dtype": "string", "semantic_type": "id"},
                    {"name": "temperature", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": -10.0, "max_value": 45.0, "distribution_type": "normal", "mean": 22.0, "std": 5.0},
                    {"name": "humidity", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 10.0, "max_value": 90.0},
                    {"name": "pressure", "dtype": "float", "semantic_type": "numeric", "has_bounds": True, "min_value": 950.0, "max_value": 1050.0},
                    {"name": "timestamp", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2024-01-01", "date_max": "2024-01-07"}
                ]
            }]
        }
    ),
]


@pytest.mark.parametrize("prompt,expected_rows,draft_dict", PROMPTS_AND_CONFIGS)
def test_ten_varied_prompts_generate_valid_tables(monkeypatch, prompt, expected_rows, draft_dict):
    """Assert row count, dtypes, bounds, uniqueness, and categorical weights for 10 domains."""
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([draft_dict])]))

    # Step 1: Draft spec from prompt
    res = client.post('/api/v1/ai/spec', json={'prompt': prompt})
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'review_required'
    spec_data = data['spec']

    spec = DatasetSpec.model_validate(spec_data)
    table_spec = spec.tables[0]
    assert table_spec.row_count == expected_rows

    # Step 2: Spec-driven tabular generation
    df = generate(spec)

    # 1. Row count
    assert len(df) == expected_rows, f"Expected {expected_rows} rows, got {len(df)}"

    # 2. Dtypes & Bounds & Uniqueness
    for col in table_spec.columns:
        assert col.name in df.columns, f"Column {col.name} missing in output"
        series = df[col.name]

        # Check unique constraints
        if col.constraints and col.constraints.unique:
            assert series.nunique() == expected_rows, f"Unique constraint violated for {col.name}"

        # Check bounds
        if col.constraints and (col.constraints.min is not None or col.constraints.max is not None):
            if col.dtype in ('integer', 'float'):
                num_series = pd.to_numeric(series.dropna(), errors='coerce')
                if col.constraints.min is not None:
                    assert (num_series >= col.constraints.min - 1e-5).all(), (
                        f"Min bound violated for {col.name}: found {num_series.min()}, expected >= {col.constraints.min}"
                    )
                if col.constraints.max is not None:
                    assert (num_series <= col.constraints.max + 1e-5).all(), (
                        f"Max bound violated for {col.name}: found {num_series.max()}, expected <= {col.constraints.max}"
                    )

        # Check categorical values and weights roughly respected
        if col.distribution and col.distribution.type == 'categorical':
            allowed = set(col.distribution.values)
            actual_vals = set(series.dropna().unique())
            assert actual_vals.issubset(allowed), f"Unexpected categorical values in {col.name}: {actual_vals - allowed}"

            # If enough rows, verify all categories appear
            if expected_rows >= 60 and col.distribution.probabilities:
                counts = series.value_counts(normalize=True)
                for val, prob in zip(col.distribution.values, col.distribution.probabilities):
                    if prob >= 0.15:
                        actual_prob = counts.get(val, 0.0)
                        # Tolerance: within +- 0.20 of expected probability
                        assert abs(actual_prob - prob) < 0.25, (
                            f"Category {val} prob {actual_prob:.2f} too far from expected {prob:.2f}"
                        )


def test_seed_gives_identical_output(monkeypatch):
    """Same seed produces identical dataframe across multiple runs."""
    prompt, _, draft_dict = PROMPTS_AND_CONFIGS[0]
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([draft_dict])]))

    res = client.post('/api/v1/ai/spec', json={'prompt': prompt})
    spec_data = res.json()['spec']
    spec = DatasetSpec.model_validate(spec_data)
    spec.seed = 42

    df1 = generate(spec)
    df2 = generate(spec)
    pd.testing.assert_frame_equal(df1, df2)


def test_fallback_path_returns_rows_and_quality(monkeypatch):
    """When Gemini is completely unavailable, the fallback path returns a full spec, generates rows, and passes quality."""
    # Empty router triggers no_key / unavailable fallback
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([]))

    res = client.post('/api/v1/ai/spec', json={'prompt': '100 university students with GPA, attendance, and semester'})
    assert res.status_code == 200
    data = res.json()
    assert data['status'] == 'review_required'
    assert data.get('fallback_used') is True
    assert data.get('reason') == 'no_key'

    spec = DatasetSpec.model_validate(data['spec'])
    assert spec.tables[0].name == 'Students'
    assert spec.tables[0].row_count == 100

    # Ensure deterministic code generates every row from this fallback spec
    gen_res = client.post('/api/v1/generate', json={'spec': spec.model_dump()})
    assert gen_res.status_code == 200
    gen_data = gen_res.json()
    assert gen_data['row_count'] == 100
    assert len(gen_data['preview']) > 0
    dataset_id = gen_data['dataset_id']

    # Quality endpoint with no reference dataset
    eval_res = client.post('/api/v1/evaluate/quality', json={
        'generated_id': dataset_id,
        'spec': spec.model_dump()
    })
    assert eval_res.status_code == 200
    eval_data = eval_res.json()
    assert eval_data['overall_score'] is None
    assert eval_data['score_status'] == 'not_applicable'
    assert 'Not applicable (generated from prompt)' in eval_data['fidelity_label']
    assert eval_data['synthetic_rows'] == 100
    assert eval_data['privacy']['status'] == 'Protected'
    assert eval_data['integrity']['status'] == 'Passed'


def test_cross_column_coherence(monkeypatch):
    """Assert coherence across total = price * qty, start_date <= end_date, email matching name."""
    draft_dict = {
        "name": "CoherenceTest",
        "locale": "en_US",
        "seed": 1234,
        "tables": [{
            "name": "Orders",
            "row_count": 60,
            "columns": [
                {"name": "id", "dtype": "integer", "semantic_type": "id", "is_primary_key": True, "unique": True},
                {"name": "customer_name", "dtype": "string", "semantic_type": "person_name"},
                {"name": "customer_email", "dtype": "string", "semantic_type": "email", "unique": True},
                {"name": "quantity", "dtype": "integer", "semantic_type": "numeric", "has_bounds": True, "min_value": 1, "max_value": 5},
                {"name": "price", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 10.0, "max_value": 50.0},
                {"name": "total", "dtype": "float", "semantic_type": "money", "has_bounds": True, "min_value": 10.0, "max_value": 250.0},
                {"name": "start_date", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2023-01-01", "date_max": "2023-06-01"},
                {"name": "end_date", "dtype": "datetime", "semantic_type": "datetime", "date_min": "2023-01-01", "date_max": "2023-06-01"},
            ]
        }]
    }
    monkeypatch.setattr(intelligence, 'get_router', lambda: AIRouter([Fake([draft_dict])]))
    res = client.post('/api/v1/ai/spec', json={'prompt': '60 orders with customer_name, customer_email, quantity, price, total, start_date, end_date'})
    spec = DatasetSpec.model_validate(res.json()['spec'])
    spec.seed = 1234
    df = generate(spec)

    # Coherence 1: total = price * quantity
    expected_total = (df["price"] * df["quantity"]).round(2)
    np.testing.assert_allclose(df["total"].values, expected_total.values, atol=1e-2)

    # Coherence 2: start_date <= end_date
    start_dt = pd.to_datetime(df["start_date"])
    end_dt = pd.to_datetime(df["end_date"])
    assert (start_dt <= end_dt).all(), "Found start_date after end_date"

    # Coherence 3: email contains person name parts (or lower slug)
    for _, row in df.iterrows():
        email = row["customer_email"].lower()
        name = row["customer_name"].lower()
        first_token = name.split()[0].replace("'", "").replace(".", "")
        assert first_token in email or any(part in email for part in name.split()), (
            f"Email {email} not coherent with name {name}"
        )
