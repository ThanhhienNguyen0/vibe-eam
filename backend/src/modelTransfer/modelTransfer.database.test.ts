import { randomUUID } from "node:crypto";
import request from "supertest";
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../server.js";
import { PrismaAuthRepository } from "../auth/prismaAuthRepository.js";
import type { Role } from "../auth/policy.js";
import type { ModelTransferDocument } from "./modelTransfer.js";

// Runs only in the disposable PostgreSQL cluster created by scripts/test-rbac-db.mjs.
const url = process.env.TEST_DATABASE_URL;
if (url && !new URL(url).pathname.startsWith("/req24_test_")) throw new Error("Only isolated req24_test_ databases are permitted.");
const prisma = new PrismaClient(url ? { datasourceUrl: url } : undefined);
const repository = new PrismaAuthRepository(prisma);
const app = createApp({
  jwtSecret: "req33-database-test-only-signing-secret-32-characters",
  authRepository: repository,
  userRepository: repository
});
const password = "req33-local-test-only-password";
afterAll(async () => prisma.$disconnect());

async function registerCompany() {
  const email = `${randomUUID()}@example.invalid`;
  const response = await request(app).post("/api/auth/register").send({ email, password, companyName: `REQ33 ${email}` });
  expect(response.status).toBe(201);
  return { token: response.body.token as string, companyId: response.body.user.companyId as string };
}

async function addUser(adminToken: string, role: Role) {
  const email = `${randomUUID()}@example.invalid`;
  expect((await request(app).post("/api/users").set("Authorization", `Bearer ${adminToken}`).send({ email, password, role })).status).toBe(201);
  const login = await request(app).post("/api/auth/login").send({ email, password });
  expect(login.status).toBe(200);
  return login.body.token as string;
}

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const exportModel = (token: string) => request(app).get("/api/sidebar/model/export").set(auth(token));
const importModel = (token: string, document: object) => request(app).post("/api/sidebar/model/import").set(auth(token)).send(document);

function fixtureFrom(document: ModelTransferDocument): ModelTransferDocument {
  const result = structuredClone(document);
  const state = result.model;
  const rule = state.connectionRules.find((item) => item.allowed
    && state.componentTypes.some((type) => type.id === item.sourceComponentTypeId && !type.isAbstract)
    && state.componentTypes.some((type) => type.id === item.targetComponentTypeId && !type.isAbstract));
  if (!rule) throw new Error("Starter metamodel has no usable connection rule.");
  const fixtureComponentTypeIds = [...new Set([rule.sourceComponentTypeId, rule.targetComponentTypeId])];
  const ids = {
    source: randomUUID(),
    target: randomUUID(),
    connection: randomUUID(),
    viewpoint: randomUUID(),
    viewpointRule: randomUUID(),
    validationRule: randomUUID(),
    firstDiagram: randomUUID(),
    secondDiagram: randomUUID(),
    catalog: randomUUID()
  };
  state.metamodel.version = "req33-domain-7";
  state.metamodel.updatedAt = "2026-11-04T12:00:00.000Z";
  state.components = [
    {
      id: ids.source,
      externalId: "EXT-Ü-001",
      name: "Quellsystem 世界",
      componentTypeId: rule.sourceComponentTypeId,
      description: "",
      properties: { owner: "Team A", empty: "", unicode: "Grüße aus Konstanz" }
    },
    {
      id: ids.target,
      externalId: "EXT-002",
      name: "Zielsystem",
      componentTypeId: rule.targetComponentTypeId,
      description: "Optional leer",
      properties: { criticality: "high" }
    }
  ];
  state.connections = [{
    id: ids.connection,
    externalId: "REL-001",
    name: "",
    connectionTypeId: rule.connectionTypeId,
    sourceComponentId: ids.source,
    targetComponentId: ids.target,
    description: "",
    properties: { protocol: "HTTPS" }
  }];
  state.viewpoints.push({
    id: ids.viewpoint,
    name: "REQ-33 Sicht",
    description: "REQ-33 portable viewpoint",
    stakeholderRole: "Architekt",
    purpose: "Round-Trip",
    visibleLayerIds: [],
    allowedComponentTypeIds: fixtureComponentTypeIds,
    allowedConnectionTypeIds: [rule.connectionTypeId],
    requiredComponentTypeIds: [],
    requiredConnectionTypeIds: [],
    requiredConnectionRuleIds: [rule.id]
  });
  state.viewpointRules.push({
    id: ids.viewpointRule,
    viewpointId: ids.viewpoint,
    allowedComponentTypeIds: fixtureComponentTypeIds,
    allowedConnectionTypeIds: [rule.connectionTypeId],
    allowedConnectionRuleIds: [rule.id],
    requiredComponentTypeIds: [],
    requiredConnectionTypeIds: [],
    requiredConnectionRuleIds: [],
    editableComponentTypeIds: [rule.sourceComponentTypeId],
    visibleComponentTypeIds: fixtureComponentTypeIds,
    description: "REQ-33 portable viewpoint rule",
    severity: "warning"
  });
  state.validationRules.push({
    id: ids.validationRule,
    name: "Quelle benötigt Verbindung",
    description: "REQ-33 validation rule",
    scope: "viewpoint",
    viewpointId: ids.viewpoint,
    sourceComponentTypeId: rule.sourceComponentTypeId,
    requiredConnectionTypeId: rule.connectionTypeId,
    targetComponentTypeId: rule.targetComponentTypeId,
    direction: "outgoing",
    minOccurrences: 1,
    severity: "warning",
    message: "Verbindung fehlt",
    active: true
  });
  state.diagrams = [
    {
      id: ids.firstDiagram,
      name: "Primärdiagramm",
      description: "",
      metamodelId: state.metamodel.id,
      viewpointId: ids.viewpoint,
      componentIds: [ids.target, ids.source],
      connectionIds: [ids.connection],
      positions: { [ids.source]: { x: 10.5, y: -4, width: 180, height: 72 }, [ids.target]: { x: 430, y: 90 } }
    },
    {
      id: ids.secondDiagram,
      name: "Geteilte Elemente",
      description: "Zweites Diagramm",
      metamodelId: state.metamodel.id,
      componentIds: [ids.source, ids.target],
      connectionIds: [ids.connection],
      positions: { [ids.source]: { x: 1, y: 2 }, [ids.target]: { x: 3, y: 4, width: 220, height: 80 } }
    }
  ];
  state.catalogs = [{
    id: ids.catalog,
    name: "Unicode-Katalog Ä",
    description: "",
    kind: "elements",
    componentTypeIds: fixtureComponentTypeIds,
    connectionTypeIds: [],
    propertyKeys: ["owner", "empty", "unicode"],
    columns: ["name", "description", "externalId"]
  }];
  return result;
}

