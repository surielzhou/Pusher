export const IMAGE_TYPES = ["suggestion", "generated", "uploaded", "material", "external"] as const;

export type ImageType = (typeof IMAGE_TYPES)[number];

export interface ArticleImage {
  id: string;
  articleId: string;
  type: ImageType;
  url?: string;
  description: string;
  source?: string;
  position?: string;
  altText?: string;
  createdAt: Date;
  updatedAt: Date;
}
