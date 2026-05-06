import type { Article, ArticleDetail, GenerationConfig } from "../domain/article.ts";
import { CONTENT_CATEGORIES, type ContentCategory } from "../domain/status.ts";
import type {
  ArticleRepository,
  ImageRepository,
  PublishRepository,
  ReviewRepository
} from "../repositories/types.ts";
import type {
  ArticleListQuery,
  ArticleService,
  CreateArticleInput
} from "./contracts.ts";

export class ArticleInputError extends Error {
  readonly field: "category" | "topic";

  constructor(field: "category" | "topic", message: string) {
    super(message);
    this.name = "ArticleInputError";
    this.field = field;
  }
}

export class ArticleServiceNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "ArticleServiceNotFoundError";
    this.articleId = articleId;
  }
}

export interface ArticleServiceDependencies {
  articles: ArticleRepository;
  images: Pick<ImageRepository, "listByArticleId">;
  reviews: Pick<ReviewRepository, "latestByArticleId">;
  publishes: Pick<PublishRepository, "latestByArticleId">;
}

export class ArticleServiceImpl implements ArticleService {
  private readonly articles: ArticleRepository;
  private readonly images: Pick<ImageRepository, "listByArticleId">;
  private readonly reviews: Pick<ReviewRepository, "latestByArticleId">;
  private readonly publishes: Pick<PublishRepository, "latestByArticleId">;

  constructor(dependencies: ArticleServiceDependencies) {
    this.articles = dependencies.articles;
    this.images = dependencies.images;
    this.reviews = dependencies.reviews;
    this.publishes = dependencies.publishes;
  }

  async createArticle(input: CreateArticleInput): Promise<{ articleId: string; status: "drafting" }> {
    const category = assertContentCategory(input.category);
    const topic = input.topic?.trim();

    if (!topic) {
      throw new ArticleInputError("topic", "Article topic is required");
    }

    const article = await this.articles.create({
      category,
      status: "drafting",
      generationConfig: buildGenerationConfig(input, category, topic)
    });

    await this.articles.recordStatusEvent({
      articleId: article.id,
      toStatus: article.status,
      reason: "create article"
    });

    return { articleId: article.id, status: "drafting" };
  }

  async getArticleDetail(articleId: string): Promise<ArticleDetail> {
    const article = await this.articles.getById(articleId);

    if (!article) {
      throw new ArticleServiceNotFoundError(articleId);
    }

    return this.buildDetail(article);
  }

  async listArticles(query: ArticleListQuery = {}): Promise<{ items: ArticleDetail[]; total: number }> {
    const result = await this.articles.list(query);
    const items = await Promise.all(result.items.map((article) => this.buildDetail(article)));

    return {
      items,
      total: result.total
    };
  }

  private async buildDetail(article: Article): Promise<ArticleDetail> {
    const [images, latestReview, latestPublish] = await Promise.all([
      this.images.listByArticleId(article.id),
      this.reviews.latestByArticleId(article.id),
      this.publishes.latestByArticleId(article.id)
    ]);

    return {
      article,
      images,
      ...(latestReview ? { latestReview } : {}),
      ...(latestPublish ? { latestPublish } : {})
    };
  }
}

export class RepositoryArticleService extends ArticleServiceImpl {}

function assertContentCategory(value: unknown): ContentCategory {
  if (!isContentCategory(value)) {
    throw new ArticleInputError("category", "Article category is required");
  }

  return value;
}

function isContentCategory(value: unknown): value is ContentCategory {
  return typeof value === "string" && (CONTENT_CATEGORIES as readonly string[]).includes(value);
}

function buildGenerationConfig(
  input: CreateArticleInput,
  category: ContentCategory,
  topic: string
): GenerationConfig {
  return {
    category,
    topic,
    audience: normalizeOptionalText(input.audience),
    style: normalizeOptionalText(input.style),
    length: normalizeOptionalText(input.length),
    references: input.references ? [...input.references] : undefined,
    requireRiskNote: category === "finance"
  };
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
