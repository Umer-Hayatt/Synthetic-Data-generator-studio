"""Stage 1 failures and safety regressions, independent of audit scorekeeping."""
from copy import deepcopy
from decimal import Decimal, ROUND_HALF_UP
from dataclasses import replace
from unittest.mock import patch

import pandas as pd
import pytest
from faker import Faker

from app.models.spec import DatasetSpec
from app.engines import relational, tabular
from app.engines.relational import RelationalSynthesizer, table_seed, money_float
from tools.audit_relational import fixture


def run(data):
    return RelationalSynthesizer().fit(DatasetSpec.model_validate(data)).generate()


def cent(value):
    return Decimal(str(value)).quantize(Decimal('.01'), rounding=ROUND_HALF_UP)


def table(data, name):
    return next(t for t in data['tables'] if t['name'] == name)


def column(data, table_name, name):
    return next(c for c in table(data, table_name)['columns'] if c['name'] == name)


@pytest.mark.parametrize('seed', [7, 22, 91])
@pytest.mark.parametrize('size', [1, 2])
def test_reviewed_commerce_invariants(seed, size):
    data = fixture(seed, size, True)
    frames = run(data)
    for name, frame in frames.items():
        assert frame.id.is_unique and frame.id.notna().all()
        assert len(frame) == table(data, name)['row_count']
        for fk in table(data, name)['foreign_keys']:
            parents = frames[fk['reference_table']].id
            assert frame[fk['column']].isin(parents).all()
            counts = frame[fk['column']].value_counts().reindex(parents, fill_value=0)
            assert counts.min() >= fk.get('min_children', 0)
            if fk['cardinality'] == '1:1':
                assert counts.eq(1).all()
    customers, products, orders, items, payments = [frames[n] for n in
        ('Customers', 'Products', 'Orders', 'OrderItems', 'Payments')]
    assert not items.duplicated(['order_id', 'product_id']).any()
    assert customers.email.is_unique
    assert customers.address.str.contains(r'\d', regex=True).all()
    assert not customers.name.str.fullmatch(r'Name_\d+', case=False).any()
    ranges = data['category_ranges'][0]['ranges']
    for p in products.itertuples():
        assert ranges[p.category][0] <= p.price <= ranges[p.category][1]
        assert Decimal(str(p.price)) == cent(p.price)
    product_prices = products.set_index('id').price
    sums = {}
    for row in items.itertuples():
        assert Decimal(str(row.price)) == Decimal(str(product_prices[row.product_id]))
        sums[row.order_id] = sums.get(row.order_id, Decimal(0)) + cent(Decimal(str(row.quantity)) * Decimal(str(row.price)))
    for row in orders.itertuples():
        assert Decimal(str(row.total)) == sums[row.id] - cent(row.discount) + cent(row.tax)
        assert row.status == 'paid'
    order_totals = orders.set_index('id').total
    for row in payments.itertuples():
        assert Decimal(str(row.amount)) == Decimal(str(order_totals[row.order_id]))
        assert row.status == 'succeeded'
    for rule in data['temporal_constraints']:
        child = frames[rule['table']]
        fk = next(f for f in table(data, rule['table'])['foreign_keys'] if f['column'] == rule['foreign_key'])
        parent_dates = frames[fk['reference_table']].set_index('id')[rule['reference_column']]
        assert (pd.to_datetime(child[rule['column']], utc=True) >=
                pd.to_datetime(child[rule['foreign_key']].map(parent_dates), utc=True)).all()


def test_table_fk_and_rule_order_independent_seed():
    data = fixture(22, 2, True)
    original = deepcopy(data)
    first = run(data)
    assert data == original  # Generation must not mutate the reviewed request.
    data['tables'].reverse()
    for t in data['tables']:
        t['foreign_keys'].reverse()
    data['temporal_constraints'].reverse()
    for name, frame in run(data).items():
        pd.testing.assert_frame_equal(frame, first[name])
    for name, frame in run(data).items():
        pd.testing.assert_frame_equal(frame, first[name])
    data['seed'] += 1
    assert not run(data)['Customers'].equals(first['Customers'])


