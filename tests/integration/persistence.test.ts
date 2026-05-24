import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { createJsonFileStore } from "../../src/repositories/fileStore.ts";
import {
  createDemoRepositorySnapshot,
  createRepositoryIdFactory,
  exportArticleBundle,
  importRepositorySnapshot,
  loadRepositoryStore,
  saveRepositoryStore
} from "../../src/repositories/persistence.ts";
import {
  createArticleRepository,
  createAuditLogRepository,
  createImageRepository,
  createMemoryStore,
  createPublishRepository,
  createReviewRepository,
  createSequentialIdFactory
} from "../../src/repositories/index.ts";

const fixedExportDate = new Date("2026-05-06T08:30:00.000Z");

describe("repository persistence integration", () => {
  it("persists repository data to JSON and restores it as a usable memory store", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pusher-persistence-"));
    const snapshotPath = join(tempDir, "snapshot.json");

    try {
      const store = createMemoryStore();
      const createId = createSequentialIdFactory();
      const now = createSteppedClock();
      const articles = createArticleRepository({ store, createId, now });
      const images = createImageRepository({ store, createId, now });
      const reviews = createReviewRepository({ store, createId, now });
      const publishes = createPublishRepository({ store, createId, now });
      const audit = createAuditLogRepository({ store, createId, now });

      const article = await articles.create({
        category: "tech_internet",
        title: "AI Agent 运营观察",
        summary: "关注长期运营中的内容生产闭环。",
        body: "正文包含生成、审核、发布准备和复盘数据。",
        generationConfig: {
          category: "tech_internet",
          topic: "AI Agent 运营",
          audience: "产品与运营团队",
          references: ["https://example.com/source"],
          requireRiskNote: false
        },
        status: "pending_publish"
      });
      await articles.recordStatusEvent({
        articleId: article.id,
        toStatus: "drafting",
        reason: "seed article"
      });
      await images.create({
        articleId: article.id,
        type: "generated",
        description: "运营工作台数据看板封面",
        url: "https://example.com/cover.png",
        source: "ai-image",
        position: "cover",
        altText: "AI Agent 运营看板"
      });
      await reviews.create({
        articleId: article.id,
        articleVersion: article.contentVersion,
        result: "approved",
        comment: "内容完整，可以发布。",
        reviewChecklist: { titleChecked: true, imageChecked: true }
      });
      await publishes.create({
        articleId: article.id,
        articleVersion: article.contentVersion,
        channel: "wechat_manual",
        status: "prepared",
        exportContent: "# AI Agent 运营观察"
      });
      await audit.create({
        entityType: "article",
        entityId: article.id,
        action: "persistence.seed",
        message: "demo article persisted"
      });

      const fileStore = createJsonFileStore(snapshotPath);
      await saveRepositoryStore(store, fileStore, { exportedAt: fixedExportDate });

      const rawSnapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      assert.equal(rawSnapshot.schemaVersion, 1);
      assert.equal(rawSnapshot.exportedAt, fixedExportDate.toISOString());
      assert.equal(rawSnapshot.articles[0].createdAt, "2026-05-06T00:00:00.000Z");
      assert.equal(rawSnapshot.images.length, 1);
      assert.equal(rawSnapshot.reviews.length, 1);
      assert.equal(rawSnapshot.publishes.length, 1);
      assert.equal(rawSnapshot.statusEvents.length, 1);
      assert.equal(rawSnapshot.auditLogs.length, 1);

      const restoredStore = await loadRepositoryStore(fileStore);
      const restoredArticles = createArticleRepository({
        store: restoredStore,
        now: () => new Date("2026-05-06T00:10:00.000Z"),
        createId: createRepositoryIdFactory(restoredStore)
      });
      const restoredImages = createImageRepository({ store: restoredStore });
      const restoredReviews = createReviewRepository({ store: restoredStore });
      const restoredPublishes = createPublishRepository({ store: restoredStore });

      const restoredArticle = await restoredArticles.getById(article.id);
      assert.equal(restoredArticle?.createdAt instanceof Date, true);
      assert.equal(restoredArticle?.generationConfig.references?.[0], "https://example.com/source");
      assert.equal((await restoredImages.listByArticleId(article.id))[0]?.updatedAt instanceof Date, true);
      assert.equal((await restoredReviews.latestByArticleId(article.id))?.result, "approved");
      assert.equal((await restoredPublishes.latestByArticleId(article.id))?.status, "prepared");

      const nextArticle = await restoredArticles.create({
        category: "literature",
        title: "春日随笔",
        body: "新的本地持久化恢复后文章。",
        generationConfig: {
          category: "literature",
          topic: "春日",
          requireRiskNote: false
        }
      });
      assert.equal(nextArticle.id, "article_007");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("exports a complete article bundle and imports demo seed data through repositories", async () => {
    const seedSnapshot = createDemoRepositorySnapshot({ exportedAt: fixedExportDate });
    const seededStore = importRepositorySnapshot(seedSnapshot);
    const articles = createArticleRepository({ store: seededStore });

    const [demoArticle] = (await articles.list()).items;
    assert.ok(demoArticle);

    const bundle = exportArticleBundle(seededStore, demoArticle.id, { exportedAt: fixedExportDate });

    assert.equal(bundle.schemaVersion, 1);
    assert.equal(bundle.exportedAt, fixedExportDate.toISOString());
    assert.equal(bundle.article.id, demoArticle.id);
    assert.equal(bundle.article.createdAt, seedSnapshot.articles[0]?.createdAt);
    assert.equal(bundle.images.length, 1);
    assert.equal(bundle.reviews.length, 1);
    assert.equal(bundle.publishes.length, 1);
    assert.equal(bundle.statusEvents.length > 0, true);
    assert.equal(bundle.auditLogs.some((log) => log.action === "demo.seed"), true);
  });
});

function createSteppedClock() {
  let minutes = 0;

  return () => {
    const timestamp = new Date(Date.UTC(2026, 4, 6, 0, minutes, 0, 0));
    minutes += 1;
    return timestamp;
  };
}
