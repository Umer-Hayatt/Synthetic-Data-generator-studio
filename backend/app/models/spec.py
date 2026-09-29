"""Canonical P0 schema. Tables are extensible; relational execution is deferred."""
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
    type: Literal['gaussian', 'uniform', 'categorical', 'empirical'] = 'gaussian'
    mean: float = 0
    std: float = Field(default=1, ge=0)
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
    semantic_type: Literal['id', 'email', 'phone', 'person_name', 'money', 'categorical', 'numeric', 'datetime', 'generic_text'] = 'generic_text'
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
        if self.semantic_type in ('email', 'phone', 'person_name') and self.dtype != 'string':
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


class TableSpec(Model):
    name: str = Field(min_length=1, max_length=128)
    row_count: int = Field(ge=1, le=settings.max_rows)
    columns: list[ColumnSpec] = Field(min_length=1, max_length=settings.max_columns)
    primary_key: str | None = None
    correlation_columns: list[str] = Field(default_factory=list)
    correlation_matrix: list[list[float]] = Field(default_factory=list)

    @model_validator(mode='after')
    def consistent(self):
        names = [column.name for column in self.columns]
        if len(names) != len(set(names)):
            raise ValueError('duplicate column names')
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
    version: Literal['1.0'] = '1.0'
    locale: str = 'en_US'
    seed: int = Field(default=42, ge=0, le=2**32 - 1)
    tables: list[TableSpec] = Field(min_length=1, max_length=20)

    @model_validator(mode='after')
    def unique_tables(self):
        if len({table.name for table in self.tables}) != len(self.tables):
            raise ValueError('duplicate table names')
        return self
