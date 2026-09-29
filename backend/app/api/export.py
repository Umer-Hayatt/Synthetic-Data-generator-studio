from typing import Literal
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from app.core.store import store

router = APIRouter(prefix='/api/v1')


@router.get('/export/{format}')
def export(format: Literal['csv', 'json'], dataset_id: str):
    try:
        frame = store.get(dataset_id, 'generated')
    except KeyError as exc:
        raise HTTPException(404, exc.args[0]) from None

    def chunks():
        if format == 'csv':
            for start in range(0, len(frame), 1000):
                yield frame.iloc[start:start+1000].to_csv(index=False, header=start == 0)
        else:
            yield '['
            for start in range(0, len(frame), 1000):
                if start:
                    yield ','
                yield frame.iloc[start:start+1000].to_json(orient='records', date_format='iso')[1:-1]
            yield ']'
    return StreamingResponse(chunks(), media_type='text/csv' if format == 'csv' else 'application/json',
                             headers={'Content-Disposition': f'attachment; filename="synthetic.{format}"'})
