export const REVIEW_RESULTS = ["approved", "rejected", "not_publish"] as const;

export type ReviewResult = (typeof REVIEW_RESULTS)[number];

export interface ReviewRecord {
  id: string;
  articleId: string;
  articleVersion: number;
  result: ReviewResult;
  comment?: string;
  reviewChecklist?: Record<string, boolean>;
  reviewedAt: Date;
}
