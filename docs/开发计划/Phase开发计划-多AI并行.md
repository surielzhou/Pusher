# 公众号图文生成与发布准备 Phase 开发计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 分阶段实现公众号图文内容生成、编辑、发布前 review 和发布准备闭环，并让后续开发尽可能支持多个 AI worker 并行推进。

**Architecture:** 采用契约先行、状态驱动、模块隔离的实现方式。Phase 0 先冻结领域模型、状态机和目标目录结构；后续每个 phase 按服务、页面、测试和适配器拆分独立写入边界，减少多个 AI 同时开发时的冲突。

**Tech Stack:** 建议使用 TypeScript、Next.js、SQLite 或 PostgreSQL、Prisma、Vitest、Playwright。若最终技术栈调整，保留本文的模块边界、状态规则、服务接口和并行开发协议。

---

## 计划输入

- `docs/需求/初版需求故事.md`
- `docs/设计/用户动线拆分.md`
- `docs/设计/概要设计.md`
- `docs/设计/功能模块划分与需求动线Review.md`
- `docs/设计/详细设计.md`

## 多 AI 并行开发原则

### 总体规则

- 契约先行：领域模型、枚举、状态机、服务接口和测试夹具先落地，后续 AI worker 只能基于契约扩展。
- 写入边界明确：每个 AI worker 只修改自己负责的文件集合。
- 共享文件收敛：`package.json`、数据库 schema、路由总入口、全局样式和公共类型由协调者或单独 worker 维护。
- 先测后改：每个任务必须包含测试文件、最小实现和验证命令。
- 小步合并：每个 worker 完成一个可验证工作包后提交，不跨 phase 扩张范围。
- 接口稳定：跨模块协作只通过 `src/domain`、`src/services`、`src/repositories`、`src/adapters` 中定义的接口。

### 并行开发约束

| 约束 | 规则 |
| --- | --- |
| 不共享写同一文件 | 两个 AI worker 不同时修改同一源文件 |
| 不绕过领域契约 | 页面和服务不得自行定义状态枚举 |
| 不直接跨层访问 | 页面调用服务，服务调用 repository 或 adapter |
| 不直接发布未审核文章 | 发布准备模块必须调用状态校验 |
| 不混合 review 和编辑 | Review 页不直接编辑正文，退回后进入图文编辑页 |
| 不把扩展项混入 MVP | AI 图片、素材库、公众号接口自动发布放到增强 phase |

### 推荐分支与工作区

每个 AI worker 使用独立分支或独立 worktree：

```text
feature/phase-0-contracts
feature/phase-1-domain-state
feature/phase-2-generation
feature/phase-3-editor-image
feature/phase-4-review
feature/phase-5-publish-history
feature/phase-6-acceptance
```

合并顺序：

```text
Phase 0 -> Phase 1 -> Phase 2/3 -> Phase 4 -> Phase 5 -> Phase 6
```

Phase 2 和 Phase 3 可以在 Phase 1 完成后并行。Phase 4 依赖 Phase 1 和 Phase 3。Phase 5 依赖 Phase 4。

## 目标目录结构

后续实现建议采用以下结构，便于按模块分配 AI worker：

```text
src/
  app/
    workbench/
    articles/
      new/
      [articleId]/
        edit/
        review/
        publish/
    history/
  components/
    article/
    review/
    publish/
    workbench/
  domain/
    article.ts
    image.ts
    review.ts
    publish.ts
    status.ts
    validation.ts
  services/
    articleService.ts
    generationService.ts
    imageService.ts
    editorService.ts
    reviewService.ts
    publishPreparationService.ts
    auditLogService.ts
  repositories/
    articleRepository.ts
    imageRepository.ts
    reviewRepository.ts
    publishRepository.ts
    auditLogRepository.ts
  adapters/
    ai/
      textGenerationAdapter.ts
      promptStrategy.ts
    export/
      wechatManualExporter.ts
  test/
    fixtures/
    helpers/
tests/
  unit/
  integration/
  e2e/
```

共享契约文件：

- `src/domain/article.ts`
- `src/domain/image.ts`
- `src/domain/review.ts`
- `src/domain/publish.ts`
- `src/domain/status.ts`
- `src/domain/validation.ts`

