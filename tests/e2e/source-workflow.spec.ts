import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const sourceDomainPath = "src/domain/source.ts";
const sourceServicePath = "src/services/sourceService.ts";
const sourcePanelPath = "src/components/article/SourcePanel.tsx";
const editPagePath = "src/app/articles/[articleId]/edit/page.tsx";

async function readRequiredSource(path: string) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      assert.fail(`Expected source workflow target to exist: ${path}`);
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

describe("source workflow E2E", () => {
  it("defines source domain and service operations for article references", async () => {
    const domainSource = await readRequiredSource(sourceDomainPath);
    const serviceSource = await readRequiredSource(sourceServicePath);

    assertMatches(domainSource, /ArticleSource/, "source domain should expose article source records");
    assertMatches(domainSource, /SourceCredibility/, "source domain should model credibility");
    assertMatches(domainSource, /SourceUsageStatus/, "source domain should model usage status");
    assertMatches(serviceSource, /saveSource/, "source service should save references");
    assertMatches(serviceSource, /listSources/, "source service should list references by article");
    assertMatches(serviceSource, /markSourceUsed/, "source service should mark whether references were used");
  });

  it("renders a source panel in the article editing scene", async () => {
    const editPageSource = await readRequiredSource(editPagePath);
    const panelSource = await readRequiredSource(sourcePanelPath);

    assertMatches(editPageSource, /SourcePanel/, "edit route should compose the source panel");
    assertMatches(panelSource, /参考来源|source/i, "source panel should identify reference sources");
    assertMatches(panelSource, /name="title"|标题/i, "source panel should capture source title");
    assertMatches(panelSource, /name="url"|url/i, "source panel should capture a source URL");
    assertMatches(panelSource, /name="citationSummary"|引用摘要/i, "source panel should capture citation summary");
    assertMatches(panelSource, /name="credibility"|可信度/i, "source panel should capture credibility");
    assertMatches(panelSource, /used|已用于正文|usageStatus/i, "source panel should show whether a source was used");
    assertMatches(panelSource, /readOnly|disabled|只读/i, "source panel should respect readonly editing states");
    assertDoesNotMatch(panelSource, /submitForReview|提交\s*review/i, "source panel should not take over review submission");
  });
});
