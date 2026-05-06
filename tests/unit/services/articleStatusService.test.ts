import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ArticleStatusTransitionError,
  assertTransition,
  canPreparePublish,
  getAllowedTransitionTargets,
  getStatusAfterContentChange,
  requiresReviewAfterContentChange,
  resolveStatusAfterContentChange
} from "../../../src/services/articleStatusService.ts";

describe("article status service", () => {
  it("returns allowed transition targets without exposing mutable state", () => {
    const targets = getAllowedTransitionTargets("pending_review");

    assert.deepEqual(targets, ["approved", "review_rejected", "not_publish"]);

    targets.push("published");

    assert.deepEqual(getAllowedTransitionTargets("pending_review"), [
      "approved",
      "review_rejected",
      "not_publish"
    ]);
  });

  it("allows the primary review-gated publish lifecycle", () => {
    assert.deepEqual(assertTransition("drafting", "editing"), {
      fromStatus: "drafting",
      toStatus: "editing"
    });
    assert.doesNotThrow(() => assertTransition("editing", "pending_review"));
    assert.doesNotThrow(() => assertTransition("pending_review", "approved"));
    assert.doesNotThrow(() => assertTransition("approved", "pending_publish"));
    assert.doesNotThrow(() => assertTransition("pending_publish", "published"));
  });

  it("throws a structured error for invalid transitions", () => {
    assert.throws(
      () => assertTransition("pending_review", "pending_publish"),
      (error) => {
        assert.equal(error instanceof ArticleStatusTransitionError, true);
        assert.equal((error as ArticleStatusTransitionError).fromStatus, "pending_review");
        assert.equal((error as ArticleStatusTransitionError).toStatus, "pending_publish");
        assert.deepEqual((error as ArticleStatusTransitionError).allowedTargets, [
          "approved",
          "review_rejected",
          "not_publish"
        ]);
        assert.deepEqual((error as ArticleStatusTransitionError).allowedTransitions, [
          "approved",
          "review_rejected",
          "not_publish"
        ]);
        return true;
      }
    );
  });

  it("guards publish preparation behind approved or pending publish states", () => {
    assert.equal(canPreparePublish("approved"), true);
    assert.equal(canPreparePublish("pending_publish"), true);
    assert.equal(canPreparePublish("pending_review"), false);
    assert.equal(canPreparePublish("review_rejected"), false);
    assert.equal(canPreparePublish("not_publish"), false);
  });

  it("moves editable content changes back to editing", () => {
    assert.equal(resolveStatusAfterContentChange("editing"), "editing");
    assert.equal(resolveStatusAfterContentChange("review_rejected"), "editing");
    assert.equal(resolveStatusAfterContentChange("not_publish"), "editing");
    assert.equal(resolveStatusAfterContentChange("approved"), "editing");
    assert.equal(resolveStatusAfterContentChange("pending_publish"), "editing");
    assert.equal(resolveStatusAfterContentChange("publish_failed"), "editing");
    assert.equal(getStatusAfterContentChange("approved"), "editing");
  });

  it("does not invent edit paths for immutable or non-content statuses", () => {
    assert.equal(resolveStatusAfterContentChange("drafting"), "drafting");
    assert.equal(resolveStatusAfterContentChange("pending_review"), "pending_review");
    assert.equal(resolveStatusAfterContentChange("published"), "published");
  });

  it("reports when content changes require another review", () => {
    assert.equal(requiresReviewAfterContentChange("approved"), true);
    assert.equal(requiresReviewAfterContentChange("pending_publish"), true);
    assert.equal(requiresReviewAfterContentChange("review_rejected"), true);
    assert.equal(requiresReviewAfterContentChange("editing"), false);
  });
});