共享契约文件只允许 Phase 0 或协调者修改。后续 worker 如需变更，需要先更新详细设计和计划。

## Phase 总览

| Phase | 目标 | 并行度 | 主要输出 |
| --- | --- | --- | --- |
| Phase 0 | 工程骨架与契约冻结 | 低 | 项目脚手架、领域类型、状态机接口、测试基线 |
| Phase 1 | 数据模型、状态流转、校验 | 中 | repository、状态流转、内容完整性校验 |
| Phase 2 | 创建与图文生成链路 | 高 | 生成配置、AI 文本生成适配、配图建议 |
| Phase 3 | 图文编辑与图片配图 | 高 | 编辑服务、图片服务、编辑页面 |
| Phase 4 | Review 审核链路 | 中 | 审核服务、审核页面、审核记录 |
| Phase 5 | 发布准备、工作台、历史文章 | 高 | 发布导出、工作台、历史筛选 |
| Phase 6 | 集成测试、验收和部署准备 | 中 | E2E、验收清单、部署文档 |
| Phase 7 | 增强能力 | 高 | AI 图片、素材库、公众号接口、金融合规 |

## Phase 0：工程骨架与契约冻结

### 目标

建立可运行、可测试、可多人并行开发的工程基线，并冻结核心领域契约。

### 依赖

无。

### 可并行工作包

Phase 0 共享文件较多，建议由 1 个主 worker 执行，另 1 个 reviewer worker 只做文档和契约 review，不直接改代码。

### 计划任务

#### Task 0.1：初始化项目骨架

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `playwright.config.ts`
- Create: `src/app/workbench/page.tsx`
- Create: `tests/unit/smoke.test.ts`

- [ ] 初始化 Next.js 或等价前端应用骨架。
- [ ] 配置 TypeScript 严格模式。
- [ ] 配置 Vitest 单元测试。
- [ ] 配置 Playwright E2E 测试。
- [ ] 创建工作台占位页面。
- [ ] 创建 smoke test，验证测试命令可运行。
- [ ] 运行 `npm test`，预期 unit smoke test 通过。
- [ ] 运行 `npm run build`，预期构建通过。

#### Task 0.2：定义领域枚举与基础类型

**Files:**

- Create: `src/domain/article.ts`
- Create: `src/domain/image.ts`
- Create: `src/domain/review.ts`
- Create: `src/domain/publish.ts`
- Create: `src/domain/status.ts`
- Test: `tests/unit/domain/status.test.ts`

- [ ] 定义 `ContentCategory`：`tech_internet`、`finance`、`literature`。
- [ ] 定义 `ArticleStatus`：`drafting`、`generation_failed`、`editing`、`pending_review`、`review_rejected`、`approved`、`not_publish`、`pending_publish`、`publish_failed`、`published`。
- [ ] 定义 `ImageType`、`ReviewResult`、`PublishStatus`。
- [ ] 定义 `Article`、`GenerationConfig`、`ArticleImage`、`ReviewRecord`、`PublishRecord`、`ArticleStatusEvent` 类型。
- [ ] 写测试验证枚举值和详细设计一致。
- [ ] 运行 `npm test -- tests/unit/domain/status.test.ts`，预期通过。

#### Task 0.3：定义服务接口契约

**Files:**

- Create: `src/services/contracts.ts`
- Test: `tests/unit/services/contracts.test.ts`

- [ ] 定义 `ArticleService` 接口。
- [ ] 定义 `GenerationService` 接口。
- [ ] 定义 `ImageService` 接口。
- [ ] 定义 `EditorService` 接口。
- [ ] 定义 `ReviewService` 接口。
- [ ] 定义 `PublishPreparationService` 接口。
- [ ] 定义 `ContentValidationService` 接口。
- [ ] 写类型测试或编译测试，验证接口能被 mock 实现。
- [ ] 运行 `npm test -- tests/unit/services/contracts.test.ts`，预期通过。

### Phase 0 验收

- 工程能安装、测试、构建。
- 领域枚举和详细设计一致。
- 服务接口可供后续 phase 并行实现。
- 共享契约文件进入冻结状态。

## Phase 1：数据模型、状态流转、内容校验

### 目标

