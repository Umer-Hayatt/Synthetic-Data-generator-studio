"""Deterministic bounded relational execution; accounting never uses an LLM."""
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, ROUND_CEILING, ROUND_FLOOR
from graphlib import TopologicalSorter
import hashlib
import heapq
import numpy as np
import pandas as pd
from app.core.config import settings
from app.models.spec import DatasetSpec
from app.models.relational_rules import rule_plan
from app.engines.tabular import generate, locale_details


def money(value):
    try:
        result = Decimal(str(value))
        if not result.is_finite():
            raise ValueError('Accounting values must be finite.')
        return result.quantize(Decimal('.01'), rounding=ROUND_HALF_UP)
    except (InvalidOperation, TypeError):
        raise ValueError('Accounting value is invalid or exceeds supported precision.') from None


def money_float(value):
    """Keep the existing numeric API, but refuse loss of decimal cents."""
    amount = money(value)
    value = float(amount)
    if not np.isfinite(value) or Decimal(str(value)) != amount:
        raise ValueError('Accounting amount exceeds exact cent precision of numeric output.')
    return value


def table_seed(seed, name):
    return int.from_bytes(hashlib.sha256(f'{seed}\0{name}'.encode()).digest()[:4], 'big')


def child_counts(n, parents, minimum, maximum, allocation, rng):
    if parents < 1 or minimum > maximum or n < parents * minimum or n > parents * maximum:
        raise ValueError('Unsatisfiable relationship cardinality.')
    counts = np.full(parents, minimum, dtype=np.int64)
    weights = np.ones(parents) if allocation == 'uniform' else 1 / np.arange(1, parents + 1, dtype=float)**2
    if allocation == 'zipf':
        rng.shuffle(weights)
    remaining = n - int(counts.sum())
    while remaining:
        eligible = np.flatnonzero(counts < maximum)
        probabilities = weights[eligible] / weights[eligible].sum()
        additions = np.minimum(rng.multinomial(remaining, probabilities), maximum - counts[eligible])
        counts[eligible] += additions
        remaining -= int(additions.sum())
    return counts


