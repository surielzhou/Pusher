import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  createMemoryStore
} from "../../../src/repositories/index.ts";
import { ImageServiceImpl, ArticleImageNotEditableError } from "../../../src/services/imageService.ts";
import {
  DEFAULT_MATERIAL_ASSETS,
  MaterialNotFoundError,
  MaterialServiceImpl
} from "../../../src/services/materialService.ts";

const fixedNow = () => new Date("2026-05-06T00:00:00.000Z");

function createHarness() {
  const store = createMemoryStore();
  const articles = new InMemoryArticleRepository(store, fixedNow);
  const images = new InMemoryImageRepository(store, fixedNow);
  const imageService = new ImageServiceImpl({ articles, images });
  const materialService = new MaterialServiceImpl({ imageService });

  return { articles, images, imageService, materialService };
}

async function createEditableImage(articles: InMemoryArticleRepository, imageService: ImageServiceImpl) {
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
  const image = await imageService.saveImageSuggestion({
    articleId: article.id,
    description: "封面图建议",
    position: "封面",
    altText: "封面图"
  });

  return { article, image };
}

describe("material service", () => {
  it("lists default material assets and filters by category, tag, and keyword", async () => {
    const { materialService } = createHarness();

    const allMaterials = await materialService.listMaterials();
    assert.deepEqual(
      allMaterials.items.map((material) => material.id),
      DEFAULT_MATERIAL_ASSETS.map((material) => material.id)
    );

    const financeMaterials = await materialService.listMaterials({ category: "finance" });
    assert.equal(financeMaterials.items.length, 1);
    assert.equal(financeMaterials.items[0]?.id, "material_finance_risk_chart");

    const checklistMaterials = await materialService.listMaterials({ tag: "checklist" });
    assert.deepEqual(checklistMaterials.items.map((material) => material.id), ["material_publish_checklist"]);

    const keywordMaterials = await materialService.listMaterials({ keyword: "工作台" });
    assert.deepEqual(keywordMaterials.items.map((material) => material.id), ["material_editor_workspace"]);
  });

  it("selects a material image for an editable article image", async () => {
    const { articles, imageService, materialService } = createHarness();
    const { article, image } = await createEditableImage(articles, imageService);

    const result = await materialService.selectMaterialForImage({
      imageId: image.imageId,
      materialId: "material_editor_workspace"
    });

    assert.deepEqual(result, {
      imageId: image.imageId,
      materialId: "material_editor_workspace",
      type: "material"
    });

    const [stored] = (await imageService.listArticleImages(article.id)).items;
    assert.equal(stored.type, "material");
    assert.equal(stored.url, "/materials/editor-workspace.png");
    assert.equal(stored.source, "material_library:material_editor_workspace");
    assert.equal((await articles.getById(article.id))?.contentVersion, 3);
  });

  it("throws a structured error when selecting an unknown material", async () => {
    const { articles, imageService, materialService } = createHarness();
    const { article, image } = await createEditableImage(articles, imageService);

    await assert.rejects(
      () =>
        materialService.selectMaterialForImage({
          imageId: image.imageId,
          materialId: "material_missing"
        }),
      (error) => {
        assert.equal(error instanceof MaterialNotFoundError, true);
        assert.equal((error as MaterialNotFoundError).materialId, "material_missing");
        return true;
      }
    );

    const [stored] = (await imageService.listArticleImages(article.id)).items;
    assert.equal(stored.type, "suggestion");
    assert.equal((await articles.getById(article.id))?.contentVersion, 2);
  });

  it("keeps article edit gates when selecting a material", async () => {
    const { articles, imageService, materialService } = createHarness();
    const { article, image } = await createEditableImage(articles, imageService);
    await articles.update(article.id, { status: "pending_review" });

    await assert.rejects(
      () =>
        materialService.selectMaterialForImage({
          imageId: image.imageId,
          materialId: "material_publish_checklist"
        }),
      ArticleImageNotEditableError
    );
  });
});
