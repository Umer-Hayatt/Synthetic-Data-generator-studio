import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { api } from '../../services/api';
import styles from './RelationshipPlanner.module.css';

const button = 'rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium disabled:opacity-40';
const failureMessages: Record<string, string> = {
  no_key: 'AI is not configured on the server.',
  auth_failed: 'The AI provider rejected the server credentials.',
  rate_limited: 'The AI provider has reached its request limit.',
  invalid_request: 'The AI provider rejected the model request.',
  model_unavailable: 'The configured AI model is unavailable.',
  invalid_output: 'AI returned an unreadable model.',
  timeout: 'AI took too long to respond.',
  network_error: 'The server could not reach AI.',
  unavailable: 'The AI provider is temporarily unavailable.',
};

export function RelationshipPlanner() {
  const { datasetSpec, generatedSnapshot, generatedRowCount, relationshipProposal: proposal,
    relationshipResult: result, isAnalyzingRelationships: busy, buildRelationships } = useStudio();
  const attempted = useRef<string | null>(null);
  const [tableIndex, setTableIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const table = result?.tables[tableIndex];

  useEffect(() => {
    if (!generatedSnapshot || proposal || result || busy || attempted.current === generatedSnapshot.datasetId) return;
    attempted.current = generatedSnapshot.datasetId;
    void buildRelationships();
  }, [generatedSnapshot, proposal, result, busy, buildRelationships]);
  useEffect(() => { setTableIndex(0); setPage(0); }, [result]);
  useEffect(() => {
    setRows([]); setPreviewError(''); setLoading(false);
    if (!table) return;
    let cancelled = false;
    setLoading(true);
    api.fetchPreview(table.dataset_id, page * 25, 25)
      .then(value => { if (!cancelled) setRows(value.rows); })
      .catch(error => { if (!cancelled) setPreviewError(error.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [table?.dataset_id, page]);

  return <div className={styles.planner}>
    <div>
      <div><h2>Relationships from your data</h2>
        <p>{generatedRowCount.toLocaleString()} generated rows · {datasetSpec?.tables[0]?.name}</p></div>
      <button className={button} disabled={!generatedSnapshot || busy} onClick={() => void buildRelationships()}>
        {busy ? 'AI is building the model…' : proposal ? 'Build again' : 'Build relationships'}</button>
    </div>
    {!generatedSnapshot && <p>Generate tabular data first.</p>}
    {busy && <p role="status">AI is finding entities and checking their relationships against every row.</p>}
    {proposal && <div className={result ? 'bg-gray-50' : 'bg-amber-50'} role={result ? 'status' : 'alert'}>
      <strong>{proposal.status === 'single_table' ? 'This data belongs in one table.' :
        result ? `AI built ${result.tables.length} connected tables.` : 'The model could not be built.'}</strong>
      {proposal.status === 'unavailable' && <p>{failureMessages[proposal.ai_status] || failureMessages.unavailable}</p>}
      <p>{proposal.explanation}</p>
      {!result && <p>Your tabular data is retained. Use Build again to retry.</p>}
    </div>}
    {result && <>
      <div className="flex">
        {result.tables.map((t, index) => <button key={t.name} className={`${button} ${index === tableIndex ? 'bg-gray-900 text-white' : ''}`}
          aria-pressed={index === tableIndex} onClick={() => { setTableIndex(index); setPage(0); }}>{t.name} ({t.row_count.toLocaleString()})</button>)}
      </div>
      <details><summary>Relationships and data checks</summary>
        <p>Verified across all {result.integrity.source_rows.toLocaleString()} source rows: every original value and duplicate is preserved.</p>
        <p>Primary keys are unique · {result.integrity.orphan_foreign_keys} orphan foreign keys{result.integrity.surrogate_key ? ` · added row key: ${result.integrity.surrogate_key}` : ''}.</p>
        {result.tables.map(t => <div key={t.name}>
          <p><strong>{t.name}</strong> · primary key: {t.primary_key}</p>
          {(t.foreign_keys || []).map(fk => <p key={fk.column}>{t.name}.{fk.column} → {fk.reference_table}.{fk.reference_column}
            {' '}({fk.cardinality === '1:1' ? 'one parent to one child' : 'one parent to many children'})</p>)}
        </div>)}
      </details>
      {table && <>
        <div className="flex"><a href={api.getExportUrl('csv', table.dataset_id)}>Download full CSV</a>
          <a href={api.getExportUrl('json', table.dataset_id)}>Download full JSON</a></div>
        {previewError ? <p role="alert" className="text-red-700">{previewError}</p> : loading ? <p>Loading rows…</p> :
          <div className="overflow-x-auto"><table><thead><tr>{table.columns.map(c => <th key={c.name} scope="col">{c.name}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>{table.columns.map(c => <td key={c.name}>{row[c.name] == null ? 'null' : String(row[c.name])}</td>)}</tr>)}</tbody></table></div>}
        <div className="flex"><button className={button} disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Previous</button>
          <span>Page {page + 1} of {Math.max(1, Math.ceil(table.row_count / 25))} · {table.row_count.toLocaleString()} total rows</span>
          <button className={button} disabled={(page + 1) * 25 >= table.row_count || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
      </>}
    </>}
  </div>;
}
