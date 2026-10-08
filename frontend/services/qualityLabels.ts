export interface QualityThreshold {
  minScore: number;
  label: string;
}

/**
 * Single source of truth for quality score labels and thresholds.
 */
export const QUALITY_THRESHOLDS: QualityThreshold[] = [
  { minScore: 90, label: 'Excellent' },
  { minScore: 80, label: 'High' },
  { minScore: 65, label: 'Moderate' },
  { minScore: 50, label: 'Fair' },
  { minScore: 0, label: 'Low' },
];

export function getQualityLabel(score: number | null | undefined): string {
  if (score === null || score === undefined || isNaN(score)) {
    return 'Pending';
  }
  for (const threshold of QUALITY_THRESHOLDS) {
    if (score >= threshold.minScore) {
      return threshold.label;
    }
  }
  return 'Low';
}
