"""Reviewable entity mappings; evidence is computed from complete generated rows."""
from typing import Literal
from pydantic import Field, model_validator
from app.models.spec import Model
from app.models.spec import ForeignKey


class EntityMapping(Model):
    name: str = Field(min_length=1, max_length=64, pattern=r'^[A-Za-z][A-Za-z0-9_]*$')
    key: str = Field(min_length=1, max_length=128)
    columns: list[str] = Field(default_factory=list, max_length=200)

    @model_validator(mode='after')
    def distinct_columns(self):
        if self.key in self.columns or len(set(self.columns)) != len(self.columns):
            raise ValueError('Entity attributes must be distinct and exclude the key.')
        return self


class AnalysisRequest(Model):
    dataset_id: str = Field(min_length=1, max_length=128)
    storage: Literal['frame', 'artifact'] = 'frame'
    source_table: str = Field(default='Records', min_length=1, max_length=128)
    prompt: str = Field(default='', max_length=12000)
    clarification: str = Field(default='', max_length=2000)
    entities: list[EntityMapping] = Field(default_factory=list, max_length=19)


class NormalizeRequest(AnalysisRequest):
    accepted: bool = False


class InspectionTable(Model):
    name: str = Field(min_length=1, max_length=128)
    dataset_id: str = Field(min_length=1, max_length=128)
    primary_key: str | None = None
    foreign_keys: list[ForeignKey] = Field(default_factory=list, max_length=200)


class RelationshipInspection(Model):
    source_dataset_id: str = Field(min_length=1, max_length=128)
    storage: Literal['frame', 'artifact'] = 'frame'
    source_storage: Literal['frame', 'artifact'] | None = None
    manifest_id: str | None = None
    tables: list[InspectionTable] = Field(min_length=1, max_length=20)

    @model_validator(mode='after')
    def distinct_tables(self):
        if len({t.name for t in self.tables}) != len(self.tables):
            raise ValueError('Inspection table names must be distinct.')
        if self.storage == 'artifact' and len(self.tables) > 1 and not self.manifest_id:
            raise ValueError('Multi-table artifact inspection requires its generated manifest.')
        return self


class EntitySuggestions(Model):
    entities: list[EntityMapping] = Field(default_factory=list, max_length=19)
    questions: list[str] = Field(default_factory=list, max_length=5)

    @classmethod
    def model_json_schema(cls, *args, **kwargs):
        # Provider schema uses basic supported types. Canonical bounds, names,
        # distinct columns and extra-field checks still run on every AI response.
        return {'type': 'object', 'properties': {
            'entities': {'type': 'array', 'items': {'type': 'object', 'properties': {
                'name': {'type': 'string'}, 'key': {'type': 'string'},
                'columns': {'type': 'array', 'items': {'type': 'string'}}},
                'required': ['name', 'key', 'columns']}},
            'questions': {'type': 'array', 'items': {'type': 'string'}}},
            'required': ['entities', 'questions']}


class RelationshipPlan(Model):
    entities: list[EntityMapping] = Field(default_factory=list, max_length=19)
    explanation: str = Field(min_length=1, max_length=2000)

    @classmethod
    def model_json_schema(cls, *args, **kwargs):
        return {'type': 'object', 'properties': {
            'entities': EntitySuggestions.model_json_schema()['properties']['entities'],
            'explanation': {'type': 'string'}}, 'required': ['entities', 'explanation']}
