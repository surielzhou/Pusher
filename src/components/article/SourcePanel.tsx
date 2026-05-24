import type { ArticleSource, SourceCredibility } from "../../domain/source.ts";

interface SourcePanelProps {
  sources: ArticleSource[];
  readOnly: boolean;
}

const credibilityLabels: Record<SourceCredibility, string> = {
  high: "高可信",
  medium: "中可信",
  low: "低可信"
};

export default function SourcePanel({ sources, readOnly }: SourcePanelProps) {
  return (
    <section
      aria-labelledby="article-sources-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 16, justifyContent: "space-between" }}>
        <div>
          <h2 id="article-sources-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
            参考来源
          </h2>
          <p style={{ color: "#627d98", fontSize: 13, margin: "6px 0 0" }}>{sources.length} 条来源记录</p>
        </div>
        <span
          style={{
            background: readOnly ? "#f0f4f8" : "#e6fffa",
            borderRadius: 999,
            color: readOnly ? "#52606d" : "#0f766e",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px"
          }}
        >
          {readOnly ? "只读" : "可编辑"}
        </span>
      </header>

      <form
        aria-label="新增参考来源"
        style={{
          borderTop: "1px solid #e5eaf0",
          display: "grid",
          gap: 12,
          marginTop: 18,
          paddingTop: 18
        }}
      >
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          来源标题
          <input
            disabled={readOnly}
            name="title"
            placeholder="例如：官方产品更新、行业报告、监管公告"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
            type="text"
          />
        </label>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          URL
          <input
            disabled={readOnly}
            name="url"
            placeholder="https://example.com/reference"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
            type="url"
          />
        </label>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          发布方
          <input
            disabled={readOnly}
            name="provider"
            placeholder="官方机构、媒体、研究机构"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
            type="text"
          />
        </label>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          引用摘要
          <textarea
            disabled={readOnly}
            name="citationSummary"
            placeholder="记录可引用的事实点、数据口径或观点边界"
            rows={3}
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10, resize: "vertical" }}
          />
        </label>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          可信度
          <select
            disabled={readOnly}
            name="credibility"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
          >
            <option value="high">高可信</option>
            <option value="medium">中可信</option>
            <option value="low">低可信</option>
          </select>
        </label>
        <button
          disabled={readOnly}
          style={{
            background: readOnly ? "#d9e2ec" : "#0f766e",
            border: 0,
            borderRadius: 6,
            color: "#ffffff",
            font: "inherit",
            fontWeight: 700,
            justifySelf: "start",
            padding: "10px 14px"
          }}
          type="submit"
        >
          保存来源
        </button>
      </form>

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {sources.map((source) => (
          <article
            key={source.id}
            style={{
              border: "1px solid #e5eaf0",
              borderRadius: 8,
              display: "grid",
              gap: 12,
              padding: 14
            }}
          >
            <div style={{ alignItems: "start", display: "flex", gap: 12, justifyContent: "space-between" }}>
              <div>
                <strong style={{ color: "#102a43", display: "block", fontSize: 14 }}>{source.title}</strong>
                <p style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>
                  {source.citationSummary}
                </p>
                {source.url ? (
                  <a href={source.url} style={{ color: "#0f766e", fontSize: 13 }}>
                    {source.provider || source.url}
                  </a>
                ) : null}
              </div>
              <span style={{ color: "#0f766e", fontSize: 12, fontWeight: 700 }}>
                {credibilityLabels[source.credibility]}
              </span>
            </div>

            <label style={{ alignItems: "center", color: "#243b53", display: "flex", fontSize: 13, gap: 8 }}>
              <input
                defaultChecked={source.usageStatus === "used"}
                disabled={readOnly}
                name="usedInBody"
                type="checkbox"
              />
              {source.usageStatus === "used" ? "已用于正文" : "未用于正文"}
            </label>
          </article>
        ))}
      </div>
    </section>
  );
}
