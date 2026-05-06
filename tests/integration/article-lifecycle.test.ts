import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  GeneratedArticleDraft,
  TextGenerationAdapter,
  TextGenerationRequest
} from "../../src/adapters/ai/textGenerationAdapter.ts";
import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  InMemoryPublishRepository,
  InMemoryReviewRepository,
  createMemoryStore,
  createSequentialIdFactory
} from "../../src/repositories/index.ts";
import { ArticleServiceImpl } from "../../src/services/articleService.ts";
import { ContentValidationServiceImpl } from "../../src/services/contentValidationService.ts";
import { EditorServiceImpl } from "../../src/services/editorService.ts";
import { GenerationServiceImpl } from "../../src/services/generationService.ts";
import {
  ArticleNotPublishableError,
  PublishPreparationServiceImpl
} from "../../src/services/publishPreparationService.ts";
import { ReviewServiceImpl } from "../../src/services/reviewService.ts";

const publishedAt = new Date("2026-05-06T10:00:00.000Z");

describe("article lifecycle integration", () => {
  it("runs the full article lifecycle from creation through published status", async () => {
    const draft = createDraft({
      title: "AI Agent 正在改变产品入口",
      summary: "从入口、流程和组织协作看 AI Agent 的产品影响。",
      body: "生成正文：AI Agent 正在重组任务入口和工作流。",
      imageSuggestions: [
        {
          description: "展示 AI Agent 工作流节点的科技风头图",
          position: "cover",
          altText: "AI Agent 工作流示意"
        }
      ]
    });
    const harness = createHarness(draft);

    const created = await harness.articleService.createArticle({
      category: "tech_internet",
      topic: "AI Agent 产品入口"
    });
    await harness.generationService.generateDraft(created.articleId);
    await harness.editorService.saveArticleContent(created.articleId, {
      title: "编辑后的 AI Agent 产品观察",
      summary: "编辑后的摘要，面向公众号读者。",
      body: "编辑后的正文，补充产品入口、业务流程和团队协作变化。"
    });
    await harness.editorService.submitForReview(created.articleId);
    const approved = await harness.reviewService.submitReview({
      articleId: created.articleId,
      result: "approved",
      comment: "内容完整，可以发布。",
      reviewChecklist: {
        titleChecked: true,
        imageChecked: true
      }
    });
    const prepared = await harness.publishService.preparePublish({
      articleId: created.articleId,
      channel: "wechat_manual"
    });
    const published = await harness.publishService.markPublished({
      publishRecordId: prepared.publishRecordId,
      publishedAt
    });

    const article = await harness.articles.getById(created.articleId);
    const images = await harness.images.listByArticleId(created.articleId);
    const reviews = await harness.reviews.listByArticleId(created.articleId);
    const publishes = await harness.publishes.listByArticleId(created.articleId);
    const events = await harness.articles.listStatusEvents(created.articleId);

    assert.equal(article?.status, "published");
    assert.equal(article?.publishedVersion, article?.contentVersion);
    assert.equal(approved.reviewedVersion, article?.publishedVersion);
    assert.deepEqual(published, { articleStatus: "published", publishStatus: "published" });
    assert.equal(images.length, 1);
    assert.equal(images[0]?.description, "展示 AI Agent 工作流节点的科技风头图");
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0]?.result, "approved");
    assert.equal(publishes.length, 1);
    assert.equal(publishes[0]?.status, "published");
    assert.match(prepared.exportContent, /# 编辑后的 AI Agent 产品观察/);
    assert.match(prepared.exportContent, /图片清单/);
    assert.deepEqual(
      events.map((event) => [event.fromStatus, event.toStatus, event.reason]),
      [
        [undefined, "drafting", "create article"],
        ["drafting", "editing", "Draft generation succeeded"],
        ["editing", "pending_review", "submit review"],
        ["pending_review", "approved", "review approved"],
        ["approved", "pending_publish", "publish prepared"],
        ["pending_publish", "published", "publish completed"]
      ]
    );
  });

  it("supports review rejection, editing, and resubmission for review", async () => {
    const harness = createHarness();
    const created = await createGeneratedArticle(harness);

    await harness.editorService.submitForReview(created.articleId);
    await harness.reviewService.submitReview({
      articleId: created.articleId,
      result: "rejected",
      comment: "需要补充业务影响。"
    });

    const rejected = await harness.articles.getById(created.articleId);
    assert.equal(rejected?.status, "review_rejected");

    await harness.editorService.saveArticleContent(created.articleId, {
      body: "补充后的正文，加入业务影响、风险和执行建议。"
    });
    await harness.editorService.submitForReview(created.articleId);

    const article = await harness.articles.getById(created.articleId);
    const reviews = await harness.reviews.listByArticleId(created.articleId);

    assert.equal(article?.status, "pending_review");
    assert.equal(article?.contentVersion, 3);
    assert.equal(reviews.length, 1);
    assert.equal(reviews[0]?.result, "rejected");
    assert.deepEqual(
      (await harness.articles.listStatusEvents(created.articleId)).map((event) => [
        event.fromStatus,
        event.toStatus,
        event.reason
      ]),
      [
        [undefined, "drafting", "create article"],
        ["drafting", "editing", "Draft generation succeeded"],
        ["editing", "pending_review", "submit review"],
        ["pending_review", "review_rejected", "review rejected"],
        ["review_rejected", "editing", "content edited"],
        ["editing", "pending_review", "submit review"]
      ]
    );
  });

  it("blocks publish preparation after review marks an article as not publishable", async () => {
    const harness = createHarness();
    const created = await createGeneratedArticle(harness);

    await harness.editorService.submitForReview(created.articleId);
    await harness.reviewService.submitReview({
      articleId: created.articleId,
      result: "not_publish",
      comment: "选题暂不适合本期发布。"
    });

    await assert.rejects(
      () =>
        harness.publishService.preparePublish({
          articleId: created.articleId,
          channel: "wechat_manual"
        }),
      (error) => {
        assert.equal(error instanceof ArticleNotPublishableError, true);
        assert.equal((error as ArticleNotPublishableError).status, "not_publish");
        return true;
      }
    );

    assert.equal((await harness.articles.getById(created.articleId))?.status, "not_publish");
    assert.equal((await harness.publishes.listByArticleId(created.articleId)).length, 0);
  });

  it("requires another review after approved content is edited before publish preparation", async () => {
    const harness = createHarness();
    const created = await createGeneratedArticle(harness);

    await harness.editorService.submitForReview(created.articleId);
    const approved = await harness.reviewService.submitReview({
      articleId: created.articleId,
      result: "approved",
      comment: "内容完整，可以发布。"
    });
    await harness.editorService.saveArticleContent(created.articleId, {
      body: "审核通过后修改正文，需要重新审核。"
    });

    const article = await harness.articles.getById(created.articleId);
    assert.equal(article?.status, "editing");
    assert.equal(article?.reviewedVersion, approved.reviewedVersion);
    assert.notEqual(article?.reviewedVersion, article?.contentVersion);

    await assert.rejects(
      () =>
        harness.publishService.preparePublish({
          articleId: created.articleId,
          channel: "wechat_manual"
        }),
      (error) => {
        assert.equal(error instanceof ArticleNotPublishableError, true);
        assert.equal((error as ArticleNotPublishableError).status, "editing");
        return true;
      }
    );

    assert.equal((await harness.publishes.listByArticleId(created.articleId)).length, 0);
  });
});

