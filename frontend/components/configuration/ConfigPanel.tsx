import React, { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Sliders,
  Shuffle,
  Shield,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Cpu,
} from 'lucide-react';

export const ConfigPanel: React.FC = () => {
  const {
    datasetSpec,
    updateGlobalConfig,
    triggerGenerate,
    isGenerating,
  } = useStudio();

  const [techDetailsOpen, setTechDetailsOpen] = useState(false);

  if (!datasetSpec || !datasetSpec.tables.length) {
    return null;
  }

  const table = datasetSpec.tables[0];
  const rowCount = table.row_count;
  const seed = datasetSpec.seed;

  // Calculate privacy transformations count
  const privacyCounts = table.columns.reduce(
    (acc, col) => {
      const method =
        typeof col.privacy_rule === 'string'
          ? col.privacy_rule
          : col.privacy_rule?.method;
      if (method === 'mask') acc.mask++;
      if (method === 'hash') acc.hash++;
      if (method === 'noise') acc.noise++;
      return acc;
    },
    { mask: 0, hash: 0, noise: 0 }
  );

  const randomizeSeed = () => {
    updateGlobalConfig({ seed: Math.floor(Math.random() * 90000) + 1000 });
  };

  return (
    <aside className="sidebar-right">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sliders size={14} style={{ color: 'var(--text-primary)' }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Generation Settings
            </span>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            seed:{seed}
          </span>
        </div>

        {/* Setting 1: Row Count */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-body)', fontWeight: 500 }}>
              Synthetic Rows
            </label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {rowCount.toLocaleString()}
            </span>
          </div>
          <input
            type="range"
            min={50}
            max={5000}
            step={50}
            value={rowCount}
            onChange={(e) => updateGlobalConfig({ rowCount: Number(e.target.value) })}
            className="range-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>50</span>
            <span>2,500</span>
            <span>5,000</span>
          </div>
        </div>

        {/* Setting 2: Random Seed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', color: 'var(--text-body)', fontWeight: 500 }}>
              Deterministic Seed
            </label>
            <button
              onClick={randomizeSeed}
              className="btn btn-ghost btn-sm"
              style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--text-primary)' }}
              title="Pick random seed"
            >
              <Shuffle size={11} />
              <span>Randomize</span>
            </button>
          </div>
          <input
            type="number"
            value={seed}
            onChange={(e) => updateGlobalConfig({ seed: Number(e.target.value) })}
            className="input-text font-mono"
            style={{ width: '100%' }}
          />
        </div>

        {/* Setting 3: Privacy Controls Summary */}
        <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <Shield size={13} style={{ color: 'var(--text-primary)' }} />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Active Privacy Rules
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', textAlign: 'center' }}>
            <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>MASK</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {privacyCounts.mask}
              </span>
            </div>
            <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>HASH</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {privacyCounts.hash}
              </span>
            </div>
            <div style={{ background: 'var(--surface)', padding: '6px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border-subtle)' }}>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block' }}>NOISE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {privacyCounts.noise}
              </span>
            </div>
          </div>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', marginTop: '8px' }}>
            Configure rules per column in the Schema tab.
          </span>
        </div>

        {/* Collapsed Secondary Technical Details */}
        <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', overflow: 'hidden' }}>
          <button
            onClick={() => setTechDetailsOpen(!techDetailsOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              background: 'var(--surface-muted)',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Cpu size={12} />
              <span>Synthesis Engine Info</span>
            </div>
            {techDetailsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>

          {techDetailsOpen && (
            <div style={{ padding: '10px', background: 'var(--surface)', fontSize: '10px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div>• Copula: Gaussian Correlation matrix</div>
              <div>• Marginals: 101 Empirical Quantiles</div>
              <div>• Identity: Rule-based Faker synthesis</div>
              <div>• Hardware: CPU-Safe, zero GPU dependency</div>
            </div>
          )}
        </div>
      </div>

      {/* Primary Action Button */}
      <div style={{ paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={() => triggerGenerate()}
          disabled={isGenerating}
          className="btn btn-synth"
          style={{ width: '100%', padding: '10px', fontSize: '13px' }}
        >
          <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
          <span>{isGenerating ? 'Synthesizing...' : 'Regenerate Dataset'}</span>
        </button>
      </div>
    </aside>
  );
};
