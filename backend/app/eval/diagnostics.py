"""Practical diagnostics, not a membership-inference or privacy guarantee."""
import pandas as pd


def memorization(reference, synthetic):
    columns = [name for name in reference.columns if name.lower() != 'id' and not name.lower().endswith('_id')]
    if not columns:
        return {'status':'unavailable', 'reason':'No non-identifier columns.'}
    def fingerprints(frame):
        return pd.util.hash_pandas_object(frame[columns].astype('string').fillna('<NULL>'), index=False)
    a, b = fingerprints(reference), fingerprints(synthetic)
    return {'status':'ok', 'synthetic_duplicate_rate':float(b.duplicated().mean()),
            'exact_reference_match_rate':float(b.isin(set(a)).mean()),
            'note':'Exact matches can occur naturally in small discrete domains; this is not a privacy guarantee.'}
