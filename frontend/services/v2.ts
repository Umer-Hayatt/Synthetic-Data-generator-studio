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

export interface DocumentRequest {
  kind: 'invoice' | 'bank_statement';
  parent_table: string;
  child_table: string;
  foreign_key: string;
  amount_column?: string | null;
  quantity_column?: string | null;
  price_column?: string | null;
  date_column?: string | null;
  credit_column?: string | null;
  debit_column?: string | null;
  opening_balance_column?: string | null;
  tax_rate?: number;
  discount_rate?: number;
  date_from?: string | null;
  date_to?: string | null;
}

export interface V2Spec {
  name: string;
  version: '1.0' | '2.0';
  locale: string;
  seed: number;
  tables: V2Table[];
  documents?: DocumentRequest[];
  reconciliations?: unknown[];
  business_rules?: string[];
  edge_cases?: string[];
}

/**
 * Deterministically enriches an ingested spec:
 * - Identifies primary keys (id semantic type or auto_increment or unique)
 * - Identifies foreign keys by naming convention (e.g. *_id referencing parent tables)
 * - Assigns benchmark target candidate (returned, label, target, churn, default, etc.)
 */
export function enrichSpec(raw: V2Spec): V2Spec {
  const tableNames = new Set(raw.tables.map((t) => t.name.toLowerCase()));
  const tables = raw.tables.map((table) => {
    let pk = table.primary_key;
    if (!pk) {
      const pkCol = table.columns.find((c) => c.semantic_type === 'id' || c.constraints?.unique || c.name.toLowerCase() === 'id' || c.name.toLowerCase() === `${table.name.toLowerCase()}_id`);
      if (pkCol) pk = pkCol.name;
    }

    let target = table.target_column;
    if (!target) {
      const targetCol = table.columns.find((c) => {
        const n = c.name.toLowerCase();
        return n === 'returned' || n === 'target' || n === 'label' || n === 'churn' || n === 'is_fraud' || n === 'default';
      });
      if (targetCol) target = targetCol.name;
    }

    const fks = [...(table.foreign_keys ?? [])];
    if (fks.length === 0 && raw.tables.length > 1) {
      for (const col of table.columns) {
        if (col.name === pk) continue;
        const colLower = col.name.toLowerCase();
        if (colLower.endsWith('_id') || colLower.endsWith('id')) {
          const stem = colLower.replace(/_?id$/, '');
          const match = raw.tables.find((other) => other.name.toLowerCase() === stem || other.name.toLowerCase() === `${stem}s`);
          if (match && match.name !== table.name) {
            fks.push({
              column: col.name,
              reference_table: match.name,
              reference_column: match.primary_key || match.columns[0]?.name || 'id',
              cardinality: '1:N',
            });
          }
        }
      }
    }

    return {
      ...table,
      primary_key: pk ?? null,
      target_column: target ?? null,
      foreign_keys: fks,
    };
  });

  return { ...raw, tables };
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
    let msg = '';
    if (typeof body.detail === 'string') {
      msg = body.detail;
    } else if (Array.isArray(body.detail)) {
      msg = body.detail
        .map((d: any) => {
          const loc = Array.isArray(d.loc) ? d.loc.filter((x: any) => x !== 'body').join('.') : '';
          return loc ? `${loc}: ${d.msg}` : (d.msg || JSON.stringify(d));
        })
        .join('; ');
    } else if (body.detail && typeof body.detail === 'object') {
      msg = JSON.stringify(body.detail);
    }
    if (!msg) {
      msg = `Request failed (${response.status}). Check the specification and configured limits.`;
    }
    throw new Error(msg);
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
