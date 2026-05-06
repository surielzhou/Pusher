import type { GeneratedImageAsset, ImageGenerationAdapter } from "../adapters/ai/imageGenerationAdapter.ts";
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

export type ImageGenerationErrorCode = "adapter_missing" | "adapter_failed";

export class ImageGenerationError extends Error {
  readonly code: ImageGenerationErrorCode;
  readonly imageId: string;
  override readonly cause?: unknown;

  constructor(code: ImageGenerationErrorCode, imageId: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ImageGenerationError";
    this.code = code;
    this.imageId = imageId;
    this.cause = cause;
  }
}

export interface ImageServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update">;
  images: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">;
  imageGenerationAdapter?: ImageGenerationAdapter;
}

export class ImageServiceImpl implements ImageService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update">;
  private readonly images: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">;
  private readonly imageGenerationAdapter?: ImageGenerationAdapter;

  constructor(dependencies: ImageServiceDependencies);
  constructor(
    articles: Pick<ArticleRepository, "getById" | "update">,
    images: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">,
    imageGenerationAdapter?: ImageGenerationAdapter
  );
  constructor(
    dependenciesOrArticles: ImageServiceDependencies | Pick<ArticleRepository, "getById" | "update">,
    images?: Pick<ImageRepository, "create" | "getById" | "listByArticleId" | "update">,
    imageGenerationAdapter?: ImageGenerationAdapter
  ) {
    if (images) {
      this.articles = dependenciesOrArticles as Pick<ArticleRepository, "getById" | "update">;
      this.images = images;
      this.imageGenerationAdapter = imageGenerationAdapter;
      return;
    }

    const dependencies = dependenciesOrArticles as ImageServiceDependencies;
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.imageGenerationAdapter = dependencies.imageGenerationAdapter;
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

  async generateImageFromSuggestion(input: {
    imageId: string;
    instruction?: string;
  }): Promise<{ imageId: string; type: "generated"; url: string; source: string }> {
    if (!this.imageGenerationAdapter) {
      throw new ImageGenerationError(
        "adapter_missing",
        input.imageId,
        "Image generation adapter is not configured"
      );
    }

    const existing = await this.images.getById(input.imageId);
    if (!existing) {
      throw new ImageNotFoundError(input.imageId);
    }

    if (existing.type !== "suggestion") {
      throw new RepositoryError("invalid_input", "Only image suggestions can be generated");
    }

    const article = await this.getExistingArticle(existing.articleId);
    this.assertArticleImagesEditable(article);

    let generated: GeneratedImageAsset;
    try {
      generated = await this.imageGenerationAdapter.generateImage({
        articleId: article.id,
        imageId: existing.id,
        category: article.category,
        topic: article.generationConfig.topic,
        description: existing.description,
        position: existing.position,
        altText: existing.altText,
        instruction: input.instruction
      });
    } catch (error) {
      throw new ImageGenerationError(
        "adapter_failed",
        input.imageId,
        `Image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }

    assertPresentImageReference(generated.url);
    assertPresentImageSource(generated.source);

    const image = await this.images.update(input.imageId, {
      type: "generated",
      url: generated.url,
      source: generated.source,
      altText: generated.altText ?? existing.altText
    });
    await this.recordArticleImageChange(image.articleId);

    return {
      imageId: image.id,
      type: "generated",
      url: image.url ?? generated.url,
      source: image.source ?? generated.source
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
