import type { ArticleStatusEvent } from "../domain/article.ts";
import type { AuditLogRecord, AuditLogRepository } from "../repositories/types.ts";

export type ArticleAuditAction =
  | "article.generated"
  | "article.edited"
  | "article.generation_failed"
  | "review.submitted"
  | "review.approved"
  | "review.rejected"
  | "review.not_publish"
  | "publish.prepared"
  | "publish.published"
  | "publish.failed"
  | "wechat.draft_created"
  | "article.status_changed";

export type AuditTimelineSource = "audit_log" | "status_event";

export interface RecordArticleAuditActionInput {
  articleId: string;
  action: ArticleAuditAction;
  actorId?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditTimelineItem {
  id: string;
  articleId: string;
  action: ArticleAuditAction;
  label: string;
  message: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
  occurredAt: Date;
  source: AuditTimelineSource;
}

export interface ArticleAuditTimeline {
  articleId: string;
  items: AuditTimelineItem[];
}

export interface AuditLogServiceDependencies {
  auditLogs: Pick<AuditLogRepository, "create" | "listByEntity" | "listStatusEventsByArticleId">;
}

export class AuditLogServiceImpl {
  private readonly auditLogs: Pick<AuditLogRepository, "create" | "listByEntity" | "listStatusEventsByArticleId">;

  constructor(dependencies: AuditLogServiceDependencies) {
    this.auditLogs = dependencies.auditLogs;
  }

  async recordArticleAction(input: RecordArticleAuditActionInput): Promise<AuditTimelineItem> {
    const record = await this.auditLogs.create({
      entityType: "article",
      entityId: input.articleId,
      action: input.action,
      message: input.message,
      metadata: buildStoredMetadata(input.metadata, input.actorId)
    });

    return auditRecordToTimelineItem(record);
  }

  async listArticleTimeline(articleId: string): Promise<ArticleAuditTimeline> {
    const [records, statusEvents] = await Promise.all([
      this.auditLogs.listByEntity("article", articleId),
      this.auditLogs.listStatusEventsByArticleId(articleId)
    ]);

    return {
      articleId,
      items: [...records.map(auditRecordToTimelineItem), ...statusEvents.map(statusEventToTimelineItem)].sort(
        (left, right) => right.occurredAt.getTime() - left.occurredAt.getTime() || right.id.localeCompare(left.id)
      )
    };
  }
}

const actionLabels: Record<ArticleAuditAction, string> = {
  "article.generated": "AI 生成完成",
  "article.edited": "内容编辑",
  "article.generation_failed": "AI 生成失败",
  "review.submitted": "提交 Review",
  "review.approved": "Review 通过",
  "review.rejected": "Review 退回",
  "review.not_publish": "暂不发布",
  "publish.prepared": "发布准备完成",
  "publish.published": "发布完成",
  "publish.failed": "发布失败",
  "wechat.draft_created": "公众号草稿创建",
  "article.status_changed": "状态变更"
};

function auditRecordToTimelineItem(record: AuditLogRecord): AuditTimelineItem {
  const action = normalizeAuditAction(record.action);
  const actorId = extractActorId(record.metadata);
  const metadata = omitActorId(record.metadata);

  return {
    id: record.id,
    articleId: record.entityId,
    action,
    label: actionLabels[action],
    message: record.message ?? actionLabels[action],
    actorId,
    metadata,
    occurredAt: record.createdAt,
    source: "audit_log"
  };
}

function statusEventToTimelineItem(event: ArticleStatusEvent): AuditTimelineItem {
  const action = actionForStatusEvent(event);

  return {
    id: event.id,
    articleId: event.articleId,
    action,
    label: actionLabels[action],
    message: event.reason ?? actionLabels[action],
    metadata: {
      fromStatus: event.fromStatus,
      toStatus: event.toStatus
    },
    occurredAt: event.createdAt,
    source: "status_event"
  };
}

function actionForStatusEvent(event: ArticleStatusEvent): ArticleAuditAction {
  switch (event.toStatus) {
    case "editing":
      return event.reason?.toLowerCase().includes("generation") ? "article.generated" : "article.edited";
    case "generation_failed":
      return "article.generation_failed";
    case "pending_review":
      return "review.submitted";
    case "approved":
      return "review.approved";
    case "review_rejected":
      return "review.rejected";
    case "not_publish":
      return "review.not_publish";
    case "pending_publish":
      return event.reason?.toLowerCase().includes("wechat draft") ? "wechat.draft_created" : "publish.prepared";
    case "published":
      return "publish.published";
    case "publish_failed":
      return "publish.failed";
    default:
      return "article.status_changed";
  }
}

function normalizeAuditAction(action: string): ArticleAuditAction {
  if (action in actionLabels) {
    return action as ArticleAuditAction;
  }

  return "article.status_changed";
}

function buildStoredMetadata(
  metadata: Record<string, unknown> | undefined,
  actorId: string | undefined
): Record<string, unknown> | undefined {
  const stored = { ...(metadata ?? {}) };

  if (actorId) {
    stored.actorId = actorId;
  }

  return Object.keys(stored).length > 0 ? stored : undefined;
}

function extractActorId(metadata: Record<string, unknown> | undefined): string | undefined {
  return typeof metadata?.actorId === "string" ? metadata.actorId : undefined;
}

function omitActorId(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  const { actorId: _actorId, ...rest } = metadata;
  return Object.keys(rest).length > 0 ? rest : undefined;
}
