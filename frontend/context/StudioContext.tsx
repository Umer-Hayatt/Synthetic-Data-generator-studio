import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import {
  ColumnSpec,
  DatasetSpec,
  QualityResponse,
  WorkspaceTab,
} from '../types';
import { api } from '../services/api';
import { SAMPLE_DATASETS, getSampleFile } from '../services/samples';
import {
  Artifact,
  Job,
  TableArtifactMap,
  isTerminal,
  jsonBody,
  v2Origin,
  v2Request,
} from '../services/v2';
import { COMMERCE_RELATIONAL_SPEC, BANKING_RELATIONAL_SPEC } from '../services/relationalDemo';

interface StudioContextType {
  activeSource: { id: number; kind: 'upload' | 'prompt' | 'demo'; prompt?: string } | null;
  datasetRevision: number;
  generatedSnapshot: { sourceId: number; revision: number; datasetId: string; storage: 'frame' | 'artifact' } | null;
  // Session & Tokens (Reference vs Generated kept strictly separate)
  referenceToken: string | null;
  generatedToken: string | null;
  tokenExpirySeconds: number | null;
  datasetName: string;

  // Inferred & Configured Data Spec
  inferredSchema: Record<string, any> | null;
  sensitiveColumns: string[];
  datasetSpec: DatasetSpec | null;

  // Previews & Metadata
  referencePreview: Record<string, any>[];
  referenceRowCount: number;
  referenceColumns: string[];

  generatedPreview: Record<string, any>[];
  generatedRowCount: number;
  generatedColumns: string[];

  // Evaluation States
  qualityResults: QualityResponse | null;

  // Navigation & UI States
  activeTab: WorkspaceTab;
  setActiveTab: (tab: WorkspaceTab) => void;
  previewViewMode: 'generated' | 'reference';
  setPreviewViewMode: (mode: 'generated' | 'reference') => void;

  // System & Health States
  backendOnline: boolean | null;
  isIngesting: boolean;
  isGenerating: boolean;
  isEvaluatingQuality: boolean;
  error: { message: string; isSessionExpired?: boolean } | null;

  schemaNotice: string | null;
  loadFromAiPrompt: (prompt: string) => Promise<boolean>;
  clearSchemaNotice: () => void;

  // Relational & Documents
  tableArtifacts: Record<string, string>;
  tableArtifactMap: Record<string, string>;
  documentArtifacts: Artifact[];
  documentManifestId: string | null;
  relationalPreviews: Record<string, Record<string, any>[]>;
  isGeneratingMultiTable: boolean;
  triggerMultiTableGenerate: () => Promise<boolean>;
  generateRelationalFromSpec: (specOverride?: DatasetSpec) => Promise<boolean>;
  generateDocumentsFromSpec: (specOverride?: DatasetSpec) => Promise<boolean>;
  loadCommerceRelational: () => Promise<boolean>;
  loadBankingRelational: () => Promise<boolean>;

  // Actions
  checkBackendHealth: () => Promise<boolean>;
  handleFileUpload: (file: File) => Promise<boolean>;
  loadSampleDataset: (sampleId: string) => Promise<boolean>;
  updateSpec: (spec: DatasetSpec) => void;
  updateColumnConfig: (columnName: string, updates: Partial<ColumnSpec>) => void;
  updateGlobalConfig: (updates: { rowCount?: number; seed?: number }) => void;
  triggerGenerate: (rowCountOverride?: number) => Promise<boolean>;
  triggerQualityEvaluation: () => Promise<boolean>;
  clearSession: () => void;
  dismissError: () => void;
  reportError: (error: { message: string; isSessionExpired?: boolean }) => void;
}


const StudioContext = createContext<StudioContextType | undefined>(undefined);

