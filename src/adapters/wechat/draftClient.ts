import type { Article } from "../../domain/article.ts";
import type { ArticleImage } from "../../domain/image.ts";

export const WECHAT_DRAFT_CHANNEL = "wechat_draft" as const;

export interface WechatDraftImageUploadInput {
  imageId: string;
  url: string;
  description: string;
  altText?: string;
}

export interface WechatDraftUploadedImage {
  imageId: string;
  mediaId: string;
  description: string;
  position?: string;
}

export interface WechatDraftArticlePayload {
  title: string;
  digest: string;
  content: string;
  thumbMediaId?: string;
}

export interface WechatDraftCreateInput {
  article: WechatDraftArticlePayload;
  uploadedImages: WechatDraftUploadedImage[];
}

export interface WechatDraftClient {
  uploadImage(input: WechatDraftImageUploadInput): Promise<{ mediaId: string }>;
  createDraft(input: WechatDraftCreateInput): Promise<{ draftId: string }>;
}

export function toWechatDraftImageUploads(images: ArticleImage[]): WechatDraftImageUploadInput[] {
  return images
    .filter((image): image is ArticleImage & { url: string } => Boolean(image.url?.trim()))
    .map((image) => {
      const input: WechatDraftImageUploadInput = {
        imageId: image.id,
        url: image.url,
        description: image.description
      };

      if (image.altText?.trim()) {
        input.altText = image.altText;
      }

      return input;
    });
}

export function buildWechatDraftCreateInput(
  article: Article,
  images: ArticleImage[],
  uploadedImages: WechatDraftUploadedImage[]
): WechatDraftCreateInput {
  return {
    article: {
      title: article.title ?? "",
      digest: article.summary ?? "",
      content: renderWechatDraftContent(article, images, uploadedImages),
      thumbMediaId: uploadedImages[0]?.mediaId
    },
    uploadedImages
  };
}

function renderWechatDraftContent(
  article: Article,
  images: ArticleImage[],
  uploadedImages: WechatDraftUploadedImage[]
): string {
  const mediaIdByImageId = new Map(uploadedImages.map((image) => [image.imageId, image.mediaId]));
  const imageLines = images.map((image) => {
    const mediaId = mediaIdByImageId.get(image.id);
    const parts = [image.description];
    if (image.position) parts.push(`位置：${image.position}`);
    if (mediaId) parts.push(`media_id：${mediaId}`);
    if (!mediaId && image.type === "suggestion") parts.push("待人工配图");

    return `<p>[图片] ${escapeHtml(parts.join(" / "))}</p>`;
  });

  return [
    ...splitParagraphs(article.body ?? "").map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`),
    ...imageLines
  ].join("\n");
}

function splitParagraphs(content: string): string[] {
  return content
    .split(/\n+/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
