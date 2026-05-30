import ArticlePreview from "../../../../components/article/ArticlePreview.tsx";
import CompliancePanel from "../../../../components/review/CompliancePanel.tsx";
import ReviewChecklist from "../../../../components/review/ReviewChecklist.tsx";
import ReviewPanel from "../../../../components/review/ReviewPanel.tsx";
import { getRuntimeReviewPageData } from "../../../../services/runtimePageData.ts";

interface ReviewArticlePageProps {
  params: {
    articleId: string;
  };
}

export default async function ReviewArticlePage({ params }: ReviewArticlePageProps) {
  const { detail, checklist, complianceReport } = await getRuntimeReviewPageData(params.articleId);

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
          <CompliancePanel report={complianceReport} />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
