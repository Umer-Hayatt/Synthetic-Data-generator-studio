import os
import pandas as pd
import pytest
from app.engines.deep import DeepSynthesizer


def test_deep_optional_and_disabled(monkeypatch):
    monkeypatch.setenv('ENABLE_DEEP_SYNTHESIS','false')
    engine = DeepSynthesizer()
    assert not engine.capabilities()['available']
    with pytest.raises(ValueError): engine.fit(pd.DataFrame({'x':range(30)}))


@pytest.mark.skipif(os.getenv('RUN_DEEP_TESTS') != 'true', reason='Opt-in serial deep test; heavy stack not installed by default.')
def test_installed_deep_adapter():
    engine = DeepSynthesizer('tvae', epochs=1, timeout=120)
    if not engine.capabilities()['available']: pytest.skip('Deep capability unavailable')
    frame = pd.DataFrame({'x':range(100),'category':['a','b']*50})
    result = engine.fit(frame).generate(20)
    assert result.shape == (20,2) and list(result.columns) == list(frame.columns)
