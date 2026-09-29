import React from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Database,
  Download,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

interface HeaderProps {
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExport }) => {
  const {
    datasetName,
    referenceToken,
    generatedToken,
    backendOnline,
    tokenExpirySeconds,
    clearSession,
    triggerGenerate,
    isGenerating,
    activeMode,
    setActiveMode,
  } = useStudio();

  return (
    <header className="top-bar">
      {/* Left: Branding & Dataset Name */}
      <div className="top-bar-left">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #2563eb, #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Database size={16} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)', letterSpacing: '-0.3px' }}>
            Synthetic Data Studio
          </span>
          <span className="badge badge-slate" style={{ fontSize: '9px', padding: '1px 5px' }}>
            HackDataV2
          </span>
        </div>
      </div>

      {/* Center: Modality Switcher (Tabular active, Relational & Documents upcoming) */}
      <div className="top-bar-center">
        <button
          onClick={() => setActiveMode('tabular')}
          className={`modality-btn ${activeMode === 'tabular' ? 'active' : ''}`}
        >
          <span>Tabular</span>
          <span className="badge badge-synth" style={{ fontSize: '8px', padding: '1px 4px' }}>
            Active
          </span>
        </button>

        <button
          className="modality-btn upcoming"
          title="Relational DAG multi-table generation is scheduled for Phase 4"
        >
          <span>Relational</span>
          <span className="badge badge-slate" style={{ fontSize: '8px', padding: '1px 4px' }}>
            Coming next
          </span>
        </button>

        <button
          className="modality-btn upcoming"
          title="Document invoice and statement generator is scheduled for Phase 5"
        >
          <span>Documents</span>
          <span className="badge badge-slate" style={{ fontSize: '8px', padding: '1px 4px' }}>
            Coming next
          </span>
        </button>
      </div>

      {/* Right: Health, Session, Actions */}
      <div className="top-bar-right">
        {/* Backend health status badge */}
        <div
          className={`badge ${
            backendOnline === true
              ? 'badge-synth'
              : backendOnline === false
              ? 'badge-rose'
              : 'badge-slate'
          }`}
          style={{ textTransform: 'none', fontWeight: 500, fontSize: '11px', padding: '4px 8px' }}
        >
          {backendOnline === true ? (
            <CheckCircle2 size={12} />
          ) : (
            <AlertTriangle size={12} />
          )}
          <span>{backendOnline === true ? 'Backend Online' : 'Backend Offline'}</span>
        </div>

        {/* Subtle Session Indicator */}
        {referenceToken && (
          <div
            className="badge badge-slate"
            style={{ textTransform: 'none', fontSize: '11px', padding: '4px 8px' }}
            title="Ephemeral bounded session (~15 min cache)"
          >
            <Clock size={12} style={{ color: 'var(--amber)' }} />
            <span>
              Session: {tokenExpirySeconds ? `${Math.round(tokenExpirySeconds / 60)}m` : '15m'}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        {referenceToken && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onOpenExport}
              disabled={!generatedToken}
              className="btn btn-synth btn-sm"
              title="Download synthetic data as CSV or JSON"
            >
              <Download size={13} />
              <span>Export</span>
            </button>

            <button
              onClick={clearSession}
              className="btn btn-secondary btn-sm"
              title="Load new dataset"
            >
              <Plus size={13} />
              <span>New</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
