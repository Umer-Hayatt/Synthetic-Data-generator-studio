"""Provider-neutral validated AI calls. No credentials or raw exceptions in errors."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import os
import random
from threading import BoundedSemaphore, RLock
import time
from typing import Protocol
import httpx
from pydantic import BaseModel, ValidationError
from app.core import config  # root .env loading precedes environment reads


class AIError(Exception):
    def __init__(self, kind, retry_after=0):
        self.kind, self.retry_after = kind, max(0, retry_after)
        super().__init__(kind)


def retry_after_seconds(value):
    if not value:
        return 0
    try:
        return max(0, float(value))
    except (ValueError, TypeError):
        try:
            return max(0, (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds())
        except (ValueError, TypeError):
            return 0


class AIProvider(Protocol):
    name: str
    quota_pool: str
    def generate_structured(self, prompt: str, schema: type[BaseModel], timeout: float): ...
    def health(self) -> dict: ...
    def capabilities(self) -> dict: ...


class GeminiProvider:
    name = 'gemini'

    def __init__(self, key, model, quota_pool='gemini-shared'):
        self._key, self.model, self.quota_pool = key, model, quota_pool

    def health(self):
        return {'configured': bool(self._key and self.model), 'live_verified': False}

    def capabilities(self):
        return {'structured_output': True}

    def generate_structured(self, prompt, schema, timeout):
        from google import genai
        from google.genai import types, errors
        try:
            with genai.Client(api_key=self._key, vertexai=False, http_options=types.HttpOptions(
                timeout=int(timeout * 1000), retry_options=types.HttpRetryOptions(attempts=1))) as client:
                response = client.models.generate_content(model=self.model, contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type='application/json',
                                                       response_json_schema=schema.model_json_schema()))
            return schema.model_validate_json(response.text or '')
        except errors.APIError as exc:
            code = exc.code
            headers = getattr(getattr(exc, 'response', None), 'headers', {}) or {}
            delay = retry_after_seconds(headers.get('Retry-After'))
            kind = ('invalid_credential' if code in (401, 403) else 'rate_limit' if code == 429
                    else 'provider_error' if code and code >= 500 else 'malformed_request')
            raise AIError(kind, delay) from None
        except httpx.TimeoutException:
            raise AIError('timeout') from None
        except httpx.TransportError:
            raise AIError('network') from None
        except (ValidationError, ValueError):
            raise AIError('malformed_output') from None
        except Exception:
            raise AIError('provider_error') from None


@dataclass
class ProviderState:
    provider: AIProvider = field(repr=False)
    disabled: bool = False
    cooldown_until: float = 0
    failures: int = 0


class AIRouter:
    def __init__(self, providers, timeout=30, retries=2, cooldown=60, concurrency=2,
                 clock=time.monotonic, sleep=time.sleep, jitter=random.random):
        if timeout <= 0 or retries < 0 or cooldown < 0 or concurrency < 1:
            raise ValueError('Invalid AI configuration.')
        self.states = [ProviderState(provider) for provider in providers]
        self.timeout, self.retries, self.cooldown = timeout, retries, cooldown
        self.clock, self.sleep, self.jitter = clock, sleep, jitter
        self.semaphore, self.lock, self.pools = BoundedSemaphore(concurrency), RLock(), {}

    def health(self):
        with self.lock:
            return [{'provider': state.provider.name, 'credential_slot': i,
                     'disabled': state.disabled, 'failures': state.failures,
                     'cooling_down': max(state.cooldown_until, self.pools.get(state.provider.quota_pool, 0)) > self.clock()}
                    for i, state in enumerate(self.states)]

    def generate_structured(self, prompt, schema):
        if not self.states:
            raise AIError('missing_credential')
        if not self.semaphore.acquire(timeout=self.timeout):
            raise AIError('concurrency_limit')
        try:
            last = 'unavailable'
            for state in self.states:
                for attempt in range(self.retries+1):
                    with self.lock:
                        if state.disabled or max(state.cooldown_until, self.pools.get(state.provider.quota_pool, 0)) > self.clock():
                            break
                    try:
                        value = state.provider.generate_structured(prompt, schema, self.timeout)
                        result = schema.model_validate(value.model_dump() if isinstance(value, BaseModel) else value)
                        with self.lock:
                            state.failures = 0
                        return result
                    except ValidationError:
                        error = AIError('malformed_output')
                    except AIError as exc:
                        error = exc
                    except Exception:
                        error = AIError('provider_error')
                    last = error.kind
                    with self.lock:
                        state.failures += 1
                        if last == 'invalid_credential':
                            state.disabled = True
                            break
                        if last == 'rate_limit':
                            # All configured Gemini keys share a pool unless a future adapter proves otherwise.
                            self.pools[state.provider.quota_pool] = self.clock() + max(self.cooldown, error.retry_after)
                            break
                        if last == 'malformed_request':
                            raise error
                        if last == 'malformed_output' or attempt == self.retries:
                            state.cooldown_until = self.clock() + max(self.cooldown, error.retry_after)
                            break
                    delay = max(error.retry_after, min(2**attempt + self.jitter(), self.timeout))
                    if delay > self.timeout:
                        with self.lock:
                            state.cooldown_until = self.clock() + delay
                        break
                    self.sleep(delay)
            raise AIError(last)
        finally:
            self.semaphore.release()


def configured_router():
    raw = os.getenv('GEMINI_API_KEYS', '').strip()
    try:
        keys = json.loads(raw) if raw.startswith('[') else raw.split(',')
        if not isinstance(keys, list) or not all(isinstance(key, str) for key in keys):
            raise ValueError()
        keys = list(dict.fromkeys(key.strip() for key in keys if key.strip()))
    except ValueError:
        raise AIError('invalid_configuration') from None
    priority = [name.strip() for name in os.getenv('AI_PROVIDER_PRIORITY', 'gemini').split(',')]
    model = os.getenv('GEMINI_MODEL', '').strip()
    providers = [GeminiProvider(key, model) for key in keys] if 'gemini' in priority and model else []
    return AIRouter(providers, timeout=float(os.getenv('AI_REQUEST_TIMEOUT_SECONDS', '30')),
                    retries=int(os.getenv('AI_MAX_RETRIES', '2')),
                    cooldown=float(os.getenv('AI_PROVIDER_COOLDOWN_SECONDS', '60')),
                    concurrency=int(os.getenv('AI_MAX_CONCURRENCY', '2')))
