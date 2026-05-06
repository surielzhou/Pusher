import type { ArticleImage, ImageType } from "../domain/image.ts";
import {
  cloneImage,
  createMemoryStore,
  createSequentialIdFactory,
  systemClock,
  type MemoryRepositoryStore
} from "./memoryStore.ts";
import { RepositoryError } from "./types.ts";
import type {
  CreateArticleImageInput,
  ImageRepository,
  RepositoryClock,
  RepositoryIdFactory,
  UpdateArticleImageInput
} from "./types.ts";

export type {
  CreateArticleImageInput,
  ImageRepository,
  UpdateArticleImageInput
} from "./types.ts";

interface ImageRepositoryDeps {
  store: MemoryRepositoryStore;
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

export function createImageRepository(deps: ImageRepositoryDeps): ImageRepository {
  const now = deps.now ?? systemClock;
  const createId = deps.createId ?? createSequentialIdFactory();

  return {
    async create(input) {
      assertValidImageInput(input.type, input.description, input.url);
      const timestamp = now();
      const image: ArticleImage = {
        id: createId("image"),
        articleId: input.articleId,
        type: input.type,
        url: input.url,
        description: input.description,
        source: input.source,
        position: input.position,
        altText: input.altText,
        createdAt: timestamp,
        updatedAt: timestamp
      };

      deps.store.images.set(image.id, cloneImage(image));
      return cloneImage(image);
    },

    async getById(imageId) {
      const image = deps.store.images.get(imageId);
      return image ? cloneImage(image) : undefined;
    },

    async listByArticleId(articleId) {
      return [...deps.store.images.values()]
        .filter((image) => image.articleId === articleId)
        .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())
        .map(cloneImage);
    },

    async update(imageId, input) {
      const existing = deps.store.images.get(imageId);
      if (!existing) {
        throw new RepositoryError("not_found", `Image not found: ${imageId}`);
      }

      const updated: ArticleImage = {
        ...existing,
        ...input,
        updatedAt: now()
      };
      assertValidImageInput(updated.type, updated.description, updated.url);

      deps.store.images.set(imageId, cloneImage(updated));
      return cloneImage(updated);
    },

    async delete(imageId) {
      deps.store.images.delete(imageId);
    }
  };
}

export class InMemoryImageRepository implements ImageRepository {
  private readonly repository: ImageRepository;

  constructor(
    store: MemoryRepositoryStore = createMemoryStore(),
    now: RepositoryClock = systemClock,
    createId: RepositoryIdFactory = createSequentialIdFactory()
  ) {
    this.repository = createImageRepository({ store, now, createId });
  }

  create(input: CreateArticleImageInput): Promise<ArticleImage> {
    return this.repository.create(input);
  }

  getById(imageId: string): Promise<ArticleImage | undefined> {
    return this.repository.getById(imageId);
  }

  listByArticleId(articleId: string): Promise<ArticleImage[]> {
    return this.repository.listByArticleId(articleId);
  }

  update(imageId: string, input: UpdateArticleImageInput): Promise<ArticleImage> {
    return this.repository.update(imageId, input);
  }

  delete(imageId: string): Promise<void> {
    return this.repository.delete(imageId);
  }
}

function assertValidImageInput(type: ImageType, description?: string, url?: string): void {
  if (!description?.trim()) {
    throw new RepositoryError("invalid_input", "Image description is required");
  }

  if (type !== "suggestion" && !url?.trim()) {
    throw new RepositoryError("invalid_input", "Image url is required when type is not suggestion");
  }
}
