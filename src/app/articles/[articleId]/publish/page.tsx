import ArticlePreview from "../../../../components/article/ArticlePreview.tsx";
import PublishPreparationPanel from "../../../../components/publish/PublishPreparationPanel.tsx";
import SchedulePanel from "../../../../components/publish/SchedulePanel.tsx";
import type { Article, ArticleDetail } from "../../../../domain/article.ts";
import type { ArticleImage } from "../../../../domain/image.ts";
import type { PublishRecord } from "../../../../domain/publish.ts";
import type { PublishSchedule } from "../../../../domain/schedule.ts";
import { canPreparePublish } from "../../../../services/articleStatusService.ts";

interface PublishArticlePageProps {
  params: {
    articleId: string;
  };
}

interface PublishArticleDetail extends ArticleDetail {
  nextSchedule?: PublishSchedule;
}

function buildArticle(articleId: string): Article {
  const status = articleId.includes("pending-publish")
    ? "pending_publish"
    : articleId.includes("pending-review")
      ? "pending_review"
      : articleId.includes("not-publish")
        ? "not_publish"
        : articleId.includes("rejected")
          ? "review_rejected"
          : articleId.includes("published")
            ? "published"
            : articleId.includes("failed")
              ? "publish_failed"
              : "approved";
  const contentVersion = articleId.includes("stale-review") ? 6 : 5;
  const reviewedVersion = status === "approved" || status === "pending_publish" ? 5 : undefined;

  return {
    id: articleId,
    title: "AI Agent 商业化观察：发布前检查清单",
    summary: "面向内容运营团队的公众号人工发布准备示例。",
    body: "AI Agent 正在从对话入口延伸到任务执行流程。\n发布前需要确认标题、摘要、正文结构和配图位置是否完整。\n金融相关表达需要保留风险提示，避免被误读为投资建议。",
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
    contentVersion,
    reviewedVersion,
    publishedVersion: status === "published" ? contentVersion : undefined,
    createdAt: new Date("2026-05-06T08:00:00.000Z"),
    updatedAt: new Date("2026-05-06T11:00:00.000Z")
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

function buildLatestPublish(article: Article): PublishRecord | undefined {
  if (article.status !== "pending_publish" && article.status !== "published" && article.status !== "publish_failed") {
    return undefined;
  }

  return {
    id: `${article.id}_publish_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    channel: "wechat_manual",
    status: article.status === "published" ? "published" : article.status === "publish_failed" ? "failed" : "prepared",
    exportContent: "公众号人工发布内容已生成。",
    imageChecklist: [{ position: "封面", description: "发布前检查清单视觉" }],
    errorMessage: article.status === "publish_failed" ? "公众号后台素材图片上传失败。" : undefined,
    publishedAt: article.status === "published" ? new Date("2026-05-06T12:00:00.000Z") : undefined,
    createdAt: new Date("2026-05-06T11:10:00.000Z")
  };
}

function buildNextSchedule(article: Article): PublishSchedule | undefined {
  if (article.status !== "pending_publish" || article.id.includes("failed")) {
    return undefined;
  }

  return {
    id: `${article.id}_schedule_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    channel: "wechat_manual",
    scheduledFor: new Date("2026-05-07T01:30:00.000Z"),
    status: "scheduled",
    note: "早高峰推送窗口",
    createdAt: new Date("2026-05-06T11:30:00.000Z"),
    updatedAt: new Date("2026-05-06T11:30:00.000Z")
  };
}

function getArticleDetail(articleId: string): PublishArticleDetail {
  const article = buildArticle(articleId);

  return {
    article,
    images: buildImages(articleId),
    latestPublish: buildLatestPublish(article),
    nextSchedule: buildNextSchedule(article)
  };
}

export default function PublishArticlePage({ params }: PublishArticlePageProps) {
  const detail = getArticleDetail(params.articleId);
  const reviewMatchesCurrentContent = detail.article.reviewedVersion === detail.article.contentVersion;
  const canPublish = canPreparePublish(detail.article.status) && reviewMatchesCurrentContent;

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
          gridTemplateColumns: "minmax(320px, 0.95fr) minmax(0, 1.05fr)",
          margin: "0 auto",
          maxWidth: 1280
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <PublishPreparationPanel
            article={detail.article}
            canPublish={canPublish}
            images={detail.images}
            latestPublish={detail.latestPublish}
          />
          <SchedulePanel article={detail.article} canSchedule={canPublish} nextSchedule={detail.nextSchedule} />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
