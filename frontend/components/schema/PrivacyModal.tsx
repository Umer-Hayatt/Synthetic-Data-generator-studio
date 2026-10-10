import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { Shield, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { ColumnSpec } from '../../types';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  sensitiveColumns: Set<string>;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose, sensitiveColumns }) => {
  const { datasetSpec, updateColumnConfig } = useStudio();

  if (!isOpen || !datasetSpec || !datasetSpec.tables.length) return null;

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

  const applyDefaultToAllSensitive = () => {
    table.columns.forEach((col) => {
      if (sensitiveColumns.has(col.name)) {
        if (col.constraints?.unique) {
          updateColumnConfig(col.name, { privacy_rule: { method: 'hash' } });
        } else {
          updateColumnConfig(col.name, { privacy_rule: { method: 'mask', mask_value: '***' } });
        }
      }
    });
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ maxWidth: '680px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--surface-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-primary)' }}>
              <Shield size={14} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Privacy Settings
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Configure masking, hashing, and noise injection for sensitive and PII columns
              </span>
            </div>
          </div>
          <button aria-label="Close privacy settings" onClick={onClose} className="btn-ghost" style={{ padding: '4px', cursor: 'pointer', border: 'none', background: 'transparent', color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* Quick action bar if sensitive fields exist */}
        {sensitiveColumns.size > 0 && (
          <div
            style={{
              marginBottom: '12px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--surface-muted)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
              <ShieldAlert size={14} style={{ color: 'var(--warning)' }} />
              <span>
                <strong>{sensitiveColumns.size}</strong> sensitive {sensitiveColumns.size === 1 ? 'field' : 'fields'} detected in this dataset.
              </span>
            </div>
            <button
              onClick={applyDefaultToAllSensitive}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '11px' }}
            >
              Protect All Sensitive Fields
            </button>
          </div>
        )}

        {/* Scrollable Columns List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', paddingRight: '4px' }}>
          {table.columns.map((col) => {
            const isSensitive = sensitiveColumns.has(col.name);
            const isNumeric = col.dtype === 'integer' || col.dtype === 'float';
            const privacyVal = getPrivacyValue(col);

            return (
              <div
                key={col.name}
                style={{
                  background: isSensitive ? 'var(--surface-muted)' : 'var(--surface)',
                  border: isSensitive ? '1px solid var(--border-medium)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '12px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                {/* Column details */}
                <div style={{ minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {col.name}
                    </span>
                    {isSensitive ? (
                      <span className="badge badge-amber" style={{ fontSize: '9px' }}>
                        Sensitive PII
                      </span>
                    ) : (
                      <span className="badge badge-slate" style={{ fontSize: '9px' }}>
                        Standard
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Type: {col.dtype} ({col.semantic_type})
                  </div>
                </div>

                {/* Privacy control */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span title={privacyVal !== 'none' ? 'Protection enabled' : 'No protection'}>
                    {privacyVal !== 'none' ? (
                      <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Shield size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </span>
                  <select
                    value={privacyVal}
                    onChange={(e) => handlePrivacyChange(col.name, e.target.value)}
                    className="select-box font-mono"
                    style={{ fontSize: '11px', padding: '5px 8px', minWidth: '170px' }}
                  >
                    <option value="none">None (Synthetic)</option>
                    <option value="mask">Mask (***)</option>
                    <option value="hash">Hash (SHA-256)</option>
                    {isNumeric && <option value="noise">Gaussian Noise (1.0s)</option>}
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
