import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Article, GenerationConfig } from "../../../src/domain/article.ts";
import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore,
  createSequentialIdFactory
} from "../../../src/repositories/index.ts";
import type {
  GeneratedArticleDraft,
  TextGenerationAdapter,
  TextGenerationRequest
} from "../../../src/adapters/ai/textGenerationAdapter.ts";
import { GenerationServiceError, GenerationServiceImpl } from "../../../src/services/generationService.ts";

const fixedDate = new Date("2026-05-06T00:00:00.000Z");
const fixedClock = () => fixedDate;

describe("generation service", () => {
  it("saves generated article content and moves the article to editing", async () => {
    const draft = createGeneratedDraft({
      title: "AI Agent 正在改变产品入口",
      summary: "从入口、流程和组织协作看 AI Agent 的产品影响。",
      body: "AI Agent 不只是对话框，而是在重组任务入口和工作流。",
      riskNote: "本文不构成投资建议。",
      imageSuggestions: [
        {
          description: "展示 AI Agent 工作流节点的科技风头图",
          position: "cover",
          altText: "AI Agent 工作流示意"
        }
      ]
    });
    const harness = createHarness(new FakeTextGenerationAdapter(draft));
    const article = await createArticle(harness.articles, {
      category: "finance",
      topic: "AI Agent 商业化",
      requireRiskNote: true
    });

    const result = await harness.service.generateDraft(article.id);

    assert.deepEqual(result, {
      articleId: article.id,
      status: "editing",
      contentVersion: 2
    });

    const storedArticle = await harness.articles.getById(article.id);
    assert.equal(storedArticle?.title, draft.title);
    assert.equal(storedArticle?.summary, draft.summary);
    assert.equal(storedArticle?.body, draft.body);
    assert.equal(storedArticle?.riskNote, draft.riskNote);
    assert.equal(storedArticle?.status, "editing");
    assert.equal(storedArticle?.contentVersion, 2);
  });

  it("creates image suggestions returned by the text generation adapter", async () => {
    const draft = createGeneratedDraft({
      imageSuggestions: [
        {
          description: "摘要后放置数据看板风格配图",
          position: "summary_after",
          altText: "数据看板"
        },
        {
          description: "正文结尾放置趋势箭头图",
          position: "body_end"
        }
      ]
    });
    const harness = createHarness(new FakeTextGenerationAdapter(draft));
    const article = await createArticle(harness.articles);

    await harness.service.generateDraft(article.id);

    const images = await harness.images.listByArticleId(article.id);
    assert.equal(images.length, 2);
    assert.deepEqual(
      images.map((image) => ({
        type: image.type,
        description: image.description,
        position: image.position,
        altText: image.altText
      })),
      [
        {
          type: "suggestion",
          description: "摘要后放置数据看板风格配图",
          position: "summary_after",
          altText: "数据看板"
        },
        {
          type: "suggestion",
          description: "正文结尾放置趋势箭头图",
          position: "body_end",
          altText: undefined
        }
      ]
    );
  });

  it("marks generation_failed and records the adapter error when generation fails", async () => {
    const harness = createHarness(new FailingTextGenerationAdapter(new Error("provider timeout")));
    const article = await createArticle(harness.articles);

    await assert.rejects(
      () => harness.service.generateDraft(article.id),
      (error) =>
        error instanceof GenerationServiceError &&
        error.code === "adapter_failed" &&
        error.articleId === article.id
    );

    const storedArticle = await harness.articles.getById(article.id);
    assert.equal(storedArticle?.status, "generation_failed");
    assert.equal(storedArticle?.contentVersion, 1);

    const events = await harness.articles.listStatusEvents(article.id);
    assert.deepEqual(
      events.map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        reason: event.reason
      })),
      [
        {
          fromStatus: "drafting",
          toStatus: "generation_failed",
          reason: "Generation failed: provider timeout"
        }
      ]
    );
  });

  it("regenerates a failed draft through the full generation scope", async () => {
    const adapter = new FakeTextGenerationAdapter(createGeneratedDraft({ title: "重试后的标题" }));
    const harness = createHarness(adapter);
    const article = await createArticle(harness.articles, undefined, "generation_failed");

    const result = await harness.service.regenerateDraft(article.id);

    assert.equal(result.status, "editing");
    assert.equal((await harness.articles.getById(article.id))?.title, "重试后的标题");
    assert.deepEqual(
      adapter.requests.map((request) => request.scope),
      ["full"]
    );
    assert.deepEqual(
      (await harness.articles.listStatusEvents(article.id)).map((event) => ({
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
        reason: event.reason
      })),
      [
        {
          fromStatus: "generation_failed",
          toStatus: "drafting",
          reason: "Retry draft generation"
        },
        {
          fromStatus: "drafting",
          toStatus: "editing",
          reason: "Draft generation succeeded"
        }
      ]
    );
  });
});

function createHarness(adapter: TextGenerationAdapter) {
  const store = createMemoryStore();
  const createId = createSequentialIdFactory();
  const articles = new InMemoryArticleRepository(store, fixedClock, createId);
  const images = new InMemoryImageRepository(store, fixedClock, createId);
  const service = new GenerationServiceImpl({ articles, images, adapter });

  return { articles, images, service };
}

async function createArticle(
  articles: InMemoryArticleRepository,
  config: Partial<GenerationConfig> = {},
  status: Article["status"] = "drafting"
): Promise<Article> {
  const generationConfig: GenerationConfig = {
    category: config.category ?? "tech_internet",
    topic: config.topic ?? "AI Agent",
    audience: config.audience,
    style: config.style,
    length: config.length,
    references: config.references,
    requireRiskNote: config.requireRiskNote ?? false
  };

  return articles.create({
    category: generationConfig.category,
    status,
    generationConfig
  });
}

function createGeneratedDraft(overrides: Partial<GeneratedArticleDraft> = {}): GeneratedArticleDraft {
  return {
    title: "AI Agent 产品观察",
    summary: "围绕 AI Agent 的产品变化做结构化分析。",
    body: "正文从背景、变化和趋势三部分展开。",
    riskNote: undefined,
    imageSuggestions: [
      {
        description: "科技互联网风格配图建议"
      }
    ],
    ...overrides
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

class FailingTextGenerationAdapter implements TextGenerationAdapter {
  private readonly error: Error;

  constructor(error: Error) {
    this.error = error;
  }

  async generateArticleDraft(): Promise<GeneratedArticleDraft> {
    throw this.error;
  }
}
