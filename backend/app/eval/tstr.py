"""Split first. Fit synthesis metadata and model preprocessing on train data only."""
from typing import Literal
import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import accuracy_score, f1_score, roc_auc_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from app.core.profiling import fit_spec
from app.engines.tabular import generate


def target_candidates(frame: pd.DataFrame) -> list[dict]:
    candidates = []
    for name in frame.columns:
        values = frame[name].dropna()
        count = values.nunique()
        if len(values) < 10 or count < 2 or name.lower() == 'id' or name.lower().endswith('_id'):
            continue
        if pd.api.types.is_numeric_dtype(values) and not pd.api.types.is_bool_dtype(values):
            task = 'classification' if count <= 20 and (values % 1 == 0).all() else 'regression'
        elif count <= 50 and count <= len(values)//2:
            task = 'classification'
        else:
            continue
        candidates.append({'name':name, 'suggested_task':task})
    return candidates


def pipeline(numeric: list[str], categorical: list[str], task: str, seed: int):
    preprocessing = ColumnTransformer([
        ('numeric', SimpleImputer(strategy='median', keep_empty_features=True), numeric),
        ('categorical', Pipeline([
            ('impute', SimpleImputer(strategy='most_frequent', keep_empty_features=True)),
            ('encode', OneHotEncoder(handle_unknown='ignore', max_categories=32)),
        ]), categorical),
    ])
    model_class = RandomForestClassifier if task == 'classification' else RandomForestRegressor
    return Pipeline([('preprocess', preprocessing), ('model', model_class(
        n_estimators=50, max_depth=8, min_samples_leaf=2, random_state=seed, n_jobs=1))])


def prepare_features(frame, numeric, categorical):
    result = frame.copy()
    for name in numeric:
        result[name] = pd.to_numeric(result[name], errors='coerce').astype(float).replace([np.inf,-np.inf],np.nan)
    for name in categorical:
        result[name] = result[name].map(lambda value: str(value) if pd.notna(value) else np.nan)
    return result


