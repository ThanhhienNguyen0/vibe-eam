import type { RequestHandler } from "express";
import { permits, type Permission } from "./policy.js";

export interface RoutePolicy { method: string; path: string; permission: Permission | "public" }
const route = (method: string, path: string, permission: RoutePolicy["permission"]): RoutePolicy => ({ method, path, permission });
const crud = (path: string, permission: Permission): RoutePolicy[] => [
  route("GET", path, "read"), route("POST", path, permission),
  route("PATCH", `${path}/:id`, permission), route("DELETE", `${path}/:id`, permission)
];

/** Exact inventory, deliberately no prefix/method fallback grants. New routes fail closed. */
export const ROUTE_POLICIES: readonly RoutePolicy[] = [
  route("GET", "/api/health", "public"),
  route("POST", "/api/auth/register", "public"), route("POST", "/api/auth/login", "public"),
  route("GET", "/api/auth/me", "read"), route("POST", "/api/auth/logout", "read"),
  route("GET", "/api/users", "users:manage"), route("POST", "/api/users", "users:manage"),
  route("PATCH", "/api/users/:id/role", "users:manage"),
  route("GET", "/api/sidebar", "read"),
  route("GET", "/api/sidebar/metamodel/export", "read"), route("GET", "/api/sidebar/metamodel/default", "read"),
  route("POST", "/api/sidebar/metamodel/import", "metamodel:write"),
  ...["component-types", "connection-types", "connection-rules", "viewpoints"].flatMap((name) => crud(`/api/sidebar/${name}`, "metamodel:write")),
  ...["components", "connections", "diagrams"].flatMap((name) => crud(`/api/sidebar/${name}`, "architecture:write")),
  route("POST", "/api/sidebar/diagrams/:id/connections", "architecture:write"),
  route("GET", "/api/sidebar/diagrams/:id", "read"), route("GET", "/api/sidebar/diagrams/:id/validate", "read"),
  route("GET", "/api/model", "read"), route("GET", "/api/model/export", "read"), route("GET", "/api/audit-log", "read"),
  route("POST", "/api/model/elements", "architecture:write"), route("PATCH", "/api/model/elements/:id", "architecture:write"),
  route("DELETE", "/api/model/elements/:id", "architecture:write"), route("POST", "/api/model/relations", "architecture:write"),
  route("DELETE", "/api/model/relations/:id", "architecture:write"), route("POST", "/api/model/import", "architecture:write")
];

export function resolvePolicy(method: string, path: string): RoutePolicy | undefined {
  const segments = path.replace(/\/$/, "").split("/");
  return ROUTE_POLICIES.find((policy) => {
    const expected = policy.path.split("/");
    return policy.method === (method === "HEAD" ? "GET" : method) && expected.length === segments.length &&
      expected.every((part, index) => part.startsWith(":") ? segments[index].length > 0 : part === segments[index]);
  });
}

export function apiSecurity(authenticate: RequestHandler): RequestHandler {
  return (req, res, next) => {
    const policy = resolvePolicy(req.method, req.path);
    if (policy?.permission === "public") return next();
    void authenticate(req, res, (error?: unknown) => {
      if (error) return next(error);
      if (!req.user || !policy || !permits(req.user.role, policy.permission)) {
        res.status(403).json({ error: "You do not have permission for this action." });
        return;
      }
      next();
    });
  };
}
