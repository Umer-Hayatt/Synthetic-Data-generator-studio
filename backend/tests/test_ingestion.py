import io
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from app.adapters.ingestion import parse_upload
from app.core.config import Settings
from app.main import app


@pytest.mark.parametrize('name,content', [
    ('data.csv', b'a,b\n1,x\n2,y'), ('data.xlsx', None),
    ('data.json', b'[{"a":1,"b":"x"},{"a":2,"b":"y"}]'),
    ('data.json', b'{"a":[1,2],"b":["x","y"]}'),
])
def test_valid(name, content):
    if content is None:
        buffer = io.BytesIO()
        pd.DataFrame({'a': [1, 2], 'b': ['x', 'y']}).to_excel(buffer, index=False)
        content = buffer.getvalue()
    assert parse_upload(name, content).shape == (2, 2)
    response = TestClient(app).post('/api/v1/ingest', files={'file': (name, content)})
    assert response.status_code == 200
    assert response.json()['row_count'] == 2


@pytest.mark.parametrize('name,content', [
    ('x.csv', b'a,b\n1,2,3'), ('x.csv', b'a,a\n1,2'),
    ('x.xlsx', b'not excel'), ('x.json', b'{broken'),
    ('x.json', b'[1,2]'), ('x.json', b'[{"a": {"b":2}}]'),
    ('x.exe', b'hello'), ('x.csv', b''),
])
def test_invalid(name, content):
    response = TestClient(app).post('/api/v1/ingest', files={'file': (name, content)})
    assert response.status_code == 400


def test_limits():
    with pytest.raises(ValueError, match='Row limit'):
        parse_upload('x.csv', b'a\n1\n2', Settings(max_rows=1))
    with pytest.raises(ValueError, match='bytes'):
        parse_upload('x.csv', b'a\n1', Settings(max_upload_bytes=2))
    with pytest.raises(ValueError, match='Column limit'):
        parse_upload('x.json', b'[{"a":1},{"b":2}]', Settings(max_columns=1))
    with pytest.raises(ValueError, match='cell limit'):
        parse_upload('x.csv', b'a,b\n1,2\n3,4', Settings(max_cells=2))


def test_request_limit_before_multipart_parsing(monkeypatch):
    monkeypatch.setattr('app.core.body_limit.settings', Settings(max_upload_bytes=1))
    response = TestClient(app).post('/api/v1/ingest', content=b'x' * 70000,
                                    headers={'Content-Type':'application/octet-stream'})
    assert response.status_code == 400
    assert 'size limit' in response.json()['detail']
