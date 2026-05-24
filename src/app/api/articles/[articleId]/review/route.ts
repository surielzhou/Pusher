import { REVIEW_RESULTS } from "../../../../../domain/review.ts";
import { getRuntimeContainer } from "../../../../../services/runtimeContainer.ts";
import {
  assertAllowedValue,
  castReviewResult,
  getRouteParam,
  jsonData,
  optionalBooleanRecord,
  optionalString,
  readJsonObject,
  requiredString,
  type ApiRouteContext,
  withApiHandler
} from "../../../_http.ts";

export async function GET(_request: Request, context: ApiRouteContext): Promise<Response> {
  return withApiHandler(async () => {
    const articleId = await getRouteParam(context, "articleId");

    return jsonData(await getRuntimeContainer().reviewService.getReviewView(articleId));
  });
}

export async function POST(request: Request, context: ApiRouteContext): Promise<Response> {
  return withApiHandler(async () => {
    const articleId = await getRouteParam(context, "articleId");
    const body = await readJsonObject(request);
    const result = castReviewResult(assertAllowedValue(requiredString(body, "result"), REVIEW_RESULTS, "result"));

    return jsonData(
      await getRuntimeContainer().reviewService.submitReview({
        articleId,
        result,
        comment: optionalString(body, "comment"),
        reviewChecklist: optionalBooleanRecord(body, "reviewChecklist")
      })
    );
  });
}
