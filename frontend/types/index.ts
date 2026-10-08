export type DataTypeMode = 'tabular' | 'relational' | 'documents';
export type WorkspaceTab = 'preview' | 'schema' | 'quality';

export type ColumnDType = 'integer' | 'float' | 'boolean' | 'string' | 'datetime';
export type SemanticType =
  | 'id'
  | 'email'
  | 'phone'
  | 'person_name'
  | 'money'
  | 'categorical'
  | 'numeric'
  | 'datetime'
  | 'generic_text';

export interface Constraints {
  unique?: boolean;
  auto_increment?: boolean;
  min?: number | null;
  max?: number | null;
  categories?: (string | number | boolean)[] | null;
}

export interface Distribution {
  type: 'gaussian' | 'uniform' | 'categorical' | 'empirical' | 'skewed';
  mean?: number;
  std?: number;
  skew?: number;
  values?: (string | number | boolean)[];
  probabilities?: number[];
  quantiles?: number[];
}

export interface PrivacyRule {
  method: 'mask' | 'hash' | 'noise';
  noise_std?: number;
  mask_value?: string;
}

export interface ColumnSpec {
  name: string;
  dtype: ColumnDType;
  semantic_type: SemanticType;
  nullable: boolean;
  null_rate: number;
  constraints: Constraints;
  distribution?: Distribution | null;
  privacy_rule?: PrivacyRule | 'mask' | 'hash' | 'noise' | null;
  outlier_rate: number;
  outlier_scale: number;
}

export interface TableSpec {
  name: string;
  row_count: number;
  columns: ColumnSpec[];
  primary_key?: string | null;
  correlation_columns?: string[];
  correlation_matrix?: number[][];
}

export interface DatasetSpec {
  name: string;
  version: '1.0';
  locale: string;
  seed: number;
  tables: TableSpec[];
}

export interface PromptSpecResponse {
  status: 'review_required' | 'ok' | 'unavailable';
  spec?: DatasetSpec;
  notice?: string;
  warnings?: string[];
  fallback_used?: boolean;
  reason?: string;
  detail?: string;
  fallback?: string;
}

export interface IngestResponse {
  dataset_id: string; // reference_token
  expires_in_seconds: number;
  row_count: number;
  columns: string[];
  schema: Record<string, any>;
  sensitive_columns?: string[];
  sensitive_count?: number;
  spec: DatasetSpec;
  preview: Record<string, any>[];
}

export interface GenerateResponse {
  dataset_id: string; // generated_token
  expires_in_seconds: number;
  row_count: number;
  columns: string[];
  preview: Record<string, any>[];
  warnings?: string[];
}

export interface PreviewResponse {
  dataset_id: string;
  row_count: number;
  columns: string[];
  offset: number;
  limit: number;
  rows: Record<string, any>[];
}

export interface QualityColumnMetric {
  name: string;
  kind: 'numeric' | 'categorical' | 'unavailable';
  real_null_rate: number;
  synthetic_null_rate: number;
  missing_similarity: number;
  distribution_similarity?: number | null;
  reason?: string;
  // Numeric metrics
  ks_statistic?: number;
  wasserstein_distance?: number;
  wasserstein_normalized?: number;
  normalization_scale?: number;
  histogram?: {
    edges: number[];
    real: number[];
    synthetic: number[];
  };
  // Categorical metrics
  total_variation_distance?: number;
  jensen_shannon_divergence?: number;
  categories?: {
    value: string;
    real: number;
    synthetic: number;
  }[];
  categories_truncated?: boolean;
}

export interface CorrelationMetric {
  columns: string[];
  similarity: number | null;
  frobenius_distance: number | null;
  pair_count: number;
  real_matrix?: (number | null)[][];
  synthetic_matrix?: (number | null)[][];
}

export interface QualityResponse {
  overall_score: number | null;
  score_status: 'available' | 'unavailable' | 'not_applicable';
  fidelity_label?: string;
  distribution_columns_evaluated: number;
  distribution_columns_total: number;
  components: {
    distribution: number | null;
    missingness: number;
    correlation: number | null;
  };
  columns: QualityColumnMetric[];
  correlation: CorrelationMetric;
  score_definition: string;
  reference_rows: number;
  synthetic_rows: number;
  privacy?: {
    status: 'Protected' | 'At Risk';
    exact_match_rate?: number;
    exact_matches?: number;
  };
  integrity?: {
    status: 'Passed' | 'Warning' | 'Failed';
    columns_preserved?: boolean;
    null_integrity?: boolean;
    valid_row_count?: boolean;
  };
}

