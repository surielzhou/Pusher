import type { ArticleListQuery, CreateArticleInput } from "../../../services/contracts.ts";
import { getRuntimeContainerForApi, runRuntimeMutation } from "../../../services/runtimeContainer.ts";
import {
  castCategory,
  castStatus,
  jsonData,
  optionalPositiveIntegerSearchParam,
  optionalSearchParam,
  optionalString,
  optionalStringArray,
  readJsonObject,
  requiredString,
  withApiHandler
} from "../_http.ts";

export async function GET(request: Request): Promise<Response> {
  return withApiHandler(async () => {
    const url = new URL(request.url);
    const category = optionalSearchParam(url, "category");
    const status = optionalSearchParam(url, "status");
    const query: ArticleListQuery = {
      category: category ? castCategory(category) : undefined,
      status: status ? castStatus(status) : undefined,
      keyword: optionalSearchParam(url, "keyword"),
      page: optionalPositiveIntegerSearchParam(url, "page"),
      pageSize: optionalPositiveIntegerSearchParam(url, "pageSize")
    };

    const runtime = await getRuntimeContainerForApi();
    return jsonData(await runtime.articleService.listArticles(query));
  });
}

export async function POST(request: Request): Promise<Response> {
  return withApiHandler(async () => {
    const body = await readJsonObject(request);
    const input: CreateArticleInput = {
      category: castCategory(requiredString(body, "category")),
      topic: requiredString(body, "topic"),
      audience: optionalString(body, "audience"),
      style: optionalString(body, "style"),
      length: optionalString(body, "length"),
      references: optionalStringArray(body, "references")
    };

    return jsonData(await runRuntimeMutation((runtime) => runtime.articleService.createArticle(input)), 201);
  });
}
