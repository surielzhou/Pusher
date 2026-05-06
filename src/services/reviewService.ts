import type { Article } from "../domain/article.ts";
import type { ArticleImage } from "../domain/image.ts";
import type { ReviewResult } from "../domain/review.ts";
import type { ArticleStatus } from "../domain/status.ts";
import type { ArticleRepository } from "../repositories/articleRepository.ts";
import type { ImageRepository } from "../repositories/imageRepository.ts";
import type { ReviewRepository } from "../repositories/types.ts";
import { assertTransition } from "./articleStatusService.ts";
import { ComplianceServiceImpl, type ComplianceService } from "./complianceService.ts";
import type { ReviewService, ReviewView } from "./contracts.ts";

type ReviewDecisionStatus = "approved" | "review_rejected" | "not_publish";

export interface ReviewViewData extends Omit<ReviewView, "article"> {
  article: Article;
  images: ArticleImage[];
}

export class ReviewArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ReviewArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class ArticleNotReviewableError extends Error {
  readonly articleId: string;
  readonly status: ArticleStatus;

  constructor(articleId: string, status: ArticleStatus) {
    super(`Article ${articleId} cannot be reviewed while ${status}`);
    this.name = "ArticleNotReviewableError";
    this.articleId = articleId;
    this.status = status;
  }
}

export class ReviewCommentRequiredError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Rejected review for article ${articleId} requires a comment`);
    this.name = "ReviewCommentRequiredError";
    this.articleId = articleId;
  }
}

export interface ReviewServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  images: Pick<ImageRepository, "listByArticleId">;
  reviews: Pick<ReviewRepository, "create">;
  compliance?: Pick<ComplianceService, "analyzeArticle">;
}

export class ReviewServiceImpl implements ReviewService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  private readonly images: Pick<ImageRepository, "listByArticleId">;
  private readonly reviews: Pick<ReviewRepository, "create">;
  private readonly compliance: Pick<ComplianceService, "analyzeArticle">;

  constructor(dependencies: ReviewServiceDependencies) {
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.reviews = dependencies.reviews;
    this.compliance = dependencies.compliance ?? new ComplianceServiceImpl();
  }

  async getReviewView(articleId: string): Promise<ReviewViewData> {
    const article = await this.getExistingArticle(articleId);
    const images = await this.images.listByArticleId(articleId);

    return {
      article,
      images,
      riskNote: article.riskNote,
      complianceReport: this.compliance.analyzeArticle(article),
      checklist: {
        hasTitle: Boolean(article.title?.trim()),
        hasBody: Boolean(article.body?.trim()),
        hasImageOrSuggestion: images.length > 0,
        categoryMatched: article.category === article.generationConfig.category
      }
    };
  }

  async submitReview(input: {
    articleId: string;
    result: ReviewResult;
    comment?: string;
    reviewChecklist?: Record<string, boolean>;
  }): Promise<{ status: ReviewDecisionStatus; reviewedVersion?: number }> {
    const article = await this.getExistingArticle(input.articleId);
    if (article.status !== "pending_review") {
      throw new ArticleNotReviewableError(article.id, article.status);
    }

    const comment = normalizeComment(input.comment);
    if (input.result === "rejected" && !comment) {
      throw new ReviewCommentRequiredError(article.id);
    }

    const nextStatus = statusForReviewResult(input.result);
    assertTransition(article.status, nextStatus);

    await this.reviews.create({
      articleId: article.id,
      articleVersion: article.contentVersion,
      result: input.result,
      comment,
      reviewChecklist: input.reviewChecklist
    });

    const updated = await this.articles.update(article.id, {
      status: nextStatus,
      reviewedVersion: nextStatus === "approved" ? article.contentVersion : undefined
    });

    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus: nextStatus,
      reason: statusEventReason(input.result)
    });

    if (updated.status === "approved") {
      return {
        status: "approved",
        reviewedVersion: updated.reviewedVersion
      };
    }

    return { status: updated.status as "review_rejected" | "not_publish" };
  }

  private async getExistingArticle(articleId: string): Promise<Article> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new ReviewArticleNotFoundError(articleId);
    }

    return article;
  }
}

function statusForReviewResult(result: ReviewResult): ReviewDecisionStatus {
  switch (result) {
    case "approved":
      return "approved";
    case "rejected":
      return "review_rejected";
    case "not_publish":
      return "not_publish";
  }
}

function statusEventReason(result: ReviewResult): string {
  switch (result) {
    case "approved":
      return "review approved";
    case "rejected":
      return "review rejected";
    case "not_publish":
      return "review not publish";
  }
}

function normalizeComment(comment: string | undefined): string | undefined {
  const normalized = comment?.trim();
  return normalized ? normalized : undefined;
}
