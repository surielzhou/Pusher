import type { Article } from "../domain/article.ts";
import type { ArticleImage, ImageType } from "../domain/image.ts";
import type { ArticleStatus } from "../domain/status.ts";
import type { ArticleRepository } from "../repositories/articleRepository.ts";
import type { ImageRepository } from "../repositories/imageRepository.ts";
import { RepositoryError } from "../repositories/types.ts";
import { resolveStatusAfterContentChange } from "./articleStatusService.ts";
import type { ImageService } from "./contracts.ts";

export class ArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class ImageNotFoundError extends Error {
  readonly imageId: string;

  constructor(imageId: string) {
    super(`Image not found: ${imageId}`);
    this.name = "ImageNotFoundError";
    this.imageId = imageId;
  }
}

export class ArticleImageNotEditableError extends Error {
  readonly articleId: string;
  readonly status: ArticleStatus;

  constructor(articleId: string, status: ArticleStatus) {
    super(`Article ${articleId} images cannot be edited while ${status}`);
    this.name = "ArticleImageNotEditableError";
    this.articleId = articleId;
    this.status = status;
  }
}

export interface ImageServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update">;
  images: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">;
}

export class ImageServiceImpl implements ImageService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update">;
  private readonly images: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">;

  constructor(dependencies: ImageServiceDependencies);
  constructor(
    articles: Pick<ArticleRepository, "getById" | "update">,
    images: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">
  );
  constructor(
    dependenciesOrArticles: ImageServiceDependencies | Pick<ArticleRepository, "getById" | "update">,
    images?: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">
  ) {
    if (images) {
      this.articles = dependenciesOrArticles as Pick<ArticleRepository, "getById" | "update">;
      this.images = images;
      return;
    }

    const dependencies = dependenciesOrArticles as ImageServiceDependencies;
    this.articles = dependencies.articles;
    this.images = dependencies.images;
  }

  async listArticleImages(articleId: string): Promise<{ items: ArticleImage[] }> {
    await this.getExistingArticle(articleId);

    return {
      items: await this.images.listByArticleId(articleId)
    };
  }

  async saveImageSuggestion(input: {
    articleId: string;
    description: string;
    position?: string;
    altText?: string;
  }): Promise<{ imageId: string; type: "suggestion" }> {
    this.assertArticleImagesEditable(await this.getExistingArticle(input.articleId));

    const image = await this.images.create({
      articleId: input.articleId,
      type: "suggestion",
      description: input.description,
      position: input.position,
      altText: input.altText
    });
    await this.recordArticleImageChange(image.articleId);

    return {
      imageId: image.id,
      type: "suggestion"
    };
  }

  async replaceImage(input: {
    imageId: string;
    type: Exclude<ImageType, "suggestion">;
    url: string;
    source: string;
  }): Promise<{ imageId: string; type: Exclude<ImageType, "suggestion"> }> {
    assertPresentImageReference(input.url);
    assertPresentImageSource(input.source);

    const existing = await this.images.getById(input.imageId);
    if (!existing) {
      throw new ImageNotFoundError(input.imageId);
    }

    this.assertArticleImagesEditable(await this.getExistingArticle(existing.articleId));

    const image = await this.images.update(input.imageId, {
      type: input.type,
      url: input.url,
      source: input.source
    });
    await this.recordArticleImageChange(image.articleId);

    return {
      imageId: image.id,
      type: input.type
    };
  }

  private async getExistingArticle(articleId: string) {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new ArticleNotFoundError(articleId);
    }

    return article;
  }

  private async recordArticleImageChange(articleId: string): Promise<void> {
    const article = await this.getExistingArticle(articleId);
    this.assertArticleImagesEditable(article);

    await this.articles.update(articleId, {
      status: resolveStatusAfterContentChange(article.status),
      contentVersion: article.contentVersion + 1
    });
  }

  private assertArticleImagesEditable(article: Article): void {
    if (resolveStatusAfterContentChange(article.status) !== "editing") {
      throw new ArticleImageNotEditableError(article.id, article.status);
    }
  }
}

export class RepositoryImageService extends ImageServiceImpl {}

function assertPresentImageReference(url: string): void {
  if (!url.trim()) {
    throw new RepositoryError("invalid_input", "Image url is required");
  }
}

function assertPresentImageSource(source: string): void {
  if (!source.trim()) {
    throw new RepositoryError("invalid_input", "Image source is required");
  }
}
