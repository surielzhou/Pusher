import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildPrompt } from "../../../src/adapters/ai/promptStrategy.ts";
import type { ContentCategory } from "../../../src/domain/status.ts";
import type { GenerationConfig } from "../../../src/domain/article.ts";

function createConfig(category: ContentCategory): GenerationConfig {
  return {
    category,
    topic: "AI Agent",
    audience: "公众号读者",
    style: "分析型",
    length: "1500 字",
    references: ["参考材料 A"],
    requireRiskNote: category === "finance"
  };
}

describe("prompt strategy", () => {
  it("builds tech internet prompts with industry context, product or technology changes, and trend judgment", () => {
    const prompt = buildPrompt(createConfig("tech_internet"));

    assert.match(prompt, /行业背景/);
    assert.match(prompt, /技术|产品变化/);
    assert.match(prompt, /趋势判断/);
  });

  it("builds finance prompts with risk factors and non-investment-advice wording", () => {
    const prompt = buildPrompt(createConfig("finance"));

    assert.match(prompt, /风险因素/);
    assert.match(prompt, /非投资建议/);
  });

  it("builds literature prompts with theme expression, literary quality, and textual detail", () => {
    const prompt = buildPrompt(createConfig("literature"));

    assert.match(prompt, /主题表达/);
    assert.match(prompt, /文学性/);
    assert.match(prompt, /文本细节/);
  });

  it("requires title, summary, body, and image suggestions for every category", () => {
    const prompts = [
      buildPrompt(createConfig("tech_internet")),
      buildPrompt(createConfig("finance")),
      buildPrompt(createConfig("literature"))
    ];

    for (const prompt of prompts) {
      assert.match(prompt, /标题/);
      assert.match(prompt, /摘要/);
      assert.match(prompt, /正文/);
      assert.match(prompt, /配图建议/);
    }
  });
});
