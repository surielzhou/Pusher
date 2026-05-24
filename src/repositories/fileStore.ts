interface FileSystemPromises {
  mkdir(path: string, options: { recursive: true }): Promise<void>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options: { force: true }): Promise<void>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
}

declare const process: {
  getBuiltinModule?(name: "node:fs/promises"): FileSystemPromises | undefined;
};

export interface SnapshotStore<TSnapshot> {
  readonly path: string;
  load(): Promise<TSnapshot | undefined>;
  save(snapshot: TSnapshot): Promise<void>;
  clear(): Promise<void>;
}

export type FileStoreErrorCode = "file_system_unavailable" | "invalid_json";

export class FileStoreError extends Error {
  readonly code: FileStoreErrorCode;

  constructor(code: FileStoreErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "FileStoreError";
  }
}

export function createJsonFileStore<TSnapshot>(filePath: string): SnapshotStore<TSnapshot> {
  const fs = getFileSystem();

  return {
    path: filePath,

    async load(): Promise<TSnapshot | undefined> {
      let content: string;

      try {
        content = await fs.readFile(filePath, "utf8");
      } catch (error) {
        if (isNodeError(error, "ENOENT")) {
          return undefined;
        }

        throw error;
      }

      try {
        return JSON.parse(content) as TSnapshot;
      } catch (error) {
        throw new FileStoreError("invalid_json", `Invalid JSON in persistence file: ${filePath}`);
      }
    },

    async save(snapshot: TSnapshot): Promise<void> {
      const directory = getDirectory(filePath);
      if (directory) {
        await fs.mkdir(directory, { recursive: true });
      }

      const tempPath = `${filePath}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
      const content = `${JSON.stringify(snapshot, null, 2)}\n`;

      try {
        await fs.writeFile(tempPath, content, "utf8");
        await fs.rename(tempPath, filePath);
      } catch (error) {
        await fs.rm(tempPath, { force: true });
        throw error;
      }
    },

    async clear(): Promise<void> {
      await fs.rm(filePath, { force: true });
    }
  };
}

function getFileSystem(): FileSystemPromises {
  const fs = process.getBuiltinModule?.("node:fs/promises");
  if (!fs) {
    throw new FileStoreError("file_system_unavailable", "Node file system module is unavailable");
  }

  return fs;
}

function getDirectory(filePath: string): string | undefined {
  const normalized = filePath.replace(/\\/g, "/");
  const lastSeparator = normalized.lastIndexOf("/");

  if (lastSeparator < 0) return undefined;
  if (lastSeparator === 0) return filePath.slice(0, 1);

  return filePath.slice(0, lastSeparator);
}

function isNodeError(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === code;
}
