import ArticleEditor from "../../../../components/article/ArticleEditor.tsx";
import ArticlePreview from "../../../../components/article/ArticlePreview.tsx";
import ImagePanel from "../../../../components/article/ImagePanel.tsx";
import type { Article, ArticleDetail } from "../../../../domain/article.ts";
import type { ArticleImage } from "../../../../domain/image.ts";
import type { ReviewRecord } from "../../../../domain/review.ts";

interface EditArticlePageProps {
  params: {
    articleId: string;
  };
}

function buildArticle(articleId: string): Article {
  const status = articleId.includes("pending")
    ? "pending_review"
    : articleId.includes("rejected")
      ? "review_rejected"
      : "editing";

  return {
    id: articleId,
    title: "AI 生成图文发布准备清单",
    summary: "面向运营团队的公众号图文编辑与发布准备流程。",
    body: "确认标题和摘要是否贴合选题。\n补齐正文段落、风险提示和配图说明。\n提交 review 后等待审核结果。",
    category: "tech_internet",
    status,
    generationConfig: {
      category: "tech_internet",
      topic: "公众号图文发布准备",
      audience: "内容运营团队",
      requireRiskNote: false
    },
    contentVersion: status === "review_rejected" ? 3 : 2,
    createdAt: new Date("2026-05-06T08:00:00.000Z"),
    updatedAt: new Date("2026-05-06T09:30:00.000Z")
  };
}

function buildImages(articleId: string): ArticleImage[] {
  return [
    {
      id: `${articleId}_image_001`,
      articleId,
      type: "suggestion",
      description: "封面使用发布前检查清单视觉，突出标题、配图、review 三个步骤。",
      position: "封面",
      altText: "发布准备清单封面图",
      createdAt: new Date("2026-05-06T08:20:00.000Z"),
      updatedAt: new Date("2026-05-06T08:20:00.000Z")
    },
    {
      id: `${articleId}_image_002`,
      articleId,
      type: "uploaded",
      url: "https://images.unsplash.com/photo-1499750310107-5fef28a66643",
      description: "正文配图展示编辑桌面和内容排版场景。",
      source: "manual_upload",
      position: "正文第二段后",
      altText: "内容编辑工作区",
      createdAt: new Date("2026-05-06T08:25:00.000Z"),
      updatedAt: new Date("2026-05-06T08:25:00.000Z")
    }
  ];
}

function buildLatestReview(article: Article): ReviewRecord | undefined {
  if (article.status !== "review_rejected") return undefined;

  return {
    id: `${article.id}_review_001`,
    articleId: article.id,
    articleVersion: article.contentVersion,
    result: "rejected",
    comment: "摘要需要更具体，正文第二段缺少发布前风险提示。",
    reviewChecklist: {
      hasBody: true,
      hasImage: true,
      hasRiskNote: false,
      hasTitle: true
    },
    reviewedAt: new Date("2026-05-06T10:00:00.000Z")
  };
}

function getArticleDetail(articleId: string): ArticleDetail {
  const article = buildArticle(articleId);
  const images = articleId.includes("missing-image") ? [] : buildImages(articleId);

  return {
    article,
    images,
    latestReview: buildLatestReview(article)
  };
}

function getMissingFields(detail: ArticleDetail): string[] {
  const missingFields: string[] = [];

  if (!detail.article.title?.trim()) missingFields.push("title");
  if (!detail.article.body?.trim()) missingFields.push("body");
  if (!detail.article.category) missingFields.push("category");
  if (detail.images.length === 0) missingFields.push("image");

  return missingFields;
}

export default function EditArticlePage({ params }: EditArticlePageProps) {
  const detail = getArticleDetail(params.articleId);
  const readOnly = detail.article.status === "pending_review";
  const missingFields = getMissingFields(detail);

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
          gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)",
          margin: "0 auto",
          maxWidth: 1240
        }}
      >
        <div style={{ display: "grid", gap: 20 }}>
          <ArticleEditor
            article={detail.article}
            latestReview={detail.latestReview}
            missingFields={missingFields}
            readOnly={readOnly}
          />
          <ImagePanel images={detail.images} readOnly={readOnly} />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
