import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const auditPagePath = "src/app/audit/page.tsx";
const auditTimelinePath = "src/components/workbench/AuditTimeline.tsx";
const acceptanceChecklistPath = "docs/部署验收/Phase8生产化验收清单.md";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected audit E2E target to exist: ${path}`);
    }

    throw error;
  }
}

describe("audit operations E2E", () => {
  it("provides an audit route with environment validation and timeline", async () => {
    const pageSource = await readRequiredSource(auditPagePath);

    assert.match(pageSource, /validatePusherEnv/, "audit page should run environment validation");
    assert.match(pageSource, /AuditTimeline/, "audit page should render the audit timeline");
    assert.match(pageSource, /环境校验|运维审计/, "audit page should expose operations audit copy");
    assert.match(pageSource, /AI_TEXT_PROVIDER|WECHAT_DRAFT_ENABLED|PERSISTENCE_DRIVER/, "audit page should mention core env groups");
    assert.match(pageSource, /AI_TEXT_API_KEY|AI_IMAGE_API_KEY/, "audit page should validate AI secret variables");
    assert.match(pageSource, /WECHAT_APP_ID|WECHAT_APP_SECRET/, "audit page should validate WeChat secret variables");
  });

  it("renders key audit actions in the timeline component", async () => {
    const timelineSource = await readRequiredSource(auditTimelinePath);

    assert.match(timelineSource, /AI 生成完成|article\.generated/, "timeline should show generation actions");
    assert.match(timelineSource, /内容编辑|article\.edited/, "timeline should show editing actions");
    assert.match(timelineSource, /提交 Review|review\.submitted/, "timeline should show review actions");
    assert.match(timelineSource, /发布准备完成|publish\.prepared/, "timeline should show publish preparation");
    assert.match(timelineSource, /公众号草稿创建|wechat\.draft_created/, "timeline should show WeChat draft creation");
  });

  it("documents production configuration, startup, backup, and rollback checks", async () => {
    const checklistSource = await readRequiredSource(acceptanceChecklistPath);

    assert.match(checklistSource, /环境变量|配置/, "checklist should cover configuration");
    assert.match(checklistSource, /启动|npm start/, "checklist should cover startup");
    assert.match(checklistSource, /备份|导出/, "checklist should cover data backup");
    assert.match(checklistSource, /回滚/, "checklist should cover rollback");
  });
});
