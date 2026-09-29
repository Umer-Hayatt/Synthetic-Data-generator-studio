from fastapi import APIRouter, HTTPException
from app.models.spec import Model
from app.core.store import store
from app.eval.quality import quality
from app.eval.tstr import evaluate_tstr
from typing import Literal
from pydantic import Field

router = APIRouter(prefix='/api/v1/evaluate')


class QualityRequest(Model):
    reference_id: str
    generated_id: str


class TSTRRequest(Model):
    reference_id: str
    target: str | None = None
    task: Literal['auto', 'classification', 'regression'] = 'auto'
    seed: int = Field(default=42, ge=0, le=2**32-1)


@router.post('/tstr')
def tstr(request: TSTRRequest):
    try:
        return evaluate_tstr(store.get(request.reference_id, 'reference'), request.target, request.task, request.seed)
    except KeyError as exc:
        raise HTTPException(404, exc.args[0]) from None


@router.post('/quality')
def evaluate_quality(request: QualityRequest):
    try:
        return quality(store.get(request.reference_id, 'reference'), store.get(request.generated_id, 'generated'))
    except KeyError as exc:
        raise HTTPException(404, exc.args[0]) from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None
