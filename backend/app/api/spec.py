from fastapi import APIRouter
from app.models.spec import DatasetSpec

router = APIRouter(prefix='/api/v1')


@router.post('/spec', response_model=DatasetSpec)
def validate_spec(spec: DatasetSpec):
    """Validate or update a client-held spec. No server persistence."""
    return spec
