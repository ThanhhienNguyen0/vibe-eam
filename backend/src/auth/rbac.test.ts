import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import request from "supertest";
import jwt from "jsonwebtoken";
import { Role as DatabaseRole } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../server.js";
import type { AuthRepository, StoredUser, UserRepository } from "./authTypes.js";
import { permits, ROLES } from "./policy.js";
import { ROUTE_POLICIES, resolvePolicy } from "./routePolicies.js";

vi.mock("../Sidebar/sidebarStore.js", async (original) => ({
  ...await original<typeof import("../Sidebar/sidebarStore.js")>(),
  getComponents: vi.fn(async () => []),
  addComponent: vi.fn(async (input: unknown) => input),
  addComponentType: vi.fn(async (input: unknown) => input)
}));

const secret = "req24-test-only-signing-secret-at-least-32-characters";
const token = (subject: string, claims: object = {}) => jwt.sign(claims, secret, { subject, issuer: "eam-tool", audience: "eam-tool", expiresIn: "8h" });
function fixture() {
  const users = ROLES.map((role): StoredUser => ({ id: role, role, companyId: "company-a", companyName: "Test", email: `${role}@example.invalid`, name: null, passwordHash: "unused" }));
  const repository: AuthRepository = {
    createCompanyUser: vi.fn(), findUserByEmail: vi.fn(),
    findUserById: async (id) => users.find((user) => user.id === id) ?? null
  };
  const administration: UserRepository = { listCompanyUsers: vi.fn(async () => []), createLocalUser: vi.fn(), changeRole: vi.fn() };
  const app = createApp({ jwtSecret: secret, authRepository: repository, userRepository: administration });
  return { users, repository, app };
}

describe("RBAC policy and HTTP enforcement", () => {
  it("keeps the database enum and internal vocabulary aligned", () => {
    expect(Object.values(DatabaseRole)).toEqual([...ROLES]);
  });
  it.each(ROLES)("applies the %s matrix to actual representative routes", async (role) => {
    const { app } = fixture();
    const bearer = `Bearer ${token(role)}`;
    expect((await request(app).get("/api/sidebar/components").set("Authorization", bearer)).status).toBe(200);
    const architecture = await request(app).post("/api/sidebar/components").set("Authorization", bearer).send({ name: "Component", componentTypeId: "type" });
    expect(architecture.status).toBe(role === "Viewer" ? 403 : 201);
    const metamodel = await request(app).post("/api/sidebar/component-types").set("Authorization", bearer).send({ name: "Type", color: "#fff", icon: "app" });
    expect(metamodel.status).toBe(role === "Admin" ? 201 : 403);
    expect((await request(app).get("/api/users").set("Authorization", bearer)).status).toBe(role === "Admin" ? 200 : 403);
  });

  it("denies every protected inventory route without authentication and every Viewer domain write", async () => {
    const { app } = fixture();
    for (const policy of ROUTE_POLICIES.filter((item) => item.permission !== "public")) {
      const url = policy.path.replace(":id", "some-id");
      const method = policy.method.toLowerCase() as "get" | "post" | "patch" | "delete";
      expect((await request(app)[method](url)).status, `${policy.method} ${url}`).toBe(401);
      if (policy.method !== "GET" && policy.path !== "/api/auth/logout") {
        expect((await request(app)[method](url).set("Authorization", `Bearer ${token("Viewer")}`).send({})).status, `${policy.method} ${url}`).toBe(403);
      }
      if (policy.permission === "metamodel:write" || policy.permission === "users:manage") {
        expect((await request(app)[method](url).set("Authorization", `Bearer ${token("Architect")}`).send({})).status).toBe(403);
      }
    }
  });

  it("uses the current database role immediately, ignoring privilege claims in existing tokens", async () => {
    const { app, users } = fixture();
    const existing = token("Admin", { role: "Admin", companyId: "company-a" });
    expect((await request(app).get("/api/users").set("Authorization", `Bearer ${existing}`)).status).toBe(200);
    users[0].role = "Viewer";
    expect((await request(app).get("/api/users").set("Authorization", `Bearer ${existing}`)).status).toBe(403);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${existing}`)).body.role).toBe("Viewer");
    expect((await request(app).post("/api/sidebar/components").set("Authorization", `Bearer ${token("Viewer", { role: "Admin" })}`).send({})).status).toBe(403);
  });

  it.each([undefined, null, "member", "root", "__proto__"])("fails closed for invalid stored role %s", async (role) => {
    const { app, users } = fixture();
    Object.assign(users[0], { role });
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token("Admin")}`)).status).toBe(403);
    expect(permits(role, "read")).toBe(false);
  });

  it("distinguishes invalid authentication, forbidden actions, policy errors and backend failures", async () => {
    const { app, repository } = fixture();
    for (const invalid of ["broken", token("missing-user"), token("Admin", { companyId: "another-company" }), jwt.sign({}, secret, { subject: "Admin", issuer: "eam-tool", audience: "eam-tool", expiresIn: -1 }), jwt.sign({}, secret, { subject: "Admin", issuer: "eam-tool", audience: "eam-tool" })]) {
      expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${invalid}`)).status).toBe(401);
    }
    expect(permits("Admin", "undefined:permission")).toBe(false);
    expect(permits("__proto__", "read")).toBe(false);
    app.post("/api/new-unclassified-write", (_req, res) => res.sendStatus(201));
    expect((await request(app).post("/api/new-unclassified-write").set("Authorization", `Bearer ${token("Admin")}`)).status).toBe(403);
    repository.findUserById = async () => { throw new Error("database unavailable"); };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token("Admin")}`)).status).toBe(500);
    log.mockRestore();
  });
});

