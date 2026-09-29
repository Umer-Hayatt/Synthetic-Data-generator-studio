/**
 * Feature flag configuration for V2 UI.
 * Default is false for unimplemented or environment-restricted capabilities.
 */
export const FEATURES = {
  /** PDF generation/export */
  ENABLE_PDF_EXPORT: false,
  /** Raw SQL dump export */
  ENABLE_SQL_DUMP: false,
  /** XML format support */
  ENABLE_XML_FORMAT: false,
  /** Build Schema interactive designer */
  ENABLE_BUILD_SCHEMA: false,
  /** Optional Deep synthesis (CTGAN / TVAE) UI entry points */
  ENABLE_DEEP_ENGINES: false,
  /** Advanced raw JSON specification editor */
  ENABLE_RAW_JSON_EDITOR: false,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
