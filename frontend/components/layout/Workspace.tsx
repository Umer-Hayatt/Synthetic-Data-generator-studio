import React from 'react';
import { useStudio } from '../../context/StudioContext';
import { DataWorkspace } from '../preview/DataWorkspace';
import { WorkspaceInsights } from './WorkspaceInsights';
import { DocumentsWorkspace } from '../documents/DocumentsWorkspace';
import styles from './Workspace.module.css';

export const Workspace: React.FC = () => {
  const { activeTab, setActiveTab, datasetName, datasetSpec, datasetRevision, activeSource,
    generatedRowCount } = useStudio();
  const hasDocuments = !!datasetSpec?.documents?.length;
  const documentsOpen = hasDocuments && activeTab === 'documents';
  const source = activeSource?.kind === 'prompt' ? 'AI prompt' : activeSource?.kind === 'demo' ? 'Example dataset' : 'Uploaded data';

  return <div className={`${styles.workspace} ${styles.side}`}>
    <header className={styles.header}>
      <div><h1>{datasetName || 'Your dataset'}</h1>
        <p>{source} · {generatedRowCount ? `${generatedRowCount.toLocaleString()} generated rows` : 'Ready to generate'}</p></div>
      {hasDocuments && <nav aria-label="Workspace view">
        <button className={documentsOpen ? '' : styles.selected} aria-pressed={!documentsOpen}
          onClick={() => setActiveTab('preview')}>Data</button>
        <button className={documentsOpen ? styles.selected : ''} aria-pressed={documentsOpen}
          onClick={() => setActiveTab('documents')}>Documents</button>
      </nav>}
    </header>
    {documentsOpen ? <main className={styles.documentBody}><DocumentsWorkspace key={datasetRevision} /></main> :
      <div className={styles.body}>
        <main className={styles.dataRegion}><DataWorkspace key={datasetRevision} /></main>
        <WorkspaceInsights key={datasetRevision} />
      </div>}
  </div>;
};
