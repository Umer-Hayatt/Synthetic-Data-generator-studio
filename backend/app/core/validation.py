"""Validate source-fitted output against the accepted specification."""
import numpy as np
import pandas as pd


def validate_frame(frame, table):
    if len(frame) != table.row_count or list(frame.columns) != [c.name for c in table.columns]:
        raise ValueError('Generated shape differs from accepted specification.')
    for column in table.columns:
        values = frame[column.name]
        if (not column.nullable or column.constraints.unique or column.name == table.primary_key) and values.isna().any():
            raise ValueError('Generated nulls violate accepted constraints.')
        if column.constraints.unique and not values.is_unique:
            raise ValueError('Generated duplicates violate accepted constraints.')
        observed = values.dropna()
        if column.dtype in ('integer','float'):
            numeric = pd.to_numeric(observed,errors='raise')
            if not np.isfinite(numeric.astype(float)).all():
                raise ValueError('Generated numeric values are not finite.')
            if column.dtype == 'integer' and (numeric % 1 != 0).any():
                raise ValueError('Generated values violate integer dtype.')
            if column.constraints.min is not None and (numeric < column.constraints.min).any():
                raise ValueError('Generated values violate lower bound.')
            if column.constraints.max is not None and (numeric > column.constraints.max).any():
                raise ValueError('Generated values violate upper bound.')
        elif column.dtype == 'datetime':
            pd.to_datetime(observed, errors='raise', utc=True)
        elif column.dtype == 'boolean' and not observed.map(lambda v:isinstance(v,(bool,np.bool_))).all():
            raise ValueError('Generated values violate boolean dtype.')
        elif column.dtype == 'string' and not observed.map(lambda v:isinstance(v,str)).all():
            raise ValueError('Generated values violate string dtype.')
        if column.constraints.categories and not observed.isin(column.constraints.categories).all():
            raise ValueError('Generated values violate accepted categories.')
