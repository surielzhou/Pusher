import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import {
  ArticleNotFoundError,
  ArticleImageNotEditableError,
  ImageNotFoundError,
  ImageServiceImpl
} from "../../../src/services/imageService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const images = new InMemoryImageRepository(store, fixedNow);
  const imageService = new ImageServiceImpl({ articles, images });

  return { articles, images, imageService };
}

async function createArticle(
  articles: InMemoryArticleRepository,
  input: { status?: "editing" | "approved" | "pending_review"; title?: string } = {}
) {
  return articles.create({
    category: "tech_internet",
    title: input.title ?? "AI Agent 正在改变产品入口",
    body: "正文",
    status: input.status ?? "editing",
    generationConfig: {
      category: "tech_internet",
      topic: "AI Agent",
      requireRiskNote: false
    }
  });
}

describe("image service", () => {
  it("lists article images in repository order", async () => {
    const { articles, imageService } = createHarness();
    const article = await createArticle(articles);
    const first = await imageService.saveImageSuggestion({
      articleId: article.id,
      description: "摘要后使用数据看板风格配图"
    });
    const second = await imageService.saveImageSuggestion({
      articleId: article.id,
      description: "结尾使用产品界面示意图"
    });

    const result = await imageService.listArticleImages(article.id);

    assert.deepEqual(result.items.map((image) => image.id), [first.imageId, second.imageId]);
  });

  it("saves image suggestions with required descriptions", async () => {
    const { articles, imageService } = createHarness();
    const article = await createArticle(articles);

    const result = await imageService.saveImageSuggestion({
      articleId: article.id,
      description: "摘要后使用数据看板风格配图",
      position: "summary_after",
      altText: "数据看板配图"
    });

    assert.equal(result.type, "suggestion");

    const [stored] = (await imageService.listArticleImages(article.id)).items;
    assert.equal(stored.id, result.imageId);
    assert.equal(stored.type, "suggestion");
    assert.equal(stored.description, "摘要后使用数据看板风格配图");
    assert.equal(stored.position, "summary_after");
    assert.equal(stored.altText, "数据看板配图");

    await assert.rejects(
      () => imageService.saveImageSuggestion({ articleId: article.id, description: " " }),
      /Image description is required/
    );
  });

  it("requires url and source when replacing an image with an uploaded image", async () => {
    const { articles, imageService } = createHarness();
    const article = await createArticle(articles);
    const suggestion = await imageService.saveImageSuggestion({
      articleId: article.id,
      description: "封面图建议"
    });

    await assert.rejects(
      () => imageService.replaceImage({
        imageId: suggestion.imageId,
        type: "uploaded",
        url: " ",
        source: "manual_upload"
      }),
      /Image url is required/
    );

    await assert.rejects(
      () => imageService.replaceImage({
        imageId: suggestion.imageId,
        type: "uploaded",
        url: "/uploads/cover.png",
        source: " "
      }),
      /Image source is required/
    );

    const replaced = await imageService.replaceImage({
      imageId: suggestion.imageId,
      type: "uploaded",
      url: "/uploads/cover.png",
      source: "manual_upload"
    });

    assert.deepEqual(replaced, {
      imageId: suggestion.imageId,
      type: "uploaded"
    });

    const [stored] = (await imageService.listArticleImages(article.id)).items;
    assert.equal(stored.type, "uploaded");
    assert.equal(stored.url, "/uploads/cover.png");
    assert.equal(stored.source, "manual_upload");
  });

  it("increments article content version after image changes", async () => {
    const { articles, imageService } = createHarness();
    const article = await createArticle(articles);

    const suggestion = await imageService.saveImageSuggestion({
      articleId: article.id,
      description: "封面图建议"
    });
    assert.equal((await articles.getById(article.id))?.contentVersion, 2);

    await imageService.replaceImage({
      imageId: suggestion.imageId,
      type: "external",
      url: "https://example.com/cover.png",
      source: "external_search"
    });

    assert.equal((await articles.getById(article.id))?.contentVersion, 3);
  });

  it("moves approved articles back to editing after image changes", async () => {
    const { articles, imageService } = createHarness();
    const article = await createArticle(articles, { status: "approved" });

    await imageService.saveImageSuggestion({
      articleId: article.id,
      description: "封面图建议"
    });

    const updated = await articles.getById(article.id);
    assert.equal(updated?.status, "editing");
    assert.equal(updated?.contentVersion, 2);
  });

  it("rejects image changes while an article is pending review", async () => {
    const { articles, imageService } = createHarness();
    const editableArticle = await createArticle(articles);
    const suggestion = await imageService.saveImageSuggestion({
      articleId: editableArticle.id,
      description: "封面图建议"
    });
    const pendingReviewArticle = await articles.update(editableArticle.id, { status: "pending_review" });

    await assert.rejects(
      () => imageService.saveImageSuggestion({
        articleId: pendingReviewArticle.id,
        description: "不应新增的配图建议"
      }),
      (error) => {
        assert.equal(error instanceof ArticleImageNotEditableError, true);
        assert.equal((error as ArticleImageNotEditableError).articleId, pendingReviewArticle.id);
        assert.equal((error as ArticleImageNotEditableError).status, "pending_review");
        return true;
      }
    );

    await assert.rejects(
      () => imageService.replaceImage({
        imageId: suggestion.imageId,
        type: "external",
        url: "https://example.com/cover.png",
        source: "external_search"
      }),
      ArticleImageNotEditableError
    );

    const images = await imageService.listArticleImages(pendingReviewArticle.id);
    assert.equal(images.items.length, 1);
    assert.equal(images.items[0]?.type, "suggestion");
    assert.equal((await articles.getById(pendingReviewArticle.id))?.contentVersion, 2);
  });

  it("throws structured errors for missing article and image records", async () => {
    const { imageService } = createHarness();

    await assert.rejects(
      () => imageService.listArticleImages("article_missing"),
      (error) => {
        assert.equal(error instanceof ArticleNotFoundError, true);
        assert.equal((error as ArticleNotFoundError).articleId, "article_missing");
        return true;
      }
    );

    await assert.rejects(
      () => imageService.replaceImage({
        imageId: "image_missing",
        type: "uploaded",
        url: "/uploads/cover.png",
        source: "manual_upload"
      }),
      (error) => {
        assert.equal(error instanceof ImageNotFoundError, true);
        assert.equal((error as ImageNotFoundError).imageId, "image_missing");
        return true;
      }
    );
  });
});
