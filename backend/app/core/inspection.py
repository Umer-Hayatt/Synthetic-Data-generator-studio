"""Parse exact scalar filters for generated table inspection."""
import json
import math


def scalar_filter(column, value):
    if column is None and value is None:
        return None
    if not column or value is None:
        raise ValueError('Provide both filter_column and a JSON scalar filter_value.')
    try:
        parsed = json.loads(value)
    except (ValueError, TypeError):
        raise ValueError('filter_value must be a JSON scalar.') from None
    if isinstance(parsed, (list, dict)) or isinstance(parsed, float) and not math.isfinite(parsed):
        raise ValueError('filter_value must be a finite JSON scalar.')
    return parsed
