import { useCallback, useEffect, useRef, useState } from 'react';
import { ColumnSpec } from '../types';

export const v2Origin = (process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '');

/** Upload limit matching JOB_UPLOAD_BYTES on the backend (default 512 MiB). */
export const UPLOAD_LIMIT_BYTES = 512 * 1024 * 1024;
export const UPLOAD_LIMIT_LABEL = '512 MiB';
export const ACCEPTED_FORMATS = '.csv,.json,.jsonl,.xlsx,.parquet';
export const ACCEPTED_FORMATS_LABEL = 'CSV, JSON, JSONL, XLSX, Parquet';

const TERMINAL_STATUSES = new Set(['complete', 'failed', 'cancelled']);

export interface V2Table {
  name: string;
  row_count: number;
  columns: ColumnSpec[];
  primary_key?: string | null;
  target_column?: string | null;
  foreign_keys?: {
    column: string;
    reference_table: string;
    reference_column: string;
    cardinality: string;
    min_children?: number;
  }[];
}

export interface V2Spec {
  name: string;
  version: '1.0' | '2.0';
  locale: string;
  seed: number;
  tables: V2Table[];
  documents?: unknown[];
  reconciliations?: unknown[];
  business_rules?: string[];
  edge_cases?: string[];
}

export interface Job {
  job_id: string;
  status: string;
  stage: string;
  progress: number;
  error: string | null;
  artifacts: string[];
}

export interface Artifact {
  id: string;
  format: string;
  size: number;
  expires_at: number;
  preview?: Record<string, unknown>[];
}

export interface EngineCapability {
  engine: string;
  available?: boolean;
  cpu?: boolean;
  batched?: boolean;
  conditional_classification?: boolean;
}

export interface ComparisonResult {
  engine: string;
  status: string;
  quality_score?: number;
  runtime_seconds?: number;
  memory_estimate_bytes?: number;
  tstr?: { status: string; tstr?: Record<string, number | null> };
}

export interface Comparison {
  recommendation: string | null;
  results: ComparisonResult[];
  source_profile?: { row_count: number; sample_rows: number };
}

/** Manifest artifact from relational/documents generation. */
export interface TableArtifactMap {
  tables: Record<string, string>;
}

/** Ingest profile artifact returned by the ingest job. */
export interface IngestProfile {
  row_count: number;
  sample_rows: number;
  approximate: boolean;
  spec?: V2Spec;
}

export async function v2Request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${v2Origin}/api/v1${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(
      typeof body.detail === 'string'
        ? body.detail
        : `Request failed (${response.status}). Check the specification and configured limits.`
    );
  }
  return response.json();
}

export function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

export function isTerminal(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

/**
 * Bounded exponential backoff job poller. Stops automatically at terminal states.
 * Intervals: 1s, 2s, 4s, 8s, 16s, then 30s cap.
 * Max poll duration: ~10 minutes (bounded by maxPolls).
 */
export function usePollJob(
  job: Job | null,
  onUpdate: (job: Job) => void,
  onError: (message: string) => void
): void {
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const poll = useCallback(() => {
    if (!job || isTerminal(job.status)) {
      attemptRef.current = 0;
      return;
    }

    const attempt = attemptRef.current;
    const delay = Math.min(1000 * Math.pow(2, attempt), 30_000);
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;
      try {
        const updated = await v2Request<Job>(`/jobs/${job.job_id}`);
        if (!mountedRef.current) return;
        attemptRef.current = Math.min(attempt + 1, 5); // cap at 30s
        onUpdate(updated);
      } catch (err) {
        if (!mountedRef.current) return;
        onError(err instanceof Error ? err.message : 'Failed to poll job status.');
      }
    }, delay);
  }, [job, onUpdate, onError]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!job || isTerminal(job.status)) {
      attemptRef.current = 0;
      return;
    }
    poll();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [job?.job_id, job?.status, poll]);
}