describe.skipIf(!url)("REQ-33 complete JSON round-trip against real PostgreSQL", () => {
  it("replaces a company model losslessly, enforces versions/references/roles/tenants and preserves audit", async () => {
    const source = await registerCompany();
    const architect = await addUser(source.token, "Architect");
    const viewer = await addUser(source.token, "Viewer");
    expect((await exportModel("invalid-token")).status).toBe(401);
    expect((await exportModel(viewer)).status).toBe(200);

    const starter = await exportModel(source.token);
    expect(starter.status).toBe(200);
    const fixture = fixtureFrom(starter.body as ModelTransferDocument);
    expect((await importModel(architect, fixture)).status).toBe(403);
    const firstImport = await importModel(source.token, fixture);
    expect(firstImport.status, JSON.stringify(firstImport.body)).toBe(200);

    const firstExport = await exportModel(viewer);
    expect(firstExport.status).toBe(200);
    const firstText = firstExport.text;
    expect(firstExport.body.schemaVersion).toBe(1);
    expect(firstExport.body.model.metamodel.version).toBe("req33-domain-7");
    expect(Object.keys(firstExport.body.model).sort()).toEqual([
      "catalogs", "componentTypes", "components", "connectionRules", "connectionTypes", "connections",
      "diagrams", "metamodel", "validationRules", "viewpointRules", "viewpoints"
    ]);
    expect(firstText).not.toContain("passwordHash");
    expect(firstText).not.toContain("auditLog");
    expect(firstText).not.toContain(source.companyId);

    const changed = structuredClone(firstExport.body) as ModelTransferDocument;
    changed.model.components[0].name = "Zwischenzustand";
    expect((await importModel(source.token, changed)).status).toBe(200);
    const restored = await importModel(source.token, firstExport.body);
    expect(restored.status).toBe(200);
    const secondExport = await exportModel(source.token);
    expect(secondExport.text).toBe(firstText);
    expect(await prisma.auditLogEntry.count({ where: { companyId: source.companyId, action: "model-json.import" } })).toBe(3);

    const unchangedAfter = async (input: object, expectedCode: string) => {
      const before = (await exportModel(source.token)).text;
      const response = await importModel(source.token, input);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(expectedCode);
      expect((await exportModel(source.token)).text).toBe(before);
    };
    const missingVersion = structuredClone(firstExport.body) as Record<string, unknown>;
    delete missingVersion.schemaVersion;
    await unchangedAfter(missingVersion, "SCHEMA_VERSION_REQUIRED");
    await unchangedAfter({ ...firstExport.body, schemaVersion: 0 }, "SCHEMA_VERSION_UNSUPPORTED_LEGACY");
    await unchangedAfter({ ...firstExport.body, schemaVersion: 2 }, "SCHEMA_VERSION_UNSUPPORTED_FUTURE");
    const broken = structuredClone(firstExport.body) as ModelTransferDocument;
    broken.model.diagrams[0].componentIds.push("missing-component");
    await unchangedAfter(broken, "MODEL_REFERENCE_INVALID");

    // A valid document can still fail inside the transaction. The trigger forces a late DB error;
    // earlier metamodel/component writes and the audit insert must roll back together.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION req33_reject_name() RETURNS trigger AS $$ BEGIN IF NEW.name = 'ATOMIC-FAIL' THEN RAISE EXCEPTION 'REQ33 forced rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER req33_reject_name BEFORE INSERT OR UPDATE ON "ComponentInstance" FOR EACH ROW EXECUTE FUNCTION req33_reject_name()`);
    const atomic = structuredClone(firstExport.body) as ModelTransferDocument;
    atomic.model.components[0].name = "ATOMIC-FAIL";
    const beforeAtomic = (await exportModel(source.token)).text;
    const auditBeforeAtomic = await prisma.auditLogEntry.count({ where: { companyId: source.companyId } });
    expect((await importModel(source.token, atomic)).status).toBe(500);
    expect((await exportModel(source.token)).text).toBe(beforeAtomic);
    expect(await prisma.auditLogEntry.count({ where: { companyId: source.companyId } })).toBe(auditBeforeAtomic);
    await prisma.$executeRawUnsafe(`DROP TRIGGER req33_reject_name ON "ComponentInstance"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION req33_reject_name()`);

    // Existing partial formats remain operational: legacy model JSON, metamodel JSON and CSV/XLSX.
    const legacy = await request(app).get("/api/model/export").set(auth(source.token));
    expect(legacy.status).toBe(200);
    expect((await request(app).post("/api/model/import").set(auth(source.token)).send(legacy.body)).status).toBe(200);
    const metamodel = await request(app).get("/api/sidebar/metamodel/export").set(auth(source.token));
    expect(metamodel.status).toBe(200);
    const metamodelImport = await request(app).post("/api/sidebar/metamodel/import").set(auth(source.token)).send(metamodel.body);
    expect(metamodelImport.status, JSON.stringify(metamodelImport.body)).toBe(200);
    expect(metamodelImport.body.success, JSON.stringify(metamodelImport.body)).toBe(true);
    for (const format of ["csv", "xlsx"] as const) {
      const sheetQuery = format === "csv" ? "&sheet=elements" : "";
      const tabular = await request(app).get(`/api/sidebar/export?format=${format}${sheetQuery}`).set(auth(viewer)).buffer(true).parse((res, callback) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => callback(null, Buffer.concat(chunks)));
      });
      expect(tabular.status).toBe(200);
      const preview = await request(app).post(`/api/sidebar/import/preview?fileName=roundtrip.${format}${sheetQuery}`).set(auth(architect))
        .set("Content-Type", "application/octet-stream").send(tabular.body as Buffer);
      expect(preview.status, JSON.stringify(preview.body)).toBe(200);
      expect(preview.body.errorCount).toBe(0);
    }

    // Portable IDs are company-neutral and remapped to target-local storage IDs. The identical
    // file can exist in two companies at once without changing either exported document.
    const sourceBeforeTargetImport = (await exportModel(source.token)).text;
    const target = await registerCompany();
    const portable = await importModel(target.token, firstExport.body);
    expect(portable.status).toBe(200);
    expect((await exportModel(target.token)).text).toBe(firstText);
    expect((await exportModel(source.token)).text).toBe(sourceBeforeTargetImport);
    const sourceStoredId = await prisma.componentInstance.findFirstOrThrow({ where: { companyId: source.companyId }, select: { id: true } });
    const targetStoredId = await prisma.componentInstance.findFirstOrThrow({ where: { companyId: target.companyId }, select: { id: true } });
    expect(sourceStoredId.id).not.toBe(targetStoredId.id);
    expect(sourceStoredId.id.startsWith(`${source.companyId}:`)).toBe(true);
    expect(targetStoredId.id.startsWith(`${target.companyId}:`)).toBe(true);
  }, 30_000);
});
