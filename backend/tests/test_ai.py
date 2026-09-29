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
