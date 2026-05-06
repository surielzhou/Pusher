import RecentArticles from "../../components/workbench/RecentArticles.tsx";
import StatusOverview from "../../components/workbench/StatusOverview.tsx";
import type { Article, ArticleDetail } from "../../domain/article.ts";
import type { PublishRecord } from "../../domain/publish.ts";
import type { ReviewRecord } from "../../domain/review.ts";

function buildArticle(input: {
  id: string;
  title: string;
  category: Article["category"];
  status: Article["status"];
  topic: string;
  summary: string;
  updatedAt: string;
}): Article {
  return {
    id: input.id,
    title: input.title,
    summary: input.summary,
    body: "用于工作台展示的最近文章摘要和正文占位。",
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
    reviewedVersion: input.status === "approved" || input.status === "pending_publish" ? 3 : undefined,
    createdAt: new Date("2026-05-06T08:00:00.000Z"),
    updatedAt: new Date(input.updatedAt)
  };
}

function buildLatestReview(article: Article): ReviewRecord | undefined {
  if (article.status !== "approved" && article.status !== "review_rejected" && article.status !== "not_publish") {
    return undefined;
  }

  return {
    id: `${article.id}_review_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    result: article.status === "approved" ? "approved" : article.status === "not_publish" ? "not_publish" : "rejected",
    comment: article.status === "review_rejected" ? "补充风险提示后再提交。" : "审核完成。",
    reviewedAt: new Date("2026-05-06T10:30:00.000Z")
  };
}

function buildLatestPublish(article: Article): PublishRecord | undefined {
  if (article.status !== "pending_publish" && article.status !== "publish_failed") return undefined;

  return {
    id: `${article.id}_publish_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    channel: "wechat_manual",
    status: article.status === "publish_failed" ? "failed" : "prepared",
    errorMessage: article.status === "publish_failed" ? "公众号后台图片上传失败" : undefined,
    createdAt: new Date("2026-05-06T11:20:00.000Z")
  };
}

function getWorkbenchArticles(): ArticleDetail[] {
  return [
    buildArticle({
      id: "article_editing_ai_agent",
      title: "AI Agent 产品化入口观察",
      category: "tech_internet",
      status: "editing",
      topic: "AI Agent 产品化",
      summary: "需要继续补充正文结构和配图建议。",
      updatedAt: "2026-05-06T11:45:00.000Z"
    }),
    buildArticle({
      id: "article_pending_review_finance",
      title: "AI 投研工具风险提示清单",
      category: "finance",
      status: "pending_review",
      topic: "AI 投研工具",
      summary: "等待 review 人确认风险提示和非投资建议表达。",
      updatedAt: "2026-05-06T11:20:00.000Z"
    }),
    buildArticle({
      id: "article_approved_literature",
      title: "春日书房与长句节奏",
      category: "literature",
      status: "approved",
      topic: "春日散文",
      summary: "已通过 review，可以进入发布准备。",
      updatedAt: "2026-05-06T10:50:00.000Z"
    }),
    buildArticle({
      id: "article_publish_failed_market",
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

export default function WorkbenchPage() {
  const articles = getWorkbenchArticles();

  return (
    <main
      style={{
        background: "#f7f8fa",
        minHeight: "100vh",
        padding: "32px clamp(16px, 4vw, 48px)"
      }}
    >
      <div style={{ display: "grid", gap: 24, margin: "0 auto", maxWidth: 1180 }}>
        <header style={{ alignItems: "end", display: "flex", gap: 16, justifyContent: "space-between" }}>
          <div>
            <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>Pusher 工作台</p>
            <h1 style={{ color: "#102a43", fontSize: 30, lineHeight: 1.2, margin: 0 }}>内容生产队列</h1>
          </div>
          <a
            href="/articles/new"
            style={{
              background: "#0f766e",
              borderRadius: 6,
              color: "#ffffff",
              fontWeight: 700,
              padding: "10px 14px",
              textDecoration: "none"
            }}
          >
            新建文章
          </a>
        </header>

        <StatusOverview items={articles} />
        <RecentArticles articles={articles} />
      </div>
    </main>
  );
}
