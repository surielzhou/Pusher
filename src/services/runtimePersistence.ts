import { createJsonFileStore } from "../repositories/fileStore.ts";
import { createMemoryStore, type MemoryRepositoryStore } from "../repositories/memoryStore.ts";
import {
  loadRepositoryStore,
  saveRepositoryStore,
  type RepositoryPersistenceSnapshot
} from "../repositories/persistence.ts";

declare const process: {
  env?: Record<string, string | undefined>;
};

export const DEFAULT_RUNTIME_SNAPSHOT_PATH = "data/pusher-runtime.json";
export const RUNTIME_SNAPSHOT_PATH_ENV = "PUSHER_RUNTIME_SNAPSHOT_PATH";

export interface RuntimePersistence {
  readonly snapshotPath?: string;
  loadStore(): Promise<MemoryRepositoryStore>;
  saveStore(store: MemoryRepositoryStore): Promise<void>;
}

export interface FileRuntimePersistenceOptions {
  snapshotPath?: string;
}

export function resolveRuntimeSnapshotPath(input?: string): string {
  const configured = input?.trim() || process.env?.[RUNTIME_SNAPSHOT_PATH_ENV]?.trim();
  return configured || DEFAULT_RUNTIME_SNAPSHOT_PATH;
}

export function createNoopRuntimePersistence(): RuntimePersistence {
  return {
    async loadStore(): Promise<MemoryRepositoryStore> {
      return createMemoryStore();
    },

    async saveStore(): Promise<void> {
      return undefined;
    }
  };
}

export function createFileRuntimePersistence(input?: string | FileRuntimePersistenceOptions): RuntimePersistence {
  const snapshotPath = resolveRuntimeSnapshotPath(typeof input === "string" ? input : input?.snapshotPath);
  const fileStore = createJsonFileStore<RepositoryPersistenceSnapshot>(snapshotPath);

  return {
    snapshotPath,

    async loadStore(): Promise<MemoryRepositoryStore> {
      return loadRepositoryStore(fileStore);
    },

    async saveStore(store: MemoryRepositoryStore): Promise<void> {
      await saveRepositoryStore(store, fileStore);
    }
  };
}