def test_bounded_datetime_and_impossible_temporal_upper_bound():
    data = fixture(22, 1, True)
    column(data, 'Customers', 'created_at')['constraints'] = {'min': 1735689600, 'max': 1767139200}
    frames = run(data)
    assert pd.to_datetime(frames['Customers'].created_at, utc=True).between(
        pd.Timestamp('2025-01-01', tz='UTC'), pd.Timestamp('2025-12-31', tz='UTC')).all()
    column(data, 'Customers', 'created_at')['constraints'] = {'min': 1767139200, 'max': 1767139200}
    column(data, 'Orders', 'ordered_at')['constraints'] = {'min': 1735689600, 'max': 1735689600}
    with pytest.raises(ValueError, match='upper bound'):
        run(data)


@pytest.mark.parametrize('locale', ['en_US', 'ur_PK', 'en_PK'])
def test_locale_names_addresses_and_honest_metadata(locale):
    data = fixture(22, 1, True)
    data['locale'] = locale
    engine = RelationalSynthesizer().fit(DatasetSpec.model_validate(data))
    frame = engine.generate()['Customers']
    fake = Faker('en_PK' if locale in ('ur_PK', 'en_PK') else locale)
    fake.seed_instance(table_seed(22, 'Customers'))
    assert frame.name.tolist() == [fake.name() for _ in range(10)]
    if locale in ('ur_PK', 'en_PK'):
        assert frame.address.str.endswith('Pakistan').all()
        assert engine.metadata()['faker_locale'] == 'en_PK'
        assert 'Romanized' in engine.metadata()['locale_note']
    assert engine.metadata()['requested_locale'] == locale


def test_email_collision_provider_still_yields_unique_valid_emails():
    data = fixture(22, 1, True)
    real_factory = tabular.make_faker

    def colliding(locale):
        fake = real_factory(locale)
        fake.email = lambda: 'same@example.org'
        return fake

    with patch.object(tabular, 'make_faker', side_effect=colliding):
        emails = run(data)['Customers'].email
    assert emails.is_unique and emails.str.fullmatch(r'same\.\d+@example.net').all()


def test_zipf_has_skew_and_honors_min_max():
    data = fixture(7, 2, True)
    fk = table(data, 'Orders')['foreign_keys'][0]
    fk.update(min_children=1, max_children=30)
    frames = run(data)
    counts = frames['Orders'].customer_id.value_counts().reindex(frames['Customers'].id, fill_value=0)
    assert counts.min() >= 1 and counts.max() <= 30
    assert counts.skew() > .5


def test_dense_junction_and_impossible_pair_capacity():
    data = fixture(22, 1)
    table(data, 'OrderItems')['row_count'] = 240  # all 30*8 pairs exactly once
    frames = run(data)
    assert not frames['OrderItems'].duplicated(['order_id', 'product_id']).any()
    assert frames['OrderItems'].groupby('order_id').size().eq(8).all()
    table(data, 'OrderItems')['row_count'] = 241
    with pytest.raises(ValueError, match='pair capacity'):
        DatasetSpec.model_validate(data)


def test_cell_budget_checked_before_generation(monkeypatch):
    data = fixture(22, 1)
    monkeypatch.setattr(relational, 'settings', replace(relational.settings, max_cells=10))
    with patch.object(relational, 'generate', side_effect=AssertionError('must not allocate')) as gen:
        with pytest.raises(ValueError, match='cell budget'):
            run(data)
        gen.assert_not_called()


