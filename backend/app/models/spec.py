"""Canonical schema. Version 1 retains P0 bounds; version 2 adds reviewed plans."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.core.config import settings


class Model(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)


class Constraints(Model):
    unique: bool = False
    auto_increment: bool = False
    min: float | None = None
    max: float | None = None
    categories: list[str | int | float | bool] | None = None

    @model_validator(mode='after')
    def bounds(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError('min must not exceed max')
        if self.categories is not None and not self.categories:
            raise ValueError('categories must not be empty')
        return self


class Distribution(Model):
    type: Literal['gaussian', 'uniform', 'categorical', 'empirical', 'skewed'] = 'gaussian'
    mean: float = 0
    std: float = Field(default=1, ge=0)
    skew: float = 0
    values: list[str | int | float | bool] = Field(default_factory=list, max_length=1000)
    probabilities: list[float] = Field(default_factory=list, max_length=1000)
    quantiles: list[float] = Field(default_factory=list, max_length=101)

    @model_validator(mode='after')
    def probabilities_valid(self):
        if self.probabilities and (len(self.values) != len(self.probabilities) or
                                  any(p < 0 for p in self.probabilities) or
                                  abs(sum(self.probabilities) - 1) > 1e-6):
            raise ValueError('probabilities must match values, be nonnegative, and sum to 1')
        if self.type == 'categorical' and not self.values:
            raise ValueError('categorical distribution requires values')
        if self.type == 'empirical' and not self.quantiles:
            raise ValueError('empirical distribution requires quantiles')
        if self.quantiles != sorted(self.quantiles):
            raise ValueError('quantiles must be sorted')
        return self


class PrivacyRule(Model):
    method: Literal['mask', 'hash', 'noise']
    noise_std: float = Field(default=1, ge=0)
    mask_value: str = '***'


class ColumnSpec(Model):
    name: str = Field(min_length=1, max_length=128)
    dtype: Literal['integer', 'float', 'boolean', 'string', 'datetime']
    semantic_type: Literal['id', 'email', 'phone', 'person_name', 'address', 'money', 'categorical', 'numeric', 'datetime', 'generic_text'] = 'generic_text'
    nullable: bool = True
    null_rate: float = Field(default=0, ge=0, le=1)
    constraints: Constraints = Field(default_factory=Constraints)
    distribution: Distribution | None = None
    privacy_rule: PrivacyRule | Literal['mask', 'hash', 'noise'] | None = None
    outlier_rate: float = Field(default=0, ge=0, le=1)
    outlier_scale: float = Field(default=5, ge=1, le=100)

    @model_validator(mode='after')
    def consistent(self):
        if not self.name.strip():
            raise ValueError('column name cannot be blank')
        if not self.nullable and self.null_rate:
            raise ValueError('non-nullable column cannot have nulls')
        method = self.privacy_rule if isinstance(self.privacy_rule, str) else getattr(self.privacy_rule, 'method', None)
        if (method == 'noise' or self.outlier_rate) and self.dtype not in ('integer', 'float'):
            raise ValueError('noise and outliers require numeric columns')
        if self.constraints.auto_increment and self.dtype != 'integer':
            raise ValueError('auto_increment requires integer dtype')
        if self.semantic_type in ('email', 'phone', 'person_name', 'address') and self.dtype != 'string':
            raise ValueError('identity semantics require string dtype')
        if self.semantic_type == 'id' and self.dtype not in ('integer', 'string'):
            raise ValueError('ID semantics require integer or string dtype')
        categories = self.constraints.categories or (self.distribution.values if self.distribution else [])
        if categories:
            if self.dtype in ('integer', 'float', 'datetime') and any(not isinstance(value, (int, float)) or isinstance(value, bool) for value in categories):
                raise ValueError('numeric/date categories must be numeric (date values are epoch seconds)')
            if self.dtype == 'integer' and any(float(value) % 1 for value in categories):
                raise ValueError('integer categories must be integral')
            if self.dtype == 'boolean' and any(not isinstance(value, bool) for value in categories):
                raise ValueError('boolean categories must be booleans')
            if self.dtype == 'string' and any(not isinstance(value, str) for value in categories):
                raise ValueError('string categories must be strings')
        if self.dtype == 'integer' and self.constraints.min is not None and self.constraints.max is not None:
            import math
            if math.ceil(self.constraints.min) > math.floor(self.constraints.max):
                raise ValueError('integer bounds must include an integer')
        if self.constraints.unique and (self.null_rate or method == 'mask'):
            raise ValueError('unique columns cannot have nulls or constant masks')
        return self


class ForeignKey(Model):
    column: str
    reference_table: str
    reference_column: str
    cardinality: Literal['1:1', '1:N'] = '1:N'
    min_children: int = Field(default=0, ge=0)
    max_children: int | None = Field(default=None, ge=1)
    allocation: Literal['uniform', 'zipf'] = 'uniform'


class Reconciliation(Model):
    parent_table: str
    parent_column: str
    child_table: str
    foreign_key: str
    factors: list[str] = Field(min_length=1, max_length=3)
    discount_column: str | None = None
    tax_column: str | None = None


class ReferenceValue(Model):
    table: str
    column: str
    foreign_key: str
    reference_column: str


class CategoryRange(Model):
    table: str
    category_column: str
    value_column: str
    ranges: dict[str, tuple[float, float]] = Field(min_length=1, max_length=100)


class Settlement(Model):
    """Explicit full one-to-one settlement, not a partial-payment simulator."""
    table: str
    foreign_key: str
    amount_column: str
    total_column: str
    status_column: str | None = None
    parent_status_column: str | None = None
    status_value: str = 'succeeded'
    parent_status_value: str = 'paid'


class DocumentRequest(Model):
    kind: Literal['invoice', 'bank_statement']
    parent_table: str
    child_table: str
    foreign_key: str
    amount_column: str | None = None
    quantity_column: str | None = None
    price_column: str | None = None
    date_column: str | None = None
    credit_column: str | None = None
    debit_column: str | None = None
    opening_balance_column: str | None = None
    tax_rate: float = Field(default=0, ge=0, le=1)
    discount_rate: float = Field(default=0, ge=0, le=1)
    date_from: str | None = None
    date_to: str | None = None


class TableSpec(Model):
    name: str = Field(min_length=1, max_length=128)
    row_count: int = Field(ge=1, le=settings.job_max_rows)
    columns: list[ColumnSpec] = Field(min_length=1, max_length=settings.max_columns)
    primary_key: str | None = None
    foreign_keys: list[ForeignKey] = Field(default_factory=list)
    target_column: str | None = None
    correlation_columns: list[str] = Field(default_factory=list)
    correlation_matrix: list[list[float]] = Field(default_factory=list)
    unique_together: list[list[str]] = Field(default_factory=list, max_length=1)

    @model_validator(mode='after')
    def consistent(self):
        names = [column.name for column in self.columns]
        if self.target_column is not None and self.target_column not in names:
            raise ValueError('target column must exist')
        if len({fk.column for fk in self.foreign_keys}) != len(self.foreign_keys):
            raise ValueError('duplicate foreign key columns')
        if len(names) != len(set(names)):
            raise ValueError('duplicate column names')
        for group in self.unique_together:
            if len(group) != 2 or len(set(group)) != 2 or not set(group) <= {fk.column for fk in self.foreign_keys}:
                raise ValueError('unique_together requires two distinct declared foreign keys.')
        if self.primary_key is not None:
            if self.primary_key not in names:
                raise ValueError('primary key must reference an existing column')
            column = self.columns[names.index(self.primary_key)]
            if not column.constraints.unique or column.null_rate:
                raise ValueError('primary key requires uniqueness and zero null rate')
        n = len(self.correlation_columns)
        if len(set(self.correlation_columns)) != n or any(name not in names for name in self.correlation_columns):
            raise ValueError('invalid correlation columns')
        if len(self.correlation_matrix) != n or any(len(row) != n for row in self.correlation_matrix):
            raise ValueError('correlation matrix dimensions must match columns')
        if n:
            import numpy as np
            matrix = np.array(self.correlation_matrix)
            if not np.allclose(matrix, matrix.T) or not np.allclose(matrix.diagonal(), 1) or np.linalg.eigvalsh(matrix).min() < -1e-6:
                raise ValueError('correlation matrix must be symmetric, positive semidefinite, with diagonal 1')
        return self


class DatasetSpec(Model):
    name: str = Field(min_length=1, max_length=128)
    version: Literal['1.0', '2.0'] = '1.0'
    locale: str = 'en_US'
    seed: int = Field(default=42, ge=0, le=2**32 - 1)
    tables: list[TableSpec] = Field(min_length=1, max_length=20)
    reconciliations: list[Reconciliation] = Field(default_factory=list, max_length=20)
    documents: list[DocumentRequest] = Field(default_factory=list, max_length=20)
    edge_cases: list[str] = Field(default_factory=list, max_length=30)
    business_rules: list[str] = Field(default_factory=list, max_length=30)
    reference_values: list[ReferenceValue] = Field(default_factory=list, max_length=20)
    temporal_constraints: list[ReferenceValue] = Field(default_factory=list, max_length=20)
    category_ranges: list[CategoryRange] = Field(default_factory=list, max_length=20)
    settlements: list[Settlement] = Field(default_factory=list, max_length=20)

    @model_validator(mode='after')
    def unique_tables(self):
        if len({table.name for table in self.tables}) != len(self.tables):
            raise ValueError('duplicate table names')
        if self.version == '1.0' and any(t.row_count > settings.max_rows for t in self.tables):
            raise ValueError('Version 1 row limit exceeded; use a version 2 job.')
        tables = {t.name: t for t in self.tables}
        graph = {t.name: set() for t in self.tables}
        for table in self.tables:
            columns = {c.name: c for c in table.columns}
            for fk in table.foreign_keys:
                parent = tables.get(fk.reference_table)
                if parent is None or fk.reference_column != parent.primary_key or fk.column not in columns:
                    raise ValueError('Foreign keys must reference existing primary keys and columns.')
                parent_column = next(c for c in parent.columns if c.name == parent.primary_key)
                if columns[fk.column].dtype != parent_column.dtype:
                    raise ValueError('Foreign key types must match.')
                if columns[fk.column].privacy_rule or parent_column.privacy_rule or columns[fk.column].null_rate:
                    raise ValueError('Relational keys cannot have privacy transforms or nulls.')
                if fk.max_children is not None and fk.min_children > fk.max_children:
                    raise ValueError('Invalid cardinality bounds.')
                if fk.cardinality == '1:1' and table.row_count > parent.row_count:
                    raise ValueError('One-to-one child count exceeds parent count.')
                if fk.cardinality == '1:1' and fk.min_children > 1:
                    raise ValueError('One-to-one minimum cannot exceed one.')
                if table.row_count < parent.row_count * fk.min_children or (fk.max_children and table.row_count > parent.row_count * fk.max_children):
                    raise ValueError('Row counts cannot satisfy cardinality bounds.')
                graph[table.name].add(parent.name)
        from graphlib import TopologicalSorter, CycleError
        try:
            tuple(TopologicalSorter(graph).static_order())
        except CycleError:
            raise ValueError('Relationship graph must be acyclic.') from None
        for rule in self.reconciliations:
            parent, child = tables.get(rule.parent_table), tables.get(rule.child_table)
            if not parent or not child or rule.parent_column not in {c.name for c in parent.columns}:
                raise ValueError('Invalid reconciliation tables/column.')
            if not any(f.column == rule.foreign_key and f.reference_table == parent.name for f in child.foreign_keys):
                raise ValueError('Reconciliation requires a declared foreign key.')
            numeric = {c.name for c in child.columns if c.dtype in ('integer','float')}
            if not set(rule.factors) <= numeric:
                raise ValueError('Reconciliation factors must be numeric columns.')
            if any(c.null_rate or c.privacy_rule for c in child.columns if c.name in rule.factors):
                raise ValueError('Reconciliation factors must be non-null and untransformed.')
            destination = next(c for c in parent.columns if c.name == rule.parent_column)
            if destination.dtype != 'float' or destination.privacy_rule or destination.constraints.unique:
                raise ValueError('Reconciliation destination must be an untransformed non-unique float column.')
        if len({(r.parent_table,r.parent_column) for r in self.reconciliations}) != len(self.reconciliations):
            raise ValueError('Duplicate reconciliation destinations.')
        for document in self.documents:
            parent, child = tables.get(document.parent_table), tables.get(document.child_table)
            if not parent or not child or not any(f.column == document.foreign_key and f.reference_table == parent.name for f in child.foreign_keys):
                raise ValueError('Document requires related parent and child tables.')
            columns = {c.name:c for c in child.columns}
            required = ([document.quantity_column,document.price_column] if document.kind == 'invoice'
                        else [document.date_column,document.credit_column,document.debit_column])
            if any(name not in columns for name in required):
                raise ValueError('Document column mappings are required and must exist.')
            for name in required:
                if name != document.date_column and (columns[name].dtype not in ('integer','float') or columns[name].null_rate or columns[name].privacy_rule):
                    raise ValueError('Document arithmetic requires non-null numeric untransformed columns.')
            if document.opening_balance_column and document.opening_balance_column not in {c.name for c in parent.columns}:
                raise ValueError('Opening balance column must exist.')
        from app.models.relational_rules import rule_plan
        rule_plan(self)
        return self