实现文章生命周期的核心规则：数据存储、状态流转和提交 review 前校验。

### 依赖

Phase 0 完成。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-1A 状态流转 | `src/domain/status.ts`、`src/services/articleStatusService.ts`、`tests/unit/services/articleStatusService.test.ts` | 只处理状态合法性 |
| AI-1B 数据存储 | `src/repositories/**`、`tests/unit/repositories/**` | 只处理 repository |
| AI-1C 内容校验 | `src/domain/validation.ts`、`src/services/contentValidationService.ts`、`tests/unit/services/contentValidationService.test.ts` | 只处理校验 |

### 计划任务

#### Task 1.1：实现状态流转服务

**Files:**

- Create: `src/services/articleStatusService.ts`
- Test: `tests/unit/services/articleStatusService.test.ts`

- [ ] 写测试覆盖合法流转：`drafting -> editing`、`editing -> pending_review`、`pending_review -> approved`、`approved -> pending_publish`、`pending_publish -> published`。
- [ ] 写测试覆盖非法流转：`pending_review -> pending_publish`、`not_publish -> pending_publish`、`review_rejected -> pending_publish`。
- [ ] 实现 `canTransition(fromStatus, toStatus)`。
- [ ] 实现 `assertTransition(fromStatus, toStatus)`，非法时返回当前状态和允许目标状态。
- [ ] 实现内容修改后的状态回退规则：`approved`、`pending_publish`、`publish_failed` 修改内容后进入 `editing`。
- [ ] 运行 `npm test -- tests/unit/services/articleStatusService.test.ts`，预期通过。

#### Task 1.2：实现 repository 基础层

**Files:**

- Create: `src/repositories/articleRepository.ts`
- Create: `src/repositories/imageRepository.ts`
- Create: `src/repositories/reviewRepository.ts`
- Create: `src/repositories/publishRepository.ts`
- Create: `src/repositories/auditLogRepository.ts`
- Test: `tests/unit/repositories/repositories.test.ts`

- [ ] 建立文章、图片、review、publish、audit log 的 CRUD 接口。
- [ ] MVP 可先使用内存 repository 或 Prisma repository，接口保持稳定。
- [ ] 写测试验证创建文章、保存图片、写入 review、写入 publish record、写入状态事件。
- [ ] 写测试验证按内容方向、状态、关键词分页查询文章列表。
- [ ] 运行 `npm test -- tests/unit/repositories/repositories.test.ts`，预期通过。

#### Task 1.3：实现内容完整性校验

**Files:**

- Create: `src/services/contentValidationService.ts`
- Test: `tests/unit/services/contentValidationService.test.ts`

- [ ] 写测试：缺标题时返回 `missingFields: ["title"]`。
- [ ] 写测试：缺正文时返回 `missingFields: ["body"]`。
- [ ] 写测试：缺内容方向时返回 `missingFields: ["category"]`。
- [ ] 写测试：无图片和无配图建议时返回 `missingFields: ["image"]`。
- [ ] 写测试：金融内容缺 `riskNote` 时返回 warning，不阻断提交 review。
- [ ] 实现 `validateForReview(articleId)`。
- [ ] 运行 `npm test -- tests/unit/services/contentValidationService.test.ts`，预期通过。

### Phase 1 验收

- 状态机能阻止未 review 文章进入发布准备。
- 内容完整性校验能保证有文有图。
- repository 支撑后续服务读写。

## Phase 2：文章创建与图文生成链路

### 目标

实现用户输入内容方向和主题后，系统生成公众号文章草稿和配图建议。

### 依赖

Phase 1 的 repository、状态流转、内容校验完成。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-2A 文章创建服务 | `src/services/articleService.ts`、`tests/unit/services/articleService.test.ts` | 创建、详情、列表 |
| AI-2B 生成策略 | `src/adapters/ai/promptStrategy.ts`、`tests/unit/adapters/promptStrategy.test.ts` | 三类方向提示词策略 |
| AI-2C 生成适配 | `src/adapters/ai/textGenerationAdapter.ts`、`src/services/generationService.ts`、`tests/unit/services/generationService.test.ts` | 模型适配和生成服务 |
| AI-2D 生成配置页面 | `src/app/articles/new/page.tsx`、`src/components/article/GenerationForm.tsx`、`tests/e2e/article-generation.spec.ts` | UI 和 E2E |

