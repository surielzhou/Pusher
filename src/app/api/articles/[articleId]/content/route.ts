import { getRuntimeContainer } from "../../../../../services/runtimeContainer.ts";
import {
  getRouteParam,
  jsonData,
  pickContentPatch,
  readJsonObject,
  type ApiRouteContext,
  withApiHandler
} from "../../../_http.ts";

export async function PATCH(request: Request, context: ApiRouteContext): Promise<Response> {
  return withApiHandler(async () => {
    const articleId = await getRouteParam(context, "articleId");
    const body = await readJsonObject(request);

    return jsonData(await getRuntimeContainer().editorService.saveArticleContent(articleId, pickContentPatch(body)));
  });
}
