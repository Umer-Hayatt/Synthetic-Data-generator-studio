"""Provider-neutral validated AI calls. No credentials or raw exceptions in errors."""
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import os
import random
import re
from threading import BoundedSemaphore, RLock
import time
from typing import Protocol
import httpx
from pydantic import BaseModel, ValidationError
from app.core import config  # root .env loading precedes environment reads


class AIError(Exception):
    def __init__(self, kind, retry_after=0, quota_scope='pool'):
        self.kind, self.retry_after = kind, max(0, retry_after)
        self.quota_scope = quota_scope
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


def gemini_quota_details(payload, model):
    """Narrow quota scope only when every reported violation proves it."""
    error = payload.get('error', payload) if isinstance(payload, dict) else {}
    details = error.get('details', []) if isinstance(error, dict) else []
    violations, delay = [], 0
    for detail in details if isinstance(details, list) else []:
        if not isinstance(detail, dict):
            continue
        if detail.get('@type') == 'type.googleapis.com/google.rpc.QuotaFailure':
            items = detail.get('violations', [])
            if isinstance(items, list):
                violations.extend(items)
        if detail.get('@type') == 'type.googleapis.com/google.rpc.RetryInfo':
            duration = detail.get('retryDelay', '')
            if isinstance(duration, str) and len(duration) < 32 and re.fullmatch(r'\d+(?:\.\d+)?s', duration):
                delay = max(delay, float(duration[:-1]))
    scoped = bool(violations) and all(
        isinstance(v, dict) and 'PerModel' in str(v.get('quotaId', ''))
        and isinstance(v.get('quotaDimensions'), dict)
        and v['quotaDimensions'].get('model') == model.removeprefix('models/')
        for v in violations)
    return ('model' if scoped else 'pool'), delay


