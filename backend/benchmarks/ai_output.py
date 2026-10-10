"""Fixed live-AI output experiment. No credentials or uploaded data are logged.

Run from backend: .venv/Scripts/python.exe benchmarks/ai_output.py --output DIR
Wrap in a 660-second subprocess timeout. This is a three-case output benchmark,
not a general AI quality score; failed provider/setup trials cannot be ranked.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

CASES = [
    {
        'name': 'university', 'rows': 40, 'primary': 'enrollment_id',
        'fields': {'enrollment_id': 'integer', 'student_id': 'integer', 'student_name': 'string',
                   'course_id': 'integer', 'course_name': 'string', 'grade': 'string'},
        'counts': {'student_id': 10, 'course_id': 5},
        'dependencies': {'student_id': ['student_name'], 'course_id': ['course_name']},
        'categories': {'course_name': ['Database Systems', 'Computer Networks', 'Software Engineering',
                                      'Operating Systems', 'Linear Algebra'], 'grade': ['A', 'B', 'C', 'D', 'F']},
        'bounds': {},
        'prompt': 'Generate exactly 40 university enrollments with exactly 10 students and 5 courses. '
                  'Use these exact columns and no others: enrollment_id (unique integer primary key), '
                  'student_id (integer), student_name (person name), course_id (integer), course_name (string), '
                  'grade (string). Every field is nonnull. student_id determines student_name; course_id '
                  'determines course_name. course_name must be sampled only from Database Systems, '
                  'Computer Networks, Software Engineering, Operating Systems, Linear Algebra. '
                  'grade must be sampled only from A, B, C, D, F. Represent all 10 students and 5 courses. '
                  'Keep the main grain at one enrollment. Use locale en_US and seed 42.',
    },
    {
        'name': 'retail', 'rows': 60, 'primary': 'order_id',
        'fields': {'order_id': 'integer', 'customer_id': 'integer', 'customer_name': 'string',
                   'customer_email': 'string', 'status': 'string', 'amount': 'float'},
        'counts': {'customer_id': 12},
        'dependencies': {'customer_id': ['customer_name', 'customer_email']},
        'categories': {'status': ['Pending', 'Paid', 'Shipped']}, 'bounds': {'amount': [10, 500]},
        'prompt': 'Generate exactly 60 retail orders with exactly 12 customers. Use these exact columns '
                  'and no others: order_id (unique integer primary key), customer_id (integer), '
                  'customer_name (person name), customer_email (email), status (string), amount (float). '
                  'Every field is nonnull. Each customer_id determines one consistent customer_name and '
                  'customer_email. status must be sampled only from Pending, Paid, Shipped. '
                  'amount must be between 10 and 500 inclusive. Represent all 12 customers. '
                  'Keep the main grain at one order. Use locale en_US and seed 42.',
    },
    {
        'name': 'banking', 'rows': 50, 'primary': 'transaction_id',
        'fields': {'transaction_id': 'integer', 'account_id': 'integer', 'account_type': 'string',
                   'transaction_type': 'string', 'amount': 'float', 'currency': 'string'},
        'counts': {'account_id': 10}, 'dependencies': {'account_id': ['account_type']},
        'categories': {'account_type': ['Current', 'Savings'], 'transaction_type': ['Debit', 'Credit'],
                       'currency': ['PKR']}, 'bounds': {'amount': [1, 500]},
        'prompt': 'Generate exactly 50 bank transactions with exactly 10 accounts. Use these exact columns '
                  'and no others: transaction_id (unique integer primary key), account_id (integer), '
                  'account_type (string), transaction_type (string), amount (float), currency (string). '
                  'Every field is nonnull. Each account_id determines one consistent account_type. '
                  'account_type must be sampled only from Current, Savings; transaction_type only from '
                  'Debit, Credit; currency must always be PKR. amount must be between 1 and 500 inclusive. '
                  'Represent all 10 accounts. Keep the main grain at one transaction. '
                  'Do not generate statements, balances or documents. Use locale en_US and seed 42.',
    },
]


def run_case(client, case, output):
    from app.models.spec import DatasetSpec
    from app.models.relationship_analysis import NormalizeRequest
    from app.core.relationship_analysis import normalize
    from app.core.store import store
    import pandas as pd

    started = time.monotonic()
    draft_response = client.post('/api/v1/ai/spec', json={'prompt': case['prompt']})
    if draft_response.status_code != 200:
        raise RuntimeError(f"{case['name']}: draft HTTP {draft_response.status_code}")
    draft = draft_response.json()
    (output / 'draft.json').write_text(json.dumps(draft, indent=2), encoding='utf-8')
    if not draft.get('spec') or draft.get('fallback_used'):
        raise RuntimeError(f"{case['name']}: live AI unavailable ({draft.get('reason', 'no spec')})")
    spec = DatasetSpec.model_validate(draft['spec'])
    # Fixed generation seed for fair comparisons; score the returned seed below.
    generation_spec = spec.model_copy(update={'seed': 42})
    response = client.post('/api/v1/generate', json={'spec': generation_spec.model_dump(mode='json'), 'preview_limit': 0})
    if response.status_code != 200:
        raise RuntimeError(f"{case['name']}: generation HTTP {response.status_code}")
    dataset_id = response.json()['dataset_id']
    original = client.get('/api/v1/export/json', params={'dataset_id': dataset_id}).json()
    (output / 'source.json').write_text(json.dumps(original, indent=2), encoding='utf-8')
    (output / 'source.csv').write_bytes(client.get('/api/v1/export/csv', params={'dataset_id': dataset_id}).content)
    frame = store.get(dataset_id, 'generated')
    entities = [{'name': e.name, 'key': e.key, 'columns': e.columns} for e in spec.tabular_entities]
    request = NormalizeRequest(dataset_id=dataset_id, source_table=spec.tables[0].name,
                               prompt=case['prompt'], accepted=True, entities=entities)
    frames, normalized, integrity = normalize(frame, request, allow_single=True)
    # Independent complete-row reconstruction, plus key/reference checks.
    specs = {t.name: t for t in normalized.tables}
    root = normalized.tables[0]
    expanded = frames[root.name].copy()
    pending = list(normalized.tables[1:])
    while pending:
        ready = next((t for t in pending if t.primary_key in expanded), None)
        if ready is None:
            raise RuntimeError('Cannot reconstruct normalized tables')
        expanded = expanded.merge(frames[ready.name], on=ready.primary_key, how='left',
                                  sort=False, validate='many_to_one')
        pending.remove(ready)
    pd.testing.assert_frame_equal(expanded[list(frame.columns)].reset_index(drop=True),
                                  frame.reset_index(drop=True), check_exact=True)
    orphans = 0
    for table in normalized.tables:
        values = frames[table.name]
        if not values[table.primary_key].is_unique or values[table.primary_key].isna().any():
            raise RuntimeError('Invalid normalized primary key')
        for fk in table.foreign_keys:
            orphans += int((~values[fk.column].isin(frames[fk.reference_table][fk.reference_column])).sum())
        values.to_csv(output / f'{table.name}.csv', index=False)
        (output / f'{table.name}.json').write_text(values.to_json(orient='records', date_format='iso', indent=2), encoding='utf-8')
    if orphans or not integrity['lossless']:
        raise RuntimeError('Integrity gate failed')

    checks = []
    def check(label, passed):
        checks.append({'check': label, 'passed': bool(passed)})
    check('main row count', len(frame) == case['rows'])
    check('exact field names', set(frame.columns) == set(case['fields']))
    check('requested primary key', spec.tables[0].primary_key == case['primary'])
    check('requested locale', spec.locale == 'en_US')
    check('requested seed', spec.seed == 42)
    columns = {c.name: c for c in spec.tables[0].columns}
    for field, dtype in case['fields'].items():
        check(f'{field} type', field in columns and columns[field].dtype == dtype)
        check(f'{field} nonnull', field in frame and frame[field].notna().all())
    for key, count in case['counts'].items():
        check(f'{key} distinct count', key in frame and frame[key].nunique() == count)
    for key, attributes in case['dependencies'].items():
        check(f'{key} stable attributes', key in frame and all(attribute in frame and
              frame.groupby(key, dropna=False)[attribute].nunique(dropna=False).le(1).all() for attribute in attributes))
    for field, domain in case['categories'].items():
        check(f'{field} allowed values', field in frame and frame[field].isin(domain).all())
    for field, (low, high) in case['bounds'].items():
        check(f'{field} numeric bounds', field in frame and pd.to_numeric(frame[field], errors='coerce').between(low, high).all())
    check('meaningful entity mappings', all(any(e.key == key and set(attributes) <= set(e.columns)
          for e in spec.tabular_entities) for key, attributes in case['dependencies'].items()))
    result = {'case': case['name'], 'elapsed_seconds': round(time.monotonic() - started, 3),
              'passed': sum(c['passed'] for c in checks), 'total': len(checks), 'checks': checks,
              'guards': {'live_ai': True, 'lossless': True, 'unique_primary_keys': True, 'orphan_keys': orphans},
              'normalized_spec': normalized.model_dump(mode='json'), 'original_spec': spec.model_dump(mode='json')}
    (output / 'result.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=False)
    from fastapi.testclient import TestClient
    from app.main import app
    from app.api.intelligence import _SPEC_PROMPT_PREFIX
    start = time.monotonic()
    report = {'fixture_sha256': hashlib.sha256(json.dumps(CASES, sort_keys=True).encode()).hexdigest(),
              'prefix_sha256': hashlib.sha256(_SPEC_PROMPT_PREFIX.encode()).hexdigest(), 'cases': []}
    with TestClient(app) as client:
        try:
            for case in CASES:
                folder = args.output / case['name']
                folder.mkdir()
                result = run_case(client, case, folder)
                report['cases'].append(result)
                failures = [c['check'] for c in result['checks'] if not c['passed']]
                print(f"{case['name']}: {result['passed']}/{result['total']}; failed={failures}", flush=True)
        except Exception as exc:
            # Do not log provider exception text or secrets.
            report['status'] = 'invalid'
            report['error'] = f'{type(exc).__name__}: experiment did not pass the live-provider/generation/integrity gates'
            print(report['error'], flush=True)
            (args.output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
            return 2
    passed = sum(r['passed'] for r in report['cases'])
    total = sum(r['total'] for r in report['cases'])
    report.update(status='valid', passed=passed, total=total, metric=round(100 * passed / total, 4),
                  elapsed_seconds=round(time.monotonic() - start, 3))
    (args.output / 'report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(f"METRIC {report['metric']}% ({passed}/{total}) in {report['elapsed_seconds']}s", flush=True)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
