import React, { useState, useMemo } from 'react';
import { useStudio } from '../../context/StudioContext';
import { Check, AlertCircle } from 'lucide-react';
import { SchemaModal } from './SchemaModal';
import { PrivacyModal } from './PrivacyModal';

export const SchemaInspector: React.FC = () => {
  const { datasetSpec, inferredSchema, sensitiveColumns } = useStudio();
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  if (!datasetSpec || !datasetSpec.tables.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        No schema active.
      </div>
    );
  }

  const table = datasetSpec.tables[0];
  const columnsCount = table.columns.length;

  // Determine sensitive column names from context or inferred schema
  const detectedSensitiveSet = useMemo(() => {
    const set = new Set<string>();
    if (sensitiveColumns && sensitiveColumns.length > 0) {
      sensitiveColumns.forEach((c) => set.add(c));
    }
    if (Array.isArray(inferredSchema)) {
      inferredSchema.forEach((col: any) => {
        if (col.is_sensitive) set.add(col.name);
      });
    }
    // Fallback: check table columns semantic types or names if inferredSchema metadata was not available
    table.columns.forEach((col) => {
      const lower = col.name.toLowerCase();
      if (
        ['email', 'phone', 'person_name', 'address'].includes(col.semantic_type) ||
        lower.includes('email') ||
        lower.includes('phone') ||
        lower.includes('ssn') ||
        lower.includes('credit_card')
      ) {
        set.add(col.name);
      }
    });
    return set;
  }, [sensitiveColumns, inferredSchema, table.columns]);

  const sensitiveCount = detectedSensitiveSet.size;

  // Privacy protection is configured when all detected sensitive fields have a privacy action applied (or there are no sensitive fields)
  const isPrivacyConfigured = useMemo(() => {
    if (sensitiveCount === 0) return true;
    for (const colName of Array.from(detectedSensitiveSet)) {
      const col = table.columns.find((c) => c.name === colName);
      if (!col) continue;
      const rule = col.privacy_rule;
      const method = typeof rule === 'string' ? rule : rule?.method;
      if (!method || !['mask', 'hash', 'noise'].includes(method)) {
        return false;
      }
    }
    return true;
  }, [detectedSensitiveSet, sensitiveCount, table.columns]);

  return (
    <div style={{ maxWidth: '640px', margin: '20px 0' }}>
      <div
        className="card"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '24px 28px',
        }}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            marginBottom: '18px',
          }}
        >
          Schema &amp; Privacy
        </h2>

        {/* Checklist */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          {/* 1. Columns detected */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center' }}>
              <Check size={16} strokeWidth={2.5} />
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {columnsCount} columns detected
            </span>
          </div>

          {/* 2. Schema configured */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center' }}>
              <Check size={16} strokeWidth={2.5} />
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              Schema automatically configured
            </span>
          </div>

          {/* 3. Sensitive fields detected */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center' }}>
              <Check size={16} strokeWidth={2.5} />
            </span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
              {sensitiveCount} sensitive {sensitiveCount === 1 ? 'field' : 'fields'} detected
            </span>
          </div>

          {/* 4. Privacy protection configured */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            {isPrivacyConfigured ? (
              <>
                <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center' }}>
                  <Check size={16} strokeWidth={2.5} />
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                  Privacy protection configured
                </span>
              </>
            ) : (
              <>
                <span style={{ color: 'var(--warning)', display: 'inline-flex', alignItems: 'center' }}>
                  <AlertCircle size={16} strokeWidth={2.5} />
                </span>
                <span style={{ color: 'var(--warning)', fontWeight: 500 }}>
                  Privacy protection not configured
                </span>
              </>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setIsSchemaModalOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            View / Edit Schema
          </button>
          <button
            onClick={() => setIsPrivacyModalOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            Privacy Settings
          </button>
        </div>
      </div>

      {/* Modals */}
      <SchemaModal
        isOpen={isSchemaModalOpen}
        onClose={() => setIsSchemaModalOpen(false)}
      />
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
        sensitiveColumns={detectedSensitiveSet}
      />
    </div>
  );
};
