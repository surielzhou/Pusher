import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import type {
  GeneratedArticleDraft,
  TextGenerationAdapter,
  TextGenerationRequest
} from "../../src/adapters/ai/textGenerationAdapter.ts";
import { PATCH as saveContent } from "../../src/app/api/articles/[articleId]/content/route.ts";
import { POST as generateDraft } from "../../src/app/api/articles/[articleId]/generate/route.ts";
import { POST as preparePublish } from "../../src/app/api/articles/[articleId]/publish-preparation/route.ts";
import { GET as getReviewView, POST as submitReview } from "../../src/app/api/articles/[articleId]/review/route.ts";
import { POST as submitForReview } from "../../src/app/api/articles/[articleId]/review-submission/route.ts";
import { GET as getArticle } from "../../src/app/api/articles/[articleId]/route.ts";
import { POST as createArticle } from "../../src/app/api/articles/route.ts";
import {
  createRuntimeContainerFromPersistence,
  setRuntimeContainerForTests
} from "../../src/services/runtimeContainer.ts";
import { createFileRuntimePersistence } from "../../src/services/runtimePersistence.ts";

describe("runtime persistence", () => {
  it("persists the local creator workflow and reloads it from JSON", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pusher-runtime-"));
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
          topic: "Local Runtime",
          audience: "content operators"
        })
      );
      const created = await parseJson(createdResponse);
      const articleId = created.data.articleId as string;

      assert.equal(createdResponse.status, 201);
      assert.match(articleId, /^article_/);

      assert.equal(
        (
          await generateDraft(jsonRequest(`/api/articles/${articleId}/generate`), {
            params: { articleId }
          })
        ).status,
        200
      );

      assert.equal(
        (
          await saveContent(
            jsonRequest(`/api/articles/${articleId}/content`, {
              title: "Local Runtime Article",
              summary: "Saved through the API runtime.",
              body: "This article proves local runtime persistence across reloads."
            }, "PATCH"),
            { params: { articleId } }
          )
        ).status,
        200
      );

      assert.equal(
        (
          await submitForReview(jsonRequest(`/api/articles/${articleId}/review-submission`), {
            params: { articleId }
          })
        ).status,
        200
      );

      const reviewView = await parseJson(
        await getReviewView(new Request(`http://pusher.test/api/articles/${articleId}/review`), {
          params: { articleId }
        })
      );
      assert.equal(reviewView.data.article.title, "Local Runtime Article");

      assert.equal(
        (
          await submitReview(
            jsonRequest(`/api/articles/${articleId}/review`, {
              result: "approved",
              comment: "Ready for local publish preparation.",
              reviewChecklist: {
                titleChecked: true,
                imageChecked: true
              }
            }),
            { params: { articleId } }
          )
        ).status,
        200
      );

      assert.equal(
        (
          await preparePublish(jsonRequest(`/api/articles/${articleId}/publish-preparation`), {
            params: { articleId }
          })
        ).status,
        201
      );

      const rawSnapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      assert.equal(rawSnapshot.schemaVersion, 1);
      assert.equal(rawSnapshot.articles.length, 1);
      assert.equal(rawSnapshot.images.length, 1);
      assert.equal(rawSnapshot.reviews.length, 1);
      assert.equal(rawSnapshot.publishes.length, 1);

      await setRuntimeContainerForTests(
        await createRuntimeContainerFromPersistence({
          persistence: createFileRuntimePersistence(snapshotPath)
        })
      );

      const reloadedResponse = await getArticle(new Request(`http://pusher.test/api/articles/${articleId}`), {
        params: { articleId }
      });
      const reloaded = await parseJson(reloadedResponse);

      assert.equal(reloadedResponse.status, 200);
      assert.equal(reloaded.data.article.title, "Local Runtime Article");
      assert.equal(reloaded.data.article.status, "pending_publish");
      assert.equal(reloaded.data.latestReview.result, "approved");
      assert.equal(reloaded.data.latestPublish.status, "prepared");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("persists generation failure state after API adapter failure", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "pusher-runtime-"));
    const snapshotPath = join(tempDir, "runtime.json");

    try {
      await setRuntimeContainerForTests(
        await createRuntimeContainerFromPersistence({
          persistence: createFileRuntimePersistence(snapshotPath),
          textGenerationAdapter: new FailingTextGenerationAdapter()
        })
      );

      const createdResponse = await createArticle(
        jsonRequest("/api/articles", {
          category: "tech_internet",
          topic: "Local Runtime Failure",
          audience: "content operators"
        })
      );
      const created = await parseJson(createdResponse);
      const articleId = created.data.articleId as string;

      assert.equal(createdResponse.status, 201);

      const failedResponse = await generateDraft(jsonRequest(`/api/articles/${articleId}/generate`), {
        params: { articleId }
      });
      const failed = await parseJson(failedResponse);

      assert.equal(failedResponse.status, 502);
      assert.equal(failed.error.code, "generation_adapter_failed");

      const reloadedContainer = await createRuntimeContainerFromPersistence({
        persistence: createFileRuntimePersistence(snapshotPath)
      });
      await setRuntimeContainerForTests(reloadedContainer);

      const reloadedResponse = await getArticle(new Request(`http://pusher.test/api/articles/${articleId}`), {
        params: { articleId }
      });
      const reloaded = await parseJson(reloadedResponse);
      const statusEvents = [...reloadedContainer.store.statusEvents.values()].filter(
        (event) => event.articleId === articleId
      );

      assert.equal(reloadedResponse.status, 200);
      assert.equal(reloaded.data.article.status, "generation_failed");
      assert.equal(statusEvents.at(-1)?.fromStatus, "drafting");
      assert.equal(statusEvents.at(-1)?.toStatus, "generation_failed");
      assert.match(statusEvents.at(-1)?.reason ?? "", /Generation failed: adapter offline/);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});

function jsonRequest(path: string, body?: unknown, method = "POST"): Request {
  return new Request(`http://pusher.test${path}`, {
    method,
    headers: {
      "content-type": "application/json"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

async function parseJson(response: Response): Promise<any> {
  return response.json();
}

class FailingTextGenerationAdapter implements TextGenerationAdapter {
  async generateArticleDraft(_request: TextGenerationRequest): Promise<GeneratedArticleDraft> {
    throw new Error("adapter offline");
  }
}
