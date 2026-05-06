import type { Article, ArticleStatusEvent, GenerationConfig } from "../domain/article.ts";
import type { ArticleImage, ImageType } from "../domain/image.ts";
import type { PublishRecord, PublishStatus } from "../domain/publish.ts";
import type { ReviewRecord, ReviewResult } from "../domain/review.ts";
import type { ArticleStatus, ContentCategory } from "../domain/status.ts";

export type RepositoryClock = () => Date;
export type RepositoryIdFactory = (prefix: string) => string;

export interface RepositoryListResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ArticleRepositoryQuery {
  category?: ContentCategory;
  status?: ArticleStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateArticleRecordInput {
  category: ContentCategory;
  generationConfig: GenerationConfig;
  title?: string;
  summary?: string;
  body?: string;
  riskNote?: string;
  status?: ArticleStatus;
}

export interface UpdateArticleRecordInput {
  category?: ContentCategory;
  generationConfig?: GenerationConfig;
  title?: string;
  summary?: string;
  body?: string;
  status?: ArticleStatus;
  riskNote?: string;
  contentVersion?: number;
  reviewedVersion?: number;
  publishedVersion?: number;
}

export interface CreateArticleStatusEventInput {
  articleId: string;
  fromStatus?: ArticleStatus;
  toStatus: ArticleStatus;
  reason?: string;
}

export interface ArticleRepository {
  create(input: CreateArticleRecordInput): Promise<Article>;
  getById(articleId: string): Promise<Article | undefined>;
  update(articleId: string, input: UpdateArticleRecordInput): Promise<Article>;
  list(query?: ArticleRepositoryQuery): Promise<RepositoryListResult<Article>>;
  delete(articleId: string): Promise<void>;
  addStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent>;
  recordStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent>;
  listStatusEvents(articleId: string): Promise<ArticleStatusEvent[]>;
}

export interface CreateArticleImageInput {
  articleId: string;
  type: ImageType;
  description: string;
  url?: string;
  source?: string;
  position?: string;
  altText?: string;
}

export interface UpdateArticleImageInput {
  type?: ImageType;
  description?: string;
  url?: string;
  source?: string;
  position?: string;
  altText?: string;
}

export interface ImageRepository {
  create(input: CreateArticleImageInput): Promise<ArticleImage>;
  getById(imageId: string): Promise<ArticleImage | undefined>;
  listByArticleId(articleId: string): Promise<ArticleImage[]>;
  update(imageId: string, input: UpdateArticleImageInput): Promise<ArticleImage>;
  delete(imageId: string): Promise<void>;
}

export interface CreateReviewRecordInput {
  articleId: string;
  articleVersion: number;
  result: ReviewResult;
  comment?: string;
  reviewChecklist?: Record<string, boolean>;
}

export interface ReviewRepository {
  create(input: CreateReviewRecordInput): Promise<ReviewRecord>;
  listByArticleId(articleId: string): Promise<ReviewRecord[]>;
  latestByArticleId(articleId: string): Promise<ReviewRecord | undefined>;
  getLatestByArticleId(articleId: string): Promise<ReviewRecord | undefined>;
  findLatestByArticleId(articleId: string): Promise<ReviewRecord | undefined>;
}

export interface CreatePublishRecordInput {
  articleId: string;
  articleVersion: number;
  channel: "wechat_manual" | string;
  status: PublishStatus;
  exportContent?: string;
  imageChecklist?: Array<Record<string, string>>;
  errorMessage?: string;
  publishedAt?: Date;
}

export interface UpdatePublishRecordInput {
  status?: PublishStatus;
  exportContent?: string;
  imageChecklist?: Array<Record<string, string>>;
  errorMessage?: string;
  publishedAt?: Date;
}

export interface PublishRepository {
  create(input: CreatePublishRecordInput): Promise<PublishRecord>;
  getById(publishRecordId: string): Promise<PublishRecord | undefined>;
  listByArticleId(articleId: string): Promise<PublishRecord[]>;
  latestByArticleId(articleId: string): Promise<PublishRecord | undefined>;
  getLatestByArticleId(articleId: string): Promise<PublishRecord | undefined>;
  findLatestByArticleId(articleId: string): Promise<PublishRecord | undefined>;
  update(publishRecordId: string, input: UpdatePublishRecordInput): Promise<PublishRecord>;
}

export interface AuditLogRecord {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  message?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface CreateAuditLogInput {
  entityType: string;
  entityId: string;
  action: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogRepository {
  create(input: CreateAuditLogInput): Promise<AuditLogRecord>;
  listByEntity(entityType: string, entityId: string): Promise<AuditLogRecord[]>;
  createStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent>;
  listStatusEventsByArticleId(articleId: string): Promise<ArticleStatusEvent[]>;
  latestStatusEventByArticleId(articleId: string): Promise<ArticleStatusEvent | undefined>;
}

export type RepositoryErrorCode = "not_found" | "invalid_input";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "RepositoryError";
  }
}
