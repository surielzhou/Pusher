# Phase 9 Local Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the local creator workflow so article creation, generation, editing, review, and publish preparation run through API-backed pages and persist to a restart-safe JSON snapshot.

**Architecture:** Keep the existing domain/service/repository boundaries. Add a small runtime persistence adapter around the Phase 8 memory store, make API routes save after successful mutations, and replace page-local static fixture builders with runtime-backed data. Client forms call the API runtime and render inline errors.

**Tech Stack:** TypeScript, Next.js App Router-style route modules, Node test runner with `--experimental-strip-types`, existing in-memory repositories, Phase 8 JSON snapshot persistence.

---

## File Structure

- Create `src/services/runtimePersistence.ts`: resolves the local snapshot path and adapts `createJsonFileStore`, `loadRepositoryStore`, and `saveRepositoryStore` for runtime use.
- Modify `src/services/runtimeContainer.ts`: support async API runtime initialization from a persisted store, expose `persist()`, and add helpers for read and mutation routes.
- Modify `src/app/api/articles/**/route.ts`: use async runtime helpers and persist after successful mutations.
- Modify `src/components/article/generationFormModel.ts`: model creation and generation as two API calls.
- Modify `src/components/article/GenerationForm.tsx`: create the article, generate the draft, then redirect to edit.
- Create `src/services/runtimePageData.ts`: shared server-side page data helpers for edit, review, and publish routes.
- Modify `src/app/articles/[articleId]/edit/page.tsx`: load real article detail and remove static builders.
- Modify `src/app/articles/[articleId]/review/page.tsx`: load real review data and remove static builders.
- Modify `src/app/articles/[articleId]/publish/page.tsx`: load real publish data and remove static builders.
- Modify `src/components/article/ArticleEditor.tsx`: submit save and review actions through API calls.
- Modify `src/components/review/ReviewPanel.tsx`: submit review decisions through API calls.
- Modify `src/components/publish/PublishPreparationPanel.tsx`: create publish preparation through API calls and refresh on success.
- Modify `.gitignore`: ignore local runtime snapshot data.
- Modify `scripts/build.mjs`: include the new runtime persistence file, runtime page data helper, and Phase 9 tests.
- Modify `docs/开发计划/Phase开发计划-多AI并行.md`: add a Phase 9 section and verification checklist.
- Add or modify tests:
  - `tests/integration/runtime-persistence.test.ts`
  - `tests/integration/api-runtime.test.ts`
  - `tests/e2e/article-generation.spec.ts`
  - `tests/e2e/article-editing.spec.ts`
  - `tests/e2e/article-review.spec.ts`
  - `tests/e2e/publish-preparation.spec.ts`

## Task 1: Runtime File Persistence

**Files:**
- Create: `src/services/runtimePersistence.ts`
- Modify: `src/services/runtimeContainer.ts`
- Modify: `.gitignore`
- Test: `tests/integration/runtime-persistence.test.ts`

- [ ] **Step 1: Write the failing persistence integration test**

Create `tests/integration/runtime-persistence.test.ts`:

```ts
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

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
            }),
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
node --test --experimental-strip-types tests/integration/runtime-persistence.test.ts
```

Expected: FAIL because `src/services/runtimePersistence.ts`, `createRuntimeContainerFromPersistence`, and async runtime test wiring do not exist yet.

- [ ] **Step 3: Add the runtime persistence adapter**

Create `src/services/runtimePersistence.ts`:

```ts
import { createJsonFileStore, type SnapshotStore } from "../repositories/fileStore.ts";
import {
  loadRepositoryStore,
  saveRepositoryStore,
  type RepositoryPersistenceSnapshot
} from "../repositories/persistence.ts";
import { createMemoryStore, type MemoryRepositoryStore } from "../repositories/memoryStore.ts";

declare const process: {
  env?: Record<string, string | undefined>;
};

export interface RuntimePersistence {
  readonly snapshotPath?: string;
  loadStore(): Promise<MemoryRepositoryStore>;
  saveStore(store: MemoryRepositoryStore): Promise<void>;
}

export interface FileRuntimePersistenceOptions {
  snapshotPath?: string;
  snapshotStore?: SnapshotStore<RepositoryPersistenceSnapshot>;
}

export const DEFAULT_RUNTIME_SNAPSHOT_PATH = "data/pusher-runtime.json";
export const RUNTIME_SNAPSHOT_PATH_ENV = "PUSHER_RUNTIME_SNAPSHOT_PATH";

export function resolveRuntimeSnapshotPath(input?: string): string {
  const configured = input?.trim() || process.env?.[RUNTIME_SNAPSHOT_PATH_ENV]?.trim();
  return configured || DEFAULT_RUNTIME_SNAPSHOT_PATH;
}

export function createNoopRuntimePersistence(): RuntimePersistence {
  return {
    async loadStore() {
      return createMemoryStore();
    },
    async saveStore() {
      return;
    }
  };
}

export function createFileRuntimePersistence(input?: string | FileRuntimePersistenceOptions): RuntimePersistence {
  const options = typeof input === "string" ? { snapshotPath: input } : (input ?? {});
  const snapshotPath = resolveRuntimeSnapshotPath(options.snapshotPath);
  const snapshotStore = options.snapshotStore ?? createJsonFileStore<RepositoryPersistenceSnapshot>(snapshotPath);

  return {
    snapshotPath,

    async loadStore() {
      return loadRepositoryStore(snapshotStore);
    },

    async saveStore(store) {
      await saveRepositoryStore(store, snapshotStore);
    }
  };
}
```

