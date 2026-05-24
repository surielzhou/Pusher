import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, it } from "node:test";

import { GET as getArticle } from "../../src/app/api/articles/[articleId]/route.ts";
import { PATCH as saveContent } from "../../src/app/api/articles/[articleId]/content/route.ts";
import { POST as generateDraft } from "../../src/app/api/articles/[articleId]/generate/route.ts";
import { POST as preparePublish } from "../../src/app/api/articles/[articleId]/publish-preparation/route.ts";
import { GET as getReviewView, POST as submitReview } from "../../src/app/api/articles/[articleId]/review/route.ts";
import { POST as submitForReview } from "../../src/app/api/articles/[articleId]/review-submission/route.ts";
import { GET as listArticles, POST as createArticle } from "../../src/app/api/articles/route.ts";
import {
  createRuntimeContainerFromPersistence,
  resetRuntimeContainerForTests,
  setRuntimeContainerForTests
} from "../../src/services/runtimeContainer.ts";
import { createFileRuntimePersistence } from "../../src/services/runtimePersistence.ts";

describe("api runtime", () => {
  beforeEach(() => {
    resetRuntimeContainerForTests();
  });

  it("runs creation, generation, editing, review, and publish preparation through HTTP routes", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pusher-api-runtime-"));
    const snapshotPath = join(tempDir, "runtime.json");

    try {
      await setRuntimeContainerForTests(
        await createRuntimeContainerFromPersistence({
          persistence: createFileRuntimePersistence(snapshotPath)
        })
      );

      const createdResponse = await createArticle(
        jsonRequest("/api/articles", {
          category: "tech_internet",
          topic: "AI Agent 产品入口",
          audience: "产品经理"
        })
      );
      const created = await parseJson(createdResponse);

      assert.equal(createdResponse.status, 201);
      assert.match(created.data.articleId, /^article_/);
      assert.equal(created.data.status, "drafting");

      const articleId = created.data.articleId as string;
      const generatedResponse = await generateDraft(jsonRequest(`/api/articles/${articleId}/generate`), {
        params: { articleId }
      });
      const generated = await parseJson(generatedResponse);

      assert.equal(generatedResponse.status, 200);
      assert.deepEqual(generated.data, {
        articleId,
        status: "editing",
        contentVersion: 2
      });

      const editedResponse = await saveContent(
        jsonRequest(`/api/articles/${articleId}/content`, {
          title: "编辑后的 AI Agent 产品观察",
          summary: "编辑后的摘要，面向公众号读者。",
          body: "编辑后的正文，补充产品入口、业务流程和团队协作变化。"
        }),
        { params: { articleId } }
      );
      const edited = await parseJson(editedResponse);

      assert.equal(editedResponse.status, 200);
      assert.equal(edited.data.contentVersion, 3);

      const submittedResponse = await submitForReview(jsonRequest(`/api/articles/${articleId}/review-submission`), {
        params: { articleId }
      });
      const submitted = await parseJson(submittedResponse);

      assert.equal(submittedResponse.status, 200);
      assert.deepEqual(submitted.data, { status: "pending_review" });

      const reviewViewResponse = await getReviewView(
        new Request(`http://pusher.test/api/articles/${articleId}/review`),
        {
          params: { articleId }
        }
      );
      const reviewView = await parseJson(reviewViewResponse);

      assert.equal(reviewViewResponse.status, 200);
      assert.equal(reviewView.data.article.title, "编辑后的 AI Agent 产品观察");
      assert.deepEqual(reviewView.data.checklist, {
        hasTitle: true,
        hasBody: true,
        hasImageOrSuggestion: true,
        categoryMatched: true
      });

      const reviewedResponse = await submitReview(
        jsonRequest(`/api/articles/${articleId}/review`, {
          result: "approved",
          comment: "内容完整，可以发布。",
          reviewChecklist: {
            titleChecked: true,
            imageChecked: true
          }
        }),
        { params: { articleId } }
      );
      const reviewed = await parseJson(reviewedResponse);

      assert.equal(reviewedResponse.status, 200);
      assert.deepEqual(reviewed.data, {
        status: "approved",
        reviewedVersion: 3
      });

      const preparedResponse = await preparePublish(
        jsonRequest(`/api/articles/${articleId}/publish-preparation`, {
          channel: "wechat_manual"
        }),
        { params: { articleId } }
      );
      const prepared = await parseJson(preparedResponse);

      assert.equal(preparedResponse.status, 201);
      assert.match(prepared.data.publishRecordId, /^publish_/);
      assert.equal(prepared.data.status, "prepared");
      assert.equal(prepared.data.articleStatus, "pending_publish");
      assert.match(prepared.data.exportContent, /# 编辑后的 AI Agent 产品观察/);

      await setRuntimeContainerForTests(
        await createRuntimeContainerFromPersistence({
          persistence: createFileRuntimePersistence(snapshotPath)
        })
      );

      const reloadedDetailResponse = await getArticle(new Request(`http://pusher.test/api/articles/${articleId}`), {
        params: { articleId }
      });
      const reloadedDetail = await parseJson(reloadedDetailResponse);

      assert.equal(reloadedDetailResponse.status, 200);
      assert.equal(reloadedDetail.data.article.status, "pending_publish");
      assert.equal(reloadedDetail.data.latestPublish.status, "prepared");

      const detailResponse = await getArticle(new Request(`http://pusher.test/api/articles/${articleId}`), {
        params: { articleId }
      });
      const detail = await parseJson(detailResponse);

      assert.equal(detailResponse.status, 200);
      assert.equal(detail.data.article.status, "pending_publish");
      assert.equal(detail.data.latestReview.result, "approved");
      assert.equal(detail.data.latestPublish.status, "prepared");

      const listResponse = await listArticles(new Request("http://pusher.test/api/articles?status=pending_publish"));
      const list = await parseJson(listResponse);

      assert.equal(listResponse.status, 200);
      assert.equal(list.data.total, 1);
      assert.equal(list.data.items[0].article.id, articleId);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("returns stable code and message for lifecycle errors", async () => {
    const createdResponse = await createArticle(
      jsonRequest("/api/articles", {
        category: "tech_internet",
        topic: "AI Agent 产品入口"
      })
    );
    const created = await parseJson(createdResponse);
    const articleId = created.data.articleId as string;

    const response = await preparePublish(jsonRequest(`/api/articles/${articleId}/publish-preparation`), {
      params: { articleId }
    });
    const body = await parseJson(response);

    assert.equal(response.status, 409);
    assert.deepEqual(body, {
      error: {
        code: "article_not_publishable",
        message: `Article ${articleId} cannot be prepared for publish while drafting`
      }
    });
  });
});

function jsonRequest(path: string, body?: unknown): Request {
  return new Request(`http://pusher.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function parseJson(response: Response): Promise<any> {
  return response.json();
}
