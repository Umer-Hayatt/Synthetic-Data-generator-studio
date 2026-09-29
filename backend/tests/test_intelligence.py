from fastapi.testclient import TestClient
from app.main import app
from app.core.ai import AIRouter
from app.api import intelligence
from test_ai import Fake


def test_prompt_spec_review_and_outage(monkeypatch):
    spec = {'name':'shop','version':'2.0','tables':[{'name':'customers','row_count':100000,
            'columns':[{'name':'id','dtype':'integer','constraints':{'unique':True,'auto_increment':True}}],
            'primary_key':'id'}]}
    monkeypatch.setattr(intelligence,'get_router',lambda:AIRouter([Fake([spec])]))
    client = TestClient(app)
    result = client.post('/api/v1/ai/spec',json={'prompt':'Create 100000 customers'}).json()
    assert result['status'] == 'review_required'
    assert result['spec']['tables'][0]['row_count'] == 100000
    monkeypatch.setattr(intelligence,'get_router',lambda:AIRouter([]))
    assert client.post('/api/v1/ai/spec',json={'prompt':'x'}).json()['reason'] == 'missing_credential'
    assert client.post('/api/v1/ai/suggestions',json={'spec':spec}).json()['status'] == 'deterministic'


def test_malformed_spec_rejected(monkeypatch):
    monkeypatch.setattr(intelligence,'get_router',lambda:AIRouter([Fake([{'tables':[]}])]))
    result = TestClient(app).post('/api/v1/ai/spec',json={'prompt':'x'}).json()
    assert result['status'] == 'unavailable' and result['reason'] == 'malformed_output'
