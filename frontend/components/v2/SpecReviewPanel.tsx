import React, { useState, useEffect } from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, V2Table, v2Request, jsonBody } from '../../services/v2';

interface Props {
  spec: V2Spec;
  accepted: boolean;
  busy: boolean;
  onSpecChange: (spec: V2Spec) => void;
  onAcceptChange: (accepted: boolean) => void;
  onError: (msg: string) => void;
}

export function SpecReviewPanel({ spec, accepted, busy, onSpecChange, onAcceptChange, onError }: Props) {
  const [rawJson, setRawJson] = useState(() => JSON.stringify(spec, null, 2));
  const [rawEdited, setRawEdited] = useState(false);
  const [validating, setValidating] = useState(false);

  // Keep rawJson in sync when spec changes from outside (AI/upload) but not from raw editor
  useEffect(() => {
    if (!rawEdited) {
      setRawJson(JSON.stringify(spec, null, 2));
    }
  }, [spec, rawEdited]);

  function updateTable(index: number, patch: Partial<V2Table>) {
    onAcceptChange(false);
    const tables = spec.tables.map((t, i) => i === index ? { ...t, ...patch } : t);
    onSpecChange({ ...spec, tables });
  }

  async function validateRaw() {
    setValidating(true);
    try {
      const parsed = JSON.parse(rawJson);
      const validated = await v2Request<V2Spec>('/spec', jsonBody(parsed));
      onSpecChange(validated);
      setRawEdited(false);
      onAcceptChange(false);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Validation failed. Check JSON syntax and field constraints.');
    } finally {
      setValidating(false);
    }
  }

  const hasBusinessRules = !!spec.business_rules?.length;
  const hasEdgeCases = !!spec.edge_cases?.length;

  return (
    <div>
      {/* Top-level spec fields */}
      <div className={styles.fields} style={{ marginBottom: 12 }}>
        <label>
          Name
          <input
            value={spec.name}
            disabled={busy}
            onChange={(e) => { onSpecChange({ ...spec, name: e.target.value }); onAcceptChange(false); }}
          />
        </label>
        <label>
          Locale
          <input
            value={spec.locale}
            disabled={busy}
            onChange={(e) => { onSpecChange({ ...spec, locale: e.target.value }); onAcceptChange(false); }}
          />
        </label>
        <label>
          Seed
          <input
            type="number"
            min={0}
            max={4294967295}
            value={spec.seed}
            disabled={busy}
            onChange={(e) => { onSpecChange({ ...spec, seed: Number(e.target.value) }); onAcceptChange(false); }}
          />
        </label>
      </div>

      {/* Tables */}
      {spec.tables.map((table, ti) => (
        <details key={table.name} open={ti === 0} className={styles.tableSection}>
          <summary>
            {table.name}
            {table.primary_key ? ` · PK: ${table.primary_key}` : ''}
            {' '}· {table.columns.length} fields
          </summary>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginTop: 8 }}>
            <label>
              Row count
              <input
                type="number"
                min={1}
                value={table.row_count}
                disabled={busy}
                onChange={(e) => updateTable(ti, { row_count: Number(e.target.value) })}
              />
            </label>
            <label>
              Benchmark target
              <select
                value={table.target_column ?? ''}
                disabled={busy}
                onChange={(e) => updateTable(ti, { target_column: e.target.value || null })}
              >
                <option value="">None</option>
                {table.columns.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </label>
          </div>

          <table style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Meaning</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col) => (
                <tr key={col.name}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{col.name}</td>
                  <td>{col.dtype}</td>
                  <td>{col.semantic_type}</td>
                  <td>
                    {col.name === table.primary_key && <span style={{ color: 'var(--blue)', fontSize: 10 }}>PK</span>}
                    {table.foreign_keys?.find((fk) => fk.column === col.name) && (
                      <span style={{ color: 'var(--purple)', fontSize: 10, marginLeft: 4 }}>FK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FK relationships */}
          {table.foreign_keys && table.foreign_keys.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>Relationships</p>
              {table.foreign_keys.map((fk) => (
                <p key={fk.column} className={styles.muted} style={{ fontSize: 11 }}>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{table.name}.{fk.column}</span>
                  {' '}→{' '}
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{fk.reference_table}.{fk.reference_column}</span>
                  {' '}· {fk.cardinality}
                  {fk.min_children != null && fk.min_children > 0 && ` · min ${fk.min_children}`}
                </p>
              ))}
            </div>
          )}
        </details>
      ))}

      {/* Business rules / edge cases review notes */}
      {hasBusinessRules && (
        <div className={styles.warning} style={{ marginTop: 12 }}>
          <strong>Suggested business rules (review required)</strong>
          <p style={{ marginTop: 4, fontSize: 12 }}>{spec.business_rules!.join(' · ')}</p>
          <p style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Free-text rules are AI suggestions, not executed constraints. Translate into supported reconciliation rules or remove before accepting.
          </p>
        </div>
      )}
      {hasEdgeCases && (
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
          <strong>Suggested edge cases:</strong> {spec.edge_cases!.join(' · ')}
        </p>
      )}

      {/* Advanced JSON editor */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-title)', fontWeight: 600, fontSize: 12 }}>
          Advanced — full specification JSON
        </summary>
        <textarea
          aria-label="Full specification JSON"
          rows={14}
          value={rawJson}
          disabled={busy}
          onChange={(e) => { setRawJson(e.target.value); setRawEdited(true); onAcceptChange(false); }}
          style={{
            display: 'block', width: '100%', marginTop: 8,
            border: '1px solid var(--border-default)', borderRadius: 6,
            background: 'var(--bg-0)', color: 'var(--text-title)',
            padding: 9, fontFamily: 'var(--font-mono)', fontSize: 11, resize: 'vertical',
          }}
        />
        {rawEdited && (
          <p style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>
            Validate your edits before accepting.
          </p>
        )}
        <button
          disabled={busy || validating}
          onClick={validateRaw}
          style={{ marginTop: 8, fontSize: 12 }}
        >
          {validating ? 'Validating…' : 'Validate & apply edits'}
        </button>
      </details>

      {/* Accept gate */}
      <label className={styles.check} style={{ marginTop: 16 }}>
        <input
          type="checkbox"
          checked={accepted}
          disabled={busy || rawEdited}
          onChange={(e) => onAcceptChange(e.target.checked)}
        />
        <span>
          I have reviewed and accepted this specification.
          {rawEdited && <span style={{ color: 'var(--amber)', marginLeft: 6 }}>Validate edits first.</span>}
        </span>
      </label>
    </div>
  );
}
