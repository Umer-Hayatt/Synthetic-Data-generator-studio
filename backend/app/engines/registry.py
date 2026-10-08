"""Stable engine contracts; P0 generator remains the statistical implementation."""
from typing import Protocol, Literal
import numpy as np
import pandas as pd
from pydantic import Field
from app.core.config import settings
from app.core.profiling import fit_spec
from app.models.spec import DatasetSpec, Model
from app.engines.tabular import generate


class GenerationPlan(Model):
    spec: DatasetSpec
    engine: Literal['statistical', 'statistical_conditional', 'relational', 'documents', 'deep_ctgan', 'deep_tvae', 'auto'] = 'statistical'
    source_artifact: str | None = None
    batch_rows: int = Field(default=4096, ge=1, le=50000)
    accepted: bool = False


class Synthesizer(Protocol):
    def fit(self, source, **kwargs): ...
    def generate(self, row_count=None): ...
    def capabilities(self): ...
    def metadata(self): ...


class StatisticalSynthesizer:
    def __init__(self):
        self.spec, self.conditionals, self.weights = None, [], []

    def capabilities(self):
        return {'engine':'statistical', 'cpu':True, 'batched':True, 'conditional_classification':True}

    def metadata(self):
        return {'engine':'statistical', 'conditional_groups':len(self.conditionals),
                'privacy':'No formal differential privacy guarantee.'}

    def fit(self, source, target=None, seed=42):
        self.conditionals, self.weights = [], []
        if isinstance(source, DatasetSpec):
            self.spec = source
            return self
        self.spec = fit_spec(source, seed=seed)
        # Opt-in, bounded class-conditional marginals/copulas; no raw rows retained.
        if target and target in source and 1 < source[target].nunique() <= 50 and not source[target].isna().any():
            groups = list(source.groupby(target, sort=True, observed=True))
            if min(len(group) for _, group in groups) >= 5:
                self.conditionals = [fit_spec(group, seed=seed) for _, group in groups]
                self.weights = [len(group)/len(source) for _, group in groups]
        return self

    def generate(self, row_count=None):
        if self.spec is None:
            raise ValueError('Fit engine before generation.')
        n = row_count or self.spec.tables[0].row_count
        if not self.conditionals:
            spec = self.spec.model_copy(deep=True)
            spec.tables[0].row_count = n
            return generate(spec)
        rng = np.random.default_rng(self.spec.seed)
        raw = np.asarray(self.weights)*n
        counts = np.floor(raw).astype(int)
        for i in np.argsort(raw-counts)[::-1][:n-counts.sum()]: counts[i] += 1
        frames = []
        for index, (conditional, count) in enumerate(zip(self.conditionals, counts)):
            if not count: continue
            spec = conditional.model_copy(deep=True)
            spec.seed = (self.spec.seed+index) % 2**32
            spec.tables[0].row_count = int(count)
            frames.append(generate(spec))
        result = pd.concat(frames, ignore_index=True)
        return result.iloc[rng.permutation(len(result))].reset_index(drop=True)

    def generate_batches(self, batch_rows=4096):
        spec = self.spec
        if len(spec.tables) != 1:
            raise ValueError('Statistical engine requires one table.')
        table = spec.tables[0]
        batch_rows = min(batch_rows, settings.max_rows, max(1, settings.max_cells//len(table.columns)))
        if spec.tabular_entities:
            if table.row_count > settings.max_rows or table.row_count * len(table.columns) > settings.max_cells:
                raise ValueError('Declared entity dependencies require a complete snapshot within the local row/cell limits.')
            # Independent batch seeds would give the same entity different values.
            # Materialize the bounded coherent snapshot once, then serialize pages.
            frame = generate(spec)
            for offset in range(0, len(frame), batch_rows):
                yield frame.iloc[offset:offset+batch_rows]
            return
        for column in table.columns:
            if column.constraints.unique and not (column.constraints.auto_increment or column.semantic_type == 'id'):
                raise ValueError('Batched uniqueness requires ID semantics or auto_increment.')
        for offset in range(0, table.row_count, batch_rows):
            part = spec.model_copy(deep=True)
            part.seed = (spec.seed + offset//batch_rows) % 2**32
            part.tables[0].row_count = min(batch_rows, table.row_count-offset)
            for column in part.tables[0].columns:
                if column.dtype == 'integer' and (column.constraints.auto_increment or column.semantic_type == 'id'):
                    start = (int(np.ceil(column.constraints.min)) if column.constraints.min is not None else 1) + offset
                    if column.constraints.max is not None and start+part.tables[0].row_count-1 > column.constraints.max:
                        raise ValueError('ID bounds cannot satisfy total requested rows.')
                    column.constraints.min = start
            yield generate(part)


class EngineRegistry:
    def __init__(self):
        self.factories = {'statistical':StatisticalSynthesizer}

    def register(self, name, factory):
        self.factories[name] = factory

    def create(self, name):
        if name not in self.factories:
            raise ValueError('Requested engine is unavailable.')
        return self.factories[name]()


registry = EngineRegistry()
registry.register('statistical_conditional', StatisticalSynthesizer)
from app.engines.relational import RelationalSynthesizer
registry.register('relational', RelationalSynthesizer)
from app.engines.documents import DocumentSynthesizer
registry.register('documents', DocumentSynthesizer)
from app.engines.deep import DeepSynthesizer
registry.register('deep_ctgan', lambda: DeepSynthesizer('ctgan'))
registry.register('deep_tvae', lambda: DeepSynthesizer('tvae'))
