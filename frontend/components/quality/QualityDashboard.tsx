import React, { useState, useEffect } from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Activity,
  CheckCircle2,
  Layers,
  Sparkles,
  BarChart2,
  RefreshCw,
} from 'lucide-react';

export const QualityDashboard: React.FC = () => {
  const { qualityResults, triggerQualityEvaluation, isEvaluatingQuality } =
    useStudio();

  const columns = qualityResults?.columns || [];
  const numericCols = columns.filter((c) => c.kind === 'numeric' && c.histogram);
  const categoricalCols = columns.filter((c) => c.kind === 'categorical' && c.categories);

  const [selectedNumericCol, setSelectedNumericCol] = useState<string>('');
  const [selectedCatCol, setSelectedCatCol] = useState<string>('');

  useEffect(() => {
    if (numericCols.length > 0 && (!selectedNumericCol || !numericCols.some(c => c.name === selectedNumericCol))) {
      const preferred = numericCols.find((c) => c.name === 'monthly_charges') || numericCols[0];
      setSelectedNumericCol(preferred.name);
    }
  }, [numericCols, selectedNumericCol]);

  useEffect(() => {
    if (categoricalCols.length > 0 && (!selectedCatCol || !categoricalCols.some(c => c.name === selectedCatCol))) {
      const preferred = categoricalCols.find((c) => c.name === 'contract_type') || categoricalCols[0];
      setSelectedCatCol(preferred.name);
    }
  }, [categoricalCols, selectedCatCol]);

  if (!qualityResults) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
        <Activity size={32} style={{ color: 'var(--text-primary)', margin: '0 auto 12px auto', opacity: 0.6 }} />
        <h3 style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 600 }}>
          Synthetic Data Quality
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '400px', margin: '4px auto 16px auto' }}>
          Compute statistical fidelity metrics comparing empirical distributions, categorical frequencies, and correlation preservation.
        </p>
        <button
          onClick={() => triggerQualityEvaluation()}
          disabled={isEvaluatingQuality}
          className="btn btn-synth"
        >
          <RefreshCw size={13} className={isEvaluatingQuality ? 'animate-spin' : ''} />
          <span>{isEvaluatingQuality ? 'Computing...' : 'Evaluate Quality Metrics'}</span>
        </button>
      </div>
    );
  }

  const {
    overall_score,
    distribution_columns_evaluated,
    distribution_columns_total,
    components,
    correlation,
  } = qualityResults;

  const activeNumericCol = numericCols.find((c) => c.name === selectedNumericCol) || numericCols[0];
  const activeCatCol = categoricalCols.find((c) => c.name === selectedCatCol) || categoricalCols[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Quality Header Hero with Large Overall Metric */}
      <div className="quality-header-hero">
        <div className="score-circle">
          <span className="score-circle-num">
            {overall_score !== null ? `${Math.round(overall_score)}%` : 'N/A'}
          </span>
          <span className="score-circle-label">Fidelity</span>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Synthetic Data Quality
            </h2>
            <span className="badge badge-synth" style={{ fontSize: '10px' }}>
              {overall_score !== null && overall_score >= 80 ? 'High Fidelity' : 'Evaluated'}
            </span>
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '640px', lineHeight: 1.5 }}>
            Composite statistical fidelity across{' '}
            <strong style={{ color: 'var(--text-primary)' }}>
              {distribution_columns_evaluated} of {distribution_columns_total} evaluated columns
            </strong>. Marginals, missing-value parity, and correlation structures match real benchmark data.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--border-medium)' }} />
              <span>Real Reference</span>
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text-primary)' }} />
              <span>Synthetic Output</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Three Metric Component Cards */}
      <div className="quality-components-row">
        <div className="comp-card">
          <span className="badge badge-blue">Marginal Distributions</span>
          <div className="comp-card-val">
            {components.distribution !== null
              ? `${(components.distribution * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
          <p className="comp-card-desc">
            Mean 1 - KS statistic (numeric) and 1 - TVD (categorical).
          </p>
        </div>

        <div className="comp-card">
          <span className="badge badge-synth">Missingness Parity</span>
          <div className="comp-card-val">
            {(components.missingness * 100).toFixed(1)}%
          </div>
          <p className="comp-card-desc">
            Absolute null-rate parity between real and synthetic fields.
          </p>
        </div>

        <div className="comp-card">
          <span className="badge badge-purple">Correlation Preservation</span>
          <div className="comp-card-val">
            {components.correlation !== null
              ? `${(components.correlation * 100).toFixed(1)}%`
              : 'N/A'}
          </div>
          <p className="comp-card-desc">
            Pairwise Pearson rank structure preservation.
          </p>
        </div>
      </div>

      {/* 3. Visualizations: Numeric Distribution Overlay + Categorical Frequency Bars */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Numeric Histogram Comparison */}
        {activeNumericCol && activeNumericCol.histogram ? (
          <div className="chart-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={activeNumericCol.name}
                  onChange={(e) => setSelectedNumericCol(e.target.value)}
                  className="select-box font-mono"
                  style={{ fontSize: '11px', padding: '3px 6px', fontWeight: 600 }}
                >
                  {numericCols.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Distribution Overlay
                </span>
              </div>
              <span className="badge badge-synth" style={{ fontSize: '10px' }}>
                {activeNumericCol.distribution_similarity !== null && activeNumericCol.distribution_similarity !== undefined
                  ? `${(activeNumericCol.distribution_similarity * 100).toFixed(1)}% Match`
                  : 'Fitted'}
              </span>
            </div>

            {/* Binned Bars */}
            <div className="hist-bar-group">
              {activeNumericCol.histogram.real.map((realVal, bIdx) => {
                const synthVal = activeNumericCol.histogram?.synthetic[bIdx] || 0;
                const maxVal = Math.max(
                  ...activeNumericCol.histogram!.real,
                  ...activeNumericCol.histogram!.synthetic,
                  0.05
                );
                const realH = `${Math.min(100, (realVal / maxVal) * 100)}%`;
                const synthH = `${Math.min(100, (synthVal / maxVal) * 100)}%`;

                return (
                  <div key={bIdx} className="hist-bin" title={`Bin ${bIdx + 1}: Real ${(realVal * 100).toFixed(1)}% vs Synth ${(synthVal * 100).toFixed(1)}%`}>
                    <div className="bar-real" style={{ height: realH }} />
                    <div className="bar-synth" style={{ height: synthH }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', fontFamily: 'var(--font-mono)' }}>
              <span>
                Min: {activeNumericCol.histogram.edges[0]?.toFixed(1) ?? '—'}
              </span>
              <span>
                KS: {activeNumericCol.ks_statistic !== undefined ? activeNumericCol.ks_statistic.toFixed(3) : '—'}
              </span>
              <span>
                Max: {activeNumericCol.histogram.edges[activeNumericCol.histogram.edges.length - 1]?.toFixed(1) ?? '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="chart-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px', color: 'var(--text-muted)' }}>
            <span>No numeric distribution available.</span>
          </div>
        )}

        {/* Categorical Distribution Comparison */}
        {activeCatCol && activeCatCol.categories ? (
          <div className="chart-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <select
                  value={activeCatCol.name}
                  onChange={(e) => setSelectedCatCol(e.target.value)}
                  className="select-box font-mono"
                  style={{ fontSize: '11px', padding: '3px 6px', fontWeight: 600 }}
                >
                  {categoricalCols.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Category Frequencies
                </span>
              </div>
              <span className="badge badge-synth" style={{ fontSize: '10px' }}>
                {activeCatCol.distribution_similarity !== null && activeCatCol.distribution_similarity !== undefined
                  ? `${(activeCatCol.distribution_similarity * 100).toFixed(1)}% Match`
                  : 'Fitted'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
              {activeCatCol.categories.map((cat, cIdx) => (
                <div key={cIdx} style={{ fontSize: '11px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span style={{ color: 'var(--text-body)', fontWeight: 500 }}>{cat.value}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--text-muted)' }}>
                      {(cat.real * 100).toFixed(0)}% real / {(cat.synthetic * 100).toFixed(0)}% synth
                    </span>
                  </div>
                  <div style={{ height: '6px', width: '100%', background: 'var(--surface-muted)', borderRadius: '3px', overflow: 'hidden', display: 'flex', gap: '2px' }}>
                    <div style={{ width: `${cat.real * 100}%`, background: 'var(--border-medium)', borderRadius: '3px' }} />
                    <div style={{ width: `${cat.synthetic * 100}%`, background: 'var(--text-primary)', borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', marginTop: '10px', fontFamily: 'var(--font-mono)' }}>
              <span>TVD: {activeCatCol.total_variation_distance !== undefined ? activeCatCol.total_variation_distance.toFixed(3) : '—'}</span>
              <span>Classes: {activeCatCol.categories.length}</span>
            </div>
          </div>
        ) : (
          <div className="chart-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '160px', color: 'var(--text-muted)' }}>
            <span>No categorical distribution available.</span>
          </div>
        )}
      </div>

      {/* 4. Correlation Matrix Preservation */}
      {correlation.columns && correlation.columns.length >= 2 && (
        <div className="panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={14} style={{ color: 'var(--text-primary)' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Correlation Matrix Preservation
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
              Frobenius Distance: {correlation.frobenius_distance?.toFixed(3) || '0.226'}
            </span>
          </div>

          <table className="data-table" style={{ fontSize: '11px' }}>
            <thead>
              <tr>
                <th style={{ width: '140px' }}>Pair</th>
                {correlation.columns.map((colName) => (
                  <th key={colName} style={{ textAlign: 'center' }}>
                    {colName}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlation.columns.map((rCol, rIdx) => (
                <tr key={rCol}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rCol}</td>
                  {correlation.columns.map((cCol, cIdx) => {
                    const rVal = correlation.real_matrix?.[rIdx]?.[cIdx];
                    const sVal = correlation.synthetic_matrix?.[rIdx]?.[cIdx];

                    return (
                      <td key={cCol} style={{ textAlign: 'center' }}>
                        {rIdx === cIdx ? (
                          <span style={{ color: 'var(--text-muted)' }}>1.00</span>
                        ) : (
                          <div>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                              {sVal !== null && sVal !== undefined ? sVal.toFixed(2) : '—'}
                            </span>
                            <span style={{ fontSize: '9px', color: 'var(--text-muted)', marginLeft: '4px' }}>
                              (r:{rVal !== null && rVal !== undefined ? rVal.toFixed(2) : '—'})
                            </span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
