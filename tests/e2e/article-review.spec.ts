import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const reviewPagePath = "src/app/articles/[articleId]/review/page.tsx";
const reviewPanelPath = "src/components/review/ReviewPanel.tsx";
const reviewChecklistPath = "src/components/review/ReviewChecklist.tsx";
const articlePreviewPath = "src/components/article/ArticlePreview.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected article review E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

function assertDoesNotMatch(source: string, pattern: RegExp, description: string) {
  assert.doesNotMatch(source, pattern, description);
}

describe("article review E2E", () => {
  it("provides the article review route and composed review surface", async () => {
    const pageSource = await readRequiredSource(reviewPagePath);

    assertMatches(pageSource, /ReviewPanel/, "review route should render the review panel");
    assertMatches(pageSource, /ReviewChecklist/, "review route should render the review checklist");
    assertMatches(pageSource, /ArticlePreview/, "review route should render the read-only article preview");
    assertMatches(pageSource, /articleId/, "review route should read the article id route param");

    await Promise.all([
      readRequiredSource(reviewPanelPath),
      readRequiredSource(reviewChecklistPath),
      readRequiredSource(articlePreviewPath)
    ]);
  });

  it("shows preview, image list, content category, generation config, and risk note", async () => {
    const pageSource = await readRequiredSource(reviewPagePath);
    const panelSource = await readRequiredSource(reviewPanelPath);
    const checklistSource = await readRequiredSource(reviewChecklistPath);
    const combinedSource = `${pageSource}\n${panelSource}\n${checklistSource}`;

    assertMatches(combinedSource, /完整图文预览|公众号预览|ArticlePreview/i, "review should expose the full article preview");
    assertMatches(combinedSource, /图片清单|images\.map|配图/i, "review should show image records");
    assertMatches(combinedSource, /内容方向|category/i, "review should show content category");
    assertMatches(combinedSource, /生成配置|generationConfig|topic|audience|style/i, "review should show generation config");
    assertMatches(combinedSource, /金融风险提示|riskNote|不构成投资建议/i, "review should show finance risk note");
  });

  it("supports approve, reject for edits, and not publish review decisions", async () => {
    const panelSource = await readRequiredSource(reviewPanelPath);

    assertMatches(panelSource, /name="comment"|审核意见|comment/i, "review panel should accept reviewer comments");
    assertMatches(panelSource, /approved|通过/i, "review panel should support approval");
    assertMatches(panelSource, /rejected|退回修改/i, "review panel should support rejection for edits");
    assertMatches(panelSource, /not_publish|暂不发布/i, "review panel should support not publish");
    assertMatches(panelSource, /submitReview|ReviewService|reviewChecklist/i, "review panel should wire decisions to review submission");
  });

  it("requires a review comment before rejecting for edits", async () => {
    const panelSource = await readRequiredSource(reviewPanelPath);

    assertMatches(
      panelSource,
      /required|\brequiredComment\b|ReviewCommentRequiredError|退回修改.*审核意见/s,
      "rejecting for edits should require a reviewer comment"
    );
  });

  it("keeps review read-only and does not expose article body editing controls", async () => {
    const pageSource = await readRequiredSource(reviewPagePath);
    const panelSource = await readRequiredSource(reviewPanelPath);
    const checklistSource = await readRequiredSource(reviewChecklistPath);
    const combinedSource = `${pageSource}\n${panelSource}\n${checklistSource}`;

    assertMatches(combinedSource, /只读|readOnly|readonly/i, "review surface should present read-only article content");
    assertDoesNotMatch(combinedSource, /name="title"|name="summary"|name="body"/i, "review page should not edit article text fields");
    assertDoesNotMatch(combinedSource, /保存内容|saveArticleContent|submitForReview/i, "review page should not expose editor actions");
  });
});
