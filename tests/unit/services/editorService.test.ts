import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import { ContentValidationServiceImpl } from "../../../src/services/contentValidationService.ts";
import {
  ArticleNotEditableError,
  ArticleReviewValidationError,
  EditorServiceImpl
} from "../../../src/services/editorService.ts";
import type { ContentValidationService } from "../../../src/services/contracts.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const images = new InMemoryImageRepository(store, fixedNow);
  const validation = new ContentValidationServiceImpl({ articles, images });
  const editor = new EditorServiceImpl({ articles, validation });

  return { articles, images, editor };
}

async function createEditableArticle(
  articles: InMemoryArticleRepository,
  status: "editing" | "pending_review" | "approved" | "pending_publish" = "editing"
) {
  return articles.create({
    category: "tech_internet",
    title: "旧标题",
    summary: "旧摘要",
    body: "旧正文",
    generationConfig: {
      category: "tech_internet",
      topic: "AI Agent",
      requireRiskNote: false
    },
    status
  });
}

describe("editor service", () => {
  it("saves title, summary, and body while an article is editing", async () => {
    const { articles, editor } = createHarness();
    const article = await createEditableArticle(articles);

    const result = await editor.saveArticleContent(article.id, {
      title: "新标题",
      summary: "新摘要",
      body: "新正文"
    });

    const saved = await articles.getById(article.id);
    assert.deepEqual(result, {
      articleId: article.id,
      status: "editing",
      contentVersion: 2
    });
    assert.equal(saved?.title, "新标题");
    assert.equal(saved?.summary, "新摘要");
    assert.equal(saved?.body, "新正文");
  });

  it("rejects edits while an article is pending review", async () => {
    const { articles, editor } = createHarness();
    const article = await createEditableArticle(articles, "pending_review");

    await assert.rejects(
      () => editor.saveArticleContent(article.id, { title: "不应保存" }),
      (error) => {
        assert.equal(error instanceof ArticleNotEditableError, true);
        assert.equal((error as ArticleNotEditableError).articleId, article.id);
        assert.equal((error as ArticleNotEditableError).status, "pending_review");
        return true;
      }
    );

    assert.equal((await articles.getById(article.id))?.title, "旧标题");
  });

  it("moves approved or pending publish articles back to editing when content changes", async () => {
    const { articles, editor } = createHarness();
    const approved = await createEditableArticle(articles, "approved");
    const pendingPublish = await createEditableArticle(articles, "pending_publish");

    await editor.saveArticleContent(approved.id, { body: "审核通过后改正文" });
    await editor.saveArticleContent(pendingPublish.id, { body: "发布准备后改正文" });

    assert.equal((await articles.getById(approved.id))?.status, "editing");
    assert.equal((await articles.getById(pendingPublish.id))?.status, "editing");
    assert.deepEqual(
      (await articles.listStatusEvents(approved.id)).map((event) => [
        event.fromStatus,
        event.toStatus,
        event.reason
      ]),
      [["approved", "editing", "content edited"]]
    );
  });

  it("increments content version each time content is saved", async () => {
    const { articles, editor } = createHarness();
    const article = await createEditableArticle(articles);

    const firstSave = await editor.saveArticleContent(article.id, { title: "版本 2" });
    const secondSave = await editor.saveArticleContent(article.id, { summary: "版本 3" });

    assert.equal(firstSave.contentVersion, 2);
    assert.equal(secondSave.contentVersion, 3);
    assert.equal((await articles.getById(article.id))?.contentVersion, 3);
  });

  it("validates content before submitting for review", async () => {
    const { articles } = createHarness();
    const article = await createEditableArticle(articles);
    const calls: string[] = [];
    const validation: ContentValidationService = {
      async validateForReview(articleId) {
        calls.push(articleId);
        return { valid: true, missingFields: [], warnings: [] };
      }
    };
    const editor = new EditorServiceImpl({ articles, validation });

    const result = await editor.submitForReview(article.id);

    assert.deepEqual(calls, [article.id]);
    assert.deepEqual(result, { status: "pending_review" });
    assert.equal((await articles.getById(article.id))?.status, "pending_review");
  });

  it("rejects review submission when validation reports missing fields", async () => {
    const { articles, editor } = createHarness();
    const article = await articles.create({
      category: "tech_internet",
      body: "正文",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      },
      status: "editing"
    });

    await assert.rejects(
      () => editor.submitForReview(article.id),
      (error) => {
        assert.equal(error instanceof ArticleReviewValidationError, true);
        assert.deepEqual((error as ArticleReviewValidationError).missingFields, ["title", "image"]);
        return true;
      }
    );

    assert.equal((await articles.getById(article.id))?.status, "editing");
  });
});
