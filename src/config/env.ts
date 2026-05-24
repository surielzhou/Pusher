export type PusherEnvInput = Record<string, string | undefined>;

export type EnvValidationArea = "ai" | "wechat" | "persistence" | "runtime";
export type EnvValidationSeverity = "error" | "warning";
export type EnvValidationStatus = "ready" | "warning" | "error";

export interface EnvValidationIssue {
  area: EnvValidationArea;
  code: string;
  variable: string;
  severity: EnvValidationSeverity;
  message: string;
}

export interface EnvValidationCheck {
  area: EnvValidationArea;
  status: EnvValidationStatus;
  issues: EnvValidationIssue[];
}

export interface PusherEnvValidationReport {
  valid: boolean;
  status: EnvValidationStatus;
  checks: EnvValidationCheck[];
  issues: EnvValidationIssue[];
}

export class PusherEnvValidationError extends Error {
  readonly report: PusherEnvValidationReport;

  constructor(report: PusherEnvValidationReport) {
    super("Pusher environment validation failed");
    this.name = "PusherEnvValidationError";
    this.report = report;
  }
}

export function validatePusherEnv(input: PusherEnvInput): PusherEnvValidationReport {
  const issues: EnvValidationIssue[] = [];
  const nodeEnv = normalized(input.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const textProvider = normalized(input.AI_TEXT_PROVIDER);
  const imageProvider = normalized(input.AI_IMAGE_PROVIDER);
  const persistenceDriver = normalized(input.PERSISTENCE_DRIVER) ?? "memory";

  if (isProduction && !textProvider) {
    issues.push(createIssue("ai", "ai_text_provider_missing", "AI_TEXT_PROVIDER", "error"));
  }

  if (requiresApiKey(textProvider) && !normalized(input.AI_TEXT_API_KEY)) {
    issues.push(createIssue("ai", "ai_text_api_key_missing", "AI_TEXT_API_KEY", "error"));
  }

  if (requiresApiKey(imageProvider) && !normalized(input.AI_IMAGE_API_KEY)) {
    issues.push(createIssue("ai", "ai_image_api_key_missing", "AI_IMAGE_API_KEY", "error"));
  }

  if (parseBoolean(input.WECHAT_DRAFT_ENABLED) === true) {
    if (!normalized(input.WECHAT_APP_ID)) {
      issues.push(createIssue("wechat", "wechat_app_id_missing", "WECHAT_APP_ID", "error"));
    }

    if (!normalized(input.WECHAT_APP_SECRET)) {
      issues.push(createIssue("wechat", "wechat_app_secret_missing", "WECHAT_APP_SECRET", "error"));
    }
  }

  if (persistenceDriver === "memory" && isProduction) {
    issues.push(createIssue("persistence", "persistence_driver_memory_in_production", "PERSISTENCE_DRIVER", "error"));
  }

  if (persistenceDriver === "file" && !normalized(input.FILE_STORAGE_ROOT)) {
    issues.push(createIssue("persistence", "file_storage_root_missing", "FILE_STORAGE_ROOT", "error"));
  }

  if ((persistenceDriver === "database" || persistenceDriver === "sqlite" || persistenceDriver === "postgres") && !normalized(input.DATABASE_URL)) {
    issues.push(createIssue("persistence", "database_url_missing", "DATABASE_URL", "error"));
  }

  if (isProduction && !normalized(input.APP_BASE_URL)) {
    issues.push(createIssue("runtime", "app_base_url_missing", "APP_BASE_URL", "error"));
  }

  const checks = createChecks(issues);
  const status = resolveStatus(issues);

  return {
    valid: status !== "error",
    status,
    checks,
    issues
  };
}

export function assertValidPusherEnv(input: PusherEnvInput): PusherEnvValidationReport {
  const report = validatePusherEnv(input);
  if (!report.valid) {
    throw new PusherEnvValidationError(report);
  }

  return report;
}

function createIssue(
  area: EnvValidationArea,
  code: string,
  variable: string,
  severity: EnvValidationSeverity
): EnvValidationIssue {
  return {
    area,
    code,
    variable,
    severity,
    message: `${variable} is required for ${area} operations`
  };
}

function createChecks(issues: EnvValidationIssue[]): EnvValidationCheck[] {
  const areas: EnvValidationArea[] = ["ai", "wechat", "persistence", "runtime"];

  return areas.map((area) => {
    const areaIssues = issues.filter((issue) => issue.area === area);

    return {
      area,
      status: resolveStatus(areaIssues),
      issues: areaIssues
    };
  });
}

function resolveStatus(issues: EnvValidationIssue[]): EnvValidationStatus {
  if (issues.some((issue) => issue.severity === "error")) {
    return "error";
  }

  if (issues.length > 0) {
    return "warning";
  }

  return "ready";
}

function normalized(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed.toLowerCase() : undefined;
}

function requiresApiKey(provider: string | undefined): boolean {
  return provider === "openai" || provider === "custom";
}

function parseBoolean(value: string | undefined): boolean | undefined {
  const normalizedValue = normalized(value);
  if (normalizedValue === "true" || normalizedValue === "1" || normalizedValue === "yes") return true;
  if (normalizedValue === "false" || normalizedValue === "0" || normalizedValue === "no") return false;
  return undefined;
}
