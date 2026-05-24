import type { AuditTimelineItem } from "../../services/auditLogService.ts";

interface AuditTimelineProps {
  items: AuditTimelineItem[];
}

const actionLabels = {
  "article.edited": "内容编辑",
  "article.generated": "AI 生成完成",
  "article.generation_failed": "AI 生成失败",
  "article.status_changed": "状态变更",
  "publish.failed": "发布失败",
  "publish.prepared": "发布准备完成",
  "publish.published": "发布完成",
  "review.approved": "Review 通过",
  "review.not_publish": "暂不发布",
  "review.rejected": "Review 退回",
  "review.submitted": "提交 Review",
  "wechat.draft_created": "公众号草稿创建"
};

const sourceLabels = {
  audit_log: "审计记录",
  status_event: "状态事件"
};

export default function AuditTimeline({ items }: AuditTimelineProps) {
  return (
    <section aria-labelledby="audit-timeline-heading" style={{ display: "grid", gap: 14 }}>
      <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between" }}>
        <h2 id="audit-timeline-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
          审计时间线
        </h2>
        <span style={{ color: "#627d98", fontSize: 13, fontWeight: 700 }}>{items.length} 条记录</span>
      </div>

      <ol style={{ display: "grid", gap: 10, listStyle: "none", margin: 0, padding: 0 }}>
        {items.map((item) => (
          <li key={item.id} style={timelineItemStyle}>
            <time dateTime={item.occurredAt.toISOString()} style={timeStyle}>
              {formatDateTime(item.occurredAt)}
            </time>
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: 8 }}>
                <strong style={{ color: "#102a43" }}>{actionLabels[item.action]}</strong>
                <span style={sourceBadgeStyle}>{sourceLabels[item.source]}</span>
                {item.actorId ? <span style={{ color: "#627d98", fontSize: 13 }}>操作者：{item.actorId}</span> : null}
              </div>
              <p style={{ color: "#334e68", lineHeight: 1.55, margin: 0 }}>{item.message}</p>
              {item.metadata ? <small style={{ color: "#627d98" }}>{formatMetadata(item.metadata)}</small> : null}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

function formatMetadata(metadata: Record<string, unknown>): string {
  return Object.entries(metadata)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" / ");
}

const timelineItemStyle = {
  alignItems: "start",
  background: "#ffffff",
  border: "1px solid #d9e2ec",
  borderRadius: 8,
  display: "grid",
  gap: 14,
  gridTemplateColumns: "150px minmax(0, 1fr)",
  padding: "14px"
};

const timeStyle = {
  color: "#52606d",
  fontSize: 13,
  fontWeight: 700
};

const sourceBadgeStyle = {
  background: "#eef2f7",
  borderRadius: 999,
  color: "#334e68",
  fontSize: 12,
  fontWeight: 700,
  padding: "3px 8px"
};
