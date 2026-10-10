import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitBranch, ArrowUpRight } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { api } from '../../services/api';
import { displayLabel, displayMessage, relationshipStatusMessage } from '../../services/displayLabels';
import type { RelationshipInspectionInput, RelationshipInspectionResult } from '../../types';
import styles from '../layout/Workspace.module.css';

function RelationshipMap({ inspection, onInspectTable }: {
  inspection: RelationshipInspectionResult; onInspectTable: (name: string) => void;
}) {
  // Longest parent path determines columns; disconnected tables remain visible.
  const levels = new Map(inspection.tables.map(t => [t.name, 0]));
  for (let pass = 0; pass < inspection.tables.length; pass++) {
    let changed = false;
    for (const link of inspection.links) {
      const next = (levels.get(link.parent_table) || 0) + 1;
      if (next > (levels.get(link.child_table) || 0)) { levels.set(link.child_table, next); changed = true; }
    }
    if (!changed) break;
  }
  // Cyclic input remains inspectable, without an unbounded layout.
  if (Array.from(levels.values()).some(level => level >= inspection.tables.length)) {
    inspection.tables.forEach((t, index) => levels.set(t.name, index % 3));
  }
  const lanes = new Map<number, number>();
  const nodes = inspection.tables.map(table => {
    const level = levels.get(table.name) || 0, lane = lanes.get(level) || 0;
    lanes.set(level, lane + 1);
    return { ...table, x: 30 + level * 290, y: 50 + lane * 135 };
  });
  const width = Math.max(570, ...nodes.map(node => node.x + 240));
  const height = Math.max(210, ...nodes.map(node => node.y + 130));
  return <div className={styles.relationshipMap} tabIndex={0} aria-label="Relationship map; scroll to explore all tables">
    <div className={styles.graphCanvas} style={{ width, height }}>
      <svg width={width} height={height} aria-hidden="true">
        <defs><marker id="relation-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="context-stroke" />
        </marker></defs>
        {inspection.links.map((link, index) => {
          const parent = nodes.find(n => n.name === link.parent_table)!, child = nodes.find(n => n.name === link.child_table)!;
          const x1 = parent.x + 200, y1 = parent.y + 38, x2 = child.x, y2 = child.y + 38;
          const middle = (x1 + x2) / 2;
          return <g key={`${link.child_table}.${link.child_column}`}>
            <path d={`M ${x1} ${y1} C ${middle} ${y1}, ${middle} ${y2}, ${x2} ${y2}`}
              fill="none" stroke={link.verified ? 'var(--accent)' : 'var(--error)'} strokeWidth="1.5"
              strokeDasharray={link.verified ? undefined : '5 4'} markerEnd="url(#relation-arrow)" />
            <text x={middle} y={(y1 + y2) / 2 - 10 - (index % 2) * 14} textAnchor="middle" className={styles.edgeLabel}>
              {link.verified ? link.cardinality || 'No linked rows' : 'Check failed'}
            </text>
          </g>;
        })}
      </svg>
      {nodes.map(node => <button key={node.name} className={styles.graphNode} style={{ left: node.x, top: node.y }}
        onClick={() => onInspectTable(node.name)} aria-label={`Inspect ${displayLabel(node.name)}; ${node.row_count.toLocaleString()} rows`}>
        <strong>{displayLabel(node.name)} <ArrowUpRight size={13} /></strong>
        <span>{node.row_count.toLocaleString()} rows</span>
      </button>)}
    </div>
  </div>;
}