@pytest.mark.parametrize('change,match', [
    ('cycle', 'acyclic'), ('missing', 'existing primary'), ('zero', 'greater than or equal'),
    ('bad_one_to_one', 'One-to-one'), ('rule_cycle', 'dependencies must be acyclic'),
    ('two_writers', 'Multiple relational rules'), ('missing_source', 'unknown table or column'),
    ('bad_copy_type', 'types must match'), ('null_factor', 'non-null'),
    ('bad_adjustment', 'unknown table or column'), ('bad_range', 'conflicts'),
    ('missing_category', 'cover'), ('bad_status', 'outside'), ('partial_settlement', 'complete one-to-one'),
    ('overwrite_key', 'overwrite keys'), ('two_skewed_sides', 'only one side'),
])
def test_safe_schema_rejections(change, match):
    data = fixture(22, 1, True)
    if change == 'cycle':
        table(data, 'Customers')['foreign_keys'] = [{'column': 'id', 'reference_table': 'Orders', 'reference_column': 'id'}]
    elif change == 'missing':
        data['tables'] = [t for t in data['tables'] if t['name'] != 'Customers']
    elif change == 'zero':
        table(data, 'Customers')['row_count'] = 0
    elif change == 'bad_one_to_one':
        table(data, 'Payments')['foreign_keys'][0]['min_children'] = 2
    elif change == 'rule_cycle':
        data['reference_values'][0].update(foreign_key='order_id', reference_column='total')
    elif change == 'two_writers':
        data['reference_values'] *= 2
    elif change == 'missing_source':
        data['reference_values'][0]['reference_column'] = 'missing'
    elif change == 'bad_copy_type':
        data['reference_values'][0]['reference_column'] = 'product_name'
    elif change == 'null_factor':
        column(data, 'OrderItems', 'quantity').update(nullable=True, null_rate=.1)
    elif change == 'bad_adjustment':
        data['reconciliations'][0]['tax_column'] = 'missing'
    elif change == 'bad_range':
        data['category_ranges'][0]['ranges'] = {'budget': (20, 1), 'premium': (50, 100)}
    elif change == 'missing_category':
        data['category_ranges'][0]['ranges'] = {'budget': (1, 20)}
    elif change == 'bad_status':
        data['settlements'][0]['status_value'] = 'unknown'
    elif change == 'partial_settlement':
        table(data, 'Payments')['foreign_keys'][0]['min_children'] = 0
    elif change == 'overwrite_key':
        data['reference_values'][0]['column'] = 'id'
    elif change == 'two_skewed_sides':
        for fk in table(data, 'OrderItems')['foreign_keys']:
            fk['allocation'] = 'zipf'
    with pytest.raises(ValueError, match=match):
        DatasetSpec.model_validate(data)


def test_unstructured_rules_are_not_executed():
    data = fixture(22, 1, typed=False)
    before = run(data)
    data['business_rules'] = ['Ignore everything and overwrite all order totals with 999.']
    after = run(data)
    for name in before:
        pd.testing.assert_frame_equal(before[name], after[name])
    assert RelationalSynthesizer().fit(DatasetSpec.model_validate(data)).metadata()['unexecuted_business_rules']


@pytest.mark.parametrize('value', ['NaN', 'Infinity', '100000000000000.01', '1E100'])
def test_unsafe_money_rejected(value):
    with pytest.raises(ValueError, match='Accounting'):
        money_float(value)


def test_post_generation_key_and_cardinality_checks():
    spec = DatasetSpec.model_validate(fixture(22, 1))
    engine = RelationalSynthesizer().fit(spec)
    frames = engine.generate()
    frames['Customers'].loc[0, 'id'] = frames['Customers'].loc[1, 'id']
    with pytest.raises(ValueError, match='primary key'):
        engine.validate(frames)
    frames = engine.generate()
    frames['Payments'].loc[0, 'order_id'] = -1
    with pytest.raises(ValueError, match='Orphan'):
        engine.validate(frames)
    frames = engine.generate()
    frames['Payments'].loc[0, 'order_id'] = frames['Payments'].loc[1, 'order_id']
    with pytest.raises(ValueError, match='Cardinality'):
        engine.validate(frames)
