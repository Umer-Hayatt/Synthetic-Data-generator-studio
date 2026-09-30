import React, { useState, useEffect } from 'react';
import styles from '../../styles/v2.module.css';
import { V2Spec, Artifact, v2Origin, v2Request } from '../../services/v2';

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

interface InvoiceRecord {
  entity_id: string | number;
  entity: Record<string, unknown>;
  lines: {
    source: Record<string, unknown>;
    line_total: string;
  }[];
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
}

interface BankStatementRecord {
  entity_id: string | number;
  entity: Record<string, unknown>;
  opening_balance: string;
  transactions: {
    source: Record<string, unknown>;
    date: string;
    credit: string;
    debit: string;
    balance: string;
  }[];
  closing_balance: string;
}

interface Props {
  spec: V2Spec;
  artifacts: Artifact[];
  tableArtifacts: Record<string, string>;
  onGenerate?: () => void;
}

export function DocumentView({ spec, artifacts, tableArtifacts, onGenerate }: Props) {
  const docs = (spec.documents ?? []) as DocumentSpec[];
  const hasInvoices = docs.some((d) => d.kind === 'invoice');
  const hasStatements = docs.some((d) => d.kind === 'bank_statement');

  const [activeKind, setActiveKind] = useState<'invoice' | 'bank_statement'>(
    hasInvoices ? 'invoice' : 'bank_statement'
  );

  // Navigator index for records
  const [invoiceIndex, setInvoiceIndex] = useState(0);
  const [statementIndex, setStatementIndex] = useState(0);

  // Date range filter for bank statement
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');

  // Loaded records from artifacts
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [statements, setStatements] = useState<BankStatementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Find doc spec and artifact for active kind
  const activeDocIndex = docs.findIndex((d) => d.kind === activeKind);
  const activeDocSpec = activeDocIndex >= 0 ? docs[activeDocIndex] : null;
  const artifactKey = activeDocIndex >= 0 ? `document_${activeDocIndex}_${activeKind}` : '';
  const activeArtifactId = tableArtifacts[artifactKey];

  // Fetch document preview records when artifact changes
  useEffect(() => {
    if (!activeArtifactId) return;
    let isMounted = true;
    setLoading(true);
    setErrorMsg('');

    v2Request<Artifact>(`/artifacts/${activeArtifactId}?preview_rows=100`)
      .then((art) => {
        if (!isMounted) return;
        const records = (art.preview ?? []) as unknown[];
        if (activeKind === 'invoice') {
          setInvoices(records as InvoiceRecord[]);
          setInvoiceIndex(0);
        } else {
          setStatements(records as BankStatementRecord[]);
          setStatementIndex(0);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load document records.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [activeArtifactId, activeKind]);

  if (docs.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', background: 'var(--bg-1)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)' }}>
        <p style={{ fontSize: 13, color: 'var(--text-title)', fontWeight: 500, marginBottom: 6 }}>
          No document mappings configured in this specification.
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Add an invoice or bank statement mapping in the review panel to generate reconciled documents.
        </p>
      </div>
    );
  }

  const currentInvoice = invoices[invoiceIndex];
  const currentStatement = statements[statementIndex];

  // Reconciled calculation check for current invoice
  const isInvoiceReconciled = currentInvoice ? (() => {
    const lineSum = currentInvoice.lines?.reduce((sum, l) => sum + parseFloat(l.line_total || '0'), 0) ?? 0;
    const sub = parseFloat(currentInvoice.subtotal || '0');
    const tax = parseFloat(currentInvoice.tax || '0');
    const disc = parseFloat(currentInvoice.discount || '0');
    const total = parseFloat(currentInvoice.total || '0');
    return Math.abs(lineSum - sub) < 0.02 && Math.abs((sub + tax - disc) - total) < 0.02;
  })() : false;

  // Filtered transactions for bank statement
  const filteredTransactions = currentStatement?.transactions?.filter((t) => {
    if (startDateFilter && t.date < startDateFilter) return false;
    if (endDateFilter && t.date > endDateFilter) return false;
    return true;
  }) ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. Header Toolbar: Document Kind Toggle & Download Links */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        {/* Toggle between Invoices and Bank Statements */}
        <div style={{ display: 'flex', gap: 6 }}>
          {hasInvoices && (
            <button
              onClick={() => setActiveKind('invoice')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${activeKind === 'invoice' ? 'var(--synth)' : 'var(--border-default)'}`,
                background: activeKind === 'invoice' ? 'var(--synth-soft)' : 'var(--bg-1)',
                color: activeKind === 'invoice' ? 'var(--synth)' : 'var(--text-body)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: activeKind === 'invoice' ? 600 : 500,
                margin: 0,
              }}
            >
              🧾 Invoices {invoices.length > 0 ? `(${invoices.length})` : ''}
            </button>
          )}

          {hasStatements && (
            <button
              onClick={() => setActiveKind('bank_statement')}
              style={{
                padding: '6px 14px',
                borderRadius: 20,
                border: `1px solid ${activeKind === 'bank_statement' ? 'var(--synth)' : 'var(--border-default)'}`,
                background: activeKind === 'bank_statement' ? 'var(--synth-soft)' : 'var(--bg-1)',
                color: activeKind === 'bank_statement' ? 'var(--synth)' : 'var(--text-body)',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: activeKind === 'bank_statement' ? 600 : 500,
                margin: 0,
              }}
            >
              🏦 Bank statements {statements.length > 0 ? `(${statements.length})` : ''}
            </button>
          )}
        </div>

        {/* Structured Download Buttons */}
        {activeArtifactId && (
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={`${v2Origin}/api/v1/artifacts/${activeArtifactId}/download?format=csv`}
              download
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--synth-border)',
                background: 'var(--synth-soft)',
                color: 'var(--synth)',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Download CSV
            </a>
            <a
              href={`${v2Origin}/api/v1/artifacts/${activeArtifactId}/download`}
              download
              style={{
                fontSize: 12,
                padding: '5px 12px',
                borderRadius: 6,
                border: '1px solid var(--border-default)',
                background: 'var(--bg-1)',
                color: 'var(--text-body)',
                textDecoration: 'none',
                fontWeight: 500,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Download JSONL
            </a>
          </div>
        )}
      </div>

      {errorMsg && (
        <div style={{ padding: 10, borderRadius: 6, background: 'var(--rose-soft)', color: 'var(--rose)', fontSize: 12 }}>
          {errorMsg}
        </div>
      )}

      {loading && (
        <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading document records…
        </div>
      )}

      {/* 2. REALISTIC INVOICE CARD */}
      {!loading && activeKind === 'invoice' && (
        activeArtifactId && currentInvoice ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Invoice Navigator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)', padding: '8px 14px', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className={styles.secondary}
                  disabled={invoiceIndex <= 0}
                  onClick={() => setInvoiceIndex((i) => Math.max(0, i - 1))}
                  style={{ fontSize: 11, padding: '3px 10px', margin: 0 }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)' }}>
                  Invoice {invoiceIndex + 1} of {invoices.length}
                </span>
                <button
                  className={styles.secondary}
                  disabled={invoiceIndex >= invoices.length - 1}
                  onClick={() => setInvoiceIndex((i) => Math.min(invoices.length - 1, i + 1))}
                  style={{ fontSize: 11, padding: '3px 10px', margin: 0 }}
                >
                  Next →
                </button>
              </div>

              {/* Reconciled Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 600,
                  background: isInvoiceReconciled ? 'var(--success-bg)' : 'var(--warning-bg)',
                  border: `1px solid ${isInvoiceReconciled ? 'var(--success-border)' : 'var(--warning-border)'}`,
                  color: isInvoiceReconciled ? 'var(--success)' : 'var(--warning)',
                }}
              >
                <span>{isInvoiceReconciled ? '✓' : '○'}</span>
                <span>{isInvoiceReconciled ? 'Reconciled: Line totals match subtotal' : 'Reconciliation pending'}</span>
              </div>
            </div>

            {/* Document Surface */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                padding: '32px 36px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                color: '#0f172a',
              }}
            >
              {/* Invoice Top Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-subtle)', paddingBottom: 20, marginBottom: 24 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px', color: '#0f172a' }}>
                    {spec.name || 'Commercial Enterprise'}
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '4px 0 0' }}>
                    Automated Commercial Invoice · Synthetic Entity
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--synth)', letterSpacing: '1px' }}>
                    INVOICE
                  </span>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, margin: '4px 0 0', color: '#334155' }}>
                    #{currentInvoice.entity_id}
                  </p>
                </div>
              </div>

              {/* Billed To / Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24, fontSize: 12 }}>
                <div>
                  <p style={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Billed to
                  </p>
                  <p style={{ fontWeight: 600, color: '#0f172a', margin: 0 }}>
                    {String(currentInvoice.entity.customer_id ?? currentInvoice.entity.client_id ?? currentInvoice.entity.name ?? 'Customer Reference')}
                  </p>
                  <p style={{ color: '#64748b', margin: '2px 0 0', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    Entity ID: {String(currentInvoice.entity_id)}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ textTransform: 'uppercase', fontSize: 10, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: 4 }}>
                    Order details
                  </p>
                  <p style={{ color: '#334155', margin: 0 }}>
                    Date: {String(currentInvoice.entity.order_date ?? currentInvoice.entity.created_at ?? 'Current Period')}
                  </p>
                  <p style={{ color: '#64748b', margin: '2px 0 0' }}>
                    Payment: {String(currentInvoice.entity.payment_method ?? currentInvoice.entity.status ?? 'Standard Terms')}
                  </p>
                </div>
              </div>

              {/* Line Items Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Item description</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Quantity</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Unit price</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Line total</th>
                  </tr>
                </thead>
                <tbody>
                  {currentInvoice.lines?.map((line, li) => {
                    const src = line.source;
                    const qty = activeDocSpec?.quantity_column ? src[activeDocSpec.quantity_column] : (src.quantity ?? 1);
                    const prc = activeDocSpec?.price_column ? src[activeDocSpec.price_column] : (src.unit_price ?? src.price ?? line.line_total);
                    return (
                      <tr key={li} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontSize: 12, color: '#1e293b' }}>
                          <span style={{ fontWeight: 500 }}>{String(src.product_id ?? src.item_name ?? src.description ?? `Item #${li + 1}`)}</span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#475569' }}>
                          {String(qty)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, color: '#475569' }}>
                          ${parseFloat(String(prc)).toFixed(2)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '10px 12px', fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                          ${parseFloat(line.line_total).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Invoice Summary Block */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                    <span>Subtotal:</span>
                    <strong style={{ color: '#1e293b' }}>${parseFloat(currentInvoice.subtotal).toFixed(2)}</strong>
                  </div>

                  {parseFloat(currentInvoice.discount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#166534' }}>
                      <span>Discount ({((activeDocSpec?.discount_rate ?? 0) * 100).toFixed(0)}%):</span>
                      <strong>-${parseFloat(currentInvoice.discount).toFixed(2)}</strong>
                    </div>
                  )}

                  {parseFloat(currentInvoice.tax) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                      <span>Tax ({((activeDocSpec?.tax_rate ?? 0) * 100).toFixed(0)}%):</span>
                      <strong style={{ color: '#1e293b' }}>+${parseFloat(currentInvoice.tax).toFixed(2)}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #0f172a', paddingTop: 8, marginTop: 4, fontSize: 15 }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>Total:</span>
                    <span style={{ fontWeight: 800, color: 'var(--synth)' }}>
                      ${parseFloat(currentInvoice.total).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state before generation */
          <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-title)', fontWeight: 500, marginBottom: 6 }}>
              Invoices will be rendered here once generated.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              Parent orders and child order items are combined into reconciled invoice documents with Decimal line-item arithmetic.
            </p>
            {onGenerate && (
              <button onClick={onGenerate} style={{ margin: '0 auto', fontSize: 12, padding: '7px 16px' }}>
                Generate data
              </button>
            )}
          </div>
        )
      )}

      {/* 3. REALISTIC BANK STATEMENT CARD */}
      {!loading && activeKind === 'bank_statement' && (
        activeArtifactId && currentStatement ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Statement Navigator */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-2)', padding: '8px 14px', borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className={styles.secondary}
                  disabled={statementIndex <= 0}
                  onClick={() => setStatementIndex((i) => Math.max(0, i - 1))}
                  style={{ fontSize: 11, padding: '3px 10px', margin: 0 }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-title)' }}>
                  Account {statementIndex + 1} of {statements.length}
                </span>
                <button
                  className={styles.secondary}
                  disabled={statementIndex >= statements.length - 1}
                  onClick={() => setStatementIndex((i) => Math.min(statements.length - 1, i + 1))}
                  style={{ fontSize: 11, padding: '3px 10px', margin: 0 }}
                >
                  Next →
                </button>
              </div>

              {/* Date-Range Filter */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                <span style={{ color: 'var(--text-muted)' }}>Date filter:</span>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--bg-1)', color: 'var(--text-title)' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>→</span>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border-default)', background: 'var(--bg-1)', color: 'var(--text-title)' }}
                />
                {(startDateFilter || endDateFilter) && (
                  <button
                    className={styles.secondary}
                    onClick={() => { setStartDateFilter(''); setEndDateFilter(''); }}
                    style={{ fontSize: 10, padding: '2px 6px', margin: 0 }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Document Surface */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid var(--border-default)',
                borderRadius: 10,
                padding: '32px 36px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                color: '#0f172a',
              }}
            >
              {/* Statement Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #0f172a', paddingBottom: 16, marginBottom: 20 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
                    {spec.name || 'Financial Institution'}
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', margin: '2px 0 0' }}>
                    Account Statement · Synthetic Financial Records
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', letterSpacing: '0.5px' }}>
                    ACCOUNT STATEMENT
                  </span>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: '#475569', margin: '2px 0 0' }}>
                    Acc: {String(currentStatement.entity_id)}
                  </p>
                </div>
              </div>

              {/* Statement Balance Bar */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, background: '#f8fafc', padding: 14, borderRadius: 8, marginBottom: 20, border: '1px solid #e2e8f0' }}>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block' }}>Opening balance</span>
                  <strong style={{ fontSize: 16, color: '#0f172a' }}>
                    ${parseFloat(currentStatement.opening_balance || '0').toFixed(2)}
                  </strong>
                </div>
                <div>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block' }}>Transactions</span>
                  <strong style={{ fontSize: 16, color: '#0f172a' }}>
                    {filteredTransactions.length} items
                  </strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 10, textTransform: 'uppercase', fontWeight: 700, color: '#64748b', display: 'block' }}>Closing balance</span>
                  <strong style={{ fontSize: 16, color: 'var(--synth)' }}>
                    ${parseFloat(currentStatement.closing_balance || '0').toFixed(2)}
                  </strong>
                </div>
              </div>

              {/* Transactions Ledger Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e2e8f0', background: '#f8fafc' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Date</th>
                    <th style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Description / Reference</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Debit (−)</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Credit (+)</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Running balance</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.map((tx, ti) => {
                    const deb = parseFloat(tx.debit || '0');
                    const cred = parseFloat(tx.credit || '0');
                    return (
                      <tr key={ti} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 11, color: '#475569' }}>
                          {tx.date ? new Date(tx.date).toLocaleDateString() : `Period ${ti + 1}`}
                        </td>
                        <td style={{ padding: '8px 10px', color: '#1e293b' }}>
                          {String(tx.source.description ?? tx.source.merchant ?? tx.source.type ?? `Transaction #${ti + 1}`)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 10px', color: deb > 0 ? '#b91c1c' : '#94a3b8' }}>
                          {deb > 0 ? `−$${deb.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 10px', color: cred > 0 ? '#166534' : '#94a3b8' }}>
                          {cred > 0 ? `+$${cred.toFixed(2)}` : '—'}
                        </td>
                        <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 600, color: '#0f172a' }}>
                          ${parseFloat(tx.balance).toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Empty state before generation */
          <div style={{ padding: 32, textAlign: 'center', background: 'var(--bg-2)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border-default)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-title)', fontWeight: 500, marginBottom: 6 }}>
              Bank statements will be rendered here once generated.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 14 }}>
              Account records and transactions are synthesized with chronological running balance reconciliation.
            </p>
            {onGenerate && (
              <button onClick={onGenerate} style={{ margin: '0 auto', fontSize: 12, padding: '7px 16px' }}>
                Generate data
              </button>
            )}
          </div>
        )
      )}
    </div>
  );
}

