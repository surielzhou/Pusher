import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  InMemoryPublishRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleNotPublishableError,
  ArticleReviewVersionMismatchError,
  PublishFailureReasonRequiredError,
  PublishPreparationServiceImpl
} from "../../../src/services/publishPreparationService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");
const publishedAt = new Date("2026-05-06T10:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const images = new InMemoryImageRepository(store, fixedNow);
  const publishes = new InMemoryPublishRepository(store, fixedNow);
  const service = new PublishPreparationServiceImpl({ articles, images, publishes });

  return { articles, images, publishes, service };
}

async function createPublishableArticle(
  articles: InMemoryArticleRepository,
  status: "approved" | "pending_publish" = "approved"
) {
  const article = await articles.create({
    category: "finance",
    title: "AI 投研工具周报",
    summary: "面向公众号读者的 AI 投研工具观察摘要。",
    body: "正文包含行业变化、风险因素和非投资建议表达。",
    riskNote: "市场有风险，本文不构成投资建议。",
    generationConfig: {
      category: "finance",
      topic: "AI 投研工具",
      audience: "公众号读者",
      style: "稳健",
      requireRiskNote: true
    },
    status
  });

  return articles.update(article.id, { reviewedVersion: article.contentVersion });
}

describe("publish preparation service", () => {
  it("prepares approved articles and moves them to pending publish", async () => {
    const { articles, images, publishes, service } = createHarness();
    const article = await createPublishableArticle(articles);
    const image = await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "金融科技仪表盘配图",
      position: "正文第一段后",
      altText: "AI 投研仪表盘"
    });

    const result = await service.preparePublish({
      articleId: article.id,
      channel: "wechat_manual"
    });

    const updated = await articles.getById(article.id);
    const latestPublish = await publishes.latestByArticleId(article.id);
    const statusEvents = await articles.listStatusEvents(article.id);

    assert.equal(result.publishRecordId, latestPublish?.id);
    assert.equal(result.status, "prepared");
    assert.equal(result.articleStatus, "pending_publish");
    assert.equal(updated?.status, "pending_publish");
    assert.equal(latestPublish?.articleVersion, article.contentVersion);
    assert.equal(latestPublish?.status, "prepared");
    assert.equal(latestPublish?.exportContent, result.exportContent);
    assert.deepEqual(latestPublish?.imageChecklist, [
      {
        id: image.id,
        type: "suggestion",
        description: "金融科技仪表盘配图",
        position: "正文第一段后",
        altText: "AI 投研仪表盘"
      }
    ]);
    assert.deepEqual(
      statusEvents.map((event) => [event.fromStatus, event.toStatus, event.reason]),
      [["approved", "pending_publish", "publish prepared"]]
    );
  });

  it("prepares already pending publish articles without another status event", async () => {
    const { articles, publishes, service } = createHarness();
    const article = await createPublishableArticle(articles, "pending_publish");

    const result = await service.preparePublish({
      articleId: article.id,
      channel: "wechat_manual"
    });

    assert.equal(result.articleStatus, "pending_publish");
    assert.equal((await publishes.latestByArticleId(article.id))?.status, "prepared");
    assert.deepEqual(await articles.listStatusEvents(article.id), []);
  });

  it("rejects publish preparation unless the article is approved or pending publish", async () => {
    const { articles, publishes, service } = createHarness();
    const pendingReview = await articles.create({
      category: "tech_internet",
      title: "待审核文章",
      summary: "摘要",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      },
      status: "pending_review"
    });
    const notPublish = await articles.create({
      category: "tech_internet",
      title: "暂不发布文章",
      summary: "摘要",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      },
      status: "not_publish"
    });

    for (const article of [pendingReview, notPublish]) {
      await assert.rejects(
        () => service.preparePublish({ articleId: article.id, channel: "wechat_manual" }),
        (error) => {
          assert.equal(error instanceof ArticleNotPublishableError, true);
          assert.equal((error as ArticleNotPublishableError).articleId, article.id);
          assert.equal((error as ArticleNotPublishableError).status, article.status);
          return true;
        }
      );
    }

    assert.equal((await publishes.listByArticleId(pendingReview.id)).length, 0);
    assert.equal((await publishes.listByArticleId(notPublish.id)).length, 0);
  });

  it("rejects publish preparation when reviewed version is stale", async () => {
    const { articles, service } = createHarness();
    const article = await createPublishableArticle(articles);
    const staleArticle = await articles.update(article.id, {
      contentVersion: article.contentVersion + 1,
      reviewedVersion: article.contentVersion
    });

    await assert.rejects(
      () => service.preparePublish({ articleId: staleArticle.id, channel: "wechat_manual" }),
      (error) => {
        assert.equal(error instanceof ArticleReviewVersionMismatchError, true);
        assert.equal((error as ArticleReviewVersionMismatchError).articleId, staleArticle.id);
        assert.equal((error as ArticleReviewVersionMismatchError).reviewedVersion, article.contentVersion);
        assert.equal((error as ArticleReviewVersionMismatchError).contentVersion, staleArticle.contentVersion);
        return true;
      }
    );

    assert.equal((await articles.getById(article.id))?.status, "approved");
  });

  it("exports title, summary, body, images, and placement notes", async () => {
    const { articles, images, service } = createHarness();
    const article = await createPublishableArticle(articles);
    await images.create({
      articleId: article.id,
      type: "uploaded",
      url: "https://example.com/chart.png",
      source: "user_upload",
      description: "市场趋势折线图",
      position: "摘要后",
      altText: "趋势折线图"
    });
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "投资者阅读场景配图",
      position: "文末"
    });

    const result = await service.preparePublish({
      articleId: article.id,
      channel: "wechat_manual"
    });

    assert.match(result.exportContent, /# AI 投研工具周报/);
    assert.match(result.exportContent, /摘要[\s\S]*面向公众号读者的 AI 投研工具观察摘要。/);
    assert.match(result.exportContent, /正文[\s\S]*正文包含行业变化、风险因素和非投资建议表达。/);
    assert.match(result.exportContent, /图片清单/);
    assert.match(result.exportContent, /市场趋势折线图/);
    assert.match(result.exportContent, /摘要后/);
    assert.match(result.exportContent, /https:\/\/example.com\/chart.png/);
    assert.match(result.exportContent, /投资者阅读场景配图/);
    assert.match(result.exportContent, /文末/);
  });

  it("marks a prepared publish record as published", async () => {
    const { articles, publishes, service } = createHarness();
    const article = await createPublishableArticle(articles);
    const prepared = await service.preparePublish({
      articleId: article.id,
      channel: "wechat_manual"
    });

    const result = await service.markPublished({
      publishRecordId: prepared.publishRecordId,
      publishedAt
    });

    const updatedArticle = await articles.getById(article.id);
    const updatedPublish = await publishes.getById(prepared.publishRecordId);
    const statusEvents = await articles.listStatusEvents(article.id);

    assert.deepEqual(result, { articleStatus: "published", publishStatus: "published" });
    assert.equal(updatedArticle?.status, "published");
    assert.equal(updatedArticle?.publishedVersion, article.contentVersion);
    assert.equal(updatedPublish?.status, "published");
    assert.deepEqual(updatedPublish?.publishedAt, publishedAt);
    assert.deepEqual(
      statusEvents.map((event) => [event.fromStatus, event.toStatus, event.reason]),
      [
        ["approved", "pending_publish", "publish prepared"],
        ["pending_publish", "published", "publish completed"]
      ]
    );
  });

  it("requires a failure reason before marking publish failed", async () => {
    const { articles, service } = createHarness();
    const article = await createPublishableArticle(articles);
    const prepared = await service.preparePublish({
      articleId: article.id,
      channel: "wechat_manual"
    });

    await assert.rejects(
      () => service.markPublishFailed({ publishRecordId: prepared.publishRecordId, errorMessage: "  " }),
      (error) => {
        assert.equal(error instanceof PublishFailureReasonRequiredError, true);
        assert.equal((error as PublishFailureReasonRequiredError).publishRecordId, prepared.publishRecordId);
        return true;
      }
    );

    assert.equal((await articles.getById(article.id))?.status, "pending_publish");
  });

  it("marks a prepared publish record as failed with its reason", async () => {
    const { articles, publishes, service } = createHarness();
    const article = await createPublishableArticle(articles);
    const prepared = await service.preparePublish({
      articleId: article.id,
      channel: "wechat_manual"
    });

    const result = await service.markPublishFailed({
      publishRecordId: prepared.publishRecordId,
      errorMessage: "公众号后台排版需要调整"
    });

    const updatedArticle = await articles.getById(article.id);
    const updatedPublish = await publishes.getById(prepared.publishRecordId);

    assert.deepEqual(result, { articleStatus: "publish_failed", publishStatus: "failed" });
    assert.equal(updatedArticle?.status, "publish_failed");
    assert.equal(updatedPublish?.status, "failed");
    assert.equal(updatedPublish?.errorMessage, "公众号后台排版需要调整");
  });
});
