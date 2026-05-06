import type { Article, GenerationConfig } from "../../domain/article.ts";

export type GenerationScope = "full" | "title" | "summary" | "section" | "image_suggestion";

export interface GeneratedImageSuggestion {
  description: string;
  position?: string;
  altText?: string;
  source?: string;
}

export interface GeneratedArticleDraft {
  title: string;
  summary: string;
  body: string;
  riskNote?: string;
  imageSuggestions: GeneratedImageSuggestion[];
}

export interface TextGenerationRequest {
  articleId: string;
  config: GenerationConfig;
  scope: GenerationScope;
  instruction?: string;
  currentContent?: Pick<Article, "title" | "summary" | "body" | "riskNote" | "contentVersion">;
}

export interface TextGenerationAdapter {
  generateArticleDraft(request: TextGenerationRequest): Promise<GeneratedArticleDraft>;
}
