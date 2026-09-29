from app.eval.comparison import compare
from test_engines import xor_data


def test_comparison_uses_evidence_and_reports_unavailable_deep(monkeypatch):
    monkeypatch.setenv('ENABLE_DEEP_SYNTHESIS','false')
    result = compare(xor_data(),'target')
    assert result['recommendation'] == 'statistical_conditional'
    good = [r for r in result['results'] if r['status']=='ok']
    assert len(good) == 2
    assert all(r['runtime_seconds'] > 0 and r['memory_estimate_bytes'] > 0 for r in good)
    assert all(r['status']=='unavailable' for r in result['results'] if r['engine'].startswith('deep'))
