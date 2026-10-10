import React, { useEffect, useRef, useState } from 'react';
import { Database, Table2, FileText, Braces, Shield, ChartNoAxesColumn,
  Plus, Menu, X, CircleHelp, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import styles from './Workspace.module.css';
import { Brand } from '../common/Brand';
import { displayLabel } from '../../services/displayLabels';

export function Sidebar() {
  const { datasetSpec, datasetName, activeTab, setActiveTab, clearSession, referenceToken,
    backendOnline, relationshipResult, generatedSnapshot, qualityResults, triggerQualityEvaluation } = useStudio();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const tableCount = relationshipResult?.tables.length || datasetSpec?.tables.length || 0;
  const hasDocuments = !!datasetSpec?.documents?.length;
  const documents = hasDocuments && activeTab === 'documents';

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const controls = () => Array.from(navigation.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href]') || [])
      .filter(item => item.getClientRects().length > 0);
    controls()[0]?.focus();
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setOpen(false); menuButton.current?.focus(); }
      if (e.key === 'Tab') {
        const items = controls(), first = items[0], last = items[items.length - 1];
        if (!navigation.current?.contains(document.activeElement) ||
          (e.shiftKey && document.activeElement === first) || (!e.shiftKey && document.activeElement === last)) {
          e.preventDefault(); (e.shiftKey ? last : first)?.focus();
        }
      }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [open]);

  const act = (action: () => void) => {
    if (open) menuButton.current?.focus();
    setOpen(false); action();
  };
  return <>
    <button ref={menuButton} className={styles.mobileMenu} aria-label={open ? 'Close Navigation' : 'Open Navigation'}
      aria-expanded={open} aria-controls="studio-navigation" onClick={() => setOpen(value => !value)}><Menu size={19} /></button>
    {open && <button className={styles.menuScrim} onClick={() => { setOpen(false); menuButton.current?.focus(); }} aria-label="Close Navigation backdrop" />}
    <aside ref={navigation} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined}
      aria-label={open ? 'Studio Navigation' : undefined} className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
      <div className={styles.sidebarBrand}><Brand />
        <button className={styles.mobileClose} aria-label="Close Navigation" onClick={() => { setOpen(false); menuButton.current?.focus(); }}><X size={18} /></button></div>
      <div className={styles.datasetLabel}><span className={styles.datasetIcon}><Database size={15} /></span><span><small>Current Dataset</small><strong title={displayLabel(datasetName)}>{displayLabel(datasetName)}</strong></span></div>
      <button className={styles.newDataset} onClick={() => act(clearSession)}><Plus size={15} /> New Dataset</button>
      <nav id="studio-navigation" aria-label="Studio Navigation">
        <div className={styles.navGroup}><span className={styles.navLabel}>Workspace</span>
          <button className={activeTab === 'preview' || activeTab === 'relational' ? styles.navActive : ''} aria-current={activeTab === 'preview' || activeTab === 'relational' ? 'page' : undefined}
            onClick={() => act(() => setActiveTab('preview'))}><Table2 size={16} />Data<span className={styles.navCount}>{tableCount}</span></button>
          {hasDocuments && <button className={documents ? styles.navActive : ''} aria-current={documents ? 'page' : undefined}
            onClick={() => act(() => setActiveTab('documents'))}><FileText size={16} />Documents</button>}
        </div>
        <div className={styles.navGroup}><span className={styles.navLabel}>Dataset Controls</span>
          <button className={activeTab === 'schema' ? styles.navActive : ''} aria-current={activeTab === 'schema' ? 'page' : undefined}
            onClick={() => act(() => setActiveTab('schema'))}><Braces size={16} />Schema</button>
          <button className={activeTab === 'privacy' ? styles.navActive : ''} aria-current={activeTab === 'privacy' ? 'page' : undefined}
            onClick={() => act(() => setActiveTab('privacy'))}><Shield size={16} />Privacy</button>
          {referenceToken && <button className={activeTab === 'quality' ? styles.navActive : ''} aria-current={activeTab === 'quality' ? 'page' : undefined}
            onClick={() => act(() => { setActiveTab('quality'); if (!qualityResults && generatedSnapshot?.storage === 'frame') void triggerQualityEvaluation(); })}><ChartNoAxesColumn size={16} />Quality Details</button>}
        </div>
      </nav>
      <div className={styles.sidebarFoot}><details className={styles.guide}><summary><CircleHelp size={15} />Workspace Guide</summary>
        <p>Choose Data to inspect tables. Click a linked ID to see its related record. Downloads include the whole selected table.</p>
        <p>Changing schema or settings clears previous results. Generate again to use your changes.</p></details>
        <div className={styles.connection} role="status">{backendOnline === true ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}<span>{backendOnline === true ? 'API connected' : backendOnline === false ? 'API unavailable' : 'Connecting to API…'}</span></div>
      </div>
    </aside>
  </>;
}
