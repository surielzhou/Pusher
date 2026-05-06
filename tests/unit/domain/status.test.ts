import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ARTICLE_STATUSES,
  CONTENT_CATEGORIES,
  canTransition,
  getAllowedTransitions
} from "../../../src/domain/status.ts";
import { IMAGE_TYPES } from "../../../src/domain/image.ts";
import { REVIEW_RESULTS } from "../../../src/domain/review.ts";
import { PUBLISH_STATUSES } from "../../../src/domain/publish.ts";

describe("domain status contract", () => {
  it("defines the required content categories", () => {
    assert.deepEqual(CONTENT_CATEGORIES, ["tech_internet", "finance", "literature"]);
  });

  it("defines the complete article status set", () => {
    assert.deepEqual(ARTICLE_STATUSES, [
      "drafting",
      "generation_failed",
      "editing",
      "pending_review",
      "review_rejected",
      "approved",
      "not_publish",
      "pending_publish",
      "publish_failed",
      "published"
    ]);
  });

  it("defines image, review, and publish enum values", () => {
    assert.deepEqual(IMAGE_TYPES, ["suggestion", "generated", "uploaded", "material", "external"]);
    assert.deepEqual(REVIEW_RESULTS, ["approved", "rejected", "not_publish"]);
    assert.deepEqual(PUBLISH_STATUSES, ["prepared", "published", "failed"]);
  });

  it("allows the primary article lifecycle", () => {
    assert.equal(canTransition("drafting", "editing"), true);
    assert.equal(canTransition("editing", "pending_review"), true);
    assert.equal(canTransition("pending_review", "approved"), true);
    assert.equal(canTransition("approved", "pending_publish"), true);
    assert.equal(canTransition("pending_publish", "published"), true);
  });

  it("blocks publishing paths that bypass review approval", () => {
    assert.equal(canTransition("pending_review", "pending_publish"), false);
    assert.equal(canTransition("review_rejected", "pending_publish"), false);
    assert.equal(canTransition("not_publish", "pending_publish"), false);
  });

  it("reports allowed transitions for a status", () => {
    assert.deepEqual(getAllowedTransitions("pending_review"), [
      "approved",
      "review_rejected",
      "not_publish"
    ]);
  });
});
