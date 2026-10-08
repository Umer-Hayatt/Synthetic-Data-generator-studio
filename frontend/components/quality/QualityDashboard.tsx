import React, { useState, useMemo } from 'react';
import { useStudio } from '../../context/StudioContext';
import { Check, AlertCircle, RefreshCw } from 'lucide-react';
import { getQualityLabel } from '../../services/qualityLabels';
import { QualityChartsModal } from './QualityChartsModal';
import { ExportModal } from '../export/ExportModal';

export const QualityDashboard: React.FC = () => {
  const {
    qualityResults,
    triggerQualityEvaluation,
    isEvaluatingQuality,
    generatedRowCount,
    generatedColumns,
    generatedPreview,
    datasetSpec,
    sensitiveColumns,
  } = useStudio();

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  // 1. Synthetic rows generated
  const rowCount = generatedRowCount || qualityResults?.synthetic_rows || 0;

  // 2. Quality % and Label
  const overallScore = qualityResults?.overall_score;
  const qualityDisplay = useMemo(() => {
    if (overallScore !== null && overallScore !== undefined && !isNaN(overallScore)) {
      const rounded = Math.round(overallScore);
      const label = getQualityLabel(rounded);
      return `${rounded}% ${label}`;
    }
    if (isEvaluatingQuality) {
      return 'Evaluating...';
    }
    return 'Pending';
  }, [overallScore, isEvaluatingQuality]);

  // 3. Real Privacy check
  const privacyCheck = useMemo<{ status: 'Protected' | 'At Risk'; isProtected: boolean }>(() => {
    // Check A: If backend calculated privacy check exists
    if (qualityResults?.privacy) {
      const isProt = qualityResults.privacy.status === 'Protected';
      return { status: qualityResults.privacy.status, isProtected: isProt };
    }

    // Check B: Verify that any detected sensitive fields are covered by privacy rules
    const table = datasetSpec?.tables?.[0];
    if (table && sensitiveColumns && sensitiveColumns.length > 0) {
      for (const colName of sensitiveColumns) {
        const col = table.columns.find((c) => c.name === colName);
        if (!col) continue;
        const rule = col.privacy_rule;
        const method = typeof rule === 'string' ? rule : rule?.method;
        if (!method || !['mask', 'hash', 'noise'].includes(method)) {
          return { status: 'At Risk', isProtected: false };
        }
      }
    }

    return { status: 'Protected', isProtected: true };
  }, [qualityResults?.privacy, datasetSpec, sensitiveColumns]);

  // 4. Real Integrity check
  const integrityCheck = useMemo<{ status: 'Passed' | 'Warning'; isPassed: boolean }>(() => {
    // Check A: Backend integrity result
    if (qualityResults?.integrity) {
      const isPassed = qualityResults.integrity.status === 'Passed';
      return { status: isPassed ? 'Passed' : 'Warning', isPassed };
    }

    // Check B: Frontend constraints check against generated data
    const table = datasetSpec?.tables?.[0];
    if (table) {
      // Check column preservation
      if (generatedColumns.length > 0) {
        for (const col of table.columns) {
          if (!generatedColumns.includes(col.name)) {
            return { status: 'Warning', isPassed: false };
          }
        }
      }

      // Check unique constraints and non-null constraints on preview
      if (generatedPreview.length > 0) {
        for (const col of table.columns) {
          // Non-null integrity
          if (col.nullable === false) {
            const hasNulls = generatedPreview.some(
              (r) => r[col.name] === null || r[col.name] === undefined
            );
            if (hasNulls) return { status: 'Warning', isPassed: false };
          }

          // Uniqueness integrity
          if (col.constraints?.unique || table.primary_key === col.name) {
            const values = generatedPreview.map((r) => r[col.name]);
            const uniqueSet = new Set(values);
            if (uniqueSet.size < values.length) {
              return { status: 'Warning', isPassed: false };
            }
          }
        }
      }
    }

    return { status: 'Passed', isPassed: true };
  }, [qualityResults?.integrity, datasetSpec, generatedColumns, generatedPreview]);

  if (!rowCount && !qualityResults) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
        No synthetic data generated yet.
      </div>
    );
  }

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
          Synthetic Quality
        </h2>

        {/* 1. Generated rows checkmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', marginBottom: '16px' }}>
          <span style={{ color: 'var(--success)', display: 'inline-flex', alignItems: 'center' }}>
            <Check size={16} strokeWidth={2.5} />
          </span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
            {rowCount} synthetic rows generated
          </span>
        </div>

        {/* 2. Metrics line: Quality, Privacy, Integrity */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            fontSize: '13px',
            marginBottom: '24px',
            flexWrap: 'wrap',
          }}
        >
          {/* Quality */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Quality:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {qualityDisplay}
            </span>
          </div>

          {/* Privacy */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Privacy:</span>
            <span
              style={{
                fontWeight: 600,
                color: privacyCheck.isProtected ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {privacyCheck.status}
            </span>
          </div>

          {/* Integrity */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Integrity:</span>
            <span
              style={{
                fontWeight: 600,
                color: integrityCheck.isPassed ? 'var(--success)' : 'var(--warning)',
              }}
            >
              {integrityCheck.status}
            </span>
          </div>
        </div>

        {/* 3. Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => {
              if (!qualityResults) {
                triggerQualityEvaluation();
              }
              setIsDetailsOpen(true);
            }}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            View details
          </button>
          <button
            onClick={() => setIsExportOpen(true)}
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '7px 14px' }}
          >
            Export
          </button>

          {!qualityResults && (
            <button
              onClick={() => triggerQualityEvaluation()}
              disabled={isEvaluatingQuality}
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '7px 14px' }}
              title="Refresh quality metrics"
            >
              <RefreshCw size={12} className={isEvaluatingQuality ? 'animate-spin' : ''} />
              <span>{isEvaluatingQuality ? 'Evaluating...' : 'Run Quality Checks'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Modals */}
      <QualityChartsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
      />
    </div>
  );
};
