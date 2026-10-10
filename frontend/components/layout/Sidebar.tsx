import React, { useEffect, useRef, useState } from 'react';
import { Database, Table2, FileText, Braces, Shield, SlidersHorizontal, ChartNoAxesColumn,
  Plus, Menu, X, CircleHelp, CheckCircle2, AlertCircle } from 'lucide-react';
import { useStudio } from '../../context/StudioContext';
import styles from './Workspace.module.css';

export type WorkspaceTool = 'schema' | 'privacy' | 'quality' | 'settings';

export function Sidebar({ onTool }: { onTool: (tool: WorkspaceTool) => void }) {
  const { datasetSpec, datasetName, activeTab, setActiveTab, clearSession, referenceToken,
    backendOnline, relationshipResult } = useStudio();
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
    <button ref={menuButton} className={styles.mobileMenu} aria-label={open ? 'Close navigation' : 'Open navigation'}
      aria-expanded={open} aria-controls="studio-navigation" onClick={() => setOpen(value => !value)}><Menu size={19} /></button>
    {open && <button className={styles.menuScrim} onClick={() => { setOpen(false); menuButton.current?.focus(); }} aria-label="Close navigation backdrop" />}
    <aside ref={navigation} role={open ? 'dialog' : undefined} aria-modal={open ? true : undefined}
      aria-label={open ? 'Studio navigation' : undefined} className={`${styles.sidebar} ${open ? styles.sidebarOpen : ''}`}>
      <div className={styles.sidebarBrand}><span className="brand-mark"><Database size={19} strokeWidth={1.7} /></span><span>Synthetic<br /><strong>Data Studio</strong></span>
        <button className={styles.mobileClose} aria-label="Close navigation" onClick={() => { setOpen(false); menuButton.current?.focus(); }}><X size={18} /></button></div>
      <div className={styles.datasetLabel}><span className={styles.datasetIcon}><Database size={15} /></span><span><small>Current dataset</small><strong title={datasetName}>{datasetName}</strong></span></div>
      <button className={styles.newDataset} onClick={() => act(clearSession)}><Plus size={15} /> New dataset</button>
      <nav id="studio-navigation" aria-label="Studio navigation">
        <div className={styles.navGroup}><span className={styles.navLabel}>Workspace</span>
          <button className={!documents ? styles.navActive : ''} aria-current={!documents ? 'page' : undefined}
            onClick={() => act(() => setActiveTab('preview'))}><Table2 size={16} />Data<span className={styles.navCount}>{tableCount}</span></button>
          {hasDocuments && <button className={documents ? styles.navActive : ''} aria-current={documents ? 'page' : undefined}
            onClick={() => act(() => setActiveTab('documents'))}><FileText size={16} />Documents</button>}
        </div>
        <div className={styles.navGroup}><span className={styles.navLabel}>Dataset controls</span>
          <button onClick={() => act(() => onTool('schema'))}><Braces size={16} />Schema</button>
          <button onClick={() => act(() => onTool('privacy'))}><Shield size={16} />Privacy</button>
          {referenceToken && <button onClick={() => act(() => onTool('quality'))}><ChartNoAxesColumn size={16} />Quality details</button>}
          <button onClick={() => act(() => onTool('settings'))}><SlidersHorizontal size={16} />Generation settings</button>
        </div>
      </nav>
      <div className={styles.sidebarFoot}><details className={styles.guide}><summary><CircleHelp size={15} />Workspace guide</summary>
        <p>Choose Data to inspect tables. Click a linked ID to see its related record. Downloads include the whole selected table.</p>
        <p>Changing schema or settings clears previous results. Generate again to use your changes.</p></details>
        <div className={styles.connection} role="status">{backendOnline === true ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}<span>{backendOnline === true ? 'API connected' : backendOnline === false ? 'API unavailable' : 'Connecting to API…'}</span></div>
      </div>
    </aside>
  </>;
}
