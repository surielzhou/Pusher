import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  InMemoryPublishRepository,
  InMemoryReviewRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleInputError,
  ArticleServiceImpl
} from "../../../src/services/articleService.ts";

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
  const articles = new InMemoryArticleRepository(store, now);
  const images = new InMemoryImageRepository(store, now);
  const reviews = new InMemoryReviewRepository(store, now);
  const publishes = new InMemoryPublishRepository(store, now);
  const service = new ArticleServiceImpl({ articles, images, reviews, publishes });

  return { articles, images, reviews, publishes, service };
}

describe("article service", () => {
  it("requires category and topic when creating an article", async () => {
    const { service } = createHarness();

    await assert.rejects(
      () => service.createArticle({ category: undefined as never, topic: "AI Agent" }),
      (error) => {
        assert.equal(error instanceof ArticleInputError, true);
        assert.equal((error as ArticleInputError).field, "category");
        return true;
      }
    );

    await assert.rejects(
      () => service.createArticle({ category: "finance", topic: "   " }),
      (error) => {
        assert.equal(error instanceof ArticleInputError, true);
        assert.equal((error as ArticleInputError).field, "topic");
        return true;
      }
    );
  });

  it("creates drafting articles and enables risk notes for finance content", async () => {
    const { articles, service } = createHarness();

    const finance = await service.createArticle({
      category: "finance",
      topic: "宏观市场观察",
      audience: "普通投资者",
      style: "分析型",
      length: "中等篇幅",
      references: ["央行公开信息"]
    });
    const tech = await service.createArticle({
      category: "tech_internet",
      topic: "AI Agent 产品入口"
    });

    assert.deepEqual(finance, { articleId: "article_001", status: "drafting" });
    assert.equal((await articles.getById(finance.articleId))?.generationConfig.requireRiskNote, true);
    assert.deepEqual((await articles.getById(finance.articleId))?.generationConfig.references, [
      "央行公开信息"
    ]);
    assert.equal((await articles.getById(tech.articleId))?.generationConfig.requireRiskNote, false);
  });

  it("returns article detail with images and latest review and publish records", async () => {
    const { images, publishes, reviews, service } = createHarness();
    const created = await service.createArticle({
      category: "literature",
      topic: "春日散文"
    });
    await images.create({
      articleId: created.articleId,
      type: "suggestion",
      description: "一张春日窗边阅读的配图"
    });
    await reviews.create({
      articleId: created.articleId,
      articleVersion: 1,
      result: "rejected",
      comment: "补充细节"
    });
    const approvedReview = await reviews.create({
      articleId: created.articleId,
      articleVersion: 2,
      result: "approved"
    });
    await publishes.create({
      articleId: created.articleId,
      articleVersion: 1,
      channel: "wechat_manual",
      status: "prepared"
    });
    const failedPublish = await publishes.create({
      articleId: created.articleId,
      articleVersion: 2,
      channel: "wechat_manual",
      status: "failed",
      errorMessage: "人工发布前发现排版问题"
    });

    const detail = await service.getArticleDetail(created.articleId);

    assert.equal(detail.article.id, created.articleId);
    assert.equal(detail.images.length, 1);
    assert.equal(detail.images[0]?.type, "suggestion");
    assert.equal(detail.latestReview?.id, approvedReview.id);
    assert.equal(detail.latestPublish?.id, failedPublish.id);
  });

  it("lists article details by category and status filters", async () => {
    const { articles, images, service } = createHarness();
    const finance = await service.createArticle({
      category: "finance",
      topic: "市场观察"
    });
    const tech = await service.createArticle({
      category: "tech_internet",
      topic: "AI Agent"
    });
    const literature = await service.createArticle({
      category: "literature",
      topic: "春日"
    });
    await articles.update(tech.articleId, { status: "editing", title: "AI Agent 观察" });
    await articles.update(literature.articleId, { status: "editing", title: "春日散文" });
    await images.create({
      articleId: tech.articleId,
      type: "suggestion",
      description: "科技风产品架构配图"
    });

    const financeList = await service.listArticles({ category: "finance" });
    const editingList = await service.listArticles({ status: "editing" });
    const keywordList = await service.listArticles({ keyword: "Agent" });

    assert.deepEqual(financeList.items.map((item) => item.article.id), [finance.articleId]);
    assert.equal(financeList.total, 1);
    assert.deepEqual(editingList.items.map((item) => item.article.id), [
      literature.articleId,
      tech.articleId
    ]);
    assert.deepEqual(keywordList.items.map((item) => item.article.id), [tech.articleId]);
    assert.equal(keywordList.items[0]?.images.length, 1);
  });
});
