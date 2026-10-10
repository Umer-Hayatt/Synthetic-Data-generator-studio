import React, { useEffect, useRef, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { DataWorkspace } from '../preview/DataWorkspace';
import { GenerationSettings } from './GenerationSettings';
import { DocumentsWorkspace } from '../documents/DocumentsWorkspace';
import { SchemaEditor } from '../schema/SchemaEditor';
import { PrivacyEditor } from '../schema/PrivacyEditor';
import { QualityCharts } from '../quality/QualityCharts';
import { RelationshipsWorkspace } from '../preview/RelationshipsWorkspace';
import styles from './Workspace.module.css';
import { displayLabel } from '../../services/displayLabels';
import { Sidebar } from './Sidebar';
import { ChevronRight } from 'lucide-react';

export const Workspace: React.FC = () => {
  const { activeTab, setActiveTab, datasetName, datasetSpec, datasetRevision, activeSource,
    generatedRowCount, generatedSnapshot, qualityResults, isEvaluatingQuality,
    triggerQualityEvaluation, schemaNotice, clearSchemaNotice } = useStudio();
  const [tableTarget, setTableTarget] = useState<{ revision: number; name: string } | null>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => { if (body.current) body.current.scrollTop = 0; }, [activeTab, activeSource?.id]);
  const documentsOpen = !!datasetSpec?.documents?.length && activeTab === 'documents';
  const view = documentsOpen ? 'Documents' : activeTab === 'schema' ? 'Schema' :
    activeTab === 'privacy' ? 'Privacy' : activeTab === 'quality' ? 'Quality Details' : activeTab === 'relational' ? 'Relationships' : 'Data';
  const source = activeSource?.kind === 'prompt' ? 'AI Prompt' : activeSource?.kind === 'demo' ? 'Example Dataset' : 'Uploaded Data';

  return <div className={styles.frame}>
    <Sidebar />
    <div className={`${styles.workspace} ${styles.side}`} id="main-content" tabIndex={-1}>
      <div className={styles.breadcrumb}><span>Workspace</span><ChevronRight size={13} /><strong>{view}</strong><span className={styles.sourceLabel}>{source}</span></div>
      <header className={styles.header}>
        <div><h1>{displayLabel(datasetName || 'Your Dataset')}</h1>
          <p>{generatedRowCount ? `${generatedRowCount.toLocaleString()} generated rows` : 'Ready to generate'} · {datasetSpec?.tables[0]?.columns.length || 0} source fields</p></div>
      </header>
      <div className={styles.body} ref={body}>
        <main className={styles.dataRegion} aria-label={`${view} workspace`}>
          {schemaNotice && <details className={styles.notes} open={/AI unavailable|exceeds|invalid/i.test(schemaNotice)}>
            <summary>Generation Notes</summary><p>{schemaNotice}</p><button onClick={clearSchemaNotice}>Dismiss Notice</button>
          </details>}
          {documentsOpen ? <DocumentsWorkspace key={datasetRevision} /> : activeTab === 'relational' ?
            <RelationshipsWorkspace key={datasetRevision} onInspectTable={name => { setTableTarget({ revision: datasetRevision, name }); setActiveTab('preview'); }} /> :
            activeTab === 'schema' ? <SchemaEditor /> : activeTab === 'privacy' ? <PrivacyEditor /> :
            activeTab === 'quality' ? qualityResults ? <QualityCharts /> : <section className={styles.empty} role="status">
              <p>{isEvaluatingQuality ? 'Measuring quality against your reference…' : 'Generate data, then measure quality against your reference.'}</p>
              <button disabled={isEvaluatingQuality || generatedSnapshot?.storage !== 'frame'} onClick={() => void triggerQualityEvaluation()}>Measure Quality</button>
            </section> : <DataWorkspace key={datasetRevision} initialTable={tableTarget?.revision === datasetRevision ? tableTarget.name : ''} />}
        </main>
        <GenerationSettings />
      </div>
    </div>
  </div>;
};
