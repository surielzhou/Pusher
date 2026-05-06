import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  APP_PERMISSIONS,
  type AppPermission,
  PermissionDeniedError,
  ROLE_PERMISSION_MAP,
  getPermissionsForRoles,
  hasPermission,
  requirePermission
} from "../../../src/domain/permissions.ts";

describe("domain permissions", () => {
  it("assigns workflow permissions to creator, reviewer, publisher, and admin roles", () => {
    assert.deepEqual(ROLE_PERMISSION_MAP.creator, ["article:create", "article:edit", "article:view_own"]);
    assert.deepEqual(ROLE_PERMISSION_MAP.reviewer, ["article:view_all", "review:submit"]);
    assert.deepEqual(ROLE_PERMISSION_MAP.publisher, [
      "article:view_all",
      "publish:prepare",
      "publish:mark_result"
    ]);
    assert.deepEqual(ROLE_PERMISSION_MAP.admin, APP_PERMISSIONS);
  });

  it("merges permissions for users with multiple roles without exposing mutable state", () => {
    const permissions = getPermissionsForRoles(["creator", "reviewer", "creator"]);

    assert.deepEqual(permissions, [
      "article:create",
      "article:edit",
      "article:view_own",
      "article:view_all",
      "review:submit"
    ]);

    permissions.push("admin:manage_users");

    assert.deepEqual(getPermissionsForRoles(["creator"]), [
      "article:create",
      "article:edit",
      "article:view_own"
    ]);
  });

  it("does not expose mutable role permission definitions", () => {
    assert.throws(
      () => (ROLE_PERMISSION_MAP.creator as AppPermission[]).push("publish:prepare"),
      TypeError
    );
  });

  it("checks and requires specific permissions for a set of roles", () => {
    assert.equal(hasPermission(["publisher"], "publish:prepare"), true);
    assert.equal(hasPermission(["publisher"], "review:submit"), false);
    assert.equal(hasPermission(["admin"], "admin:manage_users"), true);

    assert.doesNotThrow(() => requirePermission(["reviewer"], "review:submit"));
    assert.throws(
      () => requirePermission(["creator"], "publish:prepare"),
      (error) => {
        assert.equal(error instanceof PermissionDeniedError, true);
        assert.deepEqual((error as PermissionDeniedError).roles, ["creator"]);
        assert.equal((error as PermissionDeniedError).permission, "publish:prepare");
        return true;
      }
    );
  });
});
