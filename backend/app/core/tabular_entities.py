"""Preserve declared repeated-entity values while generating the flat snapshot."""
from graphlib import TopologicalSorter
import numpy as np


def retain_observed_entities(frame, spec):
    """Keep fully evidenced upload dependencies in its fitted generation model."""
    from app.core.relationship_analysis import candidates, evidence
    from app.models.spec import DatasetSpec
    draft = spec.model_dump()
    by_col = {c['name']: c for c in draft['tables'][0]['columns']}
    groups = []
    owned = set()
    for entity in candidates(frame):
        checked = evidence(frame, entity, 'Uploaded schema')
        key = by_col[entity.key]
        if not checked['valid'] or key.get('privacy_rule') or owned.intersection(entity.columns):
            continue
        key.update(semantic_type='id', nullable=False, null_rate=0, constraints={}, distribution=None)
        for name in entity.columns:
            by_col[name].setdefault('constraints', {})['unique'] = False
        groups.append({**entity.model_dump(), 'entity_count': checked['entity_count']})
        owned.update(entity.columns)
    draft['tabular_entities'] = groups
    return DatasetSpec.model_validate(draft)


def preserve_entities(frame, spec):
    rng = np.random.default_rng(spec.seed)
    entities = {e.name: e for e in spec.tabular_entities}
    by_key = {e.key: e for e in spec.tabular_entities}
    owners = {c: e.name for e in spec.tabular_entities for c in e.columns}
    pools = {}
    for entity in spec.tabular_entities:
        pool = frame[entity.key].dropna().drop_duplicates().iloc[:entity.entity_count].tolist()
        if len(pool) != entity.entity_count:
            raise ValueError('Key constraints cannot supply the reviewed distinct entity count.')
        pools[entity.key] = pool
        values = np.resize(np.array(pool, dtype=object), len(frame))
        rng.shuffle(values)
        frame[entity.key] = values
    graph = {e.name: ({owners[e.key]} if e.key in owners else set()) for e in spec.tabular_entities}
    for name in TopologicalSorter(graph).static_order():
        entity = entities[name]
        representatives = frame.drop_duplicates(entity.key).set_index(entity.key)
        for column in entity.columns:
            if column in by_key:
                related = pools[column]
                if len(related) > len(representatives):
                    raise ValueError('Related entity counts cannot satisfy the reviewed dependency.')
                values = np.resize(np.array(related, dtype=object), len(representatives))
                rng.shuffle(values)
                mapping = dict(zip(representatives.index, values))
                frame[column] = frame[entity.key].map(mapping)
            else:
                frame[column] = frame[entity.key].map(representatives[column])
    return frame
