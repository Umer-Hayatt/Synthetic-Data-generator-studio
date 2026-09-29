import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.store import store
from app.eval.tstr import evaluate_tstr


def dataset(regression=False, multiclass=False):
    rng = np.random.default_rng(4)
    x = rng.normal(size=250)
    target = 20*x+rng.normal(size=250) if regression else np.where(x>0,'yes','no')
    if multiclass:
        target = np.where(x>.5,'high',np.where(x<-.5,'low','middle'))
    return pd.DataFrame({'x':x,'region':rng.choice(['a','b','c'],250),'target':target})


@pytest.mark.parametrize('multiclass', [False,True])
def test_classification(multiclass):
    result = evaluate_tstr(dataset(multiclass=multiclass), 'target')
    assert result['status'] == 'ok', result
    assert result['rows'] == {'real_train':200,'real_test':50,'synthetic_train':200,'dropped_missing_target':0}
    assert 0 <= result['tstr']['accuracy'] <= 1
    assert result['trtr']['roc_auc'] is not None
    assert result['comparison']['accuracy']['delta'] == result['tstr']['accuracy']-result['trtr']['accuracy']


def test_regression():
    result = evaluate_tstr(dataset(regression=True), 'target', 'regression')
    assert result['status'] == 'ok', result
    assert set(result['trtr']) == {'mae','rmse','r2'}
    for metric in result['comparison'].values():
        assert 'retention_ratio' not in metric
        assert metric['delta'] == metric['tstr']-metric['trtr']


def test_synthesizer_never_receives_real_test(monkeypatch):
    import app.eval.tstr as module
    frame = dataset(regression=True)
    train, test = frame.iloc[:200].copy(), frame.iloc[200:].copy()
    test['x'] = 99999999  # sentinel must never enter synthesis metadata
    seen = []
    original = module.fit_spec
    def spy(data, **kwargs):
        seen.append(data.copy())
        return original(data, **kwargs)
    monkeypatch.setattr(module, 'fit_spec', spy)
    monkeypatch.setattr(module, 'train_test_split', lambda *args, **kwargs: (train,test))
    result = module.evaluate_tstr(frame,'target','regression')
    assert result['status'] == 'ok', result
    assert len(seen) == 1
    assert set(seen[0].index).isdisjoint(test.index)
    pd.testing.assert_frame_equal(seen[0], train)


def test_graceful_targets_and_missing_values():
    frame = dataset()
    assert evaluate_tstr(frame)['status'] == 'unavailable'
    assert evaluate_tstr(frame, 'absent')['status'] == 'unavailable'
    assert evaluate_tstr(frame.head(5), 'target')['status'] == 'unavailable'
    frame.loc[:9,'target'] = None
    result = evaluate_tstr(frame,'target')
    assert result['status'] == 'ok'
    assert result['rows']['dropped_missing_target'] == 10
    frame['target'] = 'same'
    assert evaluate_tstr(frame,'target')['status'] == 'unavailable'
    frame.loc[0,'target'] = 'rare'
    assert evaluate_tstr(frame,'target')['status'] == 'unavailable'


def test_api_no_target_and_determinism():
    frame = dataset()
    token = store.put(frame,'reference')
    response = TestClient(app).post('/api/v1/evaluate/tstr',json={'reference_id':token})
    assert response.status_code == 200
    assert response.json()['target_candidates']
    response = TestClient(app).post('/api/v1/evaluate/tstr',json={'reference_id':token,'target':'target'})
    assert response.status_code == 200
    assert response.json()['status'] == 'ok'
    assert evaluate_tstr(frame,'target') == evaluate_tstr(frame,'target')


def test_auc_unavailable_and_negative_r2(monkeypatch):
    import app.eval.tstr as module
    frame = dataset()
    train = frame.iloc[:200].copy()
    test = frame.iloc[200:].copy()
    test['target'] = 'yes'
    monkeypatch.setattr(module,'train_test_split',lambda *args,**kwargs:(train,test))
    result = module.evaluate_tstr(frame,'target','classification')
    assert result['status'] == 'ok', result
    assert result['trtr']['roc_auc'] is None
    assert result['roc_auc_unavailable_reasons']
    numeric = dataset(regression=True)
    train, test = numeric.iloc[:200].copy(), numeric.iloc[200:].copy()
    test['target'] += 10000
    monkeypatch.setattr(module,'train_test_split',lambda *args,**kwargs:(train,test))
    result = module.evaluate_tstr(numeric,'target','regression')
    assert result['status'] == 'ok', result
    assert result['trtr']['r2'] < 0
    assert 'retention_ratio' not in result['comparison']['r2']


def test_imbalanced_classes_and_missing_features():
    frame = dataset()
    frame['target'] = ['rare']*10 + ['common']*240
    frame.loc[:30,'x'] = np.nan
    frame.loc[:20,'region'] = None
    frame['all_missing'] = np.nan
    result = evaluate_tstr(frame,'target')
    assert result['status'] == 'ok', result
