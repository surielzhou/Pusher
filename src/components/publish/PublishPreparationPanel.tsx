import type { Article } from "../../domain/article.ts";
import type { ArticleImage } from "../../domain/image.ts";
import type { PublishRecord } from "../../domain/publish.ts";

interface PublishPreparationPanelProps {
  article: Article;
  images: ArticleImage[];
  canPublish: boolean;
  latestPublish?: PublishRecord;
}

const buttonBaseStyle = {
  border: 0,
  borderRadius: 6,
  color: "#ffffff",
  font: "inherit",
  fontWeight: 700,
  justifySelf: "start",
  minHeight: 40,
  padding: "10px 14px"
};

function getButtonStyle(disabled: boolean, background: string) {
  return {
    ...buttonBaseStyle,
    background: disabled ? "#d9e2ec" : background,
    color: disabled ? "#52606d" : "#ffffff"
  };
}

function getBodyParagraphs(article: Article): string[] {
  return article.body
    ? article.body
        .split("\n")
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [];
}

function buildImageChecklist(images: ArticleImage[]): string {
  if (images.length === 0) {
    return "图片清单：暂无图片或配图建议。";
  }

  return images
    .map((image, index) => {
      const source = image.url ? `图片 URL：${image.url}` : `配图说明：${image.description}`;
      const altText = image.altText ? `替代文本：${image.altText}` : "替代文本：待补充";

      return `${index + 1}. 插入位置：${image.position || "待确认"}\n${source}\n${altText}`;
    })
    .join("\n\n");
}

function buildExportContent(article: Article, images: ArticleImage[]): string {
  return [
    `标题：${article.title || "未命名图文"}`,
    `摘要：${article.summary || "待补充摘要"}`,
    "",
    article.body || "待补充正文",
    "",
    "图片清单：",
    buildImageChecklist(images)
  ].join("\n");
}

function getBlockedReason(article: Article): string {
  if (article.reviewedVersion !== article.contentVersion) {
    return "内容版本已变化，需要重新 review 后才能进入发布准备。";
  }

  if (article.status === "not_publish") {
    return "文章已被标记为暂不发布，不能进入发布准备。";
  }

  if (article.status === "pending_review" || article.status === "review_rejected") {
    return "文章未通过 review，不能进入发布准备。";
  }

  return "当前状态不能进入发布准备，仅 approved 或 pending_publish 状态可继续。";
}

