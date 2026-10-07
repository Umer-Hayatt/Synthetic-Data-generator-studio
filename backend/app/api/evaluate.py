from fastapi import APIRouter, HTTPException
from app.models.spec import Model
from app.core.store import store
from app.eval.quality import quality

router = APIRouter(prefix='/api/v1/evaluate')


class QualityRequest(Model):
    reference_id: str
    generated_id: str


@router.post('/quality')
def evaluate_quality(request: QualityRequest):
    try:
        return quality(store.get(request.reference_id, 'reference'), store.get(request.generated_id, 'generated'))
    except KeyError as exc:
        raise HTTPException(404, exc.args[0]) from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

