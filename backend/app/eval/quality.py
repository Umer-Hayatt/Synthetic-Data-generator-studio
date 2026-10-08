"""Inspectable fidelity metrics. The composite is descriptive, not a privacy score."""
import numpy as np
import pandas as pd
from scipy.stats import ks_2samp, wasserstein_distance
from scipy.spatial.distance import jensenshannon


def quality(reference: pd.DataFrame, synthetic: pd.DataFrame) -> dict:
    if reference.empty or synthetic.empty or set(reference.columns) != set(synthetic.columns):
        raise ValueError('Quality requires nonempty datasets with matching columns.')
    columns, numeric_names, distribution_scores, missing_scores = [], [], [], []
    for name in reference.columns:
        real, synth = reference[name], synthetic[name]
        missing = 1 - abs(float(real.isna().mean()) - float(synth.isna().mean()))
        item = {'name': name, 'real_null_rate': float(real.isna().mean()),
                'synthetic_null_rate': float(synth.isna().mean()), 'missing_similarity': missing}
        missing_scores.append(missing)
        a, b = real.dropna(), synth.dropna()
        if not len(a) or not len(b):
            item.update(kind='unavailable', distribution_similarity=None,
                        reason='At least one column has no observed values.')
        elif pd.api.types.is_numeric_dtype(real) and not pd.api.types.is_bool_dtype(real):
            a = pd.to_numeric(a, errors='coerce').to_numpy(dtype=float)
            converted = pd.to_numeric(b, errors='coerce')
            b = converted.to_numpy(dtype=float)
            if not np.isfinite(a).all() or not np.isfinite(b).all():
                item.update(kind='unavailable', distribution_similarity=None,
                            reason='Numeric comparison requires finite numeric values (mask/hash may change type).')
            else:
                ks = float(ks_2samp(a, b).statistic)
                wasserstein = float(wasserstein_distance(a, b))
                # A defined scale even for constant columns; KS is the bounded score input.
                scale = max(float(np.std(a)), float(np.ptp(a)), 1e-12)
                edges = np.histogram_bin_edges(np.concatenate([a, b]), bins=12)
                item.update(kind='numeric', ks_statistic=ks, wasserstein_distance=wasserstein,
                            wasserstein_normalized=wasserstein / scale, normalization_scale=scale,
                            distribution_similarity=1-ks,
                            histogram={'edges':edges.tolist(), 'real':(np.histogram(a, edges)[0]/len(a)).tolist(),
                                       'synthetic':(np.histogram(b, edges)[0]/len(b)).tolist()})
                distribution_scores.append(1-ks)
                numeric_names.append(name)
        else:
            a, b = a.astype(str), b.astype(str)
            pa, pb = a.value_counts(normalize=True), b.value_counts(normalize=True)
            labels = sorted(set(pa.index) | set(pb.index))
            p, q = pa.reindex(labels, fill_value=0).to_numpy(), pb.reindex(labels, fill_value=0).to_numpy()
            tvd = float(np.abs(p-q).sum()/2)
            top = np.argsort(-(p+q), kind='stable')[:50]
            item.update(kind='categorical', total_variation_distance=tvd,
                        jensen_shannon_divergence=float(jensenshannon(p,q,base=2)**2), distribution_similarity=1-tvd,
                        categories=[{'value':labels[i], 'real':float(p[i]), 'synthetic':float(q[i])} for i in top],
                        categories_truncated=len(labels)>50)
            distribution_scores.append(1-tvd)
        columns.append(item)
    correlation = {'columns':numeric_names, 'similarity':None, 'frobenius_distance':None, 'pair_count':0}
    if len(numeric_names) >= 2:
        a = reference[numeric_names].apply(pd.to_numeric).corr().to_numpy(dtype=float)
        b = synthetic[numeric_names].apply(pd.to_numeric).corr().to_numpy(dtype=float)
        valid = np.isfinite(a) & np.isfinite(b) & np.triu(np.ones(a.shape, dtype=bool), 1)
        differences = np.abs(a[valid] - b[valid])
        correlation.update(real_matrix=[[float(x) if np.isfinite(x) else None for x in row] for row in a],
                           synthetic_matrix=[[float(x) if np.isfinite(x) else None for x in row] for row in b])
        if differences.size:
            correlation.update(similarity=float(1-differences.mean()/2), pair_count=int(differences.size),
                               frobenius_distance=float(np.sqrt(2*np.square(differences).sum())))
    components = {'distribution':float(np.mean(distribution_scores)) if distribution_scores else None,
                  'missingness':float(np.mean(missing_scores)), 'correlation':correlation['similarity']}
    available = [value for value in components.values() if value is not None]

    # Real privacy check: reference memorization / exact row matching rate
    if len(reference) and len(synthetic):
        ref_hashes = set(pd.util.hash_pandas_object(reference, index=False))
        synth_hashes = pd.util.hash_pandas_object(synthetic, index=False)
        exact_matches = int(synth_hashes.isin(ref_hashes).sum())
        exact_match_rate = float(exact_matches / len(synthetic))
    else:
        exact_matches = 0
        exact_match_rate = 0.0

    privacy_protected = exact_match_rate <= 0.20 or len(synthetic) <= 5
    privacy = {
        'status': 'Protected' if privacy_protected else 'At Risk',
        'exact_match_rate': exact_match_rate,
        'exact_matches': exact_matches,
    }

    # Real integrity check: column preservation, null violations, and non-empty output
    null_issues = 0
    for col in reference.columns:
        if reference[col].isna().sum() == 0 and synthetic[col].isna().sum() > 0:
            null_issues += 1
    integrity_passed = set(reference.columns) == set(synthetic.columns) and null_issues == 0 and len(synthetic) > 0
    integrity = {
        'status': 'Passed' if integrity_passed else 'Warning',
        'columns_preserved': set(reference.columns) == set(synthetic.columns),
        'null_integrity': null_issues == 0,
        'valid_row_count': len(synthetic) > 0,
    }

    return {'overall_score':100*float(np.mean(available)) if distribution_scores else None,
            'score_status':'available' if distribution_scores else 'unavailable',
            'distribution_columns_evaluated':len(distribution_scores),
            'distribution_columns_total':len(columns), 'components':components, 'columns':columns,
            'correlation':correlation,
            'privacy': privacy,
            'integrity': integrity,
            'score_definition':'100 * mean(available components). Distribution = mean(1-KS numeric, 1-TVD categorical); missingness = mean(1-absolute null-rate difference); correlation = 1-mean absolute Pearson pair difference/2. Unavailable components are omitted; no overall score without an evaluable distribution column.',
            'reference_rows':len(reference), 'synthetic_rows':len(synthetic)}

