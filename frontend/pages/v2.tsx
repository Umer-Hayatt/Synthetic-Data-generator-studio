/**
 * V2 Studio — wires all 7 integration features.
 * F1: Entry (upload, AI draft, sample)
 * F2: Spec review + accept gate
 * F3: Generation job panel (bounded poll, cancel)
 * F4: Relational view (table switcher, PK/FK, preview)
 * F5: Document view (invoice/bank-statement info + artifacts)
 * F6: Engine & comparison panel (AUTO suggestion only)
 * F7: Artifact downloads (expired state, download links)
 *
 * P0 flows (pages/index.tsx) are untouched.
 * All API calls use NEXT_PUBLIC_API_BASE_URL via v2Origin.
 * No secrets are ever sent to or from the frontend.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import styles from '../styles/v2.module.css';

import {
  Artifact,
  Comparison,
  EngineCapability,
  IngestProfile,
  Job,
  TableArtifactMap,
  V2Spec,
  enrichSpec,
  isTerminal,
  jsonBody,
  usePollJob,
  v2Origin,
  v2Request,
} from '../services/v2';
import example from '../services/v2-example.json';

import { UploadPanel } from '../components/v2/UploadPanel';
import { AIPromptPanel } from '../components/v2/AIPromptPanel';
import { SpecReviewPanel } from '../components/v2/SpecReviewPanel';
import { JobPanel } from '../components/v2/JobPanel';
import { RelationalView } from '../components/v2/RelationalView';
import { DocumentView } from '../components/v2/DocumentView';
import { EnginePanel } from '../components/v2/EnginePanel';
import { ArtifactList } from '../components/v2/ArtifactList';

/* ------------------------------------------------------------------ types */
type Operation = 'ingest' | 'generate' | 'compare';
type MainView = 'tabular' | 'relational' | 'documents';

interface AIUnavailable {
  reason: string;
  retryDelay?: number;
}

