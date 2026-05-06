import type { ArticleDetail } from "../../domain/article.ts";
import type { ArticleStatus } from "../../domain/status.ts";

interface RecentArticlesProps {
  articles: ArticleDetail[];
}

const categoryLabels = {
  finance: "金融",
  literature: "文学",
  tech_internet: "科技互联网"
};

const statusLabels: Record<ArticleStatus, string> = {
  approved: "已通过",
  drafting: "草稿中",
  editing: "待编辑",
  generation_failed: "生成失败",
  not_publish: "暂不发布",
  pending_publish: "待发布",
  pending_review: "待Review",
  publish_failed: "发布失败",
  published: "已发布",
  review_rejected: "退回修改"
};

export default function RecentArticles({ articles }: RecentArticlesProps) {
  return (
    <section aria-labelledby="recent-articles-heading" style={{ display: "grid", gap: 14 }}>
      <div style={{ alignItems: "center", display: "flex", gap: 12, justifyContent: "space-between" }}>
        <h2 id="recent-articles-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
          最近文章
        </h2>
        <a href="/history" style={secondaryLinkStyle}>
          查看历史
        </a>
      </div>

      <div style={{ border: "1px solid #d9e2ec", borderRadius: 8, overflow: "hidden" }}>
        <div
          aria-hidden="true"
          style={{
            background: "#f0f4f8",
            color: "#52606d",
            display: "grid",
            fontSize: 13,
            fontWeight: 700,
            gap: 12,
            gridTemplateColumns: "minmax(220px, 1.6fr) 110px 120px 160px minmax(120px, 0.8fr)",
            padding: "12px 14px"
          }}
        >
          <span>标题</span>
          <span>内容方向</span>
          <span>状态</span>
          <span>更新时间</span>
          <span>操作</span>
        </div>

        {articles.map((item) => (
          <article key={item.article.id} style={rowStyle}>
            <div style={{ display: "grid", gap: 4 }}>
              <a href={`/articles/${item.article.id}/edit`} style={titleLinkStyle}>
                {item.article.title || item.article.generationConfig.topic}
              </a>
              <small style={{ color: "#627d98" }}>{item.article.summary || item.article.generationConfig.topic}</small>
            </div>
            <span>{categoryLabels[item.article.category]}</span>
            <span>{statusLabels[item.article.status]}</span>
            <time dateTime={item.article.updatedAt.toISOString()}>{formatDateTime(item.article.updatedAt)}</time>
            <a href={resolveNextActionHref(item.article.id, item.article.status)} style={primaryLinkStyle}>
              {resolveNextActionLabel(item.article.status)}
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function resolveNextActionHref(articleId: string, status: ArticleStatus): string {
  if (status === "pending_review") return `/articles/${articleId}/review`;
  if (status === "approved" || status === "pending_publish" || status === "publish_failed") {
    return `/articles/${articleId}/publish`;
  }

  return `/articles/${articleId}/edit`;
}

function resolveNextActionLabel(status: ArticleStatus): string {
  if (status === "pending_review") return "去 review";
  if (status === "approved" || status === "pending_publish" || status === "publish_failed") return "去发布准备";
  return "继续编辑";
}

function formatDateTime(value: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(value);
}

const rowStyle = {
  alignItems: "center",
  background: "#ffffff",
  borderTop: "1px solid #e5eaf0",
  color: "#334e68",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(220px, 1.6fr) 110px 120px 160px minmax(120px, 0.8fr)",
  lineHeight: 1.5,
  padding: "14px"
};

const titleLinkStyle = {
  color: "#102a43",
  fontWeight: 700,
  textDecoration: "none"
};

const primaryLinkStyle = {
  background: "#0f766e",
  borderRadius: 6,
  color: "#ffffff",
  fontWeight: 700,
  justifySelf: "start",
  padding: "8px 10px",
  textDecoration: "none"
};

const secondaryLinkStyle = {
  border: "1px solid #bcccdc",
  borderRadius: 6,
  color: "#243b53",
  fontWeight: 700,
  padding: "8px 10px",
  textDecoration: "none"
};
