import ArticleEditor from "../../../../components/article/ArticleEditor.tsx";
import ArticlePreview from "../../../../components/article/ArticlePreview.tsx";
import ImagePanel from "../../../../components/article/ImagePanel.tsx";
import SourcePanel from "../../../../components/article/SourcePanel.tsx";
import { DEFAULT_MATERIAL_ASSETS } from "../../../../services/materialService.ts";
import { getRuntimeEditPageData } from "../../../../services/runtimePageData.ts";

interface EditArticlePageProps {
  params: {
    articleId: string;
  };
}

export default async function EditArticlePage({ params }: EditArticlePageProps) {
  const { detail, readOnly, missingFields, sources } = await getRuntimeEditPageData(params.articleId);

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
          <SourcePanel sources={sources} readOnly={readOnly} />
          <ImagePanel images={detail.images} materials={DEFAULT_MATERIAL_ASSETS} readOnly={readOnly} />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
