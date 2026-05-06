import type { ImageService, MaterialAsset, MaterialListQuery, MaterialService } from "./contracts.ts";

export const DEFAULT_MATERIAL_ASSETS: MaterialAsset[] = [
  {
    id: "material_publish_checklist",
    title: "发布前检查清单",
    description: "适合封面或结尾总结的流程型清单视觉。",
    url: "/materials/publish-checklist.png",
    source: "curated_material_library",
    category: "tech_internet",
    tags: ["checklist", "publish", "workflow"],
    altText: "发布前检查清单视觉"
  },
  {
    id: "material_editor_workspace",
    title: "内容编辑工作台",
    description: "展示编辑桌面和公众号图文排版场景。",
    url: "/materials/editor-workspace.png",
    source: "curated_material_library",
    category: "tech_internet",
    tags: ["editor", "workspace", "article"],
    altText: "内容编辑工作台"
  },
  {
    id: "material_finance_risk_chart",
    title: "金融风险提示图表",
    description: "用于金融内容中的风险提示和免责声明段落。",
    url: "/materials/finance-risk-chart.png",
    source: "curated_material_library",
    category: "finance",
    tags: ["risk", "finance", "disclaimer"],
    altText: "金融风险提示图表"
  }
];

export class MaterialNotFoundError extends Error {
  readonly materialId: string;

  constructor(materialId: string) {
    super(`Material not found: ${materialId}`);
    this.name = "MaterialNotFoundError";
    this.materialId = materialId;
  }
}

export interface MaterialServiceDependencies {
  imageService: Pick<ImageService, "replaceImage">;
  materials?: MaterialAsset[];
}

export class MaterialServiceImpl implements MaterialService {
  private readonly imageService: Pick<ImageService, "replaceImage">;
  private readonly materials: MaterialAsset[];

  constructor(dependencies: MaterialServiceDependencies) {
    this.imageService = dependencies.imageService;
    this.materials = (dependencies.materials ?? DEFAULT_MATERIAL_ASSETS).map(cloneMaterial);
  }

  async listMaterials(query: MaterialListQuery = {}): Promise<{ items: MaterialAsset[] }> {
    const keyword = normalizeQueryText(query.keyword);
    const tag = normalizeQueryText(query.tag);

    const items = this.materials.filter((material) => {
      if (query.category && material.category !== query.category) return false;
      if (tag && !material.tags.some((materialTag) => materialTag.toLowerCase() === tag)) return false;
      if (keyword && !matchesKeyword(material, keyword)) return false;

      return true;
    });

    return {
      items: items.map(cloneMaterial)
    };
  }

  async selectMaterialForImage(input: {
    imageId: string;
    materialId: string;
  }): Promise<{ imageId: string; materialId: string; type: "material" }> {
    const material = this.materials.find((item) => item.id === input.materialId);
    if (!material) {
      throw new MaterialNotFoundError(input.materialId);
    }

    const result = await this.imageService.replaceImage({
      imageId: input.imageId,
      type: "material",
      url: material.url,
      source: `material_library:${material.id}`
    });

    return {
      imageId: result.imageId,
      materialId: material.id,
      type: "material"
    };
  }
}

export class RepositoryMaterialService extends MaterialServiceImpl {}

function normalizeQueryText(value?: string): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function matchesKeyword(material: MaterialAsset, keyword: string): boolean {
  const searchableText = [
    material.id,
    material.title,
    material.description,
    material.source,
    material.category,
    ...material.tags
  ]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(keyword);
}

function cloneMaterial(material: MaterialAsset): MaterialAsset {
  return {
    ...material,
    tags: [...material.tags]
  };
}
