import React from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, Comparison, EngineCapability, ComparisonResult } from '../../services/v2';

import { FEATURES } from '../../services/features';

interface Props {
  spec: V2Spec | null;
  accepted: boolean;
  engine: string;
  capabilities: EngineCapability[];
  sourceArtifactId: string;
  comparison: Comparison | null;
  busy: boolean;
  active: boolean;
  onEngineChange: (engine: string) => void;
  onSeedChange?: (seed: number) => void;
  onGenerate: () => void;
  onCompare: () => void;
  onUseRecommendation: (engine: string) => void;
}

function kb(bytes: number | undefined): string {
  if (!bytes) return '—';
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KiB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function fmt(v: number | null | undefined): string {
  return v == null ? '—' : v.toFixed(3);
}

function ComparisonRow({ result }: { result: ComparisonResult }) {
  const ok = result.status === 'ok';
  return (
    <tr>
      <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{result.engine}</td>
      <td style={{ color: ok ? 'var(--synth)' : 'var(--rose)' }}>{result.status}</td>
      <td>{ok ? fmt(result.quality_score) : '—'}</td>
      <td>{ok ? `${result.runtime_seconds?.toFixed(2) ?? '—'}s` : '—'}</td>
      <td>{ok ? kb(result.memory_estimate_bytes) : '—'}</td>
    </tr>
  );
}


export function EnginePanel({
  spec,
  accepted,
  engine,
  capabilities,
  sourceArtifactId,
  comparison,
  busy,
  active,
  onEngineChange,
  onSeedChange,
  onGenerate,
  onCompare,
  onUseRecommendation,
}: Props) {
  const hasSource = !!sourceArtifactId;
  const hasMultiTable = (spec?.tables?.length ?? 0) > 1;
  const hasDocuments = !!(spec?.documents?.length);

  const totalRows = spec?.tables?.reduce((sum, t) => sum + (t.row_count || 0), 0) ?? 0;

  // Available engine options
  const availableEngines: { id: string; label: string }[] = [
    { id: 'statistical', label: 'Statistical (default)' },
  ];

  if (hasSource) {
    availableEngines.push({ id: 'statistical_conditional', label: 'Statistical (target-aware)' });
  }

  if (hasMultiTable) {
    availableEngines.push({ id: 'relational', label: 'Relational (multi-table DAG)' });
  }

  if (hasDocuments) {
    availableEngines.push({ id: 'documents', label: 'Relational + Documents' });
  }

  if (FEATURES.ENABLE_DEEP_ENGINES) {
    for (const name of ['deep_ctgan', 'deep_tvae']) {
      const cap = capabilities.find((c) => c.engine === name);
      if (cap?.available && hasSource) {
        availableEngines.push({
          id: name,
          label: name === 'deep_ctgan' ? 'CTGAN (deep)' : 'TVAE (deep)',
        });
      }
    }
  }

  // Filter comparison results to only show working engines
  const workingComparisonResults = comparison?.results?.filter(
    (r) => r.status === 'ok' || FEATURES.ENABLE_DEEP_ENGINES
  );

  return (
    <div>
      {/* Overview summary */}
      {spec && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
          <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Total rows</span>
            <strong style={{ fontSize: 13, color: 'var(--text-title)' }}>
              {totalRows.toLocaleString()}
            </strong>
          </div>
          <div style={{ padding: '8px 10px', background: 'var(--bg-2)', borderRadius: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block' }}>Random seed</span>
            {onSeedChange ? (
              <input
                type="number"
                min={0}
                max={4294967295}
                value={spec.seed ?? 42}
                disabled={busy || active}
                onChange={(e) => onSeedChange(Number(e.target.value))}
                style={{
                  fontSize: 12,
                  padding: '2px 6px',
                  margin: 0,
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  fontWeight: 600,
                  color: 'var(--text-title)',
                }}
              />
            ) : (
              <strong style={{ fontSize: 13, color: 'var(--text-title)' }}>
                {spec.seed ?? 42}
              </strong>
            )}
          </div>
        </div>
      )}

      {/* Engine selector */}
      {availableEngines.length > 1 && (
        <label style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          Generation engine
          <select
            value={engine}
            disabled={busy || active}
            onChange={(e) => onEngineChange(e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 6,
              border: '1px solid var(--border-default)', borderRadius: 6,
              background: 'var(--bg-0)', color: 'var(--text-title)', padding: 8,
              fontSize: 12,
            }}
          >
            {availableEngines.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Action buttons */}
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          disabled={!spec || !accepted || busy || active}
          onClick={onGenerate}
          title={!accepted ? 'Review and accept the specification first' : undefined}
          style={{ width: '100%', margin: 0, padding: '10px 14px', fontSize: 13 }}
        >
          Generate data
        </button>

        {!accepted && spec && (
          <p style={{ fontSize: 11, color: 'var(--amber)', margin: '2px 0 0', textAlign: 'center' }}>
            Review and check &quot;Accept specification&quot; to generate.
          </p>
        )}

        {/* Compare button only shown when source is available */}
        {hasSource && (
          <button
            className={styles.secondary}
            disabled={busy || active}
            onClick={onCompare}
            style={{ width: '100%', margin: 0, fontSize: 12 }}
          >
            Compare engines
          </button>
        )}
      </div>

      {/* Comparison results */}
      {comparison && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-title)', marginBottom: 4 }}>
            Engine comparison results
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Status</th>
                  <th>Quality score</th>
                  <th>Runtime</th>
                  <th>Memory (DataFrame)</th>
                </tr>
              </thead>
              <tbody>
                {workingComparisonResults?.map((r) => <ComparisonRow key={r.engine} result={r} />)}
              </tbody>
            </table>
          </div>

          {/* AUTO recommendation */}
          {comparison.recommendation ? (
            <div style={{
              marginTop: 14, padding: '12px 14px',
              background: 'var(--synth-soft)', border: '1px solid var(--synth-border)',
              borderRadius: 8,
            }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)' }}>
                AUTO suggestion: <span style={{ color: 'var(--synth)' }}>{comparison.recommendation}</span>
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                Based on quality score, runtime and DataFrame memory from this specific source.
                Review the evidence above before accepting. This is a suggestion, not an automatic selection.
              </p>

              <button
                className={styles.secondary}
                onClick={() => onUseRecommendation(comparison.recommendation!)}
                style={{ marginTop: 8, fontSize: 11 }}
              >
                Use {comparison.recommendation}
              </button>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>
              No recommendation — results were inconclusive or only one engine ran successfully.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
