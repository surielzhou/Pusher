# MVP 测试方案与需求动线 Review

## 文档目的

本文基于需求、用户动线、详细设计和 Phase 开发计划，定义 MVP 阶段的测试范围、测试分层、测试用例和覆盖 Review。

输入文档：

- `docs/需求/初版需求故事.md`
- `docs/设计/用户动线拆分.md`
- `docs/设计/详细设计.md`
- `docs/开发计划/Phase开发计划-多AI并行.md`

## 测试目标

- 验证系统能围绕科技互联网、金融、文学三类方向生成公众号图文文章草稿。
- 验证文章草稿至少包含标题、摘要、正文和图片内容或配图方案。
- 验证人工编辑和发布前 review 能形成完整闭环。
- 验证未通过 review 的文章不能进入发布准备。
- 验证审核通过后的文章能生成公众号可复制内容。
- 验证主用户动线、分支动线和异常状态均可被测试覆盖。

## 测试范围

### 范围内

- 领域枚举和状态流转。
- 文章创建、生成配置和图文草稿生成。
- 内容方向策略：科技互联网、金融、文学。
- 配图建议和图片记录。
- 图文编辑。
- 提交 review 前完整性校验。
- Review 通过、退回修改、暂不发布。
- 发布准备和公众号可复制内容导出。
- 工作台和历史文章筛选。
- 生成失败、发布失败、非法状态流转。

### 范围外

- 多人协同 review。
- 自动对接公众号接口发布。
- AI 图片真实生成。
- 素材库选择。
- 完整历史版本差异对比。
- 自动金融合规拦截。

## 测试分层

| 测试层级 | 目标 | 主要覆盖 |
| --- | --- | --- |
| 单元测试 | 验证独立函数、服务和状态规则 | 状态流转、内容校验、生成策略、导出器 |
| 集成测试 | 验证服务组合后的业务链路 | 文章生命周期、review、发布准备 |
| E2E 测试 | 验证真实用户路径 | 新建、生成、编辑、review、发布准备 |
| 手工验收 | 验证内容质量、图文匹配和主观 review | 公众号阅读体验、金融风险提示、发布前人工介入 |
| 回归测试 | 验证关键门禁未被破坏 | 未 review 不可发布、修改后重新 review |

## 单元测试方案

### 领域枚举与状态测试

测试文件建议：

- `tests/unit/domain/status.test.ts`
- `tests/unit/services/articleStatusService.test.ts`

测试用例：

| 用例 ID | 测试点 | 预期结果 |
| --- | --- | --- |
| UT-STATUS-001 | 定义 `ContentCategory` 三类方向 | 包含 `tech_internet`、`finance`、`literature` |
| UT-STATUS-002 | 定义完整 `ArticleStatus` | 包含草稿中、生成失败、待编辑、待Review、Review退回、已通过、暂不发布、待发布、发布失败、已发布 |
| UT-STATUS-003 | 合法主状态流转 | `drafting -> editing -> pending_review -> approved -> pending_publish -> published` 允许 |
| UT-STATUS-004 | 未 review 文章进入发布准备 | `pending_review -> pending_publish` 被拒绝 |
| UT-STATUS-005 | 暂不发布文章进入发布准备 | `not_publish -> pending_publish` 被拒绝 |
| UT-STATUS-006 | Review 退回文章进入发布准备 | `review_rejected -> pending_publish` 被拒绝 |
| UT-STATUS-007 | 已通过文章被编辑 | 状态回到 `editing`，需要重新 review |

### 内容完整性校验测试

测试文件建议：

- `tests/unit/services/contentValidationService.test.ts`

测试用例：

| 用例 ID | 测试点 | 预期结果 |
| --- | --- | --- |
| UT-VALID-001 | 标题为空 | 返回 `missingFields: ["title"]` |
| UT-VALID-002 | 正文为空 | 返回 `missingFields: ["body"]` |
| UT-VALID-003 | 内容方向为空 | 返回 `missingFields: ["category"]` |
| UT-VALID-004 | 无图片且无配图建议 | 返回 `missingFields: ["image"]` |
| UT-VALID-005 | 金融内容缺少风险提示 | 返回 warning，不阻断提交 review |
| UT-VALID-006 | 标题、正文、方向、配图均存在 | 返回 `valid: true` |

