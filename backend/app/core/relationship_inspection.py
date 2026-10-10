"""Measure declared links against every row; never infer meaning from ID overlap."""
import numbers


def identity(value):
    # bool == 1 in Python must not create a spurious cross-type ID match.
    if isinstance(value, bool) or type(value).__name__ == 'bool_':
        return ('boolean', bool(value))
    if isinstance(value, numbers.Number):
        return ('number', value)
    return (type(value).__name__, value)


def inspect_relationships(frames, tables):
    nodes, links = [], []
    for table in tables:
        frame = frames[table.name]
        if table.primary_key and table.primary_key not in frame:
            raise ValueError('An identifying column is absent from the generated table.')
        key = frame[table.primary_key] if table.primary_key else None
        nodes.append({'name': table.name, 'row_count': len(frame), 'primary_key': table.primary_key,
                      'primary_key_unique': bool(key.dropna().map(identity).is_unique and not key.isna().any()) if key is not None else None})
        for fk in table.foreign_keys:
            parent = frames.get(fk.reference_table)
            if parent is None or fk.reference_column not in parent or fk.column not in frame:
                raise ValueError('A declared relationship refers to a missing table or column.')
            parent_keys, child_keys = parent[fk.reference_column], frame[fk.column]
            parent_ids = parent_keys.dropna().map(identity)
            child_ids = child_keys.dropna().map(identity)
            unique = bool(parent_ids.is_unique and not parent_keys.isna().any())
            nulls = int(child_keys.isna().sum())
            orphan = int((~child_ids.isin(parent_ids)).sum())
            matched = child_ids[child_ids.isin(parent_ids)]
            counts = matched.value_counts()
            per_parent = parent_ids.map(counts).fillna(0)
            minimum = int(per_parent.min()) if len(per_parent) else None
            maximum = int(per_parent.max()) if len(per_parent) else None
            cardinality = ('1:1' if maximum == 1 else '1:N') if unique and not orphan and len(matched) else None
            bounds_ok = ((fk.min_children is None or minimum is not None and minimum >= fk.min_children) and
                         (fk.max_children is None or maximum is not None and maximum <= fk.max_children))
            cardinality_ok = fk.cardinality != '1:1' or maximum is not None and maximum <= 1
            links.append({'parent_table': fk.reference_table, 'parent_column': fk.reference_column,
                          'child_table': table.name, 'child_column': fk.column,
                          'declared_cardinality': fk.cardinality, 'cardinality': cardinality,
                          'matched_rows': len(matched), 'orphan_rows': orphan, 'null_rows': nulls,
                          'parent_key_unique': unique, 'min_children': minimum, 'max_children': maximum,
                          'verified': bool(unique and not orphan and bounds_ok and cardinality_ok)})
    return {'tables': nodes, 'links': links,
            'keys_verified': all(t['primary_key_unique'] is True for t in nodes),
            'links_verified': all(link['verified'] for link in links)}
