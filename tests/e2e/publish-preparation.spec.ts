import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const publishPagePath = "src/app/articles/[articleId]/publish/page.tsx";
const publishPanelPath = "src/components/publish/PublishPreparationPanel.tsx";
const articlePreviewPath = "src/components/article/ArticlePreview.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected publish preparation E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("publish preparation E2E", () => {
  it("provides the article publish route and composed publish surface", async () => {
    const pageSource = await readRequiredSource(publishPagePath);

    assertMatches(pageSource, /PublishPreparationPanel/, "publish route should render the publish preparation panel");
    assertMatches(pageSource, /ArticlePreview/, "publish route should render the final article preview");
    assertMatches(pageSource, /articleId/, "publish route should read the article id route param");
    assertMatches(pageSource, /approved|pending_publish|canPreparePublish/i, "publish route should gate by publishable status");

    await Promise.all([readRequiredSource(publishPanelPath), readRequiredSource(articlePreviewPath)]);
  });

  it("loads publish data from the runtime instead of static builders", async () => {
    const pageSource = await readRequiredSource(publishPagePath);

    assertMatches(pageSource, /getRuntimePublishPageData/, "publish page should load publish data from runtime page data");
    assert.doesNotMatch(pageSource, /function buildArticle|function buildImages|function buildLatestPublish/, "publish page should not build static article fixtures");
  });

  it("shows final title, summary, body preview, image checklist, and insertion positions", async () => {
    const pageSource = await readRequiredSource(publishPagePath);
    const panelSource = await readRequiredSource(publishPanelPath);
    const combinedSource = `${pageSource}\n${panelSource}`;

    assertMatches(combinedSource, /最终标题|title/i, "publish preparation should show the final title");
    assertMatches(combinedSource, /摘要|summary/i, "publish preparation should show the summary");
    assertMatches(combinedSource, /正文预览|body|paragraph/i, "publish preparation should show the body preview");
    assertMatches(combinedSource, /图片清单|imageChecklist|images\.map|配图/i, "publish preparation should show image records");
    assertMatches(combinedSource, /插入位置|position/i, "publish preparation should show image insertion positions");
  });

  it("generates WeChat copyable content with copy controls for title, summary, and body", async () => {
    const panelSource = await readRequiredSource(publishPanelPath);

    assertMatches(panelSource, /公众号可复制内容|wechat|exportContent/i, "publish panel should expose WeChat copyable content");
    assertMatches(panelSource, /readOnly|readonly|textarea/i, "copyable content should be rendered in read-only fields");
    assertMatches(panelSource, /复制标题|copy-title|data-copy-target="title"/i, "publish panel should support copying title");
    assertMatches(panelSource, /复制摘要|copy-summary|data-copy-target="summary"/i, "publish panel should support copying summary");
    assertMatches(panelSource, /复制正文|copy-body|data-copy-target="body"/i, "publish panel should support copying body");
  });

  it("supports marking published or failed with a required failure reason", async () => {
    const panelSource = await readRequiredSource(publishPanelPath);

    assertMatches(panelSource, /markPublished|已发布|published/i, "publish panel should support marking an article as published");
    assertMatches(panelSource, /markPublishFailed|发布失败|publish_failed|failed/i, "publish panel should support failed publish results");
    assertMatches(panelSource, /name="errorMessage"|失败原因|required/i, "publish failure should require an error message");
    assertMatches(panelSource, /wechat_manual|publish result|发布结果/i, "publish result should record the manual WeChat channel");
  });

  it("blocks publish preparation for articles that are not approved or pending publish", async () => {
    const pageSource = await readRequiredSource(publishPagePath);
    const panelSource = await readRequiredSource(publishPanelPath);
    const combinedSource = `${pageSource}\n${panelSource}`;

    assertMatches(combinedSource, /canPreparePublish|approved|pending_publish/i, "publish gate should check allowed statuses");
    assertMatches(combinedSource, /未通过 review|暂不发布|重新 review|阻断|不能进入发布准备/i, "blocked articles should show a clear gate message");
    assertMatches(combinedSource, /disabled={!canPublish}|disabled={isBlocked}|disabled={publishBlocked}/i, "blocked articles should disable publish actions");
  });
});
