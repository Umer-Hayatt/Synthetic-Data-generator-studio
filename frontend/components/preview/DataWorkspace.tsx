import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { api } from '../../services/api';
import { TableSpec } from '../../types';
import { displayLabel, displayType, displayMessage } from '../../services/displayLabels';
import styles from '../layout/Workspace.module.css';

type ViewTable = TableSpec & { dataset_id?: string; storage: 'frame' | 'artifact' };
const failures: Record<string, string> = {
  no_key: 'AI is not configured.', auth_failed: 'AI authentication failed.', rate_limited: 'AI has reached its request limit.',
  timeout: 'AI took too long to respond.', network_error: 'The server could not reach AI.',
  invalid_output: 'AI could not return a valid model.', model_unavailable: 'The AI model is unavailable.',
  invalid_request: 'The AI provider rejected the model request.',
};

export function DataWorkspace() {
  const { datasetSpec, generatedSnapshot, generatedRowCount, activeSource, tableArtifactMap,
    relationshipResult: result, relationshipProposal: proposal, isAnalyzingRelationships: busy,
    buildRelationships, isGenerating, referencePreview, referenceRowCount, error } = useStudio();
  const attempted = useRef<string | null>(null);
  const [tableName, setTableName] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [knownCounts, setKnownCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [reload, setReload] = useState(0);
  const [useOriginal, setUseOriginal] = useState(false);
  const [filter, setFilter] = useState<{ column: string; value: unknown; from: string } | undefined>();
  const tables = useMemo<ViewTable[]>(() => {
    if (!useOriginal && result) return result.tables.map(t => ({ ...t, storage: 'frame' }));
    return (datasetSpec?.tables || []).map((t, index) => ({ ...t,
      row_count: index === 0 ? generatedRowCount : t.row_count,
      dataset_id: tableArtifactMap[t.name] || (index === 0 ? generatedSnapshot?.datasetId : undefined),
      storage: tableArtifactMap[t.name] || generatedSnapshot?.storage === 'artifact' ? 'artifact' : 'frame',
    }));
  }, [datasetSpec, generatedRowCount, generatedSnapshot, result, tableArtifactMap, useOriginal]);
  const table = tables.find(t => t.name === tableName) || tables[0];

  useEffect(() => {
    if (!generatedSnapshot || datasetSpec?.tables.length !== 1 || activeSource?.kind === 'demo' ||
      result || proposal || busy || attempted.current === generatedSnapshot.datasetId) return;
    attempted.current = generatedSnapshot.datasetId;
    void buildRelationships();
  }, [generatedSnapshot, datasetSpec, activeSource, result, proposal, busy, buildRelationships]);
  useEffect(() => { setTableName(''); setPage(0); setFilter(undefined); }, [result, useOriginal]);
  useEffect(() => {
    setRows([]); setTotal(0); setPreviewError(''); setLoading(false);
    if (!table?.dataset_id) return;
    let cancelled = false;
    setLoading(true);
    const request = table.storage === 'artifact' ? api.getArtifactPage(table.dataset_id, page * 25, 25, filter) :
      api.fetchPreview(table.dataset_id, page * 25, 25, filter);
    request.then(value => {
      if (cancelled) return;
      setRows(value.rows); setTotal(value.row_count);
      setKnownCounts(current => ({ ...current, [table.dataset_id!]: value.total_row_count ?? value.row_count }));
    }).catch(error => { if (!cancelled) setPreviewError(error.message || 'Preview failed. Retry or download the complete table.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [table?.dataset_id, table?.storage, page, filter, reload]);

  const select = (name: string) => { setTableName(name); setPage(0); setFilter(undefined); };
  const csv = table?.dataset_id ? table.storage === 'artifact' ? api.getArtifactExportUrl('csv', table.dataset_id) :
    api.getExportUrl('csv', table.dataset_id) : undefined;
  const json = table?.dataset_id ? table.storage === 'artifact' ? api.getArtifactExportUrl('jsonl', table.dataset_id) :
    api.getExportUrl('json', table.dataset_id) : undefined;
  const outgoing = table?.foreign_keys?.filter(fk => tables.some(t => t.name === fk.reference_table)) || [];
  const incoming = tables.flatMap(t => (t.foreign_keys || []).filter(fk => fk.reference_table === table?.name)
    .map(fk => ({ child: t.name, ...fk })));

  return <section className={styles.tableSection} aria-label="Generated data">
    <div className={styles.tableToolbar}>
      {tables.length > 1 ? <div className={styles.tableChoices} role="group" aria-label="Generated tables">
        {tables.map(t => {
          const count = !generatedSnapshot ? undefined : t.storage === 'frame' ? t.row_count :
            t.dataset_id ? knownCounts[t.dataset_id] : undefined;
          return <button key={t.name} className={table?.name === t.name ? styles.selected : ''}
            aria-pressed={table?.name === t.name} onClick={() => select(t.name)}>{displayLabel(t.name)}{count === undefined ? '' : ` (${count.toLocaleString()})`}</button>;
        })}
      </div> : <h2>{displayLabel(table?.name || 'Data')}</h2>}
      {csv && <div className={styles.downloads}><a href={csv}>Download Full CSV</a>
        <a href={json}>Download Full {table?.storage === 'artifact' ? 'JSONL' : 'JSON'}</a></div>}
    </div>
    {generatedSnapshot && (outgoing.length > 0 || incoming.length > 0) && <section className={styles.connections} aria-label="Linked Records">
      <h3>Linked Records</h3>
      <ul className={styles.connectionList}>
      {outgoing.map(fk => <li key={fk.column}><strong>{displayLabel(table!.name)} <span aria-hidden="true">→</span> {displayLabel(fk.reference_table)}</strong>
        <p>Each row links to one record. Select a linked <strong>{displayLabel(fk.column)}</strong> below to open it.</p></li>)}
      {incoming.map(fk => <li key={`${fk.child}.${fk.column}`}><strong>{displayLabel(table!.name)} <span aria-hidden="true">→</span> {displayLabel(fk.child)}</strong>
        <p>Each record can have {fk.cardinality === '1:1' ? 'one linked row' : 'multiple linked rows'}.
        {' '}Open <button onClick={() => select(fk.child)}>{displayLabel(fk.child)}</button> to explore them.</p></li>)}
      </ul>
    </section>}
    {busy && <p className={styles.modelStatus} role="status">Checking for linked tables… Your generated rows are ready below.</p>}
    {proposal && !result && <div className={styles.notice} role="alert">
      <p>{failures[proposal.ai_status] || proposal.explanation || 'The relationship model could not be built.'} Your generated data is retained.</p>
      <button disabled={busy} onClick={() => void buildRelationships()}>Retry Relationships</button>
    </div>}
    {generatedSnapshot && !busy && !proposal && !result && error && <div className={styles.notice} role="alert">
      <p>The table model could not be checked. Your generated data is retained.</p>
      <button onClick={() => void buildRelationships()}>Retry Relationships</button>
    </div>}
    {filter && <div className={styles.filterStatus}><span>{displayLabel(table?.name || 'Data')}: {displayLabel(filter.column)} = {String(filter.value)}</span>
      <button onClick={() => select(filter.from)}>Back to {displayLabel(filter.from)}</button>
      <button onClick={() => { setFilter(undefined); setPage(0); }}>Show All Records</button></div>}
    {!generatedSnapshot ? <div className={styles.empty} role="status">{isGenerating ? 'Generating your data…' : 'Generate data to see the table.'}</div> :
      previewError ? <div className={styles.notice} role="alert"><p>{displayMessage(previewError)}</p>
        <button onClick={() => setReload(value => value + 1)}>Reload Table</button></div> :
      loading ? <p className={styles.empty} role="status">Loading rows…</p> :
      <div className={styles.tableScroll} tabIndex={0} aria-label={`${displayLabel(table?.name || 'Data')} Rows`}>
        <table className={styles.table}><thead><tr>{table?.columns.map(c => <th key={c.name} scope="col">{displayLabel(c.name)}
          <span className={styles.columnType}>{displayType(c.dtype)}{table.primary_key === c.name ? ' · Unique ID' :
            outgoing.some(fk => fk.column === c.name) ? ' · Linked ID' : ''}</span></th>)}</tr></thead>
          <tbody>{rows.map((row, index) => <tr key={index}>{table?.columns.map(c => {
            const value = row[c.name];
            const fk = table.foreign_keys?.find(link => link.column === c.name && tables.some(t => t.name === link.reference_table));
            return <td key={c.name}>{fk && value != null ? <button className={styles.keyLink}
              aria-label={`Open ${displayLabel(fk.reference_table)} record for ${displayLabel(c.name)} ${String(value)}`}
              onClick={() => { setTableName(fk.reference_table); setPage(0);
                setFilter({ column: fk.reference_column, value, from: table.name }); }}>{String(value)}</button> :
              value == null ? <span className={styles.null}>—</span> : String(value)}</td>;
          })}</tr>)}{!rows.length && <tr><td colSpan={table?.columns.length || 1}>No records match this view.</td></tr>}</tbody>
        </table>
      </div>}
    {table?.dataset_id && !previewError && <div className={styles.pagination}>
      <span>{loading ? 'Loading…' : `${total ? page * 25 + 1 : 0}–${Math.min((page + 1) * 25, total)} of ${total.toLocaleString()} ${filter ? 'matching' : 'total'} rows`}</span>
      <div><button disabled={!page || loading} onClick={() => setPage(p => p - 1)}>Previous</button>
        <span>Page {page + 1} of {Math.max(1, Math.ceil(total / 25))}</span>
        <button disabled={(page + 1) * 25 >= total || loading} onClick={() => setPage(p => p + 1)}>Next</button></div>
    </div>}
    {result && <details className={styles.relationshipDetails}><summary>Model Details & Original Data</summary>
      <p>{proposal?.explanation}</p>
      {result.tables.map(t => <div key={t.name}>{t.foreign_keys?.map(fk => <p key={fk.column}>
        <strong>{displayLabel(t.name)} · {displayLabel(fk.column)}</strong> → <strong>{displayLabel(fk.reference_table)} · {displayLabel(fk.reference_column)}</strong>.
        {fk.min_children != null && fk.max_children != null && <> Observed: {fk.min_children}–{fk.max_children} linked rows per {displayLabel(fk.reference_table)} record.</>}</p>)}</div>)}
      <p>{result.integrity.primary_keys_unique ? 'Keys are unique.' : 'Duplicate keys detected.'} {result.integrity.orphan_foreign_keys} broken links.
        {' '}{result.integrity.lossless ? 'All original rows and values are preserved.' : 'Source preservation failed.'}</p>
      <button onClick={() => { setUseOriginal(value => !value); setPage(0); }}>{useOriginal ? 'Show Linked Tables' : 'Original Snapshot'}</button>
    </details>}
    {referenceRowCount > 0 && <details className={styles.relationshipDetails}><summary>Original Reference Sample</summary>
      <p>{referencePreview.length} cached rows from {referenceRowCount.toLocaleString()} reference rows.</p>
      <div className={styles.tableScroll}><table className={styles.table}><thead><tr>{Object.keys(referencePreview[0] || {}).map(c => <th key={c}>{displayLabel(c)}</th>)}</tr></thead>
        <tbody>{referencePreview.map((row, i) => <tr key={i}>{Object.keys(referencePreview[0] || {}).map(c => <td key={c}>{String(row[c] ?? 'null')}</td>)}</tr>)}</tbody></table></div>
    </details>}
  </section>;
}
