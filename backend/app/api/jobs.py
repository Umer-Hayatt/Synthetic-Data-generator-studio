"""Additive job APIs. Raw ingest body is streamed; P0 multipart API is unchanged."""
from dataclasses import asdict
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, Request, Query
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool
from app.adapters.streaming import profile_source, batches
from app.core.artifacts import LocalArtifactStore
from app.core.config import settings
from app.core.jobs import InMemoryJobStore, LocalJobExecutor
from app.engines.registry import GenerationPlan, registry
from app.models.spec import Model
from pydantic import Field
from app.eval.comparison import compare
from app.core.validation import validate_frame

router = APIRouter(prefix='/api/v1')
artifacts = LocalArtifactStore(settings.artifact_root, settings.artifact_max_bytes, settings.artifact_ttl_seconds)
jobs = InMemoryJobStore(settings.job_metadata_limit, settings.artifact_ttl_seconds)
executor = LocalJobExecutor(jobs, artifacts, settings.job_queue_size)


class ComparisonRequest(Model):
    source_artifact: str
    target: str | None = None
    seed: int = Field(default=42, ge=0, le=2**32-1)


@router.get('/engines')
def engines():
    return [registry.create(name).capabilities() for name in registry.factories]


@router.post('/jobs/compare', status_code=202)
def compare_job(request: ComparisonRequest):
    try:
        artifact = artifacts.get(request.source_artifact)
        def operation(progress, outputs):
            with artifacts.pin(artifact.id) as path:
                profile, frame = profile_source(path,artifact.format,progress,sample_rows=min(5000,settings.profile_rows),include_sample=True)
            progress('training',.3)
            result = compare(frame,request.target,request.seed)
            result['source_profile'] = {'row_count':profile['row_count'],'sample_rows':profile['sample_rows']}
            progress('validating',.9)
            outputs.append(artifacts.write([json.dumps(result,allow_nan=False).encode()],'json').id)
        return executor.submit(operation, inputs=[artifact.id])
    except KeyError:
        raise HTTPException(404,'Source artifact not found.') from None
    except ValueError:
        raise HTTPException(400,'Comparison queue is full or source invalid.') from None


@router.post('/jobs/generate', status_code=202)
def generate_job(plan: GenerationPlan):
    if not plan.accepted:
        raise HTTPException(400, 'Review the specification and set accepted=true before generation.')
    if plan.engine == 'auto':
        raise HTTPException(400, 'Run /jobs/compare, review its recommendation, then select that engine explicitly.')
    needs_source = plan.engine.startswith('deep_') or plan.engine == 'statistical_conditional'
    if needs_source and not plan.source_artifact:
        raise HTTPException(400, 'This engine requires a source artifact for fitting.')
    if plan.source_artifact and not needs_source:
        raise HTTPException(400, 'This engine uses the reviewed specification rather than raw source fitting.')
    if plan.spec.business_rules:
        raise HTTPException(400, 'Free-text business rules are review suggestions. Translate them to supported typed rules before execution.')
    try:
        engine = registry.create(plan.engine)
        if engine.capabilities().get('available') is False:
            raise HTTPException(400, 'Optional deep capability is not installed/enabled; use statistical generation.')
        if needs_source and (len(plan.spec.tables) != 1 or plan.spec.tables[0].row_count > settings.max_rows):
            raise HTTPException(400, 'Source-fitted local engines require one bounded table.')
        if needs_source and any(c.privacy_rule for c in plan.spec.tables[0].columns):
            raise HTTPException(400, 'Source-fitted engines do not yet support reviewed privacy transforms; use statistical mode.')
        source = artifacts.get(plan.source_artifact) if needs_source else None
        def operation(progress, outputs):
            frame = None
            if source:
                with artifacts.pin(source.id) as path:
                    _, frame = profile_source(path,source.format,progress,include_sample=True)
                if list(frame.columns) != [c.name for c in plan.spec.tables[0].columns]:
                    raise ValueError('Source columns differ from accepted schema.')
            progress('training', .25)
            if source:
                engine.fit(frame,target=plan.spec.tables[0].target_column,seed=plan.spec.seed)
            else:
                engine.fit(plan.spec)
            if plan.engine == 'statistical':
                total, done = plan.spec.tables[0].row_count, 0
                def chunks():
                    nonlocal done
                    for frame in engine.generate_batches(plan.batch_rows):
                        progress('generating', .3 + .55 * done/total)
                        done += len(frame)
                        yield frame.to_json(orient='records', lines=True, date_format='iso').encode()
                outputs.append(artifacts.write(chunks(), 'jsonl').id)
            elif needs_source:
                progress('generating',.3)
                frame = engine.generate(plan.spec.tables[0].row_count)
                validate_frame(frame,plan.spec.tables[0])
                outputs.append(artifacts.write([frame.to_json(orient='records',lines=True,date_format='iso').encode()],'jsonl').id)
            else:
                progress('generating', .3)
                result = engine.generate()
                manifest = {}
                for name, frame in result.items():
                    artifact = artifacts.write([frame.to_json(orient='records', lines=True, date_format='iso').encode()], 'jsonl')
                    outputs.append(artifact.id)
                    manifest[name] = artifact.id
                outputs.append(artifacts.write([json.dumps({'tables':manifest}).encode()], 'json').id)
            progress('validating', .95)
        return executor.submit(operation, inputs=[source.id] if source else [])
    except KeyError:
        raise HTTPException(404, 'Source artifact not found.') from None
    except ValueError as exc:
        msg = str(exc)
        if 'columns differ' in msg:
            raise HTTPException(400, 'Uploaded source columns do not match accepted schema columns. Re-upload or edit the spec.') from None
        raise HTTPException(400, f'Generation plan invalid: {msg}') from None


