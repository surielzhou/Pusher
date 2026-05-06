import type { ComplianceIssue, ComplianceReport } from "../../services/complianceService.ts";

interface CompliancePanelProps {
  report: ComplianceReport;
}

const statusLabels: Record<ComplianceReport["status"], string> = {
  needs_attention: "需处理",
  not_applicable: "不适用",
  passed: "通过"
};

export default function CompliancePanel({ report }: CompliancePanelProps) {
  const hasIssues = report.issues.length > 0;

  return (
    <section
      aria-labelledby="compliance-panel-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 16, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>金融合规</p>
          <h2 id="compliance-panel-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
            合规检查
          </h2>
        </div>
        <span
          style={{
            background: hasIssues ? "#fffbea" : "#e6fffa",
            borderRadius: 999,
            color: hasIssues ? "#92400e" : "#0f766e",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          {statusLabels[report.status]}
        </span>
      </header>

      {report.status === "not_applicable" ? (
        <p style={{ color: "#52606d", fontSize: 14, lineHeight: 1.6, margin: "18px 0 0" }}>
          非金融内容无需执行金融合规检查。
        </p>
      ) : (
        <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
          <div
            style={{
              background: "#f8fafc",
              border: "1px solid #d9e2ec",
              borderRadius: 8,
              color: "#334e68",
              lineHeight: 1.6,
              padding: 14
            }}
          >
            <strong style={{ color: "#102a43", display: "block", marginBottom: 6 }}>免责声明模板</strong>
            {report.requiredDisclaimer}
          </div>

          {hasIssues ? (
            <div style={{ display: "grid", gap: 10 }}>
              {report.issues.map((issue, index) => (
                <ComplianceIssueItem issue={issue} key={`${issue.code}_${issue.term || index}`} />
              ))}
            </div>
          ) : (
            <div
              role="note"
              style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 8,
                color: "#166534",
                lineHeight: 1.6,
                padding: 14
              }}
            >
              未发现敏感词或风险表达。
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function ComplianceIssueItem({ issue }: { issue: ComplianceIssue }) {
  return (
    <article
      data-compliance-code={issue.code}
      style={{
        border: "1px solid #f7d070",
        borderRadius: 8,
        display: "grid",
        gap: 6,
        padding: 12
      }}
    >
      <strong style={{ color: "#713f12", fontSize: 14 }}>{issueLabel(issue)}</strong>
      <span style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5 }}>{issue.message}</span>
      <span style={{ color: "#334e68", fontSize: 13, lineHeight: 1.5 }}>{issue.recommendation}</span>
    </article>
  );
}

function issueLabel(issue: ComplianceIssue): string {
  switch (issue.code) {
    case "finance_disclaimer_missing":
      return "免责声明缺失";
    case "finance_sensitive_word":
      return "敏感词";
    case "finance_risky_expression":
      return "风险表达";
  }
}
