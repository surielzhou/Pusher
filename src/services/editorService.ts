import type { ArticleStatus } from "../domain/status.ts";
import type { ArticleRepository, UpdateArticleRecordInput } from "../repositories/articleRepository.ts";
import { assertTransition, resolveStatusAfterContentChange } from "./articleStatusService.ts";
import type { ContentValidationService, EditorService } from "./contracts.ts";

export class EditorArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "EditorArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class ArticleNotEditableError extends Error {
  readonly articleId: string;
  readonly status: ArticleStatus;

  constructor(articleId: string, status: ArticleStatus) {
    super(`Article ${articleId} cannot be edited while ${status}`);
    this.name = "ArticleNotEditableError";
    this.articleId = articleId;
    this.status = status;
  }
}

export class ArticleReviewValidationError extends Error {
  readonly articleId: string;
  readonly missingFields: string[];
  readonly warnings: string[];

  constructor(articleId: string, missingFields: string[], warnings: string[]) {
    super(`Article ${articleId} is not ready for review`);
    this.name = "ArticleReviewValidationError";
    this.articleId = articleId;
    this.missingFields = [...missingFields];
    this.warnings = [...warnings];
  }
}

export interface EditorServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  validation: ContentValidationService;
}

export class EditorServiceImpl implements EditorService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  private readonly validation: ContentValidationService;

  constructor(dependencies: EditorServiceDependencies) {
    this.articles = dependencies.articles;
    this.validation = dependencies.validation;
  }

  async saveArticleContent(
    articleId: string,
    input: { title?: string; summary?: string; body?: string }
  ): Promise<{ articleId: string; status: "editing"; contentVersion: number }> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new EditorArticleNotFoundError(articleId);
    }

    const nextStatus = resolveStatusAfterContentChange(article.status);
    if (nextStatus !== "editing") {
      throw new ArticleNotEditableError(articleId, article.status);
    }

    const update: UpdateArticleRecordInput = {
      status: "editing",
      contentVersion: article.contentVersion + 1
    };

    if (input.title !== undefined) update.title = input.title;
    if (input.summary !== undefined) update.summary = input.summary;
    if (input.body !== undefined) update.body = input.body;

    const updated = await this.articles.update(articleId, update);

    if (article.status !== updated.status) {
      await this.articles.recordStatusEvent({
        articleId,
        fromStatus: article.status,
        toStatus: updated.status,
        reason: "content edited"
      });
    }

    return {
      articleId,
      status: "editing",
      contentVersion: updated.contentVersion
    };
  }

  async submitForReview(articleId: string): Promise<{ status: "pending_review" }> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new EditorArticleNotFoundError(articleId);
    }

    assertTransition(article.status, "pending_review");

    const validation = await this.validation.validateForReview(articleId);
    if (!validation.valid) {
      throw new ArticleReviewValidationError(articleId, validation.missingFields, validation.warnings);
    }

    await this.articles.update(articleId, { status: "pending_review" });
    await this.articles.recordStatusEvent({
      articleId,
      fromStatus: article.status,
      toStatus: "pending_review",
      reason: "submit review"
    });

    return { status: "pending_review" };
  }
}
