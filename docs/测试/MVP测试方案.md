# MVP 测试方案

## 测试目标

验证 Pusher MVP 已形成从创建文章、生成草稿、编辑图文、提交 review、审核通过到发布准备的闭环，并覆盖暂不发布、退回修改、修改后重审和发布门禁等关键分支。

## 自动化测试范围

### 单元测试

执行命令：

```bash
npm test
```

覆盖范围：

- 领域枚举、文章状态集合和合法状态流转。
- 内容完整性校验，包括标题、正文、内容方向和图片或配图建议。
- 生成策略，覆盖科技互联网、金融、文学三类内容方向。
- 文章、图片、review、publish 和状态事件 repository。
- 文章创建、生成、编辑、图片、review、发布准备和状态服务。
- 发布门禁，包括未 review、暂不发布、退回修改、版本不一致时不能发布准备。

### 集成测试

执行命令：

```bash
npm test -- tests/integration/article-lifecycle.test.ts
```

覆盖范围：

- 完整链路：创建文章、生成草稿、编辑内容和配图建议、提交 review、通过、生成发布准备、标记已发布。
- 退回链路：提交 review、退回修改、编辑后再次提交 review。
- 暂不发布链路：review 标记暂不发布后，发布准备被阻断。
- 修改后重审链路：review 通过后修改正文，状态回到 `editing`，发布准备被阻断。

### E2E 验收测试

执行命令：

```bash
npm run test:e2e
```

重点用例：

- `tests/e2e/mvp-flow.spec.ts`：串联工作台、新建文章、编辑、review 和发布准备主用户动线。
- `tests/e2e/article-generation.spec.ts`：验证内容方向、生成配置、生成请求和编辑页跳转。
- `tests/e2e/article-editing.spec.ts`：验证标题、摘要、正文、图片建议、保存和提交 review。
- `tests/e2e/article-review.spec.ts`：验证完整预览、review checklist、通过、退回修改和暂不发布。
- `tests/e2e/publish-preparation.spec.ts`：验证公众号可复制内容、图片清单、发布结果和发布阻断。
- `tests/e2e/workbench.spec.ts`、`tests/e2e/history.spec.ts`：验证工作台、历史文章、筛选和状态动作入口。

当前 E2E 使用 Node 内置测试读取页面和组件源码做路由及交互契约验收，不依赖浏览器或外部服务。

## 手工验收用例

| 用例 | 步骤 | 通过标准 |
| --- | --- | --- |
| 主用户动线 | 工作台进入新建文章，选择内容方向并输入主题，生成草稿，编辑图文，提交 review，通过 review，进入发布准备 | 状态按 `drafting -> editing -> pending_review -> approved -> pending_publish` 推进，发布准备页展示公众号可复制内容 |
| 三类方向 | 分别用科技互联网、金融、文学主题生成草稿 | 三类草稿都有标题、摘要、正文和配图建议 |
| 退回修改 | Review 页选择退回修改并填写原因，回到编辑页修改后再次提交 | 退回原因可见，修改后状态回到 `editing`，再次提交后进入 `pending_review` |
| 暂不发布 | Review 页选择暂不发布，再进入发布准备页 | 文章状态为 `not_publish`，发布准备操作被阻断 |
| 修改后重审 | Review 通过后修改正文或图片，再尝试发布准备 | 内容版本变化后需要重新 review，不能直接发布准备 |
| 发布结果 | Review 通过后生成发布准备，分别标记已发布和发布失败 | 已发布进入 `published`；发布失败必须填写失败原因并进入 `publish_failed` |

## 金融内容检查点

- 金融方向生成配置必须设置 `requireRiskNote = true`。
- 草稿、review 页面和发布准备内容需要展示风险提示或人工检查提示。
- 正文不能承诺收益，不能直接给投资建议。
- Review checklist 需要确认金融风险提示是否存在且表达清楚。

## 发布前 Review 门禁

- `pending_review`、`review_rejected`、`not_publish` 不能进入发布准备。
- `approved` 或 `pending_publish` 才允许发布准备。
- `reviewedVersion` 必须等于 `contentVersion`；内容修改后必须重新 review。
- 发布失败必须记录失败原因，便于后续复核。

## 回归执行顺序

1. `npm test`
2. `npm test -- tests/integration/article-lifecycle.test.ts`
3. `npm run test:e2e`
4. `npm run typecheck`
5. `npm run build`

## 通过标准

- 单元测试、集成测试、E2E 测试全部通过。
- TypeScript typecheck 通过。
- Build baseline 通过。
- 手工验收无阻塞问题。
- 测试结果、未覆盖项和已知限制记录在验收材料中。
