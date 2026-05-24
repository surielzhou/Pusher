import type {
  ArticleSource,
  ArticleSourceRepository,
  CreateArticleSourceInput,
  UpdateArticleSourceInput
} from "../../domain/source.ts";
import { cloneArticleSource } from "../../domain/source.ts";
import {
  createSequentialIdFactory,
  systemClock
} from "../../repositories/memoryStore.ts";
import { RepositoryError } from "../../repositories/types.ts";
import type {
  RepositoryClock,
  RepositoryIdFactory
} from "../../repositories/types.ts";

interface MemorySourceRepositoryDeps {
  seed?: ArticleSource[];
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

export function createMemorySourceRepository(
  deps: MemorySourceRepositoryDeps = {}
): ArticleSourceRepository {
  const records = new Map((deps.seed ?? []).map((source) => [source.id, cloneArticleSource(source)]));
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();

  return {
    async create(input: CreateArticleSourceInput): Promise<ArticleSource> {
      const timestamp = now();
      const source: ArticleSource = {
        id: createId("source"),
        articleId: input.articleId,
        title: input.title,
        url: input.url,
        provider: input.provider,
        citationSummary: input.citationSummary,
        credibility: input.credibility,
        usageStatus: "unused",
        createdAt: timestamp,
        updatedAt: timestamp
      };

      records.set(source.id, cloneArticleSource(source));
      return cloneArticleSource(source);
    },

    async getById(sourceId: string): Promise<ArticleSource | undefined> {
      const source = records.get(sourceId);
      return source ? cloneArticleSource(source) : undefined;
    },

    async listByArticleId(articleId: string): Promise<ArticleSource[]> {
      return [...records.values()]
        .filter((source) => source.articleId === articleId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(cloneArticleSource);
    },

    async update(sourceId: string, input: UpdateArticleSourceInput): Promise<ArticleSource> {
      const existing = records.get(sourceId);
      if (!existing) {
        throw new RepositoryError("not_found", `Source not found: ${sourceId}`);
      }

      const updated: ArticleSource = {
        ...existing,
        ...input,
        updatedAt: now()
      };

      records.set(sourceId, cloneArticleSource(updated));
      return cloneArticleSource(updated);
    }
  };
}

export class InMemorySourceRepository implements ArticleSourceRepository {
  private readonly repository: ArticleSourceRepository;

  constructor(
    seed: ArticleSource[] = [],
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory()
  ) {
    this.repository = createMemorySourceRepository({ seed, now, createId });
  }

  create(input: CreateArticleSourceInput): Promise<ArticleSource> {
    return this.repository.create(input);
  }

  getById(sourceId: string): Promise<ArticleSource | undefined> {
    return this.repository.getById(sourceId);
  }

  listByArticleId(articleId: string): Promise<ArticleSource[]> {
    return this.repository.listByArticleId(articleId);
  }

  update(sourceId: string, input: UpdateArticleSourceInput): Promise<ArticleSource> {
    return this.repository.update(sourceId, input);
  }
}