### 生成策略测试

测试文件建议：

- `tests/unit/adapters/promptStrategy.test.ts`
- `tests/unit/services/generationService.test.ts`

测试用例：

| 用例 ID | 测试点 | 预期结果 |
| --- | --- | --- |
| UT-GEN-001 | 科技互联网方向策略 | 包含行业背景、技术或产品变化、趋势判断 |
| UT-GEN-002 | 金融方向策略 | 包含风险因素、非投资建议表达和风险提示要求 |
| UT-GEN-003 | 文学方向策略 | 包含主题表达、文学性、文本细节 |
| UT-GEN-004 | 生成成功 | 保存标题、摘要、正文、配图建议，状态进入 `editing` |
| UT-GEN-005 | 生成失败 | 状态进入 `generation_failed`，记录失败原因 |
| UT-GEN-006 | 生成结果缺少配图建议 | 生成服务补充失败原因或阻断成功状态 |

### 图文编辑和图片测试

测试文件建议：

- `tests/unit/services/editorService.test.ts`
- `tests/unit/services/imageService.test.ts`

测试用例：

| 用例 ID | 测试点 | 预期结果 |
| --- | --- | --- |
| UT-EDIT-001 | `editing` 状态保存内容 | 保存成功并递增 `contentVersion` |
| UT-EDIT-002 | `pending_review` 状态编辑 | 被拒绝 |
| UT-EDIT-003 | `approved` 状态编辑 | 文章回到 `editing` |
| UT-EDIT-004 | 提交 review 前校验失败 | 返回缺失项，不改变状态 |
| UT-IMAGE-001 | 保存配图建议 | 生成 `ArticleImage`，类型为 `suggestion` |
| UT-IMAGE-002 | 上传图片缺少 url | 被拒绝 |
| UT-IMAGE-003 | 修改图片记录 | 递增 `contentVersion` |

### Review 测试

测试文件建议：

- `tests/unit/services/reviewService.test.ts`

测试用例：

| 用例 ID | 测试点 | 预期结果 |
| --- | --- | --- |
| UT-REVIEW-001 | 非 `pending_review` 状态提交 review | 被拒绝 |
| UT-REVIEW-002 | Review 通过 | 状态进入 `approved`，写入 `reviewedVersion` |
| UT-REVIEW-003 | Review 退回但无意见 | 被拒绝 |
| UT-REVIEW-004 | Review 退回且有意见 | 状态进入 `review_rejected` |
| UT-REVIEW-005 | Review 暂不发布 | 状态进入 `not_publish` |
| UT-REVIEW-006 | Review 页修改正文 | 不允许，需退回后进入编辑页 |

### 发布准备测试

测试文件建议：

- `tests/unit/services/publishPreparationService.test.ts`
- `tests/unit/adapters/wechatManualExporter.test.ts`

测试用例：

| 用例 ID | 测试点 | 预期结果 |
| --- | --- | --- |
| UT-PUBLISH-001 | `approved` 文章生成发布准备 | 成功，状态进入 `pending_publish` |
| UT-PUBLISH-002 | `pending_review` 文章生成发布准备 | 被拒绝 |
| UT-PUBLISH-003 | `not_publish` 文章生成发布准备 | 被拒绝 |
| UT-PUBLISH-004 | `reviewedVersion != contentVersion` | 被拒绝，需要重新 review |
| UT-PUBLISH-005 | 导出公众号内容 | 包含标题、摘要、正文、图片清单和配图说明 |
| UT-PUBLISH-006 | 标记发布失败但无原因 | 被拒绝 |

## 集成测试方案

测试文件建议：

- `tests/integration/article-lifecycle.test.ts`

### 主链路集成测试

用例 ID：IT-FLOW-001

步骤：

1. 创建文章，选择科技互联网方向并输入主题。
2. 生成图文草稿。
3. 编辑标题、摘要、正文和配图建议。
4. 提交 review。
5. Review 通过。
6. 生成发布准备内容。
7. 标记已发布。

