# Phase 8 生产化运营增强并行开发拆分

## 背景

Phase 7 已完成 AI 图片、素材库、公众号草稿、金融合规和角色权限。Phase 8 的目标不是继续扩大单点功能，而是把现有公众号图文生成与发布准备闭环推进到更适合长期运营的形态：数据可保存、接口可调用、来源可追踪、版本可回看、发布可排期、运行状态可验收。

## 并行原则

- 每个 worker 使用独立 worktree 和独立分支。
- 默认从 `main` 的 Phase 7 合并提交开始开发。
- 不直接修改其他 worker 的写入边界。
- 尽量新增模块文件；如必须修改共享契约或构建脚本，先在任务记录中说明，留到集成阶段统一处理。
- 每个 worker 至少提交单元测试或 E2E 测试，并在完成时给出验证命令。

## Worktree 拆分

| Worker | Branch | Worktree | 目标 |
| --- | --- | --- | --- |
| AI-8A | `feature/phase-8-content-sources` | `.worktrees/phase-8-content-sources` | 来源、参考材料、事实点管理 |
| AI-8B | `feature/phase-8-versioning` | `.worktrees/phase-8-versioning` | 内容版本追踪和差异对比 |
| AI-8C | `feature/phase-8-scheduling` | `.worktrees/phase-8-scheduling` | 发布排期和日历视图 |
| AI-8D | `feature/phase-8-api-runtime` | `.worktrees/phase-8-api-runtime` | HTTP API Runtime 边界 |
| AI-8E | `feature/phase-8-persistence` | `.worktrees/phase-8-persistence` | 本地持久化、导入导出、种子数据 |
| AI-8F | `feature/phase-8-ops-audit` | `.worktrees/phase-8-ops-audit` | 环境校验、审计日志、生产化验收 |
| AI-8G | `feature/phase-8-ui-shell` | `.worktrees/phase-8-ui-shell` | 应用壳层、导航和可访问性 |

## 任务卡

### AI-8A：来源与参考材料

写入边界：

- `src/domain/source.ts`
- `src/adapters/sources/**`
- `src/services/sourceService.ts`
- `src/components/article/SourcePanel.tsx`
- `tests/unit/services/sourceService.test.ts`
- `tests/e2e/source-workflow.spec.ts`

验收要点：

- 支持为文章保存参考来源、引用摘要、可信度和使用状态。
- 支持按文章列出来源，并能标记来源是否已用于正文。
- 来源面板可在编辑场景展示，不阻塞原有提交 review 链路。

### AI-8B：版本追踪与 Diff

写入边界：

- `src/domain/version.ts`
- `src/repositories/versionRepository.ts`
- `src/services/versionService.ts`
- `src/components/article/VersionTimeline.tsx`
- `src/components/article/VersionDiff.tsx`
- `tests/unit/services/versionService.test.ts`
- `tests/e2e/version-history.spec.ts`

验收要点：

- 保存标题、摘要、正文、图片变更前后的版本快照。
- 支持查看版本时间线和 review 前后差异。
- 不改变现有 `contentVersion` 的状态流转语义。

### AI-8C：发布排期

写入边界：

- `src/domain/schedule.ts`
- `src/repositories/scheduleRepository.ts`
- `src/services/scheduleService.ts`
- `src/app/schedule/page.tsx`
- `src/components/publish/SchedulePanel.tsx`
- `tests/unit/services/scheduleService.test.ts`
- `tests/e2e/publish-schedule.spec.ts`

验收要点：

- 只有 `approved` 或 `pending_publish` 文章可以进入排期。
- 支持创建、修改、取消发布排期。
- 工作台或发布准备页能展示下一次计划发布时间。

### AI-8D：API Runtime

写入边界：

- `src/app/api/**`
- `src/services/runtimeContainer.ts`
- `tests/integration/api-runtime.test.ts`

验收要点：

- 提供文章创建、生成、编辑、review、发布准备的 API 路由。
- API 只调用 service，不直接操作 repository 状态。
- 错误响应包含稳定 code 和 message，便于页面后续接入。

### AI-8E：持久化与导入导出

写入边界：

- `src/repositories/fileStore.ts`
- `src/repositories/persistence.ts`
- `scripts/seed-demo-data.mjs`
- `tests/integration/persistence.test.ts`
- `docs/部署验收/Phase8数据持久化说明.md`

验收要点：

- 提供本地文件持久化 store，接口可替换为后续 SQLite/PostgreSQL。
- 支持导出完整文章、图片、review、publish 数据。
- 支持导入种子数据并通过基础链路测试。

### AI-8F：运维审计与环境校验

写入边界：

- `src/config/env.ts`
- `src/services/auditLogService.ts`
- `src/app/audit/page.tsx`
- `src/components/workbench/AuditTimeline.tsx`
- `tests/unit/services/auditLogService.test.ts`
- `docs/部署验收/Phase8生产化验收清单.md`

验收要点：

- 对 AI、微信、持久化相关环境变量做显式校验。
- 审计日志能展示关键动作：生成、编辑、review、发布准备、草稿创建。
- 生产化验收文档覆盖配置、启动、数据备份和回滚。

### AI-8G：UI 壳层与可访问性

写入边界：

- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/navigation/**`
- `tests/e2e/navigation-accessibility.spec.ts`

验收要点：

- 提供统一应用壳层和主导航入口。
- 工作台、创建、历史、排期、审计入口清晰可达。
- 基础键盘导航、表单 label、按钮语义和页面标题可测试。

## 集成建议

建议合并顺序：

1. `feature/phase-8-persistence`
2. `feature/phase-8-api-runtime`
3. `feature/phase-8-content-sources`
4. `feature/phase-8-versioning`
5. `feature/phase-8-scheduling`
6. `feature/phase-8-ops-audit`
7. `feature/phase-8-ui-shell`

集成阶段统一处理：

- `src/services/contracts.ts` 的新增服务接口。
- `scripts/build.mjs` 的新增文件基线。
- 工作台和导航入口中的跨模块链接。
- Phase 8 总体验证：`npm test`、`npm run test:e2e`、`npm run typecheck`、`npm run build`。
