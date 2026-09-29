"""Seeded Gaussian copula with empirical marginals and semantic Faker fields.

Privacy transformations are pragmatic controls, not differential privacy.
"""
import hashlib
import numpy as np
import pandas as pd
from faker import Faker
from scipy.stats import norm
from app.models.spec import DatasetSpec, PrivacyRule
from app.core.config import settings


def generate(spec: DatasetSpec) -> pd.DataFrame:
    if len(spec.tables) != 1:
        raise ValueError('P0 generation supports exactly one table.')
    table = spec.tables[0]
    if table.row_count * len(table.columns) > settings.max_cells:
        raise ValueError('Generation cell limit exceeded.')
    n = table.row_count
    rng = np.random.default_rng(spec.seed)
    try:
        fake = Faker(spec.locale)
    except (AttributeError, KeyError) as exc:
        raise ValueError('Unsupported Faker locale.') from exc
    fake.seed_instance(spec.seed)
    uniforms = {}
    if table.correlation_columns:
        z = rng.multivariate_normal(np.zeros(len(table.correlation_columns)), table.correlation_matrix, size=n)
        uniforms = dict(zip(table.correlation_columns, norm.cdf(z).T))
    result = {}
    for col in table.columns:
        constraints, distribution = col.constraints, col.distribution
        u = uniforms.get(col.name)
        if u is None:
            u = rng.uniform(size=n)
        if constraints.auto_increment or (col.semantic_type == 'id' and col.dtype == 'integer'):
            start = int(np.ceil(constraints.min)) if constraints.min is not None else 1
            values = np.arange(start, start + n).astype(float)
        elif col.semantic_type == 'id':
            values = np.array([f'{col.name}_{spec.seed}_{i+1}' for i in range(n)], dtype=object)
        elif col.semantic_type in ('email', 'phone', 'person_name'):
            provider = {'email': fake.email, 'phone': fake.phone_number, 'person_name': fake.name}[col.semantic_type]
            values = np.array([provider() for _ in range(n)], dtype=object)
        elif constraints.categories or (distribution and distribution.values):
            categories = constraints.categories or distribution.values
            probabilities = distribution.probabilities if distribution and distribution.values == categories and distribution.probabilities else [1 / len(categories)] * len(categories)
            indices = np.minimum(np.searchsorted(np.cumsum(probabilities), u), len(categories)-1)
            values = np.array(categories, dtype=object)[indices]
        elif col.dtype in ('integer', 'float', 'datetime'):
            if distribution and distribution.quantiles:
                values = np.interp(u, np.linspace(0, 1, len(distribution.quantiles)), distribution.quantiles)
            elif distribution and distribution.type == 'gaussian':
                values = distribution.mean + distribution.std * norm.ppf(np.clip(u, 1e-10, 1-1e-10))
            else:
                lo = constraints.min if constraints.min is not None else 0
                hi = constraints.max if constraints.max is not None else 1
                values = lo + (hi - lo) * u
        elif col.dtype == 'boolean':
            values = u >= .5
        else:
            values = np.array([fake.sentence(nb_words=6) for _ in range(n)], dtype=object)
        numeric = col.dtype in ('integer', 'float')
        if numeric:
            values = np.asarray(values, dtype=float)
            if col.outlier_rate:
                selected = rng.random(n) < col.outlier_rate
                scale = distribution.std if distribution and distribution.std > 0 else 1
                values[selected] += rng.choice([-1, 1], selected.sum()) * scale * col.outlier_scale
        # Bounds are hard constraints and take precedence over outliers/noise.
        privacy = PrivacyRule(method=col.privacy_rule) if isinstance(col.privacy_rule, str) else col.privacy_rule
        if privacy and privacy.method == 'noise':
            values += rng.normal(0, privacy.noise_std, n)
        if numeric or col.dtype == 'datetime':
            values = np.asarray(values, dtype=float)
            if not np.isfinite(values).all():
                raise ValueError(f'Generation produced non-finite values for {col.name}; reduce numeric scale.')
            if constraints.min is not None:
                values = np.maximum(values, constraints.min)
            if constraints.max is not None:
                values = np.minimum(values, constraints.max)
            if col.dtype == 'integer':
                values = np.rint(values)
                if constraints.min is not None:
                    values = np.maximum(values, np.ceil(constraints.min))
                if constraints.max is not None:
                    values = np.minimum(values, np.floor(constraints.max))
                if np.abs(values).max() > 2**53:
                    raise ValueError('Integer generation supports magnitudes up to 2**53 for exact float representation.')
            elif col.dtype == 'datetime':
                values = pd.to_datetime(values, unit='s', utc=True).strftime('%Y-%m-%dT%H:%M:%SZ').to_numpy()
        series = pd.Series(values, dtype=object)
        if privacy and privacy.method == 'mask':
            series[:] = privacy.mask_value
        elif privacy and privacy.method == 'hash':
            series = series.map(lambda value: hashlib.sha256(str(value).encode()).hexdigest())
        if constraints.unique and series.duplicated().any():
            raise ValueError(f'Cannot satisfy uniqueness for {col.name}; use auto_increment or ID semantics.')
        if col.null_rate:
            series[rng.random(n) < col.null_rate] = None
        if numeric and not (privacy and privacy.method in ('mask', 'hash')):
            series = pd.to_numeric(series).astype('Int64' if col.dtype == 'integer' else 'Float64')
        result[col.name] = series
    return pd.DataFrame(result)
