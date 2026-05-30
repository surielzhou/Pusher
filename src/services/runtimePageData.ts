import type { ArticleDetail } from "../domain/article.ts";
import type { ArticleSource } from "../domain/source.ts";
import { canPreparePublish } from "./articleStatusService.ts";
import { ComplianceServiceImpl } from "./complianceService.ts";
import type { ReviewView } from "./contracts.ts";
import { getRuntimeContainerForApi } from "./runtimeContainer.ts";

export interface RuntimeEditPageData {
  detail: ArticleDetail;
  missingFields: string[];
  readOnly: boolean;
  sources: ArticleSource[];
}

export interface RuntimeReviewPageData {
  detail: ArticleDetail;
  checklist: ReviewView["checklist"];
  complianceReport: ReturnType<ComplianceServiceImpl["analyzeArticle"]>;
}

export interface RuntimePublishPageData {
  detail: ArticleDetail;
  canPublish: boolean;
}

const complianceService = new ComplianceServiceImpl();

export async function getRuntimeArticleDetail(articleId: string): Promise<ArticleDetail> {
  const runtime = await getRuntimeContainerForApi();
  return runtime.articleService.getArticleDetail(articleId);
}

export async function getRuntimeEditPageData(articleId: string): Promise<RuntimeEditPageData> {
  const detail = await getRuntimeArticleDetail(articleId);

  return {
    detail,
    missingFields: getMissingFields(detail),
    readOnly: detail.article.status === "pending_review",
    sources: []
  };
}

export async function getRuntimeReviewPageData(articleId: string): Promise<RuntimeReviewPageData> {
  const runtime = await getRuntimeContainerForApi();
  const reviewView = await runtime.reviewService.getReviewView(articleId);
  const detail = await runtime.articleService.getArticleDetail(articleId);

  return {
    detail,
    checklist: reviewView.checklist,
    complianceReport: reviewView.complianceReport ?? complianceService.analyzeArticle(detail.article)
  };
}

export async function getRuntimePublishPageData(articleId: string): Promise<RuntimePublishPageData> {
  const detail = await getRuntimeArticleDetail(articleId);
  const reviewMatchesCurrentContent = detail.article.reviewedVersion === detail.article.contentVersion;

  return {
    detail,
    canPublish: canPreparePublish(detail.article.status) && reviewMatchesCurrentContent
  };
}

function getMissingFields(detail: ArticleDetail): string[] {
  const missingFields: string[] = [];

  if (!detail.article.title?.trim()) missingFields.push("title");
  if (!detail.article.body?.trim()) missingFields.push("body");
  if (!detail.article.category) missingFields.push("category");
  if (detail.images.length === 0) missingFields.push("image");

  return missingFields;
}
