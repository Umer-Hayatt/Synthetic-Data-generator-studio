'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Upload, FileSpreadsheet, Database, Check, AlertCircle } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import { displayMessage } from '../../services/displayLabels';
import { SAMPLE_DATASETS } from '../../services/samples';

const EXAMPLE_PROMPT = 'Generate 40 university enrollments with 10 students and 5 courses, including student names, course titles, grades and enrollment dates';

export const EntryScreen: React.FC = () => {
  const { handleFileUpload, loadSampleDataset, loadFromAiPrompt, loadCommerceRelational,
    loadBankingRelational, isIngesting, error, dismissError } = useStudio();
  const [mode, setMode] = useState<'prompt' | 'upload'>('prompt');
  const [prompt, setPrompt] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');
  const [dragging, setDragging] = useState(false);
  const root = useRef<HTMLElement>(null);
  const busy = submitting || isIngesting;

  useEffect(() => {
    if (!root.current || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-visible', 'true');
          observer.unobserve(entry.target);
        }
      });
    }, { root: root.current.closest('.landing-scroll'), threshold: 0.08 });
    root.current.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  async function submit(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy || !prompt.trim()) return;
    setSubmitting(true); setLocalError(''); dismissError();
    try { await loadFromAiPrompt(prompt.trim()); }
    catch (reason: unknown) { setLocalError(reason instanceof Error ? reason.message : 'Generation failed. Please try again.'); }
    finally { setSubmitting(false); }
  }

  function upload(file?: File) {
    if (!file || busy) return;
    setLocalError(''); dismissError(); void handleFileUpload(file);
  }

  return <main className="landing-content" ref={root} id="main-content">
    <section className="landing-hero" aria-labelledby="hero-title">
      <div className="hero-art"><Image src="/media/synthetic-data.png" alt="" width={2172} height={724} sizes="(max-width: 768px) 100vw, 760px" priority /></div>
      <h1 id="hero-title">Your Next <em>Dataset</em>.<br /><span>Built From Your <em>Brief</em>.</span></h1>
      <p>Turn a prompt or sample into structured synthetic data you can inspect, shape, and export.</p>
      <div className="hero-actions"><a href="#create" className="btn btn-primary">Start Creating <ArrowUpRight size={16} /></a>
        <a href="#examples" className="hero-secondary">Explore Examples <ArrowRight size={15} /></a></div>
    </section>

    <section className="creation-section" id="create" aria-labelledby="create-title" data-reveal="form">
      <div className="section-heading" data-reveal="content"><h2 id="create-title">What Would You Like to Create?</h2><p>Start with an idea. Or bring a sample of your own.</p></div>
      <div data-reveal="content" className="input-studio" aria-busy={busy}>
        <div className="input-tabs" role="tablist" aria-label="Dataset input">
          <button id="prompt-tab" role="tab" aria-selected={mode === 'prompt'} aria-controls="prompt-panel" tabIndex={mode === 'prompt' ? 0 : -1}
            onClick={() => setMode('prompt')} onKeyDown={e => { if (e.key === 'ArrowRight') { setMode('upload'); document.getElementById('upload-tab')?.focus(); } }}>
            <Database size={15} /> Describe Your Data</button>
          <button id="upload-tab" role="tab" aria-selected={mode === 'upload'} aria-controls="upload-panel" tabIndex={mode === 'upload' ? 0 : -1}
            onClick={() => setMode('upload')} onKeyDown={e => { if (e.key === 'ArrowLeft') { setMode('prompt'); document.getElementById('prompt-tab')?.focus(); } }}>
            <Upload size={15} /> Upload a Sample</button>
        </div>
        {(localError || (error && !error.isSessionExpired)) && <div className="entry-error" role="alert"><AlertCircle size={17} /><span>{localError || displayMessage(error?.message || '')}</span></div>}
        <form id="prompt-panel" role="tabpanel" aria-labelledby="prompt-tab" hidden={mode !== 'prompt'} onSubmit={submit}>
          <label htmlFor="dataset-prompt" className="sr-only">Describe Your Dataset</label>
          <textarea id="dataset-prompt" value={prompt} disabled={busy} rows={3}
            placeholder="Describe your dataset, the fields you need, and how many records to create…"
            onChange={e => { setPrompt(e.target.value); setLocalError(''); if (error) dismissError(); }}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); void submit(); } }} />
          <div className="prompt-toolbar"><button className="example-prompt" type="button" disabled={busy}
            onClick={() => { setPrompt(EXAMPLE_PROMPT); setLocalError(''); dismissError(); }}>Try a University Dataset <ArrowUpRight size={13} /></button>
            <button type="submit" className="btn btn-primary" disabled={busy || !prompt.trim()}>{submitting ? 'Generating data…' : 'Generate Data'}<ArrowRight size={15} /></button></div>
        </form>
        <div id="upload-panel" role="tabpanel" aria-labelledby="upload-tab" hidden={mode !== 'upload'}>
          <label className={`upload-target ${dragging ? 'is-dragging' : ''}`} htmlFor="dataset-file"
            onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files[0]); }}>
            <span className="upload-symbol"><Upload size={24} /></span>
            <strong>{isIngesting ? 'Reading your sample…' : 'Drop your sample here'}</strong>
            <span>or choose a file from your computer</span><small>CSV, XLSX or JSON · up to 15 MB</small>
            <input id="dataset-file" type="file" accept=".csv,.xlsx,.json" disabled={busy}
              onChange={e => { upload(e.target.files?.[0]); e.target.value = ''; }} /></label>
        </div>
        <div className="input-footnote"><Check size={13} /> Review your schema and privacy settings in the workspace.</div>
      </div>
    </section>

    <section className="workflow-section" id="workflow" aria-labelledby="workflow-title" data-reveal="workflow">
      <div className="workflow-intro" data-reveal="content"><h2 id="workflow-title">From an Idea<br />to Usable Records.</h2><p>One workspace for the whole process. Your source, your settings, your generated data.</p><a href="#create">Start Creating <ArrowUpRight size={16} /></a></div>
      <ol className="workflow-list">
        <li data-reveal="step"><span className="workflow-number">1</span><div><h3>Describe It. Or Upload It.</h3><p>Specify the fields and record count you need, or infer a schema from a sample.</p></div></li>
        <li data-reveal="step"><span className="workflow-number">2</span><div><h3>Make the Data Yours.</h3><p>Adjust column types, privacy rules and generation settings. Inspect connected records in their tables.</p></div></li>
        <li data-reveal="step"><span className="workflow-number">3</span><div><h3>Take the Full Dataset.</h3><p>Page through the results and export every record as CSV or JSON. Compare quality when a reference is available.</p></div></li>
      </ol>
    </section>

    <section className="examples-section" id="examples" aria-labelledby="examples-title" data-reveal="examples">
      <div className="section-heading" data-reveal="content"><h2 id="examples-title">A Starting Point, Already Set Up.</h2><p>Explore an example, then adjust it to your needs.</p></div>
      <div className="sample-list">{SAMPLE_DATASETS.map(sample => <button data-reveal="row" key={sample.id} disabled={busy} onClick={() => void loadSampleDataset(sample.id)}>
        <FileSpreadsheet size={21} strokeWidth={1.5} /><span><strong>{sample.name}</strong><small>{sample.rowCount} reference rows · {sample.columnsCount} fields</small></span><ArrowUpRight size={18} /></button>)}
        <button data-reveal="row" disabled={busy} onClick={() => void loadCommerceRelational()}><Database size={21} strokeWidth={1.5} /><span><strong>Commerce & Invoices</strong><small>Linked tables and invoice documents</small></span><ArrowUpRight size={18} /></button>
        <button data-reveal="row" disabled={busy} onClick={() => void loadBankingRelational()}><Database size={21} strokeWidth={1.5} /><span><strong>Banking & Statements</strong><small>Accounts, transactions and statements</small></span><ArrowUpRight size={18} /></button>
      </div>
    </section>
    <footer className="landing-footer"><span>Data Mine</span><span>Built for working with data.</span><a href="#top">Back to Top <ArrowUpRight size={14} /></a></footer>
  </main>;
};
