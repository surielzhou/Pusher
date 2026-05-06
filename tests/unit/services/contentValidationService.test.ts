import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleNotFoundError,
  ContentValidationServiceImpl,
  RepositoryContentValidationService
} from "../../../src/services/contentValidationService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const images = new InMemoryImageRepository(store, fixedNow);
  const validation = new ContentValidationServiceImpl({ articles, images });

  return { articles, images, validation };
}

describe("content validation service", () => {
  it("reports missing title", async () => {
    const { articles, images, validation } = createHarness();
    const article = await articles.create({
      category: "tech_internet",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      }
    });
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "配图建议"
    });

    assert.deepEqual(await validation.validateForReview(article.id), {
      valid: false,
      missingFields: ["title"],
      warnings: []
    });
  });

  it("reports missing body and image", async () => {
    const { articles, validation } = createHarness();
    const article = await articles.create({
      category: "literature",
      title: "春日散文",
      generationConfig: {
        category: "literature",
        topic: "春日",
        requireRiskNote: false
      }
    });

    assert.deepEqual(await validation.validateForReview(article.id), {
      valid: false,
      missingFields: ["body", "image"],
      warnings: []
    });
  });

  it("reports missing category for malformed runtime records", async () => {
    const { articles, images, validation } = createHarness();
    const article = await articles.create({
      category: "tech_internet",
      title: "标题",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI",
        requireRiskNote: false
      }
    });
    await articles.update(article.id, { category: undefined as never });
    await images.create({ articleId: article.id, type: "suggestion", description: "配图建议" });

    const result = await validation.validateForReview(article.id);

    assert.deepEqual(result.missingFields, ["category"]);
    assert.equal(result.valid, false);
  });

  it("accepts complete article with an image suggestion", async () => {
    const { articles, images, validation } = createHarness();
    const article = await articles.create({
      category: "tech_internet",
      title: "AI Agent 正在改变产品入口",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      }
    });
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "一张表现 AI Agent 连接多个应用的科技风插图"
    });

    assert.deepEqual(await validation.validateForReview(article.id), {
      valid: true,
      missingFields: [],
      warnings: []
    });
  });

  it("returns a finance warning when risk note is missing", async () => {
    const { articles, images, validation } = createHarness();
    const article = await articles.create({
      category: "finance",
      title: "市场观察",
      body: "正文",
      generationConfig: {
        category: "finance",
        topic: "市场观察",
        requireRiskNote: true
      }
    });
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "金融市场数据可视化配图"
    });

    assert.deepEqual(await validation.validateForReview(article.id), {
      valid: true,
      missingFields: [],
      warnings: ["finance_risk_note_missing"]
    });
  });

  it("throws a structured error when article does not exist", async () => {
    const { validation } = createHarness();

    await assert.rejects(
      () => validation.validateForReview("article_missing"),
      (error) => {
        assert.equal(error instanceof ArticleNotFoundError, true);
        assert.equal((error as ArticleNotFoundError).articleId, "article_missing");
        assert.match((error as Error).message, /Article not found: article_missing/);
        return true;
      }
    );
  });

  it("keeps the two constructor styles compatible", async () => {
    const store = createMemoryStore();
    const articles = new InMemoryArticleRepository(store, fixedNow);
    const images = new InMemoryImageRepository(store, fixedNow);
    const validation = new RepositoryContentValidationService(articles, images);
    const article = await articles.create({
      category: "tech_internet",
      title: "标题",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI",
        requireRiskNote: false
      }
    });
    await images.create({ articleId: article.id, type: "suggestion", description: "配图建议" });

    assert.equal((await validation.validateForReview(article.id)).valid, true);
  });
});
