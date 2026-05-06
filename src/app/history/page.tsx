import ArticleFilters from "../../components/article/ArticleFilters.tsx";
import ArticleList from "../../components/article/ArticleList.tsx";
import type { Article, ArticleDetail } from "../../domain/article.ts";
import type { PublishRecord } from "../../domain/publish.ts";
import type { ReviewRecord } from "../../domain/review.ts";
import { ARTICLE_STATUSES, CONTENT_CATEGORIES, type ArticleStatus, type ContentCategory } from "../../domain/status.ts";

interface HistoryPageProps {
  searchParams?: {
    category?: string;
    status?: string;
    keyword?: string;
  };
}

function buildArticle(input: {
  id: string;
  title: string;
  category: ContentCategory;
  status: ArticleStatus;
  topic: string;
  summary: string;
  updatedAt: string;
}): Article {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    body: "历史文章列表用于展示已生成、审核和发布的文章记录。",
    category: input.category,
    status: input.status,
    generationConfig: {
      category: input.category,
      topic: input.topic,
      audience: "公众号读者",
      requireRiskNote: input.category === "finance"
    },
    riskNote: input.category === "finance" ? "本文不构成投资建议。" : undefined,
    contentVersion: 3,
    reviewedVersion: ["approved", "pending_publish", "published", "publish_failed"].includes(input.status) ? 3 : undefined,
    publishedVersion: input.status === "published" ? 3 : undefined,
    createdAt: new Date("2026-05-06T08:00:00.000Z"),
    updatedAt: new Date(input.updatedAt)
  };
}

function buildLatestReview(article: Article): ReviewRecord | undefined {
  if (!["approved", "review_rejected", "not_publish", "pending_publish", "published", "publish_failed"].includes(article.status)) {
    return undefined;
  }

  const result = article.status === "review_rejected" ? "rejected" : article.status === "not_publish" ? "not_publish" : "approved";

  return {
    id: `${article.id}_review_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    result,
    comment: result === "rejected" ? "标题和风险提示需要调整。" : "review 已完成。",
    reviewedAt: new Date("2026-05-06T10:30:00.000Z")
  };
}

function buildLatestPublish(article: Article): PublishRecord | undefined {
  if (!["pending_publish", "published", "publish_failed"].includes(article.status)) return undefined;

  return {
    id: `${article.id}_publish_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    channel: "wechat_manual",
    status: article.status === "published" ? "published" : article.status === "publish_failed" ? "failed" : "prepared",
    errorMessage: article.status === "publish_failed" ? "公众号后台保存失败" : undefined,
    createdAt: new Date("2026-05-06T11:20:00.000Z")
  };
}

function getHistoryArticles(): ArticleDetail[] {
  return [
    buildArticle({
      id: "history_tech_agent",
      title: "AI Agent 产品化入口观察",
      category: "tech_internet",
      status: "editing",
      topic: "AI Agent 产品化",
      summary: "产品入口、任务流和内容运营协同。",
      updatedAt: "2026-05-06T11:45:00.000Z"
    }),
    buildArticle({
      id: "history_finance_review",
      title: "AI 投研工具风险提示清单",
      category: "finance",
      status: "pending_review",
      topic: "AI 投研工具",
      summary: "等待 review 人确认风险提示和非投资建议表达。",
      updatedAt: "2026-05-06T11:20:00.000Z"
    }),
    buildArticle({
      id: "history_literature_publish",
      title: "春日书房与长句节奏",
      category: "literature",
      status: "published",
      topic: "春日散文",
      summary: "一篇已发布的文学方向图文。",
      updatedAt: "2026-05-06T10:50:00.000Z"
    }),
    buildArticle({
      id: "history_finance_failed",
      title: "宏观市场周记发布复核",
      category: "finance",
      status: "publish_failed",
      topic: "宏观市场周记",
      summary: "发布失败后需要重新检查图片上传和排版。",
      updatedAt: "2026-05-06T10:10:00.000Z"
    })
  ].map((article) => ({
    article,
    images: [],
    latestReview: buildLatestReview(article),
    latestPublish: buildLatestPublish(article)
  }));
}

function normalizeCategory(value: string | undefined): ContentCategory | undefined {
  return CONTENT_CATEGORIES.includes(value as ContentCategory) ? (value as ContentCategory) : undefined;
}

function normalizeStatus(value: string | undefined): ArticleStatus | undefined {
  return ARTICLE_STATUSES.includes(value as ArticleStatus) ? (value as ArticleStatus) : undefined;
}

function filterArticles(
  items: ArticleDetail[],
  filters: { category?: ContentCategory; status?: ArticleStatus; keyword?: string }
): ArticleDetail[] {
  const keyword = filters.keyword?.trim().toLowerCase();

  return items.filter((item) => {
    if (filters.category && item.article.category !== filters.category) return false;
    if (filters.status && item.article.status !== filters.status) return false;
    if (!keyword) return true;

    return [item.article.title, item.article.summary, item.article.generationConfig.topic]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLowerCase().includes(keyword));
  });
}

export default function HistoryPage({ searchParams = {} }: HistoryPageProps) {
  const filters = {
    category: normalizeCategory(searchParams.category),
    status: normalizeStatus(searchParams.status),
    keyword: searchParams.keyword?.trim()
  };
  const items = filterArticles(getHistoryArticles(), filters);

  return (
    <main
      style={{
        background: "#f7f8fa",
        minHeight: "100vh",
        padding: "32px clamp(16px, 4vw, 48px)"
      }}
    >
      <div style={{ display: "grid", gap: 22, margin: "0 auto", maxWidth: 1280 }}>
        <header>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>历史文章</p>
          <h1 style={{ color: "#102a43", fontSize: 30, lineHeight: 1.2, margin: 0 }}>图文记录筛选</h1>
        </header>

        <ArticleFilters category={filters.category} keyword={filters.keyword} status={filters.status} />
        <ArticleList items={items} />
      </div>
    </main>
  );
}