class RelationalSynthesizer:
    def capabilities(self):
        return {'engine': 'relational', 'cpu': True, 'cardinalities': ['1:1', '1:N', 'N:N via junction tables'],
                'bounded_cells': settings.max_cells}

    def metadata(self):
        return {'engine': 'relational', 'rules': 'typed relational rules', 'seed': self.spec.seed,
                **locale_details(self.spec.locale),
                'unexecuted_business_rules': bool(self.spec.business_rules)}

    def fit(self, source: DatasetSpec, **kwargs):
        self.spec = DatasetSpec.model_validate(source.model_dump())
        if sum(t.row_count * len(t.columns) for t in self.spec.tables) > settings.max_cells:
            raise ValueError('Local relational cell budget exceeded; reduce counts or configure a larger deployment.')
        self.plan = rule_plan(self.spec)
        return self

    @staticmethod
    def _maximum(table, fk):
        col = next(c for c in table.columns if c.name == fk.column)
        return 1 if fk.cardinality == '1:1' or col.constraints.unique else fk.max_children or table.row_count

    def _junction(self, table, group, frames, rng):
        fks = [next(f for f in table.foreign_keys if f.column == c) for c in sorted(group)]
        if fks[1].allocation == 'zipf':
            fks.reverse()
        left, right = fks
        a = frames[left.reference_table][left.reference_column].to_numpy()
        b = frames[right.reference_table][right.reference_column].to_numpy()
        counts = child_counts(table.row_count, len(a), left.min_children,
                              min(self._maximum(table, left), len(b)), left.allocation, rng)
        # Balanced right degrees are graphical for bounded left degrees.
        # O(parent_count + row_count) storage; never materialize a cross join.
        degrees = np.full(len(b), table.row_count // len(b), dtype=int)
        degrees[rng.permutation(len(b))[:table.row_count % len(b)]] += 1
        if degrees.min() < right.min_children or degrees.max() > self._maximum(table, right):
            raise ValueError('Unsatisfiable junction cardinality.')
        tie = rng.permutation(len(b))
        heap = [(-int(degrees[i]), int(tie[i]), i) for i in range(len(b)) if degrees[i]]
        heapq.heapify(heap)
        pairs = []
        for i in np.argsort(-counts, kind='stable'):
            used = []
            for _ in range(int(counts[i])):
                if not heap:
                    raise ValueError('Unsatisfiable unique junction pairs.')
                degree, priority, j = heapq.heappop(heap)
                pairs.append((a[i], b[j]))
                if degree < -1:
                    used.append((degree + 1, priority, j))
            for entry in used:
                heapq.heappush(heap, entry)
        rng.shuffle(pairs)
        return {left.column: [p[0] for p in pairs], right.column: [p[1] for p in pairs]}

    def generate(self, row_count=None):
        spec = self.spec
        by_name = {t.name: t for t in spec.tables}
        graph = {name: sorted({f.reference_table for f in by_name[name].foreign_keys}) for name in sorted(by_name)}
        result = {}
        for name in TopologicalSorter(graph).static_order():
            table = by_name[name]
            local = spec.model_copy(deep=True)
            local.tables = [table.model_copy(deep=True)]
            local.seed = table_seed(spec.seed, name)
            for column in local.tables[0].columns:
                if any(f.column == column.name for f in table.foreign_keys):
                    column.constraints.unique = False
            frame = generate(local)
            paired = set()
            for group in table.unique_together:
                assignments = self._junction(table, group, result, np.random.default_rng(table_seed(local.seed, 'junction')))
                for column, values in assignments.items():
                    frame[column] = values
                    paired.add(column)
            for fk in sorted(table.foreign_keys, key=lambda f: f.column):
                if fk.column in paired:
                    continue
                rng = np.random.default_rng(table_seed(local.seed, fk.column))
                parent_values = result[fk.reference_table][fk.reference_column].to_numpy()
                counts = child_counts(table.row_count, len(parent_values), fk.min_children,
                                      self._maximum(table, fk), fk.allocation, rng)
                values = np.repeat(parent_values, counts)
                rng.shuffle(values)
                frame[fk.column] = values
            result[name] = frame
        for kind, index in self.plan:
            self._apply(kind, index, result, by_name)
        self.validate(result)
        return result

    @staticmethod
    def _referenced(rule, tables, by_name):
        fk = next(f for f in by_name[rule.table].foreign_keys if f.column == rule.foreign_key)
        parent = tables[fk.reference_table].set_index(fk.reference_column)
        return fk, parent

    def _apply(self, kind, index, tables, by_name):
        spec = self.spec
        if kind == 'reconcile':
            rule = spec.reconciliations[index]
            parent, child = tables[rule.parent_table], tables[rule.child_table]
            pk = by_name[rule.parent_table].primary_key
            sums = {}
            for row in child.to_dict('records'):
                product = Decimal(1)
                for factor in rule.factors:
                    product *= Decimal(str(row[factor]))
                key = row[rule.foreign_key]
                sums[key] = sums.get(key, Decimal(0)) + money(product)
            amounts = []
            for row in parent.to_dict('records'):
                total = sums.get(row[pk], Decimal(0))
                if rule.discount_column:
                    total -= money(row[rule.discount_column])
                if rule.tax_column:
                    total += money(row[rule.tax_column])
                amounts.append(money_float(total))
            parent[rule.parent_column] = amounts
        elif kind in ('copy', 'temporal'):
            rule = (spec.reference_values if kind == 'copy' else spec.temporal_constraints)[index]
            _, parent = self._referenced(rule, tables, by_name)
            frame = tables[rule.table]
            referenced = frame[rule.foreign_key].map(parent[rule.reference_column])
            if kind == 'copy':
                frame[rule.column] = referenced
            else:
                own = pd.to_datetime(frame[rule.column], utc=True)
                dates = pd.to_datetime(referenced, utc=True)
                frame[rule.column] = own.where(own >= dates, dates).dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        elif kind == 'category':
            rule = spec.category_ranges[index]
            frame = tables[rule.table]
            rng = np.random.default_rng(table_seed(spec.seed, f'{rule.table}.{rule.value_column}'))
            bounds = {key: (int((Decimal(str(lo))*100).to_integral_value(rounding=ROUND_CEILING)),
                            int((Decimal(str(hi))*100).to_integral_value(rounding=ROUND_FLOOR)))
                      for key, (lo, hi) in rule.ranges.items()}
            if any(abs(v) > 2**53 for pair in bounds.values() for v in pair):
                raise ValueError('Category prices exceed supported cent precision.')
            frame[rule.value_column] = [money_float(Decimal(int(rng.integers(bounds[c][0], bounds[c][1]+1))) / 100)
                                       for c in frame[rule.category_column]]
        elif kind == 'settle':
            rule = spec.settlements[index]
            fk, parent = self._referenced(rule, tables, by_name)
            frame = tables[rule.table]
            amounts = frame[rule.foreign_key].map(parent[rule.total_column]).map(money_float)
            if (amounts < 0).any():
                raise ValueError('Full settlement requires nonnegative order totals.')
            frame[rule.amount_column] = amounts
            if rule.status_column:
                frame[rule.status_column] = rule.status_value
            if rule.parent_status_column:
                tables[fk.reference_table][rule.parent_status_column] = rule.parent_status_value

    def validate(self, tables):
        for table in self.spec.tables:
            frame = tables[table.name]
            if len(frame) != table.row_count:
                raise ValueError('Generated row count differs from the reviewed specification.')
            if table.primary_key and (frame[table.primary_key].isna().any() or not frame[table.primary_key].is_unique):
                raise ValueError('Generated primary key is not unique/non-null.')
            for group in table.unique_together:
                if frame.duplicated(group).any():
                    raise ValueError('Duplicate junction pairs.')
            for column in table.columns:
                values = frame[column.name]
                if not column.nullable and values.isna().any():
                    raise ValueError('Non-null constraint violated.')
                if column.constraints.unique and not values.is_unique:
                    raise ValueError('Unique constraint violated.')
                if column.constraints.categories and not values.dropna().isin(column.constraints.categories).all():
                    raise ValueError('Derived value violates category membership.')
                if column.constraints.min is None and column.constraints.max is None:
                    continue
                if column.dtype == 'datetime':
                    numeric = pd.to_datetime(values, utc=True).map(lambda d: d.timestamp() if pd.notna(d) else np.nan)
                elif column.dtype in ('integer', 'float'):
                    numeric = pd.to_numeric(values)
                else:
                    raise ValueError('Relational bounds require numeric or datetime columns.')
                if column.constraints.min is not None and (numeric < column.constraints.min).any():
                    raise ValueError('Derived value violates lower bound.')
                if column.constraints.max is not None and (numeric > column.constraints.max).any():
                    raise ValueError('Derived value violates upper bound.')
            for fk in table.foreign_keys:
                parents = tables[fk.reference_table][fk.reference_column]
                if not frame[fk.column].isin(parents).all():
                    raise ValueError('Orphan foreign key.')
                counts = frame[fk.column].value_counts().reindex(parents, fill_value=0)
                if counts.min() < fk.min_children or counts.max() > self._maximum(table, fk):
                    raise ValueError('Cardinality constraint violated.')
