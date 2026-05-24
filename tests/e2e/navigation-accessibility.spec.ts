import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const layoutPath = "src/app/layout.tsx";
const globalsPath = "src/app/globals.css";
const appShellPath = "src/components/navigation/AppShell.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected navigation accessibility target to exist: ${path}`);
    }

    throw error;
  }
}

function assertMatches(source: string, pattern: RegExp, description: string) {
  assert.match(source, pattern, description);
}

describe("navigation and accessibility E2E", () => {
  it("wraps every page in a unified application shell", async () => {
    const layoutSource = await readRequiredSource(layoutPath);
    const appShellSource = await readRequiredSource(appShellPath);

    assertMatches(layoutSource, /import AppShell from "\.\.\/components\/navigation\/AppShell\.tsx"/, "layout should import AppShell");
    assertMatches(layoutSource, /<AppShell>\s*\{children\}\s*<\/AppShell>/s, "layout should wrap children in AppShell");
    assertMatches(layoutSource, /title:\s*"Pusher 运营工作台"/, "root metadata should expose an application title");
    assertMatches(appShellSource, /id="page-content"/, "shell should provide a stable skip-link target");
  });

  it("exposes the Phase 8 primary navigation entries", async () => {
    const appShellSource = await readRequiredSource(appShellPath);

    assertMatches(appShellSource, /aria-label="主导航"/, "shell should expose a named primary navigation landmark");

    for (const [label, href] of [
      ["工作台", "/workbench"],
      ["新建文章", "/articles/new"],
      ["历史", "/history"],
      ["排期", "/schedule"],
      ["审计", "/audit"]
    ]) {
      assertMatches(appShellSource, new RegExp(`label: "${label}"`), `navigation should include ${label}`);
      assertMatches(appShellSource, new RegExp(`href: "${href.replace("/", "\\/")}`), `${label} should link to ${href}`);
    }
  });

  it("supports keyboard navigation with a visible skip link and focus styles", async () => {
    const appShellSource = await readRequiredSource(appShellPath);
    const globalSource = await readRequiredSource(globalsPath);

    assertMatches(appShellSource, /href="#page-content"/, "shell should offer a skip link to page content");
    assertMatches(appShellSource, /className="skip-link"/, "skip link should use the shared skip-link style");
    assertMatches(globalSource, /:focus-visible/, "global CSS should style keyboard focus");
    assertMatches(globalSource, /\.skip-link:focus/, "global CSS should reveal skip links on focus");
    assertMatches(globalSource, /@media \(max-width: 720px\)/, "shell navigation should have a mobile breakpoint");
  });

  it("keeps forms labeled and action buttons semantic across key workflows", async () => {
    const sources = await Promise.all([
      readRequiredSource("src/components/article/GenerationForm.tsx"),
      readRequiredSource("src/components/article/ArticleEditor.tsx"),
      readRequiredSource("src/components/review/ReviewPanel.tsx"),
      readRequiredSource("src/components/publish/PublishPreparationPanel.tsx")
    ]);
    const combinedSource = sources.join("\n");

    for (const label of ["内容方向", "主题或关键词", "标题", "摘要", "正文", "审核意见", "失败原因"]) {
      assertMatches(combinedSource, new RegExp(label), `workflow forms should expose the ${label} label`);
    }

    assertMatches(combinedSource, /<button[^>]+type="submit"/s, "submit actions should use submit buttons");
    assertMatches(combinedSource, /<button[^>]+type="button"/s, "secondary actions should use button controls");
    assertMatches(combinedSource, /aria-label=/, "workflow controls should include accessible names where visible text is insufficient");
  });
});
