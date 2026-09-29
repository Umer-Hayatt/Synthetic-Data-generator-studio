from decimal import Decimal
import pandas as pd
import pytest
from app.models.spec import DatasetSpec
from app.engines.relational import RelationalSynthesizer, money


def demo_spec():
    def table(name, rows):
        return {'name':name,'row_count':rows,'primary_key':'id','columns':[
            {'name':'id','dtype':'integer','semantic_type':'id','constraints':{'unique':True,'auto_increment':True}}]}
    customers, products, orders, items, payments = [table(n,r) for n,r in
        [('Customers',10),('Products',8),('Orders',30),('OrderItems',90),('Payments',30)]]
    def fk(child, column, parent, cardinality='1:N', minimum=0):
        child['columns'].append({'name':column,'dtype':'integer'})
        child.setdefault('foreign_keys',[]).append({'column':column,'reference_table':parent,
             'reference_column':'id','cardinality':cardinality,'min_children':minimum})
    fk(orders,'customer_id','Customers',minimum=1)
    fk(items,'order_id','Orders',minimum=1)
    fk(items,'product_id','Products')
    fk(payments,'order_id','Orders','1:1',1)
    orders['columns'].append({'name':'total','dtype':'float'})
    items['columns'] += [{'name':'quantity','dtype':'integer','constraints':{'min':1,'max':5}},
                         {'name':'price','dtype':'float','constraints':{'min':1,'max':100}}]
    return DatasetSpec.model_validate({'name':'shop','version':'2.0','seed':22,
        'tables':[items,payments,orders,customers,products],
        'reconciliations':[{'parent_table':'Orders','parent_column':'total','child_table':'OrderItems',
                           'foreign_key':'order_id','factors':['quantity','price']}]})


def test_five_table_dag_integrity_seed_and_reconciliation():
    spec = demo_spec()
    engine = RelationalSynthesizer().fit(spec)
    a,b = engine.generate(), engine.generate()
    for name in a:
        pd.testing.assert_frame_equal(a[name],b[name])
        assert a[name].id.is_unique
    for order in a['Orders'].to_dict('records'):
        lines = a['OrderItems'][a['OrderItems'].order_id == order['id']]
        total = sum((money(Decimal(str(r.quantity))*Decimal(str(r.price))) for r in lines.itertuples()),Decimal(0))
        assert money(order['total']) == total
    assert a['Payments'].order_id.is_unique
    assert set(a['Payments'].order_id) == set(a['Orders'].id)


def test_cycle_and_bad_cardinality_rejected():
    data = demo_spec().model_dump()
    data['tables'][2]['foreign_keys'][0]['min_children'] = 10
    with pytest.raises(ValueError): DatasetSpec.model_validate(data)
    data = demo_spec().model_dump()
    data['tables'][3]['foreign_keys'] = [{'column':'id','reference_table':'Orders','reference_column':'id'}]
    with pytest.raises(ValueError): DatasetSpec.model_validate(data)
