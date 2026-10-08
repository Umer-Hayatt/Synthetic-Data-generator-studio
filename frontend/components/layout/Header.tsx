import React from 'react';
import { useStudio } from '../../context/StudioContext';
import {
  Database,
  Download,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface HeaderProps {
  onOpenExport: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenExport }) => {
  const {
    referenceToken,
    generatedToken,
    backendOnline,
    clearSession,
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
              background: 'var(--primary-btn-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}
          >
            <Database size={16} />
          </div>
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            Synthetic Data Studio
          </span>
        </div>
      </div>

      {/* Right: Health, Actions */}
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
