/** Internal authorization vocabulary. Identity-provider claims never grant permissions. */
export const ROLES = ["Admin", "Architect", "Viewer"] as const;
export type Role = typeof ROLES[number];
export const PERMISSIONS = ["read", "architecture:write", "metamodel:write", "users:manage"] as const;
export type Permission = typeof PERMISSIONS[number];

const grants: Record<Role, readonly Permission[]> = {
  Admin: PERMISSIONS,
  Architect: ["read", "architecture:write"],
  Viewer: ["read"]
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && ROLES.some((role) => role === value);
}

export function permits(role: unknown, permission: unknown): boolean {
  return isRole(role) && grants[role].some((grant) => grant === permission);
}
