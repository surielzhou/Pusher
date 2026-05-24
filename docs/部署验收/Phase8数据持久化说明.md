# Phase 8 数据持久化说明

## 范围

本阶段为现有内存仓库补充本地 JSON 快照能力，覆盖文章、图片、审核、发布准备、状态事件和审计日志数据。实现位于：

- `src/repositories/fileStore.ts`：可替换的 JSON 文件快照 store。
- `src/repositories/persistence.ts`：内存仓库快照导出、导入、单篇文章包导出、demo seed 生成。
- `scripts/seed-demo-data.mjs`：生成本地 demo seed 文件。

## 快照内容

完整仓库快照使用 `schemaVersion: 1`，包含：

- `articles`
- `images`
- `reviews`
- `publishes`
- `statusEvents`
- `auditLogs`
- `exportedAt`

所有 `Date` 字段写入 JSON 时统一转为 ISO 字符串；导入后恢复为 `Date` 对象，继续交给现有 repository 和 service 使用。

## 基本用法

生成 demo seed：

```bash
node --experimental-strip-types scripts/seed-demo-data.mjs
```

默认输出到系统临时目录。指定输出路径：

```bash
node --experimental-strip-types scripts/seed-demo-data.mjs --output /tmp/pusher-demo-seed.json
```

在代码中加载本地快照：

```ts
import { createJsonFileStore } from "./src/repositories/fileStore.ts";
import { createRepositoryIdFactory, loadRepositoryStore } from "./src/repositories/persistence.ts";
import { createArticleRepository } from "./src/repositories/articleRepository.ts";

const snapshotStore = createJsonFileStore("/tmp/pusher-demo-seed.json");
const store = await loadRepositoryStore(snapshotStore);
const createId = createRepositoryIdFactory(store);
const articles = createArticleRepository({ store, createId });
```

`createRepositoryIdFactory` 会扫描已导入数据中的数字 ID 后缀，避免恢复后新增记录覆盖旧记录。

## 导出单篇文章包

`exportArticleBundle(store, articleId)` 会导出指定文章及其图片、审核记录、发布记录、状态事件和文章审计日志。这个结构适合运营交接、问题排查和人工备份，不改变完整仓库快照格式。

## 备份与恢复

建议将快照文件放在仓库外或已忽略的本地数据目录中。备份时复制 JSON 文件即可；恢复时使用 `loadRepositoryStore` 加载快照，再用现有 repository 构造函数接入业务服务。

如果快照文件不存在，`loadRepositoryStore` 会返回空的内存仓库。若 JSON 格式错误，`createJsonFileStore` 会抛出 `FileStoreError`；若 schema 版本不支持，导入流程会抛出 `PersistenceError`。

## 后续替换数据库

业务层依赖的是 repository 和 `SnapshotStore` 边界，不依赖 JSON 文件实现。后续切换 SQLite 或 PostgreSQL 时，可保留 `RepositoryPersistenceSnapshot` 作为迁移格式，也可以实现新的持久化 adapter 后逐步替换 `createJsonFileStore`。

## 验收命令

```bash
node --test --experimental-strip-types tests/integration/persistence.test.ts
node --experimental-strip-types scripts/seed-demo-data.mjs --output /tmp/pusher-demo-seed.json
npm run typecheck
npm test
```
