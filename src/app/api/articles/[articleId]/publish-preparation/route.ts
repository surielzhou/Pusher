import { getRuntimeContainer } from "../../../../../services/runtimeContainer.ts";
import {
  getRouteParam,
  jsonData,
  optionalString,
  readOptionalJsonObject,
  type ApiRouteContext,
  withApiHandler
} from "../../../_http.ts";

export async function POST(request: Request, context: ApiRouteContext): Promise<Response> {
  return withApiHandler(async () => {
    const articleId = await getRouteParam(context, "articleId");
    const body = await readOptionalJsonObject(request);

    return jsonData(
      await getRuntimeContainer().publishPreparationService.preparePublish({
        articleId,
        channel: optionalString(body, "channel") ?? "wechat_manual"
      }),
      201
    );
  });
}