### 计划任务

#### Task 2.1：实现文章创建和列表服务

**Files:**

- Create: `src/services/articleService.ts`
- Test: `tests/unit/services/articleService.test.ts`

- [ ] 写测试：创建文章必须提供 `category` 和 `topic`。
- [ ] 写测试：金融方向自动设置 `requireRiskNote = true`。
- [ ] 写测试：`getArticleDetail` 返回文章、图片、latestReview、latestPublish。
- [ ] 写测试：`listArticles` 支持按方向和状态筛选。
- [ ] 实现 `createArticle`、`getArticleDetail`、`listArticles`。
- [ ] 运行 `npm test -- tests/unit/services/articleService.test.ts`，预期通过。

#### Task 2.2：实现三类内容生成策略

**Files:**

- Create: `src/adapters/ai/promptStrategy.ts`
- Test: `tests/unit/adapters/promptStrategy.test.ts`

- [ ] 写测试：科技互联网方向包含行业背景、技术或产品变化、趋势判断。
- [ ] 写测试：金融方向包含风险因素和非投资建议表达。
- [ ] 写测试：文学方向包含主题表达、文学性、文本细节。
- [ ] 写测试：所有方向都要求标题、摘要、正文、配图建议。
- [ ] 实现 `buildPrompt(config)`。
- [ ] 运行 `npm test -- tests/unit/adapters/promptStrategy.test.ts`，预期通过。

#### Task 2.3：实现图文草稿生成服务

**Files:**

- Create: `src/adapters/ai/textGenerationAdapter.ts`
- Create: `src/services/generationService.ts`
- Test: `tests/unit/services/generationService.test.ts`

- [ ] 写 fake adapter，返回结构化生成结果。
- [ ] 写测试：生成成功后保存 title、summary、body、riskNote。
- [ ] 写测试：生成成功后至少创建一条 `ArticleImage` 类型为 `suggestion`。
- [ ] 写测试：生成成功后状态进入 `editing`。
- [ ] 写测试：生成失败后状态进入 `generation_failed` 并记录错误。
- [ ] 实现 `generateDraft(articleId)`。
- [ ] 实现 MVP 版 `regenerateDraft(articleId, scope = "full")`。
- [ ] 运行 `npm test -- tests/unit/services/generationService.test.ts`，预期通过。

#### Task 2.4：实现生成配置页面

**Files:**

- Create: `src/app/articles/new/page.tsx`
- Create: `src/components/article/GenerationForm.tsx`
- Test: `tests/e2e/article-generation.spec.ts`

- [ ] 页面展示内容方向、主题、目标读者、文章风格、篇幅要求、参考素材输入。
- [ ] 未选择内容方向或未填写主题时禁用生成按钮。
- [ ] 提交后创建文章并触发生成。
- [ ] 生成成功后跳转图文编辑页。
- [ ] 生成失败时展示失败原因和重试入口。
- [ ] 运行 `npm run test:e2e -- tests/e2e/article-generation.spec.ts`，预期通过。

### Phase 2 验收

- 输入主题和方向后能生成图文草稿。
- 生成结果包含标题、摘要、正文、配图建议。
- 科技互联网、金融、文学三类方向均有策略。
- 生成失败可重试。

## Phase 3：图文编辑与图片配图管理

### 目标

实现 AI 草稿的人工编辑、图片或配图建议维护，以及提交 review 前校验。

### 依赖

Phase 1 和 Phase 2。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-3A 编辑服务 | `src/services/editorService.ts`、`tests/unit/services/editorService.test.ts` | 保存正文、提交 review |
| AI-3B 图片服务 | `src/services/imageService.ts`、`tests/unit/services/imageService.test.ts` | 配图建议和图片替换 |
| AI-3C 编辑页面 | `src/app/articles/[articleId]/edit/page.tsx`、`src/components/article/ArticleEditor.tsx`、`src/components/article/ImagePanel.tsx` | 编辑 UI |
| AI-3D 编辑 E2E | `tests/e2e/article-editing.spec.ts` | E2E 只写测试 |

### 计划任务

#### Task 3.1：实现编辑服务

