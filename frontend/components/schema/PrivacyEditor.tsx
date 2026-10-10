import React, { useMemo } from 'react';
import { displayLabel, displayType } from '../../services/displayLabels';
import { useStudio } from '../../context/StudioContext';
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ColumnSpec } from '../../types';

export const PrivacyEditor: React.FC = () => {
  const { datasetSpec, updateColumnConfig, sensitiveColumns: detected, inferredSchema } = useStudio();
  const sensitiveColumns = useMemo(() => {
    const names = new Set(detected);
    if (Array.isArray(inferredSchema)) inferredSchema.forEach((column: { name: string; is_sensitive?: boolean }) => {
      if (column.is_sensitive) names.add(column.name);
    });
    datasetSpec?.tables[0]?.columns.forEach(column => {
      if (['person_name', 'email', 'phone', 'address'].includes(column.semantic_type) ||
        /email|phone|ssn|credit_card/i.test(column.name)) names.add(column.name);
    });
    return names;
  }, [detected, inferredSchema, datasetSpec]);

  if (!datasetSpec?.tables.length) return null;

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
      <section aria-label="Privacy Settings" className="dataset-editor workspace-editor">
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
        </div>

        {/* Quick action bar if sensitive fields exist */}
        {sensitiveColumns.size > 0 && (
          <div
            style={{
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '10px',
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
                className="editor-row"
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
                <div className="editor-identity" style={{ minWidth: '220px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                      {displayLabel(col.name)}
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
                    Type: {displayType(col.dtype)} ({displayType(col.semantic_type)})
                  </div>
                </div>

                {/* Privacy control */}
                <div className="editor-controls" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span title={privacyVal !== 'none' ? 'Protection enabled' : 'No protection'}>
                    {privacyVal !== 'none' ? (
                      <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
                    ) : (
                      <Shield size={16} style={{ color: 'var(--text-muted)' }} />
                    )}
                  </span>
                  <select
                    aria-label={`${displayLabel(col.name)} Privacy Method`}
                    value={privacyVal}
                    onChange={(e) => handlePrivacyChange(col.name, e.target.value)}
                    className="select-box font-mono"
                    style={{ fontSize: '11px', padding: '5px 8px', minWidth: '170px' }}
                  >
                    <option value="none">None — Synthetic Data</option>
                    <option value="mask">Mask (***)</option>
                    <option value="hash">Hash (SHA-256)</option>
                    {isNumeric && <option value="noise">Gaussian Noise (Standard Deviation: 1)</option>}
                  </select>
                </div>
              </div>
            );
          })}
        </div>

      </section>
  );
};
