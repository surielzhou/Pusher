import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createArticleRepository,
  createAuditLogRepository,
  createImageRepository,
  createMemoryStore,
  createPublishRepository,
  createReviewRepository,
  createSequentialIdFactory
} from "../../../src/repositories/index.ts";

describe("repository memory foundation", () => {
  it("creates isolated stores and deterministic ids", () => {
    const firstStore = createMemoryStore();
    const secondStore = createMemoryStore();
    const createId = createSequentialIdFactory();

    assert.notEqual(firstStore, secondStore);
    assert.equal(firstStore.articles.size, 0);
    assert.equal(secondStore.images.size, 0);
    assert.equal(createId("article"), "article_001");
    assert.equal(createId("image"), "image_002");
  });
});

const fixedDate = new Date("2026-05-06T00:00:00.000Z");
const fixedClock = () => fixedDate;

describe("article repository", () => {
  it("creates, updates, reads, lists, and deletes articles", async () => {
    const store = createMemoryStore();
    const articles = createArticleRepository({
      store,
      now: fixedClock,
      createId: createSequentialIdFactory()
    });

    const first = await articles.create({
      category: "finance",
      title: "市场观察",
      body: "正文",
      generationConfig: {
        category: "finance",
        topic: "市场观察",
        requireRiskNote: true
      }
    });

    const second = await articles.create({
      category: "tech_internet",
      title: "AI Agent",
      summary: "产品形态变化",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      },
      status: "editing"
    });

    assert.equal(first.id, "article_001");
    assert.equal(first.status, "drafting");
    assert.equal(first.contentVersion, 1);
    assert.deepEqual(first.createdAt, fixedDate);

    const updated = await articles.update(first.id, {
      summary: "更新后的摘要",
      status: "editing",
      contentVersion: 2
    });

    assert.equal(updated.summary, "更新后的摘要");
    assert.equal(updated.status, "editing");
    assert.equal(updated.contentVersion, 2);
    assert.equal((await articles.getById(first.id))?.id, first.id);

    assert.deepEqual((await articles.list({ category: "finance" })).items.map((article) => article.id), [first.id]);
    assert.deepEqual((await articles.list({ status: "editing" })).items.map((article) => article.id), [
      first.id,
      second.id
    ]);
    assert.deepEqual((await articles.list({ keyword: "agent" })).items.map((article) => article.id), [second.id]);

    await articles.delete(first.id);

    assert.equal(await articles.getById(first.id), undefined);
    assert.equal((await articles.list()).total, 1);
  });

  it("returns cloned article records so callers cannot mutate repository state", async () => {
    const articles = new InMemoryArticleRepository(createMemoryStore(), fixedClock, createSequentialIdFactory());
    const article = await articles.create({
      category: "literature",
      title: "春日散文",
      body: "正文",
      generationConfig: {
        category: "literature",
        topic: "春日",
        requireRiskNote: false
      }
    });

    article.title = "外部误改";
    article.generationConfig.references = ["external"];

    const stored = await articles.getById(article.id);
    assert.equal(stored?.title, "春日散文");
    assert.equal(stored?.generationConfig.references, undefined);
  });
});

describe("image repository", () => {
  it("creates, updates, lists, and deletes article images", async () => {
    const store = createMemoryStore();
    const images = createImageRepository({
      store,
      now: fixedClock,
      createId: createSequentialIdFactory()
    });

    const suggestion = await images.create({
      articleId: "article_001",
      type: "suggestion",
      description: "摘要后使用数据看板风格配图",
      position: "summary_after"
    });

    const uploaded = await images.create({
      articleId: "article_001",
      type: "uploaded",
      description: "人工上传封面图",
      url: "https://example.com/cover.png",
      source: "manual"
    });

    assert.equal(suggestion.id, "image_001");
    assert.equal((await images.listByArticleId("article_001")).length, 2);

    const replaced = await images.update(suggestion.id, {
      type: "external",
      url: "https://example.com/dashboard.png",
      source: "external-search"
    });

    assert.equal(replaced.type, "external");
    assert.equal(replaced.url, "https://example.com/dashboard.png");
    assert.equal((await images.getById(uploaded.id))?.source, "manual");

    await images.delete(uploaded.id);

    assert.deepEqual((await images.listByArticleId("article_001")).map((image) => image.id), [suggestion.id]);
  });

  it("returns cloned image records", async () => {
    const images = new InMemoryImageRepository(createMemoryStore(), fixedClock, createSequentialIdFactory());
    const image = await images.create({
      articleId: "article_001",
      type: "suggestion",
      description: "配图建议"
    });

    image.description = "外部误改";

    assert.equal((await images.getById(image.id))?.description, "配图建议");
  });
});

describe("review, publish, and audit repositories", () => {
  it("records reviews, publish records, and status events in chronological order", async () => {
    const store = createMemoryStore();
    const createId = createSequentialIdFactory();
    const reviews = createReviewRepository({ store, now: fixedClock, createId });
    const publishes = createPublishRepository({ store, now: fixedClock, createId });
    const audit = createAuditLogRepository({ store, now: fixedClock, createId });

    const rejected = await reviews.create({
      articleId: "article_001",
      articleVersion: 1,
      result: "rejected",
      comment: "补充图片说明"
    });
    const approved = await reviews.create({
      articleId: "article_001",
      articleVersion: 2,
      result: "approved",
      reviewChecklist: { hasTitle: true, hasBody: true }
    });

    assert.equal(rejected.id, "review_001");
    assert.equal((await reviews.latestByArticleId("article_001"))?.id, approved.id);
    assert.equal((await reviews.getLatestByArticleId("article_001"))?.id, approved.id);
    assert.equal((await reviews.findLatestByArticleId("article_001"))?.id, approved.id);
    assert.deepEqual((await reviews.listByArticleId("article_001")).map((review) => review.id), [
      rejected.id,
      approved.id
    ]);

    const prepared = await publishes.create({
      articleId: "article_001",
      articleVersion: 2,
      channel: "wechat_manual",
      status: "prepared",
      exportContent: "可复制内容"
    });
    const published = await publishes.update(prepared.id, {
      status: "published",
      publishedAt: fixedDate
    });

    assert.equal(prepared.id, "publish_003");
    assert.equal(published.status, "published");
    assert.equal((await publishes.latestByArticleId("article_001"))?.id, prepared.id);

    const created = await audit.createStatusEvent({
      articleId: "article_001",
      toStatus: "drafting",
      reason: "create article"
    });
    const submitted = await audit.createStatusEvent({
      articleId: "article_001",
      fromStatus: "editing",
      toStatus: "pending_review",
      reason: "submit review"
    });

    assert.equal(created.id, "status_event_004");
    assert.equal((await audit.latestStatusEventByArticleId("article_001"))?.id, submitted.id);
    assert.deepEqual((await audit.listStatusEventsByArticleId("article_001")).map((event) => event.toStatus), [
      "drafting",
      "pending_review"
    ]);

    const auditLog = await audit.create({
      entityType: "article",
      entityId: "article_001",
      action: "phase1.integration",
      message: "repository persistence verified"
    });

    assert.equal(auditLog.id, "audit_006");
    assert.equal((await audit.listByEntity("article", "article_001"))[0]?.action, "phase1.integration");
  });
});
