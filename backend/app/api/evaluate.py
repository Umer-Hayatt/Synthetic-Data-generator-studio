from fastapi import APIRouter, HTTPException
from app.models.spec import DatasetSpec, Model
from app.core.store import store
from app.eval.quality import quality, spec_quality

router = APIRouter(prefix='/api/v1/evaluate')


class QualityRequest(Model):
    reference_id: str | None = None
    generated_id: str
    spec: DatasetSpec | None = None


@router.post('/quality')
def evaluate_quality(request: QualityRequest):
    try:
        synthetic = store.get(request.generated_id, 'generated')
        if request.reference_id:
            reference = store.get(request.reference_id, 'reference')
            return quality(reference, synthetic)
        else:
            return spec_quality(request.spec, synthetic)
    except KeyError as exc:
        raise HTTPException(404, exc.args[0]) from None
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from None

