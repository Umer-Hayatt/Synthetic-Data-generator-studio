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
    referenceRowCount,
    generatedRowCount,
  } = useStudio();

  const columnsCount = datasetSpec?.tables[0]?.columns?.length || 0;

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
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>CSV / Sample</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Real Records:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {referenceRowCount || 200}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Synthetic Records:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
                  {generatedRowCount || 200}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Columns:</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 500 }}>
                  {columnsCount || 9}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tables & Schema Structure */}
        <div>
          <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
            Tables in Scope
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {datasetSpec?.tables.map((table, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '11px',
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
