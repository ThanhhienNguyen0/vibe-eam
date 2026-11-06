import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../server.js";
import { PrismaAuthRepository } from "../auth/prismaAuthRepository.js";
import type { ComponentInstance, SidebarState } from "../Sidebar/sidebarTypes.js";
import { PrismaSidebarStateRepository } from "./databaseSidebarRepository.js";
import { serializeCsv } from "../importExport/tabular.js";

const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith("/req24_test_")) throw new Error("Only isolated req24_test_ databases are permitted.");
const prisma = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const authRepository = new PrismaAuthRepository(prisma);
const app = createApp({
  jwtSecret: "req26-database-test-only-signing-secret-32-characters",
  authRepository,
  userRepository: authRepository
});
const password = "req26-local-test-only-password";
afterAll(async () => prisma.$disconnect());

async function registerCompany() {
  const email = `${randomUUID()}@example.invalid`;
  const response = await request(app).post("/api/auth/register").send({ email, password, companyName: `REQ26 ${email}` });
  expect(response.status).toBe(201);
  return { token: response.body.token as string, companyId: response.body.user.companyId as string };
}

const authorized = (token: string) => ({ Authorization: `Bearer ${token}` });
const sidebar = async (token: string) => (await request(app).get("/api/sidebar").set(authorized(token))).body as SidebarState;

async function processRace(companyId: string, component: ComponentInstance): Promise<string[]> {
  const children = [0, 1].map(() => fork(new URL("./req26ProcessWorker.ts", import.meta.url), [], {
    execArgv: ["--import", "tsx"],
    stdio: ["ignore", "ignore", "ignore", "ipc"]
  }));
  await Promise.all(children.map((child) => new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.on("message", (message: { type?: string }) => { if (message.type === "ready") resolve(); });
  })));
  const results = children.map((child, index) => new Promise<string>((resolve, reject) => {
    child.once("error", reject);
    child.on("message", (message: { type?: string; status?: string; message?: string }) => {
      if (message.type === "result") resolve(message.status === "error" ? `error:${message.message}` : message.status ?? "error");
    });
    child.send({
      companyId,
      component: { ...component, name: `Process ${index}` },
      expectedVersion: component.version,
      databaseUrl: url
    });
  }));
  return Promise.all(results).finally(() => children.forEach((child: ChildProcess) => { if (child.connected) child.disconnect(); }));
}

