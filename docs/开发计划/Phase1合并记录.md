# Phase 1 Integration 合并记录

## 合并目标

将 `feature/phase-1-state`、`feature/phase-1-repositories`、`feature/phase-1-validation` 三个并行 worktree 的 Phase 1 产物整合到统一分支：

- 分支：`feature/phase-1-integration`
- Worktree：`.worktrees/phase-1-integration`

## 整合原则

- Repository public API 以 `feature/phase-1-repositories` 的 `types.ts`、`memoryStore.ts`、`index.ts` 分层为主干。
- Repository 实现吸收 `feature/phase-1-validation` 的 clone 返回策略，避免调用方修改返回对象污染内存状态。
- 状态服务统一保留 `assertTransition`、`getAllowedTransitionTargets`、`canPreparePublish`、`resolveStatusAfterContentChange`，并兼容 `getStatusAfterContentChange`、`requiresReviewAfterContentChange`。
- 内容校验服务采用依赖注入和结构化 `ArticleNotFoundError`，并兼容对象参数和双参数构造方式。
- `review_rejected`、`not_publish`、`publish_failed` 在内容修改后回到 `editing`，与详细设计中的可编辑状态和重新 review 规则一致。

## 最终模块

- `src/repositories/types.ts`
- `src/repositories/memoryStore.ts`
- `src/repositories/index.ts`
- `src/repositories/articleRepository.ts`
- `src/repositories/imageRepository.ts`
- `src/repositories/reviewRepository.ts`
- `src/repositories/publishRepository.ts`
- `src/repositories/auditLogRepository.ts`
- `src/services/articleStatusService.ts`
- `src/services/contentValidationService.ts`

## 验证范围

- Repository 基础能力：创建、更新、删除、筛选、分页、review/publish/status event/audit log 记录。
- Repository 隔离能力：返回记录为 clone，调用方不能直接污染内存 store。
- 状态门禁：合法主链路、非法发布准备、发布准备状态、内容修改回退。
- 内容校验：标题、正文、内容方向、图片/配图建议、金融风险提示 warning、文章不存在错误。
- Workflow：提交 review 前校验、未审核禁止发布准备、审核后修改内容回到编辑状态。
- TypeScript：新增 `tsconfig.typecheck.json`，使用 `tsc --noEmit` 检查 Phase 1 domain/services/repositories。

## 当前验证命令

```bash
npm test
npm run build
npm run typecheck
```
