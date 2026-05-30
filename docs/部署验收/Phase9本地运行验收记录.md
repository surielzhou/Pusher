# Phase 9 本地运行验收记录

## 基础信息

```text
验收日期：2026-05-30
验收版本或提交：phase-9-complete / 2f3a3782192a9d370c2d64f4cc3d1465f50c4647
部署环境：本地 Node.js 测试环境
应用访问地址：未启动浏览器服务；Phase 9 验收范围为 API Runtime、源码级页面接入和本地 JSON 快照持久化
验收人：Codex
结论：通过
```

## 1. Phase 9 范围验收

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 创建文章后再生成确定性草稿 | 通过 | `tests/integration/api-runtime.test.ts`、`tests/e2e/article-generation.spec.ts` |
| 编辑页、Review 页、发布准备页加载 runtime 数据 | 通过 | `tests/e2e/article-editing.spec.ts`、`tests/e2e/article-review.spec.ts`、`tests/e2e/publish-preparation.spec.ts` |
| 保存内容、提交 Review、审核决策、发布准备调用 API | 通过 | 组件源码断言覆盖 `fetch(/api/articles/**)` |
| mutation 后写入本地 JSON 快照 | 通过 | `tests/integration/runtime-persistence.test.ts` |
| runtime 重新初始化后保留文章、图片、Review、发布准备记录 | 通过 | `runtime persistence` 集成测试 |
| 不依赖真实 OpenAI、微信或网络服务 | 通过 | 默认 deterministic adapter 和 `wechat_manual` 发布准备 |

## 2. 本地持久化配置

| 配置项 | 当前值 | 说明 |
| --- | --- | --- |
| 默认快照路径 | `data/pusher-runtime.json` | 由 `DEFAULT_RUNTIME_SNAPSHOT_PATH` 定义 |
| 覆盖环境变量 | `PUSHER_RUNTIME_SNAPSHOT_PATH` | 测试和本地调试可指定独立快照路径 |
| Git 忽略规则 | `data/*.json` | 本地 runtime 快照不会提交到仓库 |

验收勾选：

- [x] 快照路径有默认值。
- [x] 快照路径可通过环境变量覆盖。
- [x] 本地 JSON 快照文件已被 `.gitignore` 忽略。
- [x] 持久化失败会让对应 mutation 返回失败，而不是静默接受不可保存状态。

## 3. 验证命令

本次验收执行以下命令，均在 `main` 分支、提交 `2f3a3782192a9d370c2d64f4cc3d1465f50c4647` 上完成：

```bash
npm test
npm run test:e2e
npm run typecheck
npm run build
```

验证结果：

- [x] `npm test`：115 tests，0 failures。
- [x] `npm run test:e2e`：59 tests，0 failures。
- [x] `npm run typecheck`：退出码 0。
- [x] `npm run build`：输出 `Project build baseline verified`。

## 4. 回滚方案

回滚触发条件：

- 本地 JSON 快照无法读取或保存，导致主链路 mutation 失败。
- 创建、生成、编辑、Review、发布准备任一 API-backed 页面链路不可用。
- runtime 重启后文章、图片、Review 或发布准备记录丢失。

回滚步骤：

1. 切回 `phase-8-complete` tag 或其对应提交 `adbf95a`。
2. 删除本地快照文件 `data/pusher-runtime.json`，避免旧结构数据影响回退验证。
3. 重新执行 `npm test`、`npm run test:e2e`、`npm run typecheck`、`npm run build`。
4. 如需保留 Phase 9 数据，先备份 `data/pusher-runtime.json`，再回滚代码。

## 5. 已知限制与后续建议

- `npm run dev` 和 `npm start` 仍使用 placeholder 脚本，Phase 9 尚未提供真实浏览器运行服务。
- Workbench、history、schedule、audit 页面仍保留 Phase 8 demo surface，不属于 Phase 9 本地真实运行闭环范围。
- 下一阶段建议进入 Phase 10：补齐真实本地应用启动、浏览器级主链路验收和手工验收记录。

## 6. 验收结论

```text
验收结论：通过
阻塞问题：无
非阻塞问题：dev/start 仍为 placeholder；浏览器级运行验收建议放入 Phase 10
回滚预案是否确认：确认
后续处理：规划 Phase 10 本地可运行应用壳与浏览器验收
验收人：Codex
```
