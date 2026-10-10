import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { Key, X, Sliders } from 'lucide-react';
import { ColumnDType, SemanticType } from '../../types';

interface SchemaModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVAILABLE_DTYPES: ColumnDType[] = ['integer', 'float', 'string', 'boolean', 'datetime'];
const AVAILABLE_SEMANTICS: SemanticType[] = [
  'generic_text',
  'numeric',
  'categorical',
  'datetime',
  'id',
  'person_name',
  'email',
  'phone',
  'money',
];

export const SchemaModal: React.FC<SchemaModalProps> = ({ isOpen, onClose }) => {
  const { datasetSpec, updateColumnConfig } = useStudio();

  if (!isOpen || !datasetSpec || !datasetSpec.tables.length) return null;

  const table = datasetSpec.tables[0];

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: '720px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              <Sliders size={14} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Dataset Schema ({table.columns.length} columns)
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Inferred column types, semantic classification, and distribution bounds
              </span>
            </div>
          </div>
          <button aria-label="Close schema" onClick={onClose} className="btn-ghost" style={{ padding: '4px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Column List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {table.columns.map((col) => {
            const isNumeric = col.dtype === 'integer' || col.dtype === 'float';
            const categories = col.constraints?.categories ?? col.distribution?.values;

            return (
              <div
                key={col.name}
                style={{
                  background: 'var(--surface-muted)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {/* Column identity */}
                <div style={{ minWidth: '180px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {col.constraints?.unique && (
                      <span title="Unique Key">
                        <Key size={13} style={{ color: 'var(--warning)' }} />
                      </span>
                    )}
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {col.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                    <span className="badge badge-slate" style={{ fontSize: '9px' }}>
                      {col.dtype}
                    </span>
                    <span
                      className={`badge ${
                        isNumeric
                          ? 'badge-blue'
                          : col.semantic_type === 'categorical'
                          ? 'badge-purple'
                          : 'badge-slate'
                      }`}
                      style={{ fontSize: '9px' }}
                    >
                      {col.semantic_type}
                    </span>
                  </div>
                </div>

                {/* Statistical / Observed range */}
                <div style={{ flex: 1, fontSize: '11px', color: 'var(--text-body)' }}>
                  {isNumeric ? (
                    <div>
                      <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Range:</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {col.constraints?.min != null && col.constraints?.max != null
                          ? `${col.constraints.min} – ${col.constraints.max}`
                          : 'Dynamic'}
                      </span>
                      {col.distribution?.mean != null && (
                        <span style={{ marginLeft: '12px', color: 'var(--text-muted)' }}>
                          Mean: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{col.distribution.mean.toFixed(2)}</span>
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <span style={{ color: 'var(--text-muted)', marginRight: '6px' }}>Categories:</span>
                      <span>
                        {categories?.slice(0, 3).join(', ') || 'Dynamic'}
                        {(categories?.length || 0) > 3 ? '...' : ''}
                      </span>
                    </div>
                  )}
                  <div style={{ marginTop: '2px', color: 'var(--text-muted)' }}>
                    Missing: {((col.null_rate || 0) * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Edit Select Controls */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <select
                    value={col.dtype}
                    onChange={(e) => updateColumnConfig(col.name, { dtype: e.target.value as ColumnDType })}
                    className="select-box font-mono"
                    style={{ fontSize: '11px', padding: '3px 6px' }}
                  >
                    {AVAILABLE_DTYPES.map((dt) => (
                      <option key={dt} value={dt}>
                        {dt}
                      </option>
                    ))}
                  </select>
                  <select
                    value={col.semantic_type}
                    onChange={(e) => updateColumnConfig(col.name, { semantic_type: e.target.value as SemanticType })}
                    className="select-box font-mono"
                    style={{ fontSize: '11px', padding: '3px 6px' }}
                  >
                    {AVAILABLE_SEMANTICS.map((sem) => (
                      <option key={sem} value={sem}>
                        {sem}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <button onClick={onClose} className="btn btn-secondary">
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
