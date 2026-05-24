import type { ArticleVersionSnapshot } from "../domain/version.ts";
import {
  createSequentialIdFactory,
  systemClock
} from "./memoryStore.ts";
import { RepositoryError } from "./types.ts";
import type { RepositoryClock, RepositoryIdFactory } from "./types.ts";

export interface CreateArticleVersionSnapshotInput {
  articleId: string;
  contentVersion: number;
  status: ArticleVersionSnapshot["status"];
  title?: string;
  summary?: string;
  body?: string;
  riskNote?: string;
  reviewedVersion?: number;
  publishedVersion?: number;
  images: ArticleVersionSnapshot["images"];
  label?: string;
  reason?: string;
}

export interface VersionRepository {
  create(input: CreateArticleVersionSnapshotInput): Promise<ArticleVersionSnapshot>;
  getById(versionId: string): Promise<ArticleVersionSnapshot | undefined>;
  listByArticleId(articleId: string): Promise<ArticleVersionSnapshot[]>;
}

export interface VersionRepositoryDeps {
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
  records?: Map<string, ArticleVersionSnapshot>;
}

export function createVersionRepository(deps: VersionRepositoryDeps = {}): VersionRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();
  const records = deps.records ?? new Map<string, ArticleVersionSnapshot>();

  return {
    async create(input) {
      assertValidVersionInput(input);

      const snapshot: ArticleVersionSnapshot = {
        id: createId("version"),
        articleId: input.articleId,
        contentVersion: input.contentVersion,
        status: input.status,
        title: input.title,
        summary: input.summary,
        body: input.body,
        riskNote: input.riskNote,
        reviewedVersion: input.reviewedVersion,
        publishedVersion: input.publishedVersion,
        images: input.images.map(cloneVersionImageSnapshot),
        label: input.label,
        reason: input.reason,
        createdAt: now()
      };

      records.set(snapshot.id, cloneArticleVersionSnapshot(snapshot));
      return cloneArticleVersionSnapshot(snapshot);
    },

    async getById(versionId) {
      const snapshot = records.get(versionId);
      return snapshot ? cloneArticleVersionSnapshot(snapshot) : undefined;
    },

    async listByArticleId(articleId) {
      return [...records.values()]
        .filter((snapshot) => snapshot.articleId === articleId)
        .sort((left, right) => {
          const versionOrder = left.contentVersion - right.contentVersion;
          if (versionOrder !== 0) return versionOrder;
          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map(cloneArticleVersionSnapshot);
    }
  };
}

export class InMemoryVersionRepository implements VersionRepository {
  private readonly repository: VersionRepository;

  constructor(
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory(),
    records: Map<string, ArticleVersionSnapshot> = new Map()
  ) {
    this.repository = createVersionRepository({ now, createId, records });
  }

  create(input: CreateArticleVersionSnapshotInput): Promise<ArticleVersionSnapshot> {
    return this.repository.create(input);
  }

  getById(versionId: string): Promise<ArticleVersionSnapshot | undefined> {
    return this.repository.getById(versionId);
  }

  listByArticleId(articleId: string): Promise<ArticleVersionSnapshot[]> {
    return this.repository.listByArticleId(articleId);
  }
}

export function cloneArticleVersionSnapshot(snapshot: ArticleVersionSnapshot): ArticleVersionSnapshot {
  return {
    ...snapshot,
    images: snapshot.images.map(cloneVersionImageSnapshot),
    createdAt: new Date(snapshot.createdAt)
  };
}

function cloneVersionImageSnapshot(
  image: ArticleVersionSnapshot["images"][number]
): ArticleVersionSnapshot["images"][number] {
  return { ...image };
}

function assertValidVersionInput(input: CreateArticleVersionSnapshotInput): void {
  if (!input.articleId.trim()) {
    throw new RepositoryError("invalid_input", "Article id is required");
  }

  if (!Number.isInteger(input.contentVersion) || input.contentVersion < 1) {
    throw new RepositoryError("invalid_input", "Content version must be a positive integer");
  }
}