**Files:**

- Create: `src/services/editorService.ts`
- Test: `tests/unit/services/editorService.test.ts`

- [ ] 写测试：`editing` 状态可保存标题、摘要、正文。
- [ ] 写测试：`pending_review` 状态不可编辑。
- [ ] 写测试：`approved` 或 `pending_publish` 状态编辑后回到 `editing`。
- [ ] 写测试：保存内容递增 `contentVersion`。
- [ ] 写测试：提交 review 前调用完整性校验。
- [ ] 实现 `saveArticleContent`。
- [ ] 实现 `submitForReview`。
- [ ] 运行 `npm test -- tests/unit/services/editorService.test.ts`，预期通过。

#### Task 3.2：实现图片与配图服务

**Files:**

- Create: `src/services/imageService.ts`
- Test: `tests/unit/services/imageService.test.ts`

- [ ] 写测试：保存配图建议时 `type = suggestion` 且 `description` 必填。
- [ ] 写测试：替换为上传图片时必须有 `url` 和 `source`。
- [ ] 写测试：修改图片记录会递增文章 `contentVersion`。
- [ ] 写测试：已通过文章修改图片后回到 `editing`。
- [ ] 实现 `listArticleImages`、`saveImageSuggestion`、`replaceImage`。
- [ ] 运行 `npm test -- tests/unit/services/imageService.test.ts`，预期通过。

#### Task 3.3：实现图文编辑页面

**Files:**

- Create: `src/app/articles/[articleId]/edit/page.tsx`
- Create: `src/components/article/ArticleEditor.tsx`
- Create: `src/components/article/ImagePanel.tsx`
- Create: `src/components/article/ArticlePreview.tsx`
- Test: `tests/e2e/article-editing.spec.ts`

- [ ] 展示标题、摘要、正文、图片与配图建议。
- [ ] 支持保存标题、摘要、正文。
- [ ] 支持新增或修改配图建议。
- [ ] 支持替换图片记录。
- [ ] 支持公众号预览。
- [ ] 提交 review 前展示缺失项。
- [ ] `pending_review` 状态只读。
- [ ] `review_rejected` 状态展示最近退回原因。
- [ ] 运行 `npm run test:e2e -- tests/e2e/article-editing.spec.ts`，预期通过。

### Phase 3 验收

- 用户能人工编辑标题、摘要、正文和图片记录。
- 至少一条图片内容或配图方案才能提交 review。
- 已通过内容再次修改后必须重新 review。

## Phase 4：Review 审核链路

### 目标

实现发布前人工 review，支持通过、退回修改、暂不发布，并写入审核记录。

### 依赖

Phase 1 和 Phase 3。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-4A Review 服务 | `src/services/reviewService.ts`、`tests/unit/services/reviewService.test.ts` | 审核决策 |
| AI-4B Review 页面 | `src/app/articles/[articleId]/review/page.tsx`、`src/components/review/ReviewPanel.tsx`、`src/components/review/ReviewChecklist.tsx` | 审核 UI |
| AI-4C Review E2E | `tests/e2e/article-review.spec.ts` | E2E 只写测试 |

### 计划任务

#### Task 4.1：实现 Review 服务

**Files:**

- Create: `src/services/reviewService.ts`
- Test: `tests/unit/services/reviewService.test.ts`

- [x] 写测试：只有 `pending_review` 状态可提交 review。
- [x] 写测试：通过后状态进入 `approved`，并写入 `reviewedVersion = contentVersion`。
- [x] 写测试：退回修改必须填写 comment，状态进入 `review_rejected`。
- [x] 写测试：暂不发布后状态进入 `not_publish`。
- [x] 写测试：ReviewRecord 记录 `articleVersion`、`result`、`comment`。
- [x] 实现 `getReviewView`。
- [x] 实现 `submitReview`。
- [x] 运行 `npm test -- tests/unit/services/reviewService.test.ts`，预期通过。

#### Task 4.2：实现 Review 页面

**Files:**

- Create: `src/app/articles/[articleId]/review/page.tsx`
- Create: `src/components/review/ReviewPanel.tsx`
- Create: `src/components/review/ReviewChecklist.tsx`
- Test: `tests/e2e/article-review.spec.ts`

