"""Validate typed relational operations and return their dependency order."""
from graphlib import TopologicalSorter, CycleError
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR


def rule_plan(spec):
    tables = {t.name: t for t in spec.tables}
    operations, writers = {}, {}

    def column(table, name, writable=False, dtype=None):
        if table not in tables or name not in {c.name for c in tables[table].columns}:
            raise ValueError('Relational rule references an unknown table or column.')
        col = next(c for c in tables[table].columns if c.name == name)
        if col.null_rate or col.privacy_rule:
            raise ValueError('Relational rule columns must be non-null and untransformed.')
        if dtype and col.dtype not in dtype:
            raise ValueError('Relational rule column type is incompatible.')
        if writable and (col.constraints.unique or name == tables[table].primary_key or
                         name in {f.column for f in tables[table].foreign_keys}):
            raise ValueError('Relational rules cannot overwrite keys or unique columns.')
        return col

    def relation(table, key):
        if table not in tables:
            raise ValueError('Relational rule references an unknown table.')
        fk = next((f for f in tables[table].foreign_keys if f.column == key), None)
        if fk is None:
            raise ValueError('Relational rule requires a declared foreign key.')
        return fk

    def add(kind, index, outputs, inputs):
        node = (kind, index)
        for output in outputs:
            if output in writers:
                raise ValueError('Multiple relational rules write the same column.')
            writers[output] = node
        operations[node] = inputs

    for table in tables.values():
        for group in table.unique_together:
            fks = [relation(table.name, c) for c in group]
            if sum(f.allocation == 'zipf' for f in fks) > 1:
                raise ValueError('A unique junction supports skew on only one side; the other side is balanced.')
            parents = [tables[f.reference_table].row_count for f in fks]
            if table.row_count > parents[0] * parents[1]:
                raise ValueError('Unique junction pair capacity exceeded.')
            for i, fk in enumerate(fks):
                maximum = 1 if fk.cardinality == '1:1' else fk.max_children or table.row_count
                if fk.min_children > parents[1-i] or table.row_count > parents[i] * min(maximum, parents[1-i]):
                    raise ValueError('Junction cardinality exceeds unique pair capacity.')

    for i, rule in enumerate(spec.reconciliations):
        inputs = {(rule.child_table, c) for c in rule.factors}
        for name in (rule.discount_column, rule.tax_column):
            if name:
                column(rule.parent_table, name, dtype=('integer', 'float'))
                inputs.add((rule.parent_table, name))
        column(rule.parent_table, rule.parent_column, writable=True, dtype=('float',))
        add('reconcile', i, [(rule.parent_table, rule.parent_column)], inputs)

    for kind, rules in (('copy', spec.reference_values), ('temporal', spec.temporal_constraints)):
        for i, rule in enumerate(rules):
            fk = relation(rule.table, rule.foreign_key)
            source = column(fk.reference_table, rule.reference_column)
            dest = column(rule.table, rule.column, writable=True)
            if source.dtype != dest.dtype or (kind == 'temporal' and dest.dtype != 'datetime'):
                raise ValueError('Reference rule column types must match; temporal rules require datetime.')
            add(kind, i, [(rule.table, rule.column)], {(fk.reference_table, rule.reference_column)})

    for i, rule in enumerate(spec.category_ranges):
        category = column(rule.table, rule.category_column, dtype=('string',))
        dest = column(rule.table, rule.value_column, writable=True, dtype=('float',))
        categories = category.constraints.categories or (category.distribution.values if category.distribution else [])
        if not categories or set(categories) != set(rule.ranges):
            raise ValueError('Category ranges must cover the explicit category values exactly.')
        for lo, hi in rule.ranges.values():
            if lo > hi or (dest.constraints.min is not None and lo < dest.constraints.min) or (dest.constraints.max is not None and hi > dest.constraints.max):
                raise ValueError('Category price range conflicts with column bounds.')
            if (Decimal(str(lo))*100).to_integral_value(rounding=ROUND_CEILING) > (Decimal(str(hi))*100).to_integral_value(rounding=ROUND_FLOOR):
                raise ValueError('Category price range must contain a whole cent.')
        add('category', i, [(rule.table, rule.value_column)], {(rule.table, rule.category_column)})

    for i, rule in enumerate(spec.settlements):
        fk = relation(rule.table, rule.foreign_key)
        if fk.cardinality != '1:1' or fk.min_children != 1 or tables[rule.table].row_count != tables[fk.reference_table].row_count:
            raise ValueError('Full settlement requires complete one-to-one coverage.')
        column(rule.table, rule.amount_column, writable=True, dtype=('float',))
        column(fk.reference_table, rule.total_column, dtype=('float',))
        outputs = [(rule.table, rule.amount_column)]
        for table, name, value in ((rule.table, rule.status_column, rule.status_value),
                                   (fk.reference_table, rule.parent_status_column, rule.parent_status_value)):
            if name:
                col = column(table, name, writable=True, dtype=('string',))
                choices = col.constraints.categories or (col.distribution.values if col.distribution else [])
                if choices and value not in choices:
                    raise ValueError('Settlement status is outside the declared categories.')
                outputs.append((table, name))
        add('settle', i, outputs, {(fk.reference_table, rule.total_column)})

    graph = {node: sorted({writers[c] for c in inputs if c in writers}) for node, inputs in sorted(operations.items())}
    try:
        return list(TopologicalSorter(graph).static_order())
    except CycleError:
        raise ValueError('Relational rule dependencies must be acyclic.') from None
