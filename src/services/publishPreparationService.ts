import { exportWechatManualContent } from "../adapters/export/wechatManualExporter.ts";
import {
  WECHAT_DRAFT_CHANNEL,
  buildWechatDraftCreateInput,
  toWechatDraftImageUploads,
  type WechatDraftClient,
  type WechatDraftUploadedImage
} from "../adapters/wechat/draftClient.ts";
import type { Article } from "../domain/article.ts";
import type { ArticleImage } from "../domain/image.ts";
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

export class WechatDraftClientRequiredError extends Error {
  constructor() {
    super("Wechat draft client is required to create a WeChat draft");
    this.name = "WechatDraftClientRequiredError";
  }
}

export interface PublishPreparationServiceDependencies {
  articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  images: Pick<ImageRepository, "listByArticleId">;
  publishes: Pick<PublishRepository, "create" | "getById" | "update">;
  wechatDrafts?: WechatDraftClient;
}

export class PublishPreparationServiceImpl implements PublishPreparationService {
  private readonly articles: Pick<ArticleRepository, "getById" | "update" | "recordStatusEvent">;
  private readonly images: Pick<ImageRepository, "listByArticleId">;
  private readonly publishes: Pick<PublishRepository, "create" | "getById" | "update">;
  private readonly wechatDrafts?: WechatDraftClient;

  constructor(dependencies: PublishPreparationServiceDependencies) {
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.publishes = dependencies.publishes;
    this.wechatDrafts = dependencies.wechatDrafts;
  }

  async preparePublish(input: { articleId: string; channel: "wechat_manual" | string }): Promise<{
    publishRecordId: string;
    status: "prepared";
    articleStatus: "pending_publish";
    exportContent: string;
  }> {
    const article = await this.getExistingArticle(input.articleId);
    this.assertPublishableArticle(article);
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

    await this.moveArticleToPendingPublishIfNeeded(article, "publish prepared");

    return {
      publishRecordId: publishRecord.id,
      status: "prepared",
      articleStatus: "pending_publish",
      exportContent: exported.exportContent
    };
  }

  async createWechatDraft(input: { articleId: string }): Promise<{
    publishRecordId: string;
    status: "prepared";
    articleStatus: "pending_publish";
    draftId: string;
    uploadedMediaIds: string[];
  }> {
    const wechatDrafts = this.getWechatDraftClient();
    const article = await this.getExistingArticle(input.articleId);
    this.assertPublishableArticle(article);

    const images = await this.images.listByArticleId(article.id);
    const uploadedImages = await this.uploadWechatImages(wechatDrafts, images);
    const draft = await wechatDrafts.createDraft(buildWechatDraftCreateInput(article, images, uploadedImages));
    const uploadedMediaIds = uploadedImages.map((image) => image.mediaId);
    const publishRecord = await this.publishes.create({
      articleId: article.id,
      articleVersion: article.contentVersion,
      channel: WECHAT_DRAFT_CHANNEL,
      status: "prepared",
      exportContent: formatWechatDraftExportContent(article, draft.draftId, uploadedImages),
      imageChecklist: toWechatDraftImageChecklist(images, uploadedImages),
      externalDraftId: draft.draftId,
      uploadedMediaIds
    });

    await this.moveArticleToPendingPublishIfNeeded(article, "wechat draft created");

    return {
      publishRecordId: publishRecord.id,
      status: "prepared",
      articleStatus: "pending_publish",
      draftId: draft.draftId,
      uploadedMediaIds
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

  private getWechatDraftClient(): WechatDraftClient {
    if (!this.wechatDrafts) {
      throw new WechatDraftClientRequiredError();
    }

    return this.wechatDrafts;
  }

  private assertPublishableArticle(article: Article): void {
    if (!canPreparePublish(article.status)) {
      throw new ArticleNotPublishableError(article.id, article.status);
    }

    if (article.reviewedVersion !== article.contentVersion) {
      throw new ArticleReviewVersionMismatchError(article.id, article.reviewedVersion, article.contentVersion);
    }
  }

  private async moveArticleToPendingPublishIfNeeded(article: Article, reason: string): Promise<void> {
    if (article.status !== "approved") {
      return;
    }

    assertTransition(article.status, "pending_publish");
    await this.articles.update(article.id, { status: "pending_publish" });
    await this.articles.recordStatusEvent({
      articleId: article.id,
      fromStatus: article.status,
      toStatus: "pending_publish",
      reason
    });
  }

  private async uploadWechatImages(
    wechatDrafts: WechatDraftClient,
    images: ArticleImage[]
  ): Promise<WechatDraftUploadedImage[]> {
    const imageById = new Map(images.map((image) => [image.id, image]));
    const uploadedImages: WechatDraftUploadedImage[] = [];

    for (const imageUpload of toWechatDraftImageUploads(images)) {
      const uploaded = await wechatDrafts.uploadImage(imageUpload);
      const sourceImage = imageById.get(imageUpload.imageId);
      uploadedImages.push({
        imageId: imageUpload.imageId,
        mediaId: uploaded.mediaId,
        description: imageUpload.description,
        position: sourceImage?.position
      });
    }

    return uploadedImages;
  }
}

function normalizeRequiredMessage(message: string): string | undefined {
  const normalized = message.trim();
  return normalized ? normalized : undefined;
}

function formatWechatDraftExportContent(
  article: Article,
  draftId: string,
  uploadedImages: WechatDraftUploadedImage[]
): string {
  const uploadedSection = uploadedImages.length > 0
    ? uploadedImages.map((image) => `- ${image.description}：${image.mediaId}`).join("\n")
    : "- 无已上传图片素材";

  return [
    `微信草稿：${draftId}`,
    `标题：${article.title ?? ""}`,
    `摘要：${article.summary ?? ""}`,
    "图片素材：",
    uploadedSection
  ].join("\n");
}

function toWechatDraftImageChecklist(
  images: ArticleImage[],
  uploadedImages: WechatDraftUploadedImage[]
): Array<Record<string, string>> {
  const mediaIdByImageId = new Map(uploadedImages.map((image) => [image.imageId, image.mediaId]));
  return images.map((image) => withoutEmptyValues({
    id: image.id,
    type: image.type,
    description: image.description,
    position: image.position,
    url: image.url,
    source: image.source,
    altText: image.altText,
    mediaId: mediaIdByImageId.get(image.id)
  }));
}

function withoutEmptyValues(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
  );
}
