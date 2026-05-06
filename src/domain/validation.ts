export interface ValidationResult {
  valid: boolean;
  missingFields: string[];
  warnings: string[];
}

export const REVIEW_REQUIRED_FIELDS = ["title", "body", "category", "image"] as const;

export type ReviewRequiredField = (typeof REVIEW_REQUIRED_FIELDS)[number];
