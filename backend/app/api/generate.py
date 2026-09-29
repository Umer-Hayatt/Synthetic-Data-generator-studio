import json
from fastapi import APIRouter, HTTPException, Query
from pydantic import Field
from app.models.spec import DatasetSpec, Model
from app.engines.tabular import generate
from app.core.config import settings
from app.core.store import store

router = APIRouter(prefix='/api/v1')


class GenerationRequest(Model):
    spec: DatasetSpec
    preview_limit: int = Field(default=20, ge=0, le=1000)


def records(frame):
    return json.loads(frame.to_json(orient='records', date_format='iso'))


@router.post('/generate')
def generate_dataset(request: GenerationRequest):
    try:
        if sum(table.row_count * len(table.columns) for table in request.spec.tables) > settings.max_cells:
            raise ValueError('Generation cell limit exceeded.')
        frame = generate(request.spec)
        token = store.put(frame, 'generated')
        return {'dataset_id': token, 'row_count': len(frame), 'columns': list(frame.columns),
                'preview': records(frame.head(request.preview_limit)), 'expires_in_seconds': store.ttl}
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None


@router.get('/preview')
def preview(dataset_id: str, offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=1000)):
    try:
        frame = store.get(dataset_id)
    except KeyError as exc:
        raise HTTPException(404, exc.args[0]) from None
    return {'dataset_id': dataset_id, 'row_count': len(frame), 'columns': list(frame.columns),
            'offset': offset, 'limit': limit, 'rows': records(frame.iloc[offset:offset+limit])}
