import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CATEGORY_OPTIONS,
  CREATE_ARTICLE_ENDPOINT,
  buildGenerationPayload,
  isGenerationInputReady,
  resolveArticleGenerationEndpoint,
  resolveGenerationFailureMessage,
  resolveGenerationRedirect
} from "../../src/components/article/generationFormModel.ts";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected article generation E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("article generation page", () => {
  it("shows generation inputs for all supported content categories", async () => {
    assert.deepEqual(
      CATEGORY_OPTIONS.map((option) => option.value),
      ["tech_internet", "finance", "literature"]
    );
    assert.deepEqual(
      CATEGORY_OPTIONS.map((option) => option.label),
      ["科技互联网", "金融", "文学"]
    );

    const formSource = await readFile("src/components/article/GenerationForm.tsx", "utf8");

    for (const label of ["内容方向", "主题或关键词", "目标读者", "文章风格", "篇幅要求", "参考素材"]) {
      assert.match(formSource, new RegExp(label));
    }
  });

  it("keeps generation unavailable until category and topic are present", () => {
    assert.equal(isGenerationInputReady({ category: "", topic: "AI Agent" }), false);
    assert.equal(isGenerationInputReady({ category: "tech_internet", topic: "   " }), false);
    assert.equal(isGenerationInputReady({ category: "tech_internet", topic: "AI Agent" }), true);
  });

  it("builds a trimmed creation and generation payload", () => {
    assert.deepEqual(
      buildGenerationPayload({
        category: "finance",
        topic: "  美联储降息路径  ",
        audience: "  普通投资者  ",
        style: " 深度分析 ",
        length: " 1500 字 ",
        references: "CPI 数据\n\n就业市场"
      }),
      {
        category: "finance",
        topic: "美联储降息路径",
        audience: "普通投资者",
        style: "深度分析",
        length: "1500 字",
        references: ["CPI 数据", "就业市场"],
        requireRiskNote: true
      }
    );
  });

  it("creates an article before generating a draft", async () => {
    const modelSource = await readRequiredSource("src/components/article/generationFormModel.ts");
    const formSource = await readRequiredSource("src/components/article/GenerationForm.tsx");
    const combinedSource = `${modelSource}\n${formSource}`;

    assertMatches(
      combinedSource,
      /CREATE_ARTICLE_ENDPOINT\s*=\s*"\/api\/articles"/,
      "generation form should create articles through the article API"
    );
    assertMatches(
      combinedSource,
      /resolveArticleGenerationEndpoint/,
      "generation form should resolve article-specific generation endpoint"
    );
    assertMatches(
      combinedSource,
      /\/generate/,
      "generation form should call the article generation endpoint after creation"
    );
  });

  it("wires submit to the generation endpoint and edit redirect", async () => {
    assert.equal(CREATE_ARTICLE_ENDPOINT, "/api/articles");
    assert.equal(resolveArticleGenerationEndpoint("article_123"), "/api/articles/article_123/generate");
    assert.equal(resolveGenerationRedirect("article_123"), "/articles/article_123/edit");
    assert.equal(resolveGenerationFailureMessage({ error: { message: "  服务暂不可用  " } }), "服务暂不可用");

    const pageSource = await readRequiredSource("src/app/articles/new/page.tsx");
    const formSource = await readRequiredSource("src/components/article/GenerationForm.tsx");

    assertMatches(pageSource, /<GenerationForm/, "new article route should render generation form");
    assertMatches(formSource, /export default function GenerationForm/, "generation form should export the component");
    assertMatches(formSource, /fetch\(CREATE_ARTICLE_ENDPOINT/, "generation form should create the article first");
    assertMatches(
      formSource,
      /fetch\(resolveArticleGenerationEndpoint\(articleId\)/,
      "generation form should generate after article creation"
    );
    assertMatches(
      formSource,
      /window\.location\.assign\(resolveGenerationRedirect/,
      "generation should redirect to editing"
    );
    assertMatches(
      formSource,
      /disabled=\{!canGenerate \|\| submitState === "submitting"\}/,
      "generation form should disable submit while unavailable or submitting"
    );
    assertMatches(formSource, /重试/, "generation form should support retry after failure");
  });

  it("reuses the created article when retrying generation after a failure", async () => {
    const formSource = await readRequiredSource("src/components/article/GenerationForm.tsx");

    assertMatches(
      formSource,
      /const\s+\[createdArticleId,\s*setCreatedArticleId\]\s*=\s*useState\(""\)/,
      "generation form should retain the created article id after article creation succeeds"
    );
    assertMatches(formSource, /setCreatedArticleId\(articleId\)/, "generation form should store the created article id");
    assertMatches(
      formSource,
      /if\s*\(!createdArticleId\)\s*\{[\s\S]*fetch\(CREATE_ARTICLE_ENDPOINT/,
      "generation form should skip article creation when retrying an existing created article"
    );
    assertMatches(
      formSource,
      /setCreatedArticleId\(""\)/,
      "generation form should clear the retained article id when generation inputs change"
    );
  });
});
