import numpy as np
import pandas as pd
from app.core.profiling import fit_spec
from app.engines.registry import StatisticalSynthesizer
from app.eval.diagnostics import memorization


def xor_data():
    rng = np.random.default_rng(18)
    a, b = rng.integers(0, 2, (2, 1000))
    return pd.DataFrame({'a':a, 'b':b, 'target':a ^ b, 'noise':rng.normal(size=1000)})


def test_measured_target_improvement_and_seed():
    frame = xor_data()
    engine = StatisticalSynthesizer().fit(frame, target='target')
    result = engine.generate()
    pd.testing.assert_frame_equal(result, engine.generate())
    assert list(result.columns) == list(frame.columns)
    assert memorization(frame, result)['exact_reference_match_rate'] < .02



def test_batched_id_uniqueness_and_bounds():
    frame = pd.DataFrame({'id':range(1, 101), 'value':np.arange(100.)})
    spec = fit_spec(frame)
    engine = StatisticalSynthesizer().fit(spec)
    batches = list(engine.generate_batches(13))
    assert len(batches) == 8
    combined = pd.concat(batches)
    assert len(combined) == 100 and combined.id.nunique() == 100
