import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import {
  ColumnSpec,
  DatasetSpec,
  QualityResponse,
  WorkspaceTab,
} from '../types';
import { api, ApiError } from '../services/api';
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
import { FIXTURE_COMMERCE_SPEC } from '../services/fixtures';
import { COMMERCE_RELATIONAL_SPEC, BANKING_RELATIONAL_SPEC } from '../services/relationalDemo';

interface StudioContextType {
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
  loadRelationalDemo: () => void;
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
  const [datasetSpec, setDatasetSpec] = useState<DatasetSpec | null>(null);

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
    setReferenceToken(null);
    setGeneratedToken(null);
    setTokenExpirySeconds(null);
    setDatasetName('Untitled Dataset');
    setInferredSchema(null);
    setSensitiveColumns([]);
    setDatasetSpec(null);
    setReferencePreview([]);
    setReferenceRowCount(0);
    setReferenceColumns([]);
    setGeneratedPreview([]);
    setGeneratedRowCount(0);
    setGeneratedColumns([]);
    setQualityResults(null);
    setTableArtifacts({});
    setDocumentArtifacts([]);
    setDocumentManifestId(null);
    setRelationalPreviews({});
    setActiveTab('preview');
    setError(null);
    setSchemaNotice(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const clearSchemaNotice = useCallback(() => {
    setSchemaNotice(null);
  }, []);

  const handleFileUpload = useCallback(
    async (file: File): Promise<boolean> => {
      setIsIngesting(true);
      setError(null);
      setSchemaNotice(null);
      try {
        const resp = await api.ingestFile(file);

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
          setGeneratedToken(genResp.dataset_id);
          setGeneratedPreview(genResp.preview);
          setGeneratedRowCount(genResp.row_count);
          setGeneratedColumns(genResp.columns);
          setPreviewViewMode('generated');

          // Trigger initial quality evaluation seamlessly in background
          api
            .evaluateQuality(resp.dataset_id, genResp.dataset_id)
            .then((q) => setQualityResults(q))
            .catch(() => {
              /* quality evaluation can be run explicitly via tab */
            });
        } catch (genErr: any) {
          setError({
            message: `Generation error: ${genErr.message}`,
            isSessionExpired: genErr.isSessionExpired,
          });
        } finally {

          setIsGenerating(false);
        }

        return true;
      } catch (err: any) {
        setError({
          message: err.message || 'Failed to ingest file.',
          isSessionExpired: err.isSessionExpired,
        });
        return false;
      } finally {
        setIsIngesting(false);
      }
    },
    []
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
      setIsIngesting(true);
      setError(null);
      setSchemaNotice(null);
      try {
        const resp = await api.promptSpec(prompt);

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
          setGeneratedToken(genResp.dataset_id);
          setGeneratedPreview(genResp.preview);
          setGeneratedRowCount(genResp.row_count);
          setGeneratedColumns(genResp.columns);
          setPreviewViewMode('generated');

          // Trigger quality evaluation without reference data
          api
            .evaluateQuality(null, genResp.dataset_id, resp.spec)
            .then((q) => setQualityResults(q))
            .catch(() => {});
        } catch (genErr: any) {
          setError({
            message: `Generation error: ${genErr.message}`,
            isSessionExpired: genErr.isSessionExpired,
          });
        } finally {
          setIsGenerating(false);
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
        setError({
          message: err.message || 'Failed to generate specification from prompt.',
          isSessionExpired: err.isSessionExpired,
        });
        return false;
      } finally {
        setIsIngesting(false);
      }
    },
    []
  );

  const updateSpec = useCallback((spec: DatasetSpec) => {
    setDatasetSpec(spec);
  }, []);

  const updateColumnConfig = useCallback(
    (columnName: string, updates: Partial<ColumnSpec>) => {
      setDatasetSpec((prev) => {
        if (!prev || !prev.tables.length) return prev;
        const newTables = prev.tables.map((table, tIdx) => {
          if (tIdx !== 0) return table;
          const newCols = table.columns.map((col) => {
            if (col.name !== columnName) return col;
            return { ...col, ...updates };
          });
          return { ...table, columns: newCols };
        });
        return { ...prev, tables: newTables };
      });
    },
    []
  );

  const updateGlobalConfig = useCallback(
    (updates: { rowCount?: number; seed?: number }) => {
      setDatasetSpec((prev) => {
        if (!prev) return prev;
        const newSeed = updates.seed !== undefined ? updates.seed : prev.seed;
        const newTables = prev.tables.map((table, tIdx) => {
          if (tIdx === 0 && updates.rowCount !== undefined) {
            return { ...table, row_count: updates.rowCount };
          }
          return table;
        });
        return { ...prev, seed: newSeed, tables: newTables };
      });
    },
    []
  );

  const generateRelationalFromSpec = useCallback(
    async (specOverride?: DatasetSpec): Promise<boolean> => {
      const activeSpec = specOverride || datasetSpec;
      if (!activeSpec) return false;
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
        let currentJob = jobResp;
        let attempts = 0;
        while (!isTerminal(currentJob.status) && attempts < 40) {
          await new Promise((resolve) => setTimeout(resolve, 800));
          currentJob = await v2Request<Job>(`/jobs/${currentJob.job_id}`);
          attempts++;
        }
        if (currentJob.status === 'failed') {
          throw new Error(currentJob.error || 'Relational generation failed.');
        }
        const list = await Promise.all(
          currentJob.artifacts.map((id) => v2Request<Artifact>(`/artifacts/${id}`))
        );
        setDocumentArtifacts(list);
        const last = list[list.length - 1];
        if (last?.format === 'json') {
          setDocumentManifestId(last.id);
          const resp = await fetch(`${v2Origin}/api/v1/artifacts/${last.id}/download`);
          if (resp.ok) {
            const manifest = (await resp.json()) as TableArtifactMap;
            if (manifest.tables) {
              setTableArtifacts(manifest.tables);
              // Fetch previews for each table
              const newPreviews: Record<string, Record<string, any>[]> = {};
              for (const [tName, aId] of Object.entries(manifest.tables)) {
                try {
                  const art = await v2Request<Artifact>(`/artifacts/${aId}?preview_rows=25`);
                  if (art.preview) {
                    newPreviews[tName] = art.preview;
                  }
                } catch {
                  // non-fatal
                }
              }
              setRelationalPreviews(newPreviews);
              const firstTableName = Object.keys(manifest.tables)[0];
              const firstAid = manifest.tables[firstTableName];
              if (firstAid && newPreviews[firstTableName]?.length > 0) {
                setGeneratedPreview(newPreviews[firstTableName]);
                setGeneratedRowCount(activeSpec.tables[0]?.row_count || newPreviews[firstTableName].length);
                setGeneratedColumns(Object.keys(newPreviews[firstTableName][0]));
                setGeneratedToken(firstAid);
              }
            }
          }
        }
        return true;
      } catch (err: any) {
        setError({ message: err.message || 'Relational generation failed.' });
        return false;
      } finally {
        setIsGeneratingMultiTable(false);
        setIsGenerating(false);
      }
    },
    [datasetSpec]
  );

  const generateDocumentsFromSpec = useCallback(
    async (specOverride?: DatasetSpec): Promise<boolean> => {
      return generateRelationalFromSpec(specOverride);
    },
    [generateRelationalFromSpec]
  );

  const triggerMultiTableGenerate = useCallback(async (): Promise<boolean> => {
    return generateRelationalFromSpec();
  }, [generateRelationalFromSpec]);

  const loadCommerceRelational = useCallback(async (): Promise<boolean> => {
    setDatasetName(COMMERCE_RELATIONAL_SPEC.name);
    setDatasetSpec(COMMERCE_RELATIONAL_SPEC);
    setReferenceRowCount(COMMERCE_RELATIONAL_SPEC.tables[0]?.row_count || 10);
    setActiveTab('relational');
    return generateRelationalFromSpec(COMMERCE_RELATIONAL_SPEC);
  }, [generateRelationalFromSpec]);

  const loadBankingRelational = useCallback(async (): Promise<boolean> => {
    setDatasetName(BANKING_RELATIONAL_SPEC.name);
    setDatasetSpec(BANKING_RELATIONAL_SPEC);
    setReferenceRowCount(BANKING_RELATIONAL_SPEC.tables[0]?.row_count || 10);
    setActiveTab('documents');
    return generateRelationalFromSpec(BANKING_RELATIONAL_SPEC);
  }, [generateRelationalFromSpec]);

  const loadRelationalDemo = useCallback(() => {
    clearSession();
    setDatasetName('Commerce and invoices');
    setDatasetSpec(FIXTURE_COMMERCE_SPEC);
    setReferenceRowCount(FIXTURE_COMMERCE_SPEC.tables[0]?.row_count || 30);
    setActiveTab('relational');
  }, [clearSession]);

  const triggerGenerate = useCallback(
    async (rowCountOverride?: number): Promise<boolean> => {
      if (!datasetSpec) return false;
      const isMulti = datasetSpec.tables.length > 1 || (datasetSpec.documents?.length ?? 0) > 0;
      if (isMulti) {
        return triggerMultiTableGenerate();
      }
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
          .then((q) => setQualityResults(q))
          .catch(() => {});
        return true;
      } catch (err: any) {
        setError({
          message: err.message || 'Generation failed.',
          isSessionExpired: err.isSessionExpired,
        });
        return false;
      } finally {
        setIsGenerating(false);
      }
    },
    [datasetSpec, referenceToken, triggerMultiTableGenerate]
  );

  const triggerQualityEvaluation = useCallback(async (): Promise<boolean> => {
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
      setQualityResults(q);
      return true;
    } catch (err: any) {
      setError({
        message: err.message || 'Quality evaluation failed.',
        isSessionExpired: err.isSessionExpired,
      });
      return false;
    } finally {
      setIsEvaluatingQuality(false);
    }
  }, [referenceToken, generatedToken, datasetSpec]);

  return (
    <StudioContext.Provider
      value={{
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
        loadRelationalDemo,
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