def evaluate_tstr(frame: pd.DataFrame, target: str | None = None,
                  task: Literal['auto', 'classification', 'regression'] = 'auto', seed: int = 42) -> dict:
    candidates = target_candidates(frame)
    def disabled(reason):
        return {'status':'unavailable', 'reason':reason, 'target_candidates':candidates}
    if target is None:
        return disabled('Select a supervised target column to run TSTR.')
    if target not in frame:
        return disabled('Selected target does not exist.')
    if task not in ('auto','classification','regression'):
        return disabled('Task must be auto, classification, or regression.')
    usable = frame.dropna(subset=[target]).copy()
    dropped = len(frame)-len(usable)
    if len(usable) < 20:
        return disabled('At least 20 rows with observed targets are required.')
    if usable[target].nunique() < 2:
        return disabled('Target must have at least two distinct values.')
    if target.lower() == 'id' or target.lower().endswith('_id'):
        return disabled('Identifier columns are unsuitable supervised targets.')
    if task == 'auto':
        candidate = next((item for item in candidates if item['name'] == target), None)
        if candidate is None:
            return disabled('Target is unsuitable; select a low-cardinality class or numeric regression target.')
        task = candidate['suggested_task']
    if task == 'classification':
        usable[target] = usable[target].astype(str)
        counts = usable[target].value_counts()
        if len(counts) > 50 or counts.min() < 2:
            return disabled('Classification requires at most 50 classes and at least two rows per class.')
        if int(np.ceil(len(usable)*.2)) < len(counts):
            return disabled('The 20% test split is too small to represent every class.')
    else:
        numeric_target = pd.to_numeric(usable[target], errors='coerce')
        if not np.isfinite(numeric_target.to_numpy(dtype=float)).all():
            return disabled('Regression target must contain finite numeric values.')
        usable[target] = numeric_target.astype(float)
    features = [name for name in usable.columns if name != target and name.lower() != 'id' and not name.lower().endswith('_id')]
    if not features:
        return disabled('At least one non-identifier feature is required.')
    try:
        real_train, real_test = train_test_split(usable, test_size=.2, random_state=seed,
                                               stratify=usable[target] if task == 'classification' else None)
        # This is the only profiling call. No full-data/client spec enters TSTR.
        spec = fit_spec(real_train[features+[target]], seed=seed,
                        categorical_columns=(target,) if task == 'classification' else ())
        synthetic_train = generate(spec)
        synthetic_train = synthetic_train.dropna(subset=[target])
        if len(synthetic_train) < 2 or synthetic_train[target].nunique() < 2:
            return disabled('Synthetic training target lacks sufficient variation; try another seed or more data.')
        numeric = [name for name in features if pd.api.types.is_numeric_dtype(real_train[name]) and not pd.api.types.is_bool_dtype(real_train[name])]
        categorical = [name for name in features if name not in numeric]
        test_x = prepare_features(real_test[features], numeric, categorical)
        test_y = real_test[target]
        results, auc_reasons = {}, {}
        for label, training in [('trtr', real_train), ('tstr', synthetic_train)]:
            model = pipeline(numeric, categorical, task, seed)
            train_y = training[target].astype(str) if task == 'classification' else pd.to_numeric(training[target])
            model.fit(prepare_features(training[features], numeric, categorical), train_y)
            prediction = model.predict(test_x)
            if task == 'classification':
                metrics = {'accuracy':float(accuracy_score(test_y, prediction)),
                           'macro_f1':float(f1_score(test_y, prediction, average='macro', labels=sorted(usable[target].unique()), zero_division=0)),
                           'roc_auc':None}
                classes = model.named_steps['model'].classes_
                if set(classes) == set(test_y.unique()) and len(classes) >= 2:
                    probabilities = model.predict_proba(test_x)
                    try:
                        metrics['roc_auc'] = float(roc_auc_score(test_y, probabilities[:,1] if len(classes)==2 else probabilities,
                                                               labels=classes, multi_class='ovr', average='macro'))
                    except ValueError:
                        auc_reasons[label] = 'ROC-AUC is undefined for this class coverage.'
                else:
                    auc_reasons[label] = 'ROC-AUC requires matching train/test class coverage and at least two test classes.'
            else:
                metrics = {'mae':float(mean_absolute_error(test_y,prediction)),
                           'rmse':float(np.sqrt(mean_squared_error(test_y,prediction))),
                           'r2':float(r2_score(test_y,prediction)) if test_y.nunique()>1 else None}
            results[label] = metrics
        comparisons = {}
        for metric in results['trtr']:
            baseline, synthetic = results['trtr'][metric], results['tstr'][metric]
            item = {'trtr':baseline, 'tstr':synthetic, 'delta':synthetic-baseline if baseline is not None and synthetic is not None else None,
                    'direction':'lower_is_better' if metric in ('mae','rmse') else 'higher_is_better'}
            if metric in ('accuracy','macro_f1','roc_auc') and baseline is not None and baseline>0 and synthetic is not None:
                item['retention_ratio'] = synthetic/baseline
            comparisons[metric] = item
        return {'status':'ok','task':task,'target':target,'seed':seed,'target_candidates':candidates,
                'rows':{'real_train':len(real_train),'real_test':len(real_test),'synthetic_train':len(synthetic_train),'dropped_missing_target':dropped},
                **results,'comparison':comparisons,'roc_auc_unavailable_reasons':auc_reasons,
                'model':'RandomForest: 50 trees, max_depth=8, min_samples_leaf=2, n_jobs=1; identical preprocessing architecture fitted separately.',
                'split':'80/20; stratified for classification. Synthesis fitted only on real train.',
                'excluded_identifier_features':[name for name in usable.columns if name != target and name not in features]}
    except (ValueError, TypeError) as exc:
        # Avoid reflecting private cell values from third-party exception messages.
        return disabled(f'TSTR could not fit this dataset ({type(exc).__name__}); check feature types, target variation, and sample size.')