预期：

- 文章最终状态为 `published`。
- 生成记录、review 记录、发布记录均存在。
- 发布内容包含标题、摘要、正文和图片清单。

### Review 退回集成测试

用例 ID：IT-FLOW-002

步骤：

1. 创建文章并生成草稿。
2. 提交 review。
3. Review 退回修改并填写原因。
4. 编辑正文或图片。
5. 再次提交 review。

预期：

- 第一次 review 后状态为 `review_rejected`。
- 修改后状态回到 `editing`。
- 再次提交后状态进入 `pending_review`。

### 暂不发布集成测试

用例 ID：IT-FLOW-003

步骤：

1. 创建文章并提交 review。
2. Review 标记暂不发布。
3. 尝试进入发布准备。

预期：

- 文章状态为 `not_publish`。
- 发布准备被拒绝。

### 内容修改后重新 review 集成测试

用例 ID：IT-FLOW-004

步骤：

1. Review 通过文章。
2. 修改正文或图片记录。
3. 尝试进入发布准备。

预期：

- 文章状态回到 `editing`。
- `reviewedVersion != contentVersion`。
- 发布准备被拒绝。

## E2E 测试方案

测试文件建议：

- `tests/e2e/mvp-flow.spec.ts`
- `tests/e2e/article-generation.spec.ts`
- `tests/e2e/article-editing.spec.ts`
- `tests/e2e/article-review.spec.ts`
- `tests/e2e/publish-preparation.spec.ts`
- `tests/e2e/history.spec.ts`

### E2E 主流程

用例 ID：E2E-MVP-001

步骤：

1. 进入工作台。
2. 点击新建文章。
3. 选择内容方向。
4. 输入主题。
5. 生成图文草稿。
6. 进入图文编辑页。
7. 保存标题、摘要、正文和配图建议。
8. 提交 review。
9. 在 Review 页点击通过。
10. 进入发布准备页。
11. 生成公众号可复制内容。

预期：

- 每个页面跳转符合用户动线。
- 文章状态依次经过 `drafting`、`editing`、`pending_review`、`approved`、`pending_publish`。
- 发布准备页显示可复制内容。

### E2E 方向覆盖

用例 ID：E2E-CATEGORY-001

步骤：

1. 分别选择科技互联网、金融、文学三类方向。
2. 分别输入主题并生成草稿。

预期：

- 三类方向都能生成草稿。
- 金融方向展示风险提示或 review 检查提示。
- 每篇草稿都有配图建议。

### E2E 门禁覆盖

用例 ID：E2E-GATE-001

步骤：

1. 创建并生成文章。
2. 不提交 review，直接访问发布准备页。
3. 提交 review 后标记暂不发布，再访问发布准备页。

预期：

- 未 review 时发布准备被阻断。
- 暂不发布时发布准备被阻断。

## 手工验收测试方案

### 内容质量检查

| 检查项 | 通过标准 |
| --- | --- |
| 标题 | 能准确反映主题，适合公众号阅读场景 |
| 摘要 | 能概括文章观点或内容价值 |
| 正文 | 结构完整、表达通顺、没有明显断裂 |
| 图文匹配 | 配图建议或图片与正文内容相关 |
| 内容方向 | 与科技互联网、金融或文学方向匹配 |
| 金融风险 | 不承诺收益，不直接给投资建议，有风险提示或人工 review 提醒 |

### Review 检查

| 检查项 | 通过标准 |
| --- | --- |
| 完整图文预览 | Review 页能看到标题、摘要、正文、图片清单 |
| 审核意见 | 退回修改时必须填写原因 |
| 审核结果 | 能选择通过、退回修改、暂不发布 |
| 发布门禁 | 未通过 review 不能生成发布准备 |
| 修改后重审 | 通过后修改内容，必须重新 review |

### 发布准备检查

| 检查项 | 通过标准 |
| --- | --- |
| 可复制内容 | 包含标题、摘要、正文、图片占位或图片清单 |
| 图片说明 | 明确图片插入位置和说明 |
| 发布结果 | 可标记已发布或发布失败 |
| 失败原因 | 发布失败必须记录原因 |

