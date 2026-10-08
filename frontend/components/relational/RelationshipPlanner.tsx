import React, { useEffect, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { api } from '../../services/api';
import { EntityMapping } from '../../types';
import styles from './RelationshipPlanner.module.css';

const button = 'rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium disabled:opacity-40';

export function RelationshipPlanner() {
  const { datasetSpec, generatedSnapshot, generatedRowCount, relationshipProposal: proposal,
    relationshipResult: result, isAnalyzingRelationships: busy, analyzeRelationships,
    acceptRelationships, reportError } = useStudio();
  const [selected, setSelected] = useState<string[]>([]);
  const [clarification, setClarification] = useState('');
  const [manual, setManual] = useState<EntityMapping[]>([]);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [attributes, setAttributes] = useState<string[]>([]);
  const [tableIndex, setTableIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const columns = datasetSpec?.tables[0]?.columns.map(c => c.name) || [];
  const table = result?.tables[tableIndex];

  useEffect(() => { setSelected(proposal?.entities.filter(e => e.valid && e.entity_count < proposal.row_count).map(e => e.key) || []); }, [proposal]);
  useEffect(() => { setTableIndex(0); setPage(0); }, [result]);
  useEffect(() => {
    setRows([]); setPreviewError('');
    if (!table) return;
    let cancelled = false;
    setLoading(true);
    api.fetchPreview(table.dataset_id, page * 25, 25)
      .then(value => { if (!cancelled) setRows(value.rows); })
      .catch(error => { if (!cancelled) setPreviewError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [table?.dataset_id, page]);

  const accepted = proposal?.entities.filter(e => e.valid && selected.includes(e.key))
    .map(({ name, key, columns }) => ({ name, key, columns })) || [];
  const refine = () => analyzeRelationships(clarification, [...(datasetSpec?.tabular_entities || []).map(({ name, key, columns }) => ({ name, key, columns })), ...manual]);

  return <div className={styles.planner}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-xl font-semibold">Relationships from your data</h2>
        <p className="text-sm text-gray-600">{generatedRowCount.toLocaleString()} generated rows · {datasetSpec?.tables[0]?.name}. AI suggests meanings; every dependency is checked against the full dataset.</p></div>
      <button className={button} disabled={!generatedSnapshot || busy} onClick={() => void refine()}>
        {busy ? 'Checking relationships…' : proposal ? 'Analyze again' : 'Analyze relationships'}</button>
    </div>
    {!generatedSnapshot && <p>Generate tabular data first.</p>}
    {proposal && !result && <>
      <p className="text-sm text-gray-600">AI: {proposal.ai_status}. Review the identifying column and fields belonging to each entity. Other fields stay in {datasetSpec?.tables[0]?.name}.</p>
      <div className="space-y-3">{proposal.entities.map(entity => <label key={entity.key} className="block rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3"><input type="checkbox" aria-label={`Include ${entity.name}`} disabled={!entity.valid || busy}
          checked={selected.includes(entity.key)} onChange={event => setSelected(previous => event.target.checked ? [...previous, entity.key] : previous.filter(k => k !== entity.key))} />
          <strong>{entity.name}</strong><span className="text-sm">{entity.entity_count} entities · 1 {entity.name} → {entity.cardinality === '1:1' ? '1' : 'many'} source records</span></div>
        <p className="mt-2 text-sm">Key: {entity.key} → {entity.columns.join(', ')}</p>
        <p className={`mt-1 text-sm ${entity.valid ? 'text-gray-600' : 'text-amber-700'}`}>{entity.valid ? entity.evidence : entity.reason}</p>
        <p className="text-xs text-gray-500">Suggested by {entity.origin} · checked over {proposal.row_count} rows</p>
      </label>)}</div>
      {!!accepted.length && <div className="rounded-lg bg-gray-50 p-3 text-sm">
        <p>{datasetSpec?.tables[0]?.name} keeps {columns.filter(c => !accepted.some(e => e.columns.includes(c))).join(', ')}.</p>
        <p>A row key is added if no existing column uniquely identifies each record. Every original row and value is retained.</p>
      </div>}
      {proposal.questions.length > 0 && <div className="rounded-lg bg-amber-50 p-4 text-sm"><ul className="list-disc pl-5">{proposal.questions.map((question, i) => <li key={i}>{question}</li>)}</ul></div>}
      <label className="block text-sm">Explain the entities or resolve a question
        <textarea className="mt-2 w-full rounded-lg border border-gray-200 p-3" value={clarification} maxLength={2000} onChange={e => setClarification(e.target.value)} placeholder="For example: person_code identifies a student; student_name belongs to that student." /></label>
      <details className="rounded-lg border border-gray-200 p-4"><summary className="cursor-pointer text-sm font-medium">Map an entity yourself</summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm">Entity name<input className="ml-3 rounded border p-2" value={name} maxLength={64} onChange={e => setName(e.target.value)} placeholder="Students" /></label>
          <label className="block text-sm">Identifying column<select className="ml-3 rounded border p-2" value={key} onChange={e => { setKey(e.target.value); setAttributes(previous => previous.filter(c => c !== e.target.value)); }}><option value="">Choose a column</option>{columns.map(c => <option key={c}>{c}</option>)}</select></label>
          <fieldset><legend className="text-sm">Fields belonging to this entity</legend><div className="mt-2 flex flex-wrap gap-3">{columns.filter(c => c !== key).map(c => <label key={c} className="text-sm"><input className="mr-1" type="checkbox" checked={attributes.includes(c)} onChange={e => setAttributes(previous => e.target.checked ? [...previous, c] : previous.filter(a => a !== c))} />{c}</label>)}</div></fieldset>
          <button className={button} disabled={!name || !key || !attributes.length || busy} onClick={() => {
            if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) { reportError({ message: 'Use letters, numbers or underscores in the entity name, starting with a letter.' }); return; }
            const mappings = [...manual.filter(e => e.key !== key), { name, key, columns: attributes }];
            setManual(mappings); void analyzeRelationships(clarification, mappings);
          }}>Check mapping against all rows</button>
        </div>
      </details>
      <div className="flex flex-wrap gap-3"><button className={button} disabled={busy} onClick={() => void refine()}>Refine suggestions</button>
        <button className={`${button} bg-gray-900 text-white`} disabled={busy || !accepted.length || accepted.length > 19} onClick={() => void acceptRelationships(accepted)}>Accept mappings and split tables</button></div>
    </>}
    {result && <>
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm">
        <strong>Verified: joining these tables reproduces all {result.integrity.source_rows} source rows.</strong>
        <p>Primary keys are unique · {result.integrity.orphan_foreign_keys} orphan foreign keys{result.integrity.surrogate_key ? ` · added row key: ${result.integrity.surrogate_key}` : ''}.</p>
      </div>
      <div className="flex flex-wrap gap-2">{result.tables.map((t, index) => <button key={t.name} className={`${button} ${index === tableIndex ? 'bg-gray-900 text-white' : ''}`} onClick={() => { setTableIndex(index); setPage(0); }}>{t.name} ({t.row_count})</button>)}</div>
      {table && <>
        <p className="text-sm">Primary key: {table.primary_key}. {(table.foreign_keys || []).map(fk => `${table.name}.${fk.column} → ${fk.reference_table}.${fk.reference_column} (1 parent → ${fk.cardinality === '1:1' ? '1 child' : 'many children'})`).join(' · ')}</p>
        <div className="flex gap-3 text-sm"><a href={api.getExportUrl('csv', table.dataset_id)}>Download full CSV</a><a href={api.getExportUrl('json', table.dataset_id)}>Download full JSON</a></div>
        {previewError ? <p role="alert" className="text-red-700">{previewError}</p> : loading ? <p>Loading rows…</p> : <div className="overflow-x-auto rounded-lg border border-gray-200"><table className="w-full text-sm"><thead><tr>{table.columns.map(c => <th key={c.name} className="whitespace-nowrap bg-gray-50 p-3 text-left">{c.name}</th>)}</tr></thead><tbody>{rows.map((row, i) => <tr key={i}>{table.columns.map(c => <td key={c.name} className="whitespace-nowrap border-t p-3">{row[c.name] == null ? 'null' : String(row[c.name])}</td>)}</tr>)}</tbody></table></div>}
        <div className="flex items-center gap-3"><button className={button} disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Previous</button><span className="text-sm">Page {page + 1} of {Math.max(1, Math.ceil(table.row_count / 25))} · {table.row_count} total rows</span><button className={button} disabled={(page + 1) * 25 >= table.row_count || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
      </>}
    </>}
  </div>;
}
