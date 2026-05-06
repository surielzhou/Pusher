import ArticlePreview from "../../../../components/article/ArticlePreview.tsx";
import ReviewChecklist from "../../../../components/review/ReviewChecklist.tsx";
import ReviewPanel from "../../../../components/review/ReviewPanel.tsx";
import type { Article, ArticleDetail } from "../../../../domain/article.ts";
import type { ArticleImage } from "../../../../domain/image.ts";
import type { ReviewRecord } from "../../../../domain/review.ts";

interface ReviewArticlePageProps {
  params: {
    articleId: string;
  };
}

function buildArticle(articleId: string): Article {
  const status = articleId.includes("approved")
    ? "approved"
    : articleId.includes("not-publish")
      ? "not_publish"
      : articleId.includes("rejected")
        ? "review_rejected"
        : "pending_review";

  return {
    id: articleId,
    title: "AI Agent 商业化观察：入口、流程和发布准备",
    summary: "面向内容运营团队的公众号图文 review 示例。",
    body: "AI Agent 正在从对话入口延伸到任务执行流程。\n内容团队需要在发布前确认选题方向、正文完整度和配图可用性。\n金融相关表达需要保留风险提示，避免被误读为投资建议。",
    category: "finance",
    status,
    generationConfig: {
      category: "finance",
      topic: "AI Agent 商业化",
      audience: "内容运营团队",
      style: "审慎分析",
      length: "中等篇幅",
      references: ["公开产品发布信息", "行业研究摘要"],
      requireRiskNote: true
    },
    riskNote: "本文仅用于内容趋势分析，不构成任何投资建议。",
    contentVersion: 4,
    reviewedVersion: status === "approved" ? 4 : undefined,
    createdAt: new Date("2026-05-06T08:00:00.000Z"),
    updatedAt: new Date("2026-05-06T10:20:00.000Z")
  };
}

function buildImages(articleId: string): ArticleImage[] {
  return [
    {
      id: `${articleId}_image_001`,
      articleId,
      type: "suggestion",
      description: "封面使用 AI Agent 工作流和发布前检查清单组合视觉。",
      position: "封面",
      altText: "AI Agent 发布前检查清单",
      createdAt: new Date("2026-05-06T08:30:00.000Z"),
      updatedAt: new Date("2026-05-06T08:30:00.000Z")
    },
    {
      id: `${articleId}_image_002`,
      articleId,
      type: "uploaded",
      url: "https://images.unsplash.com/photo-1499750310107-5fef28a66643",
      description: "正文配图展示内容审核和排版工作区。",
      source: "manual_upload",
      position: "正文第二段后",
      altText: "内容审核工作区",
      createdAt: new Date("2026-05-06T08:45:00.000Z"),
      updatedAt: new Date("2026-05-06T08:45:00.000Z")
    }
  ];
}

function buildLatestReview(article: Article): ReviewRecord | undefined {
  if (article.status === "pending_review") return undefined;

  return {
    id: `${article.id}_review_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    result:
      article.status === "approved"
        ? "approved"
        : article.status === "not_publish"
          ? "not_publish"
          : "rejected",
    comment:
      article.status === "approved"
        ? "内容方向、正文和配图均已确认，可以进入发布准备。"
        : article.status === "not_publish"
          ? "选题暂缓发布，等待下一轮热点窗口。"
          : "正文第二段需要补充风险提示，摘要需要更具体。",
    reviewChecklist: {
      categoryMatched: true,
      hasBody: true,
      hasImageOrSuggestion: true,
      hasTitle: true
    },
    reviewedAt: new Date("2026-05-06T10:30:00.000Z")
  };
}

function getArticleDetail(articleId: string): ArticleDetail {
  const article = buildArticle(articleId);

  return {
    article,
    images: buildImages(articleId),
    latestReview: buildLatestReview(article)
  };
}

function getReviewChecklist(detail: ArticleDetail) {
  return {
    hasTitle: Boolean(detail.article.title?.trim()),
    hasBody: Boolean(detail.article.body?.trim()),
    hasImageOrSuggestion: detail.images.length > 0,
    categoryMatched: detail.article.category === detail.article.generationConfig.category
  };
}

export default function ReviewArticlePage({ params }: ReviewArticlePageProps) {
  const detail = getArticleDetail(params.articleId);
  const checklist = getReviewChecklist(detail);

  return (
    <main
      style={{
        background: "#f7f8fa",
        minHeight: "100vh",
        padding: "32px clamp(16px, 4vw, 48px)"
      }}
    >
      <div
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "minmax(300px, 0.85fr) minmax(0, 1.15fr)",
          margin: "0 auto",
          maxWidth: 1240
        }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <ReviewPanel article={detail.article} checklist={checklist} latestReview={detail.latestReview} />
          <ReviewChecklist
            article={detail.article}
            checklist={checklist}
            images={detail.images}
            riskNote={detail.article.riskNote}
          />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