## 回归测试重点

- 任何状态流转改动后，必须重跑状态流转单元测试。
- 任何编辑或图片逻辑改动后，必须重跑内容完整性校验和编辑服务测试。
- 任何 Review 改动后，必须重跑 Review 服务测试和发布门禁测试。
- 任何发布准备改动后，必须重跑 `reviewedVersion == contentVersion` 校验测试。
- 任何页面流程改动后，必须重跑主流程 E2E。

## 需求覆盖 Review

| 初版需求 | 覆盖测试 | Review 结果 |
| --- | --- | --- |
| 支持按主题或方向生成公众号文章 | UT-GEN、IT-FLOW-001、E2E-MVP-001 | 已覆盖 |
| 覆盖科技互联网、金融、文学 | UT-GEN-001 到 UT-GEN-003、E2E-CATEGORY-001 | 已覆盖 |
| 文章格式有文有图 | UT-VALID-004、UT-GEN-006、IT-FLOW-001 | 已覆盖 |
| 生成标题、摘要、正文结构、正文内容、配图建议 | UT-GEN-004、E2E-MVP-001、手工内容质量检查 | 已覆盖 |
| 发布前人工 review | UT-REVIEW、IT-FLOW、E2E-MVP-001 | 已覆盖 |
| Review 人查看完整图文 | E2E Review 页、手工 Review 检查 | 已覆盖 |
| Review 可通过、退回修改、暂不发布 | UT-REVIEW-002 到 UT-REVIEW-005、IT-FLOW-002、IT-FLOW-003 | 已覆盖 |
| 未通过 review 不能发布 | UT-PUBLISH-002、UT-PUBLISH-003、E2E-GATE-001 | 已覆盖 |
| 审核通过后进入发布准备 | UT-PUBLISH-001、IT-FLOW-001、E2E-MVP-001 | 已覆盖 |
| 金融内容风险提示 | UT-VALID-005、UT-GEN-002、E2E-CATEGORY-001、手工内容质量检查 | 已覆盖为 warning 和人工检查 |

## 用户动线覆盖 Review

| 用户动线 | 覆盖测试 | Review 结果 |
| --- | --- | --- |
| 进入创作入口 | E2E-MVP-001、工作台 E2E | 已覆盖 |
| 选择内容方向 | E2E-MVP-001、E2E-CATEGORY-001 | 已覆盖 |
| 生成图文草稿 | UT-GEN、IT-FLOW-001、E2E-MVP-001 | 已覆盖 |
| 编辑和补充图文内容 | UT-EDIT、UT-IMAGE、E2E-MVP-001 | 已覆盖 |
| 提交 Review | UT-VALID、UT-EDIT、E2E-MVP-001 | 已覆盖 |
| Review 图文文章 | UT-REVIEW、Review 页面 E2E、手工 Review 检查 | 已覆盖 |
| Review 通过后发布准备 | UT-PUBLISH、IT-FLOW-001、E2E-MVP-001 | 已覆盖 |
| 生成结果不满意后重试 | UT-GEN-005、生成页面 E2E | 已覆盖 |
| 图片不合适后修改 | UT-IMAGE、编辑页面 E2E | 已覆盖 |
| Review 退回修改 | IT-FLOW-002、UT-REVIEW-003、UT-REVIEW-004 | 已覆盖 |
| 暂不发布 | IT-FLOW-003、UT-REVIEW-005 | 已覆盖 |
| 发布失败 | UT-PUBLISH-006、手工发布准备检查 | 已覆盖 |

## 测试执行顺序

1. 单元测试：领域、状态、校验、生成、编辑、Review、发布准备。
2. 集成测试：文章生命周期主链路和分支链路。
3. E2E 测试：主用户动线、方向覆盖、发布门禁。
4. 手工验收：内容质量、图文匹配、金融风险提示、公众号复制内容。

## 测试通过标准

- 所有单元测试通过。
- 所有集成测试通过。
- 主用户动线 E2E 通过。
- 发布门禁 E2E 通过。
- 手工验收无阻塞问题。
- 金融方向至少有风险提示或 review 检查提醒。
