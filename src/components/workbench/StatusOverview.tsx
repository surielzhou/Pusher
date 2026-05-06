import type { ArticleDetail } from "../../domain/article.ts";
import type { ArticleStatus } from "../../domain/status.ts";

interface StatusOverviewProps {
  items: ArticleDetail[];
}

const metricDefinitions: Array<{
  label: string;
  statuses: ArticleStatus[];
  tone: "edit" | "review" | "publish" | "failed";
}> = [
  { label: "待编辑", statuses: ["editing", "review_rejected"], tone: "edit" },
  { label: "待Review", statuses: ["pending_review"], tone: "review" },
  { label: "待发布", statuses: ["approved", "pending_publish"], tone: "publish" },
  { label: "发布失败", statuses: ["publish_failed"], tone: "failed" }
];

const toneStyles = {
  edit: { background: "#eef2ff", color: "#3730a3" },
  review: { background: "#fff7ed", color: "#9a3412" },
  publish: { background: "#ecfdf5", color: "#047857" },
  failed: { background: "#fef2f2", color: "#b91c1c" }
};

export default function StatusOverview({ items }: StatusOverviewProps) {
  return (
    <section aria-labelledby="status-overview-heading" style={{ display: "grid", gap: 14 }}>
      <h2 id="status-overview-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
        状态总览
      </h2>
      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))"
        }}
      >
        {metricDefinitions.map((metric) => {
          const count = items.filter((item) => metric.statuses.includes(item.article.status)).length;

          return (
            <article
              key={metric.label}
              style={{
                ...toneStyles[metric.tone],
                borderRadius: 8,
                display: "grid",
                gap: 8,
                minHeight: 104,
                padding: 16
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 700 }}>{metric.label}</span>
              <strong style={{ fontSize: 32, lineHeight: 1 }}>{count}</strong>
              <small>{metric.statuses.join(" / ")}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}
