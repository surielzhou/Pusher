import { getRuntimeContainer } from "../../../../services/runtimeContainer.ts";
import { getRouteParam, jsonData, type ApiRouteContext, withApiHandler } from "../../_http.ts";

export async function GET(_request: Request, context: ApiRouteContext): Promise<Response> {
  return withApiHandler(async () => {
    const articleId = await getRouteParam(context, "articleId");

    return jsonData(await getRuntimeContainer().articleService.getArticleDetail(articleId));
  });
}
