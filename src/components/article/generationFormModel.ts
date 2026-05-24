import { CONTENT_CATEGORIES, type ContentCategory } from "../../domain/status.ts";

export interface CategoryOption {
  value: ContentCategory;
  label: string;
  detail: string;
}

export interface GenerationFormInput {
  category?: ContentCategory | "";
  topic: string;
  audience?: string;
  style?: string;
  length?: string;
  references?: string;
}

export interface GenerationRequestPayload {
  category: ContentCategory;
  topic: string;
  audience?: string;
  style?: string;
  length?: string;
  references?: string[];
  requireRiskNote: boolean;
}

export interface GenerationFailurePayload {
  error?: string | { message?: string };
  message?: string;
  reason?: string;
}

export const CREATE_ARTICLE_ENDPOINT = "/api/articles";

export const CATEGORY_OPTIONS: CategoryOption[] = [
  {
    value: "tech_internet",
    label: "科技互联网",
    detail: "行业背景、产品变化、技术趋势"
  },
  {
    value: "finance",
    label: "金融",
    detail: "市场观察、风险因素、非投资建议"
  },
  {
    value: "literature",
    label: "文学",
    detail: "主题表达、文学性、文本细节"
  }
];

export function isGenerationInputReady(input: GenerationFormInput): boolean {
  return isContentCategory(input.category) && input.topic.trim().length > 0;
}

export function buildGenerationPayload(input: GenerationFormInput): GenerationRequestPayload {
  if (!isContentCategory(input.category)) {
    throw new Error("请选择内容方向");
  }

  const topic = input.topic.trim();
  if (!topic) {
    throw new Error("请填写主题或关键词");
  }

  return compactPayload({
    category: input.category,
    topic,
    audience: normalizeOptionalText(input.audience),
    style: normalizeOptionalText(input.style),
    length: normalizeOptionalText(input.length),
    references: normalizeReferences(input.references),
    requireRiskNote: input.category === "finance"
  });
}

export function normalizeReferences(references?: string): string[] | undefined {
  const items = references
    ?.split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items && items.length > 0 ? items : undefined;
}

export function resolveGenerationRedirect(articleId: string): string {
  const normalizedArticleId = articleId.trim();
  if (!normalizedArticleId) {
    throw new Error("生成接口没有返回文章 ID");
  }

  return `/articles/${encodeURIComponent(normalizedArticleId)}/edit`;
}

export function resolveArticleGenerationEndpoint(articleId: string): string {
  const normalizedArticleId = articleId.trim();
  if (!normalizedArticleId) {
    throw new Error("生成接口没有返回文章 ID");
  }

  return `/api/articles/${encodeURIComponent(normalizedArticleId)}/generate`;
}

export function resolveGenerationFailureMessage(payload?: GenerationFailurePayload | null): string {
  const nestedError = typeof payload?.error === "object" ? payload.error.message : payload?.error;
  return normalizeOptionalText(payload?.message ?? nestedError ?? payload?.reason) ?? "生成失败，请重试。";
}

function isContentCategory(value: unknown): value is ContentCategory {
  return typeof value === "string" && CONTENT_CATEGORIES.includes(value as ContentCategory);
}

function normalizeOptionalText(value?: string): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function compactPayload(payload: GenerationRequestPayload): GenerationRequestPayload {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as GenerationRequestPayload;
}
