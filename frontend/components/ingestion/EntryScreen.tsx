import React, { useRef, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { SAMPLE_DATASETS } from '../../services/samples';
import {
  UploadCloud,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

export const EntryScreen: React.FC = () => {
  const {
    handleFileUpload,
    loadSampleDataset,
    loadFromAiPrompt,
    loadCommerceRelational,
    loadBankingRelational,
    isIngesting,
    error,
    dismissError,
  } = useStudio();
  const [dragActive, setDragActive] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);
  const [promptLocalError, setPromptLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const handleDraftFromPrompt = async () => {
    const trimmed = promptText.trim();
    if (!trimmed) return;
    setIsSubmittingPrompt(true);
    setPromptLocalError(null);
    dismissError();
    try {
      await loadFromAiPrompt(trimmed);
    } catch (err: any) {
      setPromptLocalError(err.message || 'Failed to generate specification from prompt.');
    } finally {
      setIsSubmittingPrompt(false);
    }
  };

  return (
    <div className="entry-container">
      {/* Primary Heading */}
      <div className="entry-hero">
        <h1 className="entry-title">Create synthetic data</h1>
        <p className="entry-desc">
          Upload an existing structured file, describe what you need with an AI prompt, or explore pre-built reference benchmarks to generate privacy-safe synthetic tabular datasets.
        </p>
      </div>

      {/* Application Options Grid */}
      <div className="entry-grid">
        {/* Option 1: Upload Dataset (Primary/Usable) */}
        <div className="entry-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UploadCloud size={16} style={{ color: 'var(--text-primary)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Upload Dataset
                </h3>
              </div>
              <span className="badge badge-slate" style={{ fontSize: '9px' }}>
                CSV / XLSX / JSON
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Infer statistical distributions, category sets, and correlation matrices directly from your sample file.
            </p>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="entry-card-dropzone"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.json"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <UploadCloud size={24} style={{ color: 'var(--text-primary)', marginBottom: '8px' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                {isIngesting ? 'Analyzing Dataset...' : 'Click to select or drag and drop'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Max 15MB • Automatic schema inference
              </span>
            </div>
          </div>
        </div>

        {/* Option 2: Try Sample Dataset (Primary/Usable) */}
        <div className="entry-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileSpreadsheet size={16} style={{ color: 'var(--text-primary)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Try Sample Dataset
                </h3>
              </div>
              <span className="badge badge-synth" style={{ fontSize: '9px' }}>
                Ready to Demo
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Load benchmark datasets pre-configured for instant generation and quality scoring.
            </p>


            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SAMPLE_DATASETS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => loadSampleDataset(sample.id)}
                  disabled={isIngesting}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    background: 'var(--surface)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-medium)';
                    e.currentTarget.style.background = 'var(--surface-muted)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'var(--surface)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {sample.name}
                      </span>
                      <span className="badge badge-slate" style={{ fontSize: '9px', padding: '1px 5px' }}>
                        {sample.badge}
                      </span>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                      {sample.rowCount} records • {sample.columnsCount} features
                    </span>
                  </div>

                  <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                </button>
              ))}

              <button
                onClick={loadCommerceRelational}
                disabled={isIngesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.background = 'var(--surface-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--surface)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Commerce & Invoices
                    </span>
                    <span className="badge badge-synth" style={{ fontSize: '9px', padding: '1px 5px' }}>
                      Relational & Docs
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    5 relational tables • Reconciled PDF/ZIP invoices
                  </span>
                </div>

                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </button>

              <button
                onClick={loadBankingRelational}
                disabled={isIngesting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-xs)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-medium)';
                  e.currentTarget.style.background = 'var(--surface-muted)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle)';
                  e.currentTarget.style.background = 'var(--surface)';
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      Banking & Statements
                    </span>
                    <span className="badge badge-synth" style={{ fontSize: '9px', padding: '1px 5px' }}>
                      Relational & Docs
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '2px' }}>
                    Accounts & transactions • Continuous bank statements
                  </span>
                </div>

                <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Option 3: AI Prompt Generator (Below Upload/Paste Area) */}
      <div
        className="card"
        style={{
          marginTop: '20px',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} style={{ color: 'var(--text-primary)' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Generate from AI Prompt
            </h3>
          </div>
          <span className="badge badge-synth" style={{ fontSize: '9px' }}>
            Prompt Only • No File Required
          </span>
        </div>

        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Describe your tabular dataset and features. The AI engine drafts a complete schema specification with sensible data types, constraints, and privacy protections without needing any uploaded file.
        </p>

        {(promptLocalError || (error && !error.isSessionExpired)) && (
          <div
            style={{
              padding: '10px 14px',
              background: 'var(--error-bg)',
              border: '1px solid var(--error-border)',
              borderRadius: 'var(--radius-xs)',
              fontSize: '12px',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={15} style={{ flexShrink: 0 }} />
            <span>{promptLocalError || error?.message}</span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            value={promptText}
            onChange={(e) => {
              setPromptText(e.target.value);
              if (promptLocalError) setPromptLocalError(null);
              if (error) dismissError();
            }}
            placeholder="5000 university students with GPA, semester, attendance and fee status"
            rows={3}
            disabled={isSubmittingPrompt}
            className="input-text"
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: 'inherit',
              lineHeight: 1.5,
              fontSize: '13px',
              padding: '10px 12px',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleDraftFromPrompt();
              }
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-muted)' }}>
            <span>Example:</span>
            <button
              type="button"
              onClick={() => {
                setPromptText('5000 university students with GPA, semester, attendance and fee status');
                if (promptLocalError) setPromptLocalError(null);
                if (error) dismissError();
              }}
              className="btn btn-ghost btn-sm"
              style={{ fontSize: '11px', padding: '3px 8px', color: 'var(--text-primary)', textDecoration: 'underline' }}
            >
              5000 university students with GPA, semester, attendance and fee status
            </button>
          </div>

          <button
            type="button"
            onClick={handleDraftFromPrompt}
            disabled={isSubmittingPrompt || !promptText.trim()}
            className="btn btn-synth"
            style={{ padding: '8px 18px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            {isSubmittingPrompt ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Generating data…</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>Generate data</span>
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
