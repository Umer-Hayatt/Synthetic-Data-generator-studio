import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { ColumnSpec } from '../../types';
import {
  Key,
  Shield,
  Hash,
  Type,
  Calendar,
  DollarSign,
  User,
  Sliders,
} from 'lucide-react';

export const SchemaInspector: React.FC = () => {
  const { datasetSpec, updateColumnConfig } = useStudio();

  if (!datasetSpec || !datasetSpec.tables.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        No schema active.
      </div>
    );
  }

  const table = datasetSpec.tables[0];

  const handlePrivacyChange = (colName: string, method: string) => {
    if (method === 'none') {
      updateColumnConfig(colName, { privacy_rule: null });
    } else if (method === 'mask') {
      updateColumnConfig(colName, { privacy_rule: { method: 'mask', mask_value: '***' } });
    } else if (method === 'hash') {
      updateColumnConfig(colName, { privacy_rule: { method: 'hash' } });
    } else if (method === 'noise') {
      updateColumnConfig(colName, { privacy_rule: { method: 'noise', noise_std: 1.0 } });
    }
  };

  const getPrivacyValue = (col: ColumnSpec): string => {
    if (!col.privacy_rule) return 'none';
    if (typeof col.privacy_rule === 'string') return col.privacy_rule;
    return col.privacy_rule.method;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>
            Column Schema & Statistical Properties
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Inferred semantic types, distribution parameters, bounds, and column-level privacy rules.
          </p>
        </div>
        <span className="badge badge-slate" style={{ fontSize: '11px', padding: '3px 8px' }}>
          {table.columns.length} columns defined
        </span>
      </div>

      <div className="schema-grid">
        {table.columns.map((col) => {
          const isNumeric = col.dtype === 'integer' || col.dtype === 'float';
          const privacyVal = getPrivacyValue(col);

          return (
            <div key={col.name} className="schema-field-card">
              {/* Column Name & Type Pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {col.constraints.unique && (
                    <span title="Unique Key">
                      <Key size={13} style={{ color: 'var(--warning)' }} />
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {col.name}
                  </span>
                </div>

                <span
                  className={`badge ${
                    isNumeric
                      ? 'badge-blue'
                      : col.semantic_type === 'categorical'
                      ? 'badge-purple'
                      : 'badge-slate'
                  }`}
                >
                  {col.semantic_type}
                </span>
              </div>

              {/* Statistical / Range Properties */}
              <div className="field-meta-group">
                {isNumeric ? (
                  <>
                    <div className="field-stat">
                      <span className="field-stat-label">Observed Range</span>
                      <span className="field-stat-val">
                        {col.constraints.min !== undefined && col.constraints.max !== undefined
                          ? `${col.constraints.min} – ${col.constraints.max}`
                          : 'Dynamic'}
                      </span>
                    </div>

                    <div className="field-stat">
                      <span className="field-stat-label">Mean</span>
                      <span className="field-stat-val">
                        {col.distribution?.mean !== undefined
                          ? col.distribution.mean.toFixed(2)
                          : '—'}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="field-stat">
                      <span className="field-stat-label">Categories</span>
                      <span className="field-stat-val" style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {col.constraints.categories?.slice(0, 3).join(' / ') || 'Dynamic'}
                        {(col.constraints.categories?.length || 0) > 3 ? '...' : ''}
                      </span>
                    </div>

                    <div className="field-stat">
                      <span className="field-stat-label">Unique Values</span>
                      <span className="field-stat-val">
                        {col.constraints.categories?.length || '—'}
                      </span>
                    </div>
                  </>
                )}

                <div className="field-stat">
                  <span className="field-stat-label">Missing</span>
                  <span className="field-stat-val">
                    {((col.null_rate || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              {/* Privacy Transformation Control */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={13} style={{ color: privacyVal !== 'none' ? 'var(--success)' : 'var(--text-muted)' }} />
                <select
                  value={privacyVal}
                  onChange={(e) => handlePrivacyChange(col.name, e.target.value)}
                  className="select-box font-mono"
                  style={{ fontSize: '11px', padding: '4px 8px' }}
                >
                  <option value="none">Privacy: None</option>
                  <option value="mask">Mask (***)</option>
                  <option value="hash">Hash (SHA-256)</option>
                  {isNumeric && <option value="noise">Gaussian Noise (1.0σ)</option>}
                </select>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
