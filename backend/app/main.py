import os
import asyncio
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.health import router as health_router
from app.api.ingest import router as ingest_router
from app.core.body_limit import BodyLimitMiddleware
from app.api.spec import router as spec_router
from app.api.generate import router as generate_router
from app.api.export import router as export_router
from app.core.store import store
from app.api.evaluate import router as evaluate_router

@asynccontextmanager
async def lifespan(app):
    async def sweep():
        while True:
            await asyncio.sleep(30)
            store.cleanup()
    task = asyncio.create_task(sweep())
    yield
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task


app = FastAPI(title='Synthetic Data Platform', version='1.0.0', lifespan=lifespan)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        'CORS_ORIGINS', 'http://localhost:3000,http://127.0.0.1:3000'
    ).split(',') if origin.strip()],
    allow_methods=['GET', 'POST'],
    allow_headers=['Content-Type'],
)
app.include_router(health_router)
app.include_router(ingest_router)
app.include_router(spec_router)
app.include_router(generate_router)
app.include_router(export_router)
app.include_router(evaluate_router)
