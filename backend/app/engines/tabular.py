"""Seeded Gaussian copula with empirical marginals and semantic Faker fields.

Privacy transformations are pragmatic controls, not differential privacy.
"""
import hashlib
import re
import numpy as np
import pandas as pd
from faker import Faker
from scipy.stats import norm
from app.models.spec import DatasetSpec, PrivacyRule
from app.core.config import settings

# ---------------------------------------------------------------------------
# Curated locale-aware data for realistic Pakistani/generic content.
# Used when semantic_type='categorical' and column name matches a known pattern.
# ---------------------------------------------------------------------------

_PK_CITIES = [
    'Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad',
    'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Sialkot',
    'Gujranwala', 'Bahawalpur', 'Sargodha', 'Sukkur', 'Larkana',
]

_GENERIC_CITIES = [
    'New York', 'London', 'Tokyo', 'Dubai', 'Singapore',
    'Paris', 'Berlin', 'Toronto', 'Sydney', 'Mumbai',
    'Istanbul', 'Cairo', 'Lagos', 'Nairobi', 'Mexico City',
]

_PK_MERCHANTS = [
    'Daraz', 'Foodpanda', 'Bykea', 'Careem', 'Zameen',
    'Airlift', 'Airsial', 'Bank Alfalah', 'HBL', 'MCB',
    'Jazz Cash', 'EasyPaisa', 'K-Electric', 'PTCL', 'Telenor',
    'Chaudhry Fabrics', 'Al-Karam', 'Gul Ahmed', 'Nishat Linen', 'Khaadi',
]

_GENERIC_MERCHANTS = [
    'Amazon', 'Uber', 'Netflix', 'Spotify', 'Apple Store',
    'Walmart', 'Target', 'Starbucks', 'McDonald\'s', 'Shell',
    'PayPal', 'Google Play', 'Microsoft Store', 'Airbnb', 'Booking.com',
]

_PRODUCT_NAMES_EN = [
    'Wireless Earbuds', 'Phone Case', 'USB-C Cable', 'Laptop Stand', 'Keyboard',
    'Mouse Pad', 'LED Desk Lamp', 'Coffee Mug', 'Water Bottle', 'Backpack',
    'Notebook (A4)', 'Running Shoes', 'Cotton T-Shirt', 'Sunglasses', 'Watch',
    'Bluetooth Speaker', 'Power Bank', 'Face Wash', 'Shampoo', 'Hand Cream',
    'Graphic Novel', 'Puzzle (1000 pc)', 'Yoga Mat', 'Resistance Bands', 'Dumbbells',
    'Olive Oil (1L)', 'Basmati Rice (5kg)', 'Green Tea', 'Protein Bar', 'Vitamin C',
]

_PAYMENT_METHODS = ['card', 'cash', 'wallet', 'bank_transfer', 'cod']
_PAYMENT_METHODS_PK = ['card', 'cash', 'jazz_cash', 'easypaisa', 'cod', 'bank_transfer']

_ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
_GENDERS = ['male', 'female', 'prefer_not_to_say']

# Column name patterns → data source mapping
_CATEGORICAL_PATTERNS = [
    (re.compile(r'\bcit(y|ies)\b', re.I), '_city'),
    (re.compile(r'\bmerchant\b', re.I), '_merchant'),
    (re.compile(r'\bproduct[_\s]?name\b', re.I), '_product'),
    (re.compile(r'\bpayment[_\s]?method\b|method\b', re.I), '_payment_method'),
    (re.compile(r'\bstatus\b', re.I), '_order_status'),
    (re.compile(r'\bgender\b', re.I), '_gender'),
    (re.compile(r'\bcountry\b', re.I), '_country'),
    (re.compile(r'\bcurrenc(y|ies)\b', re.I), '_currency'),
]


def _get_categorical_values(col_name: str, locale: str) -> list | None:
    """Return a curated list for categorical columns whose name matches a known pattern."""
    is_pk = locale.lower().startswith(('ur', 'pk'))
    for pattern, key in _CATEGORICAL_PATTERNS:
        if pattern.search(col_name):
            if key == '_city':
                return _PK_CITIES if is_pk else _GENERIC_CITIES
            if key == '_merchant':
                return _PK_MERCHANTS if is_pk else _GENERIC_MERCHANTS
            if key == '_product':
                return _PRODUCT_NAMES_EN
            if key == '_payment_method':
                return _PAYMENT_METHODS_PK if is_pk else _PAYMENT_METHODS
            if key == '_order_status':
                return _ORDER_STATUSES
            if key == '_gender':
                return _GENDERS
            if key == '_country':
                return ['Pakistan', 'UAE', 'Saudi Arabia', 'UK', 'USA'] if is_pk else \
                       ['USA', 'UK', 'Canada', 'Australia', 'Germany']
            if key == '_currency':
                return ['PKR'] if is_pk else ['USD', 'EUR', 'GBP', 'JPY', 'AUD']
    return None


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
            # Explicit categories from spec
            categories = constraints.categories or distribution.values
            probabilities = distribution.probabilities if distribution and distribution.values == categories and distribution.probabilities else [1 / len(categories)] * len(categories)
            indices = np.minimum(np.searchsorted(np.cumsum(probabilities), u), len(categories)-1)
            values = np.array(categories, dtype=object)[indices]
        elif col.semantic_type == 'categorical' and col.dtype == 'string':
            # Try curated lists based on column name, fall back to Faker word
            curated = _get_categorical_values(col.name, spec.locale)
            if curated:
                indices = (u * len(curated)).astype(int).clip(0, len(curated) - 1)
                values = np.array(curated, dtype=object)[indices]
            else:
                values = np.array([fake.word() for _ in range(n)], dtype=object)
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
