"""Bound the request before multipart parsing can spool an oversized upload."""
from starlette.responses import JSONResponse
from app.core.config import settings


class BodyLimitMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['method'] not in ('POST', 'PUT', 'PATCH'):
            return await self.app(scope, receive, send)
        limit = settings.max_upload_bytes + 64 * 1024  # multipart envelope allowance
        chunks = []
        size = 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            size += len(message.get('body', b''))
            if size > limit:
                return await JSONResponse({'detail': 'Request size limit exceeded.'}, 400)(scope, receive, send)
            chunks.append(message)
            if not message.get('more_body', False):
                break
        iterator = iter(chunks)

        async def bounded_receive():
            return next(iterator, {'type': 'http.request', 'body': b'', 'more_body': False})

        await self.app(scope, bounded_receive, send)
