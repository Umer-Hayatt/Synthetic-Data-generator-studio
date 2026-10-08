import json
from fastapi import APIRouter, File, HTTPException, UploadFile
from app.adapters.ingestion import parse_upload
from app.core.config import settings
from app.core.inference import infer_schema
from app.core.profiling import fit_spec
from app.core.store import store

router = APIRouter(prefix='/api/v1')


@router.post('/ingest')
async def ingest(file: UploadFile = File(...)):
    try:
        frame = parse_upload(file.filename or '', await file.read(settings.max_upload_bytes + 1))
        schema = infer_schema(frame)
        spec = fit_spec(frame, auto_privacy=True)
        token = store.put(frame, 'reference')
        sensitive_cols = [col['name'] for col in schema if col.get('is_sensitive')]
        return {'dataset_id': token, 'expires_in_seconds': store.ttl,
                'row_count': len(frame), 'columns': list(frame.columns),
                'schema': schema,
                'sensitive_columns': sensitive_cols,
                'sensitive_count': len(sensitive_cols),
                'spec': spec.model_dump(),
                'preview': json.loads(frame.head(20).to_json(orient='records', date_format='iso'))}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
    finally:
        await file.close()