- [x] 展示完整图文预览。
- [x] 展示图片清单。
- [x] 展示内容方向、生成配置和金融风险提示。
- [x] 支持填写审核意见。
- [x] 支持通过、退回修改、暂不发布。
- [x] 退回修改时强制填写审核意见。
- [x] Review 页不直接编辑文章正文。
- [x] 运行 `npm run test:e2e -- tests/e2e/article-review.spec.ts`，预期通过。

### Phase 4 验收

- 发布前 review 形成强制门禁。
- 未通过 review 的文章无法进入发布准备。
- 退回修改和暂不发布状态可追踪。

## Phase 5：发布准备、工作台、历史文章

### 目标

实现审核通过后的发布准备、公众号可复制内容导出、发布结果记录、工作台和历史文章筛选。

### 依赖

Phase 4 完成。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-5A 发布准备服务 | `src/services/publishPreparationService.ts`、`src/adapters/export/wechatManualExporter.ts`、`tests/unit/services/publishPreparationService.test.ts` | 发布导出 |
| AI-5B 发布准备页面 | `src/app/articles/[articleId]/publish/page.tsx`、`src/components/publish/PublishPreparationPanel.tsx` | 发布 UI |
| AI-5C 工作台 | `src/app/workbench/page.tsx`、`src/components/workbench/**` | 工作台 |
| AI-5D 历史文章 | `src/app/history/page.tsx`、`src/components/article/ArticleList.tsx`、`tests/e2e/history.spec.ts` | 历史筛选 |

### 计划任务

#### Task 5.1：实现发布准备服务和导出器

**Files:**

- Create: `src/services/publishPreparationService.ts`
- Create: `src/adapters/export/wechatManualExporter.ts`
- Test: `tests/unit/services/publishPreparationService.test.ts`

- [x] 写测试：只有 `approved` 或 `pending_publish` 状态能生成发布准备。
- [x] 写测试：`reviewedVersion != contentVersion` 时拒绝发布准备。
- [x] 写测试：导出内容包含标题、摘要、正文、图片清单和配图说明。
- [x] 写测试：标记已发布后状态进入 `published`。
- [x] 写测试：标记发布失败必须填写失败原因，状态进入 `publish_failed`。
- [x] 实现 `preparePublish`。
- [x] 实现 `markPublished`。
- [x] 实现 `markPublishFailed`。
- [x] 运行 `npm test -- tests/unit/services/publishPreparationService.test.ts`，预期通过。

#### Task 5.2：实现发布准备页面

**Files:**

- Create: `src/app/articles/[articleId]/publish/page.tsx`
- Create: `src/components/publish/PublishPreparationPanel.tsx`
- Test: `tests/e2e/publish-preparation.spec.ts`

- [x] 展示最终标题、摘要、正文预览。
- [x] 展示图片清单和插入位置。
- [x] 生成公众号可复制内容。
- [x] 支持复制标题、摘要、正文。
- [x] 支持标记已发布。
- [x] 支持标记发布失败并填写失败原因。
- [x] 非 `approved` 或 `pending_publish` 状态展示阻断提示。
- [x] 运行 `npm run test:e2e -- tests/e2e/publish-preparation.spec.ts`，预期通过。

#### Task 5.3：实现内容工作台

**Files:**

- Modify: `src/app/workbench/page.tsx`
- Create: `src/components/workbench/StatusOverview.tsx`
- Create: `src/components/workbench/RecentArticles.tsx`
- Test: `tests/e2e/workbench.spec.ts`

- [x] 展示新建文章入口。
- [x] 展示待编辑、待Review、待发布、发布失败数量。
- [x] 展示最近文章列表。
- [x] 根据文章状态提供继续编辑、去 review、去发布准备操作。
- [x] 运行 `npm run test:e2e -- tests/e2e/workbench.spec.ts`，预期通过。

#### Task 5.4：实现历史文章筛选

**Files:**

- Create: `src/app/history/page.tsx`
- Create: `src/components/article/ArticleList.tsx`
- Create: `src/components/article/ArticleFilters.tsx`
- Test: `tests/e2e/history.spec.ts`

