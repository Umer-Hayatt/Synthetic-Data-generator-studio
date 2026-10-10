import React from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Sliders,
  Shuffle,
  RefreshCw,
} from 'lucide-react';

export const ConfigPanel: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const {
    datasetSpec,
    updateGlobalConfig,
    triggerGenerate,
    isGenerating,
    generatedRowCount,
  } = useStudio();

  if (!datasetSpec || !datasetSpec.tables.length) {
    return null;
  }

  const table = datasetSpec.tables[0];
  const rowCount = table.row_count;
  const seed = datasetSpec.seed;

  const randomizeSeed = () => {
    updateGlobalConfig({ seed: Math.floor(Math.random() * 90000) + 1000 });
  };

  const Container = embedded ? 'div' : 'aside';
  return (
    <Container className={embedded ? 'generation-settings' : 'sidebar-right'}>
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
            <label htmlFor="generation-row-count" style={{ fontSize: '11px', color: 'var(--text-body)', fontWeight: 500 }}>
              Synthetic Rows
            </label>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              {rowCount.toLocaleString()}
            </span>
          </div>
          <input
            id="generation-row-count"
            type="range"
            min={1}
            max={Math.max(50000, rowCount)}
            step={rowCount < 50 ? 1 : 50}
            value={rowCount}
            onChange={(e) => updateGlobalConfig({ rowCount: Math.max(1, Number(e.target.value)) })}
            className="range-slider"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
            <span>1</span>
            <span>25,000</span>
            <span>{Math.max(50000, rowCount).toLocaleString()}</span>
          </div>
        </div>

        {/* Setting 2: Random Seed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label htmlFor="generation-seed" style={{ fontSize: '11px', color: 'var(--text-body)', fontWeight: 500 }}>
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
            id="generation-seed"
            type="number"
            value={seed}
            onChange={(e) => updateGlobalConfig({ seed: Number(e.target.value) })}
            className="input-text font-mono"
            style={{ width: '100%' }}
          />
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
          <span>{isGenerating ? 'Synthesizing...' : (generatedRowCount > 0 ? 'Regenerate Dataset' : 'Generate Dataset')}</span>
        </button>
      </div>
    </Container>
  );
};
