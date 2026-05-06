import type { Article } from "../domain/article.ts";

export type ComplianceStatus = "not_applicable" | "passed" | "needs_attention";

export type ComplianceIssueCode =
  | "finance_disclaimer_missing"
  | "finance_sensitive_word"
  | "finance_risky_expression";

export interface ComplianceIssue {
  code: ComplianceIssueCode;
  severity: "warning";
  message: string;
  recommendation: string;
  term?: string;
}

export interface ComplianceReport {
  status: ComplianceStatus;
  requiredDisclaimer?: string;
  issues: ComplianceIssue[];
}

export type ComplianceArticleInput = Partial<
  Pick<Article, "category" | "title" | "summary" | "body" | "riskNote">
>;

export interface ComplianceService {
  analyzeArticle(article: ComplianceArticleInput): ComplianceReport;
}

export const FINANCE_REQUIRED_DISCLAIMER = "本文仅为信息分享，不构成任何投资建议。市场有风险，决策需谨慎。";

const FINANCE_SENSITIVE_TERMS = ["内幕消息", "荐股群", "坐庄", "操盘"] as const;
const FINANCE_RISKY_EXPRESSIONS = ["稳赚不赔", "保证收益", "必涨", "无风险", "保本保收益"] as const;

export class ComplianceServiceImpl implements ComplianceService {
  analyzeArticle(article: ComplianceArticleInput): ComplianceReport {
    if (article.category !== "finance") {
      return {
        status: "not_applicable",
        requiredDisclaimer: undefined,
        issues: []
      };
    }

    const text = normalizeText([article.title, article.summary, article.body, article.riskNote].join("\n"));
    const issues: ComplianceIssue[] = [];

    if (!hasFinanceDisclaimer(text)) {
      issues.push({
        code: "finance_disclaimer_missing",
        severity: "warning",
        message: "金融内容缺少免责声明。",
        recommendation: `补充免责声明：${FINANCE_REQUIRED_DISCLAIMER}`
      });
    }

    for (const term of FINANCE_SENSITIVE_TERMS) {
      if (text.includes(term)) {
        issues.push({
          code: "finance_sensitive_word",
          severity: "warning",
          term,
          message: `发现敏感词：${term}`,
          recommendation: "改写为公开信息来源和审慎分析表述。"
        });
      }
    }

    for (const term of FINANCE_RISKY_EXPRESSIONS) {
      if (text.includes(term)) {
        issues.push({
          code: "finance_risky_expression",
          severity: "warning",
          term,
          message: `发现高风险收益表达：${term}`,
          recommendation: "删除收益承诺或确定性涨跌判断，改为风险中性的观察表达。"
        });
      }
    }

    return {
      status: issues.length > 0 ? "needs_attention" : "passed",
      requiredDisclaimer: FINANCE_REQUIRED_DISCLAIMER,
      issues
    };
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "");
}

function hasFinanceDisclaimer(text: string): boolean {
  return text.includes("不构成") && text.includes("投资建议") && text.includes("风险");
}
