import type { ArticleDetail, GenerationConfig } from "../domain/article.ts";
import type { ArticleImage, ImageType } from "../domain/image.ts";
import type { PublishStatus } from "../domain/publish.ts";
import type { ReviewResult } from "../domain/review.ts";
import type { ArticleStatus, ContentCategory } from "../domain/status.ts";
import type { ValidationResult } from "../domain/validation.ts";

export const SERVICE_CONTRACTS = [
  "ArticleService",
  "GenerationService",
  "ImageService",
  "EditorService",
  "ReviewService",
  "PublishPreparationService",
  "ContentValidationService"
] as const;

export interface CreateArticleInput {
  category: ContentCategory;
  topic: string;
  audience?: string;
  style?: string;
  length?: string;
  references?: string[];
}

export interface ArticleListQuery {
  category?: ContentCategory;
  status?: ArticleStatus;
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export interface ArticleService {
  createArticle(input: CreateArticleInput): Promise<{ articleId: string; status: "drafting" }>;
  getArticleDetail(articleId: string): Promise<ArticleDetail>;
  listArticles(query?: ArticleListQuery): Promise<{ items: ArticleDetail[]; total: number }>;
}

export interface GenerationDraftResult {
  articleId: string;
  status: "editing";
  contentVersion: number;
}

export interface GenerationService {
  generateDraft(articleId: string): Promise<GenerationDraftResult>;
  regenerateDraft(
    articleId: string,
    input?: { scope?: "full" | "title" | "summary" | "section" | "image_suggestion"; instruction?: string }
  ): Promise<GenerationDraftResult>;
}

export interface ImageService {
  listArticleImages(articleId: string): Promise<{ items: ArticleImage[] }>;
  saveImageSuggestion(input: {
    articleId: string;
    description: string;
    position?: string;
    altText?: string;
  }): Promise<{ imageId: string; type: "suggestion" }>;
  replaceImage(input: {
    imageId: string;
    type: Exclude<ImageType, "suggestion">;
    url: string;
    source: string;
  }): Promise<{ imageId: string; type: Exclude<ImageType, "suggestion"> }>;
}

export interface EditorService {
  saveArticleContent(
    articleId: string,
    input: { title?: string; summary?: string; body?: string }
  ): Promise<{ articleId: string; status: "editing"; contentVersion: number }>;
  submitForReview(articleId: string): Promise<{ status: "pending_review" }>;
}

export interface ReviewView {
  article: unknown;
  images: ArticleImage[];
  riskNote?: string;
  checklist: {
    hasTitle: boolean;
    hasBody: boolean;
    hasImageOrSuggestion: boolean;
    categoryMatched: boolean;
  };
}

export interface ReviewService {
  getReviewView(articleId: string): Promise<ReviewView>;
  submitReview(input: {
    articleId: string;
    result: ReviewResult;
    comment?: string;
    reviewChecklist?: Record<string, boolean>;
  }): Promise<{ status: "approved" | "review_rejected" | "not_publish"; reviewedVersion?: number }>;
}

export interface PublishPreparationService {
  preparePublish(input: {
    articleId: string;
    channel: "wechat_manual" | string;
  }): Promise<{
    publishRecordId: string;
    status: "prepared";
    articleStatus: "pending_publish";
    exportContent: string;
  }>;
  createWechatDraft(input: {
    articleId: string;
  }): Promise<{
    publishRecordId: string;
    status: "prepared";
    articleStatus: "pending_publish";
    draftId: string;
    uploadedMediaIds: string[];
  }>;
  markPublished(input: {
    publishRecordId: string;
    publishedAt?: Date;
  }): Promise<{ articleStatus: "published"; publishStatus: Extract<PublishStatus, "published"> }>;
  markPublishFailed(input: {
    publishRecordId: string;
    errorMessage: string;
  }): Promise<{ articleStatus: "publish_failed"; publishStatus: Extract<PublishStatus, "failed"> }>;
}

export interface ContentValidationService {
  validateForReview(articleId: string): Promise<ValidationResult>;
}

export type { GenerationConfig };
