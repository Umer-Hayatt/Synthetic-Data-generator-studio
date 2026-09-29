import React, { useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { api } from '../../services/api';
import {
  Download,
  X,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { generatedToken, generatedRowCount, datasetSpec, datasetName } =
    useStudio();
  const [downloading, setDownloading] = useState<'csv' | 'json' | null>(null);

  if (!isOpen || !generatedToken) return null;

  const colCount = datasetSpec?.tables[0]?.columns.length || 0;

  const handleDownload = (format: 'csv' | 'json') => {
    setDownloading(format);
    const url = api.getExportUrl(format, generatedToken);

    const link = document.createElement('a');
    link.href = url;
    link.download = `${datasetName || 'synthetic'}_data.${format}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      setDownloading(null);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'var(--synth-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--synth)' }}>
              <Download size={14} />
            </div>
            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                Export Synthetic Dataset
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Download complete table
              </span>
            </div>
          </div>

          <button onClick={onClose} className="btn btn-ghost btn-sm" style={{ padding: '4px' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ background: 'var(--bg-0)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', padding: '10px 14px', marginBottom: '16px', fontSize: '11px', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Dataset:</span>
            <span style={{ color: 'var(--text-title)' }}>{datasetName}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Synthetic Rows:</span>
            <span style={{ color: 'var(--synth)', fontWeight: 600 }}>{generatedRowCount}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Columns:</span>
            <span style={{ color: 'var(--text-title)' }}>{colCount}</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => handleDownload('csv')}
            disabled={downloading !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              color: 'var(--text-title)',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileSpreadsheet size={18} style={{ color: 'var(--synth)' }} />
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Export as CSV</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Standard comma-delimited table</span>
              </div>
            </div>
            <Download size={14} style={{ color: 'var(--text-muted)' }} />
          </button>

          <button
            onClick={() => handleDownload('json')}
            disabled={downloading !== null}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              background: 'var(--bg-2)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              cursor: 'pointer',
              color: 'var(--text-title)',
              textAlign: 'left',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--border-default)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileCode size={18} style={{ color: 'var(--blue)' }} />
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, display: 'block' }}>Export as JSON</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>JSON record array format</span>
              </div>
            </div>
            <Download size={14} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', marginTop: '16px', fontSize: '10px', color: 'var(--text-faint)' }}>
          <ShieldCheck size={12} style={{ color: 'var(--synth)' }} />
          <span>Includes all applied column privacy rules</span>
        </div>
      </div>
    </div>
  );
};
