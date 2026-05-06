import type { ArticleImage } from "../../domain/image.ts";

interface ImagePanelProps {
  images: ArticleImage[];
  readOnly: boolean;
}

export default function ImagePanel({ images, readOnly }: ImagePanelProps) {
  return (
    <section
      aria-labelledby="article-images-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 16, justifyContent: "space-between" }}>
        <div>
          <h2 id="article-images-heading" style={{ color: "#102a43", fontSize: 18, margin: 0 }}>
            图片与配图建议
          </h2>
          <p style={{ color: "#627d98", fontSize: 13, margin: "6px 0 0" }}>{images.length} 条图片记录</p>
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
        aria-label="新增配图建议"
        style={{
          borderTop: "1px solid #e5eaf0",
          display: "grid",
          gap: 12,
          marginTop: 18,
          paddingTop: 18
        }}
      >
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          配图建议
          <textarea
            disabled={readOnly}
            name="description"
            placeholder="例如：展示三步发布准备流程的信息图"
            rows={3}
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10, resize: "vertical" }}
          />
        </label>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          位置
          <input
            disabled={readOnly}
            name="position"
            placeholder="正文开头、第二段后、封面"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
            type="text"
          />
        </label>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          替代文本
          <input
            disabled={readOnly}
            name="altText"
            placeholder="图片可访问性描述"
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
            type="text"
          />
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
          保存配图建议
        </button>
      </form>

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        {images.map((image) => (
          <article
            key={image.id}
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
                <strong style={{ color: "#102a43", display: "block", fontSize: 14 }}>
                  {image.position || "未指定位置"}
                </strong>
                <p style={{ color: "#52606d", fontSize: 13, lineHeight: 1.5, margin: "6px 0 0" }}>{image.description}</p>
              </div>
              <span style={{ color: "#0f766e", fontSize: 12, fontWeight: 700 }}>{image.type}</span>
            </div>

            <form aria-label={`替换图片 ${image.id}`} style={{ display: "grid", gap: 10 }}>
              <input name="type" type="hidden" value="uploaded" />
              <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
                图片 URL
                <input
                  disabled={readOnly}
                  name="url"
                  placeholder="https://example.com/image.jpg"
                  style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
                  type="url"
                />
              </label>
              <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
                来源
                <input
                  disabled={readOnly}
                  name="source"
                  placeholder="本地上传、素材库、外部链接"
                  style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 10 }}
                  type="text"
                />
              </label>
              <button
                disabled={readOnly}
                style={{
                  background: readOnly ? "#d9e2ec" : "#334e68",
                  border: 0,
                  borderRadius: 6,
                  color: "#ffffff",
                  font: "inherit",
                  fontWeight: 700,
                  justifySelf: "start",
                  padding: "9px 12px"
                }}
                type="submit"
              >
                替换图片
              </button>
            </form>
          </article>
        ))}
      </div>
    </section>
  );
}
