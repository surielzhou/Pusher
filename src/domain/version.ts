import type { ImageType } from "./image.ts";
import type { ArticleStatus } from "./status.ts";

export type VersionedArticleTextField = "title" | "summary" | "body";
export type VersionedImageField = "type" | "url" | "description" | "source" | "position" | "altText";

export interface ArticleVersionImageSnapshot {
  id: string;
  type: ImageType;
  url?: string;
  description: string;
  source?: string;
  position?: string;
  altText?: string;
}

export interface ArticleVersionSnapshot {
  id: string;
  articleId: string;
  contentVersion: number;
  status: ArticleStatus;
  title?: string;
  summary?: string;
  body?: string;
  riskNote?: string;
  reviewedVersion?: number;
  publishedVersion?: number;
  images: ArticleVersionImageSnapshot[];
  label?: string;
  reason?: string;
  createdAt: Date;
}

export interface ArticleVersionFieldDiff {
  field: VersionedArticleTextField;
  before?: string;
  after?: string;
  changed: boolean;
}

export interface ArticleVersionImageUpdate {
  id: string;
  before: ArticleVersionImageSnapshot;
  after: ArticleVersionImageSnapshot;
  changedFields: VersionedImageField[];
}

export interface ArticleVersionImageDiff {
  added: ArticleVersionImageSnapshot[];
  removed: ArticleVersionImageSnapshot[];
  updated: ArticleVersionImageUpdate[];
}

export interface ArticleVersionDiff {
  articleId: string;
  from: ArticleVersionSnapshot;
  to: ArticleVersionSnapshot;
  fields: Record<VersionedArticleTextField, ArticleVersionFieldDiff>;
  images: ArticleVersionImageDiff;
  hasChanges: boolean;
}
