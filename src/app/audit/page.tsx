import AuditTimeline from "../../components/workbench/AuditTimeline.tsx";
import { validatePusherEnv, type EnvValidationCheck, type EnvValidationStatus } from "../../config/env.ts";
import type { AuditTimelineItem } from "../../services/auditLogService.ts";

const runtimeEnvVariables = [
  "NODE_ENV",
  "APP_BASE_URL",
  "AI_TEXT_PROVIDER",
  "AI_TEXT_API_KEY",
  "AI_IMAGE_PROVIDER",
  "AI_IMAGE_API_KEY",
  "WECHAT_DRAFT_ENABLED",
  "WECHAT_APP_ID",
  "WECHAT_APP_SECRET",
  "PERSISTENCE_DRIVER",
  "DATABASE_URL",
  "FILE_STORAGE_ROOT",
  "LOG_LEVEL"
];

const demoTimeline: AuditTimelineItem[] = [
  {
    id: "audit_005",
    articleId: "article_pending_publish_finance",
    action: "wechat.draft_created",
    label: "公众号草稿创建",
    message: "公众号草稿创建",
    actorId: "publisher_001",
    metadata: { draftId: "draft_001" },
    occurredAt: new Date("2026-05-06T11:35:00.000Z"),
    source: "audit_log"
  },
  {
    id: "audit_004",
    articleId: "article_pending_publish_finance",
    action: "publish.prepared",
    label: "发布准备完成",
    message: "发布准备完成",
    actorId: "publisher_001",
    metadata: { channel: "wechat_manual" },
    occurredAt: new Date("2026-05-06T11:20:00.000Z"),
    source: "audit_log"
  },
  {
    id: "status_event_003",
    articleId: "article_approved_literature",
    action: "review.submitted",
    label: "提交 Review",
    message: "submit review",
    metadata: { fromStatus: "editing", toStatus: "pending_review" },
    occurredAt: new Date("2026-05-06T10:40:00.000Z"),
    source: "status_event"
  },
  {
    id: "audit_002",
    articleId: "article_editing_ai_agent",
    action: "article.edited",
    label: "内容编辑",
    message: "补充了导语和配图说明",
    actorId: "creator_001",
    occurredAt: new Date("2026-05-06T10:05:00.000Z"),
    source: "audit_log"
  },
  {
    id: "audit_001",
    articleId: "article_editing_ai_agent",
    action: "article.generated",
    label: "AI 生成完成",
    message: "AI 生成完成",
    actorId: "system",
    metadata: { contentVersion: 2 },
    occurredAt: new Date("2026-05-06T09:50:00.000Z"),
    source: "audit_log"
  }
];

const statusLabels: Record<EnvValidationStatus, string> = {
  error: "阻塞",
  ready: "就绪",
  warning: "警告"
};

const areaLabels = {
  ai: "AI 配置",
  persistence: "持久化",
  runtime: "运行时",
  wechat: "微信草稿"
};

export default function AuditPage() {
  const envReport = validatePusherEnv(readRuntimeEnv());

  return (
    <main
      style={{
        background: "#f7f8fa",
        minHeight: "100vh",
        padding: "32px clamp(16px, 4vw, 48px)"
      }}
    >
      <div style={{ display: "grid", gap: 24, margin: "0 auto", maxWidth: 1180 }}>
        <header style={{ alignItems: "end", display: "flex", gap: 16, justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Pusher 运维审计</p>
            <h1 style={{ color: "#102a43", fontSize: 30, lineHeight: 1.2, margin: 0 }}>环境校验与审计日志</h1>
          </div>
          <a href="/workbench" style={secondaryLinkStyle}>
            返回工作台
          </a>
        </header>

        <section aria-labelledby="environment-heading" style={sectionStyle}>
          <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between" }}>
            <h2 id="environment-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
              环境校验
            </h2>
            <span style={statusBadgeStyle(envReport.status)}>{statusLabels[envReport.status]}</span>
          </div>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, minmax(0, 1fr))" }}>
            {envReport.checks.map((check) => (
              <EnvCheckSummary key={check.area} check={check} />
            ))}
          </div>

          <div style={{ color: "#52606d", display: "flex", flexWrap: "wrap", fontSize: 13, gap: 8 }}>
            {runtimeEnvVariables.map((variable) => (
              <code key={variable} style={codeStyle}>
                {variable}
              </code>
            ))}
          </div>
        </section>

        <AuditTimeline items={demoTimeline} />

        <section aria-labelledby="acceptance-heading" style={sectionStyle}>
          <h2 id="acceptance-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
            生产化验收
          </h2>
          <div style={{ color: "#334e68", display: "grid", gap: 8, lineHeight: 1.55 }}>
            <p style={{ margin: 0 }}>配置、启动、数据备份和回滚检查记录在 docs/部署验收/Phase8生产化验收清单.md。</p>
            <p style={{ margin: 0 }}>上线前以审计时间线复核 AI 生成、内容编辑、Review、发布准备和公众号草稿创建动作。</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function EnvCheckSummary({ check }: { check: EnvValidationCheck }) {
  return (
    <article style={envCheckStyle}>
      <div style={{ alignItems: "center", display: "flex", gap: 8, justifyContent: "space-between" }}>
        <h3 style={{ color: "#102a43", fontSize: 15, margin: 0 }}>{areaLabels[check.area]}</h3>
        <span style={statusBadgeStyle(check.status)}>{statusLabels[check.status]}</span>
      </div>
      <p style={{ color: "#52606d", lineHeight: 1.45, margin: 0 }}>
        {check.issues.length > 0
          ? check.issues.map((issue) => `${issue.variable}: ${issue.code}`).join("；")
          : "未发现阻塞项"}
      </p>
    </article>
  );
}

function readRuntimeEnv(): Record<string, string | undefined> {
  return Object.fromEntries(runtimeEnvVariables.map((variable) => [variable, process.env[variable]]));
}

function statusBadgeStyle(status: EnvValidationStatus) {
  const palette = {
    error: { background: "#fee2e2", color: "#991b1b" },
    ready: { background: "#dcfce7", color: "#166534" },
    warning: { background: "#fef3c7", color: "#92400e" }
  }[status];

  return {
    ...palette,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 700,
    padding: "4px 8px"
  };
}

const sectionStyle = {
  background: "#ffffff",
  border: "1px solid #d9e2ec",
  borderRadius: 8,
  display: "grid",
  gap: 16,
  padding: "18px"
};

const envCheckStyle = {
  border: "1px solid #e5eaf0",
  borderRadius: 8,
  display: "grid",
  gap: 10,
  padding: "12px"
};

const codeStyle = {
  background: "#eef2f7",
  borderRadius: 6,
  color: "#243b53",
  padding: "4px 6px"
};

const secondaryLinkStyle = {
  border: "1px solid #bcccdc",
  borderRadius: 6,
  color: "#243b53",
  fontWeight: 700,
  padding: "8px 10px",
  textDecoration: "none"
};
