export const PUBLISH_STATUSES = ["prepared", "published", "failed"] as const;

export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export interface PublishRecord {
  id: string;
  articleId: string;
  articleVersion: number;
  channel: "wechat_manual" | string;
  status: PublishStatus;
  exportContent?: string;
  imageChecklist?: Array<Record<string, string>>;
  externalDraftId?: string;
  uploadedMediaIds?: string[];
  errorMessage?: string;
  publishedAt?: Date;
  createdAt: Date;
}
