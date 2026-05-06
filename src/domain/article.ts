import type { ArticleImage } from "./image.ts";
import type { PublishRecord } from "./publish.ts";
import type { ReviewRecord } from "./review.ts";
import type { ArticleStatus, ContentCategory } from "./status.ts";

export interface GenerationConfig {
  category: ContentCategory;
  topic: string;
  audience?: string;
  style?: string;
  length?: string;
  references?: string[];
  requireRiskNote: boolean;
}

export interface Article {
  id: string;
  title?: string;
  summary?: string;
  body?: string;
  category: ContentCategory;
  status: ArticleStatus;
  generationConfig: GenerationConfig;
  riskNote?: string;
  contentVersion: number;
  reviewedVersion?: number;
  publishedVersion?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ArticleDetail {
  article: Article;
  images: ArticleImage[];
  latestReview?: ReviewRecord;
  latestPublish?: PublishRecord;
}

export interface ArticleStatusEvent {
  id: string;
  articleId: string;
  fromStatus?: ArticleStatus;
  toStatus: ArticleStatus;
  reason?: string;
  createdAt: Date;
}
