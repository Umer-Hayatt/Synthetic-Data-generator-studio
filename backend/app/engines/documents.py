"""Structured documents from generated entities, with Decimal accounting."""
from decimal import Decimal
import pandas as pd
from app.engines.relational import RelationalSynthesizer, money


class DocumentSynthesizer:
    def capabilities(self):
        return {'engine':'documents','formats':['structured JSONL'],'kinds':['invoice','bank_statement']}

    def metadata(self):
        return {'engine':'documents','arithmetic':'Decimal, half-up cents', 'source':'same generated entities'}

    def fit(self, source, **kwargs):
        self.relational = RelationalSynthesizer().fit(source)
        self.spec = self.relational.spec
        if not self.spec.documents:
            raise ValueError('Document mappings are required.')
        return self

    def generate(self, row_count=None):
        tables = self.relational.generate()
        documents = self.from_entities(tables)
        return {**tables, **documents}

    def from_entities(self, tables):
        result = {}
        for index, request in enumerate(self.spec.documents):
            parent_spec = next(t for t in self.spec.tables if t.name == request.parent_table)
            parents, children = tables[request.parent_table], tables[request.child_table]
            documents = []
            for parent in parents.to_dict('records'):
                key = parent[parent_spec.primary_key]
                rows = children[children[request.foreign_key] == key]
                if request.kind == 'invoice':
                    lines = []
                    for row in rows.to_dict('records'):
                        quantity, price = Decimal(str(row[request.quantity_column])), Decimal(str(row[request.price_column]))
                        amount = money(quantity*price)
                        lines.append({'source':row, 'line_total':str(amount)})
                    subtotal = sum((Decimal(line['line_total']) for line in lines), Decimal(0))
                    tax = money(subtotal * Decimal(str(request.tax_rate)))
                    discount = money(subtotal * Decimal(str(request.discount_rate)))
                    total = money(subtotal+tax-discount)
                    documents.append({'entity_id':key,'entity':parent,'lines':lines,
                        'subtotal':str(money(subtotal)),'tax':str(tax),'discount':str(discount),'total':str(total)})
                else:
                    rows = rows.copy()
                    rows['_date'] = pd.to_datetime(rows[request.date_column], utc=True, errors='raise')
                    if rows['_date'].isna().any(): raise ValueError('Statement dates cannot be null.')
                    rows = rows.sort_values('_date', kind='stable')
                    start = pd.to_datetime(request.date_from, utc=True) if request.date_from else None
                    end = pd.to_datetime(request.date_to, utc=True) if request.date_to else None
                    if start is not None and end is not None and start > end:
                        raise ValueError('Statement date interval is reversed.')
                    balance = money(parent[request.opening_balance_column] if request.opening_balance_column else 0)
                    opening, lines = balance, []
                    for row in rows.to_dict('records'):
                        date = row.pop('_date')
                        credit, debit = money(row[request.credit_column]), money(row[request.debit_column])
                        if credit < 0 or debit < 0:
                            raise ValueError('Statement credits/debits must be nonnegative.')
                        if end is not None and date > end: break
                        balance = money(balance+credit-debit)
                        if start is not None and date < start:
                            opening = balance
                            continue
                        lines.append({'source':row,'date':date.isoformat(),'credit':str(credit),
                                      'debit':str(debit),'balance':str(balance)})
                    documents.append({'entity_id':key,'entity':parent,'opening_balance':str(opening),
                                      'transactions':lines,'closing_balance':str(balance)})
            result[f'document_{index}_{request.kind}'] = pd.DataFrame(documents)
        return result