- [ ] **Step 4: Modify `.gitignore` to ignore local runtime snapshots**

Add this line to `.gitignore`:

```gitignore
data/*.json
```

- [ ] **Step 5: Extend the runtime container**

Modify `src/services/runtimeContainer.ts`:

```ts
import {
  createRepositoryIdFactory
} from "../repositories/persistence.ts";
import type { MemoryRepositoryStore } from "../repositories/memoryStore.ts";
import {
  createFileRuntimePersistence,
  createNoopRuntimePersistence,
  type RuntimePersistence
} from "./runtimePersistence.ts";
```

Add fields to `RuntimeContainer`:

```ts
export interface RuntimeContainer {
  authService: AuthService;
  articleService: ArticleService;
  generationService: GenerationService;
  imageService: ImageService;
  editorService: EditorService;
  reviewService: ReviewService;
  publishPreparationService: PublishPreparationService;
  contentValidationService: ContentValidationService;
  materialService: MaterialService;
  complianceService: ComplianceService;
  store: MemoryRepositoryStore;
  persist(): Promise<void>;
}
```

Add options:

```ts
export interface RuntimeContainerOptions {
  textGenerationAdapter?: TextGenerationAdapter;
  imageGenerationAdapter?: ImageGenerationAdapter;
  users?: readonly AuthUser[];
  now?: RepositoryClock;
  createId?: RepositoryIdFactory;
  store?: MemoryRepositoryStore;
  persistence?: RuntimePersistence;
}
```

Replace the current `let runtimeContainer` block with this shape:

```ts
let runtimeContainer: RuntimeContainer | undefined;
let runtimeContainerPromise: Promise<RuntimeContainer> | undefined;

export function getRuntimeContainer(): RuntimeContainer {
  runtimeContainer ??= createRuntimeContainer();
  runtimeContainerPromise ??= Promise.resolve(runtimeContainer);
  return runtimeContainer;
}

export async function getRuntimeContainerForApi(): Promise<RuntimeContainer> {
  runtimeContainerPromise ??= createRuntimeContainerFromPersistence({
    persistence: createFileRuntimePersistence()
  });
  runtimeContainer = await runtimeContainerPromise;
  return runtimeContainer;
}

export async function runRuntimeMutation<T>(action: (runtime: RuntimeContainer) => Promise<T>): Promise<T> {
  const runtime = await getRuntimeContainerForApi();
  const result = await action(runtime);
  await runtime.persist();
  return result;
}

export async function createRuntimeContainerFromPersistence(
  options: RuntimeContainerOptions = {}
): Promise<RuntimeContainer> {
  const persistence = options.persistence ?? createFileRuntimePersistence();
  const store = options.store ?? (await persistence.loadStore());

  return createRuntimeContainer({
    ...options,
    store,
    persistence,
    createId: options.createId ?? createRepositoryIdFactory(store)
  });
}
```

Inside `createRuntimeContainer`, replace:

```ts
const store = createMemoryStore();
const createId = options.createId ?? createSequentialIdFactory();
```

with:

```ts
const store = options.store ?? createMemoryStore();
const persistence = options.persistence ?? createNoopRuntimePersistence();
const createId = options.createId ?? createSequentialIdFactory();
```

Return the new fields:

```ts
  return {
    authService,
    articleService,
    generationService,
    imageService,
    editorService,
    reviewService,
    publishPreparationService,
    contentValidationService,
    materialService,
    complianceService,
    store,
    persist: () => persistence.saveStore(store)
  };
```

Update the test helpers:

```ts
export function resetRuntimeContainerForTests(options: RuntimeContainerOptions = {}): RuntimeContainer {
  runtimeContainer = createRuntimeContainer(options);
  runtimeContainerPromise = Promise.resolve(runtimeContainer);
  return runtimeContainer;
}

export async function setRuntimeContainerForTests(container: RuntimeContainer): Promise<RuntimeContainer> {
  runtimeContainer = container;
  runtimeContainerPromise = Promise.resolve(container);
  return container;
}
```

