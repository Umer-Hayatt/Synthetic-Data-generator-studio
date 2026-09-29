import React, { useRef, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { SAMPLE_DATASETS } from '../../services/samples';
import {
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  Database,
} from 'lucide-react';

export const EntryScreen: React.FC = () => {
  const { handleFileUpload, loadSampleDataset, isIngesting } = useStudio();
  const [dragActive, setDragActive] = useState(false);
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

  return (
    <div className="entry-container">
      {/* Primary Heading */}
      <div className="entry-hero">
        <h1 className="entry-title">Create synthetic data</h1>
        <p className="entry-desc">
          Upload an existing structured file, explore pre-built reference benchmarks, or configure schemas to generate privacy-safe synthetic tabular datasets.
        </p>
      </div>

      {/* 4 Application Options Grid */}
      <div className="entry-grid">
        {/* Option 1: Upload Dataset (Primary/Usable) */}
        <div className="entry-card">
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UploadCloud size={16} style={{ color: 'var(--blue)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                  Upload Dataset
                </h3>
              </div>
              <span className="badge badge-synth" style={{ fontSize: '9px' }}>
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
              <UploadCloud size={24} style={{ color: 'var(--blue)', marginBottom: '8px' }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-title)' }}>
                {isIngesting ? 'Analyzing Dataset...' : 'Click to select or drag and drop'}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-faint)', marginTop: '2px' }}>
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
                <FileSpreadsheet size={16} style={{ color: 'var(--synth)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                  Try Sample Dataset
                </h3>
              </div>
              <span className="badge badge-synth" style={{ fontSize: '9px' }}>
                Ready to Demo
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Load benchmark datasets pre-configured for instant generation, quality scoring, and TSTR evaluation.
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
                    background: 'var(--bg-2)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-xs)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                    e.currentTarget.style.background = 'var(--bg-3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.background = 'var(--bg-2)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-title)' }}>
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
            </div>
          </div>
        </div>

        {/* Option 3: Describe with AI (Visibly Marked Upcoming) */}
        <div className="entry-card" style={{ opacity: 0.85 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: 'var(--purple)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                  Describe with AI
                </h3>
              </div>
              <span className="badge badge-slate" style={{ fontSize: '9px' }}>
                Phase 4 Upcoming
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Convert natural language descriptions into canonical DatasetSpecs with semantic entity tagging.
            </p>

            <div style={{ padding: '12px', background: 'var(--bg-0)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', fontSize: '11px', color: 'var(--text-faint)', fontStyle: 'italic' }}>
              &quot;Generate 5000 university students with GPA, semester, attendance, and tuition status...&quot;
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-faint)', marginTop: '14px' }}>
            <Clock size={12} />
            <span>Scheduled for Phase 4 (AI Integration)</span>
          </div>
        </div>

        {/* Option 4: Build Schema (Visibly Marked Upcoming) */}
        <div className="entry-card" style={{ opacity: 0.85 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} style={{ color: 'var(--amber)' }} />
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-title)' }}>
                  Build Custom Schema
                </h3>
              </div>
              <span className="badge badge-slate" style={{ fontSize: '9px' }}>
                Phase 4 Upcoming
              </span>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Visually assemble custom schemas with mathematical distribution parameters, category sets, and unique constraints.
            </p>

            <div style={{ padding: '12px', background: 'var(--bg-0)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xs)', fontSize: '11px', color: 'var(--text-faint)' }}>
              Interactive field assembly palette with distribution preview.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-faint)', marginTop: '14px' }}>
            <Clock size={12} />
            <span>Scheduled for Phase 4 (Visual Schema Builder)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
