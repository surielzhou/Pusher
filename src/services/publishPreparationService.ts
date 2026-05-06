import { exportWechatManualContent } from "../adapters/export/wechatManualExporter.ts";
import type { Article } from "../domain/article.ts";
import type { PublishRecord } from "../domain/publish.ts";
import type { ArticleStatus } from "../domain/status.ts";
import type { ArticleRepository } from "../repositories/articleRepository.ts";
import type { ImageRepository, PublishRepository } from "../repositories/types.ts";
import { assertTransition, canPreparePublish } from "./articleStatusService.ts";
import type { PublishPreparationService } from "./contracts.ts";

export class PublishArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "PublishArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class ArticleNotPublishableError extends Error {
  readonly articleId: string;
  readonly status: ArticleStatus;

  constructor(articleId: string, status: ArticleStatus) {
    super(`Article ${articleId} cannot be prepared for publish while ${status}`);
    this.name = "ArticleNotPublishableError";
    this.articleId = articleId;
    this.status = status;
  }
}

export class ArticleReviewVersionMismatchError extends Error {
  readonly articleId: string;
  readonly reviewedVersion: number | undefined;
  readonly contentVersion: number;

  constructor(articleId: string, reviewedVersion: number | undefined, contentVersion: number) {
    super(`Article ${articleId} content version ${contentVersion} has not been reviewed`);
    this.name = "ArticleReviewVersionMismatchError";
    this.articleId = articleId;
    this.reviewedVersion = reviewedVersion;
    this.contentVersion = contentVersion;
  }
}

export class PublishRecordNotFoundError extends Error {
  readonly publishRecordId: string;

  constructor(publishRecordId: string) {
    super(`Publish record not found: ${publishRecordId}`);
    this.name = "PublishRecordNotFoundError";
    this.publishRecordId = publishRecordId;
  }
}

export class PublishFailureReasonRequiredError extends Error {
  readonly publishRecordId: string;

  constructor(publishRecordId: string) {
    super(`Publish failure for record ${publishRecordId} requires a reason`);
    this.name = "PublishFailureReasonRequiredError";
    this.publishRecordId = publishRecordId;
  }
}

export interface PublishPreparationServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  images: Pick<ImageRepository, "listByArticleId">;
  publishes: Pick<PublishRepository, "create" | "getById" | "update">;
}

export class PublishPreparationServiceImpl implements PublishPreparationService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  private readonly images: Pick<ImageRepository, "listByArticleId">;
  private readonly publishes: Pick<PublishRepository, "create" | "getById" | "update">;

  constructor(dependencies: PublishPreparationServiceDependencies) {
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.publishes = dependencies.publishes;
  }

  async preparePublish(input: { articleId: string; channel: "wechat_manual" | string }): Promise<{
    publishRecordId: string;
    status: "prepared";
    articleStatus: "pending_publish";
    exportContent: string;
  }> {
    const article = await this.getExistingArticle(input.articleId);
    if (!canPreparePublish(article.status)) {
      throw new ArticleNotPublishableError(article.id, article.status);
    }

    if (article.reviewedVersion !== article.contentVersion) {
      throw new ArticleReviewVersionMismatchError(article.id, article.reviewedVersion, article.contentVersion);
    }

    const images = await this.images.listByArticleId(article.id);
    const exported = exportWechatManualContent(article, images);
    const publishRecord = await this.publishes.create({
      articleId: article.id,
      articleVersion: article.contentVersion,
      channel: input.channel,
      status: "prepared",
      exportContent: exported.exportContent,
      imageChecklist: exported.imageChecklist
    });

    if (article.status === "approved") {
      assertTransition(article.status, "pending_publish");
      await this.articles.update(article.id, { status: "pending_publish" });
      await this.articles.recordStatusEvent({
        articleId: article.id,
        fromStatus: article.status,
        toStatus: "pending_publish",
        reason: "publish prepared"
      });
    }

    return {
      publishRecordId: publishRecord.id,
      status: "prepared",
      articleStatus: "pending_publish",
      exportContent: exported.exportContent
    };
  }

  async markPublished(input: { publishRecordId: string; publishedAt?: Date }): Promise<{
    articleStatus: "published";
    publishStatus: "published";
  }> {
    const publishRecord = await this.getExistingPublishRecord(input.publishRecordId);
    const article = await this.getExistingArticle(publishRecord.articleId);
    assertTransition(article.status, "published");

    await this.publishes.update(publishRecord.id, {
      status: "published",
      publishedAt: input.publishedAt
    });
    await this.articles.update(article.id, {
      status: "published",
      publishedVersion: article.contentVersion
    });
    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus: "published",
      reason: "publish completed"
    });

    return { articleStatus: "published", publishStatus: "published" };
  }

  async markPublishFailed(input: { publishRecordId: string; errorMessage: string }): Promise<{
    articleStatus: "publish_failed";
    publishStatus: "failed";
  }> {
    const errorMessage = normalizeRequiredMessage(input.errorMessage);
    if (!errorMessage) {
      throw new PublishFailureReasonRequiredError(input.publishRecordId);
    }

    const publishRecord = await this.getExistingPublishRecord(input.publishRecordId);
    const article = await this.getExistingArticle(publishRecord.articleId);
    assertTransition(article.status, "publish_failed");

    await this.publishes.update(publishRecord.id, {
      status: "failed",
      errorMessage
    });
    await this.articles.update(article.id, { status: "publish_failed" });
    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus: "publish_failed",
      reason: "publish failed"
    });

    return { articleStatus: "publish_failed", publishStatus: "failed" };
  }

  private async getExistingArticle(articleId: string): Promise<Article> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new PublishArticleNotFoundError(articleId);
    }

    return article;
  }

  private async getExistingPublishRecord(publishRecordId: string): Promise<PublishRecord> {
    const publishRecord = await this.publishes.getById(publishRecordId);
    if (!publishRecord) {
      throw new PublishRecordNotFoundError(publishRecordId);
    }

    return publishRecord;
  }
}

function normalizeRequiredMessage(message: string): string | undefined {
  const normalized = message.trim();
  return normalized ? normalized : undefined;
}
