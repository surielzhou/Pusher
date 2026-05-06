import type { GeneratedArticleDraft, GenerationScope, TextGenerationAdapter } from "../adapters/ai/textGenerationAdapter.ts";
import type { Article } from "../domain/article.ts";
import type { ArticleStatus } from "../domain/status.ts";
import type { ArticleRepository, ImageRepository } from "../repositories/index.ts";
import { assertTransition } from "./articleStatusService.ts";
import type { GenerationDraftResult, GenerationService } from "./contracts.ts";

export type GenerationServiceErrorCode = "article_not_found" | "adapter_failed" | "empty_image_suggestions";

export class GenerationServiceError extends Error {
  readonly code: GenerationServiceErrorCode;
  readonly articleId: string;

  constructor(code: GenerationServiceErrorCode, articleId: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "GenerationServiceError";
    this.code = code;
    this.articleId = articleId;
  }
}

export interface GenerationServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  images: Pick<ImageRepository, "create">;
  adapter: TextGenerationAdapter;
}

export class GenerationServiceImpl implements GenerationService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  private readonly images: Pick<ImageRepository, "create">;
  private readonly adapter: TextGenerationAdapter;

  constructor(dependencies: GenerationServiceDependencies) {
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.adapter = dependencies.adapter;
  }

  async generateDraft(articleId: string): Promise<GenerationDraftResult> {
    return this.generateWithScope(articleId, "full");
  }

  async regenerateDraft(
    articleId: string,
    input: { scope?: GenerationScope; instruction?: string } = {}
  ): Promise<GenerationDraftResult> {
    return this.generateWithScope(articleId, input.scope ?? "full", input.instruction);
  }

  private async generateWithScope(
    articleId: string,
    scope: GenerationScope,
    instruction?: string
  ): Promise<GenerationDraftResult> {
    const article = await this.getArticleOrThrow(articleId);
    const generationSource = await this.prepareRetryIfNeeded(article);

    try {
      const draft = await this.adapter.generateArticleDraft({
        articleId,
        config: generationSource.generationConfig,
        scope,
        instruction,
        currentContent: {
          title: generationSource.title,
          summary: generationSource.summary,
          body: generationSource.body,
          riskNote: generationSource.riskNote,
          contentVersion: generationSource.contentVersion
        }
      });

      return this.persistGeneratedDraft(generationSource, draft);
    } catch (error) {
      await this.markGenerationFailed(generationSource, error);
      throw new GenerationServiceError(
        "adapter_failed",
        articleId,
        `Draft generation failed for article ${articleId}: ${getErrorMessage(error)}`,
        { cause: error }
      );
    }
  }

  private async getArticleOrThrow(articleId: string): Promise<Article> {
    const article = await this.articles.getById(articleId);

    if (!article) {
      throw new GenerationServiceError("article_not_found", articleId, `Article not found: ${articleId}`);
    }

    return article;
  }

  private async prepareRetryIfNeeded(article: Article): Promise<Article> {
    if (article.status !== "generation_failed") {
      return article;
    }

    return this.transitionTo(article, "drafting", "Retry draft generation");
  }

  private async persistGeneratedDraft(article: Article, draft: GeneratedArticleDraft): Promise<GenerationDraftResult> {
    if (draft.imageSuggestions.length === 0) {
      throw new GenerationServiceError(
        "empty_image_suggestions",
        article.id,
        `Generated draft for article ${article.id} must include at least one image suggestion`
      );
    }

    const nextStatus = "editing";
    if (article.status !== nextStatus) {
      assertTransition(article.status, nextStatus);
    }

    const updatedArticle = await this.articles.update(article.id, {
      title: draft.title,
      summary: draft.summary,
      body: draft.body,
      riskNote: draft.riskNote,
      status: nextStatus,
      contentVersion: article.contentVersion + 1
    });

    await Promise.all(
      draft.imageSuggestions.map((suggestion) =>
        this.images.create({
          articleId: article.id,
          type: "suggestion",
          description: suggestion.description,
          position: suggestion.position,
          altText: suggestion.altText,
          source: suggestion.source
        })
      )
    );

    if (article.status !== nextStatus) {
      await this.articles.recordStatusEvent({
        articleId: article.id,
        fromStatus: article.status,
        toStatus: nextStatus,
        reason: "Draft generation succeeded"
      });
    }

    return {
      articleId: updatedArticle.id,
      status: "editing",
      contentVersion: updatedArticle.contentVersion
    };
  }

  private async markGenerationFailed(article: Article, error: unknown): Promise<void> {
    const nextStatus = "generation_failed";
    if (article.status !== nextStatus) {
      assertTransition(article.status, nextStatus);
    }

    await this.articles.update(article.id, { status: nextStatus });
    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus: nextStatus,
      reason: `Generation failed: ${getErrorMessage(error)}`
    });
  }

  private async transitionTo(article: Article, toStatus: ArticleStatus, reason: string): Promise<Article> {
    assertTransition(article.status, toStatus);
    const updatedArticle = await this.articles.update(article.id, { status: toStatus });
    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus,
      reason
    });

    return updatedArticle;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
