# Phase 9 Local Runtime Design

## Goal

Phase 9 turns the creator workflow from a static demonstration into a local, restart-safe workflow:

1. Create an article from the generation page.
2. Generate deterministic draft content without external AI calls.
3. Edit and save article content through the API runtime.
4. Submit the article for review.
5. Approve the review.
6. Prepare the article for manual WeChat publishing.
7. Persist the full state to a local JSON snapshot so the article is still available after runtime reinitialization.

## Scope

Phase 9 focuses on the creation path only. The included route sequence is:

- `/articles/new`
- `/articles/[articleId]/edit`
- `/articles/[articleId]/review`
- `/articles/[articleId]/publish`
- `/api/articles/**`

The work includes API/runtime persistence, page data loading, client-side form actions, and tests that prove the local end-to-end path works.

The work does not include real OpenAI calls, real WeChat API calls, multi-user sessions, production database migration, or replacing every management page with live data. Workbench, history, schedule, and audit can keep their current demo surfaces unless they are needed for links in the creator workflow.

## Current State

Phase 8 added the required building blocks:

- `src/services/runtimeContainer.ts` creates a process-local runtime with in-memory repositories.
- `src/app/api/**` exposes article creation, generation, editing, review, and publish-preparation routes.
- `src/repositories/persistence.ts` can export/import repository snapshots.
- `src/repositories/fileStore.ts` can save/load JSON snapshots.
- The article creation page already posts to an API endpoint.

The main gap is that the runtime does not use the file persistence layer, and the edit/review/publish pages still build static fixture data inside each page file.

## Recommended Architecture

Phase 9 should keep the existing service/repository layering and add a small runtime persistence boundary around it.

### Runtime Container

`runtimeContainer` should expose a container backed by a shared `MemoryRepositoryStore`. On initialization it should:

- Resolve a snapshot path from configuration.
- Load a `RepositoryPersistenceSnapshot` when the file exists.
- Create repositories against the loaded store.
- Use `createRepositoryIdFactory(store)` so IDs continue after reload.
- Fall back to an empty memory store when the snapshot file does not exist.

On successful mutation, API routes should save the current store back to the snapshot file. Mutations in scope are article creation, generation, content save, review submission, review decision, and publish preparation.

The default local snapshot path should be `data/pusher-runtime.json`. A test-only or local override should be possible through an environment variable such as `PUSHER_RUNTIME_SNAPSHOT_PATH`.

### Deterministic External Adapters

The existing deterministic text generation adapter remains the default. It should continue to generate title, summary, body, risk note, and image suggestions without network calls.

WeChat draft creation remains out of scope for this phase. Publish preparation should continue to produce manual publish content through `wechat_manual`; no real WeChat credentials are required.

### API Boundary

The existing API routes remain the main boundary for client interactions. They should return stable JSON envelopes:

- Success: `{ data: ... }`
- Failure: `{ error: { code, message } }`

Where current route output is too small for page transitions, add only the fields needed by the page. Avoid adding a broad generic API framework.

The detail route should remain the source for article detail:

- article
- images
- latestReview
- latestPublish

Review and publish pages can derive checklist, compliance report, and publish eligibility from this detail data plus existing services.

### Page Data Flow

`/articles/new` continues as a client form. It should:

- POST article creation.
- POST generation for the created article.
- Redirect to `/articles/{articleId}/edit`.

`/articles/[articleId]/edit` should load real detail data instead of static builders. It should render the existing editor, sources, image panel, and preview. The editor form should call:

- `PATCH /api/articles/{articleId}/content` for save.
- `POST /api/articles/{articleId}/review-submission` for submit review.

After submit review, redirect to `/articles/{articleId}/review`.

`/articles/[articleId]/review` should load real detail data. The review controls should call:

- `POST /api/articles/{articleId}/review` with `approved`.
- `POST /api/articles/{articleId}/review` with `rejected`.
- `POST /api/articles/{articleId}/review` with `not_publish`.

After approval, redirect to `/articles/{articleId}/publish`.

`/articles/[articleId]/publish` should load real detail data. The publish preparation control should call:

- `POST /api/articles/{articleId}/publish-preparation`.

After success, refresh the current publish page so the prepared export content and article status are visible.

## Error Handling

API errors should remain structured and stable. Client forms should display the returned `error.message` in an inline `role="alert"` region.

Expected local errors include:

- Missing article.
- Invalid lifecycle transition.
- Missing title/body/image before review submission.
- Stale review version before publish preparation.
- Invalid JSON or file write failure in runtime persistence.

Persistence failures should cause the mutation response to fail rather than silently accepting a state change that cannot be saved. Tests should cover this behavior through an injected failing snapshot store or invalid path where practical.

## Testing

Phase 9 needs tests at three levels:

1. Runtime persistence integration:
   - Create and mutate an article through API routes.
   - Save the runtime snapshot.
   - Reset/recreate the runtime from the same snapshot path.
   - Read the article and assert the status/content are preserved.

2. Creator workflow E2E source tests:
   - Assert the edit/review/publish pages no longer contain static fixture builders such as `buildArticle`.
   - Assert the pages call the expected API endpoints.
   - Assert forms expose status/error surfaces for save, review, and publish preparation.

3. Full project verification:
   - `npm test`
   - `npm run test:e2e`
   - `npm run typecheck`
   - `npm run build`

## Migration and Rollback

This phase stores local data in a JSON snapshot file. The file is local runtime data and should not be committed. If the runtime snapshot is deleted, the app starts from an empty store.

Rollback is straightforward:

- Revert the Phase 9 commits.
- Delete `data/pusher-runtime.json` if a local test snapshot should be discarded.
- Return to Phase 8 behavior where runtime state is process-local memory.

## Acceptance Criteria

Phase 9 is complete when:

- The creation, generation, edit, review, and publish-preparation path can run through API-backed pages.
- Runtime state is saved to a local JSON snapshot after successful mutations.
- Recreating the runtime from the same snapshot preserves article content, status, images, reviews, and publish preparation records.
- The implementation has no dependency on real OpenAI, WeChat, or other network services.
- All project verification commands pass.
