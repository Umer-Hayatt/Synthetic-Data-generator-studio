"""Deterministic heuristics; semantic confidence describes evidence, not certainty."""
import re
import numpy as np
import pandas as pd


def infer_schema(frame: pd.DataFrame) -> list[dict]:
    return [infer_column(str(name), frame[name]) for name in frame.columns]


def infer_column(name: str, series: pd.Series) -> dict:
    values = series.dropna()
    text = values.astype(str).str.strip()
    lower = name.lower()
    dtype = 'string'
    parsed = values
    if len(values):
        numeric = pd.to_numeric(values, errors='coerce')
        if pd.api.types.is_bool_dtype(values) or text.str.lower().isin(['true', 'false']).all():
            dtype = 'boolean'
        elif numeric.notna().all() and np.isfinite(numeric.astype(float)).all():
            dtype = 'integer' if (numeric % 1 == 0).all() else 'float'
            parsed = numeric
        elif pd.api.types.is_datetime64_any_dtype(values) or text.str.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}').all():
            dates = pd.to_datetime(values, errors='coerce', utc=True, format='mixed')
            if dates.notna().all():
                dtype, parsed = 'datetime', dates
    unique = int(values.nunique())
    semantic, confidence = 'generic_text', 0.3
    if dtype in ('integer', 'float'):
        semantic, confidence = 'numeric', 0.95
    if dtype == 'datetime':
        semantic, confidence = 'datetime', 0.95
    elif dtype == 'boolean':
        semantic, confidence = 'categorical', 0.95
    elif dtype in ('integer', 'string') and len(values) and (lower == 'id' or lower.endswith('_id')) and unique == len(values):
        semantic, confidence = 'id', 0.9
    elif len(values) and text.str.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').mean() >= 0.9:
        semantic, confidence = 'email', 0.95
    elif len(values) and ('phone' in lower or 'mobile' in lower) and text.str.match(r'^\+?[\d ().-]{7,20}$').mean() >= 0.9:
        semantic, confidence = 'phone', 0.85
        dtype = 'string'
    elif dtype == 'string' and lower in ('name', 'full_name', 'first_name', 'last_name', 'person_name'):
        semantic, confidence = 'person_name', 0.65
    elif dtype in ('integer', 'float') and re.search(r'price|amount|salary|income|cost|balance', lower):
        semantic, confidence = 'money', 0.75
    elif dtype == 'string' and len(values) and unique <= min(50, max(2, len(values) * 0.2)):
        semantic, confidence = 'categorical', 0.8
    result = {'name': name, 'dtype': dtype, 'semantic_type': semantic,
              'semantic_confidence': confidence, 'nullable': bool(series.isna().any()),
              'null_rate': float(series.isna().mean()), 'unique_count': unique}
    if len(values) and dtype in ('integer', 'float'):
        result.update(min=float(parsed.min()), max=float(parsed.max()),
                      mean=float(parsed.mean()), std=float(parsed.std(ddof=0)))
    elif len(values) and dtype == 'datetime':
        result.update(min=parsed.min().isoformat(), max=parsed.max().isoformat())
    if semantic == 'categorical':
        counts = text.value_counts(normalize=True)
        result['category_frequencies'] = [{'value': value, 'frequency': float(freq)} for value, freq in counts.items()]
    return result
