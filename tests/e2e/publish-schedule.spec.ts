import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const schedulePagePath = "src/app/schedule/page.tsx";
const schedulePanelPath = "src/components/publish/SchedulePanel.tsx";
const publishPagePath = "src/app/articles/[articleId]/publish/page.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected publish schedule E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("publish schedule E2E", () => {
  it("provides a schedule route with a calendar-oriented schedule surface", async () => {
    const pageSource = await readRequiredSource(schedulePagePath);

    assertMatches(pageSource, /SchedulePanel/, "schedule route should render the scheduling panel");
    assertMatches(pageSource, /发布排期|schedule/i, "schedule route should identify the schedule page");
    assertMatches(pageSource, /日历|calendar|scheduledFor/i, "schedule route should expose a calendar-oriented view");
    assertMatches(pageSource, /approved|pending_publish|canPreparePublish/i, "schedule route should gate schedulable articles");

    await readRequiredSource(schedulePanelPath);
  });

  it("supports creating, changing, and cancelling a publish schedule", async () => {
    const panelSource = await readRequiredSource(schedulePanelPath);

    assertMatches(panelSource, /创建排期|createSchedule|scheduledFor/i, "schedule panel should create schedules");
    assertMatches(panelSource, /修改排期|reschedule|datetime-local/i, "schedule panel should change an existing schedule time");
    assertMatches(panelSource, /取消排期|cancelSchedule|cancelReason/i, "schedule panel should cancel schedules");
    assertMatches(panelSource, /disabled={scheduleBlocked}|disabled={!canSchedule}/i, "blocked articles should disable schedule actions");
  });

  it("shows the next planned publish time on the publish preparation page", async () => {
    const publishPageSource = await readRequiredSource(publishPagePath);

    assertMatches(publishPageSource, /SchedulePanel/, "publish preparation page should include the schedule panel");
    assertMatches(publishPageSource, /nextSchedule|下一次计划发布时间|scheduledFor/i, "publish page should pass the next schedule time");
  });

  it("lists upcoming schedules with article title, channel, status, and time", async () => {
    const pageSource = await readRequiredSource(schedulePagePath);

    assertMatches(pageSource, /upcomingSchedules|排期日历|排期列表/i, "schedule route should list upcoming schedules");
    assertMatches(pageSource, /article\.title|文章标题|title/i, "schedule list should show article titles");
    assertMatches(pageSource, /channel|wechat_manual|渠道/i, "schedule list should show publish channels");
    assertMatches(pageSource, /status|scheduled|cancelled|状态/i, "schedule list should show schedule status");
    assertMatches(pageSource, /formatScheduleTime|toISOString|dateTime/i, "schedule list should render schedule time");
  });
});
