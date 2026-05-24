import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const timelinePath = "src/components/article/VersionTimeline.tsx";
const diffPath = "src/components/article/VersionDiff.tsx";
const domainPath = "src/domain/version.ts";
const servicePath = "src/services/versionService.ts";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected version history target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("version history E2E", () => {
  it("defines version snapshots with article text and image state", async () => {
    const domainSource = await readRequiredSource(domainPath);

    assertMatches(domainSource, /ArticleVersionSnapshot/, "domain should define article version snapshots");
    assertMatches(domainSource, /title\??: string/, "snapshots should include title");
    assertMatches(domainSource, /summary\??: string/, "snapshots should include summary");
    assertMatches(domainSource, /body\??: string/, "snapshots should include body");
    assertMatches(domainSource, /ArticleVersionImageSnapshot/, "snapshots should include image state");
    assertMatches(domainSource, /contentVersion: number/, "snapshots should preserve contentVersion");
  });

  it("exposes service operations for capture, timeline, and diff", async () => {
    const serviceSource = await readRequiredSource(servicePath);

    assertMatches(serviceSource, /captureArticleVersion/, "service should capture current article state");
    assertMatches(serviceSource, /listArticleVersions/, "service should list version timeline");
    assertMatches(serviceSource, /compareArticleVersions/, "service should compare versions");
    assertMatches(serviceSource, /contentVersion: article\.contentVersion/, "service should not invent contentVersion semantics");
  });

  it("renders a version timeline with labels, versions, and selection controls", async () => {
    const timelineSource = await readRequiredSource(timelinePath);

    assertMatches(timelineSource, /aria-labelledby="version-timeline-heading"/, "timeline should expose a labelled region");
    assertMatches(timelineSource, /版本时间线|VersionTimeline/, "timeline should label version history");
    assertMatches(timelineSource, /contentVersion/, "timeline should render content version numbers");
    assertMatches(timelineSource, /label/, "timeline should render optional labels");
    assertMatches(timelineSource, /onSelectVersion/, "timeline should support selecting a version");
    assertMatches(timelineSource, /review 前|review 后|reason/, "timeline should support review context");
  });

  it("renders text and image differences for review-before and review-after versions", async () => {
    const diffSource = await readRequiredSource(diffPath);

    assertMatches(diffSource, /aria-labelledby="version-diff-heading"/, "diff should expose a labelled region");
    assertMatches(diffSource, /版本差异|VersionDiff/, "diff should label version differences");
    assertMatches(diffSource, /标题|title/, "diff should render title changes");
    assertMatches(diffSource, /摘要|summary/, "diff should render summary changes");
    assertMatches(diffSource, /正文|body/, "diff should render body changes");
    assertMatches(diffSource, /新增图片|added/, "diff should render added images");
    assertMatches(diffSource, /删除图片|removed/, "diff should render removed images");
    assertMatches(diffSource, /更新图片|updated/, "diff should render updated images");
  });
});
