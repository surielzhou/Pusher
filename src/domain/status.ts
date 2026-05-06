export const CONTENT_CATEGORIES = ["tech_internet", "finance", "literature"] as const;

export type ContentCategory = (typeof CONTENT_CATEGORIES)[number];

export const ARTICLE_STATUSES = [
  "drafting",
  "generation_failed",
  "editing",
  "pending_review",
  "review_rejected",
  "approved",
  "not_publish",
  "pending_publish",
  "publish_failed",
  "published"
] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

const allowedTransitions = {
  drafting: ["editing", "generation_failed"],
  generation_failed: ["drafting"],
  editing: ["pending_review"],
  pending_review: ["approved", "review_rejected", "not_publish"],
  review_rejected: ["editing"],
  approved: ["pending_publish", "editing"],
  not_publish: ["editing"],
  pending_publish: ["published", "publish_failed", "editing"],
  publish_failed: ["pending_publish", "editing"],
  published: []
} satisfies Record<ArticleStatus, ArticleStatus[]>;

export function getAllowedTransitions(status: ArticleStatus): ArticleStatus[] {
  return [...allowedTransitions[status]];
}

export function canTransition(fromStatus: ArticleStatus, toStatus: ArticleStatus): boolean {
  return allowedTransitions[fromStatus].includes(toStatus);
}
