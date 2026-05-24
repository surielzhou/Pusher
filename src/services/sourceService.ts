import type {
  ArticleSource,
  ArticleSourceRepository,
  SourceCredibility
} from "../domain/source.ts";
import { isSourceCredibility } from "../domain/source.ts";
import type { ArticleRepository } from "../repositories/types.ts";

export interface SaveSourceInput {
  title: string;
  url?: string;
  provider?: string;
  citationSummary: string;
  credibility: SourceCredibility;
}

export class SourceArticleNotFoundError extends Error {
  readonly articleId: string;

  constructor(articleId: string) {
    super(`Article not found: ${articleId}`);
    this.name = "SourceArticleNotFoundError";
    this.articleId = articleId;
  }
}

export class SourceNotFoundError extends Error {
  readonly sourceId: string;
  readonly articleId: string;

  constructor(articleId: string, sourceId: string) {
    super(`Source not found for article ${articleId}: ${sourceId}`);
    this.name = "SourceNotFoundError";
    this.articleId = articleId;
    this.sourceId = sourceId;
  }
}

export class SourceValidationError extends Error {
  readonly field: "title" | "citationSummary" | "credibility";

  constructor(field: "title" | "citationSummary" | "credibility", message: string) {
    super(message);
    this.name = "SourceValidationError";
    this.field = field;
  }
}

export interface SourceServiceDependencies {
  articles: Pick<ArticleRepository, "getById">;
  sources: ArticleSourceRepository;
}

export class SourceServiceImpl {
  private readonly articles: Pick<ArticleRepository, "getById">;
  private readonly sources: ArticleSourceRepository;

  constructor(dependencies: SourceServiceDependencies) {
    this.articles = dependencies.articles;
    this.sources = dependencies.sources;
  }

  async saveSource(articleId: string, input: SaveSourceInput): Promise<ArticleSource> {
    await this.assertArticleExists(articleId);
    const normalized = normalizeSaveSourceInput(input);

    return this.sources.create({
      articleId,
      ...normalized
    });
  }

  async listSources(articleId: string): Promise<ArticleSource[]> {
    await this.assertArticleExists(articleId);
    return this.sources.listByArticleId(articleId);
  }

  async markSourceUsed(articleId: string, sourceId: string, usedInBody: boolean): Promise<ArticleSource> {
    await this.assertArticleExists(articleId);
    const source = await this.sources.getById(sourceId);

    if (!source || source.articleId !== articleId) {
      throw new SourceNotFoundError(articleId, sourceId);
    }

    return this.sources.update(sourceId, {
      usageStatus: usedInBody ? "used" : "unused"
    });
  }

  private async assertArticleExists(articleId: string): Promise<void> {
    const article = await this.articles.getById(articleId);
    if (!article) {
      throw new SourceArticleNotFoundError(articleId);
    }
  }
}

export class RepositorySourceService extends SourceServiceImpl {}

function normalizeSaveSourceInput(input: SaveSourceInput): SaveSourceInput {
  const title = normalizeRequiredText(input.title, "title");
  const citationSummary = normalizeRequiredText(input.citationSummary, "citationSummary");

  if (!isSourceCredibility(input.credibility)) {
    throw new SourceValidationError("credibility", "Source credibility is required");
  }

  return {
    title,
    url: normalizeOptionalText(input.url),
    provider: normalizeOptionalText(input.provider),
    citationSummary,
    credibility: input.credibility
  };
}

function normalizeRequiredText(
  value: string | undefined,
  field: "title" | "citationSummary"
): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new SourceValidationError(field, `Source ${field} is required`);
  }

  return trimmed;
}

function normalizeOptionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
