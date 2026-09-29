import React from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, Artifact, v2Origin } from '../../services/v2';

interface DocumentSpec {
  kind: 'invoice' | 'bank_statement';
  parent_table: string;
  child_table: string;
  foreign_key: string;
  quantity_column?: string | null;
  price_column?: string | null;
  date_column?: string | null;
  credit_column?: string | null;
  debit_column?: string | null;
  tax_rate?: number;
  discount_rate?: number;
  date_from?: string | null;
  date_to?: string | null;
}

interface Props {
  spec: V2Spec;
  artifacts: Artifact[];
  tableArtifacts: Record<string, string>;
}

function InvoiceInfo({ doc }: { doc: DocumentSpec }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
      <p><strong>Parent table:</strong> {doc.parent_table} (order header)</p>
      <p><strong>Line items:</strong> {doc.child_table} via FK <code>{doc.foreign_key}</code></p>
      {doc.quantity_column && <p><strong>Quantity:</strong> {doc.quantity_column} × <strong>Price:</strong> {doc.price_column}</p>}
      {doc.tax_rate != null && doc.tax_rate > 0 && <p><strong>Tax:</strong> {(doc.tax_rate * 100).toFixed(1)}%</p>}
      {doc.discount_rate != null && doc.discount_rate > 0 && <p><strong>Discount:</strong> {(doc.discount_rate * 100).toFixed(1)}%</p>}
      <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-faint)' }}>
        Invoice arithmetic: subtotal = Σ(quantity × price) · discount applied before tax ·
        total = subtotal × (1 − discount) × (1 + tax) — balanced to the cent using Decimal arithmetic.
      </p>
    </div>
  );
}

function BankStatementInfo({ doc }: { doc: DocumentSpec }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
      <p><strong>Account table:</strong> {doc.parent_table} (account header)</p>
      <p><strong>Transactions:</strong> {doc.child_table} via FK <code>{doc.foreign_key}</code></p>
      {doc.date_column && <p><strong>Date column:</strong> {doc.date_column}</p>}
      {doc.credit_column && <p><strong>Credit:</strong> {doc.credit_column} · <strong>Debit:</strong> {doc.debit_column}</p>}
      {(doc.date_from || doc.date_to) && (
        <p><strong>Date filter:</strong> {doc.date_from ?? '∞'} → {doc.date_to ?? '∞'}</p>
      )}
      <p style={{ marginTop: 6, fontSize: 11, color: 'var(--text-faint)' }}>
        Running balance: balance[t] = balance[t−1] + credit[t] − debit[t].
        Opening, running and closing balances are all included in the artifact.
        PDF is not implemented; structured JSON output only.
      </p>
    </div>
  );
}

export function DocumentView({ spec, artifacts, tableArtifacts }: Props) {
  const docs = (spec.documents ?? []) as DocumentSpec[];

  if (docs.length === 0) {
    return (
      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
        No document mappings in this specification. Add an invoice or bank_statement entry to the documents array in the Advanced JSON editor.
      </p>
    );
  }

  // Artifacts that are JSON (manifest or document outputs) excluding table artifacts
  const tableArtifactIds = new Set(Object.values(tableArtifacts));
  const docArtifacts = artifacts.filter((a) => a.format === 'json' && !tableArtifactIds.has(a.id));

  return (
    <div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12 }}>
        Structured documents generated from the same relational entities.
        PDF is not implemented — download JSON artifacts below.
      </p>

      {docs.map((doc, i) => (
        <div key={i} style={{
          padding: '14px 16px',
          border: '1px solid var(--border-default)',
          borderRadius: 8,
          marginBottom: 14,
          background: 'var(--bg-1)',
        }}>
          <p style={{ fontWeight: 600, color: 'var(--text-title)', marginBottom: 2 }}>
            {doc.kind === 'invoice' ? '🧾 Invoice' : '🏦 Bank Statement'} · {doc.parent_table} → {doc.child_table}
          </p>
          {doc.kind === 'invoice' ? <InvoiceInfo doc={doc} /> : <BankStatementInfo doc={doc} />}
        </div>
      ))}

      {/* Document JSON artifacts */}
      {docArtifacts.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Document artifacts</p>
          {docArtifacts.map((artifact) => {
            const expiresAt = new Date(artifact.expires_at * 1000);
            const expired = expiresAt < new Date();
            return (
              <div key={artifact.id} className={styles.artifact}>
                <p style={{ fontSize: 12 }}>
                  JSON document · {(artifact.size / 1024).toFixed(1)} KiB
                </p>
                {expired ? (
                  <p style={{ color: 'var(--rose)', fontSize: 12 }}>Artifact expired. Re-generate to download.</p>
                ) : (
                  <a
                    href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download`}
                    download
                    style={{ fontSize: 12 }}
                  >
                    Download JSON
                  </a>
                )}
                <small>Expires {expiresAt.toLocaleString()}</small>
              </div>
            );
          })}
        </div>
      )}
      {docArtifacts.length === 0 && artifacts.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Document artifacts are included in the generation output. Check the artifact list below.
        </p>
      )}
      {artifacts.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Run a generation job with the &quot;documents&quot; engine to produce document artifacts.
        </p>
      )}
    </div>
  );
}
