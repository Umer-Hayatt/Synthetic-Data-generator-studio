import React, { useRef } from 'react';
import styles from '../../styles/v2.module.css';
import { ACCEPTED_FORMATS, ACCEPTED_FORMATS_LABEL, UPLOAD_LIMIT_LABEL } from '../../services/v2';

interface Props {
  disabled: boolean;
  onFile: (file: File) => void;
}

export function UploadPanel({ disabled, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      onFile(file);
      // Reset so the same file can be re-uploaded
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (disabled) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => !disabled && inputRef.current?.click()}
        style={{
          border: '2px dashed var(--border-default)',
          borderRadius: 8,
          padding: '20px 16px',
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.5 : 1,
          transition: 'border-color 0.15s',
        }}
        onMouseEnter={(e) => { if (!disabled) (e.currentTarget as HTMLElement).style.borderColor = 'var(--synth)'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-default)'; }}
        role="button"
        aria-label="Upload a dataset file"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click(); }}
      >
        <p style={{ fontWeight: 600, color: 'var(--text-title)', marginBottom: 4 }}>
          Click or drag a file to upload
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {ACCEPTED_FORMATS_LABEL} · max {UPLOAD_LIMIT_LABEL} per file
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>
          Large Excel files: convert to CSV or Parquet first.
          Large sources are profiled in batches — exact row counts require a full pass.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_FORMATS}
        disabled={disabled}
        onChange={handleChange}
        style={{ display: 'none' }}
        aria-hidden
      />
    </div>
  );
}
