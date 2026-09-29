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
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {!expired && artifact.format !== 'json' && (
                  <button
                    className={styles.secondary}
                    disabled={busy}
                    onClick={() => loadPreview(artifact)}
                    style={{ fontSize: 11, padding: '4px 10px', margin: 0 }}
                  >
                    Preview
                  </button>
                )}
                {expired ? (
                  <p style={{ color: 'var(--rose)', fontSize: 11, margin: 0 }}>Expired</p>
                ) : (
                  <a
                    href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download`}
                    download
                    style={{ fontSize: 11, color: 'var(--synth)', padding: '4px 10px', border: '1px solid var(--synth-border)', borderRadius: 6, textDecoration: 'none' }}
                  >
                    Download
                  </a>
                )}
              </div>
            </div>
            <small style={{ display: 'block', color: 'var(--text-faint)', marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>
              {artifact.id} · Expires {expiresAt.toLocaleString()}
            </small>
          </div>
        );
      })}
    </div>
  );
}
