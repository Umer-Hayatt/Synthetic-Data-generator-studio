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

interface StudioContextType {
  // Session & Tokens (Reference vs Generated kept strictly separate)
  referenceToken: string | null;
  generatedToken: string | null;
  tokenExpirySeconds: number | null;
  datasetName: string;

  // Inferred & Configured Data Spec
  inferredSchema: Record<string, any> | null;
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
    setDatasetSpec(null);
    setReferencePreview([]);
    setReferenceRowCount(0);
    setReferenceColumns([]);
    setGeneratedPreview([]);
    setGeneratedRowCount(0);
    setGeneratedColumns([]);
    setQualityResults(null);
    setActiveTab('preview');
    setError(null);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  const handleFileUpload = useCallback(
    async (file: File): Promise<boolean> => {
      setIsIngesting(true);
      setError(null);
      try {
        const resp = await api.ingestFile(file);

        // Retain reference token separate from generated token
        setReferenceToken(resp.dataset_id);
        setTokenExpirySeconds(resp.expires_in_seconds);
        setDatasetName(file.name.replace(/\.[^/.]+$/, ''));
        setInferredSchema(resp.schema);
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

  const triggerGenerate = useCallback(
    async (rowCountOverride?: number): Promise<boolean> => {
      if (!datasetSpec) return false;
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

        // Automatically refresh quality evaluation if referenceToken exists
        if (referenceToken) {
          api
            .evaluateQuality(referenceToken, resp.dataset_id)
            .then((q) => setQualityResults(q))
            .catch(() => {});
        }
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
    [datasetSpec, referenceToken]
  );

  const triggerQualityEvaluation = useCallback(async (): Promise<boolean> => {
    if (!referenceToken || !generatedToken) {
      setError({
        message:
          'Quality evaluation requires both reference and generated datasets.',
      });
      return false;
    }
    setIsEvaluatingQuality(true);
    setError(null);
    try {
      const q = await api.evaluateQuality(referenceToken, generatedToken);
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
  }, [referenceToken, generatedToken]);

  return (
    <StudioContext.Provider
      value={{
        referenceToken,
        generatedToken,
        tokenExpirySeconds,
        datasetName,
        inferredSchema,
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
