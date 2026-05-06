import type { Article, ArticleStatusEvent, GenerationConfig } from "../domain/article.ts";
import type { ArticleImage } from "../domain/image.ts";
import type { PublishRecord } from "../domain/publish.ts";
import type { ReviewRecord } from "../domain/review.ts";
import type { AuditLogRecord, RepositoryClock, RepositoryIdFactory } from "./types.ts";

export interface MemoryRepositoryStore {
  articles: Map<string, Article>;
  images: Map<string, ArticleImage>;
  reviews: Map<string, ReviewRecord>;
  publishes: Map<string, PublishRecord>;
  statusEvents: Map<string, ArticleStatusEvent>;
  auditLogs: Map<string, AuditLogRecord>;
}

export function createMemoryStore(seed?: {
  articles?: Article[];
  images?: ArticleImage[];
  reviews?: ReviewRecord[];
  publishes?: PublishRecord[];
  statusEvents?: ArticleStatusEvent[];
  auditLogs?: AuditLogRecord[];
}): MemoryRepositoryStore {
  return {
    articles: new Map((seed?.articles ?? []).map((article) => [article.id, cloneArticle(article)])),
    images: new Map((seed?.images ?? []).map((image) => [image.id, cloneImage(image)])),
    reviews: new Map((seed?.reviews ?? []).map((review) => [review.id, cloneReview(review)])),
    publishes: new Map((seed?.publishes ?? []).map((record) => [record.id, clonePublish(record)])),
    statusEvents: new Map((seed?.statusEvents ?? []).map((event) => [event.id, cloneStatusEvent(event)])),
    auditLogs: new Map((seed?.auditLogs ?? []).map((record) => [record.id, cloneAuditLog(record)]))
  };
}

export function createRepositoryState(seed?: Parameters<typeof createMemoryStore>[0]): MemoryRepositoryStore {
  return createMemoryStore(seed);
}

export function createSequentialIdFactory(start = 1): RepositoryIdFactory {
  let nextId = start;

  return (prefix) => {
    const id = `${prefix}_${String(nextId).padStart(3, "0")}`;
    nextId += 1;
    return id;
  };
}

export function createSequentialIdGenerator(prefix: string, start = 1): () => string {
  const createId = createSequentialIdFactory(start);
  return () => createId(prefix);
}

export const systemClock: RepositoryClock = () => new Date();

export function cloneGenerationConfig(config: GenerationConfig): GenerationConfig {
  return {
    ...config,
    references: config.references ? [...config.references] : undefined
  };
}

export function cloneArticle(article: Article): Article {
  return {
    ...article,
    generationConfig: cloneGenerationConfig(article.generationConfig),
    createdAt: new Date(article.createdAt),
    updatedAt: new Date(article.updatedAt)
  };
}

export function cloneImage(image: ArticleImage): ArticleImage {
  return {
    ...image,
    createdAt: new Date(image.createdAt),
    updatedAt: new Date(image.updatedAt)
  };
}

export function cloneReview(review: ReviewRecord): ReviewRecord {
  return {
    ...review,
    reviewChecklist: review.reviewChecklist ? { ...review.reviewChecklist } : undefined,
    reviewedAt: new Date(review.reviewedAt)
  };
}

export function clonePublish(record: PublishRecord): PublishRecord {
  return {
    ...record,
    imageChecklist: record.imageChecklist?.map((item) => ({ ...item })),
    uploadedMediaIds: record.uploadedMediaIds ? [...record.uploadedMediaIds] : undefined,
    publishedAt: record.publishedAt ? new Date(record.publishedAt) : undefined,
    createdAt: new Date(record.createdAt)
  };
}

export function cloneStatusEvent(event: ArticleStatusEvent): ArticleStatusEvent {
  return {
    ...event,
    createdAt: new Date(event.createdAt)
  };
}

export function cloneAuditLog(record: AuditLogRecord): AuditLogRecord {
  return {
    ...record,
    metadata: record.metadata ? { ...record.metadata } : undefined,
    createdAt: new Date(record.createdAt)
  };
}
