import type { Article } from "../../domain/article.ts";
import type { ArticleImage } from "../../domain/image.ts";

interface ReviewChecklistProps {
  article: Article;
  images: ArticleImage[];
  riskNote?: string;
  checklist: {
    hasTitle: boolean;
    hasBody: boolean;
    hasImageOrSuggestion: boolean;
    categoryMatched: boolean;
  };
}

const categoryLabels: Record<Article["category"], string> = {
  finance: "金融",
  literature: "文学",
  tech_internet: "科技互联网"
};

export default function ReviewChecklist({ article, images, riskNote, checklist }: ReviewChecklistProps) {
  const generationConfig = article.generationConfig;

  return (
    <section
      aria-labelledby="review-checklist-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 16, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>发布前 review</p>
          <h2 id="review-checklist-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
            审核检查清单
          </h2>
        </div>
        <span
          style={{
            background: "#e6fffa",
            borderRadius: 999,
            color: "#0f766e",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          只读
        </span>
      </header>

      <div style={{ display: "grid", gap: 14, marginTop: 18 }}>
        <ChecklistItem label="标题完整" passed={checklist.hasTitle} />
        <ChecklistItem label="正文完整" passed={checklist.hasBody} />
        <ChecklistItem label="图片或配图建议完整" passed={checklist.hasImageOrSuggestion} />
        <ChecklistItem label="内容方向与生成配置一致" passed={checklist.categoryMatched} />
      </div>

      <div
        style={{
          borderTop: "1px solid #e5eaf0",
          display: "grid",
          gap: 12,
          marginTop: 18,
          paddingTop: 18
        }}
      >
        <InfoRow label="内容方向" value={categoryLabels[article.category]} />
        <InfoRow label="选题" value={generationConfig.topic} />
        <InfoRow label="目标读者" value={generationConfig.audience || "未指定"} />
        <InfoRow label="生成风格" value={generationConfig.style || "未指定"} />
        <InfoRow label="篇幅" value={generationConfig.length || "未指定"} />
        <InfoRow label="生成配置" value={generationConfig.requireRiskNote ? "需要金融风险提示" : "无需金融风险提示"} />
      </div>

      {generationConfig.requireRiskNote ? (
        <div
          role="note"
          style={{
            background: riskNote ? "#f0fdf4" : "#fffbea",
            border: `1px solid ${riskNote ? "#bbf7d0" : "#f7d070"}`,
            borderRadius: 8,
            color: riskNote ? "#166534" : "#713f12",
            lineHeight: 1.6,
            marginTop: 18,
            padding: 14
          }}
        >
          <strong style={{ display: "block", marginBottom: 6 }}>金融风险提示</strong>
          {riskNote || "缺少风险提示，审核通过前需要确认是否补充。"}
        </div>
      ) : null}

      <div style={{ borderTop: "1px solid #e5eaf0", marginTop: 18, paddingTop: 18 }}>
        <h3 style={{ color: "#102a43", fontSize: 16, margin: "0 0 12px" }}>图片清单</h3>
        <div style={{ display: "grid", gap: 12 }}>
          {images.map((image) => (
            <article
              key={image.id}
              style={{
                border: "1px solid #e5eaf0",
                borderRadius: 8,
                display: "grid",
                gap: 8,
                padding: 12
              }}
            >
              <div style={{ alignItems: "start", display: "flex", gap: 12, justifyContent: "space-between" }}>
                <strong style={{ color: "#102a43", fontSize: 14 }}>{image.position || "未指定位置"}</strong>
                <span style={{ color: "#0f766e", fontSize: 12, fontWeight: 700 }}>{image.type}</span>
              </div>
              <p style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5, margin: 0 }}>{image.description}</p>
              {image.url ? (
                <a href={image.url} style={{ color: "#0f766e", fontSize: 13 }}>
                  查看图片来源
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function ChecklistItem({ label, passed }: { label: string; passed: boolean }) {
  return (
    <div
      style={{
        alignItems: "center",
        border: "1px solid #e5eaf0",
        borderRadius: 8,
        display: "flex",
        gap: 10,
        justifyContent: "space-between",
        padding: "10px 12px"
      }}
    >
      <span style={{ color: "#243b53", fontSize: 14, fontWeight: 700 }}>{label}</span>
      <span style={{ color: passed ? "#0f766e" : "#9b1c1c", fontSize: 13, fontWeight: 700 }}>
        {passed ? "通过" : "需处理"}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ color: "#627d98", fontSize: 12, fontWeight: 700 }}>{label}</span>
      <span style={{ color: "#243b53", fontSize: 14, lineHeight: 1.5 }}>{value}</span>
    </div>
  );
}
