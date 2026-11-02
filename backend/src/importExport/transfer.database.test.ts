import { randomUUID } from "node:crypto";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../server.js";
import { PrismaAuthRepository } from "../auth/prismaAuthRepository.js";
import type { Role } from "../auth/policy.js";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import { parseXlsx, serializeCsv } from "./tabular.js";

// Runs only against the isolated cluster started by scripts/test-rbac-db.mjs (or an equivalent req24_test_ database).
const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith("/req24_test_")) throw new Error("Only isolated req24_test_ databases are permitted.");
const secret = "req31-database-test-only-signing-secret-32-characters";
const prisma = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const repository = new PrismaAuthRepository(prisma);
const app = createApp({ jwtSecret: secret, authRepository: repository, userRepository: repository });
const password = "req31-local-test-only-password";
afterAll(async () => prisma.$disconnect());

async function registerCompany() {
  const email = `${randomUUID()}@example.invalid`;
  const result = await request(app).post("/api/auth/register").send({ email, password, companyName: `REQ31 Test ${email}` });
  expect(result.status).toBe(201);
  return { token: result.body.token as string, email, companyId: result.body.user.companyId as string };
}

async function addUser(adminToken: string, role: Role) {
  const email = `${randomUUID()}@example.invalid`;
  expect((await request(app).post("/api/users").set("Authorization", `Bearer ${adminToken}`).send({ email, password, role })).status).toBe(201);
  const login = await request(app).post("/api/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  return login.body.token as string;
}

const upload = (method: "preview" | "commit", token: string, body: Buffer, query = "fileName=e2e.csv") =>
  request(app).post(`/api/sidebar/import/${method}?${query}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/octet-stream").send(body);
const csv = (rows: string[][]) => Buffer.from(serializeCsv(rows), "utf-8");
const sidebar = async (token: string) => (await request(app).get("/api/sidebar").set("Authorization", `Bearer ${token}`)).body as SidebarState;

function pickRule(state: SidebarState) {
  const rule = state.connectionRules.find((item) => item.allowed
    && state.componentTypes.some((type) => type.id === item.sourceComponentTypeId && !type.isAbstract)
    && state.componentTypes.some((type) => type.id === item.targetComponentTypeId && !type.isAbstract));
  if (!rule) throw new Error("starter metamodel has no usable connection rule");
  return {
    source: state.componentTypes.find((type) => type.id === rule.sourceComponentTypeId)!,
    target: state.componentTypes.find((type) => type.id === rule.targetComponentTypeId)!,
    connection: state.connectionTypes.find((type) => type.id === rule.connectionTypeId)!
  };
}

describe.skipIf(!url)("REQ-31 import/export against real PostgreSQL", () => {
  it("imports elements and relations, persists external ids, audits the import and round-trips through XLSX", async () => {
    const admin = await registerCompany();
    const architect = await addUser(admin.token, "Architect");
    const viewer = await addUser(admin.token, "Viewer");
    const state = await sidebar(admin.token);
    const { source, target, connection } = pickRule(state);
    const before = state.components.length;

    const file = csv([
      ["Externe ID", "Typ", "Name", "Beschreibung"],
      ["EXT-A", source.name, "E2E Source", "imported"],
      ["EXT-B", target.name, "E2E Target", ""]
    ]);
    const relations = csv([
      ["Externe ID", "Typ", "Quelle", "Ziel"],
      ["EXT-REL", connection.name, "EXT-A", "EXT-B"]
    ]);

    // Viewer is read-only for imports; the dry run alone never writes.
    expect((await upload("preview", viewer, file)).status).toBe(403);
    const preview = await upload("preview", architect, file);
    expect(preview.status).toBe(200);
    expect(preview.body.summary.elements.new).toBe(2);
    expect((await sidebar(admin.token)).components).toHaveLength(before);
    expect(await prisma.auditLogEntry.count({ where: { companyId: admin.companyId } })).toBe(0);

    // Elements first (relations reference the persisted external ids).
    expect((await upload("commit", architect, file)).body.applied).toBe(true);
    const relationCommit = await upload("commit", architect, relations, "fileName=rel.csv");
    expect(relationCommit.status, JSON.stringify(relationCommit.body.rows)).toBe(200);
    expect(relationCommit.body.summary.relations.new).toBe(1);

    const stored = await prisma.componentInstance.findMany({ where: { companyId: admin.companyId, externalId: { in: ["EXT-A", "EXT-B"] } } });
    expect(stored.map((item) => item.externalId).sort()).toEqual(["EXT-A", "EXT-B"]);
    const storedRelation = await prisma.connectionInstance.findFirstOrThrow({ where: { companyId: admin.companyId, externalId: "EXT-REL" } });
    expect(storedRelation.connectionTypeId).toBe(connection.id);

    // Audit entries: one per commit, with the acting user, inside the company only.
    const entries = await prisma.auditLogEntry.findMany({ where: { companyId: admin.companyId }, orderBy: { createdAt: "asc" } });
    expect(entries.map((entry) => entry.action)).toEqual(["import.commit", "import.commit"]);
    expect(entries[0].userEmail).toMatch(/@example\.invalid$/);
    expect(entries[0].summary).toContain("2 neu");
    expect(entries[0].details).toMatchObject({ fileName: "e2e.csv", format: "csv", elements: { new: 2 } });
    const log = await request(app).get("/api/sidebar/audit-log").set("Authorization", `Bearer ${architect}`);
    expect(log.status).toBe(200);
    expect(log.body).toHaveLength(2);
    expect((await request(app).get("/api/sidebar/audit-log").set("Authorization", `Bearer ${viewer}`)).status).toBe(403);

    // Export (also for Viewers) and re-import of the unmodified workbook changes nothing.
    const exported = await request(app).get("/api/sidebar/export").set("Authorization", `Bearer ${viewer}`)
      .buffer(true).parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
    expect(exported.status).toBe(200);
    const sheets = await parseXlsx(exported.body as Buffer);
    expect(sheets[0].rows.flat()).toEqual(expect.arrayContaining(["EXT-A", "E2E Source"]));
    const again = await upload("preview", architect, exported.body as Buffer, "fileName=roundtrip.xlsx");
    expect(again.status).toBe(200);
    expect(again.body.errorCount).toBe(0);
    expect(again.body.canCommit).toBe(false);
    expect(again.body.rows.every((row: { status: string }) => row.status === "unchanged")).toBe(true);

    // Update through the external id.
    const update = await upload("commit", architect, csv([["Externe ID", "Typ", "Name"], ["EXT-A", "", "E2E Source (renamed)"]]), "fileName=upd.csv");
    expect(update.body.summary.elements.changed).toBe(1);
    const renamed = await prisma.componentInstance.findFirstOrThrow({ where: { companyId: admin.companyId, externalId: "EXT-A" } });
    expect(renamed.name).toBe("E2E Source (renamed)");
    expect(await prisma.auditLogEntry.count({ where: { companyId: admin.companyId } })).toBe(3);
  });

  it("keeps external ids unique per company only, and audit logs isolated", async () => {
    const first = await registerCompany();
    const second = await registerCompany();
    const type = (await sidebar(first.token)).componentTypes.find((item) => !item.isAbstract)!;
    const secondType = (await sidebar(second.token)).componentTypes.find((item) => !item.isAbstract)!;

    const create = (token: string, typeId: string, name: string, externalId: string) =>
      request(app).post("/api/sidebar/components").set("Authorization", `Bearer ${token}`).send({ name, componentTypeId: typeId, externalId });
    expect((await create(first.token, type.id, "One", "SHARED")).status).toBe(201);
    expect((await create(first.token, type.id, "Two", "SHARED")).status).toBe(409);
    expect((await create(second.token, secondType.id, "Other company", "SHARED")).status).toBe(201);

    const other = await create(first.token, type.id, "Three", "UNIQUE");
    expect(other.status).toBe(201);
    const clash = await request(app).patch(`/api/sidebar/components/${other.body.id}`).set("Authorization", `Bearer ${first.token}`).send({ externalId: "SHARED" });
    expect(clash.status).toBe(409);
    const cleared = await request(app).patch(`/api/sidebar/components/${other.body.id}`).set("Authorization", `Bearer ${first.token}`).send({ externalId: "" });
    expect(cleared.status).toBe(200);
    expect(cleared.body.externalId).toBeUndefined();

    await upload("commit", first.token, csv([["Typ", "Name"], [type.name, "Only first"]]));
    expect((await request(app).get("/api/sidebar/audit-log").set("Authorization", `Bearer ${first.token}`)).body).toHaveLength(1);
    expect((await request(app).get("/api/sidebar/audit-log").set("Authorization", `Bearer ${second.token}`)).body).toHaveLength(0);
  });
});
