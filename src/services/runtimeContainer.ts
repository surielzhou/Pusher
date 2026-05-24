import type { GeneratedArticleDraft, TextGenerationAdapter, TextGenerationRequest } from "../adapters/ai/textGenerationAdapter.ts";
import type { ImageGenerationAdapter } from "../adapters/ai/imageGenerationAdapter.ts";
import type { AuthUser } from "../domain/permissions.ts";
import {
  InMemoryArticleRepository,
  InMemoryImageRepository,
  InMemoryPublishRepository,
  InMemoryReviewRepository,
  createMemoryStore,
  createSequentialIdFactory,
  systemClock,
  type RepositoryClock,
  type RepositoryIdFactory
} from "../repositories/index.ts";
import { ArticleServiceImpl } from "./articleService.ts";
import { AuthServiceImpl } from "./authService.ts";
import { ComplianceServiceImpl, type ComplianceService } from "./complianceService.ts";
import type {
  ArticleService,
  AuthService,
  ContentValidationService,
  EditorService,
  GenerationService,
  ImageService,
  MaterialService,
  PublishPreparationService,
  ReviewService
} from "./contracts.ts";
import { ContentValidationServiceImpl } from "./contentValidationService.ts";
import { EditorServiceImpl } from "./editorService.ts";
import { GenerationServiceImpl } from "./generationService.ts";
import { ImageServiceImpl } from "./imageService.ts";
import { MaterialServiceImpl } from "./materialService.ts";
import { PublishPreparationServiceImpl } from "./publishPreparationService.ts";
import { ReviewServiceImpl } from "./reviewService.ts";

export interface RuntimeContainer {
  authService: AuthService;
  articleService: ArticleService;
  generationService: GenerationService;
  imageService: ImageService;
  editorService: EditorService;
  reviewService: ReviewService;
  publishPreparationService: PublishPreparationService;
  contentValidationService: ContentValidationService;
  materialService: MaterialService;
  complianceService: ComplianceService;
}

export interface RuntimeContainerOptions {
  textGenerationAdapter?: TextGenerationAdapter;
  imageGenerationAdapter?: ImageGenerationAdapter;
  users?: readonly AuthUser[];
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
}

let runtimeContainer: RuntimeContainer | undefined;

export function getRuntimeContainer(): RuntimeContainer {
  runtimeContainer ??= createRuntimeContainer();
  return runtimeContainer;
}

export function createRuntimeContainer(options: RuntimeContainerOptions = {}): RuntimeContainer {
  const store = createMemoryStore();
  const now = options.now ?? systemClock;
  const createId = options.createId ?? createSequentialIdFactory();
  const articles = new InMemoryArticleRepository(store, now, createId);
  const images = new InMemoryImageRepository(store, now, createId);
  const reviews = new InMemoryReviewRepository(store, now, createId);
  const publishes = new InMemoryPublishRepository(store, now, createId);

  const complianceService = new ComplianceServiceImpl();
  const authService = new AuthServiceImpl({ users: options.users ?? DEFAULT_RUNTIME_USERS });
  const contentValidationService = new ContentValidationServiceImpl({ articles, images });
  const imageService = new ImageServiceImpl({
    articles,
    images,
    imageGenerationAdapter: options.imageGenerationAdapter
  });
  const articleService = new ArticleServiceImpl({ articles, images, reviews, publishes });
  const generationService = new GenerationServiceImpl({
    articles,
    images,
    adapter: options.textGenerationAdapter ?? new RuntimeTextGenerationAdapter()
  });
  const editorService = new EditorServiceImpl({
    articles,
    validation: contentValidationService
  });
  const reviewService = new ReviewServiceImpl({
    articles,
    images,
    reviews,
    compliance: complianceService
  });
  const publishPreparationService = new PublishPreparationServiceImpl({
    articles,
    images,
    publishes
  });
  const materialService = new MaterialServiceImpl({ imageService });

  return {
    authService,
    articleService,
    generationService,
    imageService,
    editorService,
    reviewService,
    publishPreparationService,
    contentValidationService,
    materialService,
    complianceService
  };
}

export function resetRuntimeContainerForTests(options: RuntimeContainerOptions = {}): RuntimeContainer {
  runtimeContainer = createRuntimeContainer(options);
  return runtimeContainer;
}

export function setRuntimeContainerForTests(container: RuntimeContainer): void {
  runtimeContainer = container;
}

const DEFAULT_RUNTIME_USERS: AuthUser[] = [
  {
    id: "runtime_admin",
    displayName: "Runtime Admin",
    roles: ["admin"],
    active: true
  }
];

class RuntimeTextGenerationAdapter implements TextGenerationAdapter {
  async generateArticleDraft(request: TextGenerationRequest): Promise<GeneratedArticleDraft> {
    const topic = request.config.topic;
    const audience = request.config.audience ?? "公众号读者";
    const instructionSuffix = request.instruction ? `\n\n补充指令：${request.instruction}` : "";

    return {
      title: `${topic}的结构化观察`,
      summary: `面向${audience}，梳理${topic}的背景、变化和执行要点。`,
      body: [
        `# ${topic}`,
        "",
        `本文围绕${topic}展开，先说明背景，再梳理关键变化，最后给出适合公众号运营的行动建议。`,
        "",
        "一、背景与问题：读者需要快速理解变化发生的原因，以及它和自身业务之间的关系。",
        "",
        "二、关键变化：从用户需求、产品形态、内容表达和执行流程四个角度组织信息。",
        "",
        `三、运营建议：保持事实清晰、观点克制，并根据${audience}的阅读场景安排标题、摘要和配图。`,
        instructionSuffix
      ].join("\n"),
      riskNote: request.config.requireRiskNote
        ? "本文仅作信息分享，不构成投资建议。市场有风险，决策需谨慎。"
        : undefined,
      imageSuggestions: [
        {
          description: `${topic}主题公众号封面图，突出结构化信息和运营场景`,
          position: "cover",
          altText: `${topic}主题配图`,
          source: "runtime_text_generation_adapter"
        }
      ]
    };
  }
}
