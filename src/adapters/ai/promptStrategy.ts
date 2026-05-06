import type { GenerationConfig } from "../../domain/article.ts";

const categoryInstructions: Record<GenerationConfig["category"], string[]> = {
  tech_internet: [
    "写作重点：交代行业背景，说明关键技术或产品变化，并给出趋势判断。",
    "分析角度：连接用户需求、产品形态、商业模式和技术成熟度。"
  ],
  finance: [
    "写作重点：说明市场背景、风险因素和可能影响，并使用非投资建议表达。",
    "合规要求：避免收益承诺，单独输出风险提示。"
  ],
  literature: [
    "写作重点：突出主题表达、文学性和文本细节。",
    "表达要求：保留细腻描写、情绪层次和可读的叙事节奏。"
  ]
};

export function buildPrompt(config: GenerationConfig): string {
  const references = config.references?.length ? config.references.join("\n") : "无";

  return [
    "你是公众号图文写作助手，请根据生成配置生成一篇可编辑草稿。",
    "",
    "生成配置：",
    `- 内容方向：${config.category}`,
    `- 主题：${config.topic}`,
    `- 目标读者：${config.audience ?? "公众号读者"}`,
    `- 文章风格：${config.style ?? "清晰、可信、适合公众号阅读"}`,
    `- 篇幅要求：${config.length ?? "中等篇幅"}`,
    `- 参考素材：${references}`,
    "",
    "方向策略：",
    ...categoryInstructions[config.category].map((instruction) => `- ${instruction}`),
    "",
    "输出要求：",
    "- 标题：给出一个适合公众号传播的标题。",
    "- 摘要：用 2-3 句话概括核心内容。",
    "- 正文：输出完整正文，结构清晰，段落可直接编辑。",
    "- 配图建议：至少给出一条图片描述、出现位置和替代文本建议。",
    config.requireRiskNote ? "- 风险提示：必须包含非投资建议声明。" : "- 风险提示：如主题涉及金融风险，请补充审慎表达。"
  ].join("\n");
}
