import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { Artifact, Comparison, Job, V2Spec, jsonBody, v2Origin, v2Request } from '../services/v2';
import example from '../services/v2-example.json';
import styles from '../styles/v2.module.css';

type Operation = 'ingest' | 'generate' | 'compare';
export default function V2Studio() {
  const [spec, setSpec] = useState<V2Spec | null>(null);
  const [prompt, setPrompt] = useState('Create a Pakistani e-commerce company with customers, products, orders, payments and invoices.');
  const [source, setSource] = useState('');
  const [engine, setEngine] = useState('statistical');
  const [capabilities, setCapabilities] = useState<{engine:string;available?:boolean}[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [job, setJob] = useState<Job | null>(null);
  const [operation, setOperation] = useState<Operation>('ingest');
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [advanced, setAdvanced] = useState('');
  const handled = useRef('');
  const active = !!job && !['complete','failed','cancelled'].includes(job.status);
  const pendingSchemaEdits = !!spec && advanced !== JSON.stringify(spec, null, 2);

  function review(value: V2Spec) { setSpec(value); setAccepted(false); setAdvanced(JSON.stringify(value, null, 2)); }
  async function perform(action: () => Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : 'Operation failed.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let disposed = false;
    v2Request<{engine:string;available?:boolean}[]>('/engines').then(value => { if (!disposed) setCapabilities(value); }).catch(() => {});
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!job || !active) return;
    let disposed = false;
    const timer = setTimeout(() => {
      v2Request<Job>(`/jobs/${job.job_id}`).then(value => { if (!disposed) setJob(value); })
        .catch(error => { if (!disposed) setMessage(error.message); });
    }, 1000);
    return () => { disposed = true; clearTimeout(timer); };
  }, [job, active]);
  useEffect(() => {
    if (!job || job.status !== 'complete' || handled.current === job.job_id) return;
    handled.current = job.job_id;
    const current = job;
    perform(async () => {
      const list = await Promise.all(current.artifacts.map(id => v2Request<Artifact>(`/artifacts/${id}`)));
      setArtifacts(list);
      if (operation === 'ingest' || operation === 'compare') {
        const last = list[list.length - 1];
        if (!last || last.size > 4 * 1024 * 1024) throw new Error('Report is too large to display; download it below.');
        const response = await fetch(`${v2Origin}/api/v1/artifacts/${last.id}/download`);
        if (!response.ok) throw new Error('Report expired; run the operation again.');
        const data = await response.json();
        if (operation === 'ingest') {
          setSource(current.artifacts[0]); review(data.spec);
          setMessage(`Profiled ${data.row_count.toLocaleString()} rows using ${data.sample_rows.toLocaleString()} sampled rows. Review generation counts.`);
          setEngine('statistical');
        } else setComparison(data);
      }
    });
    // A completed job is handled exactly once; edits to the review must not reload it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job, operation]);

  async function launch(kind: Operation, path: string, body: RequestInit) {
    setOperation(kind); setArtifacts([]); setPreview([]);
    setJob(await v2Request<Job>(path, body));
  }
  return <main className={styles.page}>
    <Head><title>Synthetic Data Studio · V2</title></Head>
    <header className={styles.header}><div><p className={styles.eyebrow}>SYNTHETIC DATA PLATFORM</p><h1>Create, review, generate</h1>
      <p>AI-assisted specifications, relational entities and reconciled documents.</p></div><Link href="/">Classic studio →</Link></header>
    <div className={styles.grid}>
      <section className={styles.card}><h2>1. Start with a source</h2>
        <label htmlFor="source-file">Upload CSV, JSON, JSONL, XLSX or Parquet</label>
        <input id="source-file" type="file" accept=".csv,.json,.jsonl,.xlsx,.parquet" disabled={busy || active}
          onChange={event => { const file = event.target.files?.[0]; if (file) perform(() => launch('ingest', `/jobs/ingest?filename=${encodeURIComponent(file.name)}`, {method:'POST',body:file})); }} />
        <p className={styles.muted}>Large sources are profiled in batches. Limits depend on the deployment. For large Excel files, use CSV or Parquet.</p>
        <label htmlFor="prompt">Describe your dataset</label><textarea id="prompt" value={prompt} onChange={e => setPrompt(e.target.value)} rows={5} maxLength={12000} />
        <button disabled={busy || active || !prompt.trim()} onClick={() => perform(async () => {
          const result = await v2Request<{status:string;spec?:V2Spec;reason?:string}>('/ai/spec',jsonBody({prompt}));
          if (!result.spec) throw new Error(`AI unavailable (${result.reason || 'provider unavailable'}). Upload a source or use the example.`);
          review(result.spec); setSource(''); setEngine(result.spec.documents?.length ? 'documents' : result.spec.tables.length > 1 ? 'relational' : 'statistical');
        })}>Draft with AI</button>
        <button className={styles.secondary} disabled={busy || active} onClick={() => { review(example as V2Spec); setSource(''); setEngine('documents'); }}>Try commerce + invoices</button>
      </section>
      <section className={styles.card}><h2>2. Review the specification</h2>
        {!spec ? <p className={styles.muted}>Upload, describe, or choose an example to review fields and relationships.</p> : <>
          <div className={styles.fields}><label>Name<input value={spec.name} onChange={e => review({...spec,name:e.target.value})} /></label>
            <label>Locale<input value={spec.locale} onChange={e => review({...spec,locale:e.target.value})} /></label>
            <label>Seed<input type="number" min={0} max={4294967295} value={spec.seed} onChange={e => review({...spec,seed:Number(e.target.value)})} /></label></div>
          {spec.tables.map((table,index) => <details key={table.name} open={index===0} className={styles.tableSection}>
            <summary>{table.name} · {table.columns.length} fields</summary>
            <label>Rows<input type="number" min={1} value={table.row_count} onChange={e => review({...spec,version:'2.0',tables:spec.tables.map((t,i) => i===index ? {...t,row_count:Number(e.target.value)} : t)})} /></label>
            <label>Benchmark target<select value={table.target_column || ''} onChange={e => review({...spec,tables:spec.tables.map((t,i) => i===index ? {...t,target_column:e.target.value || null} : t)})}>
              <option value="">None</option>{table.columns.map(c => <option key={c.name}>{c.name}</option>)}</select></label>
            <table><thead><tr><th>Field</th><th>Type</th><th>Meaning</th></tr></thead><tbody>{table.columns.map(c => <tr key={c.name}><td>{c.name}{c.name===table.primary_key ? ' (PK)' : ''}</td><td>{c.dtype}</td><td>{c.semantic_type}</td></tr>)}</tbody></table>
            {table.foreign_keys?.map(f => <p key={f.column} className={styles.muted}>{f.column} → {f.reference_table}.{f.reference_column} · {f.cardinality}</p>)}
          </details>)}
          {!!spec.business_rules?.length && <p className={styles.warning}>Suggested rules require review: {spec.business_rules.join('; ')}. Translate these into supported reconciliation rules before generation.</p>}
          {!!spec.edge_cases?.length && <p>Suggested edge cases: {spec.edge_cases.join('; ')}</p>}
          <details><summary>Advanced schema and document mappings</summary><textarea aria-label="Full specification" rows={12} value={advanced} onChange={e => {setAdvanced(e.target.value);setAccepted(false);}} />
            <button onClick={() => perform(async () => { const validated = await v2Request<V2Spec>('/spec',jsonBody(JSON.parse(advanced))); review(validated); })}>Validate edits</button></details>
          {pendingSchemaEdits && <p className={styles.warning}>Validate your schema edits before accepting.</p>}
          <label className={styles.check}><input type="checkbox" disabled={pendingSchemaEdits} checked={accepted} onChange={e => setAccepted(e.target.checked)} />I have reviewed and accepted this specification.</label>
        </>}
      </section>
      <section className={styles.card}><h2>3. Generate and inspect</h2>
        <label>Engine<select value={engine} onChange={e => setEngine(e.target.value)}>
          <option value="statistical">Statistical · default</option><option value="statistical_conditional" disabled={!source}>Statistical · target-aware</option>
          <option value="relational">Relational</option><option value="documents">Relational + documents</option>
          {['deep_ctgan','deep_tvae'].map(name => <option key={name} value={name} disabled={!source || !capabilities.find(c => c.engine===name)?.available}>{name === 'deep_ctgan' ? 'CTGAN' : 'TVAE'} · optional</option>)}
        </select></label>
        <button disabled={!spec || !accepted || busy || active} onClick={() => perform(() => launch('generate','/jobs/generate',jsonBody({spec,engine,accepted:true,
          source_artifact:engine==='statistical_conditional' || engine.startsWith('deep_') ? source : null}))) }>Generate artifacts</button>
        <button className={styles.secondary} disabled={!source || busy || active} onClick={() => perform(() => launch('compare','/jobs/compare',jsonBody({source_artifact:source,target:spec?.tables[0]?.target_column || null,seed:spec?.seed || 42})))}>Compare engines / AUTO recommendation</button>
        {job && <div aria-live="polite" className={styles.job}><strong>{job.status} · {job.stage}</strong><progress value={job.progress} max={1} /><p>Stage progress estimate · {Math.round(job.progress*100)}%</p><small>Job {job.job_id}</small>
          {job.error && <p role="alert">{job.error}</p>}{active && <button className={styles.secondary} onClick={() => perform(async () => {await v2Request(`/jobs/${job.job_id}/cancel`,{method:'POST'});setMessage('Cancellation requested; waiting for the current bounded step.');})}>Cancel job</button>}</div>}
        {comparison && <div><h3>Internal benchmark</h3><p>Recommended: {comparison.recommendation || 'No recommendation'}</p><p className={styles.muted}>Sample-specific engineering evidence. This is not the competition’s external TSTR score.</p>
          {comparison.results.map(result => <div key={result.engine} className={styles.job}><strong>{result.engine}: {result.status}</strong>{result.status==='ok' && <p>Quality {result.quality_score?.toFixed(1)} · {result.runtime_seconds?.toFixed(2)}s · DataFrame memory estimate {Math.round((result.memory_estimate_bytes || 0)/1024)} KiB<br />TSTR {JSON.stringify(result.tstr?.tstr || {})}</p>}</div>)}
          {comparison.recommendation && <button className={styles.secondary} onClick={() => setEngine(comparison.recommendation!)}>Use recommendation</button>}</div>}
        {artifacts.map((artifact,index) => <div key={artifact.id} className={styles.artifact}><p>Artifact {index+1} · {artifact.format} · {(artifact.size/1024).toFixed(1)} KiB</p><a href={`${v2Origin}/api/v1/artifacts/${artifact.id}/download`}>Download</a>
          {artifact.format!=='json' && <button className={styles.secondary} onClick={() => perform(async () => {const data=await v2Request<Artifact>(`/artifacts/${artifact.id}?preview_rows=10`);setPreview(data.preview || []);})}>Preview</button>}
          <small>Expires {new Date(artifact.expires_at*1000).toLocaleString()}</small></div>)}
      </section>
    </div>
    {message && <p role="status" className={styles.notice}>{message}</p>}
    {!!preview.length && <section className={styles.card}><h2>Artifact preview · first {preview.length} rows</h2><div className={styles.preview}><table><thead><tr>{Object.keys(preview[0]).map(key => <th key={key}>{key}</th>)}</tr></thead><tbody>{preview.map((row,index) => <tr key={index}>{Object.keys(preview[0]).map(key => <td key={key}>{typeof row[key]==='object' ? JSON.stringify(row[key]) : String(row[key] ?? '')}</td>)}</tr>)}</tbody></table></div></section>}
  </main>;
}
