import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { AlertCircle, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { error, dismissError } = useStudio();

  if (!error || error.isSessionExpired) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 90,
        maxWidth: '360px',
        background: 'var(--surface)',
        border: '1px solid var(--error-border)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 14px',
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.06)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
      }}
    >
      <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1, fontSize: '12px' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'block' }}>Notice</span>
        <span style={{ color: 'var(--text-body)', marginTop: '2px', display: 'block', lineHeight: 1.4 }}>
          {error.message}
        </span>
      </div>
      <button
        onClick={dismissError}
        className="btn btn-ghost btn-sm"
        style={{ padding: '2px', color: 'var(--text-muted)' }}
      >
        <X size={14} />
      </button>
    </div>
  );
};