export function RelationshipsWorkspace({ onInspectTable }: { onInspectTable: (name: string) => void }) {
  const { datasetSpec, generatedSnapshot, tableArtifactMap, documentManifestId, activeSource,
    relationshipResult, relationshipProposal, isAnalyzingRelationships, buildRelationships, error } = useStudio();
  const attempted = useRef<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; result?: RelationshipInspectionResult; error?: string }>({ key: '' });
  useEffect(() => {
    if (!generatedSnapshot || datasetSpec?.tables.length !== 1 || activeSource?.kind === 'demo' ||
      relationshipResult || relationshipProposal || isAnalyzingRelationships || attempted.current === generatedSnapshot.datasetId) return;
    attempted.current = generatedSnapshot.datasetId;
    void buildRelationships();
  }, [generatedSnapshot, datasetSpec, activeSource, relationshipResult, relationshipProposal, isAnalyzingRelationships, buildRelationships]);
  const input = useMemo<RelationshipInspectionInput | null>(() => {
    if (!generatedSnapshot || !datasetSpec) return null;
    const tables = relationshipResult?.tables || datasetSpec.tables;
    return { source_dataset_id: generatedSnapshot.datasetId, source_storage: generatedSnapshot.storage,
      storage: relationshipResult ? 'frame' : generatedSnapshot.storage,
      ...(relationshipResult || !documentManifestId ? {} : { manifest_id: documentManifestId }),
      tables: tables.map((t, index) => ({ name: t.name, primary_key: t.primary_key, foreign_keys: t.foreign_keys || [],
        dataset_id: relationshipResult ? relationshipResult.tables[index].dataset_id : tableArtifactMap[t.name] || generatedSnapshot.datasetId })) };
  }, [generatedSnapshot, datasetSpec, relationshipResult, tableArtifactMap, documentManifestId]);
  const key = input ? JSON.stringify(input) : '';
  useEffect(() => {
    if (!input || isAnalyzingRelationships) return;
    let cancelled = false;
    setState({ key });
    api.inspectRelationships(input).then(result => {
      if (!cancelled && result.source_dataset_id === input.source_dataset_id) setState({ key, result });
      else if (!cancelled) setState({ key, error: 'The relationship check belongs to another snapshot. Retry the check.' });
    }).catch(err => { if (!cancelled) setState({ key, error: displayMessage(err.message || 'Relationship inspection failed.') }); });
    return () => { cancelled = true; };
  }, [input, key, retry, isAnalyzingRelationships]);
  const inspection = state.key === key && !isAnalyzingRelationships ? state.result : undefined;
  const inspectionError = state.key === key ? state.error : undefined;

  return <section aria-label="Generated relationships" className={styles.tableSection}>
    <div className={styles.tableToolbar}><div><h2><GitBranch size={16} /> Relationships</h2>
      <p className={styles.relationIntro}>Select a table to inspect its records. Links and counts are checked against every generated row.</p></div></div>
    {!generatedSnapshot ? <p className={styles.empty} role="status">Generate data to explore its relationships.</p> : <>
      {isAnalyzingRelationships && <p role="status" className={styles.modelStatus}>AI is finding table relationships. Your generated records are retained.</p>}
      {!isAnalyzingRelationships && !inspection && !inspectionError && <p role="status" className={styles.modelStatus}>Checking complete generated tables…</p>}
      {inspectionError && <div role="alert" className={styles.notice}><p>{inspectionError}</p>
        <button onClick={() => setRetry(value => value + 1)}>Retry Checks</button></div>}
      {inspection && <>
        <div className={styles.relationChecks} role="status">
          <span>{inspection.tables.length} {inspection.tables.length === 1 ? 'table' : 'tables'}</span>
          <span>{inspection.links.length} {inspection.links.length === 1 ? 'relationship' : 'relationships'}</span>
          <span>{inspection.keys_verified ? 'Unique keys verified' : 'Keys need review'}</span>
          {!!inspection.links.length && <span>{inspection.links_verified ? 'Links verified' : 'Links need review'}</span>}
        </div>
        <RelationshipMap inspection={inspection} onInspectTable={onInspectTable} />
        {!inspection.links.length && <p className={styles.relationIntro}>No verified relationships are available for this snapshot. A single table can be the correct model.</p>}
        {relationshipProposal?.explanation && <p className={styles.relationIntro}>{relationshipProposal.explanation}</p>}
        <section className={styles.connections} aria-label="Relationship evidence"><h3>Generated Table Details</h3>
          <ul className={styles.connectionList}>{inspection.tables.map(t => <li key={t.name}>
            <strong>{displayLabel(t.name)}</strong><p>{t.row_count.toLocaleString()} rows · {t.primary_key ?
              `${displayLabel(t.primary_key)}: ${t.primary_key_unique ? 'unique, no missing keys' : 'duplicate or missing keys'}` : 'No identifying key configured'}</p>
          </li>)}</ul>
        </section>
        {!!inspection.links.length && <section className={styles.connections}><h3>Key Connections</h3>
          <ul className={styles.connectionList}>{inspection.links.map(link => <li key={`${link.child_table}.${link.child_column}`}>
            <strong>{displayLabel(link.parent_table)} <span>→</span> {displayLabel(link.child_table)}</strong>
            <div><p>{displayLabel(link.parent_column)} → {displayLabel(link.child_column)} · {link.verified ? 'Verified' : 'Check failed'}</p>
              <p>{link.cardinality ? `${link.cardinality} observed` : 'Cardinality not established'} · {link.matched_rows.toLocaleString()} linked rows · {link.orphan_rows} broken links · {link.null_rows} missing links</p>
              <p>{link.min_children != null ? `${link.min_children}–${link.max_children} linked rows per parent` : 'No parent records'} · {link.declared_cardinality} configured</p></div>
          </li>)}</ul>
        </section>}
        {relationshipResult && <p className={styles.relationIntro}>{relationshipResult.integrity.lossless ?
          `All ${relationshipResult.integrity.source_rows.toLocaleString()} original rows and values are preserved by exact reconstruction.` : 'Original snapshot preservation failed.'}</p>}
      </>}
      {!isAnalyzingRelationships && !relationshipResult && datasetSpec?.tables.length === 1 && activeSource?.kind !== 'demo' &&
        <div className={styles.relationshipDetails}>
          {relationshipProposal?.ai_status && relationshipProposal.ai_status !== 'available' && <p>{relationshipStatusMessage(relationshipProposal.ai_status, relationshipProposal.explanation)} Your generated data is retained.</p>}
          {!relationshipProposal && error && <p>{displayMessage(error.message)}</p>}
          <button onClick={() => void buildRelationships()}>{relationshipProposal || error ? 'Retry Relationships' : 'Find Relationships with AI'}</button>
        </div>}
    </>}
  </section>;
}
