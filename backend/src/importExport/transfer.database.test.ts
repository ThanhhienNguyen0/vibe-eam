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

const upload = async (method: "preview" | "commit", token: string, body: Buffer, query = "fileName=e2e.csv") => {
  if (method === "preview") return request(app).post(`/api/sidebar/import/preview?${query}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/octet-stream").send(body);
  const preview = await request(app).post(`/api/sidebar/import/preview?${query}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/octet-stream").send(body);
  return request(app).post(`/api/sidebar/import/commit?${query}&expectedRevision=${preview.body.dataRevision}`).set("Authorization", `Bearer ${token}`).set("Content-Type", "application/octet-stream").send(body);
};
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
    const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: admin.companyId } });

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
    expect(await prisma.auditLogEntry.count({ where: { companyId: admin.companyId } })).toBe(auditBefore);

    // Elements first (relations reference the persisted external ids).
    const elementCommit = await upload("commit", architect, file);
    expect(elementCommit.status, JSON.stringify(elementCommit.body)).toBe(200);
    expect(elementCommit.body.applied).toBe(true);
    const relationCommit = await upload("commit", architect, relations, "fileName=rel.csv");
    expect(relationCommit.status, JSON.stringify(relationCommit.body.rows)).toBe(200);
    expect(relationCommit.body.summary.relations.new).toBe(1);

    const stored = await prisma.componentInstance.findMany({ where: { companyId: admin.companyId, externalId: { in: ["EXT-A", "EXT-B"] } } });
    expect(stored.map((item) => item.externalId).sort()).toEqual(["EXT-A", "EXT-B"]);
    const storedRelation = await prisma.connectionInstance.findFirstOrThrow({ where: { companyId: admin.companyId, externalId: "EXT-REL" } });
    expect(storedRelation.connectionTypeId).toBe(connection.id);

    // Audit entries: one per commit, with the acting user, inside the company only.
    const entries = await prisma.auditLogEntry.findMany({ where: { companyId: admin.companyId, action: "import.commit" }, orderBy: { createdAt: "asc" } });
    expect(entries.map((entry) => entry.action)).toEqual(["import.commit", "import.commit"]);
    expect(entries[0].userEmail).toMatch(/@example\.invalid$/);
    expect(entries[0].summary).toContain("2 neu");
    expect(entries[0].details).toMatchObject({ fileName: "e2e.csv", format: "csv", elements: { new: 2 } });
    const log = await request(app).get("/api/sidebar/audit-log").set("Authorization", `Bearer ${architect}`);
    expect(log.status).toBe(200);
    expect(log.body.items.filter((entry: { action: string }) => entry.action === "import.commit")).toHaveLength(2);
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
    expect(await prisma.auditLogEntry.count({ where: { companyId: admin.companyId, action: "import.commit" } })).toBe(3);
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
    const clash = await request(app).patch(`/api/sidebar/components/${other.body.id}`).set("Authorization", `Bearer ${first.token}`).set("If-Match", String(other.body.version)).send({ externalId: "SHARED" });
    expect(clash.status).toBe(409);
    const cleared = await request(app).patch(`/api/sidebar/components/${other.body.id}`).set("Authorization", `Bearer ${first.token}`).set("If-Match", String(other.body.version)).send({ externalId: "" });
    expect(cleared.status).toBe(200);
    expect(cleared.body.externalId).toBeUndefined();

    await upload("commit", first.token, csv([["Typ", "Name"], [type.name, "Only first"]]));
    const firstLog = await request(app).get("/api/sidebar/audit-log?action=import.commit").set("Authorization", `Bearer ${first.token}`);
    const secondLog = await request(app).get("/api/sidebar/audit-log?action=import.commit").set("Authorization", `Bearer ${second.token}`);
    expect(firstLog.body.items).toHaveLength(1);
    expect(secondLog.body.items).toHaveLength(0);
  });

  it("seeds starter catalogs once and persists create, update, delete and catalog export per company", async () => {
    const admin = await registerCompany();
    const other = await registerCompany();
    const viewer = await addUser(admin.token, "Viewer");
    const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

    const state = await sidebar(admin.token);
    expect(state.catalogs.length).toBeGreaterThan(3);
    const starterCount = state.catalogs.length;
    const apps = state.catalogs.find((item) => item.name === "Anwendungslandschaft")!;
    expect(apps.componentTypeIds.every((id) => state.componentTypes.some((type) => type.id === id))).toBe(true);

    const created = await request(app).post("/api/sidebar/catalogs").set(auth(admin.token))
      .send({ name: "Eigener Katalog", kind: "elements", componentTypeIds: apps.componentTypeIds, propertyKeys: ["owner"], columns: ["description"] });
    expect(created.status).toBe(201);
    expect((await request(app).post("/api/sidebar/catalogs").set(auth(viewer)).send({ name: "x" })).status).toBe(403);
    expect((await request(app).patch(`/api/sidebar/catalogs/${created.body.id}`).set(auth(admin.token)).send({ name: "Umbenannt", columns: ["bogus"] })).status).toBe(400);
    expect((await request(app).patch(`/api/sidebar/catalogs/${created.body.id}`).set(auth(admin.token)).send({ name: "Umbenannt" })).status).toBe(200);

    // Persisted and isolated: the other company neither sees nor can change the catalog.
    const reloaded = await sidebar(admin.token);
    expect(reloaded.catalogs.find((item) => item.id === created.body.id)?.name).toBe("Umbenannt");
    expect((await sidebar(other.token)).catalogs.some((item) => item.id === created.body.id)).toBe(false);
    expect((await request(app).delete(`/api/sidebar/catalogs/${created.body.id}`).set(auth(other.token))).status).toBe(404);

    const exported = await request(app).get(`/api/sidebar/export?format=csv&catalogId=${created.body.id}`).set(auth(viewer))
      .buffer(true).parse((res, callback) => { const chunks: Buffer[] = []; res.on("data", (chunk: Buffer) => chunks.push(chunk)); res.on("end", () => callback(null, Buffer.concat(chunks))); });
    expect(exported.status).toBe(200);
    expect(exported.body.toString("utf-8").split("\n")[0]).toContain("Beschreibung");

    // Deleted starter catalogs must not come back (seeding happens only once per company).
    expect((await request(app).delete(`/api/sidebar/catalogs/${created.body.id}`).set(auth(admin.token))).status).toBe(204);
    expect((await request(app).delete(`/api/sidebar/catalogs/${apps.id}`).set(auth(admin.token))).status).toBe(204);
    const finalState = await sidebar(admin.token);
    expect(finalState.catalogs).toHaveLength(starterCount - 1);
    expect(finalState.catalogs.some((item) => item.id === apps.id)).toBe(false);
  });
});
