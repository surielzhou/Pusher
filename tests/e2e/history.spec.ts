import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const historyPagePath = "src/app/history/page.tsx";
const articleListPath = "src/components/article/ArticleList.tsx";
const articleFiltersPath = "src/components/article/ArticleFilters.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected history E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("history E2E", () => {
  it("provides the history route with filters and article list", async () => {
    const pageSource = await readRequiredSource(historyPagePath);

    assertMatches(pageSource, /ArticleFilters/, "history route should render filters");
    assertMatches(pageSource, /ArticleList/, "history route should render the article list");
    assertMatches(pageSource, /searchParams|category|status|keyword/i, "history route should read filter params");

    await Promise.all([readRequiredSource(articleFiltersPath), readRequiredSource(articleListPath)]);
  });

  it("supports category, status, and keyword filters", async () => {
    const filtersSource = await readRequiredSource(articleFiltersPath);

    assertMatches(filtersSource, /内容方向|category/i, "filters should expose category");
    assertMatches(filtersSource, /tech_internet|科技互联网/i, "filters should include tech internet");
    assertMatches(filtersSource, /finance|金融/i, "filters should include finance");
    assertMatches(filtersSource, /literature|文学/i, "filters should include literature");
    assertMatches(filtersSource, /状态|status/i, "filters should expose status");
    assertMatches(filtersSource, /关键词|keyword|name="keyword"/i, "filters should expose keyword search");
  });

  it("shows article metadata, latest review result, and publish status", async () => {
    const listSource = await readRequiredSource(articleListPath);

    assertMatches(listSource, /标题|title/i, "list should show title");
    assertMatches(listSource, /内容方向|category/i, "list should show category");
    assertMatches(listSource, /状态|status/i, "list should show article status");
    assertMatches(listSource, /更新时间|updatedAt/i, "list should show updated time");
    assertMatches(listSource, /最近 review|latestReview|review result/i, "list should show latest review result");
    assertMatches(listSource, /发布状态|latestPublish|publish status/i, "list should show publish status");
  });

  it("links to detail, edit, review, and publish preparation", async () => {
    const listSource = await readRequiredSource(articleListPath);

    assertMatches(listSource, /详情|\/articles\/\$\{.*?\}/s, "list should link to detail");
    assertMatches(listSource, /编辑|\/edit/i, "list should link to edit");
    assertMatches(listSource, /review|\/review/i, "list should link to review");
    assertMatches(listSource, /发布准备|\/publish/i, "list should link to publish preparation");
  });
});
