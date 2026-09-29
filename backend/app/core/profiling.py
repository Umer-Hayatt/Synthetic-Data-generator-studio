"""Fit bounded statistical metadata into the canonical spec, never raw records."""
import numpy as np
import pandas as pd
from scipy.stats import norm
from app.core.inference import infer_schema
from app.models.spec import DatasetSpec


def fit_spec(frame: pd.DataFrame, name: str = 'dataset', seed: int = 42, categorical_columns: tuple[str, ...] = ()) -> DatasetSpec:
    columns, latent = [], {}
    for info in infer_schema(frame):
        if info['name'] in categorical_columns:
            info['semantic_type'] = 'categorical'
            info['dtype'] = 'string'
        column = {key: info[key] for key in ('name', 'dtype', 'semantic_type', 'nullable', 'null_rate')}
        values = frame[info['name']].dropna()
        if info['semantic_type'] in ('email', 'phone', 'person_name'):
            # Never place identity examples into distribution metadata.
            pass
        elif info['semantic_type'] == 'id':
            column['constraints'] = {'unique': True, 'auto_increment': info['dtype'] == 'integer'}
            column['null_rate'] = 0
        elif info['dtype'] in ('integer', 'float', 'datetime') and len(values):
            numeric = (pd.to_datetime(frame[info['name']], utc=True, format='mixed').astype('int64') / 1e9
                       if info['dtype'] == 'datetime' else pd.to_numeric(frame[info['name']]))
            numeric = numeric.where(frame[info['name']].notna())
            clean = numeric.dropna().astype(float)
            column['distribution'] = {'type': 'empirical', 'quantiles': np.quantile(clean, np.linspace(0, 1, 101)).tolist(),
                                      'mean': float(clean.mean()), 'std': float(clean.std(ddof=0))}
            column['constraints'] = {'min': float(clean.min()), 'max': float(clean.max())}
            latent[info['name']] = numeric
        elif info['semantic_type'] == 'categorical' and len(values):
            if info['dtype'] == 'boolean':
                normalized = frame[info['name']].map(lambda v: str(v).lower() == 'true' if pd.notna(v) else np.nan)
            else:
                normalized = frame[info['name']].astype('string')
            counts = normalized.dropna().value_counts(normalize=True).sort_index()
            column['distribution'] = {'type': 'categorical', 'values': counts.index.tolist(), 'probabilities': counts.tolist()}
            latent[info['name']] = normalized.map({value: i for i, value in enumerate(counts.index)})
        columns.append(column)
    # Pairwise rank correlations projected onto the PSD cone, avoiding invalid covariance.
    names = [name for name, series in latent.items() if series.nunique() > 1]
    matrix = []
    if names:
        transformed = pd.DataFrame({name: norm.ppf((latent[name].rank(method='average') - .5) / latent[name].count()) for name in names})
        corr = transformed.corr().fillna(0).to_numpy()
        np.fill_diagonal(corr, 1)
        eigenvalues, eigenvectors = np.linalg.eigh(corr)
        corr = (eigenvectors * np.maximum(eigenvalues, 1e-8)) @ eigenvectors.T
        scale = np.sqrt(np.diag(corr))
        corr = corr / np.outer(scale, scale)
        matrix = corr.tolist()
    return DatasetSpec.model_validate({'name': name, 'seed': seed, 'tables': [{
        'name': 'table', 'row_count': len(frame), 'columns': columns,
        'correlation_columns': names, 'correlation_matrix': matrix,
    }]})
