"use client";

import { type FormEvent, useState } from "react";
import type { Article } from "../../domain/article.ts";
import type { ReviewRecord } from "../../domain/review.ts";

interface ArticleEditorProps {
  article: Article;
  latestReview?: ReviewRecord;
  missingFields: string[];
  readOnly: boolean;
}

const missingFieldLabels: Record<string, string> = {
  body: "正文",
  category: "分类",
  image: "图片或配图建议",
  title: "标题"
};

export default function ArticleEditor({ article, latestReview, missingFields, readOnly }: ArticleEditorProps) {
  const isPendingReview = article.status === "pending_review";
  const formReadOnly = readOnly || isPendingReview;
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (formReadOnly || isSaving) return;

    const formData = new FormData(event.currentTarget);
    setIsSaving(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/articles/${article.id}/content`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          title: String(formData.get("title") ?? ""),
          summary: String(formData.get("summary") ?? ""),
          body: String(formData.get("body") ?? "")
        })
      });

      await assertApiSuccess(response);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "保存内容失败，请重试。");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmitReview() {
    if (formReadOnly || missingFields.length > 0 || isSubmittingReview) return;

    setIsSubmittingReview(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/articles/${article.id}/review-submission`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });

      await assertApiSuccess(response);
      window.location.assign(`/articles/${article.id}/review`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "提交 review 失败，请重试。");
    } finally {
      setIsSubmittingReview(false);
    }
  }

  return (
    <section
      aria-labelledby="article-editor-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 18, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>{article.category}</p>
          <h1 id="article-editor-heading" style={{ color: "#102a43", fontSize: 26, lineHeight: 1.25, margin: 0 }}>
            图文编辑
          </h1>
        </div>
        <span
          style={{
            background: formReadOnly ? "#f0f4f8" : "#fffbea",
            borderRadius: 999,
            color: formReadOnly ? "#52606d" : "#92400e",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          {article.status}
        </span>
      </header>

      {article.status === "review_rejected" && latestReview?.comment ? (
        <div
          role="note"
          style={{
            background: "#fff5f5",
            border: "1px solid #ffd6d6",
            borderRadius: 8,
            color: "#9b1c1c",
            lineHeight: 1.6,
            marginTop: 18,
            padding: 14
          }}
        >
          最近退回原因：{latestReview.comment}
        </div>
      ) : null}

      {missingFields.length > 0 ? (
        <div
          role="status"
          style={{
            background: "#fffbea",
            border: "1px solid #f7d070",
            borderRadius: 8,
            color: "#713f12",
            marginTop: 18,
            padding: 14
          }}
        >
          <strong style={{ display: "block", marginBottom: 8 }}>提交 review 前需补齐</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {missingFields.map((field) => (
              <li key={field}>{missingFieldLabels[field] || field}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={handleSave} style={{ display: "grid", gap: 16, marginTop: 20 }}>
        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          标题
          <input
            defaultValue={article.title}
            name="title"
            readOnly={formReadOnly}
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11 }}
            type="text"
          />
        </label>

        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          摘要
          <textarea
            defaultValue={article.summary}
            name="summary"
            readOnly={formReadOnly}
            rows={3}
            style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
          />
        </label>

        <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
          正文
          <textarea
            defaultValue={article.body}
            name="body"
            readOnly={formReadOnly}
            rows={14}
            style={{
              border: "1px solid #bcccdc",
              borderRadius: 6,
              font: "inherit",
              lineHeight: 1.7,
              padding: 11,
              resize: "vertical"
            }}
          />
        </label>

        {errorMessage ? (
          <div
            role="alert"
            style={{
              background: "#fff5f5",
              border: "1px solid #ffd6d6",
              borderRadius: 8,
              color: "#9b1c1c",
              padding: 12
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            disabled={formReadOnly || isSaving}
            style={{
              background: formReadOnly || isSaving ? "#d9e2ec" : "#0f766e",
              border: 0,
              borderRadius: 6,
              color: "#ffffff",
              font: "inherit",
              fontWeight: 700,
              padding: "10px 14px"
            }}
            type="submit"
          >
            {isSaving ? "保存中..." : "保存内容"}
          </button>
          <button
            disabled={formReadOnly || missingFields.length > 0 || isSubmittingReview}
            onClick={handleSubmitReview}
            style={{
              background: formReadOnly || missingFields.length > 0 || isSubmittingReview ? "#d9e2ec" : "#334e68",
              border: 0,
              borderRadius: 6,
              color: "#ffffff",
              font: "inherit",
              fontWeight: 700,
              padding: "10px 14px"
            }}
            type="button"
          >
            {isSubmittingReview ? "提交中..." : "提交 review"}
          </button>
        </div>
      </form>
    </section>
  );
}

async function assertApiSuccess(response: Response): Promise<void> {
  if (response.ok) return;

  const body = (await response.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
  throw new Error(body?.error?.message ?? "请求失败，请重试。");
}
