import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const pagePath = "src/app/articles/[articleId]/edit/page.tsx";
const articleEditorPath = "src/components/article/ArticleEditor.tsx";
const imagePanelPath = "src/components/article/ImagePanel.tsx";
const articlePreviewPath = "src/components/article/ArticlePreview.tsx";

async function readSource(path: string): Promise<string> {
  return readFile(path, "utf8");
}

describe("article editing experience", () => {
  it("routes article editing through the page and required article components", async () => {
    const source = await readSource(pagePath);

    assert.match(source, /ArticleEditor/);
    assert.match(source, /ImagePanel/);
    assert.match(source, /ArticlePreview/);
    assert.match(source, /articleId/);
  });

  it("supports editing content, read-only review state, rejected review reason, and pre-review missing items", async () => {
    const source = await readSource(articleEditorPath);

    assert.match(source, /name="title"/);
    assert.match(source, /name="summary"/);
    assert.match(source, /name="body"/);
    assert.match(source, /保存内容/);
    assert.match(source, /提交 review/);
    assert.match(source, /missingFields/);
    assert.match(source, /pending_review/);
    assert.match(source, /review_rejected/);
    assert.match(source, /latestReview/);
    assert.match(source, /readOnly/);
  });

  it("supports image suggestions and uploaded image replacement controls", async () => {
    const source = await readSource(imagePanelPath);

    assert.match(source, /配图建议/);
    assert.match(source, /name="description"/);
    assert.match(source, /name="position"/);
    assert.match(source, /保存配图建议/);
    assert.match(source, /替换图片/);
    assert.match(source, /name="url"/);
    assert.match(source, /name="source"/);
    assert.match(source, /uploaded/);
    assert.match(source, /readOnly/);
  });

  it("renders a WeChat-style article preview with title, summary, body, and images", async () => {
    const source = await readSource(articlePreviewPath);

    assert.match(source, /公众号预览/);
    assert.match(source, /article.title/);
    assert.match(source, /article.summary/);
    assert.match(source, /article.body/);
    assert.match(source, /images.map/);
  });
});
