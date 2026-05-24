import type {
  ArticleVersionDiff,
  ArticleVersionFieldDiff,
  ArticleVersionImageSnapshot,
  ArticleVersionImageUpdate,
  VersionedArticleTextField
} from "../../domain/version.ts";

interface VersionDiffProps {
  diff: ArticleVersionDiff;
}

const fieldLabels: Record<VersionedArticleTextField, string> = {
  title: "标题",
  summary: "摘要",
  body: "正文"
};

function renderValue(value: string | undefined): string {
  return value?.trim() ? value : "未填写";
}

function FieldDiffRow({ item }: { item: ArticleVersionFieldDiff }) {
  return (
    <article style={{ border: "1px solid #e5eaf0", borderRadius: 8, padding: 14 }}>
      <header style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: 12 }}>
        <h3 style={{ color: "#102a43", fontSize: 16, margin: 0 }}>{fieldLabels[item.field]}</h3>
        <span
          style={{
            background: item.changed ? "#fffbea" : "#f0f4f8",
            borderRadius: 999,
            color: item.changed ? "#92400e" : "#52606d",
            fontSize: 12,
            fontWeight: 700,
            padding: "4px 8px",
            whiteSpace: "nowrap"
          }}
        >
          {item.changed ? "已变更" : "无变化"}
        </span>
      </header>

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", marginTop: 12 }}>
        <div>
          <strong style={{ color: "#627d98", display: "block", fontSize: 12, marginBottom: 6 }}>review 前</strong>
          <p style={{ color: "#243b53", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{renderValue(item.before)}</p>
        </div>
        <div>
          <strong style={{ color: "#627d98", display: "block", fontSize: 12, marginBottom: 6 }}>review 后</strong>
          <p style={{ color: "#243b53", lineHeight: 1.7, margin: 0, whiteSpace: "pre-wrap" }}>{renderValue(item.after)}</p>
        </div>
      </div>
    </article>
  );
}

function ImageSummary({ image }: { image: ArticleVersionImageSnapshot }) {
  return (
    <article style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}>
      <strong style={{ color: "#102a43", display: "block", fontSize: 14 }}>{image.description}</strong>
      <p style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>
        {image.type} / {image.position || "位置未标记"} / {image.url || "暂无 URL"}
      </p>
    </article>
  );
}

function ImageUpdateSummary({ change }: { change: ArticleVersionImageUpdate }) {
  return (
    <article style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}>
      <strong style={{ color: "#102a43", display: "block", fontSize: 14 }}>{change.after.description}</strong>
      <p style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>
        更新字段：{change.changedFields.join("、")}
      </p>
      <p style={{ color: "#627d98", fontSize: 12, lineHeight: 1.5, margin: "8px 0 0" }}>
        {change.before.type} → {change.after.type}
        {change.after.url ? ` / ${change.after.url}` : ""}
      </p>
    </article>
  );
}

export default function VersionDiff({ diff }: VersionDiffProps) {
  const fieldDiffs = [diff.fields.title, diff.fields.summary, diff.fields.body];

  return (
    <section
      aria-labelledby="version-diff-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 18, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>版本差异</p>
          <h2 id="version-diff-heading" style={{ color: "#102a43", fontSize: 22, lineHeight: 1.25, margin: 0 }}>
            review 前后对比
          </h2>
        </div>
        <span
          style={{
            background: diff.hasChanges ? "#fffbea" : "#f0fdf4",
            borderRadius: 999,
            color: diff.hasChanges ? "#92400e" : "#166534",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          v{diff.from.contentVersion} → v{diff.to.contentVersion}
        </span>
      </header>

      <div style={{ display: "grid", gap: 12, marginTop: 18 }}>
        {fieldDiffs.map((item) => (
          <FieldDiffRow item={item} key={item.field} />
        ))}
      </div>

      <section aria-labelledby="version-image-diff-heading" style={{ display: "grid", gap: 12, marginTop: 18 }}>
        <h3 id="version-image-diff-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
          图片变更
        </h3>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          <div>
            <strong style={{ color: "#166534", display: "block", fontSize: 13, marginBottom: 8 }}>新增图片</strong>
            <div style={{ display: "grid", gap: 8 }}>
              {diff.images.added.length > 0 ? (
                diff.images.added.map((image) => <ImageSummary image={image} key={image.id} />)
              ) : (
                <p style={{ color: "#627d98", fontSize: 13, margin: 0 }}>无新增</p>
              )}
            </div>
          </div>

          <div>
            <strong style={{ color: "#9b1c1c", display: "block", fontSize: 13, marginBottom: 8 }}>删除图片</strong>
            <div style={{ display: "grid", gap: 8 }}>
              {diff.images.removed.length > 0 ? (
                diff.images.removed.map((image) => <ImageSummary image={image} key={image.id} />)
              ) : (
                <p style={{ color: "#627d98", fontSize: 13, margin: 0 }}>无删除</p>
              )}
            </div>
          </div>

          <div>
            <strong style={{ color: "#92400e", display: "block", fontSize: 13, marginBottom: 8 }}>更新图片</strong>
            <div style={{ display: "grid", gap: 8 }}>
              {diff.images.updated.length > 0 ? (
                diff.images.updated.map((change) => <ImageUpdateSummary change={change} key={change.id} />)
              ) : (
                <p style={{ color: "#627d98", fontSize: 13, margin: 0 }}>无更新</p>
              )}
            </div>
          </div>
        </div>
      </section>
    </section>
  );
}
