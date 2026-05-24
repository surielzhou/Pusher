import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore,
  createSequentialIdFactory
} from "../../../src/repositories/index.ts";
import { InMemoryVersionRepository } from "../../../src/repositories/versionRepository.ts";
import {
  VersionArticleNotFoundError,
  VersionSnapshotNotFoundError,
  VersionServiceImpl
} from "../../../src/services/versionService.ts";

function createSteppedClock() {
  let tick = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 4, 6, 0, 0, tick));
    tick += 1;
    return value;
  };
}

function createHarness() {
  const store = createMemoryStore();
  const now = createSteppedClock();
  const createId = createSequentialIdFactory();
  const articles = new InMemoryArticleRepository(store, now, createId);
  const images = new InMemoryImageRepository(store, now, createId);
  const versions = new InMemoryVersionRepository(now, createId);
  const service = new VersionServiceImpl({ articles, images, versions });

  return { articles, images, service, versions };
}

describe("version service", () => {
  it("captures immutable article and image snapshots without changing contentVersion", async () => {
    const { articles, images, service } = createHarness();
    const article = await articles.create({
      category: "tech_internet",
      title: "AI Agent 入口",
      summary: "产品入口摘要",
      body: "第一版正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      },
      status: "editing"
    });
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "首图建议",
      position: "title_after",
      altText: "AI Agent 配图"
    });

    const snapshot = await service.captureArticleVersion({
      articleId: article.id,
      label: "review 前",
      reason: "submit review"
    });

    assert.equal(snapshot.id, "version_003");
    assert.equal(snapshot.articleId, article.id);
    assert.equal(snapshot.contentVersion, 1);
    assert.equal(snapshot.title, "AI Agent 入口");
    assert.equal(snapshot.images[0]?.description, "首图建议");
    assert.equal((await articles.getById(article.id))?.contentVersion, 1);

    snapshot.title = "外部误改";
    snapshot.images[0]!.description = "外部误改图片";

    const timeline = await service.listArticleVersions(article.id);

    assert.equal(timeline.items[0]?.title, "AI Agent 入口");
    assert.equal(timeline.items[0]?.images[0]?.description, "首图建议");
  });

  it("orders version timeline by contentVersion and snapshot time", async () => {
    const { articles, service } = createHarness();
    const article = await articles.create({
      category: "literature",
      title: "春日书房",
      body: "初稿",
      generationConfig: {
        category: "literature",
        topic: "春日散文",
        requireRiskNote: false
      },
      status: "editing"
    });

    await service.captureArticleVersion({ articleId: article.id, label: "初稿" });
    await articles.update(article.id, {
      title: "春日书房二稿",
      body: "二稿",
      contentVersion: 2
    });
    await service.captureArticleVersion({ articleId: article.id, label: "review 后" });

    const timeline = await service.listArticleVersions(article.id);

    assert.deepEqual(
      timeline.items.map((item) => [item.contentVersion, item.label]),
      [
        [1, "初稿"],
        [2, "review 后"]
      ]
    );
  });

  it("compares review-before and review-after text and image changes", async () => {
    const { articles, images, service } = createHarness();
    const article = await articles.create({
      category: "finance",
      title: "宏观周记",
      summary: "初版摘要",
      body: "初版正文",
      generationConfig: {
        category: "finance",
        topic: "宏观市场",
        requireRiskNote: true
      },
      riskNote: "本文不构成投资建议。",
      status: "editing"
    });
    const chart = await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "利率走势图建议",
      position: "summary_after"
    });
    const removed = await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "将被删除的旧图",
      position: "body_after"
    });
    const before = await service.captureArticleVersion({ articleId: article.id, label: "review 前" });

    await articles.update(article.id, {
      title: "宏观市场周记",
      summary: "review 后摘要",
      body: "review 后正文",
      contentVersion: 2,
      status: "approved",
      reviewedVersion: 2
    });
    await images.update(chart.id, {
      type: "generated",
      description: "利率走势图成图",
      url: "https://example.com/chart.png",
      source: "ai"
    });
    await images.delete(removed.id);
    const added = await images.create({
      articleId: article.id,
      type: "uploaded",
      description: "人工上传封面",
      url: "https://example.com/cover.png",
      source: "manual",
      position: "cover"
    });
    const after = await service.captureArticleVersion({ articleId: article.id, label: "review 后" });

    const diff = await service.compareArticleVersions({
      articleId: article.id,
      fromVersionId: before.id,
      toVersionId: after.id
    });

    assert.equal(diff.hasChanges, true);
    assert.deepEqual(diff.fields.title, {
      field: "title",
      before: "宏观周记",
      after: "宏观市场周记",
      changed: true
    });
    assert.deepEqual(diff.fields.summary, {
      field: "summary",
      before: "初版摘要",
      after: "review 后摘要",
      changed: true
    });
    assert.equal(diff.fields.body.changed, true);
    assert.deepEqual(diff.images.added.map((image) => image.id), [added.id]);
    assert.deepEqual(diff.images.removed.map((image) => image.id), [removed.id]);
    assert.deepEqual(diff.images.updated.map((change) => change.id), [chart.id]);
    assert.equal(diff.images.updated[0]?.before.description, "利率走势图建议");
    assert.equal(diff.images.updated[0]?.after.url, "https://example.com/chart.png");
  });

  it("throws structured errors for missing articles and snapshots", async () => {
    const { articles, service } = createHarness();
    const article = await articles.create({
      category: "tech_internet",
      title: "AI 工具",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI 工具",
        requireRiskNote: false
      }
    });
    const snapshot = await service.captureArticleVersion({ articleId: article.id });

    await assert.rejects(
      () => service.captureArticleVersion({ articleId: "missing" }),
      (error) => {
        assert.equal(error instanceof VersionArticleNotFoundError, true);
        assert.equal((error as VersionArticleNotFoundError).articleId, "missing");
        return true;
      }
    );

    await assert.rejects(
      () =>
        service.compareArticleVersions({
          articleId: article.id,
          fromVersionId: snapshot.id,
          toVersionId: "missing"
        }),
      (error) => {
        assert.equal(error instanceof VersionSnapshotNotFoundError, true);
        assert.equal((error as VersionSnapshotNotFoundError).versionId, "missing");
        return true;
      }
    );
  });
});
