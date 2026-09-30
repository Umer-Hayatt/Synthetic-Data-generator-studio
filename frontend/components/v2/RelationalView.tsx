import React, { useState } from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, Artifact, v2Request } from '../../services/v2';

interface Props {
  spec: V2Spec;
  tableArtifacts: Record<string, string>; // table name -> artifact id
  busy: boolean;
  onGenerate?: () => void;
  onError: (msg: string) => void;
}

interface PagedPreview {
  rows: Record<string, unknown>[];
  artifactId: string;
  page: number;        // 0-indexed
  pageSize: number;
}

const PAGE_SIZE = 20;

export function RelationalView({ spec, tableArtifacts, busy, onGenerate, onError }: Props) {
  const [activeTable, setActiveTable] = useState<string>(spec.tables[0]?.name ?? '');
  const [previews, setPreviews] = useState<Record<string, PagedPreview>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const tables = spec.tables;
  const table = tables.find((t) => t.name === activeTable) ?? tables[0];
  const artifactId = table ? tableArtifacts[table.name] : undefined;
  const hasAnyGenerated = Object.keys(tableArtifacts).length > 0;

  async function loadPage(tableName: string, page: number) {
    const aid = tableArtifacts[tableName];
    if (!aid) {
      onError(`No generated data yet for table "${tableName}". Generate data first.`);
      return;
    }
    setLoading((p) => ({ ...p, [tableName]: true }));
    try {
      const artifact = await v2Request<Artifact>(`/artifacts/${aid}?preview_rows=${PAGE_SIZE}`);
      const rows = artifact.preview ?? [];
      setPreviews((p) => ({
        ...p,
        [tableName]: {
          rows,
          artifactId: aid,
          page,
          pageSize: PAGE_SIZE,
        },
      }));
    } catch (err) {
      onError(err instanceof Error ? err.message : `Preview failed for "${tableName}".`);
    } finally {
      setLoading((p) => ({ ...p, [tableName]: false }));
    }
  }

  const preview = table ? previews[table.name] : undefined;
  const isLoading = table ? loading[table.name] : false;

  // Collect all relationships in spec
  const allRelationships = tables.flatMap((t) =>
    (t.foreign_keys ?? []).map((fk) => ({
      childTable: t.name,
      childCol: fk.column,
      parentTable: fk.reference_table,
      parentCol: fk.reference_column,
      cardinality: fk.cardinality || '1:N',
      minChildren: fk.min_children,
    }))
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Table switcher with row count chips */}
      <div>
        <p style={{ fontSize: 'var(--text-caption-size)', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
          Tables ({tables.length})
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tables.map((t) => {
            const isSelected = t.name === (table?.name ?? '');
            const hasData = !!tableArtifacts[t.name];
            return (
              <button
                key={t.name}
                onClick={() => setActiveTable(t.name)}
                disabled={busy}
                style={{
                  padding: '6px 14px',
                  borderRadius: 20,
                  border: `1px solid ${isSelected ? 'var(--synth)' : 'var(--border-default)'}`,
                  background: isSelected ? 'var(--synth-soft)' : 'var(--bg-1)',
                  color: isSelected ? 'var(--synth)' : 'var(--text-body)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: isSelected ? 600 : 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all 0.15s ease',
                  margin: 0,
                }}
              >
                <span>{t.name}</span>
                <span
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isSelected ? 'var(--synth)' : 'var(--bg-2)',
                    color: isSelected ? '#ffffff' : 'var(--text-muted)',
                    fontWeight: 400,
                  }}
                >
                  {t.row_count.toLocaleString()} rows
                </span>
                {hasData && (
                  <span style={{ fontSize: 10, color: 'var(--synth)' }}>✓</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Relationship Map & Integrity Badges */}
      <div
        style={{
          padding: 16,
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          background: 'var(--bg-2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
          <p style={{ fontSize: 'var(--text-card-title)', fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
            Relationship map & integrity
          </p>

          {/* Integrity Badges */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                background: hasAnyGenerated ? 'var(--success-bg)' : 'var(--bg-1)',
                border: `1px solid ${hasAnyGenerated ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                color: hasAnyGenerated ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              <span>{hasAnyGenerated ? '✓' : '○'}</span>
              <span>Unique primary keys: {hasAnyGenerated ? 'Pass' : 'Pending generation'}</span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 500,
                background: hasAnyGenerated ? 'var(--success-bg)' : 'var(--bg-1)',
                border: `1px solid ${hasAnyGenerated ? 'var(--success-border)' : 'var(--border-subtle)'}`,
                color: hasAnyGenerated ? 'var(--success)' : 'var(--text-muted)',
              }}
            >
              <span>{hasAnyGenerated ? '✓' : '○'}</span>
              <span>Zero orphan foreign keys: {hasAnyGenerated ? 'Pass' : 'Pending generation'}</span>
            </div>
          </div>
        </div>

        {allRelationships.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {allRelationships.map((rel, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  padding: '6px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-1)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>{rel.parentTable}</span>
                <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 4 }}>
                  {rel.parentCol}
                </code>
                <span style={{ color: 'var(--synth)', fontWeight: 600 }}>→</span>
                <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>{rel.childTable}</span>
                <code style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-2)', padding: '2px 4px', borderRadius: 4 }}>
                  {rel.childCol}
                </code>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 11,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'var(--blue-soft)',
                    color: 'var(--blue)',
                    fontWeight: 500,
                  }}
                >
                  {rel.cardinality}
                  {rel.minChildren ? ` · min ${rel.minChildren}` : ''}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0' }}>
            No foreign key relationships configured in this specification.
          </p>
        )}
      </div>

      {/* 3. Selected Table Schema & Preview */}
      {table && (
        <div style={{ border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', padding: 18, background: 'var(--bg-1)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--text-section-title)', color: 'var(--text-title)' }}>
                {table.name}
                {table.primary_key && (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                    Primary key: <code style={{ fontFamily: 'var(--font-mono)' }}>{table.primary_key}</code>
                  </span>
                )}
              </h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
                Target: {table.row_count.toLocaleString()} rows · {table.columns.length} columns
              </p>
            </div>

            {artifactId && (
              <button
                onClick={() => loadPage(table.name, 0)}
                disabled={isLoading || busy}
                style={{ fontSize: 12, padding: '5px 12px', margin: 0 }}
              >
                {isLoading ? 'Loading…' : preview ? 'Refresh preview' : 'Load preview'}
              </button>
            )}
          </div>

          {/* Column schema pills */}
          <div style={{ overflowX: 'auto', marginBottom: 16 }}>
            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Data type</th>
                  <th>Semantic meaning</th>
                  <th>Role</th>
                  <th>Relationship</th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((col) => {
                  const fk = table.foreign_keys?.find((f) => f.column === col.name);
                  const isPk = col.name === table.primary_key;
                  return (
                    <tr key={col.name}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600 }}>{col.name}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{col.dtype}</td>
                      <td>
                        <span style={{ padding: '2px 6px', borderRadius: 4, background: 'var(--bg-2)', fontSize: 11 }}>
                          {col.semantic_type}
                        </span>
                      </td>
                      <td>
                        {isPk && (
                          <span style={{ background: 'var(--blue-soft)', color: 'var(--blue)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600 }}>
                            PK
                          </span>
                        )}
                        {fk && (
                          <span style={{ background: 'var(--synth-soft)', color: 'var(--synth)', padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, marginLeft: isPk ? 4 : 0 }}>
                            FK
                          </span>
                        )}
                        {!isPk && !fk && <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {fk ? `→ ${fk.reference_table}.${fk.reference_column} (${fk.cardinality || '1:N'})` : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 4. Table Preview or Friendly Empty State */}
          {artifactId ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)', margin: 0 }}>
                  Generated preview (first {PAGE_SIZE} rows)
                </p>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Bounded sample
                </span>
              </div>

              {isLoading && (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading preview rows…
                </div>
              )}

              {preview && preview.rows.length > 0 && !isLoading && (
                <div style={{ overflowX: 'auto', maxHeight: 360, border: '1px solid var(--border-subtle)', borderRadius: 6 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        {Object.keys(preview.rows[0]).map((k) => (
                          <th key={k} style={{ position: 'sticky', top: 0, background: 'var(--bg-2)', zIndex: 1 }}>{k}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i}>
                          {Object.keys(preview.rows[0]).map((k) => (
                            <td key={k} style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {preview && preview.rows.length === 0 && !isLoading && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No preview rows available for this format.</p>
              )}
            </div>
          ) : (
            /* Friendly Empty State before generation */
            <div
              style={{
                marginTop: 16,
                padding: 24,
                textAlign: 'center',
                border: '1px dashed var(--border-default)',
                borderRadius: 8,
                background: 'var(--bg-2)',
              }}
            >
              <p style={{ fontSize: 13, color: 'var(--text-title)', fontWeight: 500, marginBottom: 6 }}>
                Synthesized records will appear here after generation.
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
                Run generation to synthesize relational tables with guaranteed parent-child referential integrity.
              </p>
              {onGenerate && (
                <button
                  onClick={onGenerate}
                  disabled={busy}
                  style={{ margin: '0 auto', fontSize: 12, padding: '7px 16px' }}
                >
                  Generate data
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

