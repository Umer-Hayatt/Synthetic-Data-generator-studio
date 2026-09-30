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
      onError('JSON artifacts cannot be previewed row-by-row; download to inspect.');
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
    <div style={{ marginTop: 16 }}>
      <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)', marginBottom: 8 }}>
        Artifacts ({artifacts.length})
      </p>
      {artifacts.map((artifact, i) => {
        const expiresAt = new Date(artifact.expires_at * 1000);
        const expired = expiresAt < new Date();
        const sizeMiB = artifact.size / (1024 * 1024);
        const sizeLabel = sizeMiB >= 1
          ? `${sizeMiB.toFixed(1)} MiB`
          : `${(artifact.size / 1024).toFixed(1)} KiB`;

        return (
          <div key={artifact.id} className={styles.artifact}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div>
                <p style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-title)' }}>
                  Artifact {i + 1}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>
                    {artifact.format.toUpperCase()} · {sizeLabel}
                  </span>
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
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
                  <p style={{ color: 'var(--rose)', fontSize: 11, margin: 0 }}>This result expired, please regenerate</p>
                ) : (
                  <>
                    {artifact.format === 'jsonl' && (
                      <a
                        href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download?format=csv`}
                        download
                        style={{ fontSize: 11, color: 'var(--synth)', padding: '4px 8px', border: '1px solid var(--synth-border)', borderRadius: 6, textDecoration: 'none' }}
                      >
                        Download CSV
                      </a>
                    )}
                    <a
                      href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download`}
                      download
                      style={{ fontSize: 11, color: 'var(--text-body)', padding: '4px 8px', border: '1px solid var(--border-default)', borderRadius: 6, textDecoration: 'none' }}
                    >
                      Download {artifact.format.toUpperCase()}
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
