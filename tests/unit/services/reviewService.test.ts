import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  InMemoryReviewRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleNotReviewableError,
  ReviewCommentRequiredError,
  ReviewServiceImpl
} from "../../../src/services/reviewService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const images = new InMemoryImageRepository(store, fixedNow);
  const reviews = new InMemoryReviewRepository(store, fixedNow);
  const reviewService = new ReviewServiceImpl({ articles, images, reviews });

  return { articles, images, reviews, reviewService };
}

async function createReviewableArticle(
  articles: InMemoryArticleRepository,
  status: "editing" | "pending_review" | "approved" | "not_publish" = "pending_review"
) {
  return articles.create({
    category: "finance",
    title: "市场观察",
    summary: "一篇面向公众号的市场观察摘要",
    body: "正文包含风险因素、市场背景和非投资建议表达。",
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
}

describe("review service", () => {
  it("builds a review view with article preview data, images, risk note, and checklist", async () => {
    const { articles, images, reviewService } = createHarness();
    const article = await createReviewableArticle(articles);
    const image = await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "金融科技仪表盘配图",
      position: "cover"
    });

    const view = await reviewService.getReviewView(article.id);

    assert.equal(view.article.id, article.id);
    assert.equal(view.article.title, "市场观察");
    assert.deepEqual(view.images.map((item) => item.id), [image.id]);
    assert.equal(view.riskNote, "市场有风险，本文不构成投资建议。");
    assert.deepEqual(view.checklist, {
      hasTitle: true,
      hasBody: true,
      hasImageOrSuggestion: true,
      categoryMatched: true
    });
  });

  it("includes a finance compliance report in the review view", async () => {
    const { articles, images, reviewService } = createHarness();
    const article = await createReviewableArticle(articles);
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "金融科技仪表盘配图"
    });
    await articles.update(article.id, {
      body: "内幕消息显示这类产品可以保证收益。",
      riskNote: undefined
    });

    const view = await reviewService.getReviewView(article.id);

    assert.equal(view.complianceReport.status, "needs_attention");
    assert.deepEqual(
      view.complianceReport.issues.map((issue) => [issue.code, issue.term]),
      [
        ["finance_disclaimer_missing", undefined],
        ["finance_sensitive_word", "内幕消息"],
        ["finance_risky_expression", "保证收益"]
      ]
    );
  });

  it("rejects review submissions unless the article is pending review", async () => {
    const { articles, reviewService } = createHarness();
    const article = await createReviewableArticle(articles, "editing");

    await assert.rejects(
      () => reviewService.submitReview({ articleId: article.id, result: "approved" }),
      (error) => {
        assert.equal(error instanceof ArticleNotReviewableError, true);
        assert.equal((error as ArticleNotReviewableError).articleId, article.id);
        assert.equal((error as ArticleNotReviewableError).status, "editing");
        return true;
      }
    );

    assert.equal((await articles.getById(article.id))?.status, "editing");
  });

  it("approves pending review articles and records the reviewed content version", async () => {
    const { articles, reviews, reviewService } = createHarness();
    const article = await createReviewableArticle(articles);

    const result = await reviewService.submitReview({
      articleId: article.id,
      result: "approved",
      comment: "内容完整，可以发布。",
      reviewChecklist: {
        titleChecked: true,
        riskNoteChecked: true
      }
    });

    const updated = await articles.getById(article.id);
    const latestReview = await reviews.latestByArticleId(article.id);
    const statusEvents = await articles.listStatusEvents(article.id);

    assert.deepEqual(result, { status: "approved", reviewedVersion: article.contentVersion });
    assert.equal(updated?.status, "approved");
    assert.equal(updated?.reviewedVersion, article.contentVersion);
    assert.equal(latestReview?.articleVersion, article.contentVersion);
    assert.equal(latestReview?.result, "approved");
    assert.equal(latestReview?.comment, "内容完整，可以发布。");
    assert.deepEqual(latestReview?.reviewChecklist, {
      titleChecked: true,
      riskNoteChecked: true
    });
    assert.deepEqual(
      statusEvents.map((event) => [event.fromStatus, event.toStatus, event.reason]),
      [["pending_review", "approved", "review approved"]]
    );
  });

  it("requires a comment when rejecting an article for edits", async () => {
    const { articles, reviews, reviewService } = createHarness();
    const article = await createReviewableArticle(articles);

    await assert.rejects(
      () => reviewService.submitReview({ articleId: article.id, result: "rejected" }),
      (error) => {
        assert.equal(error instanceof ReviewCommentRequiredError, true);
        assert.equal((error as ReviewCommentRequiredError).articleId, article.id);
        return true;
      }
    );

    assert.equal((await articles.getById(article.id))?.status, "pending_review");
    assert.equal((await reviews.listByArticleId(article.id)).length, 0);
  });

  it("rejects articles for edits when a comment is supplied", async () => {
    const { articles, reviews, reviewService } = createHarness();
    const article = await createReviewableArticle(articles);

    const result = await reviewService.submitReview({
      articleId: article.id,
      result: "rejected",
      comment: "风险提示需要更醒目。"
    });

    const latestReview = await reviews.latestByArticleId(article.id);

    assert.deepEqual(result, { status: "review_rejected" });
    assert.equal((await articles.getById(article.id))?.status, "review_rejected");
    assert.equal(latestReview?.articleVersion, article.contentVersion);
    assert.equal(latestReview?.result, "rejected");
    assert.equal(latestReview?.comment, "风险提示需要更醒目。");
  });

  it("marks pending review articles as not publishable", async () => {
    const { articles, reviews, reviewService } = createHarness();
    const article = await createReviewableArticle(articles);

    const result = await reviewService.submitReview({
      articleId: article.id,
      result: "not_publish",
      comment: "选题暂不适合本期发布。"
    });

    const latestReview = await reviews.latestByArticleId(article.id);

    assert.deepEqual(result, { status: "not_publish" });
    assert.equal((await articles.getById(article.id))?.status, "not_publish");
    assert.equal(latestReview?.articleVersion, article.contentVersion);
    assert.equal(latestReview?.result, "not_publish");
    assert.equal(latestReview?.comment, "选题暂不适合本期发布。");
  });
});