describe.skipIf(!url)("REQ-26 optimistic locking against real PostgreSQL", () => {
  it("atomically resolves update/update across independent backend processes", async () => {
    const company = await registerCompany();
    const component = (await sidebar(company.token)).components[0];
    const outcomes = await processRace(company.companyId, component);
    expect(outcomes.sort()).toEqual(["conflict", "updated"]);
    const stored = await prisma.componentInstance.findUniqueOrThrow({ where: { id: component.id } });
    expect(stored.version).toBe((component.version ?? 1) + 1);
  });

  it("lets independent objects advance without restoring stale peer data", async () => {
    const company = await registerCompany();
    const [first, second] = (await sidebar(company.token)).components;
    const clientA = new PrismaClient({ datasourceUrl: url });
    const clientB = new PrismaClient({ datasourceUrl: url });
    const repoA = new PrismaSidebarStateRepository(clientA);
    const repoB = new PrismaSidebarStateRepository(clientB);
    try {
      await Promise.all([
        repoA.updateComponent(company.companyId, { ...first, name: "Concurrent A" }, first.version ?? 1),
        repoB.updateComponent(company.companyId, { ...second, name: "Concurrent B" }, second.version ?? 1)
      ]);
      const stored = await prisma.componentInstance.findMany({ where: { id: { in: [first.id, second.id] } }, orderBy: { id: "asc" } });
      expect(stored.map((item) => item.name).sort()).toEqual(["Concurrent A", "Concurrent B"]);
      expect(stored.every((item) => item.version === 2)).toBe(true);
    } finally {
      await Promise.all([repoA.disconnect(), repoB.disconnect()]);
    }
  });

  it("returns 428/400/409, supports explicit current-version overwrite, and conflicts again after another write", async () => {
    const company = await registerCompany();
    const component = (await sidebar(company.token)).components[0];
    const path = `/api/sidebar/components/${component.id}`;
    expect((await request(app).patch(path).set(authorized(company.token)).send({ name: "missing" })).status).toBe(428);
    expect((await request(app).patch(path).set(authorized(company.token)).set("If-Match", "zero").send({ name: "invalid" })).status).toBe(400);
    const first = await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(component.version)).send({ name: "first" });
    expect(first.status).toBe(200);
    const stale = await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(component.version)).send({ name: "stale" });
    expect(stale.status).toBe(409);
    expect(stale.body.current.version).toBe(first.body.version);
    const overwrite = await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(stale.body.current.version)).send({ name: "overwrite" });
    expect(overwrite.status).toBe(200);
    const intervening = await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(overwrite.body.version)).send({ name: "intervening" });
    expect(intervening.status).toBe(200);
    const secondConflict = await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(overwrite.body.version)).send({ name: "second stale" });
    expect(secondConflict.status).toBe(409);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(0);
  });

  it("protects relations, diagrams, cascade deletes, and tenant boundaries", async () => {
    const firstCompany = await registerCompany();
    const secondCompany = await registerCompany();
    const first = await sidebar(firstCompany.token);
    const second = await sidebar(secondCompany.token);
    const connection = first.connections[0];
    const relationPath = `/api/sidebar/connections/${connection.id}`;
    const relationUpdate = await request(app).patch(relationPath).set(authorized(firstCompany.token)).set("If-Match", String(connection.version)).send({ description: "new" });
    expect(relationUpdate.status).toBe(200);
    expect((await request(app).delete(relationPath).set(authorized(firstCompany.token)).set("If-Match", String(connection.version))).status).toBe(409);

    const diagram = first.diagrams[0];
    const diagramPath = `/api/sidebar/diagrams/${diagram.id}`;
    const diagramUpdate = await request(app).patch(diagramPath).set(authorized(firstCompany.token)).set("If-Match", String(diagram.version)).send({ description: "diagram" });
    expect(diagramUpdate.status).toBe(200);
    expect((await request(app).patch(diagramPath).set(authorized(firstCompany.token)).set("If-Match", String(diagram.version)).send({ name: "stale" })).status).toBe(409);

    const component = first.components.find((item) => first.connections.some((itemConnection) => itemConnection.sourceComponentId === item.id || itemConnection.targetComponentId === item.id))!;
    expect((await request(app).delete(`/api/sidebar/components/${component.id}`).set(authorized(firstCompany.token)).set("If-Match", String(component.version))).status).toBe(204);
    expect(await prisma.connectionInstance.count({ where: { companyId: firstCompany.companyId, OR: [{ sourceComponentId: component.id }, { targetComponentId: component.id }] } })).toBe(0);

    const foreign = second.components[0];
    expect((await request(app).patch(`/api/sidebar/components/${foreign.id}`).set(authorized(firstCompany.token)).set("If-Match", String(foreign.version)).send({ name: "cross tenant" })).status).toBe(404);
  });

  it("binds CSV preview/commit to dataRevision and leaves data and audit unchanged on 409", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const type = state.componentTypes.find((item) => !item.isAbstract)!;
    const file = Buffer.from(serializeCsv([["Typ", "Name"], [type.name, "Preview candidate"]]), "utf8");
    const preview = await request(app).post("/api/sidebar/import/preview?fileName=req26.csv").set(authorized(company.token)).set("Content-Type", "application/octet-stream").send(file);
    expect(preview.status).toBe(200);
    const component = state.components[0];
    expect((await request(app).patch(`/api/sidebar/components/${component.id}`).set(authorized(company.token)).set("If-Match", String(component.version)).send({ name: "changed after preview" })).status).toBe(200);
    const beforeComponents = await prisma.componentInstance.count({ where: { companyId: company.companyId } });
    const beforeAudit = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    const commit = await request(app).post(`/api/sidebar/import/commit?fileName=req26.csv&expectedRevision=${preview.body.dataRevision}`).set(authorized(company.token)).set("Content-Type", "application/octet-stream").send(file);
    expect(commit.status).toBe(409);
    expect(await prisma.componentInstance.count({ where: { companyId: company.companyId } })).toBe(beforeComponents);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(beforeAudit);

    const current = await sidebar(company.token);
    const existing = current.components[0];
    const updateFile = Buffer.from(serializeCsv([["ID", "Typ", "Name"], [existing.id, "", "Imported rename"]]), "utf8");
    const freshPreview = await request(app).post("/api/sidebar/import/preview?fileName=req26-update.csv").set(authorized(company.token)).set("Content-Type", "application/octet-stream").send(updateFile);
    const successful = await request(app).post(`/api/sidebar/import/commit?fileName=req26-update.csv&expectedRevision=${freshPreview.body.dataRevision}`).set(authorized(company.token)).set("Content-Type", "application/octet-stream").send(updateFile);
    expect(successful.status, JSON.stringify(successful.body)).toBe(200);
    const imported = await prisma.componentInstance.findUniqueOrThrow({ where: { id: existing.id } });
    expect(imported.name).toBe("Imported rename");
    expect(imported.version).toBeGreaterThan(existing.version ?? 1);
  });

  it("keeps the historical active model API revisioned and DB-serialized", async () => {
    const company = await registerCompany();
    const model = await request(app).get("/api/model").set(authorized(company.token));
    expect(model.status).toBe(200);
    const element = model.body.elements[0] as { id: string; version: number; name: string };
    const path = `/api/model/elements/${element.id}`;
    expect((await request(app).patch(path).set(authorized(company.token)).send({ name: "missing precondition" })).status).toBe(428);
    const updated = await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(element.version)).send({ name: "Historical update" });
    expect(updated.status).toBe(200);
    expect(updated.body.version).toBe(element.version + 1);
    expect((await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(element.version)).send({ name: "stale" })).status).toBe(409);
    const staleImport = await request(app).post("/api/model/import").set(authorized(company.token)).set("If-Match", model.headers.etag).send(model.body);
    expect(staleImport.status).toBe(409);
  });
});
