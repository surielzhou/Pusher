import type { ValidationResult } from "../domain/validation.ts";
import type { ArticleRepository } from "../repositories/articleRepository.ts";
import type { ImageRepository } from "../repositories/imageRepository.ts";
import type { ContentValidationService } from "./contracts.ts";

export class ArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ArticleNotFoundError";
    this.articleId = articleId;
  }
}

export interface ContentValidationServiceDependencies {
  articles: Pick<ArticleRepository, "getById">;
  images: Pick<ImageRepository, "listByArticleId">;
}

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

export class ContentValidationServiceImpl implements ContentValidationService {
  private readonly articles: Pick<ArticleRepository, "getById">;
  private readonly images: Pick<ImageRepository, "listByArticleId">;

  constructor(dependencies: ContentValidationServiceDependencies);
  constructor(
    articles: Pick<ArticleRepository, "getById">,
    images: Pick<ImageRepository, "listByArticleId">
  );
  constructor(
    dependenciesOrArticles: ContentValidationServiceDependencies | Pick<ArticleRepository, "getById">,
    images?: Pick<ImageRepository, "listByArticleId">
  ) {
    if (images) {
      this.articles = dependenciesOrArticles as Pick<ArticleRepository, "getById">;
      this.images = images;
      return;
    }

    const dependencies = dependenciesOrArticles as ContentValidationServiceDependencies;
    this.articles = dependencies.articles;
    this.images = dependencies.images;
  }

  async validateForReview(articleId: string): Promise<ValidationResult> {
    const article = await this.articles.getById(articleId);

    if (!article) {
      throw new ArticleNotFoundError(articleId);
    }

    const images = await this.images.listByArticleId(articleId);
    const missingFields: string[] = [];
    const warnings: string[] = [];

    if (!hasText(article.title)) {
      missingFields.push("title");
    }

    if (!hasText(article.body)) {
      missingFields.push("body");
    }

    if (!article.category) {
      missingFields.push("category");
    }

    if (images.length === 0) {
      missingFields.push("image");
    }

    if (article.category === "finance" && !hasText(article.riskNote)) {
      warnings.push("finance_risk_note_missing");
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
      warnings
    };
  }
}

export class RepositoryContentValidationService extends ContentValidationServiceImpl {}
