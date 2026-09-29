import numpy as np
import pandas as pd
import pytest
from app.core.profiling import fit_spec
from app.engines.tabular import generate
from app.models.spec import DatasetSpec


def test_reproducibility_distributions_and_correlations():
    rng = np.random.default_rng(3)
    x = rng.normal(20, 3, 2000)
    frame = pd.DataFrame({'x': x, 'y': 2*x + rng.normal(0, 1, 2000), 'category': rng.choice(['a', 'b'], 2000, p=[.8,.2])})
    spec = fit_spec(frame)
    spec.tables[0].row_count = 3000
    a, b = generate(spec), generate(spec)
    pd.testing.assert_frame_equal(a, b)
    assert len(a) == 3000
    assert abs(a.x.mean() - frame.x.mean()) < .5
    assert a[['x','y']].corr().iloc[0,1] > .9
    assert abs((a.category == 'a').mean() - .8) < .05


def test_privacy_nulls_and_outliers():
    def spec(privacy=None, **extra):
        return DatasetSpec.model_validate({'name':'test', 'tables':[{'name':'t','row_count':1000,'columns':[
            {'name':'x','dtype':'float','distribution':{'mean':10,'std':1},'privacy_rule':privacy, **extra}]}]})
    baseline = generate(spec()).x
    assert (generate(spec('mask')).x == '***').all()
    hashed = generate(spec('hash')).x
    assert hashed.str.fullmatch('[0-9a-f]{64}').all()
    noisy = generate(spec({'method':'noise','noise_std':4})).x
    assert noisy.std() > baseline.std() * 2
    assert .15 < generate(spec(null_rate=.2)).x.isna().mean() < .25
    assert generate(spec(outlier_rate=1)).x.std() > baseline.std() * 3


def test_semantics_dates_and_ids():
    frame = pd.DataFrame({'user_id': [1,2,3], 'email':['a@a.com']*3, 'date':['2020-01-01','2020-01-02','2020-01-03']})
    spec = fit_spec(frame)
    spec.tables[0].row_count = 20
    output = generate(spec)
    assert output.user_id.is_unique
    assert output.email.str.contains('@').all()
    assert pd.to_datetime(output.date, utc=True).min() >= pd.Timestamp('2020-01-01', tz='UTC')
    phone = generate(fit_spec(pd.DataFrame({'phone':[923001234567,923001234568]})))
    assert phone.phone.map(type).eq(str).all()


def test_boolean_categories_all_null_and_hard_bounds():
    frame = pd.DataFrame({'flag': [True, False] * 20, 'empty': [None] * 40})
    output = generate(fit_spec(frame))
    assert set(output.flag) == {True, False}
    assert output['empty'].isna().all()
    spec = DatasetSpec.model_validate({'name':'test','tables':[{'name':'t','row_count':10,'columns':[
        {'name':'x','dtype':'float','constraints':{'min':0,'max':1}, 'outlier_rate':1,
         'privacy_rule':{'method':'noise','noise_std':100}}]}]})
    assert generate(spec).x.between(0,1).all()


def test_numeric_category_membership_and_zero_id_start():
    spec = DatasetSpec.model_validate({'name':'test','tables':[{'name':'t','row_count':100,'columns':[
        {'name':'id','dtype':'integer','semantic_type':'id','constraints':{'min':0,'unique':True}},
        {'name':'class','dtype':'integer','distribution':{'type':'categorical','values':[0,10],'probabilities':[.8,.2]}}
    ]}]})
    output = generate(spec)
    assert output.id.iloc[0] == 0
    assert set(output['class']) == {0,10}
