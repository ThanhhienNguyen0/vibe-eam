import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { PrismaAuthRepository } from "../auth/prismaAuthRepository.js";
import type { Role } from "../auth/policy.js";
import { createApp } from "../server.js";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import { PrismaSidebarStateRepository } from "../persistence/databaseSidebarRepository.js";

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith("/req24_test_")) throw new Error("Only isolated req24_test_ databases are permitted.");
const prisma = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const authRepository = new PrismaAuthRepository(prisma);
const app = createApp({
  jwtSecret: "req23-database-test-only-signing-secret-32-characters",
  authRepository,
  userRepository: authRepository
});
const password = "req23-local-test-only-password";
let registrationSequence = 20;
afterAll(async () => prisma.$disconnect());

async function registerCompany() {
  const email = `${randomUUID()}@example.invalid`;
  const response = await request(app).post("/api/auth/register")
    .set("X-Forwarded-For", `203.0.113.${registrationSequence++}`)
    .send({ email, password, companyName: `REQ23 ${email}`, name: "Audit Tester" });
  expect(response.status).toBe(201);
  return { token: response.body.token as string, companyId: response.body.user.companyId as string, email };
}

async function addUser(adminToken: string, role: Role) {
  const email = `${randomUUID()}@example.invalid`;
  expect((await request(app).post("/api/users").set("Authorization", `Bearer ${adminToken}`).send({ email, password, role })).status).toBe(201);
  const login = await request(app).post("/api/auth/login").set("X-Forwarded-For", `203.0.113.${registrationSequence++}`).send({ email, password });
  expect(login.status).toBe(200);
  return { token: login.body.token as string, email };
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const sidebar = async (token: string) => (await request(app).get("/api/sidebar").set(auth(token))).body as SidebarState;

describe.skipIf(!url)("REQ-23 audit history against real PostgreSQL", () => {
  it("records the authenticated actor and exact redacted field diffs while rejected writes stay silent", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const type = state.componentTypes.find((item) => !item.isAbstract)!;
    const viewer = await addUser(company.token, "Viewer");
    const beforeCreate = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });

    const created = await request(app).post("/api/sidebar/components").set(auth(company.token)).send({
      name: "Audit Component",
      componentTypeId: type.id,
      properties: { owner: "Alpha", apiToken: "client-secret-must-not-appear" },
      actor: "forged@example.invalid"
    });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    const createEntry = await prisma.auditLogEntry.findFirstOrThrow({
      where: { companyId: company.companyId, entityType: "component", entityId: created.body.id, action: "create" }
    });
    expect(createEntry.userEmail).toBe(company.email);
    expect(createEntry.actorLabel).toBe("Audit Tester");
    expect(JSON.stringify(createEntry.changes)).toContain("[REDACTED]");
    expect(JSON.stringify(createEntry.changes)).not.toContain("client-secret-must-not-appear");
    expect(JSON.stringify(createEntry.changes)).not.toContain("version");

    const updated = await request(app).patch(`/api/sidebar/components/${created.body.id}`).set(auth(company.token))
      .set("If-Match", String(created.body.version)).send({ name: "Audit Component 2", properties: { owner: "Beta", apiToken: "another-secret" } });
    expect(updated.status).toBe(200);
    const updateEntry = await prisma.auditLogEntry.findFirstOrThrow({
      where: { companyId: company.companyId, entityId: created.body.id, action: "update" },
      orderBy: { occurredAt: "desc" }
    });
    expect(updateEntry.changes).toEqual(expect.arrayContaining([
      { field: "name", before: "Audit Component", after: "Audit Component 2" },
      { field: "properties.owner", before: "Alpha", after: "Beta" }
    ]));
    expect(JSON.stringify(updateEntry.changes)).not.toContain("another-secret");

    const beforeRejected = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    expect((await request(app).patch(`/api/sidebar/components/${created.body.id}`).set(auth(company.token))
      .set("If-Match", String(created.body.version)).send({ name: "stale" })).status).toBe(409);
    expect((await request(app).post("/api/sidebar/components").set(auth(company.token)).send({ componentTypeId: type.id })).status).toBe(400);
    expect((await request(app).post("/api/sidebar/components").set(auth(viewer.token)).send({ name: "forbidden", componentTypeId: type.id })).status).toBe(403);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(beforeRejected);
    expect(beforeRejected).toBeGreaterThan(beforeCreate);

    const noOp = await request(app).patch(`/api/sidebar/components/${created.body.id}`).set(auth(company.token))
      .set("If-Match", String(updated.body.version)).send({ name: updated.body.name, properties: updated.body.properties });
    expect(noOp.status).toBe(200);
    expect(noOp.body.version).toBe(updated.body.version);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(beforeRejected);
  });

  it("rolls the business mutation back when the audit actor cannot be persisted", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const component = state.components[0];
    const before = await prisma.componentInstance.findUniqueOrThrow({ where: { id: component.id } });
    const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    const repository = new PrismaSidebarStateRepository(prisma);

    await expect(repository.updateComponent(
      company.companyId,
      { ...component, name: "Must roll back" },
      component.version ?? 1,
      { type: "user", userId: "missing-audit-actor" }
    )).rejects.toThrow(/audit actor/);

    const after = await prisma.componentInstance.findUniqueOrThrow({ where: { id: component.id } });
    expect(after.name).toBe(before.name);
    expect(after.version).toBe(before.version);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(auditBefore);
  });

  it("filters and paginates deterministically inside the authenticated tenant", async () => {
    const first = await registerCompany();
    const second = await registerCompany();
    const firstState = await sidebar(first.token);
    await sidebar(second.token);
    const type = firstState.componentTypes.find((item) => !item.isAbstract)!;
    const createdIds: string[] = [];
    for (const name of ["Page A", "Page B", "Page C"]) {
      const created = await request(app).post("/api/sidebar/components").set(auth(first.token)).send({ name, componentTypeId: type.id });
      expect(created.status).toBe(201);
      createdIds.push(created.body.id as string);
    }

    const firstPage = await request(app).get("/api/sidebar/audit-log?limit=1&entityType=component").set(auth(first.token));
    expect(firstPage.status).toBe(200);
    expect(firstPage.body.items).toHaveLength(1);
    expect(firstPage.body.nextCursor).toBeTypeOf("string");
    const secondPage = await request(app).get(`/api/sidebar/audit-log?limit=1&entityType=component&cursor=${encodeURIComponent(firstPage.body.nextCursor)}`).set(auth(first.token));
    expect(secondPage.status).toBe(200);
    expect(secondPage.body.items).toHaveLength(1);
    expect(secondPage.body.items[0].id).not.toBe(firstPage.body.items[0].id);

    const element = await request(app).get(`/api/sidebar/audit-log?entityId=${createdIds[1]}`).set(auth(first.token));
    expect(element.body.items).toHaveLength(1);
    expect(element.body.items[0].entityId).toBe(createdIds[1]);
    const actor = await request(app).get(`/api/sidebar/audit-log?actor=${encodeURIComponent(first.email)}&entityType=component`).set(auth(first.token));
    expect(actor.body.items).toHaveLength(3);
    expect(actor.body.items.every((item: { userEmail: string }) => item.userEmail === first.email)).toBe(true);
    const future = encodeURIComponent(new Date(Date.now() + 60_000).toISOString());
    expect((await request(app).get(`/api/sidebar/audit-log?from=${future}`).set(auth(first.token))).body.items).toHaveLength(0);
    expect((await request(app).get(`/api/sidebar/audit-log?entityId=${createdIds[0]}`).set(auth(second.token))).body.items).toHaveLength(0);
  });

  it("preserves history across full JSON imports and keeps audit outside the transfer document", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const type = state.componentTypes.find((item) => !item.isAbstract)!;
    const created = await request(app).post("/api/sidebar/components").set(auth(company.token)).send({ name: "Before import", componentTypeId: type.id });
    expect(created.status).toBe(201);
    const evidenceId = (await prisma.auditLogEntry.findFirstOrThrow({ where: { companyId: company.companyId, entityId: created.body.id } })).id;

    const exported = await request(app).get("/api/sidebar/model/export").set(auth(company.token));
    expect(exported.status).toBe(200);
    expect(JSON.stringify(exported.body)).not.toContain("auditLog");
    const revision = exported.headers.etag.replaceAll('"', "");
    const imported = await request(app).post("/api/sidebar/model/import").set(auth(company.token)).set("If-Match", revision).send(exported.body);
    expect(imported.status, JSON.stringify(imported.body)).toBe(200);
    expect(await prisma.auditLogEntry.findUnique({ where: { id: evidenceId } })).not.toBeNull();
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId, action: "model-json.import" } })).toBe(1);
  });

  it("mirrors historical API changes into the canonical audit while retaining the legacy GET path", async () => {
    const company = await registerCompany();
    const model = await request(app).get("/api/model").set(auth(company.token));
    expect(model.status).toBe(200);
    const template = model.body.elements[0];
    const id = `legacy-${randomUUID()}`;
    const created = await request(app).post("/api/model/elements").set(auth(company.token)).send({ ...template, id, name: "Historical audited" });
    expect(created.status).toBe(201);
    const canonical = await prisma.auditLogEntry.findFirstOrThrow({ where: { companyId: company.companyId, entityType: "legacy-element", entityId: id } });
    expect(canonical.userEmail).toBe(company.email);
    expect(canonical.changes).toEqual(expect.arrayContaining([{ field: "name", before: null, after: "Historical audited" }]));
    const legacy = await request(app).get("/api/audit-log").set(auth(company.token));
    expect(legacy.status).toBe(200);
    expect(legacy.body.some((entry: { entityId: string }) => entry.entityId === id)).toBe(true);
  });
});
