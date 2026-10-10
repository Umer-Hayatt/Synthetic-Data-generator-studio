import React, { useCallback, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { DataWorkspace } from '../preview/DataWorkspace';
import { WorkspaceInsights } from './WorkspaceInsights';
import { DocumentsWorkspace } from '../documents/DocumentsWorkspace';
import styles from './Workspace.module.css';
import { Sidebar, WorkspaceTool } from './Sidebar';
import { ChevronRight, Table2, FileText } from 'lucide-react';

export const Workspace: React.FC = () => {
  const { activeTab, setActiveTab, datasetName, datasetSpec, datasetRevision, activeSource,
    generatedRowCount } = useStudio();
  const hasDocuments = !!datasetSpec?.documents?.length;
  const documentsOpen = hasDocuments && activeTab === 'documents';
  const source = activeSource?.kind === 'prompt' ? 'AI prompt' : activeSource?.kind === 'demo' ? 'Example dataset' : 'Uploaded data';
  const [tool, setTool] = useState<WorkspaceTool | null>(null);
  const toolHandled = useCallback(() => setTool(null), []);

  return <div className={styles.frame}>
    <Sidebar onTool={value => { if (documentsOpen) setActiveTab('preview'); setTool(value); }} />
    <div className={`${styles.workspace} ${styles.side}`} id="main-content" tabIndex={-1}>
    <div className={styles.breadcrumb}><span>Workspace</span><ChevronRight size={13} /><strong>{documentsOpen ? 'Documents' : 'Data'}</strong><span className={styles.sourceLabel}>{source}</span></div>
    <header className={styles.header}>
      <div><h1>{datasetName || 'Your dataset'}</h1>
        <p>{generatedRowCount ? `${generatedRowCount.toLocaleString()} generated rows` : 'Ready to generate'} · {datasetSpec?.tables[0]?.columns.length || 0} source fields</p></div>
      {hasDocuments && <nav aria-label="Workspace view">
        <button className={documentsOpen ? '' : styles.selected} aria-pressed={!documentsOpen}
          onClick={() => setActiveTab('preview')}><Table2 size={14} />Data</button>
        <button className={documentsOpen ? styles.selected : ''} aria-pressed={documentsOpen}
          onClick={() => setActiveTab('documents')}><FileText size={14} />Documents</button>
      </nav>}
    </header>
    {documentsOpen ? <main className={styles.documentBody}><DocumentsWorkspace key={datasetRevision} /></main> :
      <div className={styles.body}>
        <main className={styles.dataRegion}><DataWorkspace key={datasetRevision} /></main>
        <WorkspaceInsights key={datasetRevision} tool={tool} onToolHandled={toolHandled} />
      </div>}
  </div></div>;
};
