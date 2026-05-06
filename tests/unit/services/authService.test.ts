import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { AuthUser } from "../../../src/domain/permissions.ts";
import { PermissionDeniedError } from "../../../src/domain/permissions.ts";
import {
  AuthServiceImpl,
  AuthUserDisabledError,
  AuthUserNotFoundError
} from "../../../src/services/authService.ts";

const seedUsers: AuthUser[] = [
  {
    id: "user_creator",
    displayName: "创作者",
    roles: ["creator"],
    active: true
  },
  {
    id: "user_review_publish",
    displayName: "审核发布",
    roles: ["reviewer", "publisher"],
    active: true
  },
  {
    id: "user_admin",
    displayName: "管理员",
    roles: ["admin"],
    active: true
  },
  {
    id: "user_disabled",
    displayName: "停用用户",
    roles: ["creator"],
    active: false
  }
];

function createService() {
  return new AuthServiceImpl({ users: seedUsers });
}

describe("auth service", () => {
  it("returns an active user session with merged permissions", async () => {
    const service = createService();

    const session = await service.getSession("user_review_publish");

    assert.equal(session.user.id, "user_review_publish");
    assert.deepEqual(session.user.roles, ["reviewer", "publisher"]);
    assert.deepEqual(session.permissions, [
      "article:view_all",
      "review:submit",
      "publish:prepare",
      "publish:mark_result"
    ]);
  });

  it("authorizes users by role permissions and rejects missing permissions", async () => {
    const service = createService();

    assert.equal(await service.can({ userId: "user_creator", permission: "article:create" }), true);
    assert.equal(await service.can({ userId: "user_creator", permission: "publish:prepare" }), false);

    await assert.rejects(
      () => service.requirePermission({ userId: "user_creator", permission: "publish:prepare" }),
      (error) => {
        assert.equal(error instanceof PermissionDeniedError, true);
        assert.deepEqual((error as PermissionDeniedError).roles, ["creator"]);
        assert.equal((error as PermissionDeniedError).permission, "publish:prepare");
        return true;
      }
    );
  });

  it("lets administrators perform every defined permission", async () => {
    const service = createService();

    assert.equal(await service.can({ userId: "user_admin", permission: "review:submit" }), true);
    assert.equal(await service.can({ userId: "user_admin", permission: "admin:manage_users" }), true);
  });

  it("rejects unknown and disabled users before checking permissions", async () => {
    const service = createService();

    await assert.rejects(
      () => service.getSession("missing_user"),
      (error) => {
        assert.equal(error instanceof AuthUserNotFoundError, true);
        assert.equal((error as AuthUserNotFoundError).userId, "missing_user");
        return true;
      }
    );

    await assert.rejects(
      () => service.requirePermission({ userId: "user_disabled", permission: "article:create" }),
      (error) => {
        assert.equal(error instanceof AuthUserDisabledError, true);
        assert.equal((error as AuthUserDisabledError).userId, "user_disabled");
        return true;
      }
    );
  });
});