- [ ] **Step 6: Run the focused test**

Run:

```bash
node --test --experimental-strip-types tests/integration/runtime-persistence.test.ts
```

Expected: still FAIL until API routes use async runtime helpers and persist mutations.

- [ ] **Step 7: Commit the runtime persistence base**

```bash
git add .gitignore src/services/runtimePersistence.ts src/services/runtimeContainer.ts tests/integration/runtime-persistence.test.ts
git commit -m "feat: add persistent runtime container"
```

## Task 2: Persist API Runtime Mutations

**Files:**
- Modify: `src/app/api/articles/route.ts`
- Modify: `src/app/api/articles/[articleId]/route.ts`
- Modify: `src/app/api/articles/[articleId]/generate/route.ts`
- Modify: `src/app/api/articles/[articleId]/content/route.ts`
- Modify: `src/app/api/articles/[articleId]/review-submission/route.ts`
- Modify: `src/app/api/articles/[articleId]/review/route.ts`
- Modify: `src/app/api/articles/[articleId]/publish-preparation/route.ts`
- Test: `tests/integration/api-runtime.test.ts`
- Test: `tests/integration/runtime-persistence.test.ts`

- [ ] **Step 1: Add an assertion to the API runtime test**

Modify `tests/integration/api-runtime.test.ts` in the first test after publish preparation:

```ts
    const reloadedDetailResponse = await getArticle(new Request(`http://pusher.test/api/articles/${articleId}`), {
      params: { articleId }
    });
    const reloadedDetail = await parseJson(reloadedDetailResponse);

    assert.equal(reloadedDetailResponse.status, 200);
    assert.equal(reloadedDetail.data.article.status, "pending_publish");
    assert.equal(reloadedDetail.data.latestPublish.status, "prepared");
```

- [ ] **Step 2: Run integration tests to verify the persistence path fails**

Run:

```bash
node --test --experimental-strip-types tests/integration/api-runtime.test.ts tests/integration/runtime-persistence.test.ts
```

Expected: FAIL because mutation routes do not call `runRuntimeMutation` and GET routes do not await `getRuntimeContainerForApi`.

- [ ] **Step 3: Update article list and creation routes**

In `src/app/api/articles/route.ts`, replace the runtime import:

```ts
import { getRuntimeContainerForApi, runRuntimeMutation } from "../../../services/runtimeContainer.ts";
```

Use async runtime in `GET`:

```ts
    const runtime = await getRuntimeContainerForApi();
    return jsonData(await runtime.articleService.listArticles(query));
```

Use persisted mutation in `POST`:

```ts
    return jsonData(await runRuntimeMutation((runtime) => runtime.articleService.createArticle(input)), 201);
```

- [ ] **Step 4: Update article detail route**

In `src/app/api/articles/[articleId]/route.ts`, replace the runtime import:

```ts
import { getRuntimeContainerForApi } from "../../../../services/runtimeContainer.ts";
```

Use async runtime:

```ts
    const runtime = await getRuntimeContainerForApi();
    return jsonData(await runtime.articleService.getArticleDetail(articleId));
```

- [ ] **Step 5: Update generation route**

In `src/app/api/articles/[articleId]/generate/route.ts`, replace the runtime import:

```ts
import { runRuntimeMutation } from "../../../../../services/runtimeContainer.ts";
```

Wrap both generation paths:

```ts
    return jsonData(
      await runRuntimeMutation((runtime) => {
        if (scopeInput || instruction) {
          const scope = scopeInput ? assertAllowedValue(scopeInput, GENERATION_SCOPES, "scope") : undefined;
          return runtime.generationService.regenerateDraft(articleId, { scope, instruction });
        }

        return runtime.generationService.generateDraft(articleId);
      })
    );
```

- [ ] **Step 6: Update content save route**

In `src/app/api/articles/[articleId]/content/route.ts`, replace the runtime import:

```ts
import { runRuntimeMutation } from "../../../../../services/runtimeContainer.ts";
```

Persist the content mutation:

```ts
    return jsonData(
      await runRuntimeMutation((runtime) =>
        runtime.editorService.saveArticleContent(articleId, pickContentPatch(body))
      )
    );
```

- [ ] **Step 7: Update review submission route**

In `src/app/api/articles/[articleId]/review-submission/route.ts`, replace the runtime import:

```ts
import { runRuntimeMutation } from "../../../../../services/runtimeContainer.ts";
```

Persist the status transition:

```ts
    return jsonData(await runRuntimeMutation((runtime) => runtime.editorService.submitForReview(articleId)));
