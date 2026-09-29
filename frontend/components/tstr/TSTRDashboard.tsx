import React, { useState, useEffect } from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  BrainCircuit,
  Play,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Info,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { MetricComparisonItem } from '../../types';

export const TSTRDashboard: React.FC = () => {
  const {
    tstrResults,
    triggerTstrEvaluation,
    isEvaluatingTstr,
    referenceToken,
    datasetSpec,
  } = useStudio();

  const [selectedTarget, setSelectedTarget] = useState<string>('churn');
  const [taskMode, setTaskMode] = useState<'auto' | 'classification' | 'regression'>('auto');

  const columns = datasetSpec?.tables[0]?.columns || [];
  const candidates = tstrResults?.target_candidates || [];

  // Initialize or update default target when candidates or columns load
  useEffect(() => {
    if (tstrResults?.target) {
      setSelectedTarget(tstrResults.target);
    } else if (candidates.length > 0 && !selectedTarget) {
      setSelectedTarget(candidates[0].name);
    } else if (!selectedTarget && columns.length > 0) {
      // Find a categorical or binary column, or first column
      const defaultCol =
        columns.find((c) => c.name.toLowerCase().includes('churn')) ||
        columns.find((c) => c.name.toLowerCase().includes('target')) ||
        columns.find((c) => c.semantic_type === 'categorical') ||
        columns[columns.length - 1];
      if (defaultCol) {
        setSelectedTarget(defaultCol.name);
      }
    }
  }, [tstrResults?.target, candidates, columns]);

  const handleRunTstr = () => {
    triggerTstrEvaluation(selectedTarget, taskMode, 42);
  };

  const formatMetricName = (key: string): string => {
    switch (key.toLowerCase()) {
      case 'accuracy':
        return 'Classification Accuracy';
      case 'macro_f1':
        return 'Macro F1-Score';
      case 'weighted_f1':
        return 'Weighted F1-Score';
      case 'roc_auc':
        return 'ROC-AUC';
      case 'mae':
        return 'Mean Absolute Error (MAE)';
      case 'rmse':
        return 'Root Mean Squared Error (RMSE)';
      case 'r2':
        return 'R² Determination';
      default:
        return key.toUpperCase();
    }
  };

  const renderMetricCard = (key: string, comp: MetricComparisonItem) => {
    const isHigherBetter = comp.direction === 'higher_is_better';
    const hasRetention = comp.retention_ratio !== undefined && comp.retention_ratio !== null;
    const delta = comp.delta;
    const isPositiveDelta = delta !== null && delta !== undefined && delta > 0;
    const deltaFormatted =
      delta !== null && delta !== undefined
        ? `${delta > 0 ? '+' : ''}${delta.toFixed(3)}`
        : '—';

    // Delta color: for higher_is_better, positive delta is green, negative is amber/rose
    // for lower_is_better (MAE, RMSE), negative delta (lower error) is green, positive is amber
    let deltaColor = 'var(--text-muted)';
    if (delta !== null && delta !== undefined) {
      if (isHigherBetter) {
        deltaColor = delta >= -0.05 ? 'var(--synth)' : 'var(--amber)';
      } else {
        deltaColor = delta <= 0 ? 'var(--synth)' : 'var(--amber)';
      }
    }

    return (
      <div key={key} className="tstr-card">
        <div className="tstr-card-header">
          <span>{formatMetricName(key)}</span>
          {hasRetention ? (
            <span className="badge badge-synth">
              {(comp.retention_ratio! * 100).toFixed(1)}% Retained
            </span>
          ) : (
            <span className="badge badge-slate" style={{ fontSize: '9px' }}>
              {isHigherBetter ? 'Higher is better' : 'Lower is better'}
            </span>
          )}
        </div>

        <div className="tstr-comparison-grid">
          <div className="tstr-metric-box">
            <span className="tstr-box-label">Real Train (TRTR)</span>
            <span className="tstr-box-val" style={{ color: 'var(--real)' }}>
              {comp.trtr !== null && comp.trtr !== undefined ? comp.trtr.toFixed(3) : 'N/A'}
            </span>
          </div>

          <div className="tstr-metric-box">
            <span className="tstr-box-label">Synthetic Train (TSTR)</span>
            <span className="tstr-box-val" style={{ color: 'var(--synth)' }}>
              {comp.tstr !== null && comp.tstr !== undefined ? comp.tstr.toFixed(3) : 'N/A'}
            </span>
          </div>
        </div>

        <div className="tstr-retention-pill">
          <span style={{ color: 'var(--text-muted)' }}>Delta (TSTR - TRTR):</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: deltaColor }}>
            {deltaFormatted}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Header & Quick Target Control */}
      <div className="tstr-hero">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-title)' }}>
              ML Utility
            </h2>
            <span className="badge badge-purple" style={{ fontSize: '10px' }}>
              Organizer Mandate
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Train on Synthetic, Test on Real (TSTR) — Quantifying downstream predictive power without test leakage.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Target Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Target:</span>
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="select-box font-mono"
              style={{ fontSize: '11px', padding: '4px 8px', maxWidth: '180px' }}
            >
              {candidates.length > 0 ? (
                <>
                  <optgroup label="Suggested Targets">
                    {candidates.map((cand) => (
                      <option key={cand.name} value={cand.name}>
                        {cand.name} ({cand.suggested_task})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="All Columns">
                    {columns
                      .filter((c) => !candidates.some((cand) => cand.name === c.name))
                      .map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                  </optgroup>
                </>
              ) : (
                columns.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Task Mode Toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Task:</span>
            <select
              value={taskMode}
              onChange={(e) => setTaskMode(e.target.value as any)}
              className="select-box"
              style={{ fontSize: '11px', padding: '4px 8px' }}
            >
              <option value="auto">Auto</option>
              <option value="classification">Classification</option>
              <option value="regression">Regression</option>
            </select>
          </div>

          <button
            onClick={handleRunTstr}
            disabled={isEvaluatingTstr}
            className="btn btn-primary btn-sm"
          >
            <Play size={11} />
            <span>{isEvaluatingTstr ? 'Evaluating...' : 'Run TSTR'}</span>
          </button>
        </div>
      </div>

      {/* 2. Core Explanation Banner for Non-ML Judges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-1)', border: '1px solid var(--synth-border)', borderRadius: 'var(--radius-sm)' }}>
        <CheckCircle2 size={18} style={{ color: 'var(--synth)', flexShrink: 0 }} />
        <div style={{ fontSize: '12px', color: 'var(--text-body)' }}>
          <strong style={{ color: 'var(--text-title)' }}>Rigorous Test Invariant: </strong>
          Both models are evaluated against the{' '}
          <strong style={{ color: 'var(--synth)' }}>same untouched real test set</strong>. The synthesizer learned strictly from Real Train data with zero test-set leakage.
        </div>
      </div>

      {/* 3. TSTR Status: Unavailable or Available Cards */}
      {tstrResults?.status === 'unavailable' ? (
        <div className="panel" style={{ textAlign: 'center', padding: '32px 20px', borderColor: 'var(--amber-border)', background: 'var(--amber-soft)' }}>
          <AlertTriangle size={24} style={{ color: 'var(--amber)', margin: '0 auto 8px auto' }} />
          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
            TSTR Evaluation Unavailable
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-body)', marginTop: '4px', maxWidth: '480px', margin: '4px auto 14px auto' }}>
            {tstrResults.reason || 'The selected column cannot be evaluated as an ML target. Please choose a different target column with at least 2 distinct classes and sufficient samples.'}
          </p>
        </div>
      ) : tstrResults?.comparison && Object.keys(tstrResults.comparison).length > 0 ? (
        <div className="tstr-cards-row">
          {Object.entries(tstrResults.comparison).map(([key, comp]) =>
            renderMetricCard(key, comp)
          )}
        </div>
      ) : (
        <div className="panel" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <BrainCircuit size={28} style={{ color: 'var(--purple)', margin: '0 auto 8px auto', opacity: 0.7 }} />
          <p style={{ fontSize: '13px', color: 'var(--text-title)', fontWeight: 500 }}>
            No TSTR evaluation run yet.
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Select a target feature above and click &quot;Run TSTR&quot; to benchmark synthetic utility.
          </p>
        </div>
      )}

      {/* 4. Split Invariant & Pipeline Details */}
      <div className="panel" style={{ fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, color: 'var(--text-title)' }}>
            Evaluation Pipeline Specification
          </span>
          <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            Seed: {tstrResults?.seed ?? 42}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', background: 'var(--bg-0)', padding: '10px 14px', borderRadius: 'var(--radius-xs)' }}>
          <div>
            <span style={{ color: 'var(--text-faint)', display: 'block' }}>Real Train (80%)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--real)' }}>
              {tstrResults?.rows?.real_train !== undefined
                ? `${tstrResults.rows.real_train} rows`
                : '160 rows'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-faint)', display: 'block' }}>Synthetic Train</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--synth)' }}>
              {tstrResults?.rows?.synthetic_train !== undefined
                ? `${tstrResults.rows.synthetic_train} rows`
                : '160 rows'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-faint)', display: 'block' }}>Real Test (20%)</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--blue)' }}>
              {tstrResults?.rows?.real_test !== undefined
                ? `${tstrResults.rows.real_test} rows`
                : '40 rows'}
            </span>
          </div>
          <div>
            <span style={{ color: 'var(--text-faint)', display: 'block' }}>Model Architecture</span>
            <span style={{ fontWeight: 500, color: 'var(--text-title)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tstrResults?.model || 'RandomForest'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
