"""Input-derived relationship proposals and reviewed lossless normalization."""
import json
import pandas as pd
from fastapi import APIRouter, HTTPException
from app.api.intelligence import get_router
from app.api.jobs import artifacts
from app.core.config import settings
from app.core.store import store
from app.core.relationship_analysis import analyze, normalize, check_frame, build
from app.core.relationship_inspection import inspect_relationships
from app.models.relationship_analysis import AnalysisRequest, NormalizeRequest, RelationshipInspection

router = APIRouter(prefix='/api/v1/relationships')


@router.post('/inspect')
def inspect_generated_relationships(request: RelationshipInspection):
    try:
        if request.storage == 'artifact' and request.manifest_id:
            manifest = artifacts.get(request.manifest_id)
            if manifest.format != 'json' or manifest.size > 1024**2:
                raise ValueError('Inspection requires the generated table manifest.')
            with artifacts.open(request.manifest_id) as stream:
                mappings = json.load(stream).get('tables', {})
            if any(mappings.get(t.name) != t.dataset_id for t in request.tables):
                raise ValueError('Inspection tables do not belong to the generated manifest.')
            if request.source_dataset_id not in mappings.values():
                raise ValueError('The active generated snapshot does not belong to this manifest.')
        else:
            source(AnalysisRequest(dataset_id=request.source_dataset_id, storage=request.source_storage or request.storage))
        frames, cells, size = {}, 0, 0
        for table in request.tables:
            frame = source(AnalysisRequest(dataset_id=table.dataset_id, storage=request.storage))
            check_frame(frame)
            cells += frame.size
            size += int(frame.memory_usage(index=True, deep=True).sum())
            if cells > settings.max_cells or size > settings.cache_max_bytes:
                raise ValueError('Relationship inspection exceeds the local total cell/memory limit.')
            frames[table.name] = frame
        return {'source_dataset_id': request.source_dataset_id, **inspect_relationships(frames, request.tables)}
    except KeyError:
        raise HTTPException(404, 'Generated tables are missing or expired; regenerate before inspecting relationships.') from None
    except (ValueError, TypeError, AttributeError) as exc:
        raise HTTPException(400, str(exc)) from None


def materialize(dataset_id, output):
    frames, spec, integrity = output
    tokens = store.put_many(frames, 'generated')
    tables = [{**table.model_dump(mode='json'), 'dataset_id': tokens[table.name],
               'preview': json.loads(frames[table.name].head(25).to_json(orient='records', date_format='iso'))}
              for table in spec.tables]
    return {'source_dataset_id': dataset_id, 'spec': spec.model_dump(mode='json'),
            'tables': tables, 'integrity': integrity}


@router.post('/build')
def build_relationships(request: AnalysisRequest):
    try:
        proposal, output = build(source(request), request, get_router())
        return {'source_dataset_id': request.dataset_id, 'proposal': proposal,
                'result': materialize(request.dataset_id, output) if output else None}
    except KeyError:
        raise HTTPException(404, 'Generated dataset is missing or expired; regenerate before building relationships.') from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None


def source(request):
    if request.storage == 'frame':
        return store.get(request.dataset_id, 'generated')
    artifact = artifacts.get(request.dataset_id)
    if artifact.format != 'jsonl' or artifact.size > settings.cache_max_bytes:
        raise ValueError('Relationship analysis requires a bounded generated JSONL table.')
    records = []
    columns = set()
    with artifacts.open(request.dataset_id) as stream:
        while True:
            line = stream.readline(1024**2 + 1)
            if not line:
                break
            if len(line) > 1024**2 or len(records) >= settings.max_rows:
                raise ValueError('Relationship analysis exceeds the local record/row limit.')
            record = json.loads(line)
            if not isinstance(record, dict):
                raise ValueError('Relationship analysis requires tabular records.')
            records.append(record)
            columns.update(record)
            if len(records) * len(columns) > settings.max_cells:
                raise ValueError('Relationship analysis exceeds the local cell limit.')
    frame = pd.DataFrame(records)
    check_frame(frame)
    return frame


@router.post('/analyze')
def analyze_relationships(request: AnalysisRequest):
    try:
        return analyze(source(request), request, get_router())
    except KeyError:
        raise HTTPException(404, 'Generated dataset is missing or expired; regenerate before analyzing relationships.') from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None


@router.post('/normalize')
def normalize_relationships(request: NormalizeRequest):
    if not request.accepted:
        raise HTTPException(400, 'Review the entity mappings and accept them before normalization.')
    try:
        return materialize(request.dataset_id, normalize(source(request), request))
    except KeyError:
        raise HTTPException(404, 'Generated dataset is missing or expired; regenerate before normalizing.') from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
