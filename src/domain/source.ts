export const SOURCE_CREDIBILITY_LEVELS = ["high", "medium", "low"] as const;
export type SourceCredibility = (typeof SOURCE_CREDIBILITY_LEVELS)[number];

export const SOURCE_USAGE_STATUSES = ["unused", "used"] as const;
export type SourceUsageStatus = (typeof SOURCE_USAGE_STATUSES)[number];

export interface ArticleSource {
  id: string;
  articleId: string;
  title: string;
  url?: string;
  provider?: string;
  citationSummary: string;
  credibility: SourceCredibility;
  usageStatus: SourceUsageStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateArticleSourceInput {
  articleId: string;
  title: string;
  url?: string;
  provider?: string;
  citationSummary: string;
  credibility: SourceCredibility;
}

export interface UpdateArticleSourceInput {
  title?: string;
  url?: string;
  provider?: string;
  citationSummary?: string;
  credibility?: SourceCredibility;
  usageStatus?: SourceUsageStatus;
}

export interface ArticleSourceRepository {
  create(input: CreateArticleSourceInput): Promise<ArticleSource>;
  getById(sourceId: string): Promise<ArticleSource | undefined>;
  listByArticleId(articleId: string): Promise<ArticleSource[]>;
  update(sourceId: string, input: UpdateArticleSourceInput): Promise<ArticleSource>;
}

export function isSourceCredibility(value: unknown): value is SourceCredibility {
  return typeof value === "string" && (SOURCE_CREDIBILITY_LEVELS as readonly string[]).includes(value);
}

export function cloneArticleSource(source: ArticleSource): ArticleSource {
  return {
    ...source,
    createdAt: new Date(source.createdAt),
    updatedAt: new Date(source.updatedAt)
  };
}
