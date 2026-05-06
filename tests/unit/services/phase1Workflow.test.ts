import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleStatusTransitionError,
  assertTransition,
  resolveStatusAfterContentChange
} from "../../../src/services/articleStatusService.ts";
import { ContentValidationServiceImpl } from "../../../src/services/contentValidationService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");

describe("phase 1 workflow", () => {
  it("validates complete content before review and blocks publish preparation before approval", async () => {
    const store = createMemoryStore();
    const articles = new InMemoryArticleRepository(store, fixedNow);
    const images = new InMemoryImageRepository(store, fixedNow);
    const validation = new ContentValidationServiceImpl({ articles, images });

    const article = await articles.create({
      category: "tech_internet",
      title: "AI Agent 正在改变产品入口",
      body: "正文",
      status: "editing",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      }
    });
    await images.create({
      articleId: article.id,
      type: "suggestion",
      description: "科技风配图建议"
    });

    assert.deepEqual(await validation.validateForReview(article.id), {
      valid: true,
      missingFields: [],
      warnings: []
    });

    assertTransition(article.status, "pending_review");
    const pendingReview = await articles.update(article.id, { status: "pending_review" });

    assert.throws(
      () => assertTransition(pendingReview.status, "pending_publish"),
      ArticleStatusTransitionError
    );

    assertTransition(pendingReview.status, "approved");
    const approved = await articles.update(article.id, {
      status: "approved",
      reviewedVersion: pendingReview.contentVersion
    });

    assertTransition(approved.status, "pending_publish");
  });

  it("moves approved content back to editing after a content change", async () => {
    const store = createMemoryStore();
    const articles = new InMemoryArticleRepository(store, fixedNow);

    const article = await articles.create({
      category: "literature",
      title: "春日散文",
      body: "正文",
      status: "approved",
      generationConfig: {
        category: "literature",
        topic: "春日",
        requireRiskNote: false
      }
    });

    const updated = await articles.update(article.id, {
      title: "春日散文修订版",
      status: resolveStatusAfterContentChange(article.status),
      contentVersion: article.contentVersion + 1
    });

    assert.equal(updated.status, "editing");
    assert.equal(updated.contentVersion, 2);
  });
});
