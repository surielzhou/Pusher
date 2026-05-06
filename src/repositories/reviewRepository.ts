import type { ReviewRecord } from "../domain/review.ts";
import {
  cloneReview,
  createMemoryStore,
  createSequentialIdFactory,
  systemClock,
  type MemoryRepositoryStore
} from "./memoryStore.ts";
import { RepositoryError } from "./types.ts";
import type {
  CreateReviewRecordInput,
  RepositoryClock,
  RepositoryIdFactory,
  ReviewRepository
} from "./types.ts";

interface ReviewRepositoryDeps {
  store: MemoryRepositoryStore;
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

export function createReviewRepository(deps: ReviewRepositoryDeps): ReviewRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();

  const repository = {
    async create(input: CreateReviewRecordInput): Promise<ReviewRecord> {
      if (input.result === "rejected" && !input.comment?.trim()) {
        throw new RepositoryError("invalid_input", "Rejected review requires a comment");
      }

      const review: ReviewRecord = {
        id: createId("review"),
        articleId: input.articleId,
        articleVersion: input.articleVersion,
        result: input.result,
        comment: input.comment,
        reviewChecklist: input.reviewChecklist ? { ...input.reviewChecklist } : undefined,
        reviewedAt: now()
      };

      deps.store.reviews.set(review.id, cloneReview(review));
      return cloneReview(review);
    },

    async listByArticleId(articleId: string): Promise<ReviewRecord[]> {
      return [...deps.store.reviews.values()]
        .filter((review) => review.articleId === articleId)
        .sort((left, right) => left.reviewedAt.getTime() - right.reviewedAt.getTime())
        .map(cloneReview);
    },

    async latestByArticleId(articleId: string): Promise<ReviewRecord | undefined> {
      return (await repository.listByArticleId(articleId)).at(-1);
    },

    async getLatestByArticleId(articleId: string): Promise<ReviewRecord | undefined> {
      return repository.latestByArticleId(articleId);
    },

    async findLatestByArticleId(articleId: string): Promise<ReviewRecord | undefined> {
      return repository.latestByArticleId(articleId);
    }
  };

  return repository;
}

export class InMemoryReviewRepository implements ReviewRepository {
  private readonly repository: ReviewRepository;

  constructor(
    store: MemoryRepositoryStore = createMemoryStore(),
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory()
  ) {
    this.repository = createReviewRepository({ store, now, createId });
  }

  create(input: CreateReviewRecordInput): Promise<ReviewRecord> {
    return this.repository.create(input);
  }

  listByArticleId(articleId: string): Promise<ReviewRecord[]> {
    return this.repository.listByArticleId(articleId);
  }

  latestByArticleId(articleId: string): Promise<ReviewRecord | undefined> {
    return this.repository.latestByArticleId(articleId);
  }

  getLatestByArticleId(articleId: string): Promise<ReviewRecord | undefined> {
    return this.repository.getLatestByArticleId(articleId);
  }

  findLatestByArticleId(articleId: string): Promise<ReviewRecord | undefined> {
    return this.repository.findLatestByArticleId(articleId);
  }
}
