import React from 'react';
import styles from '../../styles/v2.module.css';
import { Job, isTerminal, v2Origin } from '../../services/v2';

interface Props {
  job: Job;
  onCancel: () => void;
  busy: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  queued: 'Queued — waiting for a free worker',
  profiling: 'Profiling source data in batches',
  training: 'Fitting engine to distribution',
  generating: 'Generating rows',
  validating: 'Validating output integrity',
  complete: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  complete: 'var(--synth)',
  failed: 'var(--rose)',
  cancelled: 'var(--text-muted)',
};

export function JobPanel({ job, onCancel, busy }: Props) {
  const terminal = isTerminal(job.status);
  const color = STATUS_COLORS[job.status] ?? 'var(--text-title)';
  const stageLabel = STAGE_LABELS[job.stage] ?? job.stage;
  const pct = Math.round(job.progress * 100);

  return (
    <div aria-live="polite" className={styles.job}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
        <div>
          <strong style={{ color }}>
            {job.status.toUpperCase()}
          </strong>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>
            · {stageLabel}
          </span>
        </div>
        {!terminal && (
          <button
            className={styles.secondary}
            disabled={busy}
            onClick={onCancel}
            style={{ fontSize: 11, padding: '4px 10px', marginTop: 0 }}
          >
            Cancel
          </button>
        )}
      </div>

      {!terminal && (
        <>
          <progress value={job.progress} max={1} style={{ display: 'block', width: '100%', margin: '8px 0', accentColor: 'var(--synth)' }} />
          <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Stage progress estimate · {pct}% — actual time depends on data size and engine.
          </p>
        </>
      )}

      {job.error && (
        <p role="alert" style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8, wordBreak: 'break-word' }}>
          {job.error}
        </p>
      )}
      {job.status === 'failed' && !job.error && (
        <p role="alert" style={{ color: 'var(--rose)', fontSize: 12, marginTop: 8 }}>
          Job failed. Check the specification and try again.
        </p>
      )}
      {job.status === 'cancelled' && (
        <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>
          Cancellation was requested. The bounded current step was allowed to finish before stopping.
        </p>
      )}

      <small style={{ display: 'block', color: 'var(--text-faint)', marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        Job ID: {job.job_id}
      </small>
    </div>
  );
}
