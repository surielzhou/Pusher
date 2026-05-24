import type { Article, ArticleStatusEvent } from "../domain/article.ts";
import type { ArticleImage } from "../domain/image.ts";
import type { PublishRecord } from "../domain/publish.ts";
import type { ReviewRecord } from "../domain/review.ts";
import {
  cloneArticle,
  cloneAuditLog,
  cloneImage,
  clonePublish,
  cloneReview,
  cloneStatusEvent,
  createMemoryStore,
  createSequentialIdFactory,
  type MemoryRepositoryStore
} from "./memoryStore.ts";
import type { AuditLogRecord, RepositoryIdFactory } from "./types.ts";
import type { SnapshotStore } from "./fileStore.ts";

export const PERSISTENCE_SCHEMA_VERSION = 1;

export type PersistedArticle = Omit<Article, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type PersistedArticleImage = Omit<ArticleImage, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export type PersistedReviewRecord = Omit<ReviewRecord, "reviewedAt"> & {
  reviewedAt: string;
};

export type PersistedPublishRecord = Omit<PublishRecord, "publishedAt" | "createdAt"> & {
  publishedAt?: string;
  createdAt: string;
};

export type PersistedArticleStatusEvent = Omit<ArticleStatusEvent, "createdAt"> & {
  createdAt: string;
};

export type PersistedAuditLogRecord = Omit<AuditLogRecord, "createdAt"> & {
  createdAt: string;
};

export interface RepositoryPersistenceSnapshot {
  schemaVersion: typeof PERSISTENCE_SCHEMA_VERSION;
  exportedAt: string;
  articles: PersistedArticle[];
  images: PersistedArticleImage[];
  reviews: PersistedReviewRecord[];
  publishes: PersistedPublishRecord[];
  statusEvents: PersistedArticleStatusEvent[];
  auditLogs: PersistedAuditLogRecord[];
}

export interface ArticlePersistenceBundle {
  schemaVersion: typeof PERSISTENCE_SCHEMA_VERSION;
  exportedAt: string;
  article: PersistedArticle;
  images: PersistedArticleImage[];
  reviews: PersistedReviewRecord[];
  publishes: PersistedPublishRecord[];
  statusEvents: PersistedArticleStatusEvent[];
  auditLogs: PersistedAuditLogRecord[];
}

export interface PersistenceOptions {
  exportedAt?: Date;
}

export type PersistenceErrorCode = "unsupported_schema" | "not_found" | "invalid_snapshot";

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;

  constructor(code: PersistenceErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "PersistenceError";
  }
}

export function exportRepositoryStore(
  store: MemoryRepositoryStore,
  options: PersistenceOptions = {}
): RepositoryPersistenceSnapshot {
  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    exportedAt: serializeDate(options.exportedAt ?? new Date()),
    articles: sortById([...store.articles.values()]).map(serializeArticle),
    images: sortById([...store.images.values()]).map(serializeImage),
    reviews: sortById([...store.reviews.values()]).map(serializeReview),
    publishes: sortById([...store.publishes.values()]).map(serializePublish),
    statusEvents: sortById([...store.statusEvents.values()]).map(serializeStatusEvent),
    auditLogs: sortById([...store.auditLogs.values()]).map(serializeAuditLog)
  };
}

export function importRepositorySnapshot(snapshot: RepositoryPersistenceSnapshot): MemoryRepositoryStore {
  assertSupportedSnapshot(snapshot);

  return createMemoryStore({
    articles: snapshot.articles.map(hydrateArticle),
    images: snapshot.images.map(hydrateImage),
    reviews: snapshot.reviews.map(hydrateReview),
    publishes: snapshot.publishes.map(hydratePublish),
    statusEvents: snapshot.statusEvents.map(hydrateStatusEvent),
    auditLogs: snapshot.auditLogs.map(hydrateAuditLog)
  });
}

export async function saveRepositoryStore(
  store: MemoryRepositoryStore,
  snapshotStore: SnapshotStore<RepositoryPersistenceSnapshot>,
  options: PersistenceOptions = {}
): Promise<RepositoryPersistenceSnapshot> {
  const snapshot = exportRepositoryStore(store, options);
  await snapshotStore.save(snapshot);
  return snapshot;
}

export async function loadRepositorySnapshot(
  snapshotStore: SnapshotStore<RepositoryPersistenceSnapshot>
): Promise<RepositoryPersistenceSnapshot | undefined> {
  const snapshot = await snapshotStore.load();
  if (!snapshot) return undefined;

  assertSupportedSnapshot(snapshot);
  return snapshot;
}

