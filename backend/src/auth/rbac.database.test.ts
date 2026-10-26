import { execFileSync, spawnSync } from "node:child_process";
import { readFile, readdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../server.js";
import { PrismaAuthRepository } from "./prismaAuthRepository.js";
import { demoCredentials, DEMO_EMAILS } from "./demoSeed.js";
import { ROLES, type Role } from "./policy.js";
import { DEFAULT_COMPANY_ID } from "../tenant.js";

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith("/req24_test_")) throw new Error("Only isolated req24_test_ databases are permitted.");
const secret = "req24-database-test-only-signing-secret-32-characters";
const prisma = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const repository = new PrismaAuthRepository(prisma);
const app = createApp({ jwtSecret: secret, authRepository: repository, userRepository: repository });
const password = "req24-local-test-only-password";
afterAll(async () => prisma.$disconnect());

async function company() {
  const email = `${randomUUID()}@example.invalid`;
  const result = await request(app).post("/api/auth/register").send({ email, password, companyName: `REQ24 Test ${email}`, role: "Viewer", companyId: "ignored" });
  expect(result.status).toBe(201);
  return { token: result.body.token as string, user: result.body.user as { id: string; role: Role; companyId: string; email: string } };
}
async function addUser(token: string, role: Role) {
  const result = await request(app).post("/api/users").set("Authorization", `Bearer ${token}`).send({ email: `${randomUUID()}@example.invalid`, password, role, companyId: "ignored" });
  expect(result.status).toBe(201);
  const login = await request(app).post("/api/auth/login").send({ email: result.body.email, password });
  expect(login.status).toBe(200);
  return { token: login.body.token as string, user: result.body as { id: string; companyId: string; role: Role } };
}