describe("complete route inventory", () => {
  interface Layer { route?: { path: string; methods: Record<string, boolean> }; handle?: { stack?: Layer[] }; regexp: RegExp }
  function inventory(app: ReturnType<typeof createApp>): string[] {
    const layers = (app as unknown as { _router: { stack: Layer[] } })._router.stack;
    const result: string[] = [];
    function walk(stack: Layer[], prefix = "") {
      for (const layer of stack) {
        if (layer.route) {
          for (const method of Object.keys(layer.route.methods)) {
            result.push(`${method.toUpperCase()} ${(prefix + layer.route.path).replace(/\/$/, "")}`);
          }
        } else if (layer.handle?.stack) {
          const mount = ["/api/auth", "/api/sidebar", "/api/users"].find((value) => layer.regexp.test(value) && layer.regexp.test(`${value}/probe`));
          if (!mount) throw new Error(`Uninventoried router mount: ${layer.regexp}`);
          walk(layer.handle.stack, prefix + mount);
        }
      }
    }
    walk(layers);
    return result.sort();
  }
  it("matches every actual GET/POST/PUT/PATCH/DELETE registration exactly, without orphan policies", () => {
    const { app } = fixture();
    expect(inventory(app)).toEqual(ROUTE_POLICIES.map((item) => `${item.method} ${item.path}`).sort());
    expect(new Set(ROUTE_POLICIES.map((item) => `${item.method} ${item.path}`)).size).toBe(ROUTE_POLICIES.length);
    app.put("/api/future", (_req, res) => res.sendStatus(200));
    expect(inventory(app)).not.toEqual(ROUTE_POLICIES.map((item) => `${item.method} ${item.path}`).sort());
    expect(resolvePolicy("PUT", "/api/future")).toBeUndefined();
  });

  it("does not permit route registrations outside the guarded application and inventoried routers", async () => {
    async function files(directory: string): Promise<string[]> {
      return (await Promise.all((await readdir(directory, { withFileTypes: true })).map((item) => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]))).flat();
    }
    const allowed = ["server.ts", "authRoutes.ts", "userRoutes.ts", "sidebarRoutes.ts"];
    for (const file of (await files(path.resolve("src"))).filter((name) => name.endsWith(".ts") && !name.endsWith(".test.ts"))) {
      if (/\b(?:app|router)\.(?:post|put|patch|delete|all|route)\s*\(/.test(await readFile(file, "utf8"))) {
        expect(allowed, file).toContain(path.basename(file));
      }
    }
  });
});
