import { ARTICLE_STATUSES, CONTENT_CATEGORIES, type ArticleStatus, type ContentCategory } from "../../domain/status.ts";

interface ArticleFiltersProps {
  category?: ContentCategory;
  status?: ArticleStatus;
  keyword?: string;
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

export default function ArticleFilters({ category, status, keyword }: ArticleFiltersProps) {
  return (
    <form
      action="/history"
      method="get"
      style={{
        alignItems: "end",
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        display: "grid",
        gap: 14,
        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
        padding: 16
      }}
    >
      <label style={fieldStyle}>
        内容方向
        <select defaultValue={category ?? ""} name="category" style={inputStyle}>
          <option value="">全部方向</option>
          {CONTENT_CATEGORIES.map((value) => (
            <option key={value} value={value}>
              {categoryLabels[value]}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldStyle}>
        状态
        <select defaultValue={status ?? ""} name="status" style={inputStyle}>
          <option value="">全部状态</option>
          {ARTICLE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {statusLabels[value]}
            </option>
          ))}
        </select>
      </label>

      <label style={fieldStyle}>
        关键词
        <input
          defaultValue={keyword ?? ""}
          name="keyword"
          placeholder="标题、摘要或主题"
          style={inputStyle}
          type="search"
        />
      </label>

      <button
        style={{
          background: "#0f766e",
          border: 0,
          borderRadius: 6,
          color: "#ffffff",
          cursor: "pointer",
          font: "inherit",
          fontWeight: 700,
          minHeight: 42,
          padding: "10px 14px"
        }}
        type="submit"
      >
        筛选
      </button>
    </form>
  );
}

const fieldStyle = {
  color: "#243b53",
  display: "grid",
  fontSize: 13,
  fontWeight: 700,
  gap: 6
};

const inputStyle = {
  border: "1px solid #bcccdc",
  borderRadius: 6,
  color: "#243b53",
  font: "inherit",
  minHeight: 42,
  padding: "9px 10px"
};
