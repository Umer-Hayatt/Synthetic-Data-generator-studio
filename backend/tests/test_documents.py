from decimal import Decimal
import pandas as pd
from app.models.spec import DatasetSpec
from app.engines.documents import DocumentSynthesizer
from test_relational import demo_spec


def test_invoice_from_same_entities():
    data = demo_spec().model_dump()
    data['documents'] = [{'kind':'invoice','parent_table':'Orders','child_table':'OrderItems',
        'foreign_key':'order_id','quantity_column':'quantity','price_column':'price','tax_rate':.17,'discount_rate':.03}]
    output = DocumentSynthesizer().fit(DatasetSpec.model_validate(data)).generate()
    for invoice in output['document_0_invoice'].to_dict('records'):
        assert Decimal(invoice['total']) == Decimal(invoice['subtotal'])+Decimal(invoice['tax'])-Decimal(invoice['discount'])
        assert Decimal(invoice['subtotal']) == sum((Decimal(line['line_total']) for line in invoice['lines']),Decimal(0))
        assert all(line['source']['order_id'] == invoice['entity_id'] for line in invoice['lines'])


def test_statement_continuity_and_filtered_opening():
    spec = DatasetSpec.model_validate({'name':'bank','version':'2.0','tables':[
        {'name':'accounts','row_count':1,'primary_key':'id','columns':[
            {'name':'id','dtype':'integer','constraints':{'unique':True,'auto_increment':True}},
            {'name':'opening','dtype':'float'}]},
        {'name':'transactions','row_count':3,'columns':[{'name':'account_id','dtype':'integer'},
            {'name':'date','dtype':'datetime'},{'name':'credit','dtype':'float'},{'name':'debit','dtype':'float'}],
            'foreign_keys':[{'column':'account_id','reference_table':'accounts','reference_column':'id'}]}],
        'documents':[{'kind':'bank_statement','parent_table':'accounts','child_table':'transactions',
            'foreign_key':'account_id','opening_balance_column':'opening','date_column':'date',
            'credit_column':'credit','debit_column':'debit','date_from':'2026-01-02'}]})
    tables = {'accounts':pd.DataFrame({'id':[1],'opening':[100]}),
              'transactions':pd.DataFrame({'account_id':[1,1,1], 'date':['2026-01-03','2026-01-01','2026-01-02'],
                                           'credit':[0,20,5.1],'debit':[7.3,0,0]})}
    statement = DocumentSynthesizer().fit(spec).from_entities(tables)['document_0_bank_statement'].iloc[0]
    assert statement['opening_balance'] == '120.00'
    balance = Decimal(statement['opening_balance'])
    dates = []
    for line in statement['transactions']:
        balance += Decimal(line['credit'])-Decimal(line['debit'])
        assert balance == Decimal(line['balance'])
        dates.append(line['date'])
    assert dates == sorted(dates) and balance == Decimal(statement['closing_balance']) == Decimal('117.80')
