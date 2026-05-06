import type { ArticleStatusEvent } from "../domain/article.ts";
import {
  cloneAuditLog,
  cloneStatusEvent,
  createMemoryStore,
  createSequentialIdFactory,
  systemClock,
  type MemoryRepositoryStore
} from "./memoryStore.ts";
import type {
  AuditLogRecord,
  AuditLogRepository,
  CreateArticleStatusEventInput,
  CreateAuditLogInput,
  RepositoryClock,
  RepositoryIdFactory
} from "./types.ts";

interface AuditLogRepositoryDeps {
  store: MemoryRepositoryStore;
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

export function createAuditLogRepository(deps: AuditLogRepositoryDeps): AuditLogRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();

  const repository = {
    async create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
      const record: AuditLogRecord = {
        id: createId("audit"),
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        message: input.message,
        metadata: input.metadata ? { ...input.metadata } : undefined,
        createdAt: now()
      };

      deps.store.auditLogs.set(record.id, cloneAuditLog(record));
      return cloneAuditLog(record);
    },

    async listByEntity(entityType: string, entityId: string): Promise<AuditLogRecord[]> {
      return [...deps.store.auditLogs.values()]
        .filter((record) => record.entityType === entityType && record.entityId === entityId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(cloneAuditLog);
    },

    async createStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent> {
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

    async listStatusEventsByArticleId(articleId: string): Promise<ArticleStatusEvent[]> {
      return [...deps.store.statusEvents.values()]
        .filter((event) => event.articleId === articleId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(cloneStatusEvent);
    },

    async latestStatusEventByArticleId(articleId: string): Promise<ArticleStatusEvent | undefined> {
      return (await repository.listStatusEventsByArticleId(articleId)).at(-1);
    }
  };

  return repository;
}

export class InMemoryAuditLogRepository implements AuditLogRepository {
  private readonly repository: AuditLogRepository;

  constructor(
    store: MemoryRepositoryStore = createMemoryStore(),
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory()
  ) {
    this.repository = createAuditLogRepository({ store, now, createId });
  }

  create(input: CreateAuditLogInput): Promise<AuditLogRecord> {
    return this.repository.create(input);
  }

  listByEntity(entityType: string, entityId: string): Promise<AuditLogRecord[]> {
    return this.repository.listByEntity(entityType, entityId);
  }

  createStatusEvent(input: CreateArticleStatusEventInput): Promise<ArticleStatusEvent> {
    return this.repository.createStatusEvent(input);
  }

  listStatusEventsByArticleId(articleId: string): Promise<ArticleStatusEvent[]> {
    return this.repository.listStatusEventsByArticleId(articleId);
  }

  latestStatusEventByArticleId(articleId: string): Promise<ArticleStatusEvent | undefined> {
    return this.repository.latestStatusEventByArticleId(articleId);
  }
}
