import type { Article, ArticleStatusEvent } from "../domain/article.ts";
import {
  cloneArticle,
  cloneStatusEvent,
  createMemoryStore,
  createSequentialIdFactory,
  systemClock,
  type MemoryRepositoryStore
} from "./memoryStore.ts";
import { RepositoryError } from "./types.ts";
import type {
  ArticleRepository,
  ArticleRepositoryQuery,
  CreateArticleRecordInput,
  CreateArticleStatusEventInput,
  RepositoryClock,
  RepositoryIdFactory,
  RepositoryListResult,
  UpdateArticleRecordInput
} from "./types.ts";

export type {
  ArticleRepository,
  ArticleRepositoryQuery,
  CreateArticleRecordInput,
  CreateArticleStatusEventInput,
  UpdateArticleRecordInput
} from "./types.ts";

interface ArticleRepositoryDeps {
  store: MemoryRepositoryStore;
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

export function createArticleRepository(deps: ArticleRepositoryDeps): ArticleRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();

  const repository = {
    async create(input: CreateArticleRecordInput): Promise<Article> {
      const timestamp = now();
      const article: Article = {
        id: createId("article"),
        title: input.title,
        summary: input.summary,
        body: input.body,
        category: input.category,
        status: input.status ?? "drafting",
        generationConfig: { ...input.generationConfig, references: input.generationConfig.references ? [...input.generationConfig.references] : undefined },
        riskNote: input.riskNote,
        contentVersion: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      deps.store.articles.set(article.id, cloneArticle(article));
      return cloneArticle(article);
    },

    async getById(articleId: string): Promise<Article | undefined> {
      const article = deps.store.articles.get(articleId);
      return article ? cloneArticle(article) : undefined;
    },

    async update(articleId: string, input: UpdateArticleRecordInput): Promise<Article> {
      const existing = deps.store.articles.get(articleId);
      if (!existing) {
        throw new RepositoryError("not_found", `Article not found: ${articleId}`);
      }

      const updated: Article = {
        ...existing,
        ...input,
        generationConfig: input.generationConfig
          ? { ...input.generationConfig, references: input.generationConfig.references ? [...input.generationConfig.references] : undefined }
          : existing.generationConfig,
        updatedAt: now()
      };

      deps.store.articles.set(articleId, cloneArticle(updated));
      return cloneArticle(updated);
    },

    async list(query: ArticleRepositoryQuery = {}): Promise<RepositoryListResult<Article>> {
      return listArticles([...deps.store.articles.values()], query);
    },

    async delete(articleId: string): Promise<void> {
      deps.store.articles.delete(articleId);
    },

    async addStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent> {
      return repository.recordStatusEvent(input);
    },

    async recordStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent> {
      const event: ArticleStatusEvent = {
        id: createId("status_event"),
        articleId: input.articleId,
        fromStatus: input.fromStatus,
        toStatus: input.toStatus,
        reason: input.reason,
        createdAt: now()
      };

      deps.store.statusEvents.set(event.id, cloneStatusEvent(event));
      return cloneStatusEvent(event);
    },

    async listStatusEvents(articleId: string): Promise<ArticleStatusEvent[]> {
      return [...deps.store.statusEvents.values()]
        .filter((event) => event.articleId === articleId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(cloneStatusEvent);
    }
  };

  return repository;
}

export class InMemoryArticleRepository implements ArticleRepository {
  private readonly repository: ArticleRepository;

  constructor(
    store: MemoryRepositoryStore = createMemoryStore(),
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory()
  ) {
    this.repository = createArticleRepository({ store, now, createId });
  }

  create(input: CreateArticleRecordInput): Promise<Article> {
    return this.repository.create(input);
  }

  getById(articleId: string): Promise<Article | undefined> {
    return this.repository.getById(articleId);
  }

  update(articleId: string, input: UpdateArticleRecordInput): Promise<Article> {
    return this.repository.update(articleId, input);
  }

  list(query?: ArticleRepositoryQuery): Promise<RepositoryListResult<Article>> {
    return this.repository.list(query);
  }

  delete(articleId: string): Promise<void> {
    return this.repository.delete(articleId);
  }

  addStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent> {
    return this.repository.addStatusEvent(input);
  }

  recordStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent> {
    return this.repository.recordStatusEvent(input);
  }

  listStatusEvents(articleId: string): Promise<ArticleStatusEvent[]> {
    return this.repository.listStatusEvents(articleId);
  }
}

function listArticles(articles: Article[], query: ArticleRepositoryQuery): RepositoryListResult<Article> {
  const page = query.page && query.page > 0 ? query.page : 1;
  const pageSize = query.pageSize && query.pageSize > 0 ? query.pageSize : 20;
  const keyword = query.keyword?.trim().toLowerCase();

  const filtered = articles.filter((article) => {
    if (query.category && article.category !== query.category) return false;
    if (query.status && article.status !== query.status) return false;
    if (!keyword) return true;

    return [article.title, article.summary, article.body, article.generationConfig.topic]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(keyword));
  });

  const sorted = filtered.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
  const start = (page - 1) * pageSize;

  return {
    items: sorted.slice(start, start + pageSize).map(cloneArticle),
    total: filtered.length,
    page,
    pageSize
  };
}