export async function loadRepositoryStore(
  snapshotStore: SnapshotStore<RepositoryPersistenceSnapshot>
): Promise<MemoryRepositoryStore> {
  const snapshot = await loadRepositorySnapshot(snapshotStore);
  return snapshot ? importRepositorySnapshot(snapshot) : createMemoryStore();
}

export function exportArticleBundle(
  store: MemoryRepositoryStore,
  articleId: string,
  options: PersistenceOptions = {}
): ArticlePersistenceBundle {
  const article = store.articles.get(articleId);
  if (!article) {
    throw new PersistenceError("not_found", `Article not found: ${articleId}`);
  }

  return {
    schemaVersion: PERSISTENCE_SCHEMA_VERSION,
    exportedAt: serializeDate(options.exportedAt ?? new Date()),
    article: serializeArticle(article),
    images: sortByCreatedAt([...store.images.values()].filter((image) => image.articleId === articleId)).map(serializeImage),
    reviews: sortByReviewedAt([...store.reviews.values()].filter((review) => review.articleId === articleId)).map(
      serializeReview
    ),
    publishes: sortByCreatedAt([...store.publishes.values()].filter((record) => record.articleId === articleId)).map(
      serializePublish
    ),
    statusEvents: sortByCreatedAt([...store.statusEvents.values()].filter((event) => event.articleId === articleId)).map(
      serializeStatusEvent
    ),
    auditLogs: sortByCreatedAt(
      [...store.auditLogs.values()].filter((log) => log.entityType === "article" && log.entityId === articleId)
    ).map(serializeAuditLog)
  };
}

export function createRepositoryIdFactory(store: MemoryRepositoryStore, start = 1): RepositoryIdFactory {
  const highestExistingId = [
    ...store.articles.keys(),
    ...store.images.keys(),
    ...store.reviews.keys(),
    ...store.publishes.keys(),
    ...store.statusEvents.keys(),
    ...store.auditLogs.keys()
  ].reduce((highest, id) => Math.max(highest, numericSuffix(id)), 0);

  return createSequentialIdFactory(Math.max(start, highestExistingId + 1));
}

export function createDemoRepositorySnapshot(options: PersistenceOptions = {}): RepositoryPersistenceSnapshot {
  const createdAt = new Date("2026-05-06T00:00:00.000Z");
  const reviewedAt = new Date("2026-05-06T00:20:00.000Z");
  const preparedAt = new Date("2026-05-06T00:30:00.000Z");
  const articleId = "article_001";
  const store = createMemoryStore({
    articles: [
      {
        id: articleId,
        title: "AI Agent 运营闭环样例",
        summary: "用于本地持久化验收的公众号图文样例。",
        body: "这是一篇覆盖生成、审核和发布准备链路的 demo 文章。",
        category: "tech_internet",
        status: "pending_publish",
        generationConfig: {
          category: "tech_internet",
          topic: "AI Agent 内容运营",
          audience: "内容运营团队",
          style: "结构化分析",
          references: ["https://example.com/ai-agent-ops"],
          requireRiskNote: false
        },
        contentVersion: 2,
        reviewedVersion: 2,
        createdAt,
        updatedAt: preparedAt
      }
    ],
    images: [
      {
        id: "image_002",
        articleId,
        type: "generated",
        url: "https://example.com/demo-cover.png",
        description: "AI Agent 内容运营看板封面图",
        source: "demo-seed",
        position: "cover",
        altText: "AI Agent 内容运营看板",
        createdAt: new Date("2026-05-06T00:05:00.000Z"),
        updatedAt: new Date("2026-05-06T00:05:00.000Z")
      }
    ],
    reviews: [
      {
        id: "review_003",
        articleId,
        articleVersion: 2,
        result: "approved",
        comment: "Demo 内容完整，可以进入发布准备。",
        reviewChecklist: {
          titleChecked: true,
          imageChecked: true,
          complianceChecked: true
        },
        reviewedAt
      }
    ],
    publishes: [
      {
        id: "publish_004",
        articleId,
        articleVersion: 2,
        channel: "wechat_manual",
        status: "prepared",
        exportContent: "# AI Agent 运营闭环样例\n\n用于本地持久化验收的公众号图文样例。",
        imageChecklist: [{ imageId: "image_002", position: "cover", status: "ready" }],
        createdAt: preparedAt
      }
    ],
    statusEvents: [
      {
        id: "status_event_005",
        articleId,
        toStatus: "drafting",
        reason: "demo seed created",
        createdAt
      },
      {
        id: "status_event_006",
        articleId,
        fromStatus: "approved",
        toStatus: "pending_publish",
        reason: "demo publish prepared",
        createdAt: preparedAt
      }
    ],
    auditLogs: [
      {
        id: "audit_007",
        entityType: "article",
        entityId: articleId,
        action: "demo.seed",
        message: "Demo persistence seed imported",
        metadata: { schemaVersion: PERSISTENCE_SCHEMA_VERSION },
        createdAt: preparedAt
      }
    ]
  });

  return exportRepositoryStore(store, options);
}