class GeminiProvider:
    name = 'gemini'

    def __init__(self, key, model, quota_pool='gemini-shared', thinking_level='low'):
        if thinking_level not in ('low', 'medium', 'high'):
            raise ValueError('Invalid Gemini thinking level.')
        self._key, self.model, self.quota_pool = key, model, quota_pool
        self.thinking_level = thinking_level

    def health(self):
        return {'configured': bool(self._key and self.model), 'live_verified': False}

    def capabilities(self):
        return {'structured_output': True}

    def generate_structured(self, prompt, schema, timeout):
        from google import genai
        from google.genai import types, errors
        try:
            thinking = (types.ThinkingConfig(thinking_level=self.thinking_level)
                        if self.model.removeprefix('models/').startswith('gemini-3') else None)
            with genai.Client(api_key=self._key, vertexai=False, http_options=types.HttpOptions(
                timeout=int(timeout * 1000), retry_options=types.HttpRetryOptions(attempts=1))) as client:
                response = client.models.generate_content(model=self.model, contents=prompt,
                    config=types.GenerateContentConfig(response_mime_type='application/json',
                        response_json_schema=schema.model_json_schema(), thinking_config=thinking))
            return schema.model_validate_json(response.text or '')
        except errors.APIError as exc:
            code = exc.code
            headers = getattr(getattr(exc, 'response', None), 'headers', {}) or {}
            delay = retry_after_seconds(headers.get('Retry-After'))
            kind = ('invalid_credential' if code in (401, 403) else 'rate_limit' if code == 429
                    else 'model_unavailable' if code == 404 else 'timeout' if code == 504
                    else 'provider_error' if code and code >= 500 else 'malformed_request')
            scope = 'pool'
            if code == 429:
                scope, body_delay = gemini_quota_details(exc.details, self.model)
                delay = max(delay, body_delay)
            raise AIError(kind, delay, scope) from None
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
                 clock=time.monotonic, sleep=time.sleep, jitter=random.random, request_timeout=180):
        if timeout <= 0 or request_timeout <= 0 or retries < 0 or cooldown < 0 or concurrency < 1:
            raise ValueError('Invalid AI configuration.')
        self.states = [ProviderState(provider) for provider in providers]
        self.timeout, self.retries, self.cooldown = timeout, retries, cooldown
        self.request_timeout = request_timeout
        self.clock, self.sleep, self.jitter = clock, sleep, jitter
        self.semaphore, self.lock, self.pools = BoundedSemaphore(concurrency), RLock(), {}
        self.model_pools = {}

    def _model_pool(self, provider):
        return provider.quota_pool, getattr(provider, 'model', None)

    def _quota_until(self, provider):
        return max(self.pools.get(provider.quota_pool, 0), self.model_pools.get(self._model_pool(provider), 0))

    def _cooldown_until(self, state):
        return max(state.cooldown_until, self._quota_until(state.provider))

    def health(self):
        with self.lock:
            return [{'provider': state.provider.name, 'credential_slot': i,
                     'disabled': state.disabled, 'failures': state.failures,
                     'cooling_down': self._cooldown_until(state) > self.clock()}
                    for i, state in enumerate(self.states)]

    def generate_structured(self, prompt, schema):
        if not self.states:
            raise AIError('missing_credential')
        deadline = self.clock() + self.request_timeout
        if not self.semaphore.acquire(timeout=min(self.timeout, self.request_timeout)):
            raise AIError('concurrency_limit')
        try:
            last = 'unavailable'
            last_error = AIError(last)
            for index, state in enumerate(self.states):
                for attempt in range(self.retries+1):
                    remaining = deadline - self.clock()
                    if remaining <= 0:
                        raise AIError('timeout')
                    with self.lock:
                        if state.disabled:
                            break
                        if self._cooldown_until(state) > self.clock():
                            quota_wait = self._quota_until(state.provider) - self.clock()
                            if quota_wait > 0 and last in ('unavailable', 'rate_limit'):
                                wait = min(last_error.retry_after, quota_wait) if last == 'rate_limit' else quota_wait
                                last, last_error = 'rate_limit', AIError('rate_limit', wait)
                            break
                        model = getattr(state.provider, 'model', None)
                        has_alternate = model is not None and any(
                            getattr(other.provider, 'model', model) != model and not other.disabled
                            and self._cooldown_until(other) <= self.clock()
                            for other in self.states[index + 1:])
                    try:
                        # Reserve time for an available alternate model if this one stalls.
                        attempt_timeout = min(self.timeout, remaining / 2 if has_alternate else remaining)
                        value = state.provider.generate_structured(prompt, schema, attempt_timeout)
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
                    last_error = error
                    with self.lock:
                        state.failures += 1
                        if last == 'invalid_credential':
                            state.disabled = True
                            break
                        if last == 'rate_limit':
                            # Keys still share quota. Only evidenced per-model limits permit another model.
                            until = self.clock() + max(self.cooldown, error.retry_after)
                            if error.quota_scope == 'model' and model is not None:
                                self.model_pools[self._model_pool(state.provider)] = until
                            else:
                                self.pools[state.provider.quota_pool] = until
                            break
                        if last == 'malformed_request':
                            raise error
                        if has_alternate and last in ('timeout', 'network', 'provider_error', 'model_unavailable'):
                            state.cooldown_until = self.clock() + max(self.cooldown, error.retry_after)
                            break
                        if last == 'malformed_output' or attempt == self.retries:
                            state.cooldown_until = self.clock() + max(self.cooldown, error.retry_after)
                            break
                    delay = max(error.retry_after, min(2**attempt + self.jitter(), self.timeout))
                    if delay >= deadline - self.clock():
                        raise AIError('timeout')
                    if delay > self.timeout:
                        with self.lock:
                            state.cooldown_until = self.clock() + delay
                        break
                    self.sleep(delay)
            raise last_error
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
    thinking_level = os.getenv('GEMINI_THINKING_LEVEL', 'low').strip().lower()
    if thinking_level not in ('low', 'medium', 'high'):
        raise AIError('invalid_configuration')
    models = list(dict.fromkeys([model, *[m.strip() for m in os.getenv('GEMINI_FALLBACK_MODELS', '').split(',') if m.strip()]]))
    if len(models) > 3:
        raise AIError('invalid_configuration')
    providers = [GeminiProvider(key, name, thinking_level=thinking_level) for key in keys for name in models] if 'gemini' in priority and model else []
    return AIRouter(providers, timeout=float(os.getenv('AI_REQUEST_TIMEOUT_SECONDS', '120')),
                    request_timeout=float(os.getenv('AI_TOTAL_TIMEOUT_SECONDS', '180')),
                    retries=int(os.getenv('AI_MAX_RETRIES', '2')),
                    cooldown=float(os.getenv('AI_PROVIDER_COOLDOWN_SECONDS', '60')),
                    concurrency=int(os.getenv('AI_MAX_CONCURRENCY', '2')))