```

- [ ] **Step 8: Update review route**

In `src/app/api/articles/[articleId]/review/route.ts`, replace the runtime import:

```ts
import { getRuntimeContainerForApi, runRuntimeMutation } from "../../../../../services/runtimeContainer.ts";
```

Use async runtime in `GET`:

```ts
    const runtime = await getRuntimeContainerForApi();
    return jsonData(await runtime.reviewService.getReviewView(articleId));
```

Persist the review decision in `POST`:

```ts
    return jsonData(
      await runRuntimeMutation((runtime) =>
        runtime.reviewService.submitReview({
          articleId,
          result,
          comment: optionalString(body, "comment"),
          reviewChecklist: optionalBooleanRecord(body, "reviewChecklist")
        })
      )
    );
```

- [ ] **Step 9: Update publish preparation route**

In `src/app/api/articles/[articleId]/publish-preparation/route.ts`, replace the runtime import:

```ts
import { runRuntimeMutation } from "../../../../../services/runtimeContainer.ts";
```

Persist publish preparation:

```ts
    return jsonData(
      await runRuntimeMutation((runtime) =>
        runtime.publishPreparationService.preparePublish({
          articleId,
          channel: optionalString(body, "channel") ?? "wechat_manual"
        })
      ),
      201
    );
```

- [ ] **Step 10: Run integration tests**

Run:

```bash
node --test --experimental-strip-types tests/integration/api-runtime.test.ts tests/integration/runtime-persistence.test.ts
```

Expected: PASS with all integration tests in these two files passing.

- [ ] **Step 11: Commit API persistence**

```bash
git add src/app/api src/services/runtimeContainer.ts tests/integration/api-runtime.test.ts tests/integration/runtime-persistence.test.ts
git commit -m "feat: persist api runtime mutations"
```

## Task 3: Article Creation Form Uses Create Then Generate

**Files:**
- Modify: `src/components/article/generationFormModel.ts`
- Modify: `src/components/article/GenerationForm.tsx`
- Test: `tests/e2e/article-generation.spec.ts`

- [ ] **Step 1: Add E2E source assertions for two-step generation**

Modify `tests/e2e/article-generation.spec.ts` to assert the creation and generation endpoints:

```ts
  it("creates an article before generating a draft", async () => {
    const modelSource = await readRequiredSource("src/components/article/generationFormModel.ts");
    const formSource = await readRequiredSource("src/components/article/GenerationForm.tsx");
    const combinedSource = `${modelSource}\n${formSource}`;

    assertMatches(combinedSource, /CREATE_ARTICLE_ENDPOINT\s*=\s*"\/api\/articles"/, "generation form should create articles through the article API");
    assertMatches(combinedSource, /resolveArticleGenerationEndpoint/, "generation form should resolve article-specific generation endpoint");
    assertMatches(combinedSource, /\/generate/, "generation form should call the article generation endpoint after creation");
  });
```

- [ ] **Step 2: Run the generation E2E source test to verify it fails**

Run:

```bash
npm run test:e2e -- tests/e2e/article-generation.spec.ts
```

Expected: FAIL because `GENERATION_ENDPOINT` still points at `/api/articles/generation`.

- [ ] **Step 3: Update the generation form model**

In `src/components/article/generationFormModel.ts`, replace:

```ts
export const GENERATION_ENDPOINT = "/api/articles/generation";
```

with:

```ts
export const CREATE_ARTICLE_ENDPOINT = "/api/articles";
```

Add:

```ts
export function resolveArticleGenerationEndpoint(articleId: string): string {
  const normalizedArticleId = articleId.trim();
  if (!normalizedArticleId) {
    throw new Error("生成接口没有返回文章 ID");
  }

  return `/api/articles/${encodeURIComponent(normalizedArticleId)}/generate`;
}
```

Keep `resolveGenerationRedirect(articleId)` unchanged.

- [ ] **Step 4: Update the generation form component**

In `src/components/article/GenerationForm.tsx`, update imports:

```ts
  CREATE_ARTICLE_ENDPOINT,
  buildGenerationPayload,
  isGenerationInputReady,
  resolveArticleGenerationEndpoint,
  resolveGenerationFailureMessage,
  resolveGenerationRedirect,