- [x] 支持按内容方向筛选。
- [x] 支持按状态筛选。
- [x] 支持按关键词筛选。
- [x] 展示标题、内容方向、状态、更新时间、最近 review 结果、发布状态。
- [x] 支持进入详情、编辑、review、发布准备。
- [x] 运行 `npm run test:e2e -- tests/e2e/history.spec.ts`，预期通过。

### Phase 5 验收

- Review 通过后能生成公众号可复制内容。
- 未通过或暂不发布文章不能发布准备。
- 工作台能驱动主用户动线。
- 历史文章能按方向和状态筛选。
- 集成验证已通过：`npm test`、`npm run test:e2e`、`npm run typecheck`、`npm run build`。

## Phase 6：集成测试、验收和部署准备

### 目标

把前面所有模块串成可验收的 MVP，并形成测试与部署验收材料。

### 依赖

Phase 5 完成。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-6A 集成测试 | `tests/integration/**` | 服务链路测试 |
| AI-6B E2E 验收 | `tests/e2e/mvp-flow.spec.ts` | 主用户动线 |
| AI-6C 测试文档 | `docs/测试/**` | 测试方案 |
| AI-6D 部署验收文档 | `docs/部署验收/**` | 部署与验收 |

### 计划任务

#### Task 6.1：实现服务集成测试

**Files:**

- Create: `tests/integration/article-lifecycle.test.ts`

- [x] 测试完整链路：创建文章、生成草稿、编辑、提交 review、通过、发布准备、标记已发布。
- [x] 测试退回链路：创建文章、生成、提交 review、退回、编辑、再次提交 review。
- [x] 测试暂不发布链路：提交 review 后标记暂不发布，发布准备被阻断。
- [x] 测试内容修改后重新 review：通过后修改正文，再进入发布准备被阻断。
- [x] 运行 `npm test -- tests/integration/article-lifecycle.test.ts`，预期通过。

#### Task 6.2：实现 MVP E2E 验收测试

**Files:**

- Create: `tests/e2e/mvp-flow.spec.ts`

- [x] E2E 覆盖新建文章。
- [x] E2E 覆盖选择科技互联网、金融、文学任一方向生成草稿。
- [x] E2E 覆盖编辑标题、摘要、正文和配图建议。
- [x] E2E 覆盖提交 review。
- [x] E2E 覆盖 review 通过。
- [x] E2E 覆盖发布准备和复制内容。
- [x] 运行 `npm run test:e2e -- tests/e2e/mvp-flow.spec.ts`，预期通过。

#### Task 6.3：形成测试方案文档

**Files:**

- Create: `docs/测试/MVP测试方案.md`

- [x] 列出单元测试范围。
- [x] 列出集成测试范围。
- [x] 列出 E2E 测试范围。
- [x] 列出手工验收用例。
- [x] 标明金融内容风险提示检查点。
- [x] 标明发布前 review 门禁检查点。

#### Task 6.4：形成部署验收文档

**Files:**

- Create: `docs/部署验收/MVP部署验收清单.md`

- [x] 列出环境变量。
- [x] 列出数据库初始化步骤。
- [x] 列出构建命令。
- [x] 列出启动命令。
- [x] 列出上线前验收步骤。
- [x] 列出回滚方案。

### Phase 6 验收

- 主用户动线 E2E 通过。
- 单元测试、集成测试、E2E 测试都有覆盖。
- 测试和部署验收文档完成。
- 集成验证已通过：`npm test -- tests/integration/article-lifecycle.test.ts`、`npm run test:e2e -- tests/e2e/mvp-flow.spec.ts`、`npm run typecheck`、`npm run build`。

## Phase 7：增强能力

### 目标

在 MVP 可用后扩展图片、公众号接口、多用户权限和金融合规。

### 依赖

Phase 6 完成。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-7A AI 图片 | `src/adapters/ai/imageGenerationAdapter.ts`、`src/services/imageService.ts` | AI 图片生成 |
| AI-7B 素材库 | `src/services/materialService.ts`、`src/components/article/MaterialPicker.tsx` | 素材选择 |
| AI-7C 公众号接口 | `src/adapters/wechat/**`、`src/services/publishPreparationService.ts` | 公众号草稿箱 |
| AI-7D 金融合规 | `src/services/complianceService.ts`、`src/components/review/CompliancePanel.tsx` | 风险检测 |
| AI-7E 多用户权限 | `src/services/authService.ts`、`src/domain/permissions.ts` | 角色权限 |

