import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { InMemorySourceRepository } from "../../../src/adapters/sources/memorySourceRepository.ts";
import {
  InMemoryArticleRepository,
  createMemoryStore,
  createSequentialIdFactory
} from "../../../src/repositories/index.ts";
import {
  SourceArticleNotFoundError,
  SourceNotFoundError,
  SourceServiceImpl,
  SourceValidationError
} from "../../../src/services/sourceService.ts";

function createSteppedClock() {
  let tick = 0;
  return () => {
    const value = new Date(Date.UTC(2026, 4, 6, 0, 0, tick));
    tick += 1;
    return value;
  };
}

function createHarness() {
  const now = createSteppedClock();
  const articles = new InMemoryArticleRepository(createMemoryStore(), now, createSequentialIdFactory());
  const sources = new InMemorySourceRepository([], now, createSequentialIdFactory());
  const service = new SourceServiceImpl({ articles, sources });

  return { articles, service, sources };
}

async function createArticle(articles: InMemoryArticleRepository) {
  return articles.create({
    category: "tech_internet",
    generationConfig: {
      category: "tech_internet",
      topic: "AI Agent 产品入口",
      requireRiskNote: false
    },
    status: "editing",
    title: "AI Agent 产品入口"
  });
}

describe("source service", () => {
  it("saves reference sources with citation summary, credibility, and unused status", async () => {
    const { articles, service } = createHarness();
    const article = await createArticle(articles);

    const saved = await service.saveSource(article.id, {
      title: "  OpenAI 产品更新  ",
      url: "  https://example.com/openai-update  ",
      provider: "  OpenAI  ",
      citationSummary: "  用于说明 Agent 产品入口变化  ",
      credibility: "high"
    });

    assert.equal(saved.id, "source_001");
    assert.equal(saved.articleId, article.id);
    assert.equal(saved.title, "OpenAI 产品更新");
    assert.equal(saved.url, "https://example.com/openai-update");
    assert.equal(saved.provider, "OpenAI");
    assert.equal(saved.citationSummary, "用于说明 Agent 产品入口变化");
    assert.equal(saved.credibility, "high");
    assert.equal(saved.usageStatus, "unused");
  });

  it("lists sources by article without exposing mutable repository state", async () => {
    const { articles, service } = createHarness();
    const article = await createArticle(articles);
    const otherArticle = await createArticle(articles);
    const first = await service.saveSource(article.id, {
      title: "行业报告",
      citationSummary: "用于补充行业背景",
      credibility: "medium"
    });
    const second = await service.saveSource(article.id, {
      title: "官方文档",
      citationSummary: "用于确认功能边界",
      credibility: "high"
    });
    await service.saveSource(otherArticle.id, {
      title: "其他文章来源",
      citationSummary: "不应出现在当前文章列表",
      credibility: "low"
    });

    const listed = await service.listSources(article.id);
    listed[0]!.title = "外部误改";

    assert.deepEqual(listed.map((source) => source.id), [first.id, second.id]);
    assert.deepEqual((await service.listSources(article.id)).map((source) => source.title), [
      "行业报告",
      "官方文档"
    ]);
  });

  it("marks whether a source has been used in the article body", async () => {
    const { articles, service } = createHarness();
    const article = await createArticle(articles);
    const source = await service.saveSource(article.id, {
      title: "监管公告",
      citationSummary: "用于正文中的政策事实点",
      credibility: "high"
    });

    const used = await service.markSourceUsed(article.id, source.id, true);
    const unused = await service.markSourceUsed(article.id, source.id, false);

    assert.equal(used.usageStatus, "used");
    assert.equal(unused.usageStatus, "unused");
  });

  it("raises structured errors for missing articles, invalid source input, and cross-article updates", async () => {
    const { articles, service } = createHarness();
    const article = await createArticle(articles);
    const otherArticle = await createArticle(articles);
    const source = await service.saveSource(article.id, {
      title: "事实来源",
      citationSummary: "用于正文事实点",
      credibility: "medium"
    });

    await assert.rejects(
      () =>
        service.saveSource("missing_article", {
          title: "事实来源",
          citationSummary: "用于正文事实点",
          credibility: "medium"
        }),
      (error) => {
        assert.equal(error instanceof SourceArticleNotFoundError, true);
        assert.equal((error as SourceArticleNotFoundError).articleId, "missing_article");
        return true;
      }
    );

    await assert.rejects(
      () =>
        service.saveSource(article.id, {
          title: " ",
          citationSummary: "用于正文事实点",
          credibility: "medium"
        }),
      (error) => {
        assert.equal(error instanceof SourceValidationError, true);
        assert.equal((error as SourceValidationError).field, "title");
        return true;
      }
    );

    await assert.rejects(
      () => service.markSourceUsed(otherArticle.id, source.id, true),
      (error) => {
        assert.equal(error instanceof SourceNotFoundError, true);
        assert.equal((error as SourceNotFoundError).sourceId, source.id);
        return true;
      }
    );
  });
});
