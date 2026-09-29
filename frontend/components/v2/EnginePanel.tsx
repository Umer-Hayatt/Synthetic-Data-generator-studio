import React from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, Comparison, EngineCapability, ComparisonResult } from '../../services/v2';

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
          : result.status === 'unavailable' ? 'not installed' : '—'}
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

  // Build engine options based on capabilities
  const deepCapabilities = capabilities.filter((c) => c.engine.startsWith('deep_'));

  function engineLabel(name: string): string {
    const labels: Record<string, string> = {
      statistical: 'Statistical — default, always available',
      statistical_conditional: 'Statistical · target-aware — requires source upload',
      relational: 'Relational — multi-table DAG, PK/FK integrity',
      documents: 'Relational + documents — invoices, statements',
    };
    return labels[name] ?? name;
  }

  return (
    <div>
      {/* Engine selector */}
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
          <option value="statistical">{engineLabel('statistical')}</option>
          <option value="statistical_conditional" disabled={!hasSource}>
            {engineLabel('statistical_conditional')}{!hasSource ? ' (upload a source first)' : ''}
          </option>
          <option value="relational" disabled={!hasMultiTable}>
            {engineLabel('relational')}{!hasMultiTable ? ' (requires multi-table spec)' : ''}
          </option>
          <option value="documents" disabled={!hasDocuments}>
            {engineLabel('documents')}{!hasDocuments ? ' (no documents in spec)' : ''}
          </option>

          {/* Deep engines — always show, disabled with reason */}
          {['deep_ctgan', 'deep_tvae'].map((name) => {
            const cap = capabilities.find((c) => c.engine === name);
            const available = cap?.available === true;
            return (
              <option key={name} value={name} disabled={!available || !hasSource}>
                {name === 'deep_ctgan' ? 'CTGAN (optional deep)' : 'TVAE (optional deep)'}
                {!available ? ' — not installed' : !hasSource ? ' — requires source upload' : ''}
              </option>
            );
          })}
        </select>
      </label>

      {/* Deep engine note */}
      {deepCapabilities.some((c) => c.available === false || c.available === undefined) && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          CTGAN and TVAE are optional deep adapters — not installed in this environment.
          Use statistical or relational generation.
        </p>
      )}

      {/* Generate button */}
      <button
        disabled={!spec || !accepted || busy || active}
        onClick={onGenerate}
        title={!accepted ? 'Accept the specification first' : undefined}
      >
        Generate artifacts
      </button>

      {/* Compare / AUTO button */}
      <button
        className={styles.secondary}
        disabled={!hasSource || busy || active}
        onClick={onCompare}
        title={!hasSource ? 'Upload a source file first to run comparison' : undefined}
        style={{ marginLeft: 8 }}
      >
        Compare engines
      </button>

      {/* Comparison results */}
      {comparison && (
        <div style={{ marginTop: 20 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-title)', marginBottom: 4 }}>
            Engine comparison results
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
            Internal development benchmark — sample-specific engineering evidence only.
            This is <strong>not</strong> the competition&apos;s external TSTR evaluation score.
            Results reflect this particular source file with the configured seed.
          </p>

          {comparison.source_profile && (
            <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8 }}>
              Source: {comparison.source_profile.row_count.toLocaleString()} rows
              · sampled {comparison.source_profile.sample_rows.toLocaleString()} rows for comparison
            </p>
          )}

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
                {comparison.results.map((r) => <ComparisonRow key={r.engine} result={r} />)}
              </tbody>
            </table>
          </div>

          <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
            Memory figures are DataFrame footprint estimates, not peak process memory.
            Deep engines are unavailable in this environment.
          </p>

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
