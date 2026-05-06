import type { PublishRecord } from "../domain/publish.ts";
import {
  clonePublish,
  createMemoryStore,
  createSequentialIdFactory,
  systemClock,
  type MemoryRepositoryStore
} from "./memoryStore.ts";
import { RepositoryError } from "./types.ts";
import type {
  CreatePublishRecordInput,
  PublishRepository,
  RepositoryClock,
  RepositoryIdFactory,
  UpdatePublishRecordInput
} from "./types.ts";

interface PublishRepositoryDeps {
  store: MemoryRepositoryStore;
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

export function createPublishRepository(deps: PublishRepositoryDeps): PublishRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();

  const repository = {
    async create(input: CreatePublishRecordInput): Promise<PublishRecord> {
      const record: PublishRecord = {
        id: createId("publish"),
        articleId: input.articleId,
        articleVersion: input.articleVersion,
        channel: input.channel,
        status: input.status,
        exportContent: input.exportContent,
        imageChecklist: input.imageChecklist?.map((item) => ({ ...item })),
        errorMessage: input.errorMessage,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : undefined,
        createdAt: now()
      };

      deps.store.publishes.set(record.id, clonePublish(record));
      return clonePublish(record);
    },

    async getById(publishRecordId: string): Promise<PublishRecord | undefined> {
      const record = deps.store.publishes.get(publishRecordId);
      return record ? clonePublish(record) : undefined;
    },

    async listByArticleId(articleId: string): Promise<PublishRecord[]> {
      return [...deps.store.publishes.values()]
        .filter((record) => record.articleId === articleId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(clonePublish);
    },

    async latestByArticleId(articleId: string): Promise<PublishRecord | undefined> {
      return (await repository.listByArticleId(articleId)).at(-1);
    },

    async getLatestByArticleId(articleId: string): Promise<PublishRecord | undefined> {
      return repository.latestByArticleId(articleId);
    },

    async findLatestByArticleId(articleId: string): Promise<PublishRecord | undefined> {
      return repository.latestByArticleId(articleId);
    },

    async update(publishRecordId: string, input: UpdatePublishRecordInput): Promise<PublishRecord> {
      const existing = deps.store.publishes.get(publishRecordId);
      if (!existing) {
        throw new RepositoryError("not_found", `Publish record not found: ${publishRecordId}`);
      }

      const updated: PublishRecord = {
        ...existing,
        ...input,
        imageChecklist: input.imageChecklist
          ? input.imageChecklist.map((item) => ({ ...item }))
          : existing.imageChecklist,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : existing.publishedAt
      };

      deps.store.publishes.set(publishRecordId, clonePublish(updated));
      return clonePublish(updated);
    }
  };

  return repository;
}

export class InMemoryPublishRepository implements PublishRepository {
  private readonly repository: PublishRepository;

  constructor(
    store: MemoryRepositoryStore = createMemoryStore(),
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory()
  ) {
    this.repository = createPublishRepository({ store, now, createId });
  }

  create(input: CreatePublishRecordInput): Promise<PublishRecord> {
    return this.repository.create(input);
  }

  getById(publishRecordId: string): Promise<PublishRecord | undefined> {
    return this.repository.getById(publishRecordId);
  }

  listByArticleId(articleId: string): Promise<PublishRecord[]> {
    return this.repository.listByArticleId(articleId);
  }

  latestByArticleId(articleId: string): Promise<PublishRecord | undefined> {
    return this.repository.latestByArticleId(articleId);
  }

  getLatestByArticleId(articleId: string): Promise<PublishRecord | undefined> {
    return this.repository.getLatestByArticleId(articleId);
  }

  findLatestByArticleId(articleId: string): Promise<PublishRecord | undefined> {
    return this.repository.findLatestByArticleId(articleId);
  }

  update(publishRecordId: string, input: UpdatePublishRecordInput): Promise<PublishRecord> {
    return this.repository.update(publishRecordId, input);
  }
}
