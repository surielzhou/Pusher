"use client";

import { type FormEvent, useState } from "react";
import type { Article } from "../../domain/article.ts";
import type { ReviewRecord } from "../../domain/review.ts";
import type { ReviewView } from "../../services/contracts.ts";

interface ReviewPanelProps {
  article: Article;
  checklist: ReviewView["checklist"];
  latestReview?: ReviewRecord;
}

export default function ReviewPanel({ article, checklist, latestReview }: ReviewPanelProps) {
  const reviewDisabled = article.status !== "pending_review";
  const serializedChecklist = JSON.stringify(checklist);
  const [errorMessage, setErrorMessage] = useState("");
  const [submittingResult, setSubmittingResult] = useState<string | undefined>();

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reviewDisabled || submittingResult) return;

    const formData = new FormData(event.currentTarget);
    const result = String(formData.get("result") ?? "");
    const comment = String(formData.get("comment") ?? "");

    setSubmittingResult(result);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/articles/${article.id}/review`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          result,
          comment,
          reviewChecklist: checklist
        })
      });

      await assertApiSuccess(response);

      if (result === "approved") {
        window.location.assign(`/articles/${article.id}/publish`);
        return;
      }

      if (result === "rejected") {
        window.location.assign(`/articles/${article.id}/edit`);
        return;
      }

      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "提交审核结果失败，请重试。");
    } finally {
      setSubmittingResult(undefined);
    }
  }

  return (
    <section
      aria-labelledby="review-panel-heading"
      style={{
        background: "#ffffff",
        border: "1px solid #d9e2ec",
        borderRadius: 8,
        padding: 20
      }}
    >
      <header style={{ alignItems: "start", display: "flex", gap: 18, justifyContent: "space-between" }}>
        <div>
          <p style={{ color: "#0f766e", fontSize: 13, fontWeight: 700, margin: "0 0 6px" }}>只读 review 模式</p>
          <h1 id="review-panel-heading" style={{ color: "#102a43", fontSize: 26, lineHeight: 1.25, margin: 0 }}>
            审核决策
          </h1>
        </div>
        <span
          style={{
            background: reviewDisabled ? "#f0f4f8" : "#fffbea",
            borderRadius: 999,
            color: reviewDisabled ? "#52606d" : "#92400e",
            fontSize: 12,
            fontWeight: 700,
            padding: "5px 10px",
            whiteSpace: "nowrap"
          }}
        >
          {article.status}
        </span>
      </header>

      {latestReview?.comment ? (
        <div
          role="note"
          style={{
            background: "#f8fafc",
            border: "1px solid #d9e2ec",
            borderRadius: 8,
            color: "#334e68",
            lineHeight: 1.6,
            marginTop: 18,
            padding: 14
          }}
        >
          最近审核意见：{latestReview.comment}
        </div>
      ) : null}

      <p style={{ color: "#52606d", fontSize: 14, lineHeight: 1.6, margin: "18px 0 0" }}>
        Review 页不直接编辑文章正文。需要修改内容时退回到图文编辑页，再重新提交 review。
      </p>

      {errorMessage ? (
        <div
          role="alert"
          style={{
            background: "#fff5f5",
            border: "1px solid #ffd6d6",
            borderRadius: 8,
            color: "#9b1c1c",
            marginTop: 14,
            padding: 12
          }}
        >
          {errorMessage}
        </div>
      ) : null}

      <div style={{ display: "grid", gap: 14, marginTop: 20 }}>
        <form
          data-action="submitReview"
          onSubmit={handleReviewSubmit}
          style={{ display: "grid", gap: 10 }}
        >
          <input name="result" type="hidden" value="approved" />
          <input name="reviewChecklist" type="hidden" value={serializedChecklist} />
          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            审核意见
            <textarea
              disabled={reviewDisabled}
              name="comment"
              placeholder="可填写通过说明或发布注意事项"
              rows={3}
              style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
            />
          </label>
          <button
            disabled={reviewDisabled || Boolean(submittingResult)}
            style={{
              background: reviewDisabled || submittingResult ? "#d9e2ec" : "#0f766e",
              border: 0,
              borderRadius: 6,
              color: "#ffffff",
              font: "inherit",
              fontWeight: 700,
              justifySelf: "start",
              padding: "10px 14px"
            }}
            type="submit"
          >
            {submittingResult === "approved" ? "提交中..." : "通过"}
          </button>
        </form>

        <form
          aria-label="退回修改审核表单"
          onSubmit={handleReviewSubmit}
          style={{
            borderTop: "1px solid #e5eaf0",
            display: "grid",
            gap: 10,
            paddingTop: 14
          }}
        >
          <input name="result" type="hidden" value="rejected" />
          <input name="reviewChecklist" type="hidden" value={serializedChecklist} />
          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            退回修改意见
            <textarea
              disabled={reviewDisabled}
              name="comment"
              placeholder="说明必须修改的标题、正文、图片或风险提示问题"
              required
              rows={3}
              style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
            />
          </label>
          <button
            disabled={reviewDisabled || Boolean(submittingResult)}
            style={{
              background: reviewDisabled || submittingResult ? "#d9e2ec" : "#9b1c1c",
              border: 0,
              borderRadius: 6,
              color: "#ffffff",
              font: "inherit",
              fontWeight: 700,
              justifySelf: "start",
              padding: "10px 14px"
            }}
            type="submit"
          >
            {submittingResult === "rejected" ? "提交中..." : "退回修改"}
          </button>
        </form>

        <form
          onSubmit={handleReviewSubmit}
          style={{
            borderTop: "1px solid #e5eaf0",
            display: "grid",
            gap: 10,
            paddingTop: 14
          }}
        >
          <input name="result" type="hidden" value="not_publish" />
          <input name="reviewChecklist" type="hidden" value={serializedChecklist} />
          <label style={{ color: "#243b53", display: "grid", fontSize: 13, fontWeight: 700, gap: 6 }}>
            暂不发布说明
            <textarea
              disabled={reviewDisabled}
              name="comment"
              placeholder="可记录暂缓原因，便于后续追踪"
              rows={3}
              style={{ border: "1px solid #bcccdc", borderRadius: 6, font: "inherit", padding: 11, resize: "vertical" }}
            />
          </label>
          <button
            disabled={reviewDisabled || Boolean(submittingResult)}
            style={{
              background: reviewDisabled || submittingResult ? "#d9e2ec" : "#334e68",
              border: 0,
              borderRadius: 6,
              color: "#ffffff",
              font: "inherit",
              fontWeight: 700,
              justifySelf: "start",
              padding: "10px 14px"
            }}
            type="submit"
          >
            {submittingResult === "not_publish" ? "提交中..." : "暂不发布"}
          </button>
        </form>
      </div>
    </section>
  );
}

async function assertApiSuccess(response: Response): Promise<void> {
  if (response.ok) return;

  const body = (await response.json().catch(() => undefined)) as { error?: { message?: string } } | undefined;
  throw new Error(body?.error?.message ?? "请求失败，请重试。");
}
