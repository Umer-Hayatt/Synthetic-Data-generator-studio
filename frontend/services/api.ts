import {
  DatasetSpec,
  GenerateResponse,
  IngestResponse,
  PreviewResponse,
  PromptSpecResponse,
  QualityResponse,
  RelationshipInput, RelationshipProposal, RelationshipResult,
} from '../types';

const API_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ||
    (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '');

export class ApiError extends Error {
  status: number;
  isSessionExpired: boolean;
  rawDetail?: any;

  constructor(message: string, status: number, rawDetail?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.rawDetail = rawDetail;
    this.isSessionExpired = status === 404;
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorDetail = '';
    let parsedJson: any = null;
    try {
      parsedJson = await res.json();
      errorDetail =
        typeof parsedJson.detail === 'string'
          ? parsedJson.detail
          : JSON.stringify(parsedJson.detail || parsedJson);
    } catch {
      errorDetail = await res.text().catch(() => res.statusText);
    }

    if (res.status === 404) {
      throw new ApiError(
        'This temporary dataset session has expired or was not found on the backend. Please re-upload or regenerate.',
        404,
        parsedJson
      );
    }

    if (res.status === 400) {
      throw new ApiError(
        errorDetail || 'Invalid request or data constraint failure.',
        400,
        parsedJson
      );
    }

    if (res.status === 422) {
      throw new ApiError(
        `Specification validation error: ${errorDetail}`,
        422,
        parsedJson
      );
    }

    throw new ApiError(
      errorDetail || `Server returned error (${res.status})`,
      res.status,
      parsedJson
    );
  }

  return (await res.json()) as T;
}

export const api = {
  async analyzeRelationships(input: RelationshipInput): Promise<RelationshipProposal> {
    return handleResponse(await fetch(`${API_BASE_URL}/api/v1/relationships/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
    }));
  },
  async normalizeRelationships(input: RelationshipInput): Promise<RelationshipResult> {
    return handleResponse(await fetch(`${API_BASE_URL}/api/v1/relationships/normalize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, accepted: true }),
    }));
  },
  getBaseUrl(): string {
    return API_BASE_URL;
  },

  async checkHealth(): Promise<{ status: string }> {
    try {
      const res = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      return await handleResponse<{ status: string }>(res);
    } catch (err: any) {
      if (err instanceof ApiError) throw err;
      throw new ApiError(
        'Backend server is unavailable. It may be waking up; please retry shortly.',
        0
      );
    }
  },

  async ingestFile(file: File): Promise<IngestResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE_URL}/api/v1/ingest`, {
      method: 'POST',
      body: formData,
    });
    return await handleResponse<IngestResponse>(res);
  },

  async promptSpec(prompt: string): Promise<PromptSpecResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/ai/spec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    return await handleResponse<PromptSpecResponse>(res);
  },

  async validateSpec(spec: DatasetSpec): Promise<DatasetSpec> {
    const res = await fetch(`${API_BASE_URL}/api/v1/spec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(spec),
    });
    return await handleResponse<DatasetSpec>(res);
  },

  async generateData(
    spec: DatasetSpec,
    previewLimit: number = 20
  ): Promise<GenerateResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spec, preview_limit: previewLimit }),
    });
    return await handleResponse<GenerateResponse>(res);
  },

  async fetchPreview(
    datasetId: string,
    offset: number = 0,
    limit: number = 20
  ): Promise<PreviewResponse> {
    const url = new URL(`${API_BASE_URL}/api/v1/preview`);
    url.searchParams.set('dataset_id', datasetId);
    url.searchParams.set('offset', String(offset));
    url.searchParams.set('limit', String(limit));

    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return await handleResponse<PreviewResponse>(res);
  },

  async evaluateQuality(
    referenceId?: string | null,
    generatedId?: string,
    spec?: DatasetSpec | null
  ): Promise<QualityResponse> {
    const res = await fetch(`${API_BASE_URL}/api/v1/evaluate/quality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reference_id: referenceId || null,
        generated_id: generatedId,
        spec: spec || null,
      }),
    });
    return await handleResponse<QualityResponse>(res);
  },

  getExportUrl(format: 'csv' | 'json', datasetId: string): string {
    return `${API_BASE_URL}/api/v1/export/${format}?dataset_id=${encodeURIComponent(
      datasetId
    )}`;
  },

  async downloadData(format: 'csv' | 'json', datasetId: string): Promise<Blob> {
    const res = await fetch(api.getExportUrl(format, datasetId));
    if (!res.ok) await handleResponse<never>(res);
    return res.blob();
  },

  async submitGenerationJob(plan: {
    spec: DatasetSpec;
    engine?: string;
    accepted?: boolean;
    source_artifact?: string | null;
  }): Promise<{ job_id: string; status: string; stage: string; progress: number; artifacts: string[] }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/jobs/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        spec: plan.spec,
        engine: plan.engine || 'statistical',
        accepted: plan.accepted ?? true,
        source_artifact: plan.source_artifact || null,
      }),
    });
    return await handleResponse(res);
  },

  async getJobStatus(jobId: string): Promise<{
    job_id: string;
    status: string;
    stage: string;
    progress: number;
    error: string | null;
    artifacts: string[];
  }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/jobs/${jobId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return await handleResponse(res);
  },

  async getArtifact(artifactId: string, previewRows: number = 50): Promise<{
    id: string;
    format: string;
    size: number;
    expires_at: number;
    preview?: Record<string, unknown>[];
  }> {
    const res = await fetch(`${API_BASE_URL}/api/v1/artifacts/${artifactId}?preview_rows=${previewRows}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    return await handleResponse(res);
  },

  getDocumentUrl(
    artifactId: string,
    docKey: string,
    format: 'json' | 'csv' | 'pdf' | 'zip',
    index: number = 0,
    zipFormat: 'pdf' | 'json' = 'pdf'
  ): string {
    if (format === 'pdf') {
      return `${API_BASE_URL}/api/v1/documents/${artifactId}/${docKey}/pdf/${index}`;
    }
    if (format === 'zip') {
      return `${API_BASE_URL}/api/v1/documents/${artifactId}/${docKey}/zip?format=${zipFormat}`;
    }
    return `${API_BASE_URL}/api/v1/documents/${artifactId}/${docKey}/${format}`;
  },
};
