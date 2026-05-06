import {
  canTransition,
  getAllowedTransitions,
  type ArticleStatus
} from "../domain/status.ts";

export class ArticleStatusTransitionError extends Error {
  readonly fromStatus: ArticleStatus;
  readonly toStatus: ArticleStatus;
  readonly allowedTargets: ArticleStatus[];
  readonly allowedTransitions: ArticleStatus[];

  constructor(fromStatus: ArticleStatus, toStatus: ArticleStatus) {
    const allowedTargets = getAllowedTransitions(fromStatus);
    super(
      `Invalid article status transition from "${fromStatus}" to "${toStatus}". Allowed targets: ${
        allowedTargets.length === 0 ? "none" : allowedTargets.join(", ")
      }`
    );
    this.name = "ArticleStatusTransitionError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    this.allowedTargets = allowedTargets;
    this.allowedTransitions = [...allowedTargets];
  }
}

const publishPreparationStatuses = new Set<ArticleStatus>(["approved", "pending_publish"]);

const contentEditableStatuses = new Set<ArticleStatus>([
  "editing",
  "review_rejected",
  "not_publish",
  "approved",
  "pending_publish",
  "publish_failed"
]);

export function getAllowedTransitionTargets(status: ArticleStatus): ArticleStatus[] {
  return getAllowedTransitions(status);
}

export function assertTransition(
  fromStatus: ArticleStatus,
  toStatus: ArticleStatus
): { fromStatus: ArticleStatus; toStatus: ArticleStatus } {
  if (!canTransition(fromStatus, toStatus)) {
    throw new ArticleStatusTransitionError(fromStatus, toStatus);
  }

  return { fromStatus, toStatus };
}

export function canPreparePublish(status: ArticleStatus): boolean {
  return publishPreparationStatuses.has(status);
}

export function resolveStatusAfterContentChange(status: ArticleStatus): ArticleStatus {
  if (contentEditableStatuses.has(status)) {
    return "editing";
  }

  return status;
}

export function getStatusAfterContentChange(status: ArticleStatus): ArticleStatus {
  return resolveStatusAfterContentChange(status);
}

export function requiresReviewAfterContentChange(status: ArticleStatus): boolean {
  return resolveStatusAfterContentChange(status) === "editing" && status !== "editing";
}