```

Replace the single `fetch(GENERATION_ENDPOINT, ...)` block in `handleSubmit` with:

```ts
      const payload = buildGenerationPayload(input);
      const createdResponse = await fetch(CREATE_ARTICLE_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      const created = (await readGenerationResponse(createdResponse)) as
        | ({ data?: { articleId?: string } } & GenerationFailurePayload)
        | undefined;

      if (!createdResponse.ok) {
        throw new Error(resolveGenerationFailureMessage(created?.error ? created : undefined));
      }

      const articleId = created?.data?.articleId ?? "";
      const generatedResponse = await fetch(resolveArticleGenerationEndpoint(articleId), {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({})
      });

      const generated = (await readGenerationResponse(generatedResponse)) as GenerationFailurePayload | undefined;
      if (!generatedResponse.ok) {
        throw new Error(resolveGenerationFailureMessage(generated));
      }

      window.location.assign(resolveGenerationRedirect(articleId));
```

Adjust `resolveGenerationFailureMessage` inputs so API errors shaped as `{ error: { message } }` are normalized:

```ts
export interface GenerationFailurePayload {
  error?: string | { message?: string };
  message?: string;
  reason?: string;
}

export function resolveGenerationFailureMessage(payload?: GenerationFailurePayload | null): string {
  const nestedError = typeof payload?.error === "object" ? payload.error.message : payload?.error;
  return normalizeOptionalText(payload?.message ?? nestedError ?? payload?.reason) ?? "生成失败，请重试。";
}
```

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm run test:e2e -- tests/e2e/article-generation.spec.ts
node --test --experimental-strip-types tests/integration/api-runtime.test.ts tests/integration/runtime-persistence.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit generation flow**

```bash
git add src/components/article/generationFormModel.ts src/components/article/GenerationForm.tsx tests/e2e/article-generation.spec.ts
git commit -m "feat: create articles before generation"
```

## Task 4: Runtime-Backed Server Pages

**Files:**
- Create: `src/services/runtimePageData.ts`
- Modify: `src/app/articles/[articleId]/edit/page.tsx`
- Modify: `src/app/articles/[articleId]/review/page.tsx`
- Modify: `src/app/articles/[articleId]/publish/page.tsx`
- Test: `tests/e2e/article-editing.spec.ts`
- Test: `tests/e2e/article-review.spec.ts`
- Test: `tests/e2e/publish-preparation.spec.ts`

- [ ] **Step 1: Add source assertions that static builders are gone**

Add this test to `tests/e2e/article-editing.spec.ts`:

```ts
  it("loads article editing data from the runtime instead of static builders", async () => {
    const pageSource = await readRequiredSource(editPagePath);

    assertMatches(pageSource, /getRuntimeArticleDetail/, "edit page should load article detail from runtime page data");
    assert.doesNotMatch(pageSource, /function buildArticle|function buildImages|function buildSources/, "edit page should not build static article fixtures");
  });
```

Add this test to `tests/e2e/article-review.spec.ts`:

```ts
  it("loads review data from the runtime instead of static builders", async () => {
    const pageSource = await readRequiredSource(reviewPagePath);

    assertMatches(pageSource, /getRuntimeReviewPageData/, "review page should load review data from runtime page data");
    assert.doesNotMatch(pageSource, /function buildArticle|function buildImages|function buildLatestReview/, "review page should not build static article fixtures");
  });
```

Add this test to `tests/e2e/publish-preparation.spec.ts`:

```ts
  it("loads publish data from the runtime instead of static builders", async () => {
    const pageSource = await readRequiredSource(publishPagePath);

    assertMatches(pageSource, /getRuntimePublishPageData/, "publish page should load publish data from runtime page data");
    assert.doesNotMatch(pageSource, /function buildArticle|function buildImages|function buildLatestPublish/, "publish page should not build static article fixtures");
  });
```

- [ ] **Step 2: Run page E2E source tests to verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/article-editing.spec.ts tests/e2e/article-review.spec.ts tests/e2e/publish-preparation.spec.ts
```

Expected: FAIL because the pages still define static builders.

- [ ] **Step 3: Create runtime page data helpers**

Create `src/services/runtimePageData.ts`:

```ts
import type { ArticleDetail } from "../domain/article.ts";
import type { ArticleSource } from "../domain/source.ts";
import { canPreparePublish } from "./articleStatusService.ts";
import { ComplianceServiceImpl } from "./complianceService.ts";
import type { ReviewView } from "./contracts.ts";
import { getRuntimeContainerForApi } from "./runtimeContainer.ts";

export interface RuntimeEditPageData {
  detail: ArticleDetail;
  missingFields: string[];
  readOnly: boolean;
  sources: ArticleSource[];
}

export interface RuntimeReviewPageData {
  detail: ArticleDetail;
  checklist: ReviewView["checklist"];
  complianceReport: ReturnType<ComplianceServiceImpl["analyzeArticle"]>;
}

export interface RuntimePublishPageData {
  detail: ArticleDetail;
  canPublish: boolean;
}

const complianceService = new ComplianceServiceImpl();

export async function getRuntimeArticleDetail(articleId: string): Promise<ArticleDetail> {
  const runtime = await getRuntimeContainerForApi();
  return runtime.articleService.getArticleDetail(articleId);
}

export async function getRuntimeEditPageData(articleId: string): Promise<RuntimeEditPageData> {
  const detail = await getRuntimeArticleDetail(articleId);

  return {
    detail,
    missingFields: getMissingFields(detail),
    readOnly: detail.article.status === "pending_review",
    sources: []
  };
}

export async function getRuntimeReviewPageData(articleId: string): Promise<RuntimeReviewPageData> {
  const runtime = await getRuntimeContainerForApi();
  const reviewView = await runtime.reviewService.getReviewView(articleId);
  const detail = await runtime.articleService.getArticleDetail(articleId);

  return {
    detail,
    checklist: reviewView.checklist,
    complianceReport: reviewView.complianceReport ?? complianceService.analyzeArticle(detail.article)
  };
}

export async function getRuntimePublishPageData(articleId: string): Promise<RuntimePublishPageData> {
  const detail = await getRuntimeArticleDetail(articleId);
  const reviewMatchesCurrentContent = detail.article.reviewedVersion === detail.article.contentVersion;

  return {
    detail,
    canPublish: canPreparePublish(detail.article.status) && reviewMatchesCurrentContent
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
```

- [ ] **Step 4: Replace edit page static builders**

In `src/app/articles/[articleId]/edit/page.tsx`, keep component imports and replace the static builder code with:

```ts
import { getRuntimeEditPageData } from "../../../../services/runtimePageData.ts";
```

Change the page component to async:

```ts
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
```

Remove the now-unused imports for `Article`, `ArticleDetail`, `ArticleImage`, `ReviewRecord`, and `ArticleSource`.

- [ ] **Step 5: Replace review page static builders**

In `src/app/articles/[articleId]/review/page.tsx`, remove local builder functions and import:

```ts
import { getRuntimeReviewPageData } from "../../../../services/runtimePageData.ts";
```

Change the page component to async:

```ts
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
```

- [ ] **Step 6: Replace publish page static builders**

In `src/app/articles/[articleId]/publish/page.tsx`, remove local builder functions and import:

```ts
import { getRuntimePublishPageData } from "../../../../services/runtimePageData.ts";
```

Change the page component to async:

```ts
export default async function PublishArticlePage({ params }: PublishArticlePageProps) {
  const { detail, canPublish } = await getRuntimePublishPageData(params.articleId);

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
          <SchedulePanel article={detail.article} canSchedule={canPublish} />
        </div>
        <ArticlePreview article={detail.article} images={detail.images} />
      </div>
    </main>
  );
}
```

Remove `nextSchedule` from publish page props for Phase 9. Scheduling remains Phase 8 demo functionality outside the creation path.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npm run test:e2e -- tests/e2e/article-editing.spec.ts tests/e2e/article-review.spec.ts tests/e2e/publish-preparation.spec.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit runtime-backed pages**

```bash
git add src/services/runtimePageData.ts src/app/articles/[articleId]/edit/page.tsx src/app/articles/[articleId]/review/page.tsx src/app/articles/[articleId]/publish/page.tsx tests/e2e/article-editing.spec.ts tests/e2e/article-review.spec.ts tests/e2e/publish-preparation.spec.ts
git commit -m "feat: load creator pages from runtime"
```

## Task 5: Client Actions for Edit, Review, and Publish Preparation

**Files:**
- Modify: `src/components/article/ArticleEditor.tsx`
- Modify: `src/components/review/ReviewPanel.tsx`
- Modify: `src/components/publish/PublishPreparationPanel.tsx`
- Test: `tests/e2e/article-editing.spec.ts`
- Test: `tests/e2e/article-review.spec.ts`
- Test: `tests/e2e/publish-preparation.spec.ts`

- [ ] **Step 1: Add source assertions for API-backed actions**

In `tests/e2e/article-editing.spec.ts`, add:

```ts
  it("saves and submits review through article API endpoints", async () => {
    const editorSource = await readRequiredSource(articleEditorPath);

    assertMatches(editorSource, /fetch\(`\/api\/articles\/\$\{article\.id\}\/content`/, "editor should save through the content API");
    assertMatches(editorSource, /fetch\(`\/api\/articles\/\$\{article\.id\}\/review-submission`/, "editor should submit review through the review submission API");
    assertMatches(editorSource, /role="alert"/, "editor should display API errors inline");
  });
```

In `tests/e2e/article-review.spec.ts`, add:

```ts
  it("submits review decisions through the review API", async () => {
    const panelSource = await readRequiredSource(reviewPanelPath);

    assertMatches(panelSource, /fetch\(`\/api\/articles\/\$\{article\.id\}\/review`/, "review panel should call the review API");
    assertMatches(panelSource, /window\.location\.assign\(`\/articles\/\$\{article\.id\}\/publish`/, "approved reviews should move to publish preparation");
    assertMatches(panelSource, /role="alert"/, "review panel should display API errors inline");
  });
```

In `tests/e2e/publish-preparation.spec.ts`, add:

```ts
  it("creates publish preparation through the publish preparation API", async () => {
    const panelSource = await readRequiredSource(publishPanelPath);

    assertMatches(panelSource, /fetch\(`\/api\/articles\/\$\{article\.id\}\/publish-preparation`/, "publish panel should call the publish preparation API");
    assertMatches(panelSource, /生成发布准备|preparePublish/i, "publish panel should expose a publish preparation action");
    assertMatches(panelSource, /window\.location\.reload\(\)/, "publish panel should refresh after preparation succeeds");
    assertMatches(panelSource, /role="alert"/, "publish panel should display API errors inline");
  });
```

- [ ] **Step 2: Run E2E source tests to verify failure**

Run:

```bash
npm run test:e2e -- tests/e2e/article-editing.spec.ts tests/e2e/article-review.spec.ts tests/e2e/publish-preparation.spec.ts
```

Expected: FAIL because the components still render passive forms.

- [ ] **Step 3: Make ArticleEditor submit API actions**

At the top of `src/components/article/ArticleEditor.tsx`, add:

```ts
"use client";

import { type FormEvent, useState } from "react";
```

Inside the component, before `return`, add:

```ts
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
```

Change the form opening tag:

```tsx
      <form onSubmit={handleSave} style={{ display: "grid", gap: 16, marginTop: 20 }}>
```

Change the save button label:

```tsx
            {isSaving ? "保存中..." : "保存内容"}
```

Change the review button:

```tsx
            onClick={handleSubmitReview}
            disabled={formReadOnly || missingFields.length > 0 || isSubmittingReview}
```

and its label:

```tsx
            {isSubmittingReview ? "提交中..." : "提交 review"}
```

Add an inline alert before the action buttons:

```tsx
        {errorMessage ? (
          <div role="alert" style={{ background: "#fff5f5", border: "1px solid #ffd6d6", borderRadius: 8, color: "#9b1c1c", padding: 12 }}>
            {errorMessage}
          </div>
        ) : null}
```

Add the helper at the bottom of the file:

```ts
async function assertApiSuccess(response: Response): Promise<void> {
  if (response.ok) return;

  const body = await response.json().catch(() => undefined) as { error?: { message?: string } } | undefined;
  throw new Error(body?.error?.message ?? "请求失败，请重试。");
}
```

- [ ] **Step 4: Make ReviewPanel submit API decisions**

At the top of `src/components/review/ReviewPanel.tsx`, add:

```ts
"use client";

import { type FormEvent, useState } from "react";
```

Inside the component, before `return`, add:

```ts
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
```

Add `onSubmit={handleReviewSubmit}` to all three review forms. Add this alert after the paragraph explaining review mode:

```tsx
      {errorMessage ? (
        <div role="alert" style={{ background: "#fff5f5", border: "1px solid #ffd6d6", borderRadius: 8, color: "#9b1c1c", marginTop: 14, padding: 12 }}>
          {errorMessage}
        </div>
      ) : null}
```

Disable buttons when `submittingResult` is set and label approved button as:

```tsx
            {submittingResult === "approved" ? "提交中..." : "通过"}
```

Add the same `assertApiSuccess` helper used in `ArticleEditor`.

- [ ] **Step 5: Make PublishPreparationPanel create publish preparation**

At the top of `src/components/publish/PublishPreparationPanel.tsx`, add:

```ts
"use client";

import { type FormEvent, useState } from "react";
```

Inside the component, before `return`, add:

```ts
  const [errorMessage, setErrorMessage] = useState("");
  const [isPreparing, setIsPreparing] = useState(false);

  async function handlePreparePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (publishBlocked || isPreparing) return;

    setIsPreparing(true);
    setErrorMessage("");

    try {
      const response = await fetch(`/api/articles/${article.id}/publish-preparation`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          channel: "wechat_manual"
        })
      });

      await assertApiSuccess(response);
      window.location.reload();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "生成发布准备失败，请重试。");
    } finally {
      setIsPreparing(false);
    }
  }
```

After the latest publish note, add:

```tsx
      {errorMessage ? (
        <div role="alert" style={{ background: "#fff5f5", border: "1px solid #ffd6d6", borderRadius: 8, color: "#9b1c1c", marginTop: 14, padding: 12 }}>
          {errorMessage}
        </div>
      ) : null}

      <form onSubmit={handlePreparePublish} style={{ display: "grid", gap: 10, marginTop: 16 }}>
        <input name="channel" type="hidden" value="wechat_manual" />
        <button disabled={publishBlocked || isPreparing} style={getButtonStyle(publishBlocked || isPreparing, "#0f766e")} type="submit">
          {isPreparing ? "生成中..." : "生成发布准备"}
        </button>
      </form>
```

Add the same `assertApiSuccess` helper used in `ArticleEditor`.

- [ ] **Step 6: Run focused E2E source tests**

Run:

```bash
npm run test:e2e -- tests/e2e/article-editing.spec.ts tests/e2e/article-review.spec.ts tests/e2e/publish-preparation.spec.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit client actions**

```bash
git add src/components/article/ArticleEditor.tsx src/components/review/ReviewPanel.tsx src/components/publish/PublishPreparationPanel.tsx tests/e2e/article-editing.spec.ts tests/e2e/article-review.spec.ts tests/e2e/publish-preparation.spec.ts
git commit -m "feat: wire creator workflow actions to api"
```

## Task 6: Phase 9 Build Baseline and Documentation

**Files:**
- Modify: `scripts/build.mjs`
- Modify: `docs/开发计划/Phase开发计划-多AI并行.md`
- Test: full project verification

- [ ] **Step 1: Add Phase 9 files to the build baseline**

In `scripts/build.mjs`, add these paths to `requiredFiles`:

```js
  "src/services/runtimePersistence.ts",
  "src/services/runtimePageData.ts",
  "tests/integration/runtime-persistence.test.ts",
  "docs/superpowers/specs/2026-05-24-phase-9-local-runtime-design.md",
  "docs/superpowers/plans/2026-05-24-phase-9-local-runtime.md",
```

- [ ] **Step 2: Add Phase 9 to the development plan**

In `docs/开发计划/Phase开发计划-多AI并行.md`, after Phase 8, add:

```md
## Phase 9：本地真实运行闭环

### 目标

将创作主链路从静态演示推进到本地可运行闭环：创建、生成、编辑、提交 review、审核通过和发布准备均通过 API Runtime 执行，并写入本地 JSON 快照。

### 依赖

Phase 8 完成并合入 `main`，且 `phase-8-complete` tag 已推送。

### 可并行工作包

| Worker | 写入边界 | 说明 |
| --- | --- | --- |
| AI-9A Runtime 持久化 | `src/services/runtimePersistence.ts`、`src/services/runtimeContainer.ts`、`tests/integration/runtime-persistence.test.ts` | Runtime 启动加载 JSON 快照，mutation 后保存 |
| AI-9B API mutation 收敛 | `src/app/api/articles/**`、`tests/integration/api-runtime.test.ts` | API route 使用 async runtime 并保存成功 mutation |
| AI-9C 创建与编辑页面接入 | `src/components/article/GenerationForm.tsx`、`src/components/article/ArticleEditor.tsx`、`src/app/articles/[articleId]/edit/page.tsx` | 创建、生成、保存、提交 review 接 API |
| AI-9D Review 与发布准备页面接入 | `src/app/articles/[articleId]/review/page.tsx`、`src/components/review/ReviewPanel.tsx`、`src/app/articles/[articleId]/publish/page.tsx`、`src/components/publish/PublishPreparationPanel.tsx` | 审核和发布准备接 API |

### Phase 9 集成验证

- [ ] 运行 `npm test`，预期通过。
- [ ] 运行 `npm run test:e2e`，预期通过。
- [ ] 运行 `npm run typecheck`，预期通过。
- [ ] 运行 `npm run build`，预期通过。
```

- [ ] **Step 3: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run typecheck
npm run build
```

Expected:

- `npm test`: all unit and integration tests pass, including `runtime-persistence.test.ts`.
- `npm run test:e2e`: all E2E source tests pass.
- `npm run typecheck`: exits 0.
- `npm run build`: prints `Project build baseline verified`.

- [ ] **Step 4: Mark Phase 9 verification complete**

After all commands pass, update the Phase 9 checklist in `docs/开发计划/Phase开发计划-多AI并行.md`:

```md
- [x] 运行 `npm test`，预期通过。
- [x] 运行 `npm run test:e2e`，预期通过。
- [x] 运行 `npm run typecheck`，预期通过。
- [x] 运行 `npm run build`，预期通过。
```

- [ ] **Step 5: Commit Phase 9 integration baseline**

```bash
git add scripts/build.mjs docs/开发计划/Phase开发计划-多AI并行.md
git commit -m "build: include phase 9 files in baseline check"
```

## Self-Review

- Spec coverage: runtime persistence is covered by Tasks 1 and 2; page data loading is covered by Task 4; client form actions are covered by Task 5; verification and documentation are covered by Task 6.
- Scope control: this plan does not add real OpenAI calls, real WeChat calls, production database migration, multi-user sessions, or live data for every management page.
- Type consistency: runtime helpers are named `getRuntimeContainerForApi`, `runRuntimeMutation`, `createRuntimeContainerFromPersistence`, and `createFileRuntimePersistence` consistently across tasks.
- Verification: each task has a focused test command and commit point; final verification runs the full project command set.
