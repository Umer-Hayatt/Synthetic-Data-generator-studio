import json
from pathlib import Path

RANGES = {'budget': (1, 20), 'premium': (50, 100)}

def col(name, dtype='string', semantic='generic_text', **extra):
    return dict(name=name, dtype=dtype, semantic_type=semantic, nullable=False, **extra)


def fixture(seed, size, enriched=False, typed=True):
    data = json.loads((Path(__file__).parent / 'fixtures/commerce.json').read_text(encoding='utf-8-sig'))
    data['seed'] = seed
    tables = {t['name']: t for t in data['tables']}
    for table in tables.values():
        table['row_count'] *= size
    if enriched:
        # Add audit probes using ONLY currently supported schema fields.
        # These are requested invariants, not claims that free-text rules execute.
        # Bounds on datetime columns currently crash relational validation.
        # Test that separately; empirical dates let the other probes finish.
        date = lambda name: col(name, 'datetime', 'datetime', distribution={
            'type': 'empirical', 'quantiles': [1735689600, 1767139200]})
        tables['Customers']['columns'] += [col('name', semantic='person_name'),
            col('email', semantic='email', constraints={'unique': True}),
            col('address'), date('created_at')]
        tables['Products']['columns'] += [col('product_name', semantic='categorical'),
            col('category', semantic='categorical', constraints={'categories': list(RANGES)}),
            col('price', 'float', 'money', constraints={'min': 1, 'max': 100})]
        tables['Orders']['columns'] += [date('ordered_at'),
            col('discount', 'float', 'money', constraints={'min': 1, 'max': 1}),
            col('tax', 'float', 'money', constraints={'min': 2, 'max': 2}),
            col('status', semantic='categorical', constraints={'categories': ['paid', 'pending']})]
        tables['OrderItems']['columns'] += [date('created_at')]
        tables['Payments']['columns'] += [col('amount', 'float', 'money', constraints={'min': 1, 'max': 500}),
            date('paid_at'), col('status', semantic='categorical', constraints={'categories': ['succeeded', 'pending']})]
        data['business_rules'] = [
            'OrderItems.price snapshots Products.price through product_id.',
            'Unique OrderItems (order_id, product_id) junction pairs.',
            'Orders.total = sum(quantity * price rounded per line) - discount + tax.',
            'Payments.amount equals the referenced Orders.total.',
            'All payments succeed and all orders are paid in this fully paid demo.',
            'Child event dates must be on or after their parent event dates.',
            'Products budget prices 1..20; premium prices 50..100.',
            'Customers order counts should be positively skewed.']
    if typed:
        tables['OrderItems']['unique_together'] = [['order_id', 'product_id']]
        if enriched:
            next(c for c in tables['Customers']['columns'] if c['name'] == 'address')['semantic_type'] = 'address'
            tables['Orders']['foreign_keys'][0]['allocation'] = 'zipf'
            # The baseline's arbitrary random-payment ceiling conflicts with full
            # settlement. Declare the requested rule, with no arbitrary ceiling.
            next(c for c in tables['Payments']['columns'] if c['name'] == 'amount')['constraints'] = {'min': 0}
            data['reconciliations'][0].update(discount_column='discount', tax_column='tax')
            data['category_ranges'] = [{'table': 'Products', 'category_column': 'category',
                                        'value_column': 'price', 'ranges': RANGES}]
            data['reference_values'] = [{'table': 'OrderItems', 'column': 'price',
                                         'foreign_key': 'product_id', 'reference_column': 'price'}]
            data['settlements'] = [{'table': 'Payments', 'foreign_key': 'order_id',
                                   'amount_column': 'amount', 'total_column': 'total',
                                   'status_column': 'status', 'parent_status_column': 'status'}]
            data['temporal_constraints'] = [
                {'table': 'Orders', 'column': 'ordered_at', 'foreign_key': 'customer_id', 'reference_column': 'created_at'},
                {'table': 'OrderItems', 'column': 'created_at', 'foreign_key': 'order_id', 'reference_column': 'ordered_at'},
                {'table': 'Payments', 'column': 'paid_at', 'foreign_key': 'order_id', 'reference_column': 'ordered_at'}]
            data['business_rules'] = []  # All executable requirements above are now typed.
    return data
