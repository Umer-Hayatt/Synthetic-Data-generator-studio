import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStudio } from '../../context/StudioContext';
import { SchemaModal } from '../schema/SchemaModal';
import { PrivacyModal } from '../schema/PrivacyModal';
import { QualityChartsModal } from '../quality/QualityChartsModal';
import { ConfigPanel } from '../configuration/ConfigPanel';
import { getQualityLabel } from '../../services/qualityLabels';
import styles from './Workspace.module.css';
import type { WorkspaceTool } from './Sidebar';

export function WorkspaceInsights({ tool, onToolHandled }: { tool?: WorkspaceTool | null; onToolHandled?: () => void }) {
  const { datasetSpec, qualityResults, isEvaluatingQuality, generatedSnapshot,
    sensitiveColumns, inferredSchema, relationshipResult, referenceToken, triggerQualityEvaluation,
    schemaNotice, clearSchemaNotice } = useStudio();
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (!tool) return;
    if (tool === 'schema') setSchemaOpen(true);
    if (tool === 'privacy') setPrivacyOpen(true);
    if (tool === 'quality' && referenceToken) {
      if (!qualityResults && generatedSnapshot?.storage === 'frame') void triggerQualityEvaluation();
      setQualityOpen(true);
    }
    if (tool === 'settings') {
      setSettingsOpen(true);
      settings.current?.querySelector<HTMLElement>('summary')?.focus();
      settings.current?.scrollIntoView?.({ block: 'nearest' });
    }
    onToolHandled?.();
  }, [tool, onToolHandled, referenceToken, qualityResults, generatedSnapshot, triggerQualityEvaluation]);
  const sensitive = useMemo(() => {
    const names = new Set(sensitiveColumns);
    if (Array.isArray(inferredSchema)) inferredSchema.forEach((column: { name: string; is_sensitive?: boolean }) => {
      if (column.is_sensitive) names.add(column.name);
    });
    datasetSpec?.tables[0]?.columns.forEach(column => {
      if (['person_name', 'email', 'phone', 'address'].includes(column.semantic_type) ||
        /email|phone|ssn|credit_card/i.test(column.name)) names.add(column.name);
    });
    return names;
  }, [sensitiveColumns, inferredSchema, datasetSpec]);
  const score = qualityResults?.overall_score;
  const measured = !!generatedSnapshot && !!referenceToken && qualityResults?.score_status === 'available' &&
    typeof score === 'number' && Number.isFinite(score);
  const quality = measured ? `${Math.round(score!)}%` : isEvaluatingQuality ? 'Checking…' :
    !generatedSnapshot ? 'Not generated' : !referenceToken ? 'No reference' : 'Not measured';
  const privacy = !generatedSnapshot ? 'Not generated' : qualityResults?.privacy?.status === 'At Risk' ? 'Needs protection' :
    qualityResults?.privacy?.status === 'Protected' ? (referenceToken ? 'Checked' : 'Synthetic only') : 'Not evaluated';
  const integrity = !generatedSnapshot ? 'Not generated' : relationshipResult ?
    (relationshipResult.integrity.lossless && relationshipResult.integrity.primary_keys_unique &&
      relationshipResult.integrity.orphan_foreign_keys === 0 ? 'Verified' : 'Failed') :
    qualityResults?.integrity?.status || 'Not evaluated';

  return <aside className={styles.insights} aria-label="Dataset overview and settings">
    <section data-testid="quality-summary" className={styles.summary}>
      <h2>{referenceToken ? 'Quality & privacy' : 'Privacy & checks'}</h2>
      <dl className={styles.metrics}>
        {referenceToken && <div><dt>Quality</dt><dd className={styles.score}>{quality}</dd>
          <p>{measured ? `${getQualityLabel(Math.round(score!))} · measured against your upload` :
            'Measured after generation.'}</p></div>}
        <div><dt>Privacy</dt><dd>{privacy}</dd><p>{sensitive.size} sensitive {sensitive.size === 1 ? 'field' : 'fields'} detected</p></div>
        <div><dt>Data checks</dt><dd>{integrity}</dd><p>{relationshipResult ?
          `All ${relationshipResult.integrity.source_rows.toLocaleString()} source rows checked` :
          generatedSnapshot?.storage === 'artifact' ? 'Full artifact audit is pending.' : 'Checks apply to the generated snapshot.'}</p></div>
      </dl>
      <div className={styles.actions}>
        {referenceToken && <button disabled={!generatedSnapshot || generatedSnapshot.storage !== 'frame' || isEvaluatingQuality}
          onClick={() => { if (!qualityResults) void triggerQualityEvaluation(); setQualityOpen(true); }}>Quality details</button>}
        <button onClick={() => setPrivacyOpen(true)}>Privacy Settings</button>
        <button onClick={() => setSchemaOpen(true)}>Edit schema</button>
      </div>
    </section>
    <details ref={settings} className={styles.settings} open={settingsOpen} onToggle={e => setSettingsOpen(e.currentTarget.open)}><summary>Generation settings</summary><ConfigPanel embedded /></details>
    {schemaNotice && <details className={styles.notes} open={/AI unavailable|exceeds|invalid/i.test(schemaNotice)}>
      <summary>Generation notes</summary><p>{schemaNotice}</p>
      <button onClick={clearSchemaNotice}>Dismiss notice</button>
    </details>}
    <SchemaModal isOpen={schemaOpen} onClose={() => setSchemaOpen(false)} />
    <PrivacyModal isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} sensitiveColumns={sensitive} />
    <QualityChartsModal isOpen={qualityOpen} onClose={() => setQualityOpen(false)} />
  </aside>;
}
