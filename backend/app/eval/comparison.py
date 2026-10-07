"""Sequential, bounded comparison. All engine fitting uses real train only."""
from time import perf_counter
from sklearn.model_selection import train_test_split
from app.engines.registry import StatisticalSynthesizer, registry
from app.eval.quality import quality
from app.eval.diagnostics import memorization


class BaselineStatistical(StatisticalSynthesizer):
    def fit(self, source, target=None, seed=42):
        return super().fit(source, target=None, seed=seed)


def compare(frame, target=None, seed=42, engines=('statistical','statistical_conditional','deep_ctgan','deep_tvae')):
    if not 20 <= len(frame) <= 5000 or frame.size > 100000:
        raise ValueError('Comparison requires 20..5000 sampled rows and at most 100000 cells.')
    if target and target not in frame:
        raise ValueError('Target does not exist.')
    classes = frame[target] if target and frame[target].nunique() <= 50 and not frame[target].isna().any() else None
    stratify = classes if classes is not None and classes.value_counts().min() >= 2 and int(len(frame)*.2) >= classes.nunique() else None
    train, test = train_test_split(frame,test_size=.2,random_state=seed,stratify=stratify)
    results = []
    for name in engines:
        factory = (BaselineStatistical if name == 'statistical' else StatisticalSynthesizer
                   if name == 'statistical_conditional' else lambda name=name:registry.create(name))
        engine = factory()
        if engine.capabilities().get('available') is False:
            results.append({'engine':name,'status':'unavailable','capabilities':engine.capabilities()})
            continue
        start = perf_counter()
        try:
            engine.fit(train,target=target if classes is not None else None,seed=seed)
            generated = engine.generate(len(train))
            fidelity = quality(test,generated)
            results.append({'engine':name,'status':'ok','quality_score':fidelity['overall_score'],
                'runtime_seconds':perf_counter()-start,
                'memory_estimate_bytes':int(train.memory_usage(deep=True).sum()+generated.memory_usage(deep=True).sum()),
                'memory_measurement':'Input plus output DataFrame footprint; excludes model/native/process peak memory.',
                'diagnostics':memorization(train,generated)})
        except (ValueError,TypeError):
            results.append({'engine':name,'status':'unavailable','reason':'Engine could not fit this bounded sample.'})
    eligible = [r for r in results if r['status']=='ok']
    def rank(item):
        score = item['quality_score'] or 0
        # Within small metric ties, keep simpler/faster statistical baseline.
        return (round(score,2), 1 if item['engine']=='statistical' else 0, -item['runtime_seconds'])
    selected = max(eligible,key=rank)['engine'] if eligible else None
    return {'results':results,'recommendation':selected,'seed':seed,
            'sample_rows':len(frame),'split':'80/20; fit uses train only; internal engineering benchmark.',
            'selection_rule':'Fidelity quality score; ties favor baseline then runtime.',
            'notice':'Recommendation applies only to this sampled dataset and seed; deep is never preferred by name.'}

