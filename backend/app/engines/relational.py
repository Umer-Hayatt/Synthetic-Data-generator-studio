"""Deterministic bounded relational execution; accounting never uses an LLM."""
from decimal import Decimal, ROUND_HALF_UP
from graphlib import TopologicalSorter
import numpy as np
import pandas as pd
from app.core.config import settings
from app.models.spec import DatasetSpec
from app.engines.tabular import generate


def money(value):
    result = Decimal(str(value))
    if not result.is_finite():
        raise ValueError('Accounting values must be finite.')
    return result.quantize(Decimal('.01'), rounding=ROUND_HALF_UP)


class RelationalSynthesizer:
    def capabilities(self):
        return {'engine':'relational','cpu':True,'cardinalities':['1:1','1:N','N:N via junction tables'],
                'bounded_cells':settings.max_cells}

    def metadata(self):
        return {'engine':'relational','rules':'typed sum-of-products','seed':self.spec.seed}

    def fit(self, source: DatasetSpec, **kwargs):
        self.spec = DatasetSpec.model_validate(source.model_dump())
        if sum(t.row_count * len(t.columns) for t in self.spec.tables) > settings.max_cells:
            raise ValueError('Local relational cell budget exceeded; reduce counts or configure a larger deployment.')
        return self

    def generate(self, row_count=None):
        spec = self.spec
        graph = {t.name: {f.reference_table for f in t.foreign_keys} for t in spec.tables}
        by_name = {t.name:t for t in spec.tables}
        result = {}
        rng = np.random.default_rng(spec.seed)
        for index, name in enumerate(TopologicalSorter(graph).static_order()):
            table = by_name[name]
            local = spec.model_copy(deep=True)
            local.tables = [table.model_copy(deep=True)]
            local.seed = (spec.seed + index) % 2**32
            # FK values come only from generated parents, not independent fake IDs.
            for column in local.tables[0].columns:
                if any(f.column == column.name for f in table.foreign_keys):
                    column.constraints.unique = False
            frame = generate(local)
            for fk in table.foreign_keys:
                parent_values = result[fk.reference_table][fk.reference_column].to_numpy()
                maximum = 1 if fk.cardinality == '1:1' else fk.max_children or table.row_count
                counts = np.full(len(parent_values), fk.min_children, dtype=int)
                remaining = table.row_count - int(counts.sum())
                # Multinomial child counts, bounded by configured min/max.
                eligible = np.flatnonzero(counts < maximum).tolist()
                for _ in range(remaining):
                    if not eligible: raise ValueError('Unsatisfiable relationship cardinality.')
                    slot = int(rng.integers(len(eligible)))
                    parent = eligible[slot]
                    counts[parent] += 1
                    if counts[parent] == maximum:
                        eligible[slot] = eligible[-1]
                        eligible.pop()
                values = np.repeat(parent_values, counts)
                rng.shuffle(values)
                frame[fk.column] = values
            if table.primary_key and (frame[table.primary_key].isna().any() or not frame[table.primary_key].is_unique):
                raise ValueError('Generated primary key is not unique/non-null.')
            result[name] = frame
        # Rules are evaluated child-first so derived parent totals can feed ancestors.
        rules = sorted(spec.reconciliations, key=lambda r:list(result).index(r.child_table), reverse=True)
        for rule in rules:
            parent, child = result[rule.parent_table], result[rule.child_table]
            pk = by_name[rule.parent_table].primary_key
            sums = {}
            for row in child.to_dict('records'):
                product = Decimal(1)
                for factor in rule.factors:
                    product *= Decimal(str(row[factor]))
                key = row[rule.foreign_key]
                sums[key] = sums.get(key, Decimal(0)) + money(product)
            parent[rule.parent_column] = parent[pk].map(lambda key: float(money(sums.get(key, 0))))
        self.validate(result)
        return result

    def validate(self, tables):
        for table in self.spec.tables:
            frame = tables[table.name]
            for column in table.columns:
                values = frame[column.name]
                if column.constraints.unique and not values.is_unique:
                    raise ValueError('Unique constraint violated.')
                if column.constraints.min is not None and (pd.to_numeric(values) < column.constraints.min).any():
                    raise ValueError('Derived value violates lower bound.')
                if column.constraints.max is not None and (pd.to_numeric(values) > column.constraints.max).any():
                    raise ValueError('Derived value violates upper bound.')
            for fk in table.foreign_keys:
                parents = tables[fk.reference_table][fk.reference_column]
                if not frame[fk.column].isin(parents).all():
                    raise ValueError('Orphan foreign key.')
                counts = frame[fk.column].value_counts().reindex(parents, fill_value=0)
                maximum = 1 if fk.cardinality == '1:1' else fk.max_children
                if counts.min() < fk.min_children or (maximum and counts.max() > maximum):
                    raise ValueError('Cardinality constraint violated.')