/* ===================================================================== page */
export default function V2Studio() {
  /* -- spec/session state */
  const [spec, setSpec] = useState<V2Spec | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [sourceArtifactId, setSourceArtifactId] = useState('');
  const [engine, setEngine] = useState('statistical');

  /* -- job tracking */
  const [job, setJob] = useState<Job | null>(null);
  const [operation, setOperation] = useState<Operation>('ingest');

  /* -- capabilities */
  const [capabilities, setCapabilities] = useState<EngineCapability[]>([]);

  /* -- artifacts & results */
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [tableArtifacts, setTableArtifacts] = useState<Record<string, string>>({});
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);

  /* -- UI state */
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState<AIUnavailable | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [mainView, setMainView] = useState<MainView>('tabular');

  const handledJob = useRef('');
  const active = !!job && !isTerminal(job.status);

  /* -- bounded polling */
  const handleJobUpdate = useCallback((updated: Job) => setJob(updated), []);
  const handlePollError = useCallback((msg: string) => setMessage(msg), []);
  usePollJob(job, handleJobUpdate, handlePollError);

  /* -- health check: /health is NOT under /api/v1 */
  useEffect(() => {
    fetch(`${v2Origin}/health`)
      .then((r) => setBackendOnline(r.ok))
      .catch(() => setBackendOnline(false));
  }, []);

  /* -- load engine capabilities */
  useEffect(() => {
    v2Request<EngineCapability[]>('/engines')
      .then((caps) => setCapabilities(caps))
      .catch(() => {}); // non-fatal
  }, []);

  /* -- handle completed job (exactly once) */
  useEffect(() => {
    if (!job || job.status !== 'complete' || handledJob.current === job.job_id) return;
    handledJob.current = job.job_id;
    const finishedJob = job;
    const finishedOperation = operation;

    (async () => {
      setBusy(true);
      try {
        const list = await Promise.all(
          finishedJob.artifacts.map((id) => v2Request<Artifact>(`/artifacts/${id}`))
        );
        setArtifacts(list);

        if (finishedOperation === 'ingest') {
          // Last artifact is the profile JSON
          const profileArtifact = list[list.length - 1];
          if (!profileArtifact || profileArtifact.size > 4 * 1024 * 1024) {
            setMessage('Profile report is too large to display; download it below.');
            return;
          }
          const resp = await fetch(
            `${(await import('../services/v2')).v2Origin}/api/v1/artifacts/${profileArtifact.id}/download`
          );
          if (!resp.ok) throw new Error('Profile artifact expired; upload again.');
          const profile = await resp.json() as IngestProfile;
          setSourceArtifactId(finishedJob.artifacts[0]); // raw source is first artifact
          if (profile.spec) {
            let enriched = enrichSpec(profile.spec);
            // Optionally enhance with AI suggestions if available; fall back gracefully to deterministic result
            try {
              const ambCols = enriched.tables.flatMap((t) => t.columns.filter((c) => c.semantic_type === 'generic_text' || c.semantic_type === 'categorical').map((c) => c.name));
              if (ambCols.length > 0) {
                const aiResp = await v2Request<{ status: string; suggestions?: { table: string; target_column?: string; primary_key?: string }[] }>('/ai/suggestions', jsonBody({ spec: enriched, ambiguous_columns: ambCols }));
                if (aiResp.suggestions?.length) {
                  const tables = enriched.tables.map((tbl) => {
                    const match = aiResp.suggestions?.find((s) => s.table === tbl.name);
                    return match ? { ...tbl, target_column: tbl.target_column || match.target_column || null, primary_key: tbl.primary_key || match.primary_key || null } : tbl;
                  });
                  enriched = { ...enriched, tables };
                }
              }
            } catch {
              // AI suggestions unavailable — keep deterministic result
            }
            setSpec(enriched);
            setAccepted(false);
            // Auto-select engine based on spec shape
            const hasMulti = (enriched.tables?.length ?? 0) > 1;
            const hasDocs = !!(enriched.documents?.length);
            setEngine(hasDocs ? 'documents' : hasMulti ? 'relational' : 'statistical');
          }
          const rowCount = profile.row_count?.toLocaleString() ?? '?';
          const sampleRows = profile.sample_rows?.toLocaleString() ?? '?';
          setMessage(
            `Profiled ${rowCount} rows (${sampleRows} sampled). ` +
            (profile.spec ? 'Roles and relationships inferred — review before accepting.' : 'No spec inferred; describe your dataset with AI.')
          );
        } else if (finishedOperation === 'compare') {
          const reportArtifact = list[list.length - 1];
          if (!reportArtifact) throw new Error('Comparison report artifact missing.');
          const resp = await fetch(
            `${(await import('../services/v2')).v2Origin}/api/v1/artifacts/${reportArtifact.id}/download`
          );
          if (!resp.ok) throw new Error('Comparison report expired.');
          const result = await resp.json() as Comparison;
          setComparison(result);
          setMessage('Engine comparison complete. Review the results below.');
        } else if (finishedOperation === 'generate') {
          // Check if last JSON artifact is a table manifest (relational/documents)
          const last = list[list.length - 1];
          if (last?.format === 'json') {
            try {
              const resp = await fetch(
                `${(await import('../services/v2')).v2Origin}/api/v1/artifacts/${last.id}/download`
              );
              if (resp.ok) {
                const manifest = await resp.json() as TableArtifactMap;
                if (manifest.tables) {
                  setTableArtifacts(manifest.tables);
                  const tableCount = Object.keys(manifest.tables).length;
                  setMessage(`Generated ${tableCount} table results. Review in the Relational or Documents view.`);
                  if ((spec?.documents?.length ?? 0) > 0) setMainView('documents');
                  else setMainView('relational');
                  return;
                }
              }
            } catch {
              // not a manifest — fall through to simple message
            }
          }
          setMessage('Generation complete. Download results or load a preview below.');
        }
      } catch (err) {
        setMessage(err instanceof Error ? err.message : 'Failed to load job results.');
      } finally {
        setBusy(false);
      }
    })();
    // Job completion is handled exactly once; spec changes must not re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.job_id, job?.status]);

  /* ---------------------------------------------------------------- helpers */
  async function perform(action: () => Promise<void>) {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Operation failed.');
    } finally {
      setBusy(false);
    }
  }

  async function launchJob(kind: Operation, path: string, init: RequestInit) {
    setOperation(kind);
    setArtifacts([]);
    setPreviewRows([]);
    setComparison(kind === 'compare' ? null : comparison);
    if (kind !== 'compare' && kind !== 'ingest') setTableArtifacts({});
    const newJob = await v2Request<Job>(path, init);
    handledJob.current = ''; // allow next completion to fire
    setJob(newJob);
  }

  async function handleUpload(file: File) {
    await perform(() => launchJob(
      'ingest',
      `/jobs/ingest?filename=${encodeURIComponent(file.name)}`,
      { method: 'POST', body: file }
    ));
  }

  async function handleAIDraft(prompt: string) {
    await perform(async () => {
      setAiUnavailable(null);
      const result = await v2Request<{ status: string; spec?: V2Spec; reason?: string }>(
        '/ai/spec',
        jsonBody({ prompt })
      );
      if (!result.spec) {
        setAiUnavailable({ reason: result.reason ?? 'unavailable' });
        throw new Error('AI unavailable. Upload a source file or use the example instead.');
      }
      setSpec(result.spec);
      setAccepted(false);
      setSourceArtifactId('');
      const hasDocs = !!(result.spec.documents?.length);
      const hasMulti = (result.spec.tables?.length ?? 0) > 1;
      setEngine(hasDocs ? 'documents' : hasMulti ? 'relational' : 'statistical');
      setMessage('Spec drafted by AI. Review all fields and relationships before accepting.');
    });
  }

  function handleExample() {
    const ex = example as V2Spec;
    setSpec(ex);
    setAccepted(false);
    setSourceArtifactId('');
    setEngine('documents');
    setMessage('Example spec loaded. Review before accepting.');
  }

  async function handleGenerate() {
    if (!spec || !accepted) return;
    const needsSource = engine === 'statistical_conditional' || engine.startsWith('deep_');
    await perform(() => launchJob(
      'generate',
      '/jobs/generate',
      jsonBody({
        spec,
        engine,
        accepted: true,
        source_artifact: needsSource ? sourceArtifactId : null,
      })
    ));
  }

  async function handleCompare() {
    if (!sourceArtifactId) return;
    await perform(() => launchJob(
      'compare',
      '/jobs/compare',
      jsonBody({
        source_artifact: sourceArtifactId,
        target: spec?.tables[0]?.target_column ?? null,
        seed: spec?.seed ?? 42,
      })
    ));
  }

  async function handleCancel() {
    if (!job) return;
    await perform(async () => {
      await v2Request(`/jobs/${job.job_id}/cancel`, { method: 'POST' });
      setMessage('Cancellation requested; the current bounded step will finish first.');
    });
  }

  /* ============================================================= render */
  return (
    <main className={styles.page}>
      <Head>
        <title>Synthetic Data Studio · V2</title>
        <meta name="description" content="AI-assisted synthetic data generation: relational schemas, PK/FK integrity, invoice and bank statement documents." />
      </Head>

      {/* Header */}
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Synthetic Data Platform</p>
          <h1>Create, review, generate</h1>
          <p>AI-assisted specifications · relational entities · reconciled documents</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <Link href="/">Classic studio →</Link>
          {backendOnline === false && (
            <span style={{ fontSize: 11, color: 'var(--rose)', background: 'var(--rose-soft)', padding: '3px 8px', borderRadius: 4 }}>
              Backend offline — start the backend server
            </span>
          )}
          {backendOnline === true && (
            <span style={{ fontSize: 11, color: 'var(--synth)' }}>● Backend connected</span>
          )}
        </div>
      </header>

      {/* Workspace Grid */}
      <div className={styles.grid}>

        {/* ---- MAIN CONTENT AREA ---- */}
        <div className={styles.mainContent}>

          {/* Top-Level View Tabs */}
          <nav className={styles.viewNav} aria-label="Views">
            <button
              className={`${styles.viewTab} ${mainView === 'tabular' ? styles.viewTabActive : ''}`}
              onClick={() => setMainView('tabular')}
            >
              <span>📊 Tabular</span>
            </button>
            <button
              className={`${styles.viewTab} ${mainView === 'relational' ? styles.viewTabActive : ''}`}
              onClick={() => setMainView('relational')}
            >
              <span>🔗 Relational</span>
              {spec?.tables && spec.tables.length > 0 && (
                <span style={{ fontSize: 11, background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 10, color: 'var(--text-muted)' }}>
                  {spec.tables.length}
                </span>
              )}
            </button>
            <button
              className={`${styles.viewTab} ${mainView === 'documents' ? styles.viewTabActive : ''}`}
              onClick={() => setMainView('documents')}
            >
              <span>📄 Documents</span>
              {spec?.documents && spec.documents.length > 0 && (
                <span style={{ fontSize: 11, background: 'var(--bg-2)', padding: '1px 6px', borderRadius: 10, color: 'var(--text-muted)' }}>
                  {spec.documents.length}
                </span>
              )}
            </button>
          </nav>

          {/* TABULAR VIEW */}
          {mainView === 'tabular' && (
            <div className={styles.subGrid}>
              {/* Step 1: Start with a source */}
              <section className={styles.card}>
                <h2>1. Start with a source</h2>
                <UploadPanel disabled={busy || active} onFile={handleUpload} />
                <div style={{ margin: '20px 0', borderTop: '1px solid var(--border-subtle)' }} />
                <AIPromptPanel
                  disabled={busy || active}
                  onSubmit={handleAIDraft}
                  aiUnavailable={aiUnavailable}
                />
                <button
                  className={styles.secondary}
                  disabled={busy || active}
                  onClick={handleExample}
                  style={{ marginTop: 10, width: '100%' }}
                >
                  Load commerce + invoices example
                </button>
              </section>

              {/* Step 2: Review specification */}
              <section className={styles.card}>
                <h2>2. Review the specification</h2>
                {!spec ? (
                  <p className={styles.muted}>
                    Upload a source, describe your dataset with AI, or load the example to see the schema here.
                  </p>
                ) : (
                  <SpecReviewPanel
                    spec={spec}
                    accepted={accepted}
                    busy={busy || active}
                    onSpecChange={(s) => setSpec(s)}
                    onAcceptChange={setAccepted}
                    onError={(msg) => setMessage(msg)}
                  />
                )}
              </section>
            </div>
          )}

          {/* RELATIONAL VIEW */}
          {mainView === 'relational' && (
            <section className={styles.card}>
              <h2>Relational schema & integrity</h2>
              {spec ? (
                <RelationalView
                  spec={spec}
                  tableArtifacts={tableArtifacts}
                  busy={busy}
                  onSpecChange={(s) => setSpec(s)}
                  onGenerate={handleGenerate}
                  onError={(msg) => setMessage(msg)}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
                    Load or draft a specification first to inspect relational relationships and integrity checks.
                  </p>
                  <button className={styles.secondary} onClick={handleExample}>
                    Load commerce + invoices example
                  </button>
                </div>
              )}
            </section>
          )}

          {/* DOCUMENTS VIEW */}
          {mainView === 'documents' && (
            <section className={styles.card}>
              <h2>Reconciled documents</h2>
              {spec ? (
                <DocumentView
                  spec={spec}
                  artifacts={artifacts}
                  tableArtifacts={tableArtifacts}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 32 }}>
                  <p className={styles.muted} style={{ fontSize: 13, marginBottom: 12 }}>
                    Load or draft a specification first to view reconciled invoice and bank statement documents.
                  </p>
                  <button className={styles.secondary} onClick={handleExample}>
                    Load commerce + invoices example
                  </button>
                </div>
              )}
            </section>
          )}

          {/* PREVIEW TABLE (if preview requested) */}
          {previewRows.length > 0 && (
            <section className={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={{ margin: 0 }}>Preview · first {previewRows.length} rows</h2>
                <button className={styles.secondary} onClick={() => setPreviewRows([])} style={{ fontSize: 11 }}>
                  Dismiss
                </button>
              </div>
              <div className={styles.preview}>
                <table>
                  <thead>
                    <tr>{Object.keys(previewRows[0]).map((k) => <th key={k}>{k}</th>)}</tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i}>
                        {Object.keys(previewRows[0]).map((k) => (
                          <td key={k}>
                            {typeof row[k] === 'object' ? JSON.stringify(row[k]) : String(row[k] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>

        {/* ---- RIGHT SIDE PANEL: Generation Settings, Active Job, Results ---- */}
        <aside className={styles.sidePanel}>
          <section className={styles.card}>
            <h2>Generation settings</h2>
            <EnginePanel
              spec={spec}
              accepted={accepted}
              engine={engine}
              capabilities={capabilities}
              sourceArtifactId={sourceArtifactId}
              comparison={comparison}
              busy={busy}
              active={active}
              onEngineChange={setEngine}
              onSeedChange={(seed) => spec && setSpec({ ...spec, seed })}
              onGenerate={handleGenerate}
              onCompare={handleCompare}
              onUseRecommendation={(rec) => { setEngine(rec); setMessage(`Engine set to ${rec}. Review spec and accept to generate.`); }}
            />
          </section>

          {/* Active Job Panel */}
          {job && (
            <section className={styles.card}>
              <h2>Job status</h2>
              <JobPanel job={job} onCancel={handleCancel} busy={busy} />
            </section>
          )}

          {/* Generated Results & Downloads */}
          {artifacts.length > 0 && (
            <section className={styles.card}>
              <h2>Results ({artifacts.length})</h2>
              <ArtifactList
                artifacts={artifacts}
                busy={busy}
                onPreview={(rows) => setPreviewRows(rows)}
                onError={(msg) => setMessage(msg)}
              />
            </section>
          )}
        </aside>
      </div>

      {/* Status message */}
      {message && (
        <div
          role="status"
          className={styles.notice}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}
        >
          <span>{message}</span>
          <button
            onClick={() => setMessage('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, lineHeight: 1, padding: 0, flexShrink: 0 }}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}
    </main>
  );
}
