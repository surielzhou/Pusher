import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CATEGORY_OPTIONS,
  GENERATION_ENDPOINT,
  buildGenerationPayload,
  isGenerationInputReady,
  resolveGenerationRedirect
} from "../../src/components/article/generationFormModel.ts";

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

  it("wires submit to the generation endpoint and edit redirect", async () => {
    assert.equal(GENERATION_ENDPOINT, "/api/articles/generation");
    assert.equal(resolveGenerationRedirect("article_123"), "/articles/article_123/edit");

    const pageSource = await readFile("src/app/articles/new/page.tsx", "utf8");
    const formSource = await readFile("src/components/article/GenerationForm.tsx", "utf8");

    assert.match(pageSource, /<GenerationForm/);
    assert.match(formSource, /export default function GenerationForm/);
    assert.match(formSource, /fetch\(GENERATION_ENDPOINT/);
    assert.match(formSource, /window\.location\.assign\(resolveGenerationRedirect/);
    assert.match(formSource, /disabled=\{!canGenerate \|\| submitState === "submitting"\}/);
    assert.match(formSource, /重试/);
  });
});
