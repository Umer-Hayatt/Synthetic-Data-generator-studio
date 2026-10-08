import React from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Layers,
  FileSpreadsheet,
  Table2,
  Check,
  Shield,
  Activity,
  Info,
} from 'lucide-react';

export const SidebarNav: React.FC = () => {
  const {
    datasetName,
    datasetSpec,
    activeSource,
    referenceRowCount,
    generatedRowCount,
    setActiveTab,
  } = useStudio();

  const columnsCount = datasetSpec?.tables[0]?.columns?.length || 0;
  const docsCount = datasetSpec?.documents?.length || 0;

  return (
    <aside className="sidebar-left">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Dataset Summary Card */}
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
            Active Dataset
          </div>

          <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <FileSpreadsheet size={15} style={{ color: 'var(--text-primary)' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                {datasetName || 'customer_churn'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11px', borderTop: '1px solid var(--border-subtle)', paddingTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Source:</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  {activeSource?.kind === 'demo' ? 'Demo' : activeSource?.kind === 'upload' ? 'Uploaded file / sample' : activeSource?.kind === 'prompt' ? 'AI Prompt' : 'Not selected'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Real Records:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {referenceRowCount}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Synthetic Records:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {generatedRowCount}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Columns:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {columnsCount}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tables & Schema Structure */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Tables in Scope
            </span>
            <button
              onClick={() => setActiveTab('relational')}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '10px', padding: '1px 6px', color: 'var(--text-primary)' }}
            >
              Relational View →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {datasetSpec?.tables.map((table, i) => (
              <div
                key={i}
                onClick={() => setActiveTab('relational')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Table2 size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                    {table.name}
                  </span>
                </div>
                <span className="badge badge-slate" style={{ fontSize: '9px' }}>
                  {table.columns.length} cols
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Reconciled Documents in Scope */}
        {docsCount > 0 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Documents ({docsCount})
              </span>
              <button
                onClick={() => setActiveTab('documents')}
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '10px', padding: '1px 6px', color: 'var(--text-primary)' }}
              >
                View Docs →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {datasetSpec?.documents?.map((doc, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveTab('documents')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    fontSize: '11px',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {doc.kind === 'invoice' ? '🧾 Invoices' : '🏦 Bank Statements'}
                  </span>
                  <span className="badge badge-synth" style={{ fontSize: '9px' }}>
                    Reconciled
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Subtle Technical Footer */}
      <div style={{ padding: '10px', background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', fontSize: '10px', color: 'var(--text-muted)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 600, marginBottom: '2px' }}>
          <Check size={12} />
          <span>Fidelity Engine Active</span>
        </div>
        <span>Gaussian Copula empirical quantile fitting with strict test-set isolation.</span>
      </div>
    </aside>
  );
};