@router.post('/jobs/ingest', status_code=202)
async def ingest_job(request: Request, filename: str = Query(max_length=256)):
    format = Path(filename).suffix.lower().lstrip('.')
    if format not in ('csv', 'json', 'jsonl', 'xlsx', 'parquet'):
        raise HTTPException(400, 'Use CSV, JSON, JSONL, XLSX or Parquet. Large Excel: convert to CSV/Parquet.')
    token, count = artifacts.begin(), 0
    try:
        async for chunk in request.stream():
            count += len(chunk)
            if count > settings.job_upload_bytes:
                raise ValueError('Deployment upload limit exceeded.')
            if chunk:
                await run_in_threadpool(artifacts.append, token, chunk)
        if not count:
            raise ValueError('Empty upload.')
        await run_in_threadpool(artifacts.commit, token, format)
        def operation(progress, outputs):
            with artifacts.pin(token) as path:
                profile = profile_source(path, format, progress)
            progress('validating', .9)
            result = artifacts.write([json.dumps(profile, allow_nan=False).encode()], 'json')
            outputs.append(result.id)
        return executor.submit(operation, inputs=[token], owned_inputs=True)
    except BaseException as exc:
        artifacts.delete(token)
        if isinstance(exc, ValueError):
            raise HTTPException(400, str(exc)) from None
        raise


@router.get('/jobs/{job_id}')
def get_job(job_id: str):
    try:
        return jobs.get(job_id)
    except KeyError:
        raise HTTPException(404, 'Job not found.') from None


@router.post('/jobs/{job_id}/cancel', status_code=202)
def cancel_job(job_id: str):
    try:
        result = executor.cancel(job_id)
        return {**result, 'cancellation_requested': result['status'] not in ('complete', 'failed', 'cancelled')}
    except KeyError:
        raise HTTPException(404, 'Job not found.') from None


@router.get('/artifacts/{artifact_id}')
def get_artifact(artifact_id: str, preview_rows: int = Query(default=0, ge=0, le=100)):
    try:
        artifact = artifacts.get(artifact_id)
        result = asdict(artifact)
        if preview_rows:
            if artifact.format == 'jsonl':
                rows = []
                with artifacts.open(artifact_id) as stream:
                    for _ in range(preview_rows):
                        line = stream.readline(1024**2+1)
                        if not line: break
                        if len(line) > 1024**2: raise ValueError('Preview record is too large; download the artifact.')
                        rows.append(json.loads(line))
                result['preview'] = rows
            elif artifact.format in ('csv','parquet','xlsx'):
                with artifacts.pin(artifact_id) as path:
                    iterator = batches(path,artifact.format,batch_rows=preview_rows)
                    try:
                        frame = next(iterator)
                        result['preview'] = json.loads(frame.head(preview_rows).to_json(orient='records',date_format='iso'))
                    finally:
                        iterator.close()
        return result
    except KeyError:
        raise HTTPException(404, 'Artifact not found or expired.') from None
    except (ValueError,StopIteration):
        raise HTTPException(400, 'Preview unavailable for this artifact; use download.') from None


_MEDIA_TYPES = {
    'csv': 'text/csv',
    'json': 'application/json',
    'jsonl': 'application/x-ndjson',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'parquet': 'application/octet-stream',
}


@router.get('/artifacts/{artifact_id}/download')
def download_artifact(artifact_id: str, format: str | None = None):
    try:
        artifact = artifacts.get(artifact_id)
    except KeyError:
        raise HTTPException(404, 'Artifact not found or expired.') from None
    target_fmt = (format or artifact.format).lower()
    if target_fmt not in _MEDIA_TYPES:
        target_fmt = artifact.format
    media_type = _MEDIA_TYPES.get(target_fmt, 'application/octet-stream')
    filename = f'artifact_{artifact_id[:8]}.{target_fmt}'

    if target_fmt == 'csv' and artifact.format == 'jsonl':
        import io
        import pandas as pd
        def stream_csv():
            buffer = []
            header_written = False
            with artifacts.open(artifact_id) as stream:
                for line in stream:
                    line_str = line.decode('utf-8').strip()
                    if line_str:
                        buffer.append(json.loads(line_str))
                    if len(buffer) >= 1000:
                        df = pd.DataFrame(buffer)
                        buf = io.StringIO()
                        df.to_csv(buf, index=False, header=not header_written)
                        header_written = True
                        buffer = []
                        yield buf.getvalue().encode('utf-8')
            if buffer:
                df = pd.DataFrame(buffer)
                buf = io.StringIO()
                df.to_csv(buf, index=False, header=not header_written)
                yield buf.getvalue().encode('utf-8')
        return StreamingResponse(stream_csv(), media_type=media_type,
                                 headers={'Content-Disposition': f'attachment; filename="{filename}"'})

    def chunks():
        with artifacts.open(artifact_id) as stream:
            while chunk := stream.read(64 * 1024):
                yield chunk
    return StreamingResponse(chunks(), media_type=media_type,
                             headers={'Content-Disposition': f'attachment; filename="{filename}"'})
