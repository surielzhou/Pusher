import type { AppPermission, AuthUser } from "../domain/permissions.ts";
import {
  getPermissionsForRoles,
  requirePermission as requireDomainPermission
} from "../domain/permissions.ts";
import type { AuthService, AuthSession } from "./contracts.ts";

export interface AuthServiceDependencies {
  users: readonly AuthUser[];
}

export class AuthUserNotFoundError extends Error {
  readonly userId: string;

  constructor(userId: string) {
    super(`Auth user not found: ${userId}`);
    this.name = "AuthUserNotFoundError";
    this.userId = userId;
  }
}

export class AuthUserDisabledError extends Error {
  readonly userId: string;

  constructor(userId: string) {
    super(`Auth user disabled: ${userId}`);
    this.name = "AuthUserDisabledError";
    this.userId = userId;
  }
}

export class AuthServiceImpl implements AuthService {
  private readonly users: Map<string, AuthUser>;

  constructor(dependencies: AuthServiceDependencies) {
    this.users = new Map(dependencies.users.map((user) => [user.id, cloneUser(user)]));
  }

  async getSession(userId: string): Promise<AuthSession> {
    const user = this.getActiveUser(userId);

    return {
      user: cloneUser(user),
      permissions: getPermissionsForRoles(user.roles)
    };
  }

  async can(input: { userId: string; permission: AppPermission }): Promise<boolean> {
    const session = await this.getSession(input.userId);

    return session.permissions.includes(input.permission);
  }

  async requirePermission(input: { userId: string; permission: AppPermission }): Promise<AuthSession> {
    const session = await this.getSession(input.userId);
    requireDomainPermission(session.user.roles, input.permission);

    return session;
  }

  private getActiveUser(userId: string): AuthUser {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthUserNotFoundError(userId);
    }

    if (!user.active) {
      throw new AuthUserDisabledError(userId);
    }

    return user;
  }
}

function cloneUser(user: AuthUser): AuthUser {
  return {
    ...user,
    roles: [...user.roles]
  };
}