export default function PublishPreparationPanel({
  article,
  images,
  canPublish,
  latestPublish
}: PublishPreparationPanelProps) {
  const publishBlocked = !canPublish;
  const paragraphs = getBodyParagraphs(article);
  const exportContent = buildExportContent(article, images);
  const imageChecklist = buildImageChecklist(images);

  return (
    <section
      aria-labelledby="publish-preparation-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 18, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>
            发布准备
          </p>
          <h1 id="publish-preparation-heading" style={{ color: "#102a43", fontSize: 26, lineHeight: 1.25, margin: 0 }}>
            公众号可复制内容
          </h1>
        </div>
        <span
          style={{
            background: publishBlocked ? "#fff5f5" : "#e6fffa",
            borderRadius: 999,
            color: publishBlocked ? "#9b1c1c" : "#0f766e",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          {article.status}
        </span>
      </header>

      {publishBlocked ? (
        <div
          role="alert"
          style={{
            background: "#fff5f5",
            border: "1px solid #ffd6d6",
            borderRadius: 8,
            color: "#9b1c1c",
            lineHeight: 1.6,
            marginTop: 18,
            padding: 14
          }}
        >
          发布准备阻断：{getBlockedReason(article)}
        </div>
      ) : (
        <div
          role="status"
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            color: "#166534",
            lineHeight: 1.6,
            marginTop: 18,
            padding: 14
          }}
        >
          Review 已通过，当前内容可进入公众号人工发布准备。
        </div>
      )}

      {latestPublish ? (
        <div
          role="note"
          style={{
            background: "#f8fafc",
            border: "1px solid #d9e2ec",
            borderRadius: 8,
            color: "#334e68",
            lineHeight: 1.6,
            marginTop: 14,
            padding: 14
          }}
        >
          最近发布记录：{latestPublish.channel} / {latestPublish.status}
          {latestPublish.errorMessage ? `，失败原因：${latestPublish.errorMessage}` : ""}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 18, marginTop: 20 }}>
        <section
          aria-labelledby="final-content-heading"
          style={{ border: "1px solid #e5eaf0", borderRadius: 8, padding: 16 }}
        >
          <h2 id="final-content-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
            最终内容
          </h2>
          <dl style={{ display: "grid", gap: 12, margin: "14px 0 0" }}>
            <div>
              <dt style={{ color: "#627d98", fontSize: 12, fontWeight: 700 }}>最终标题</dt>
              <dd style={{ color: "#243b53", lineHeight: 1.6, margin: "4px 0 0" }}>{article.title || "未命名图文"}</dd>
            </div>
            <div>
              <dt style={{ color: "#627d98", fontSize: 12, fontWeight: 700 }}>摘要</dt>
              <dd style={{ color: "#243b53", lineHeight: 1.6, margin: "4px 0 0" }}>{article.summary || "待补充摘要"}</dd>
            </div>
            <div>
              <dt style={{ color: "#627d98", fontSize: 12, fontWeight: 700 }}>正文预览</dt>
              <dd style={{ color: "#243b53", lineHeight: 1.75, margin: "4px 0 0" }}>
                {paragraphs.map((paragraph) => (
                  <p key={paragraph} style={{ margin: "0 0 10px" }}>
                    {paragraph}
                  </p>
                ))}
              </dd>
            </div>
          </dl>
        </section>

        <section
          aria-labelledby="image-checklist-heading"
          style={{ border: "1px solid #e5eaf0", borderRadius: 8, padding: 16 }}
        >
          <h2 id="image-checklist-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
            图片清单
          </h2>
          <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
            {images.map((image) => (
              <article key={image.id} style={{ background: "#f8fafc", borderRadius: 8, padding: 14 }}>
                <strong style={{ color: "#102a43", display: "block", fontSize: 14 }}>
                  插入位置：{image.position || "待确认"}
                </strong>
                <p style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>{image.description}</p>
                <p style={{ color: "#627d98", fontSize: 12, margin: "8px 0 0" }}>
                  {image.url ? `图片 URL：${image.url}` : "当前为配图建议"} / {image.altText || "替代文本待补充"}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="copy-fields-heading" style={{ display: "grid", gap: 12 }}>
          <h2 id="copy-fields-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
            复制字段
          </h2>
          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            标题
            <textarea
              defaultValue={article.title || "未命名图文"}
              name="title"
              readOnly
              rows={2}
              style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
            />
          </label>
          <button
            data-copy-target="title"
            disabled={publishBlocked}
            style={getButtonStyle(publishBlocked, "#334e68")}
            type="button"
          >
            复制标题
          </button>

          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            摘要
            <textarea
              defaultValue={article.summary || "待补充摘要"}
              name="summary"
              readOnly
              rows={3}
              style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
            />
          </label>
          <button
            data-copy-target="summary"
            disabled={publishBlocked}
            style={getButtonStyle(publishBlocked, "#334e68")}
            type="button"
          >
            复制摘要
          </button>

          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            正文
            <textarea
              defaultValue={article.body || "待补充正文"}
              name="body"
              readOnly
              rows={10}
              style={{
                border: "1px solid #bcccdc",
                borderRadius: 6,
                font: "inherit",
                lineHeight: 1.7,
                padding: 11,
                resize: "vertical"
              }}
            />
          </label>
          <button
            data-copy-target="body"
            disabled={publishBlocked}
            style={getButtonStyle(publishBlocked, "#334e68")}
            type="button"
          >
            复制正文
          </button>

          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            完整公众号可复制内容
            <textarea
              defaultValue={exportContent}
              name="exportContent"
              readOnly
              rows={14}
              style={{
                border: "1px solid #bcccdc",
                borderRadius: 6,
                font: "inherit",
                lineHeight: 1.7,
                padding: 11,
                resize: "vertical"
              }}
            />
          </label>
          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            图片清单可复制文本
            <textarea
              aria-label="imageChecklist"
              defaultValue={imageChecklist}
              name="imageChecklist"
              readOnly
              rows={5}
              style={{
                border: "1px solid #bcccdc",
                borderRadius: 6,
                font: "inherit",
                lineHeight: 1.7,
                padding: 11,
                resize: "vertical"
              }}
            />
          </label>
        </section>

        <section aria-labelledby="publish-result-heading" style={{ display: "grid", gap: 14 }}>
          <h2 id="publish-result-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
            发布结果
          </h2>
          <form action={`/articles/${article.id}/publish`} data-action="markPublished" style={{ display: "grid", gap: 10 }}>
            <input name="channel" type="hidden" value="wechat_manual" />
            <input name="result" type="hidden" value="published" />
            <input name="articleVersion" type="hidden" value={String(article.contentVersion)} />
            <button disabled={publishBlocked} style={getButtonStyle(publishBlocked, "#0f766e")} type="submit">
              标记已发布
            </button>
          </form>

          <form
            action={`/articles/${article.id}/publish`}
            data-action="markPublishFailed"
            style={{ borderTop: "1px solid #e5eaf0", display: "grid", gap: 10, paddingTop: 14 }}
          >
            <input name="channel" type="hidden" value="wechat_manual" />
            <input name="result" type="hidden" value="failed" />
            <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
              发布失败原因
              <textarea
                disabled={publishBlocked}
                name="errorMessage"
                placeholder="记录公众号人工发布失败的原因"
                required
                rows={3}
                style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
              />
            </label>
            <button disabled={publishBlocked} style={getButtonStyle(publishBlocked, "#9b1c1c")} type="submit">
              标记发布失败
            </button>
          </form>
        </section>
      </div>
    </section>
  );
}
