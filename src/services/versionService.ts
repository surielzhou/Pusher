import type { Article } from "../domain/article.ts";
import type { ArticleImage } from "../domain/image.ts";
import type {
  ArticleVersionDiff,
  ArticleVersionFieldDiff,
  ArticleVersionImageSnapshot,
  ArticleVersionImageUpdate,
  ArticleVersionSnapshot,
  VersionedArticleTextField,
  VersionedImageField
} from "../domain/version.ts";
import type { ArticleRepository } from "../repositories/articleRepository.ts";
import type { ImageRepository } from "../repositories/imageRepository.ts";
import type { VersionRepository } from "../repositories/versionRepository.ts";

const textFields: VersionedArticleTextField[] = ["title", "summary", "body"];
const imageFields: VersionedImageField[] = ["type", "url", "description", "source", "position", "altText"];

export class VersionArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "VersionArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class VersionSnapshotNotFoundError extends Error {
  readonly versionId: string;

  constructor(versionId: string) {
    super(`Article version snapshot not found: ${versionId}`);
    this.name = "VersionSnapshotNotFoundError";
    this.versionId = versionId;
  }
}

export interface VersionServiceDependencies {
  articles: Pick<ArticleRepository, "getById">;
  images: Pick<ImageRepository, "listByArticleId">;
  versions: VersionRepository;
}

export class VersionServiceImpl {
  private readonly articles: Pick<ArticleRepository, "getById">;
  private readonly images: Pick<ImageRepository, "listByArticleId">;
  private readonly versions: VersionRepository;

  constructor(dependencies: VersionServiceDependencies) {
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.versions = dependencies.versions;
  }

  async captureArticleVersion(input: {
    articleId: string;
    label?: string;
    reason?: string;
  }): Promise<ArticleVersionSnapshot> {
    const article = await this.getExistingArticle(input.articleId);
    const images = await this.images.listByArticleId(input.articleId);

    return this.versions.create({
      articleId: article.id,
      contentVersion: article.contentVersion,
      status: article.status,
      title: article.title,
      summary: article.summary,
      body: article.body,
      riskNote: article.riskNote,
      reviewedVersion: article.reviewedVersion,
      publishedVersion: article.publishedVersion,
      images: images.map(toVersionImageSnapshot),
      label: input.label,
      reason: input.reason
    });
  }

  async listArticleVersions(articleId: string): Promise<{ items: ArticleVersionSnapshot[] }> {
    await this.getExistingArticle(articleId);
    return {
      items: await this.versions.listByArticleId(articleId)
    };
  }

  async compareArticleVersions(input: {
    articleId: string;
    fromVersionId: string;
    toVersionId: string;
  }): Promise<ArticleVersionDiff> {
    const from = await this.getExistingSnapshot(input.fromVersionId, input.articleId);
    const to = await this.getExistingSnapshot(input.toVersionId, input.articleId);
    const fields = buildFieldDiffs(from, to);
    const images = buildImageDiffs(from.images, to.images);
    const hasFieldChanges = textFields.some((field) => fields[field].changed);

    return {
      articleId: input.articleId,
      from,
      to,
      fields,
      images,
      hasChanges:
        hasFieldChanges ||
        images.added.length > 0 ||
        images.removed.length > 0 ||
        images.updated.length > 0
    };
  }

  private async getExistingArticle(articleId: string): Promise<Article> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new VersionArticleNotFoundError(articleId);
    }

    return article;
  }

  private async getExistingSnapshot(versionId: string, articleId: string): Promise<ArticleVersionSnapshot> {
    const snapshot = await this.versions.getById(versionId);
    if (!snapshot || snapshot.articleId !== articleId) {
      throw new VersionSnapshotNotFoundError(versionId);
    }

    return snapshot;
  }
}

function toVersionImageSnapshot(image: ArticleImage): ArticleVersionImageSnapshot {
  return {
    id: image.id,
    type: image.type,
    url: image.url,
    description: image.description,
    source: image.source,
    position: image.position,
    altText: image.altText
  };
}

function buildFieldDiffs(
  from: ArticleVersionSnapshot,
  to: ArticleVersionSnapshot
): Record<VersionedArticleTextField, ArticleVersionFieldDiff> {
  return {
    title: buildFieldDiff("title", from.title, to.title),
    summary: buildFieldDiff("summary", from.summary, to.summary),
    body: buildFieldDiff("body", from.body, to.body)
  };
}

function buildFieldDiff(
  field: VersionedArticleTextField,
  before: string | undefined,
  after: string | undefined
): ArticleVersionFieldDiff {
  return {
    field,
    before,
    after,
    changed: before !== after
  };
}

function buildImageDiffs(
  beforeImages: ArticleVersionImageSnapshot[],
  afterImages: ArticleVersionImageSnapshot[]
) {
  const beforeById = new Map(beforeImages.map((image) => [image.id, image]));
  const afterById = new Map(afterImages.map((image) => [image.id, image]));
  const added = afterImages.filter((image) => !beforeById.has(image.id));
  const removed = beforeImages.filter((image) => !afterById.has(image.id));
  const updated: ArticleVersionImageUpdate[] = [];

  for (const before of beforeImages) {
    const after = afterById.get(before.id);
    if (!after) continue;

    const changedFields = imageFields.filter((field) => before[field] !== after[field]);
    if (changedFields.length > 0) {
      updated.push({
        id: before.id,
        before,
        after,
        changedFields
      });
    }
  }

  return { added, removed, updated };
}
