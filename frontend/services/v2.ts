import { ColumnSpec } from '../types';

export const v2Origin = (process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '');

export interface V2Table {
  name: string; row_count: number; columns: ColumnSpec[]; primary_key?: string | null;
  target_column?: string | null;
  foreign_keys?: {column: string; reference_table: string; reference_column: string; cardinality: string}[];
}
export interface V2Spec {
  name: string; version: '1.0' | '2.0'; locale: string; seed: number; tables: V2Table[];
  documents?: unknown[]; reconciliations?: unknown[]; business_rules?: string[]; edge_cases?: string[];
}
export interface Job {
  job_id: string; status: string; stage: string; progress: number; error: string | null; artifacts: string[];
}
export interface Artifact {
  id: string; format: string; size: number; expires_at: number; preview?: Record<string, unknown>[];
}
export interface Comparison {
  recommendation: string | null;
  results: {engine: string; status: string; quality_score?: number; runtime_seconds?: number;
    memory_estimate_bytes?: number; tstr?: {status: string; tstr?: Record<string, number | null>}}[];
}
export async function v2Request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${v2Origin}/api/v1${path}`, init);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${response.status}). Check the specification and configured limits.`);
  }
  return response.json();
}
export function jsonBody(value: unknown): RequestInit {
  return {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(value)};
}
