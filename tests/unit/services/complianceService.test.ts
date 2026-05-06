import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ComplianceServiceImpl } from "../../../src/services/complianceService.ts";

const baseArticle = {
  id: "article_001",
  category: "finance",
  status: "pending_review",
  generationConfig: {
    category: "finance",
    topic: "市场观察",
    requireRiskNote: true
  },
  contentVersion: 1,
  createdAt: new Date("2026-05-06T00:00:00.000Z"),
  updatedAt: new Date("2026-05-06T00:00:00.000Z")
} as const;

describe("compliance service", () => {
  it("returns not applicable for non-finance articles", () => {
    const compliance = new ComplianceServiceImpl();

    const report = compliance.analyzeArticle({
      ...baseArticle,
      category: "tech_internet",
      generationConfig: {
        category: "tech_internet",
        topic: "AI Agent",
        requireRiskNote: false
      }
    });

    assert.deepEqual(report, {
      status: "not_applicable",
      requiredDisclaimer: undefined,
      issues: []
    });
  });

  it("passes finance articles with disclaimer and no risky expressions", () => {
    const compliance = new ComplianceServiceImpl();

    const report = compliance.analyzeArticle({
      ...baseArticle,
      title: "市场观察",
      summary: "讨论行业变化和不确定性。",
      body: "本文仅做公开信息整理，不构成任何投资建议。市场有风险，决策需谨慎。",
      riskNote: "市场有风险，本文不构成投资建议。"
    });

    assert.deepEqual(report, {
      status: "passed",
      requiredDisclaimer: "本文仅为信息分享，不构成任何投资建议。市场有风险，决策需谨慎。",
      issues: []
    });
  });

  it("flags missing disclaimer, sensitive words, and risky expressions for finance content", () => {
    const compliance = new ComplianceServiceImpl();

    const report = compliance.analyzeArticle({
      ...baseArticle,
      title: "稳赚不赔的机会",
      summary: "这类产品可以保证收益。",
      body: "内幕消息显示明天必涨。",
      riskNote: ""
    });

    assert.equal(report.status, "needs_attention");
    assert.equal(report.requiredDisclaimer, "本文仅为信息分享，不构成任何投资建议。市场有风险，决策需谨慎。");
    assert.deepEqual(
      report.issues.map((issue) => [issue.code, issue.term]),
      [
        ["finance_disclaimer_missing", undefined],
        ["finance_sensitive_word", "内幕消息"],
        ["finance_risky_expression", "稳赚不赔"],
        ["finance_risky_expression", "保证收益"],
        ["finance_risky_expression", "必涨"]
      ]
    );
  });
});
