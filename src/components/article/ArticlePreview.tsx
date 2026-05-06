import type { Article } from "../../domain/article.ts";
import type { ArticleImage } from "../../domain/image.ts";

interface ArticlePreviewProps {
  article: Article;
  images: ArticleImage[];
}

export default function ArticlePreview({ article, images }: ArticlePreviewProps) {
  const paragraphs = article.body
    ? article.body
        .split("\n")
        .map((paragraph) => paragraph.trim())
        .filter(Boolean)
    : [];

  return (
    <aside
      aria-label="公众号预览"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        boxShadow: "0 12px 28px rgb(15 23 42 / 0.08)",
        minWidth: 280,
        overflow: "hidden"
      }}
    >
      <header
        style={{
          borderBottom: "1px solid #e5eaf0",
          padding: "18px 20px"
        }}
      >
        <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 8px" }}>公众号预览</p>
        <h2 style={{ color: "#102a43", fontSize: 24, lineHeight: 1.25, margin: 0 }}>
          {article.title || "未命名图文"}
        </h2>
        {article.summary ? (
          <p style={{ color: "#52606d", fontSize: 14, lineHeight: 1.6, margin: "12px 0 0" }}>{article.summary}</p>
        ) : null}
      </header>

      <div style={{ padding: "18px 20px 22px" }}>
        {images.map((image) => (
          <figure key={image.id} style={{ margin: "0 0 18px" }}>
            {image.url ? (
              <img
                alt={image.altText || image.description}
                src={image.url}
                style={{ aspectRatio: "16 / 9", borderRadius: 6, display: "block", objectFit: "cover", width: "100%" }}
              />
            ) : (
              <div
                style={{
                  alignItems: "center",
                  aspectRatio: "16 / 9",
                  background: "#f0f4f8",
                  border: "1px dashed #9fb3c8",
                  borderRadius: 6,
                  color: "#334e68",
                  display: "flex",
                  justifyContent: "center",
                  padding: 16,
                  textAlign: "center"
                }}
              >
                {image.description}
              </div>
            )}
            <figcaption style={{ color: "#627d98", fontSize: 12, marginTop: 8 }}>{image.position || image.type}</figcaption>
          </figure>
        ))}

        {paragraphs.map((paragraph) => (
          <p key={paragraph} style={{ color: "#243b53", fontSize: 16, lineHeight: 1.8, margin: "0 0 16px" }}>
            {paragraph}
          </p>
        ))}
      </div>
    </aside>
  );
}
