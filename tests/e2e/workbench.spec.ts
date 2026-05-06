import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const workbenchPagePath = "src/app/workbench/page.tsx";
const statusOverviewPath = "src/components/workbench/StatusOverview.tsx";
const recentArticlesPath = "src/components/workbench/RecentArticles.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected workbench E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("workbench E2E", () => {
  it("provides the workbench route with status overview and recent articles", async () => {
    const pageSource = await readRequiredSource(workbenchPagePath);

    assertMatches(pageSource, /StatusOverview/, "workbench should render status overview");
    assertMatches(pageSource, /RecentArticles/, "workbench should render recent articles");
    assertMatches(pageSource, /\/articles\/new|新建文章/, "workbench should expose article creation");

    await Promise.all([readRequiredSource(statusOverviewPath), readRequiredSource(recentArticlesPath)]);
  });

  it("shows editing, review, publish, and publish failure counts", async () => {
    const overviewSource = await readRequiredSource(statusOverviewPath);

    assertMatches(overviewSource, /待编辑|editing|review_rejected/i, "overview should count editing work");
    assertMatches(overviewSource, /待Review|pending_review/i, "overview should count review work");
    assertMatches(overviewSource, /待发布|approved|pending_publish/i, "overview should count publish work");
    assertMatches(overviewSource, /发布失败|publish_failed/i, "overview should count publish failures");
  });

  it("shows recent article metadata and status-based next actions", async () => {
    const recentSource = await readRequiredSource(recentArticlesPath);

    assertMatches(recentSource, /最近文章|articles\.map/i, "recent list should render article rows");
    assertMatches(recentSource, /title|标题/i, "recent list should show title");
    assertMatches(recentSource, /category|内容方向/i, "recent list should show category");
    assertMatches(recentSource, /status|状态/i, "recent list should show status");
    assertMatches(recentSource, /updatedAt|更新时间/i, "recent list should show update time");
    assertMatches(recentSource, /继续编辑|\/edit/i, "editing articles should continue to editor");
    assertMatches(recentSource, /去 review|\/review/i, "pending review articles should link to review");
    assertMatches(recentSource, /去发布准备|\/publish/i, "approved articles should link to publish preparation");
  });
});
