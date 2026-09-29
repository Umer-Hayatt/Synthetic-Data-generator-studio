import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { Clock, UploadCloud, AlertCircle } from 'lucide-react';

export const SessionExpiredModal: React.FC = () => {
  const { error, clearSession, dismissError } = useStudio();

  if (!error?.isSessionExpired) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog" style={{ textAlign: 'center' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--warning-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--warning)', margin: '0 auto 12px auto' }}>
          <Clock size={20} />
        </div>

        <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
          Dataset Session Expired
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '20px' }}>
          This temporary dataset session has expired or the backend was restarted. Datasets are held in ephemeral in-memory cache (~15 min) for privacy. Please upload or select a new dataset.
        </p>

        <button
          onClick={() => {
            dismissError();
            clearSession();
          }}
          className="btn btn-primary"
          style={{ width: '100%', padding: '10px' }}
        >
          <UploadCloud size={14} />
          <span>Upload or Select New Dataset</span>
        </button>
      </div>
    </div>
  );
};
