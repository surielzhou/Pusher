# Phase 10 Browser Runtime Design

## Goal

Phase 10 turns the Phase 9 API-backed local workflow into a browser-runnable local application. The target user should be able to run the app locally, open it in a browser, and complete the creator workflow without relying on external AI, WeChat, or network services.

The primary browser path is:

1. Open `/articles/new`.
2. Create an article from generation settings.
3. Generate deterministic draft content.
4. Edit and save title, summary, and body.
5. Submit the article for review.
6. Approve the review.
7. Generate manual WeChat publish preparation.
8. See the prepared publish content on the publish page.

## Scope

Phase 10 includes:

- Installing the minimal runtime dependencies needed for the existing App Router-style source to run through Next.js.
- Replacing placeholder `dev`, `start`, and build behavior with a real local Next runtime.
- Keeping the existing API routes, runtime persistence boundary, server page data helpers, and client component actions.
- Adding browser-level Playwright coverage for the creator workflow.
- Using an isolated runtime snapshot path for browser tests so local data is not polluted.

Phase 10 does not include:

- Redesigning the UI.
- Adding new business features.
- Replacing Phase 8 demo surfaces for workbench, history, schedule, or audit with live data.
- Calling real OpenAI, WeChat, or other external services.
- Production deployment packaging, database migration, or cloud hosting.

## Architecture

The app should use Next.js as the local runtime because the current source already follows Next App Router conventions:

- `src/app/**/page.tsx` server page modules.
- `src/app/api/**/route.ts` route handlers.
- `"use client"` components for browser-side form actions.

`package.json` should move from placeholder scripts to real runtime scripts:

- `dev`: run `next dev`.
- `start`: run `next start`.
- `build`: run `next build` and then the existing `scripts/build.mjs` baseline check.

The existing `scripts/build.mjs` remains a project baseline check and should include the Phase 10 design, plan, and browser test files once those files exist.

Runtime state remains owned by Phase 9 services:

- `src/services/runtimeContainer.ts` initializes the service graph.
- `src/services/runtimePersistence.ts` loads and saves JSON snapshots.
- `src/services/runtimePageData.ts` loads page data for edit, review, and publish pages.
- API routes persist successful mutations.

No service should bypass the existing domain or service layer to satisfy browser tests.

## Data Flow

The browser workflow should reuse the Phase 9 API boundary:

- `/articles/new` renders `GenerationForm`.
- `GenerationForm` calls `POST /api/articles` to create a draft article.
- `GenerationForm` calls `POST /api/articles/{articleId}/generate` to generate content.
- The browser navigates to `/articles/{articleId}/edit`.
- `ArticleEditor` calls `PATCH /api/articles/{articleId}/content` to save edits.
- `ArticleEditor` calls `POST /api/articles/{articleId}/review-submission` to submit review.
- The browser navigates to `/articles/{articleId}/review`.
- `ReviewPanel` calls `POST /api/articles/{articleId}/review` with `approved`.
- The browser navigates to `/articles/{articleId}/publish`.
- `PublishPreparationPanel` calls `POST /api/articles/{articleId}/publish-preparation`.
- The publish page refreshes and displays the prepared manual WeChat content.

Browser tests should set `PUSHER_RUNTIME_SNAPSHOT_PATH` to a temporary JSON file. Each test run should start with a clean snapshot path and remove temporary files when possible.

## Error Handling

Client forms should continue to display API failures in inline `role="alert"` regions. Phase 10 should not introduce a new error framework.

Expected local runtime errors include:

- Next compilation errors from server/client module boundaries.
- API route failures from invalid lifecycle transitions.
- Runtime snapshot read/write failures.
- Browser test startup failures when the dev server cannot bind to a port.

The browser test should fail on visible workflow blockers rather than silently passing through source inspection.

## Testing

Phase 10 keeps the existing test layers:

- `npm test`: unit and integration tests.
- `npm run test:e2e`: source-level E2E contract tests.
- `npm run typecheck`: TypeScript checks.
- `npm run build`: Next build plus project baseline check.

Phase 10 adds:

- `npm run test:browser`: Playwright browser workflow tests.

The browser test should verify at least:

- The new article page loads in a real browser.
- Creating and generating an article navigates to edit.
- Saving content succeeds and keeps edited text visible after reload or navigation.
- Submitting review navigates to review.
- Approving review navigates to publish.
- Generating publish preparation shows prepared/manual WeChat content.
- The runtime snapshot exists after the workflow and contains article, image, review, and publish data.

Browser tests should prefer user-visible selectors and form labels. If current markup does not expose stable accessible labels for a required action, Phase 10 may add minimal accessibility attributes or labels, but it should not redesign the UI.

## Acceptance Criteria

Phase 10 is complete when:

- `npm run dev` starts a real local Next application.
- `npm start` starts a built local Next application after `npm run build`.
- `npm run build` completes Next build and project baseline verification.
- `npm run test:browser` completes the creator workflow in a real browser with an isolated JSON snapshot.
- Existing verification commands still pass:
  - `npm test`
  - `npm run test:e2e`
  - `npm run typecheck`
  - `npm run build`
- No real OpenAI, WeChat, or network service is required for local browser acceptance.

## Migration And Rollback

Phase 10 changes the JavaScript runtime dependencies and script behavior. Rollback is straightforward:

1. Revert the Phase 10 commits.
2. Run `npm install` if dependency files changed.
3. Delete local browser test snapshots under temporary directories or `data/pusher-runtime.json` if manual runtime data should be reset.
4. Return to the Phase 9 tag `phase-9-complete` if a stable baseline is needed.

## Follow-Up Work

Recommended follow-up after Phase 10:

- Add a Phase 10 local browser acceptance record under `docs/部署验收/`.
- Decide whether workbench, history, schedule, and audit should be converted from demo surfaces to live runtime data.
- Decide whether production deployment packaging should become Phase 11.
