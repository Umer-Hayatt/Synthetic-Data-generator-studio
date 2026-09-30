"""SDK-boundary checks: no network calls or real credentials."""
from types import SimpleNamespace
import httpx
import pytest
from google import genai
from google.genai import errors
from pydantic import BaseModel
from app.core.ai import AIError, GeminiProvider


class StructuredResult(BaseModel):
    count: int


def sdk_result(monkeypatch, result):
    class Client:
        def __init__(self, **kwargs):
            self.models = self
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def generate_content(self, **kwargs):
            if isinstance(result, Exception): raise result
            return SimpleNamespace(text=result)
    monkeypatch.setattr(genai, 'Client', Client)


@pytest.mark.parametrize('text', ['{broken', '{}', '{"count":"not-an-integer"}', None])
def test_malformed_sdk_output_is_actionable(monkeypatch, text):
    sdk_result(monkeypatch, text)
    with pytest.raises(AIError, match='malformed_output'):
        GeminiProvider('test-only', 'test-model').generate_structured('test', StructuredResult, 1)


def test_sdk_json_is_parsed_and_validated(monkeypatch):
    sdk_result(monkeypatch, '{"count":12}')
    result = GeminiProvider('test-only', 'test-model').generate_structured('test', StructuredResult, 1)
    assert result.count == 12


@pytest.mark.parametrize('code,kind', [(400,'malformed_request'),(401,'invalid_credential'),
    (403,'invalid_credential'),(429,'rate_limit'),(500,'provider_error')])
def test_sdk_api_errors_are_sanitized(monkeypatch, code, kind):
    error = errors.APIError(code, {'message':'sensitive upstream detail'},
                            httpx.Response(code, headers={'Retry-After':'120'}))
    sdk_result(monkeypatch, error)
    with pytest.raises(AIError) as caught:
        GeminiProvider('test-only', 'test-model').generate_structured('test', StructuredResult, 1)
    assert caught.value.kind == kind
    assert caught.value.retry_after == 120
    assert 'sensitive' not in str(caught.value)


@pytest.mark.parametrize('error,kind', [(httpx.ReadTimeout('upstream'), 'timeout'),
                                      (httpx.ConnectError('upstream'), 'network')])
def test_sdk_transport_errors(monkeypatch, error, kind):
    sdk_result(monkeypatch, error)
    with pytest.raises(AIError, match=kind):
        GeminiProvider('test-only', 'test-model').generate_structured('test', StructuredResult, 1)
