export const USER_ROLES = ["creator", "reviewer", "publisher", "admin"] as const;

export type UserRole = (typeof USER_ROLES)[number];

const APP_PERMISSION_VALUES = [
  "article:create",
  "article:edit",
  "article:view_own",
  "article:view_all",
  "review:submit",
  "publish:prepare",
  "publish:mark_result",
  "admin:manage_users"
] as const;

export type AppPermission = (typeof APP_PERMISSION_VALUES)[number];

export const APP_PERMISSIONS: readonly AppPermission[] = Object.freeze([...APP_PERMISSION_VALUES]);

export interface AuthUser {
  id: string;
  displayName: string;
  roles: UserRole[];
  active: boolean;
}

export const ROLE_PERMISSION_MAP: Readonly<Record<UserRole, readonly AppPermission[]>> = Object.freeze({
  creator: freezePermissions(["article:create", "article:edit", "article:view_own"]),
  reviewer: freezePermissions(["article:view_all", "review:submit"]),
  publisher: freezePermissions(["article:view_all", "publish:prepare", "publish:mark_result"]),
  admin: APP_PERMISSIONS
});

function freezePermissions(permissions: AppPermission[]): readonly AppPermission[] {
  return Object.freeze(permissions);
}

export class PermissionDeniedError extends Error {
  readonly roles: UserRole[];
  readonly permission: AppPermission;

  constructor(roles: readonly UserRole[], permission: AppPermission) {
    super(`Permission denied for ${permission}`);
    this.name = "PermissionDeniedError";
    this.roles = [...roles];
    this.permission = permission;
  }
}

export function getPermissionsForRoles(roles: readonly UserRole[]): AppPermission[] {
  const permissions = new Set<AppPermission>();

  for (const role of roles) {
    for (const permission of ROLE_PERMISSION_MAP[role]) {
      permissions.add(permission);
    }
  }

  return [...permissions];
}

export function hasPermission(roles: readonly UserRole[], permission: AppPermission): boolean {
  return getPermissionsForRoles(roles).includes(permission);
}

export function requirePermission(roles: readonly UserRole[], permission: AppPermission): void {
  if (!hasPermission(roles, permission)) {
    throw new PermissionDeniedError(roles, permission);
  }
}
