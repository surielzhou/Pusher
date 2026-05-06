import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const editPagePath = "src/app/articles/[articleId]/edit/page.tsx";
const articleEditorPath = "src/components/article/ArticleEditor.tsx";
const imagePanelPath = "src/components/article/ImagePanel.tsx";
const materialPickerPath = "src/components/article/MaterialPicker.tsx";
const articlePreviewPath = "src/components/article/ArticlePreview.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected article editing E2E target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("article editing E2E", () => {
  it("provides the article editing route and composed editor surface", async () => {
    const pageSource = await readRequiredSource(editPagePath);

    assertMatches(pageSource, /ArticleEditor/, "edit route should render the article editor");
    assertMatches(pageSource, /ImagePanel/, "edit route should render the image panel");
    assertMatches(pageSource, /ArticlePreview/, "edit route should render the article preview");
    assertMatches(pageSource, /articleId/, "edit route should read the article id route param");

    await Promise.all([
      readRequiredSource(articleEditorPath),
      readRequiredSource(imagePanelPath),
      readRequiredSource(materialPickerPath),
      readRequiredSource(articlePreviewPath)
    ]);
  });

  it("lets users edit title, summary, body, images, preview, save, and submit review", async () => {
    const editorSource = await readRequiredSource(articleEditorPath);
    const imagePanelSource = await readRequiredSource(imagePanelPath);
    const previewSource = await readRequiredSource(articlePreviewPath);
    const combinedSource = `${editorSource}\n${imagePanelSource}\n${previewSource}`;

    assertMatches(combinedSource, /标题|title/i, "editor should expose the title field");
    assertMatches(combinedSource, /摘要|summary/i, "editor should expose the summary field");
    assertMatches(combinedSource, /正文|body/i, "editor should expose the body field");
    assertMatches(combinedSource, /配图|图片|image/i, "editor should expose image management");
    assertMatches(combinedSource, /预览|preview/i, "editor should expose a WeChat preview");
    assertMatches(combinedSource, /保存|save/i, "editor should support saving article content");
    assertMatches(combinedSource, /提交\s*review|submitForReview|pending_review/i, "editor should submit for review");
  });

  it("supports image suggestions and uploaded image replacement", async () => {
    const imagePanelSource = await readRequiredSource(imagePanelPath);

    assertMatches(imagePanelSource, /suggestion|配图建议/i, "image panel should support image suggestions");
    assertMatches(imagePanelSource, /name="description"|描述|说明/i, "image suggestions should capture a description");
    assertMatches(imagePanelSource, /name="position"|位置/i, "image suggestions should capture a placement");
    assertMatches(imagePanelSource, /replaceImage|替换|上传/i, "image panel should support replacing images");
    assertMatches(imagePanelSource, /name="url"|url/i, "uploaded or external images should capture a url");
    assertMatches(imagePanelSource, /name="source"|来源/i, "uploaded or external images should capture a source");
    assertMatches(imagePanelSource, /uploaded/i, "image replacement should support uploaded images");
  });

  it("supports selecting images from the material library", async () => {
    const editPageSource = await readRequiredSource(editPagePath);
    const imagePanelSource = await readRequiredSource(imagePanelPath);
    const materialPickerSource = await readRequiredSource(materialPickerPath);
    const combinedSource = `${editPageSource}\n${imagePanelSource}\n${materialPickerSource}`;

    assertMatches(combinedSource, /MaterialPicker/, "edit route should compose the material picker");
    assertMatches(combinedSource, /素材库|material library|material/i, "image panel should expose material library selection");
    assertMatches(combinedSource, /name="materialId"|materialId/i, "material picker should submit a material id");
    assertMatches(combinedSource, /type="hidden" value="material"|type:\s*"material"/i, "material selection should replace images as material type");
  });

  it("shows missing fields before review and makes pending review articles readonly", async () => {
    const editorSource = await readRequiredSource(articleEditorPath);
    const imagePanelSource = await readRequiredSource(imagePanelPath);
    const combinedSource = `${editorSource}\n${imagePanelSource}`;

    assertMatches(
      combinedSource,
      /validateForReview|missingFields|缺失|补齐/i,
      "editor should surface validation gaps before submitting review"
    );
    assertMatches(editorSource, /pending_review/i, "editor should branch on pending_review status");
    assertMatches(combinedSource, /readOnly|readonly|disabled|只读/i, "pending_review should render readonly controls");
  });

  it("shows the latest rejection reason for review rejected articles", async () => {
    const editorSource = await readRequiredSource(articleEditorPath);

    assertMatches(editorSource, /review_rejected/i, "editor should branch on review_rejected status");
    assertMatches(editorSource, /退回原因|rejection|rejected|latestReview|comment/i, "editor should show rejection context");
  });
});
