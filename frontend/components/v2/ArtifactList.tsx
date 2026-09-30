import React from 'react';
import styles from '../../styles/v2.module.css';
import { Artifact, v2Origin, v2Request } from '../../services/v2';

interface Props {
  artifacts: Artifact[];
  busy: boolean;
  onPreview: (rows: Record<string, unknown>[]) => void;
  onError: (msg: string) => void;
}

export function ArtifactList({ artifacts, busy, onPreview, onError }: Props) {
  if (artifacts.length === 0) return null;

  async function loadPreview(artifact: Artifact) {
    if (artifact.format === 'json') {
      onError('JSON files cannot be previewed row-by-row; download to inspect.');
      return;
    }
    try {
      const data = await v2Request<Artifact>(`/artifacts/${artifact.id}?preview_rows=20`);
      onPreview(data.preview ?? []);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Preview failed.');
    }
  }

  return (
    <div style={{ marginTop: 0 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)', marginBottom: 8 }}>
        Results ({artifacts.length})
      </p>
      {artifacts.map((artifact, i) => {
        const expiresAt = new Date(artifact.expires_at * 1000);
        const expired = expiresAt < new Date();
        const sizeMiB = artifact.size / (1024 * 1024);
        const sizeLabel = sizeMiB >= 1
          ? `${sizeMiB.toFixed(1)} MiB`
          : `${(artifact.size / 1024).toFixed(1)} KiB`;
        // Use table name from artifact metadata if available, otherwise "Result N"
        const label = (artifact as any).table_name ?? (artifact as any).name ?? `Result ${i + 1}`;

        return (
          <div key={artifact.id} className={styles.artifact}>
            {/* header row: title on left, actions on right — both min-width:0 to prevent overflow */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, minWidth: 0 }}>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-title)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {label}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                    {artifact.format.toUpperCase()} · {sizeLabel}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', flexShrink: 0, flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {!expired && artifact.format !== 'json' && (
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => loadPreview(artifact)}
                    style={{ fontSize: 11, padding: '4px 8px', margin: 0 }}
                  >
                    Preview
                  </button>
                )}
                {expired ? (
                  <p style={{ color: 'var(--rose)', fontSize: 11, margin: 0 }}>Expired — please regenerate</p>
                ) : (
                  <>
                    {artifact.format === 'jsonl' && (
                      <a
                        href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download?format=csv`}
                        download
                        style={{ fontSize: 11, color: 'var(--synth)', padding: '4px 8px', border: '1px solid var(--synth-border)', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}
                      >
                        CSV
                      </a>
                    )}
                    <a
                      href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download`}
                      download
                      style={{ fontSize: 11, color: 'var(--text-body)', padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 6, textDecoration: 'none', whiteSpace: 'nowrap' }}
                    >
                      {artifact.format.toUpperCase()}
                    </a>
                  </>
                )}
              </div>
            </div>
            <details style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', cursor: 'pointer' }}>
              <summary>Details</summary>
              <p style={{ margin: '4px 0 0', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)' }}>
                ID: {artifact.id}
              </p>
            </details>
          </div>
        );
      })}
    </div>
  );
}