### 增强任务

- [ ] AI 图片生成：支持基于配图建议生成真实图片。
- [ ] 素材库：支持用户从素材库选择图片。
- [ ] 公众号接口：支持创建公众号草稿和图片素材上传。
- [ ] 金融合规：支持免责声明模板、敏感词检查和风险表达检测。
- [ ] 多用户权限：支持创作者、Review 人、发布执行者、管理员。

## 跨 Phase 集成检查点

每个 phase 完成后，协调者执行以下检查：

- [ ] 检查是否修改了非本 worker 写入边界文件。
- [ ] 检查是否新增了未记录的状态枚举。
- [ ] 检查是否绕过 `ArticleStatusService`。
- [ ] 检查是否绕过 `ContentValidationService` 直接提交 review。
- [ ] 检查发布准备是否校验 `reviewedVersion == contentVersion`。
- [ ] 检查测试命令和构建命令是否通过。
- [ ] 检查文档是否同步更新。

## 多 AI 工作包分配建议

### 第一批并行

Phase 0 由主 worker 完成，review worker 检查契约。

```text
AI-0A：工程骨架和领域契约
AI-0R：契约 review，只提建议或补文档
```

### 第二批并行

Phase 1 完成核心基础。

```text
AI-1A：状态流转
AI-1B：Repository
AI-1C：内容完整性校验
```

### 第三批并行

Phase 2 和 Phase 3 可以在 Phase 1 后同时推进。

```text
AI-2A：文章创建服务
AI-2B：生成策略
AI-2C：生成服务
AI-2D：生成配置页面
AI-3A：编辑服务
AI-3B：图片服务
AI-3C：编辑页面
AI-3D：编辑 E2E
```

### 第四批并行

Phase 4 和 Phase 5 部分并行，但发布准备必须等 Review 服务完成。

```text
AI-4A：Review 服务
AI-4B：Review 页面
AI-4C：Review E2E
AI-5C：工作台
AI-5D：历史文章
```

Review 服务合并后再启动：

```text
AI-5A：发布准备服务
AI-5B：发布准备页面
```

### 第五批并行

Phase 6 验收与文档可以并行。

```text
AI-6A：集成测试
AI-6B：MVP E2E
AI-6C：测试方案文档
AI-6D：部署验收文档
```

## 风险与控制

| 风险 | 控制方式 |
| --- | --- |
| 多 AI 同时修改共享契约 | Phase 0 后冻结契约，变更必须先改设计文档 |
| 页面绕过服务直接操作状态 | 页面只能调用 service，状态变更集中在 ArticleStatusService |
| Review 和编辑职责混杂 | Review 页只读，退回后进入编辑页 |
| 发布准备绕过审核 | PublishPreparationService 强制校验状态和版本 |
| 图片能力拖慢 MVP | MVP 允许配图建议，不依赖真实图片生成 |
| 金融合规范围膨胀 | MVP 做 warning 和人工检查，自动拦截进入 Phase 7 |
| E2E 后置导致返工 | 每个页面 worker 同步写 E2E 验收用例 |

## 验收总清单

- [x] 用户能新建文章。
- [x] 用户能选择科技互联网、金融、文学内容方向。
- [x] 用户能输入主题并生成图文草稿。
- [x] 草稿包含标题、摘要、正文和配图建议。
- [x] 用户能编辑标题、摘要、正文和图片记录。
- [x] 用户能提交 review。
- [x] Review 能通过、退回修改、暂不发布。
- [x] 未通过 review 的文章不能进入发布准备。
- [x] Review 通过后能生成公众号可复制内容。
- [x] 工作台能展示待编辑、待Review、待发布文章。
- [x] 历史文章能按方向和状态筛选。
- [x] 生成失败、发布失败、非法状态流转都有记录。

## 计划 Review 结论

本计划按 Phase 将 MVP 拆成可测试、可并行、可逐步集成的开发工作。并行的关键不是同时开更多任务，而是先稳定领域契约，再让 AI worker 在互不重叠的文件边界内实现服务、页面、测试和文档。
