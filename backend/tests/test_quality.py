import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.eval.quality import quality
from app.core.store import store
from app.main import app


def test_identical_and_shifted_distributions():
    frame = pd.DataFrame({'x': np.arange(100), 'y':np.arange(100)*2, 'group':['a','b']*50})
    identical = quality(frame, frame)
    assert identical['overall_score'] == pytest.approx(100)
    assert identical['columns'][0]['wasserstein_distance'] == 0
    shifted = frame.copy()
    shifted.x += 1000
    shifted.group = 'c'
    degraded = quality(frame, shifted)
    assert degraded['overall_score'] < identical['overall_score']
    assert degraded['columns'][2]['total_variation_distance'] == 1
    assert degraded['columns'][2]['jensen_shannon_divergence'] == pytest.approx(1)


def test_null_constant_and_masked_columns():
    a = pd.DataFrame({'x':[1.,1.,None], 'empty':[None]*3})
    b = pd.DataFrame({'x':['***']*3, 'empty':[None]*3})
    result = quality(a,b)
    assert result['columns'][0]['distribution_similarity'] is None
    assert result['correlation']['similarity'] is None
    assert result['overall_score'] is None
    assert result['score_status'] == 'unavailable'


def test_quality_api_payload():
    frame = pd.DataFrame({'x':[1,2,3]})
    response = TestClient(app).post('/api/v1/evaluate/quality', json={
        'reference_id':store.put(frame,'reference'), 'generated_id':store.put(frame,'generated')})
    assert response.status_code == 200
    assert set(response.json()) >= {'overall_score','components','columns','correlation','score_definition','privacy','integrity'}


def test_privacy_and_integrity_checks():
    ref = pd.DataFrame({'id': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'val': np.arange(10, dtype=float)})
    synth_good = pd.DataFrame({'id': [101, 102, 103, 104, 105, 106, 107, 108, 109, 110], 'val': np.arange(10, dtype=float) + 0.1})
    res_good = quality(ref, synth_good)
    assert res_good['privacy']['status'] == 'Protected'
    assert res_good['integrity']['status'] == 'Passed'

    # An identical large copy has 100% exact match rate -> At Risk
    large_ref = pd.DataFrame({'id': list(range(50)), 'val': list(range(50))})
    res_leaked = quality(large_ref, large_ref)
    assert res_leaked['privacy']['status'] == 'At Risk'
    assert res_leaked['privacy']['exact_match_rate'] == 1.0

    # Synthetic with unexpected nulls on previously complete column -> integrity Warning
    synth_nulls = pd.DataFrame({'id': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 'val': [1.0, None, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0]})
    res_nulls = quality(ref, synth_nulls)
    assert res_nulls['integrity']['status'] == 'Warning'

