import type { GenerationScope } from "../../../../../adapters/ai/textGenerationAdapter.ts";
import { runRuntimeMutation } from "../../../../../services/runtimeContainer.ts";
import {
  assertAllowedValue,
  getRouteParam,
  jsonData,
  optionalString,
  readOptionalJsonObject,
  type ApiRouteContext,
  withApiHandler
} from "../../../_http.ts";

const GENERATION_SCOPES: readonly GenerationScope[] = ["full", "title", "summary", "section", "image_suggestion"];

export async function POST(request: Request, context: ApiRouteContext): Promise<Response> {
  return withApiHandler(async () => {
    const articleId = await getRouteParam(context, "articleId");
    const body = await readOptionalJsonObject(request);
    const scopeInput = optionalString(body, "scope");
    const instruction = optionalString(body, "instruction");

    return jsonData(
      await runRuntimeMutation((runtime) => {
        if (scopeInput || instruction) {
          const scope = scopeInput ? assertAllowedValue(scopeInput, GENERATION_SCOPES, "scope") : undefined;

          return runtime.generationService.regenerateDraft(articleId, { scope, instruction });
        }

        return runtime.generationService.generateDraft(articleId);
      })
    );
  });
}
