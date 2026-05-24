import type { ArticleStatus, ContentCategory } from "../../domain/status.ts";
import type { ReviewResult } from "../../domain/review.ts";

export interface ApiRouteContext {
  params?: Record<string, string> | Promise<Record<string, string>>;
}

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}

export async function withApiHandler(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return jsonError(error);
  }
}

export function jsonData(data: unknown, status = 200): Response {
  return Response.json(
    { data },
    {
      status,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const body = await readJsonBody(request);

  if (!isRecord(body)) {
    throw new ApiRequestError("invalid_request", "JSON body must be an object");
  }

  return body;
}

export async function readOptionalJsonObject(request: Request): Promise<Record<string, unknown>> {
  if (request.body === null) {
    return {};
  }

  return readJsonObject(request);
}

export async function getRouteParam(context: ApiRouteContext, name: string): Promise<string> {
  const params = await context.params;
  const value = params?.[name];

  if (!value) {
    throw new ApiRequestError("missing_route_param", `Route parameter ${name} is required`, 400);
  }

  return value;
}

export function requiredString(body: Record<string, unknown>, field: string): string {
  const value = body[field];

  if (typeof value !== "string" || !value.trim()) {
    throw new ApiRequestError("invalid_request", `${field} is required`, 400);
  }

  return value;
}

export function optionalString(body: Record<string, unknown>, field: string): string | undefined {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ApiRequestError("invalid_request", `${field} must be a string`, 400);
  }

  return value;
}

export function optionalStringArray(body: Record<string, unknown>, field: string): string[] | undefined {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw new ApiRequestError("invalid_request", `${field} must be an array of strings`, 400);
  }

  return [...value];
}

export function optionalBooleanRecord(body: Record<string, unknown>, field: string): Record<string, boolean> | undefined {
  const value = body[field];

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value) || !Object.values(value).every((item) => typeof item === "boolean")) {
    throw new ApiRequestError("invalid_request", `${field} must be an object of booleans`, 400);
  }

  return { ...value } as Record<string, boolean>;
}

export function optionalSearchParam(url: URL, field: string): string | undefined {
  const value = url.searchParams.get(field)?.trim();
  return value ? value : undefined;
}

export function optionalPositiveIntegerSearchParam(url: URL, field: string): number | undefined {
  const value = optionalSearchParam(url, field);

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ApiRequestError("invalid_request", `${field} must be a positive integer`, 400);
  }

  return parsed;
}

export function assertAllowedValue<T extends string>(
  value: string,
  allowedValues: readonly T[],
  field: string
): T {
  if (!(allowedValues as readonly string[]).includes(value)) {
    throw new ApiRequestError("invalid_request", `${field} is not supported`, 400);
  }

  return value as T;
}

export function pickContentPatch(body: Record<string, unknown>): {
  title?: string;
  summary?: string;
  body?: string;
} {
  const patch = {
    title: optionalString(body, "title"),
    summary: optionalString(body, "summary"),
    body: optionalString(body, "body")
  };

  if (patch.title === undefined && patch.summary === undefined && patch.body === undefined) {
    throw new ApiRequestError("invalid_request", "At least one content field is required", 400);
  }

  return patch;
}

export function castCategory(value: string): ContentCategory {
  return value as ContentCategory;
}

export function castStatus(value: string): ArticleStatus {
  return value as ArticleStatus;
}

export function castReviewResult(value: string): ReviewResult {
  return value as ReviewResult;
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiRequestError("invalid_json", "Request body must be valid JSON", 400);
  }
}

function jsonError(error: unknown): Response {
  const mapped = mapApiError(error);

  return Response.json(
    {
      error: {
        code: mapped.code,
        message: mapped.message
      }
    },
    {
      status: mapped.status,
      headers: {
        "cache-control": "no-store"
      }
    }
  );
}

function mapApiError(error: unknown): { status: number; code: string; message: string } {
  if (error instanceof ApiRequestError) {
    return {
      status: error.status,
      code: error.code,
      message: error.message
    };
  }

  if (!isErrorLike(error)) {
    return {
      status: 500,
      code: "internal_error",
      message: "Internal server error"
    };
  }

  if (error.name === "GenerationServiceError") {
    return mapGenerationError(error);
  }

  if (error.name === "ImageGenerationError") {
    return {
      status: error.code === "adapter_missing" ? 503 : 502,
      code: `image_generation_${error.code}`,
      message: error.message
    };
  }

  if (error.name === "RepositoryError") {
    return {
      status: error.code === "not_found" ? 404 : 400,
      code: `repository_${error.code}`,
      message: error.message
    };
  }

  const named = namedErrorMap[error.name];
  if (named) {
    return {
      ...named,
      message: error.message
    };
  }

  return {
    status: 500,
    code: "internal_error",
    message: "Internal server error"
  };
}

function mapGenerationError(error: Error & { code?: string }): { status: number; code: string; message: string } {
  if (error.code === "article_not_found") {
    return {
      status: 404,
      code: "article_not_found",
      message: error.message
    };
  }

  return {
    status: error.code === "adapter_failed" ? 502 : 500,
    code: `generation_${error.code ?? "failed"}`,
    message: error.message
  };
}

const namedErrorMap: Record<string, { status: number; code: string }> = {
  ArticleInputError: { status: 400, code: "article_invalid_input" },
  ArticleServiceNotFoundError: { status: 404, code: "article_not_found" },
  ArticleNotFoundError: { status: 404, code: "article_not_found" },
  EditorArticleNotFoundError: { status: 404, code: "article_not_found" },
  ReviewArticleNotFoundError: { status: 404, code: "article_not_found" },
  PublishArticleNotFoundError: { status: 404, code: "article_not_found" },
  ImageNotFoundError: { status: 404, code: "image_not_found" },
  PublishRecordNotFoundError: { status: 404, code: "publish_record_not_found" },
  MaterialNotFoundError: { status: 404, code: "material_not_found" },
  ArticleNotEditableError: { status: 409, code: "article_not_editable" },
  ArticleImageNotEditableError: { status: 409, code: "article_image_not_editable" },
  ArticleNotReviewableError: { status: 409, code: "article_not_reviewable" },
  ArticleNotPublishableError: { status: 409, code: "article_not_publishable" },
  ArticleReviewVersionMismatchError: { status: 409, code: "article_review_version_mismatch" },
  ArticleStatusTransitionError: { status: 409, code: "article_status_transition_invalid" },
  ArticleReviewValidationError: { status: 422, code: "article_review_validation_failed" },
  ReviewCommentRequiredError: { status: 400, code: "review_comment_required" },
  PublishFailureReasonRequiredError: { status: 400, code: "publish_failure_reason_required" },
  AuthUserNotFoundError: { status: 404, code: "auth_user_not_found" },
  AuthUserDisabledError: { status: 403, code: "auth_user_disabled" },
  PermissionDeniedError: { status: 403, code: "permission_denied" },
  WechatDraftClientRequiredError: { status: 503, code: "wechat_draft_client_required" }
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isErrorLike(error: unknown): error is Error & { code?: string } {
  return error instanceof Error;
}