function createHarness(draft = createDraft()) {
  const store = createMemoryStore();
  const createId = createSequentialIdFactory();
  const now = createSteppedClock();
  const articles = new InMemoryArticleRepository(store, now, createId);
  const images = new InMemoryImageRepository(store, now, createId);
  const reviews = new InMemoryReviewRepository(store, now, createId);
  const publishes = new InMemoryPublishRepository(store, now, createId);
  const adapter = new FakeTextGenerationAdapter(draft);
  const validationService = new ContentValidationServiceImpl({ articles, images });

  const articleService = new ArticleServiceImpl({ articles, images, reviews, publishes });
  const generationService = new GenerationServiceImpl({ articles, images, adapter });
  const editorService = new EditorServiceImpl({ articles, validation: validationService });
  const reviewService = new ReviewServiceImpl({ articles, images, reviews });
  const publishService = new PublishPreparationServiceImpl({ articles, images, publishes });

  return {
    adapter,
    articleService,
    articles,
    editorService,
    generationService,
    images,
    publishes,
    publishService,
    reviews,
    reviewService
  };
}

async function createGeneratedArticle(harness: ReturnType<typeof createHarness>) {
  const created = await harness.articleService.createArticle({
    category: "tech_internet",
    topic: "AI Agent 产品入口"
  });
  await harness.generationService.generateDraft(created.articleId);

  return created;
}

function createDraft(overrides: Partial<GeneratedArticleDraft> = {}): GeneratedArticleDraft {
  return {
    title: "AI Agent 产品观察",
    summary: "围绕 AI Agent 的产品变化做结构化分析。",
    body: "正文从背景、变化和趋势三部分展开。",
    riskNote: undefined,
    imageSuggestions: [
      {
        description: "科技互联网风格配图建议",
        position: "cover"
      }
    ],
    ...overrides
  };
}

function createSteppedClock() {
  let tick = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 4, 6, 0, 0, tick));
    tick += 1;
    return value;
  };
}

class FakeTextGenerationAdapter implements TextGenerationAdapter {
  readonly requests: TextGenerationRequest[] = [];
  private readonly draft: GeneratedArticleDraft;

  constructor(draft: GeneratedArticleDraft) {
    this.draft = draft;
  }

  async generateArticleDraft(request: TextGenerationRequest): Promise<GeneratedArticleDraft> {
    this.requests.push(request);
    return this.draft;
  }
}
