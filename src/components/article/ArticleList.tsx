import type { ArticleDetail } from "../../domain/article.ts";
import type { ArticleStatus, ContentCategory } from "../../domain/status.ts";

interface ArticleListProps {
  items: ArticleDetail[];
}

const categoryLabels: Record<ContentCategory, string> = {
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

const reviewResultLabels = {
  approved: "通过",
  not_publish: "暂不发布",
  rejected: "退回"
};

const publishStatusLabels = {
  failed: "失败",
  prepared: "已准备",
  published: "已发布"
};

export default function ArticleList({ items }: ArticleListProps) {
  return (
    <section aria-labelledby="article-list-heading" style={{ display: "grid", gap: 14 }}>
      <h2 id="article-list-heading" style={{ color: "#102a43", fontSize: 20, margin: 0 }}>
        文章列表
      </h2>
      <div style={{ border: "1px solid #d9e2ec", borderRadius: 8, overflow: "hidden" }}>
        <div aria-hidden="true" style={headerRowStyle}>
          <span>标题</span>
          <span>内容方向</span>
          <span>状态</span>
          <span>更新时间</span>
          <span>最近 review</span>
          <span>发布状态</span>
          <span>操作</span>
        </div>

        {items.map((item) => (
          <article key={item.article.id} style={rowStyle}>
            <a href={`/articles/${item.article.id}`} style={titleLinkStyle}>
              {item.article.title || item.article.generationConfig.topic}
            </a>
            <span>{categoryLabels[item.article.category]}</span>
            <span>{statusLabels[item.article.status]}</span>
            <time dateTime={item.article.updatedAt.toISOString()}>{formatDateTime(item.article.updatedAt)}</time>
            <span>{item.latestReview ? reviewResultLabels[item.latestReview.result] : "无"}</span>
            <span>{item.latestPublish ? publishStatusLabels[item.latestPublish.status] : "未准备"}</span>
            <nav aria-label={`${item.article.title} 操作`} style={actionNavStyle}>
              <a href={`/articles/${item.article.id}`} style={secondaryLinkStyle}>
                详情
              </a>
              <a href={`/articles/${item.article.id}/edit`} style={secondaryLinkStyle}>
                编辑
              </a>
              <a href={`/articles/${item.article.id}/review`} style={secondaryLinkStyle}>
                review
              </a>
              <a href={`/articles/${item.article.id}/publish`} style={primaryLinkStyle}>
                发布准备
              </a>
            </nav>
          </article>
        ))}
      </div>
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

const headerRowStyle = {
  background: "#f0f4f8",
  color: "#52606d",
  display: "grid",
  fontSize: 13,
  fontWeight: 700,
  gap: 12,
  gridTemplateColumns: "minmax(200px, 1.5fr) 100px 110px 140px 110px 110px minmax(260px, 1fr)",
  padding: "12px 14px"
};

const rowStyle = {
  alignItems: "center",
  background: "#ffffff",
  borderTop: "1px solid #e5eaf0",
  color: "#334e68",
  display: "grid",
  gap: 12,
  gridTemplateColumns: "minmax(200px, 1.5fr) 100px 110px 140px 110px 110px minmax(260px, 1fr)",
  lineHeight: 1.5,
  padding: "14px"
};

const actionNavStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8
};

const titleLinkStyle = {
  color: "#102a43",
  fontWeight: 700,
  textDecoration: "none"
};

const secondaryLinkStyle = {
  border: "1px solid #bcccdc",
  borderRadius: 6,
  color: "#243b53",
  fontSize: 13,
  fontWeight: 700,
  padding: "6px 8px",
  textDecoration: "none"
};

const primaryLinkStyle = {
  background: "#0f766e",
  borderRadius: 6,
  color: "#ffffff",
  fontSize: 13,
  fontWeight: 700,
  padding: "7px 9px",
  textDecoration: "none"
};