export function StudioProvider({ children }: { children: ReactNode }) {
  const revisionRef = useRef(0);
  const mountedRef = useRef(true);
  const sourceRef = useRef<StudioContextType['activeSource']>(null);
  const [activeSource, setActiveSource] = useState<StudioContextType['activeSource']>(null);
  const [datasetRevision, setDatasetRevision] = useState(0);
  const [generatedSnapshot, setGeneratedSnapshot] = useState<StudioContextType['generatedSnapshot']>(null);
  const [referenceToken, setReferenceToken] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [tokenExpirySeconds, setTokenExpirySeconds] = useState<number | null>(
    null
  );
  const [datasetName, setDatasetName] = useState<string>('Untitled Dataset');

  const [inferredSchema, setInferredSchema] = useState<Record<string, any> | null>(
    null
  );
  const [sensitiveColumns, setSensitiveColumns] = useState<string[]>([]);
  const [datasetSpec, setDatasetSpecState] = useState<DatasetSpec | null>(null);
  const specRef = useRef<DatasetSpec | null>(null);
  const setDatasetSpec = useCallback((spec: DatasetSpec | null) => {
    specRef.current = spec;
    setDatasetSpecState(spec);
  }, []);

  const [referencePreview, setReferencePreview] = useState<Record<string, any>[]>(
    []
  );
  const [referenceRowCount, setReferenceRowCount] = useState<number>(0);
  const [referenceColumns, setReferenceColumns] = useState<string[]>([]);

  const [generatedPreview, setGeneratedPreview] = useState<Record<string, any>[]>(
    []
  );
  const [generatedRowCount, setGeneratedRowCount] = useState<number>(0);
  const [generatedColumns, setGeneratedColumns] = useState<string[]>([]);

  const [qualityResults, setQualityResults] = useState<QualityResponse | null>(
    null
  );

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('preview');
  const [previewViewMode, setPreviewViewMode] = useState<
    'generated' | 'reference'
  >('generated');

  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [isIngesting, setIsIngesting] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isEvaluatingQuality, setIsEvaluatingQuality] = useState<boolean>(false);
  const [error, setError] = useState<{
    message: string;
    isSessionExpired?: boolean;
  } | null>(null);
  const [schemaNotice, setSchemaNotice] = useState<string | null>(null);

  const [tableArtifacts, setTableArtifacts] = useState<Record<string, string>>({});
  const [documentArtifacts, setDocumentArtifacts] = useState<Artifact[]>([]);
  const [documentManifestId, setDocumentManifestId] = useState<string | null>(null);
  const [relationalPreviews, setRelationalPreviews] = useState<Record<string, Record<string, any>[]>>({});
  const [isGeneratingMultiTable, setIsGeneratingMultiTable] = useState<boolean>(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const isCurrent = useCallback((revision: number) =>
    mountedRef.current && revisionRef.current === revision, []);

  const invalidateOutputs = useCallback(() => {
    const revision = ++revisionRef.current;
    setDatasetRevision(revision);
    setGeneratedSnapshot(null);
    setGeneratedToken(null);
    setGeneratedPreview([]);
    setGeneratedRowCount(0);
    setGeneratedColumns([]);
    setQualityResults(null);
    setTableArtifacts({});
    setDocumentArtifacts([]);
    setDocumentManifestId(null);
    setRelationalPreviews({});
    setIsIngesting(false);
    setIsGenerating(false);
    setIsGeneratingMultiTable(false);
    setIsEvaluatingQuality(false);
    setError(null);
    setSchemaNotice(null);
    return revision;
  }, []);

  const recordSnapshot = useCallback((revision: number, datasetId: string, storage: 'frame' | 'artifact') => {
    if (isCurrent(revision) && sourceRef.current) {
      setGeneratedSnapshot({ sourceId: sourceRef.current.id, revision, datasetId, storage });
    }
  }, [isCurrent]);

  const checkBackendHealth = useCallback(async (): Promise<boolean> => {
    try {
      await api.checkHealth();
      setBackendOnline(true);
      return true;
    } catch {
      setBackendOnline(false);
      return false;
    }
  }, []);

  // Check health on mount and periodically
  useEffect(() => {
    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 15000);
    return () => clearInterval(interval);
  }, [checkBackendHealth]);

  const clearSession = useCallback(() => {
    invalidateOutputs();
    sourceRef.current = null;
    setActiveSource(null);
    setReferenceToken(null);
    setTokenExpirySeconds(null);
    setDatasetName('Untitled Dataset');
    setInferredSchema(null);
    setSensitiveColumns([]);
    setDatasetSpec(null);
    setReferencePreview([]);
    setReferenceRowCount(0);
    setReferenceColumns([]);
    setActiveTab('preview');
    setPreviewViewMode('generated');
  }, [invalidateOutputs]);

  const beginSource = useCallback((kind: 'upload' | 'prompt' | 'demo', prompt?: string) => {
    clearSession();
    const source = { id: revisionRef.current, kind, ...(prompt !== undefined ? { prompt } : {}) };
    sourceRef.current = source;
    setActiveSource(source);
    return revisionRef.current;
  }, [clearSession]);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const clearSchemaNotice = useCallback(() => {
    setSchemaNotice(null);
  }, []);

  const handleFileUpload = useCallback(
    async (file: File): Promise<boolean> => {
      const revision = beginSource('upload');
      setIsIngesting(true);
      setError(null);
      setSchemaNotice(null);
      try {
        const resp = await api.ingestFile(file);
        if (!isCurrent(revision)) return false;

        // Retain reference token separate from generated token
        setReferenceToken(resp.dataset_id);
        setTokenExpirySeconds(resp.expires_in_seconds);
        setDatasetName(file.name.replace(/\.[^/.]+$/, ''));
        setInferredSchema(resp.schema);
        const detectedSensitives = resp.sensitive_columns || (
          Array.isArray(resp.schema)
            ? resp.schema.filter((col: any) => col.is_sensitive).map((col: any) => col.name)
            : []
        );
        setSensitiveColumns(detectedSensitives);
        setDatasetSpec(resp.spec);
        setReferencePreview(resp.preview || []);
        setReferenceRowCount(resp.row_count);
        setReferenceColumns(resp.columns);

        // Reset generated token and outputs on new upload
        setGeneratedToken(null);
        setGeneratedPreview([]);
        setGeneratedRowCount(0);
        setGeneratedColumns([]);
        setQualityResults(null);
        setPreviewViewMode('reference');

        // Automatically trigger initial generation with the fitted spec
        setIsGenerating(true);
        try {
          const genResp = await api.generateData(resp.spec, 25);
          if (!isCurrent(revision)) return false;
          recordSnapshot(revision, genResp.dataset_id, 'frame');
          setGeneratedToken(genResp.dataset_id);
          setGeneratedPreview(genResp.preview);
          setGeneratedRowCount(genResp.row_count);
          setGeneratedColumns(genResp.columns);
          setPreviewViewMode('generated');

          // Trigger initial quality evaluation seamlessly in background
          api
            .evaluateQuality(resp.dataset_id, genResp.dataset_id)
            .then((q) => { if (isCurrent(revision)) setQualityResults(q); })
            .catch(() => {
              /* quality evaluation can be run explicitly via tab */
            });
        } catch (genErr: any) {
          if (!isCurrent(revision)) return false;
          setError({
            message: `Generation error: ${genErr.message}`,
            isSessionExpired: genErr.isSessionExpired,
          });
        } finally {

          if (isCurrent(revision)) setIsGenerating(false);
        }

        return true;
      } catch (err: any) {
        if (!isCurrent(revision)) return false;
        setError({
          message: err.message || 'Failed to ingest file.',
          isSessionExpired: err.isSessionExpired,
        });
        return false;
      } finally {
        if (isCurrent(revision)) setIsIngesting(false);
      }
    },
    [beginSource, isCurrent, recordSnapshot]
  );

  const loadSampleDataset = useCallback(
    async (sampleId: string): Promise<boolean> => {
      const sample = SAMPLE_DATASETS.find((s) => s.id === sampleId);
      if (!sample) return false;
      const file = getSampleFile(sample);
      return handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const loadFromAiPrompt = useCallback(
    async (prompt: string): Promise<boolean> => {
      const revision = beginSource('prompt', prompt);
      setIsIngesting(true);
      setError(null);
      setSchemaNotice(null);
      try {
        const resp = await api.promptSpec(prompt);
        if (!isCurrent(revision)) return false;

        if (resp.status === 'unavailable' || !resp.spec) {
          const errMsg = resp.detail || resp.fallback || 'Unable to draft schema specification from prompt.';
          setError({
            message: errMsg,
          });
          return false;
        }

        const table = resp.spec.tables[0];
        if (!table || !table.columns.length) {
          setError({
            message: 'Drafted specification did not contain any valid columns.',
          });
          return false;
        }

        // Reset reference data (since this is prompt-only generation)
        setReferenceToken(null);
        setReferenceRowCount(0);
        setReferenceColumns([]);
        setReferencePreview([]);

        // Set dataset name and spec
        setDatasetName(resp.spec.name || 'AI Generated Dataset');
        setDatasetSpec(resp.spec);

        // Derive inferred schema summary & sensitive columns
        const schemaSummary = table.columns.map((col) => ({
          name: col.name,
          dtype: col.dtype,
          semantic_type: col.semantic_type,
          is_sensitive:
            ['email', 'phone', 'person_name', 'address'].includes(col.semantic_type) ||
            /email|phone|ssn|credit_card|address|name/i.test(col.name),
        }));
        setInferredSchema(schemaSummary);
        const sensitiveNames = schemaSummary.filter((c) => c.is_sensitive).map((c) => c.name);
        setSensitiveColumns(sensitiveNames);

        // Automatically run generation from the prompt-derived spec
        setIsGenerating(true);
        let genResp: any = null;
        try {
          genResp = await api.generateData(resp.spec, 50);
          if (!isCurrent(revision)) return false;
          recordSnapshot(revision, genResp.dataset_id, 'frame');
          setGeneratedToken(genResp.dataset_id);
          setGeneratedPreview(genResp.preview);
          setGeneratedRowCount(genResp.row_count);
          setGeneratedColumns(genResp.columns);
          setPreviewViewMode('generated');

          // Trigger quality evaluation without reference data
          api
            .evaluateQuality(null, genResp.dataset_id, resp.spec)
            .then((q) => { if (isCurrent(revision)) setQualityResults(q); })
            .catch(() => {});
        } catch (genErr: any) {
          if (!isCurrent(revision)) return false;
          setError({
            message: `Generation error: ${genErr.message}`,
            isSessionExpired: genErr.isSessionExpired,
          });
        } finally {
          if (isCurrent(revision)) setIsGenerating(false);
        }

        // Capture notices if fallback was used or warnings were issued
        const notices: string[] = [];
        if (resp.fallback_used || resp.notice) {
          notices.push(resp.notice || 'Deterministic rule-based draft generated from prompt.');
        }
        if (resp.warnings && resp.warnings.length > 0) {
          notices.push(...resp.warnings);
        }
        if (genResp?.warnings && genResp.warnings.length > 0) {
          notices.push(...genResp.warnings);
        }
        if (notices.length > 0) {
          setSchemaNotice(notices.join(' '));
        }

        // Navigate directly to preview tab to show the synthesized table
        setActiveTab('preview');
        return true;
      } catch (err: any) {
        if (!isCurrent(revision)) return false;
        setError({
          message: err.message || 'Failed to generate specification from prompt.',
          isSessionExpired: err.isSessionExpired,
        });
        return false;
      } finally {
        if (isCurrent(revision)) setIsIngesting(false);
      }
    },
    [beginSource, isCurrent, recordSnapshot]
  );

  const updateSpec = useCallback((spec: DatasetSpec) => {
    if (JSON.stringify(spec) === JSON.stringify(specRef.current)) return;
    invalidateOutputs();
    setDatasetSpec(spec);
  }, [invalidateOutputs, setDatasetSpec]);

  const updateColumnConfig = useCallback(
    (columnName: string, updates: Partial<ColumnSpec>) => {
      const spec = specRef.current;
      if (!spec || !spec.tables.length) return;
      const newTables = spec.tables.map((table, tIdx) => {
        if (tIdx !== 0) return table;
        const newCols = table.columns.map((col) => {
          if (col.name !== columnName) return col;
          return { ...col, ...updates };
        });
        return { ...table, columns: newCols };
      });
      updateSpec({ ...spec, tables: newTables });
    },
    [updateSpec]
  );

  const updateGlobalConfig = useCallback(
    (updates: { rowCount?: number; seed?: number }) => {
      const spec = specRef.current;
      if (!spec) return;
      const newSeed = updates.seed !== undefined ? updates.seed : spec.seed;
      const newTables = spec.tables.map((table, tIdx) => {
        if (tIdx === 0 && updates.rowCount !== undefined) {
          return { ...table, row_count: updates.rowCount };
        }
        return table;
      });
      updateSpec({ ...spec, seed: newSeed, tables: newTables });
    },
    [updateSpec]
  );

  const generateRelationalFromSpec = useCallback(
    async (specOverride?: DatasetSpec): Promise<boolean> => {
      const activeSpec = specOverride || datasetSpec;
      if (!activeSpec) return false;
      if (activeSpec.tables.length < 2 && !activeSpec.documents?.length) {
        setError({ message: 'This dataset has no relational model yet. Keep the current tabular data while relationships are configured.' });
        return false;
      }
      const revision = invalidateOutputs();
      setIsGeneratingMultiTable(true);
      setIsGenerating(true);
      setError(null);
      try {
        const hasDocs = !!(activeSpec.documents?.length);
        const hasMulti = (activeSpec.tables?.length ?? 0) > 1;
        const engine = hasDocs ? 'documents' : hasMulti ? 'relational' : 'statistical';
        const jobResp = await v2Request<Job>('/jobs/generate', jsonBody({
          spec: activeSpec,
          engine,
          accepted: true,
        }));
        if (!isCurrent(revision)) return false;
        let currentJob = jobResp;
        let attempts = 0;
        while (!isTerminal(currentJob.status) && attempts < 40) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          if (!isCurrent(revision)) return false;
          currentJob = await v2Request<Job>(`/jobs/${currentJob.job_id}`);
          if (!isCurrent(revision)) return false;
          attempts++;
        }
        if (currentJob.status !== 'complete') {
          throw new Error(currentJob.error || (currentJob.status === 'cancelled'
            ? 'Generation was cancelled.' : 'Generation has not completed. Please retry.'));
        }
        const list = await Promise.all(
          currentJob.artifacts.map((id) => v2Request<Artifact>(`/artifacts/${id}`))
        );
        if (!isCurrent(revision)) return false;
        const last = list[list.length - 1];
        if (last?.format !== 'json') throw new Error('Generation did not return a table manifest.');
        const resp = await fetch(`${v2Origin}/api/v1/artifacts/${last.id}/download`);
        if (!isCurrent(revision)) return false;
        if (!resp.ok) throw new Error('Unable to load the generated table manifest.');
        const manifest = (await resp.json()) as TableArtifactMap;
        if (!isCurrent(revision)) return false;
        if (!manifest.tables || !activeSpec.tables.every((table) => manifest.tables[table.name])) {
          throw new Error('Generated table manifest does not match the active specification.');
        }
        // Fetch previews without publishing a partial or superseded manifest.
        const newPreviews: Record<string, Record<string, any>[]> = {};
        for (const [tName, aId] of Object.entries(manifest.tables)) {
          if (!isCurrent(revision)) return false;
          try {
            const art = await v2Request<Artifact>(`/artifacts/${aId}?preview_rows=25`);
            if (!isCurrent(revision)) return false;
            if (art.preview) newPreviews[tName] = art.preview;
          } catch {
            // Preview failures do not invalidate downloadable output artifacts.
          }
        }
        if (!isCurrent(revision)) return false;
        setDocumentArtifacts(list);
        setDocumentManifestId(last.id);
        setTableArtifacts(manifest.tables);
        setRelationalPreviews(newPreviews);
        const firstTableName = activeSpec.tables[0].name;
        const firstAid = manifest.tables[firstTableName];
        setGeneratedPreview(newPreviews[firstTableName] || []);
        setGeneratedRowCount(activeSpec.tables[0].row_count);
        setGeneratedColumns(activeSpec.tables[0].columns.map((column) => column.name));
        setGeneratedToken(firstAid);
        recordSnapshot(revision, firstAid, 'artifact');
        return true;
      } catch (err: any) {
        if (!isCurrent(revision)) return false;
        setError({ message: err.message || 'Relational generation failed.' });
        return false;
      } finally {
        if (isCurrent(revision)) {
          setIsGeneratingMultiTable(false);
          setIsGenerating(false);
        }
      }
    },
    [datasetSpec, invalidateOutputs, isCurrent, recordSnapshot]
  );

  const generateDocumentsFromSpec = useCallback(
    async (specOverride?: DatasetSpec): Promise<boolean> => {
      const spec = specOverride || datasetSpec;
      if (!spec?.documents?.length) {
        setError({ message: 'No document mapping is configured for this dataset. Required fields must be mapped before generating documents.' });
        return false;
      }
      return generateRelationalFromSpec(spec);
    },
    [datasetSpec, generateRelationalFromSpec]
  );

  const triggerMultiTableGenerate = useCallback(async (): Promise<boolean> => {
    return generateRelationalFromSpec();
  }, [generateRelationalFromSpec]);

  const loadCommerceRelational = useCallback(async (): Promise<boolean> => {
    beginSource('demo');
    setDatasetName(COMMERCE_RELATIONAL_SPEC.name);
    setDatasetSpec(COMMERCE_RELATIONAL_SPEC);
    setActiveTab('relational');
    return generateRelationalFromSpec(COMMERCE_RELATIONAL_SPEC);
  }, [beginSource, generateRelationalFromSpec]);

  const loadBankingRelational = useCallback(async (): Promise<boolean> => {
    beginSource('demo');
    setDatasetName(BANKING_RELATIONAL_SPEC.name);
    setDatasetSpec(BANKING_RELATIONAL_SPEC);
    setActiveTab('documents');
    return generateRelationalFromSpec(BANKING_RELATIONAL_SPEC);
  }, [beginSource, generateRelationalFromSpec]);

  const triggerGenerate = useCallback(
    async (rowCountOverride?: number): Promise<boolean> => {
      if (!datasetSpec) return false;
      const isMulti = datasetSpec.tables.length > 1 || (datasetSpec.documents?.length ?? 0) > 0;
      if (isMulti) {
        return triggerMultiTableGenerate();
      }
      const revision = invalidateOutputs();
      setIsGenerating(true);
      setError(null);

      const targetSpec: DatasetSpec =
        rowCountOverride !== undefined
          ? {
              ...datasetSpec,
              tables: datasetSpec.tables.map((tbl, i) =>
                i === 0 ? { ...tbl, row_count: rowCountOverride } : tbl
              ),
            }
          : datasetSpec;

      try {
        const resp = await api.generateData(targetSpec, 50);
        if (!isCurrent(revision)) return false;
        recordSnapshot(revision, resp.dataset_id, 'frame');
        setGeneratedToken(resp.dataset_id);
        setGeneratedPreview(resp.preview);
        setGeneratedRowCount(resp.row_count);
        setGeneratedColumns(resp.columns);
        setPreviewViewMode('generated');

        if (resp.warnings && resp.warnings.length > 0) {
          setSchemaNotice(resp.warnings.join(' '));
        }

        // Automatically refresh quality evaluation
        api
          .evaluateQuality(referenceToken || null, resp.dataset_id, targetSpec)
          .then((q) => { if (isCurrent(revision)) setQualityResults(q); })
          .catch(() => {});
        return true;
      } catch (err: any) {
        if (!isCurrent(revision)) return false;
        setError({
          message: err.message || 'Generation failed.',
          isSessionExpired: err.isSessionExpired,
        });
        return false;
      } finally {
        if (isCurrent(revision)) setIsGenerating(false);
      }
    },
    [datasetSpec, referenceToken, triggerMultiTableGenerate, invalidateOutputs, isCurrent, recordSnapshot]
  );

  const triggerQualityEvaluation = useCallback(async (): Promise<boolean> => {
    const revision = revisionRef.current;
    if (!generatedToken) {
      setError({
        message: 'Quality evaluation requires a generated dataset.',
      });
      return false;
    }
    setIsEvaluatingQuality(true);
    setError(null);
    try {
      const q = await api.evaluateQuality(referenceToken || null, generatedToken, datasetSpec || null);
      if (!isCurrent(revision)) return false;
      setQualityResults(q);
      return true;
    } catch (err: any) {
      if (!isCurrent(revision)) return false;
      setError({
        message: err.message || 'Quality evaluation failed.',
        isSessionExpired: err.isSessionExpired,
      });
      return false;
    } finally {
      if (isCurrent(revision)) setIsEvaluatingQuality(false);
    }
  }, [referenceToken, generatedToken, datasetSpec, isCurrent]);

  return (
    <StudioContext.Provider
      value={{
        activeSource,
        datasetRevision,
        generatedSnapshot,
        referenceToken,
        generatedToken,
        tokenExpirySeconds,
        datasetName,
        inferredSchema,
        sensitiveColumns,
        datasetSpec,
        referencePreview,
        referenceRowCount,
        referenceColumns,
        generatedPreview,
        generatedRowCount,
        generatedColumns,
        qualityResults,
        activeTab,
        setActiveTab,
        previewViewMode,
        setPreviewViewMode,
        backendOnline,
        isIngesting,
        isGenerating,
        isEvaluatingQuality,
        error,
        checkBackendHealth,
        handleFileUpload,
        loadSampleDataset,
        updateSpec,
        updateColumnConfig,
        updateGlobalConfig,
        triggerGenerate,
        triggerQualityEvaluation,
        clearSession,
        dismissError,
        reportError: setError,
        schemaNotice,
        loadFromAiPrompt,
        clearSchemaNotice,
        tableArtifacts,
        tableArtifactMap: tableArtifacts,
        documentArtifacts,
        documentManifestId,
        relationalPreviews,
        isGeneratingMultiTable,
        triggerMultiTableGenerate,
        generateRelationalFromSpec,
        generateDocumentsFromSpec,
        loadCommerceRelational,
        loadBankingRelational,
      }}
    >
      {children}
    </StudioContext.Provider>
  );

}

export function useStudio() {
  const context = useContext(StudioContext);
  if (!context) {
    throw new Error('useStudio must be used within a StudioProvider');
  }
  return context;
}
