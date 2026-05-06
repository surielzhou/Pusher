import type { Article } from "../../domain/article.ts";
import type { ArticleImage } from "../../domain/image.ts";

export interface WechatManualExportResult {
  exportContent: string;
  imageChecklist: Array<Record<string, string>>;
}

export function exportWechatManualContent(article: Article, images: ArticleImage[]): WechatManualExportResult {
  const imageChecklist = images.map(toImageChecklistItem);
  const imageSection = imageChecklist.length > 0
    ? imageChecklist.map((item, index) => formatImageChecklistItem(item, index)).join("\n")
    : "无图片或配图建议。";

  return {
    exportContent: [
      `# ${article.title ?? ""}`,
      "",
      "## 摘要",
      article.summary ?? "",
      "",
      "## 正文",
      article.body ?? "",
      "",
      "## 图片清单",
      imageSection
    ].join("\n"),
    imageChecklist
  };
}

function toImageChecklistItem(image: ArticleImage): Record<string, string> {
  return withoutEmptyValues({
    id: image.id,
    type: image.type,
    description: image.description,
    position: image.position,
    url: image.url,
    source: image.source,
    altText: image.altText
  });
}

function formatImageChecklistItem(item: Record<string, string>, index: number): string {
  const lines = [`${index + 1}. ${item.description}`, `   - 类型：${item.type}`];
  if (item.position) lines.push(`   - 插入位置：${item.position}`);
  if (item.url) lines.push(`   - URL：${item.url}`);
  if (item.source) lines.push(`   - 来源：${item.source}`);
  if (item.altText) lines.push(`   - Alt 文案：${item.altText}`);

  return lines.join("\n");
}

function withoutEmptyValues(values: Record<string, string | undefined>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter((entry): entry is [string, string] => Boolean(entry[1]?.trim()))
  );
}
