export type DataTypeMode = 'tabular' | 'relational' | 'documents';
export type WorkspaceTab = 'preview' | 'schema' | 'quality' | 'relational' | 'documents';

export type ColumnDType = 'integer' | 'float' | 'boolean' | 'string' | 'datetime';
export type SemanticType =
  | 'id'
  | 'email'
  | 'phone'
  | 'person_name'
  | 'address'
  | 'money'
  | 'categorical'
  | 'numeric'
  | 'datetime'
  | 'generic_text';

export interface InvoiceRecord {
  entity_id: string | number;
  entity: Record<string, any>;
  lines: {
    source: Record<string, any>;
    line_total: string;
  }[];
  subtotal: string;
  tax: string;
  discount: string;
  total: string;
}

export interface BankStatementRecord {
  entity_id: string | number;
  entity: Record<string, any>;
  opening_balance: string;
  transactions: {
    source: Record<string, any>;
    date: string;
    credit: string;
    debit: string;
    balance: string;
  }[];
  closing_balance: string;
}

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

export interface ForeignKeySpec {
  column: string;
  reference_table: string;
  reference_column: string;
  cardinality: string;
  min_children?: number;
  max_children?: number;
}

export interface TableSpec {
  name: string;
  row_count: number;
  columns: ColumnSpec[];
  primary_key?: string | null;
  target_column?: string | null;
  foreign_keys?: ForeignKeySpec[];
  correlation_columns?: string[];
  correlation_matrix?: number[][];
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

export interface DatasetSpec {
  name: string;
  version: '1.0' | '2.0';
  locale: string;
  seed: number;
  tables: TableSpec[];
  tabular_entities?: (EntityMapping & { entity_count: number })[];
  documents?: DocumentRequest[];
  reconciliations?: unknown[];
  business_rules?: string[];
  edge_cases?: string[];
}

export interface EntityMapping { name: string; key: string; columns: string[] }
export interface RelationshipEntity extends EntityMapping {
  valid: boolean; reason: string; entity_count: number; cardinality: string;
  origin: string; evidence: string; conflicting_keys: Record<string, number>; null_keys: number;
}
export interface RelationshipProposal {
  source_dataset_id: string; row_count: number; columns: string[];
  ai_status: string; status: string; entities: RelationshipEntity[]; questions: string[];
  explanation?: string;
}
export interface RelationshipResult {
  source_dataset_id: string; spec: DatasetSpec;
  tables: (TableSpec & { dataset_id: string; preview: Record<string, unknown>[] })[];
  integrity: { lossless: boolean; source_rows: number; orphan_foreign_keys: number;
    primary_keys_unique: boolean; surrogate_key: string | null };
}
export interface RelationshipInput {
  dataset_id: string; storage: 'frame' | 'artifact'; source_table: string;
  prompt?: string; clarification?: string; entities?: EntityMapping[];
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
