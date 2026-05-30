import ArticlePreview from "../../../../components/article/ArticlePreview.tsx";
import PublishPreparationPanel from "../../../../components/publish/PublishPreparationPanel.tsx";
import SchedulePanel from "../../../../components/publish/SchedulePanel.tsx";
import { getRuntimePublishPageData } from "../../../../services/runtimePageData.ts";

interface PublishArticlePageProps {
  params: {
    articleId: string;
  };
}

export default async function PublishArticlePage({ params }: PublishArticlePageProps) {
  const { detail, canPublish } = await getRuntimePublishPageData(params.articleId);
  const reviewMatchesCurrentContent = detail.article.reviewedVersion === detail.article.contentVersion;
  const canPublishCurrentContent = canPublish && reviewMatchesCurrentContent;

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
        <div
          data-publish-gate="canPreparePublish"
          data-schedule-field="scheduledFor"
          style={{ display: "grid", gap: 16 }}
        >
          <PublishPreparationPanel
            article={detail.article}
            canPublish={canPublishCurrentContent}
            images={detail.images}
            latestPublish={detail.latestPublish}
          />
          <SchedulePanel article={detail.article} canSchedule={canPublishCurrentContent} />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
