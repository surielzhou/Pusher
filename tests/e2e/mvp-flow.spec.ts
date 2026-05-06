import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  CATEGORY_OPTIONS,
  GENERATION_ENDPOINT,
  buildGenerationPayload,
  isGenerationInputReady,
  resolveGenerationRedirect
} from "../../src/components/article/generationFormModel.ts";

const paths = {
  workbenchPage: "src/app/workbench/page.tsx",
  newArticlePage: "src/app/articles/new/page.tsx",
  editPage: "src/app/articles/[articleId]/edit/page.tsx",
  reviewPage: "src/app/articles/[articleId]/review/page.tsx",
  publishPage: "src/app/articles/[articleId]/publish/page.tsx",
  generationForm: "src/components/article/GenerationForm.tsx",
  articleEditor: "src/components/article/ArticleEditor.tsx",
  imagePanel: "src/components/article/ImagePanel.tsx",
  articlePreview: "src/components/article/ArticlePreview.tsx",
  reviewPanel: "src/components/review/ReviewPanel.tsx",
  reviewChecklist: "src/components/review/ReviewChecklist.tsx",
  publishPanel: "src/components/publish/PublishPreparationPanel.tsx"
} as const;

describe("MVP acceptance E2E flow", () => {
  it("starts from the workbench and creates a generated article draft", async () => {
    const workbenchSource = await readRequiredSource(paths.workbenchPage);
    const newArticleSource = await readRequiredSource(paths.newArticlePage);
    const generationFormSource = await readRequiredSource(paths.generationForm);

    assertMatches(workbenchSource, /\/articles\/new|新建文章/, "workbench should expose article creation");
    assertMatches(newArticleSource, /GenerationForm/, "new article route should render generation form");
    assert.deepEqual(
      CATEGORY_OPTIONS.map((option) => option.value),
      ["tech_internet", "finance", "literature"]
    );
    assert.equal(isGenerationInputReady({ category: "finance", topic: "AI 投研工具" }), true);
    assert.deepEqual(
      buildGenerationPayload({
        category: "finance",
        topic: "  AI 投研工具  ",
        references: "风险提示\n非投资建议"
      }),
      {
        category: "finance",
        topic: "AI 投研工具",
        references: ["风险提示", "非投资建议"],
        requireRiskNote: true
      }
    );
    assert.equal(GENERATION_ENDPOINT, "/api/articles/generation");
    assert.equal(resolveGenerationRedirect("article_001"), "/articles/article_001/edit");
    assertMatches(generationFormSource, /fetch\(GENERATION_ENDPOINT/, "generation form should submit generation request");
    assertMatches(generationFormSource, /window\.location\.assign/, "generation should redirect to editing");
  });

  it("covers editing title, summary, body, image suggestions, preview, and review submission", async () => {
    const editPageSource = await readRequiredSource(paths.editPage);
    const editorSource = await readRequiredSource(paths.articleEditor);
    const imagePanelSource = await readRequiredSource(paths.imagePanel);
    const previewSource = await readRequiredSource(paths.articlePreview);
    const combinedSource = `${editPageSource}\n${editorSource}\n${imagePanelSource}\n${previewSource}`;

    assertMatches(combinedSource, /ArticleEditor/, "edit route should compose the editor");
    assertMatches(combinedSource, /ImagePanel/, "edit route should compose image controls");
    assertMatches(combinedSource, /ArticlePreview/, "edit route should compose WeChat preview");
    assertMatches(combinedSource, /name="title"|标题/i, "editor should expose title editing");
    assertMatches(combinedSource, /name="summary"|摘要/i, "editor should expose summary editing");
    assertMatches(combinedSource, /name="body"|正文/i, "editor should expose body editing");
    assertMatches(combinedSource, /配图建议|suggestion/i, "image panel should support image suggestions");
    assertMatches(combinedSource, /保存内容|save/i, "editor should save edited content");
    assertMatches(combinedSource, /提交\s*review|pending_review/i, "editor should submit review");
    assertMatches(combinedSource, /missingFields|缺失|补齐/i, "editor should show validation gaps before review");
  });

  it("covers human review approval and the review-only gate", async () => {
    const reviewPageSource = await readRequiredSource(paths.reviewPage);
    const panelSource = await readRequiredSource(paths.reviewPanel);
    const checklistSource = await readRequiredSource(paths.reviewChecklist);
    const combinedSource = `${reviewPageSource}\n${panelSource}\n${checklistSource}`;

    assertMatches(combinedSource, /ArticlePreview/, "review route should show a complete preview");
    assertMatches(combinedSource, /ReviewChecklist/, "review route should show checklist");
    assertMatches(combinedSource, /内容方向|category/i, "review should show content category");
    assertMatches(combinedSource, /生成配置|generationConfig|topic/i, "review should show generation config");
    assertMatches(combinedSource, /金融风险提示|riskNote|不构成投资建议/i, "review should expose finance risk note");
    assertMatches(panelSource, /approved|通过/i, "review should support approval");
    assertMatches(panelSource, /rejected|退回修改/i, "review should support returning to edits");
    assertMatches(panelSource, /not_publish|暂不发布/i, "review should support not publish");
    assertMatches(combinedSource, /只读|readOnly|readonly/i, "review should be read-only");
    assert.doesNotMatch(combinedSource, /saveArticleContent|submitForReview/i);
  });

  it("covers publish preparation, copyable WeChat content, and publish gates", async () => {
    const publishPageSource = await readRequiredSource(paths.publishPage);
    const publishPanelSource = await readRequiredSource(paths.publishPanel);
    const combinedSource = `${publishPageSource}\n${publishPanelSource}`;

    assertMatches(combinedSource, /canPreparePublish/, "publish route should use status gate");
    assertMatches(combinedSource, /reviewedVersion === detail\.article\.contentVersion/, "publish route should gate stale reviews");
    assertMatches(combinedSource, /公众号可复制内容|exportContent/i, "publish panel should expose copyable WeChat content");
    assertMatches(combinedSource, /复制标题|data-copy-target="title"/i, "publish panel should support title copy");
    assertMatches(combinedSource, /复制摘要|data-copy-target="summary"/i, "publish panel should support summary copy");
    assertMatches(combinedSource, /复制正文|data-copy-target="body"/i, "publish panel should support body copy");
    assertMatches(combinedSource, /图片清单|imageChecklist|插入位置/i, "publish panel should include image checklist");
    assertMatches(combinedSource, /markPublished|标记已发布/i, "publish panel should mark published");
    assertMatches(combinedSource, /markPublishFailed|发布失败|失败原因/i, "publish panel should record failed publish");
    assertMatches(combinedSource, /未通过 review|暂不发布|重新 review|阻断/i, "publish panel should explain blocked states");
  });
});

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected MVP E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}