function serializeArticle(article: Article): PersistedArticle {
  const clone = cloneArticle(article);
  return {
    ...clone,
    createdAt: serializeDate(clone.createdAt),
    updatedAt: serializeDate(clone.updatedAt)
  };
}

function hydrateArticle(article: PersistedArticle): Article {
  return cloneArticle({
    ...article,
    createdAt: hydrateDate(article.createdAt, "article.createdAt"),
    updatedAt: hydrateDate(article.updatedAt, "article.updatedAt")
  });
}

function serializeImage(image: ArticleImage): PersistedArticleImage {
  const clone = cloneImage(image);
  return {
    ...clone,
    createdAt: serializeDate(clone.createdAt),
    updatedAt: serializeDate(clone.updatedAt)
  };
}

function hydrateImage(image: PersistedArticleImage): ArticleImage {
  return cloneImage({
    ...image,
    createdAt: hydrateDate(image.createdAt, "image.createdAt"),
    updatedAt: hydrateDate(image.updatedAt, "image.updatedAt")
  });
}

function serializeReview(review: ReviewRecord): PersistedReviewRecord {
  const clone = cloneReview(review);
  return {
    ...clone,
    reviewedAt: serializeDate(clone.reviewedAt)
  };
}

function hydrateReview(review: PersistedReviewRecord): ReviewRecord {
  return cloneReview({
    ...review,
    reviewedAt: hydrateDate(review.reviewedAt, "review.reviewedAt")
  });
}

function serializePublish(record: PublishRecord): PersistedPublishRecord {
  const clone = clonePublish(record);
  return {
    ...clone,
    publishedAt: clone.publishedAt ? serializeDate(clone.publishedAt) : undefined,
    createdAt: serializeDate(clone.createdAt)
  };
}

function hydratePublish(record: PersistedPublishRecord): PublishRecord {
  return clonePublish({
    ...record,
    publishedAt: record.publishedAt ? hydrateDate(record.publishedAt, "publish.publishedAt") : undefined,
    createdAt: hydrateDate(record.createdAt, "publish.createdAt")
  });
}

function serializeStatusEvent(event: ArticleStatusEvent): PersistedArticleStatusEvent {
  const clone = cloneStatusEvent(event);
  return {
    ...clone,
    createdAt: serializeDate(clone.createdAt)
  };
}

function hydrateStatusEvent(event: PersistedArticleStatusEvent): ArticleStatusEvent {
  return cloneStatusEvent({
    ...event,
    createdAt: hydrateDate(event.createdAt, "statusEvent.createdAt")
  });
}

function serializeAuditLog(record: AuditLogRecord): PersistedAuditLogRecord {
  const clone = cloneAuditLog(record);
  return {
    ...clone,
    createdAt: serializeDate(clone.createdAt)
  };
}

function hydrateAuditLog(record: PersistedAuditLogRecord): AuditLogRecord {
  return cloneAuditLog({
    ...record,
    createdAt: hydrateDate(record.createdAt, "auditLog.createdAt")
  });
}

function assertSupportedSnapshot(snapshot: RepositoryPersistenceSnapshot): void {
  if (snapshot.schemaVersion !== PERSISTENCE_SCHEMA_VERSION) {
    throw new PersistenceError(
      "unsupported_schema",
      `Unsupported persistence schema version: ${String(snapshot.schemaVersion)}`
    );
  }
}

function serializeDate(date: Date): string {
  return date.toISOString();
}

function hydrateDate(value: string, fieldName: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PersistenceError("invalid_snapshot", `Invalid date for ${fieldName}: ${value}`);
  }

  return date;
}

function sortById<T extends { id: string }>(records: T[]): T[] {
  return records.sort((left, right) => left.id.localeCompare(right.id));
}

function sortByCreatedAt<T extends { createdAt: Date }>(records: T[]): T[] {
  return records.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
}

function sortByReviewedAt<T extends { reviewedAt: Date }>(records: T[]): T[] {
  return records.sort((left, right) => left.reviewedAt.getTime() - right.reviewedAt.getTime());
}

function numericSuffix(id: string): number {
  const match = /_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}
