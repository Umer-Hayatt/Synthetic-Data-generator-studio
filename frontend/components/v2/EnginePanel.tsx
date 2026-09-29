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
      <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {ok && result.tstr?.tstr
          ? Object.entries(result.tstr.tstr).map(([k, v]) => `${k}: ${fmt(v)}`).join(' · ')
          : '—'}
      </td>
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
  onGenerate,
  onCompare,
  onUseRecommendation,
}: Props) {
  const hasSource = !!sourceArtifactId;
  const hasMultiTable = (spec?.tables?.length ?? 0) > 1;
  const hasDocuments = !!(spec?.documents?.length);

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
      {/* Engine selector — only show if more than 1 option is available */}
      {availableEngines.length > 1 ? (
        <label style={{ display: 'block', marginBottom: 6, fontSize: 12 }}>
          Engine
          <select
            value={engine}
            disabled={busy || active}
            onChange={(e) => onEngineChange(e.target.value)}
            style={{
              display: 'block', width: '100%', marginTop: 6,
              border: '1px solid var(--border-default)', borderRadius: 6,
              background: 'var(--bg-0)', color: 'var(--text-title)', padding: 9,
            }}
          >
            {availableEngines.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {/* Action buttons */}
      <div style={{ marginTop: availableEngines.length > 1 ? 12 : 0, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          disabled={!spec || !accepted || busy || active}
          onClick={onGenerate}
          title={!accepted ? 'Accept the specification first' : undefined}
          style={{ margin: 0 }}
        >
          Generate artifacts
        </button>

        {/* Compare button only shown when source is available and comparison works */}
        {hasSource && (
          <button
            className={styles.secondary}
            disabled={busy || active}
            onClick={onCompare}
            style={{ margin: 0 }}
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
                  <th>Internal TSTR metrics</th>
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
                Based on quality score, internal TSTR, runtime and DataFrame memory from this specific source.
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
