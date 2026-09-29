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
    assert set(response.json()) >= {'overall_score','components','columns','correlation','score_definition'}
