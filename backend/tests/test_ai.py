import pytest
from pydantic import BaseModel
from app.core.ai import AIRouter, AIError


class Result(BaseModel):
    status: str


class Fake:
    name = 'fake'
    def __init__(self, values, pool='shared'):
        self.values, self.quota_pool, self.calls = iter(values), pool, 0
    def generate_structured(self, *args):
        self.calls += 1
        value = next(self.values)
        if isinstance(value, Exception): raise value
        return value


def test_invalid_key_fails_over_and_is_disabled():
    bad, good = Fake([AIError('invalid_credential')]), Fake([{'status':'ok'}]*2)
    router = AIRouter([bad, good])
    assert router.generate_structured('x', Result).status == 'ok'
    router.generate_structured('x', Result)
    assert bad.calls == 1 and router.health()[0]['disabled']


def test_rate_limit_cools_entire_pool_and_respects_retry_after():
    now = [0]
    a, b, c = Fake([AIError('rate_limit', 120)]), Fake([]), Fake([{'status':'ok'}], 'independent')
    router = AIRouter([a,b,c], clock=lambda: now[0])
    assert router.generate_structured('x', Result).status == 'ok'
    assert b.calls == 0 and router.pools['shared'] == 120


@pytest.mark.parametrize('kind', ['timeout','network','provider_error'])
def test_transient_retry(kind):
    sleeps = []
    provider = Fake([AIError(kind), {'status':'ok'}])
    router = AIRouter([provider], sleep=sleeps.append, jitter=lambda: .1)
    assert router.generate_structured('x', Result).status == 'ok'
    assert sleeps == [1.1]


def test_malformed_and_outage():
    with pytest.raises(AIError, match='missing_credential'):
        AIRouter([]).generate_structured('x', Result)
    provider = Fake([{}])
    with pytest.raises(AIError, match='malformed_output'):
        AIRouter([provider]).generate_structured('x', Result)
    provider = Fake([AIError('malformed_request')])
    with pytest.raises(AIError, match='malformed_request'):
        AIRouter([provider]).generate_structured('x', Result)
    provider = Fake([AIError('timeout')]*3)
    router = AIRouter([provider], sleep=lambda _:None)
    with pytest.raises(AIError, match='timeout'): router.generate_structured('x', Result)
    assert router.health()[0]['cooling_down']


def test_request_budget_bounds_retry_time_and_attempt_deadlines():
    now, timeouts = [0], []
    class Slow:
        name, quota_pool = 'slow', 'shared'
        def generate_structured(self, prompt, schema, timeout):
            timeouts.append(timeout)
            now[0] += min(4, timeout)
            raise AIError('timeout')
    def sleep(seconds): now[0] += seconds
    router = AIRouter([Slow()], timeout=120, request_timeout=7, retries=10,
                      clock=lambda: now[0], sleep=sleep, jitter=lambda: 0)
    with pytest.raises(AIError, match='timeout'):
        router.generate_structured('test', Result)
    assert timeouts == [7, 2] and now[0] == 7


@pytest.mark.parametrize('kind', ['timeout', 'provider_error', 'model_unavailable'])
def test_transient_model_failure_uses_alternate_before_retrying_same_model(kind):
    primary, alternate = Fake([AIError(kind)]), Fake([{'status': 'ok'}])
    primary.model, alternate.model = 'primary-model', 'alternate-model'
    router = AIRouter([primary, alternate], sleep=lambda _: None)
    assert router.generate_structured('test', Result).status == 'ok'
    assert primary.calls == 1 and alternate.calls == 1
    assert router.health()[0]['cooling_down']


def test_configured_models_are_bounded_and_explicit(monkeypatch):
    from app.core.ai import configured_router
    monkeypatch.setenv('GEMINI_API_KEYS', 'test-only')
    monkeypatch.setenv('GEMINI_MODEL', 'gemini-3.8-flash')
    monkeypatch.setenv('GEMINI_FALLBACK_MODELS', 'gemini-3.5-flash,gemini-3.5-flash')
    assert [s.provider.model for s in configured_router().states] == ['gemini-3.8-flash', 'gemini-3.5-flash']