describe.skipIf(!url)("real PostgreSQL migration, RBAC and seed", () => {
  it("registers the first Admin, preserves bcrypt cost 12 and normal login", async () => {
    const account = await company();
    expect(account.user.role).toBe("Admin");
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: account.user.id } });
    expect(bcrypt.getRounds(stored.passwordHash)).toBe(12);
    expect(await bcrypt.compare(password, stored.passwordHash)).toBe(true);
    expect(account.user).not.toHaveProperty("passwordHash");
    expect((await request(app).post("/api/auth/login").send({ email: account.user.email, password: "incorrect" })).status).toBe(401);
  });

  it("enforces the role matrix on real company-isolated architecture/metamodel writes", async () => {
    const admin = await company();
    const architect = await addUser(admin.token, "Architect");
    const viewer = await addUser(admin.token, "Viewer");
    const state = await request(app).get("/api/sidebar/").set("Authorization", `Bearer ${viewer.token}`);
    expect(state.status).toBe(200);
    const componentTypeId = state.body.componentTypes[0].id;
    for (const [role, account] of [["Admin", admin], ["Architect", architect], ["Viewer", viewer]] as const) {
      const header = `Bearer ${account.token}`;
      expect((await request(app).get("/api/sidebar/components").set("Authorization", header)).status).toBe(200);
      const write = await request(app).post("/api/sidebar/components").set("Authorization", header).send({ name: `Example ${role}`, componentTypeId, description: "", properties: {} });
      expect(write.status).toBe(role === "Viewer" ? 403 : 201);
      const metamodel = await request(app).post("/api/sidebar/component-types").set("Authorization", header).send({ name: `Type ${role}`, color: "#fff", icon: "app", customPropertyKeys: [] });
      expect(metamodel.status).toBe(role === "Admin" ? 201 : 403);
      expect((await request(app).get("/api/users").set("Authorization", header)).status).toBe(role === "Admin" ? 200 : 403);
    }
  });

  it("changes roles immediately for an issued token and prevents non-admin escalation", async () => {
    const admin = await company(); const architect = await addUser(admin.token, "Architect");
    const changed = await request(app).patch(`/api/users/${architect.user.id}/role`).set("Authorization", `Bearer ${admin.token}`).send({ role: "Viewer" });
    expect(changed.status).toBe(200);
    expect((await request(app).get("/api/auth/me").set("Authorization", `Bearer ${architect.token}`)).body.role).toBe("Viewer");
    expect((await request(app).post("/api/model/elements").set("Authorization", `Bearer ${architect.token}`).send({})).status).toBe(403);
    expect((await request(app).patch(`/api/users/${architect.user.id}/role`).set("Authorization", `Bearer ${architect.token}`).send({ role: "Admin" })).status).toBe(403);
    for (const role of ["member", "root", null]) {
      expect((await request(app).patch(`/api/users/${architect.user.id}/role`).set("Authorization", `Bearer ${admin.token}`).send({ role })).status).toBe(400);
    }
  });

  it("prevents cross-company access and does not disclose another company's user via target lookup", async () => {
    const first = await company(); const second = await company();
    const list = await request(app).get("/api/users").set("Authorization", `Bearer ${first.token}`);
    expect(list.body.map((user: { id: string }) => user.id)).toEqual([first.user.id]);
    for (const id of [second.user.id, randomUUID()]) {
      const response = await request(app).patch(`/api/users/${id}/role`).set("Authorization", `Bearer ${first.token}`).send({ role: "Viewer", companyId: second.user.companyId });
      expect(response.status).toBe(404); expect(response.body).toEqual({ error: "User not found." });
    }
    const created = await addUser(first.token, "Viewer");
    expect(created.user.companyId).toBe(first.user.companyId);
    const duplicateOutside = await request(app).post("/api/users").set("Authorization", `Bearer ${first.token}`).send({ email: second.user.email, password, role: "Viewer" });
    const duplicateInside = await request(app).post("/api/users").set("Authorization", `Bearer ${first.token}`).send({ email: first.user.email, password, role: "Viewer" });
    expect(duplicateOutside.status).toBe(409); expect(duplicateInside.body).toEqual(duplicateOutside.body);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: second.user.id } })).role).toBe("Admin");
  });

  it("serializes concurrent self-demotions so one administrator always remains", async () => {
    const first = await company(); const second = await addUser(first.token, "Admin");
    const responses = await Promise.all([first, second].map((account) => request(app).patch(`/api/users/${account.user.id}/role`).set("Authorization", `Bearer ${account.token}`).send({ role: "Viewer" })));
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.user.count({ where: { companyId: first.user.companyId, role: "Admin" } })).toBe(1);
    const admin = await prisma.user.findFirstOrThrow({ where: { companyId: first.user.companyId, role: "Admin" } });
    await expect(repository.changeRole(admin.id, admin.companyId, admin.id, "Architect")).rejects.toThrow(/last administrator/);
    const demoted = await prisma.user.findFirstOrThrow({ where: { companyId: first.user.companyId, role: "Viewer" } });
    await expect(repository.createLocalUser(demoted.id, demoted.companyId, { email: `${randomUUID()}@example.invalid`, passwordHash: "not-used", name: null, role: "Admin" })).rejects.toThrow(/Administrator permission/);
  });

  it("executes the real seed twice with exactly three demo roles and no production opt-in", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "req24-seed-db-"));
    if (!directory.startsWith(path.join(os.tmpdir(), "req24-seed-db-"))) throw new Error("Unsafe temporary path");
    try {
      const credentials = Object.fromEntries(ROLES.map((role) => [role, `req24-test-only-${role}-password-123`]));
      const file = path.join(directory, "passwords.json"); await writeFile(file, JSON.stringify(credentials));
      const env = { ...process.env, DATABASE_URL: url!, NODE_ENV: "test", SEED_DEMO_USERS: "true", SEED_DEMO_PASSWORDS_FILE: file };
      const tsx = path.resolve("../node_modules/tsx/dist/cli.mjs");
      for (let iteration = 0; iteration < 2; iteration++) execFileSync(process.execPath, [tsx, "prisma/seed.ts"], { env, stdio: "pipe", windowsHide: true });
      const users = await prisma.user.findMany({ where: { companyId: DEFAULT_COMPANY_ID } });
      expect(users.map((user) => user.role).sort()).toEqual([...ROLES].sort());
      for (const user of users) {
        expect(user.email).toBe(DEMO_EMAILS[user.role]);
        expect(bcrypt.getRounds(user.passwordHash)).toBe(12);
        expect(await bcrypt.compare(credentials[user.role], user.passwordHash)).toBe(true);
        expect((await request(app).post("/api/auth/login").send({ email: user.email, password: credentials[user.role] })).body.user.role).toBe(user.role);
      }
      await expect(demoCredentials({ ...env, NODE_ENV: "production" })).rejects.toThrow(/NODE_ENV/);
      expect(() => execFileSync(process.execPath, [tsx, "prisma/seed.ts"], { env: { ...env, NODE_ENV: "production" }, stdio: "pipe", windowsHide: true })).toThrow();
      expect(await prisma.user.count({ where: { companyId: DEFAULT_COMPANY_ID } })).toBe(3);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("migrates real member rows deterministically, preserving hashes and existing Admins", async () => {
    const migrations = path.resolve("prisma/migrations");
    const folders = (await readdir(migrations)).filter((name) => /^\d/.test(name)).sort();
    const legacy = (await Promise.all(folders.slice(0, -1).map((name) => readFile(path.join(migrations, name, "migration.sql"), "utf8")))).join("\n");
    const migration = await readFile(path.join(migrations, folders.at(-1)!, "migration.sql"), "utf8");
    const sql = `CREATE SCHEMA legacy_req24; SET search_path TO legacy_req24; ${legacy}
INSERT INTO "Company" ("id", "name", "updatedAt") VALUES ('legacy-a', 'A', NOW()), ('legacy-b', 'B', NOW());
INSERT INTO "User" ("id", "email", "passwordHash", "companyId", "role", "createdAt", "updatedAt") VALUES
('a-first', 'first@legacy.invalid', 'preserved-hash', 'legacy-a', 'member', '2026-01-01', NOW()),
('a-tie', 'tie@legacy.invalid', 'preserved-hash', 'legacy-a', 'member', '2026-01-01', NOW()),
('a-later', 'later@legacy.invalid', 'preserved-hash', 'legacy-a', 'member', '2026-02-01', NOW()),
('b-admin', 'admin@legacy.invalid', 'preserved-hash', 'legacy-b', 'Admin', '2026-02-01', NOW()),
('b-member', 'member@legacy.invalid', 'preserved-hash', 'legacy-b', 'member', '2026-01-01', NOW());
${migration}`;
    // PostgreSQL's Windows getopt does not process options after a positional database URL.
    const psqlArgs = ["-X", "-w", "-v", "ON_ERROR_STOP=1", "-d", url!, "-f", "-"];
    execFileSync(process.env.PG_TEST_PSQL!, psqlArgs, { input: sql, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    const migrated = await prisma.$queryRawUnsafe<{ id: string; role: string; passwordHash: string }[]>('SELECT "id", "role"::text, "passwordHash" FROM legacy_req24."User" ORDER BY "id"');
    expect(migrated.map((row) => [row.id, row.role])).toEqual([["a-first", "Admin"], ["a-later", "Architect"], ["a-tie", "Architect"], ["b-admin", "Admin"], ["b-member", "Architect"]]);
    expect(migrated.every((row) => row.passwordHash === "preserved-hash")).toBe(true);
    await expect(prisma.$executeRawUnsafe(`UPDATE legacy_req24."User" SET "role" = 'member' WHERE "id" = 'a-first'`)).rejects.toThrow();
    const bad = `CREATE SCHEMA unknown_req24; SET search_path TO unknown_req24; ${legacy}
INSERT INTO "User" ("id", "email", "passwordHash", "companyId", "role", "updatedAt") VALUES ('bad', 'bad@legacy.invalid', 'hash', 'company-default-demo', 'superuser', NOW()); ${migration}`;
    const rejected = spawnSync(process.env.PG_TEST_PSQL!, psqlArgs, { input: bad, encoding: "utf8", windowsHide: true });
    expect(rejected.status, rejected.stderr + rejected.stdout).not.toBe(0);
    expect(rejected.stderr).toContain("REQ-24: unknown legacy role");
    const old = await prisma.$queryRawUnsafe<{ role: string }[]>('SELECT "role" FROM unknown_req24."User"');
    expect(old[0].role).toBe("superuser");
  });
}, 30000);
