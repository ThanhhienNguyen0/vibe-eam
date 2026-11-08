import { fork, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../server.js";
import { PrismaAuthRepository } from "../auth/prismaAuthRepository.js";
import type { ComponentInstance, Diagram, SidebarState } from "../Sidebar/sidebarTypes.js";
import { OptimisticLockError, PrismaSidebarStateRepository } from "./databaseSidebarRepository.js";
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
let registrationSequence = 1;
afterAll(async () => prisma.$disconnect());

async function registerCompany() {
  const email = `${randomUUID()}@example.invalid`;
  const response = await request(app).post("/api/auth/register")
    .set("X-Forwarded-For", `198.51.100.${registrationSequence++}`)
    .send({ email, password, companyName: `REQ26 ${email}` });
  expect(response.status).toBe(201);
  return { token: response.body.token as string, companyId: response.body.user.companyId as string };
}

const authorized = (token: string) => ({ Authorization: `Bearer ${token}` });
const sidebar = async (token: string) => (await request(app).get("/api/sidebar").set(authorized(token))).body as SidebarState;

function clientUrl(name: string): string {
  const parsed = new URL(url!);
  parsed.searchParams.set("connection_limit", "1");
  parsed.searchParams.set("application_name", name);
  return parsed.toString();
}

async function waitForDatabaseLock(pid: number): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const rows = await prisma.$queryRaw<Array<{ wait_event_type: string | null }>>`
      SELECT wait_event_type FROM pg_stat_activity WHERE pid = ${pid}
    `;
    if (rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Process ${pid} did not reach the database lock barrier.`);
}

interface WorkerRequest {
  action?: "update-component" | "delete-component" | "update-diagram";
  companyId: string;
  component?: ComponentInstance;
  diagram?: Diagram;
  id?: string;
  expectedVersion: number;
}

async function runWorkers(requests: WorkerRequest[]): Promise<string[]> {
  const children = requests.map(() => fork(new URL("./req26ProcessWorker.ts", import.meta.url), [], {
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
    child.send({ ...requests[index], databaseUrl: url });
  }));
  return Promise.all(results).finally(() => children.forEach((child: ChildProcess) => { if (child.connected) child.disconnect(); }));
}

async function processRace(companyId: string, component: ComponentInstance): Promise<string[]> {
  return runWorkers([0, 1].map((index) => ({
    action: "update-component" as const,
    companyId,
    component: { ...component, name: `Process ${index}` },
    expectedVersion: component.version ?? 1
  })));
}

describe.skipIf(!url)("REQ-26 optimistic locking against real PostgreSQL", () => {
  it("atomically resolves update/update across independent backend processes", async () => {
    const company = await registerCompany();
    const component = (await sidebar(company.token)).components[0];
    const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    const outcomes = await processRace(company.companyId, component);
    expect(outcomes.sort()).toEqual(["conflict", "updated"]);
    const stored = await prisma.componentInstance.findUniqueOrThrow({ where: { id: component.id } });
    expect(stored.version).toBe((component.version ?? 1) + 1);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(auditBefore + 1);
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

  it("keeps a sidebar snapshot and its dataRevision consistent across a concurrent PATCH", async () => {
    const company = await registerCompany();
    const original = await sidebar(company.token);
    const component = original.components[0];
    let snapshotReady!: () => void;
    let releaseRead!: () => void;
    const snapshotEstablished = new Promise<void>((resolve) => { snapshotReady = resolve; });
    const continueRead = new Promise<void>((resolve) => { releaseRead = resolve; });
    const readClient = new PrismaClient({ datasourceUrl: url });
    const writeClient = new PrismaClient({ datasourceUrl: url });
    const reader = new PrismaSidebarStateRepository(readClient, async () => {
      snapshotReady();
      await continueRead;
    });
    const writer = new PrismaSidebarStateRepository(writeClient);
    try {
      const pendingRead = reader.read(company.companyId);
      await snapshotEstablished;
      const updated = await writer.updateComponent(company.companyId, { ...component, name: "Committed after snapshot" }, component.version ?? 1);
      releaseRead();
      const snapshot = await pendingRead;
      expect(snapshot?.components.find((item) => item.id === component.id)?.name).toBe(component.name);
      expect(snapshot?.dataRevision).toBe(original.dataRevision);
      await expect(reader.write({ ...snapshot!, catalogs: snapshot!.catalogs ?? [] }, company.companyId)).rejects.toBeInstanceOf(OptimisticLockError);
      expect((await prisma.componentInstance.findUniqueOrThrow({ where: { id: component.id } })).name).toBe(updated.name);
    } finally {
      releaseRead();
      await Promise.all([reader.disconnect(), writer.disconnect()]);
    }
  });

  it("keeps repeated sidebar reads free of normalization writes", async () => {
    const company = await registerCompany();
    const first = await sidebar(company.token);
    const before = await prisma.company.findUniqueOrThrow({ where: { id: company.companyId }, select: { dataRevision: true } });
    const second = await sidebar(company.token);
    const after = await prisma.company.findUniqueOrThrow({ where: { id: company.companyId }, select: { dataRevision: true } });
    expect(second).toEqual(first);
    expect(after.dataRevision).toBe(before.dataRevision);
  });

  it.each(["PATCH", "DELETE", "CREATE_AND_PLACE"] as const)(
    "serializes a whole-state write before %s without P2034 or partial dataRevision",
    async (operation) => {
      const company = await registerCompany();
      const original = await sidebar(company.token);
      const writerClient = new PrismaClient({ datasourceUrl: clientUrl(`req26-writer-${operation}`) });
      const contenderClient = new PrismaClient({ datasourceUrl: clientUrl(`req26-contender-${operation}`) });
      let companyLocked!: () => void;
      let releaseWriter!: () => void;
      const lockReached = new Promise<void>((resolve) => { companyLocked = resolve; });
      const continueWriter = new Promise<void>((resolve) => { releaseWriter = resolve; });
      const writer = new PrismaSidebarStateRepository(writerClient, undefined, async () => {
        companyLocked();
        await continueWriter;
      });
      const contender = new PrismaSidebarStateRepository(contenderClient);
      const [{ pid }] = await contenderClient.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
      const next = structuredClone(original);
      if (operation === "CREATE_AND_PLACE") next.diagrams[0].description = "whole-state diagram update";
      else next.components[0].name = "whole-state component update";
      const beforeComponentCount = await prisma.componentInstance.count({ where: { companyId: company.companyId } });
      try {
        const write = writer.write(next, company.companyId);
        await lockReached;
        const competing = (operation === "PATCH"
          ? contender.updateComponent(company.companyId, { ...original.components[0], name: "competing patch" }, original.components[0].version ?? 1)
          : operation === "DELETE"
            ? contender.deleteComponent(company.companyId, original.components[0].id, original.components[0].version ?? 1)
            : contender.createComponentInDiagram(
              company.companyId,
              {
                id: randomUUID(), version: 1, name: "competing create", description: "",
                componentTypeId: original.componentTypes.find((item) => !item.isAbstract)!.id, properties: {}
              },
              original.diagrams[0].id,
              { x: 10, y: 20 },
              original.diagrams[0].version ?? 1
            )).then(
          (value) => ({ value, error: undefined }),
          (error: unknown) => ({ value: undefined, error })
        );
        await waitForDatabaseLock(pid);
        releaseWriter();
        await expect(write).resolves.toBeDefined();
        expect((await competing).error).toBeInstanceOf(OptimisticLockError);
        const companyRow = await prisma.company.findUniqueOrThrow({ where: { id: company.companyId } });
        expect(companyRow.dataRevision).toBe((original.dataRevision ?? 0) + 1);
        expect(await prisma.componentInstance.count({ where: { companyId: company.companyId } })).toBe(beforeComponentCount);
      } finally {
        releaseWriter();
        await Promise.all([writer.disconnect(), contender.disconnect()]);
      }
    }
  );

  it("keeps unchanged object versions stable during whole-state creates", async () => {
    const company = await registerCompany();
    const before = await sidebar(company.token);
    const response = await request(app).post("/api/sidebar/components").set(authorized(company.token)).send({
      name: "Independent new component",
      componentTypeId: before.componentTypes.find((item) => !item.isAbstract)!.id,
      properties: {}
    });
    expect(response.status).toBe(201);
    const after = await sidebar(company.token);
    for (const item of before.components) expect(after.components.find((candidate) => candidate.id === item.id)?.version).toBe(item.version);
    for (const item of before.connections) expect(after.connections.find((candidate) => candidate.id === item.id)?.version).toBe(item.version);
    for (const item of before.diagrams) expect(after.diagrams.find((candidate) => candidate.id === item.id)?.version).toBe(item.version);
  });

  it("atomically resolves update/delete across independent backend processes", async () => {
    const company = await registerCompany();
    const component = (await sidebar(company.token)).components.at(-1)!;
    const outcomes = await runWorkers([
      {
        action: "update-component",
        companyId: company.companyId,
        component: { ...component, name: "Concurrent update" },
        expectedVersion: component.version ?? 1
      },
      {
        action: "delete-component",
        companyId: company.companyId,
        id: component.id,
        expectedVersion: component.version ?? 1
      }
    ]);
    expect([
      ["conflict", "updated"],
      ["deleted", "not-found"]
    ]).toContainEqual(outcomes.sort());
  });

  it("returns 428/400/409, supports explicit current-version overwrite, and conflicts again after another write", async () => {
    const company = await registerCompany();
    const component = (await sidebar(company.token)).components[0];
    const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
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
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(auditBefore + 3);
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

  it("versions affected diagrams on component and connection cascades and rolls stale deletes back", async () => {
    const company = await registerCompany();
    const initial = await sidebar(company.token);
    const componentDiagram = initial.diagrams.find((item) => item.componentIds.length > 0)!;
    const component = initial.components.find((item) => item.id === componentDiagram.componentIds[0])!;
    const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    const deleted = await request(app).delete(`/api/sidebar/components/${component.id}`).set(authorized(company.token))
      .set("If-Match", String(component.version));
    expect(deleted.status).toBe(204);
    const afterComponentDelete = await sidebar(company.token);
    const changedDiagram = afterComponentDelete.diagrams.find((item) => item.id === componentDiagram.id)!;
    expect(changedDiagram.version).toBe((componentDiagram.version ?? 1) + 1);
    expect(changedDiagram.componentIds).not.toContain(component.id);
    const auditAfterComponentDelete = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    expect(auditAfterComponentDelete).toBeGreaterThan(auditBefore);
    expect((await request(app).patch(`/api/sidebar/diagrams/${componentDiagram.id}`).set(authorized(company.token))
      .set("If-Match", String(componentDiagram.version)).send({ name: "stale after cascade" })).status).toBe(409);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(auditAfterComponentDelete);

    const connectionDiagram = afterComponentDelete.diagrams.find((item) => item.connectionIds.length > 0)!;
    const connection = afterComponentDelete.connections.find((item) => item.id === connectionDiagram.connectionIds[0])!;
    expect((await request(app).delete(`/api/sidebar/connections/${connection.id}`).set(authorized(company.token))
      .set("If-Match", String(connection.version))).status).toBe(204);
    const afterConnectionDelete = await sidebar(company.token);
    const connectionChangedDiagram = afterConnectionDelete.diagrams.find((item) => item.id === connectionDiagram.id)!;
    expect(connectionChangedDiagram.version).toBe((connectionDiagram.version ?? 1) + 1);
    expect(connectionChangedDiagram.connectionIds).not.toContain(connection.id);

    const rollbackComponent = afterConnectionDelete.components[0];
    const rollbackDiagram = afterConnectionDelete.diagrams.find((item) => item.componentIds.includes(rollbackComponent.id))!;
    const updated = await request(app).patch(`/api/sidebar/components/${rollbackComponent.id}`).set(authorized(company.token))
      .set("If-Match", String(rollbackComponent.version)).send({ name: "advance before stale delete" });
    expect(updated.status).toBe(200);
    const auditBeforeStaleDelete = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    const beforeStaleDelete = await sidebar(company.token);
    const revisionBefore = beforeStaleDelete.dataRevision;
    const diagramVersionBefore = beforeStaleDelete.diagrams.find((item) => item.id === rollbackDiagram.id)!.version;
    const staleDelete = await request(app).delete(`/api/sidebar/components/${rollbackComponent.id}`).set(authorized(company.token))
      .set("If-Match", String(rollbackComponent.version));
    expect(staleDelete.status).toBe(409);
    const afterStaleDelete = await sidebar(company.token);
    expect(afterStaleDelete.dataRevision).toBe(revisionBefore);
    expect(afterStaleDelete.diagrams.find((item) => item.id === rollbackDiagram.id)!.version).toBe(diagramVersionBefore);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBe(auditBeforeStaleDelete);
  });

  it("serializes a component cascade against a diagram update across backend processes", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const diagram = state.diagrams.find((item) => item.componentIds.length > 0)!;
    const component = state.components.find((item) => item.id === diagram.componentIds[0])!;
    const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: company.companyId } });
    const outcomes = await runWorkers([
      {
        action: "delete-component",
        companyId: company.companyId,
        id: component.id,
        expectedVersion: component.version ?? 1
      },
      {
        action: "update-diagram",
        companyId: company.companyId,
        expectedVersion: diagram.version ?? 1,
        diagram: { ...diagram, description: "parallel diagram update" }
      }
    ]);
    expect([
      ["conflict", "deleted"],
      ["deleted", "updated"]
    ]).toContainEqual(outcomes.sort());
    expect(outcomes.some((value) => value.startsWith("error:"))).toBe(false);
    const stored = await sidebar(company.token);
    const storedDiagram = stored.diagrams.find((item) => item.id === diagram.id)!;
    expect(storedDiagram.componentIds).not.toContain(component.id);
    expect(storedDiagram.version).toBeGreaterThan(diagram.version ?? 1);
    expect(await prisma.auditLogEntry.count({ where: { companyId: company.companyId } })).toBeGreaterThan(auditBefore);
  });

  it("returns the stored diagram version after adding a connection and accepts it immediately", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const connection = state.connections[0];
    const createdDiagram = await request(app).post("/api/sidebar/diagrams").set(authorized(company.token))
      .send({ name: "Connection response test" });
    expect(createdDiagram.status).toBe(201);
    const componentIds = [connection.sourceComponentId, connection.targetComponentId];
    const populated = await request(app).patch(`/api/sidebar/diagrams/${createdDiagram.body.id}`).set(authorized(company.token))
      .set("If-Match", String(createdDiagram.body.version)).send({
        componentIds,
        positions: Object.fromEntries(componentIds.map((id, index) => [id, { x: index * 100, y: 0 }]))
      });
    expect(populated.status).toBe(200);
    const response = await request(app).post(`/api/sidebar/diagrams/${createdDiagram.body.id}/connections`).set(authorized(company.token)).send({
      connectionTypeId: connection.connectionTypeId,
      sourceComponentId: connection.sourceComponentId,
      targetComponentId: connection.targetComponentId,
      name: connection.name,
      description: connection.description,
      properties: connection.properties
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const aggregate = await request(app).get(`/api/sidebar/diagrams/${createdDiagram.body.id}`).set(authorized(company.token));
    expect(aggregate.status).toBe(200);
    expect(response.body.diagram.version).toBe(aggregate.body.diagram.version);
    const immediatePatch = await request(app).patch(`/api/sidebar/diagrams/${createdDiagram.body.id}`).set(authorized(company.token))
      .set("If-Match", String(response.body.diagram.version)).send({ description: "immediate patch" });
    expect(immediatePatch.status).toBe(200);
  });

  it("creates and places a component atomically and leaves no component on a diagram conflict", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const diagram = state.diagrams[0];
    const type = state.componentTypes.find((item) => !item.isAbstract)!;
    const changed = await request(app).patch(`/api/sidebar/diagrams/${diagram.id}`).set(authorized(company.token))
      .set("If-Match", String(diagram.version)).send({ description: "concurrent diagram change" });
    expect(changed.status).toBe(200);
    const beforeCount = await prisma.componentInstance.count({ where: { companyId: company.companyId } });
    const conflict = await request(app).post(`/api/sidebar/diagrams/${diagram.id}/components`).set(authorized(company.token))
      .set("If-Match", String(diagram.version)).send({ name: "Must roll back", componentTypeId: type.id, properties: {}, position: { x: 20, y: 30 } });
    expect(conflict.status).toBe(409);
    expect(await prisma.componentInstance.count({ where: { companyId: company.companyId } })).toBe(beforeCount);
    expect(await prisma.componentInstance.count({ where: { companyId: company.companyId, name: "Must roll back" } })).toBe(0);

    const created = await request(app).post(`/api/sidebar/diagrams/${diagram.id}/components`).set(authorized(company.token))
      .set("If-Match", String(changed.body.version)).send({ name: "Placed atomically", componentTypeId: type.id, properties: {}, position: { x: 40, y: 50 } });
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    expect(created.body.diagram.componentIds).toContain(created.body.component.id);
    expect(created.body.diagram.positions[created.body.component.id]).toEqual({ x: 40, y: 50 });
  });

  it("protects competing diagram membership writes across backend processes", async () => {
    const company = await registerCompany();
    const state = await sidebar(company.token);
    const diagram = state.diagrams[0];
    const candidates = state.components.filter((item) => !diagram.componentIds.includes(item.id)).slice(0, 2);
    expect(candidates).toHaveLength(2);
    const outcomes = await runWorkers(candidates.map((component, index) => ({
      action: "update-diagram" as const,
      companyId: company.companyId,
      expectedVersion: diagram.version ?? 1,
      diagram: {
        ...diagram,
        componentIds: [...diagram.componentIds, component.id],
        positions: { ...diagram.positions, [component.id]: { x: 100 + index, y: 200 + index } }
      }
    })));
    expect(outcomes.sort()).toEqual(["conflict", "updated"]);
    const stored = await sidebar(company.token);
    const saved = stored.diagrams.find((item) => item.id === diagram.id)!;
    expect(candidates.filter((item) => saved.componentIds.includes(item.id))).toHaveLength(1);
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

    const current = await request(app).get("/api/model/export").set(authorized(company.token));
    const revision = Number(String(current.headers.etag).replaceAll('"', ""));
    expect(revision).toBe((await prisma.architectureModel.findUniqueOrThrow({ where: { companyId: company.companyId } })).revision);
    const imported = await request(app).post("/api/model/import").set(authorized(company.token)).set("If-Match", current.headers.etag).send(current.body);
    expect(imported.status).toBe(200);
    const importedElement = imported.body.elements.find((item: { id: string }) => item.id === element.id);
    expect(importedElement.version).toBeGreaterThan(updated.body.version);
    expect((await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(element.version)).send({ name: "ABA stale" })).status).toBe(409);
    expect((await request(app).patch(path).set(authorized(company.token)).set("If-Match", String(updated.body.version)).send({ name: "ABA stale 2" })).status).toBe(409);
  });
});
