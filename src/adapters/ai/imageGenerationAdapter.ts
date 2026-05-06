import type { ContentCategory } from "../../domain/status.ts";

export interface ImageGenerationRequest {
  articleId: string;
  imageId: string;
  category: ContentCategory;
  topic: string;
  description: string;
  position?: string;
  altText?: string;
  instruction?: string;
}

export interface GeneratedImageAsset {
  url: string;
  source: string;
  altText?: string;
}

export interface ImageGenerationAdapter {
  generateImage(request: ImageGenerationRequest): Promise<GeneratedImageAsset>;
}
