import React, { useState } from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, Artifact, v2Request } from '../../services/v2';

interface Props {
  spec: V2Spec;
  tableArtifacts: Record<string, string>; // table name -> artifact id
  busy: boolean;
  onError: (msg: string) => void;
}

interface PagedPreview {
  rows: Record<string, unknown>[];
  artifactId: string;
  page: number;        // 0-indexed
  pageSize: number;
  total: number;       // row_count from artifact
}

const PAGE_SIZE = 20;

export function RelationalView({ spec, tableArtifacts, busy, onError }: Props) {
  const [activeTable, setActiveTable] = useState<string>(spec.tables[0]?.name ?? '');
  const [previews, setPreviews] = useState<Record<string, PagedPreview>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  const tables = spec.tables;
  const table = tables.find((t) => t.name === activeTable);
  const artifactId = tableArtifacts[activeTable];

  async function loadPage(tableName: string, page: number) {
    const aid = tableArtifacts[tableName];
    if (!aid) { onError(`No artifact for table "${tableName}".`); return; }
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
          total: artifact.size,   // approximate; exact count not returned by preview endpoint
        },
      }));
    } catch (err) {
      onError(err instanceof Error ? err.message : `Preview failed for "${tableName}".`);
    } finally {
      setLoading((p) => ({ ...p, [tableName]: false }));
    }
  }

  const preview = previews[activeTable];
  const isLoading = loading[activeTable];

  return (
    <div>
      {/* Table switcher */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {tables.map((t) => (
          <button
            key={t.name}
            onClick={() => setActiveTable(t.name)}
            disabled={busy}
            style={{
              padding: '5px 12px',
              borderRadius: 6,
              border: `1px solid ${t.name === activeTable ? 'var(--synth)' : 'var(--border-default)'}`,
              background: t.name === activeTable ? 'var(--synth-soft)' : 'transparent',
              color: t.name === activeTable ? 'var(--synth)' : 'var(--text-body)',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: t.name === activeTable ? 600 : 400,
            }}
          >
            {t.name}
            {tableArtifacts[t.name] ? '' : ' · no artifact'}
          </button>
        ))}
      </div>

      {table && (
        <>
          {/* Table metadata */}
          <div style={{ marginBottom: 12 }}>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-title)', marginBottom: 4 }}>
              {table.name}
              {table.primary_key && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  PK: {table.primary_key}
                </span>
              )}
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Target: {table.row_count.toLocaleString()} rows · {table.columns.length} columns
            </p>
          </div>

          {/* Schema */}
          <table>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Role</th>
                <th>Relationship</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => {
                const fk = table.foreign_keys?.find((f) => f.column === col.name);
                return (
                  <tr key={col.name}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{col.name}</td>
                    <td>{col.dtype}</td>
                    <td>
                      {col.name === table.primary_key && (
                        <span style={{ background: 'var(--blue-soft)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>PK</span>
                      )}
                      {fk && (
                        <span style={{ background: 'var(--synth-soft)', color: 'var(--synth)', padding: '1px 6px', borderRadius: 4, fontSize: 10, marginLeft: 4 }}>FK</span>
                      )}
                    </td>
                    <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      {fk ? `→ ${fk.reference_table}.${fk.reference_column} (${fk.cardinality})` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* FK summary */}
          {table.foreign_keys && table.foreign_keys.length > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-2)', borderRadius: 6 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-title)', marginBottom: 4 }}>
                Relationship constraints
              </p>
              {table.foreign_keys.map((fk) => (
                <p key={fk.column} style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {table.name}.{fk.column} → {fk.reference_table}.{fk.reference_column}
                  {' '}{fk.cardinality}
                  {fk.min_children != null && fk.min_children > 0 ? ` · min ${fk.min_children} child(ren)` : ''}
                  {' '}· PK/FK integrity enforced by engine · zero-orphan guarantee
                </p>
              ))}
            </div>
          )}

          {/* Preview */}
          {artifactId && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)' }}>
                  Preview · first {PAGE_SIZE} rows
                </p>
                <button
                  onClick={() => loadPage(activeTable, 0)}
                  disabled={isLoading || busy}
                  style={{ fontSize: 11, padding: '4px 10px' }}
                >
                  {isLoading ? 'Loading…' : preview ? 'Refresh' : 'Load preview'}
                </button>
              </div>
              {isLoading && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</p>
              )}
              {preview && preview.rows.length === 0 && !isLoading && (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No preview rows available for this artifact format.</p>
              )}
              {preview && preview.rows.length > 0 && (
                <div style={{ overflowX: 'auto', maxHeight: 320 }}>
                  <table>
                    <thead>
                      <tr>{Object.keys(preview.rows[0]).map((k) => <th key={k}>{k}</th>)}</tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, i) => (
                        <tr key={i}>
                          {Object.keys(preview.rows[0]).map((k) => (
                            <td key={k} style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 4 }}>
                    Preview is bounded to {PAGE_SIZE} rows. Download the artifact for the complete dataset.
                  </p>
                </div>
              )}
            </div>
          )}
          {!artifactId && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              Generate artifacts first to enable table preview.
            </p>
          )}
        </>
      )}
    </div>
  );
}
