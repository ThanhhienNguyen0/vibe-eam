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
  // The fixture creates its own viewpoint. Make the selected rule generally applicable so the
  // positive import is valid against that viewpoint instead of inheriting unrelated starter ids.
  rule.viewpointIds = [];
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
      viewpointId: ids.viewpoint,
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

function renameMetamodel(document: ModelTransferDocument, id: string): ModelTransferDocument {
  const result = structuredClone(document);
  result.model.metamodel.id = id;
  for (const diagram of result.model.diagrams) diagram.metamodelId = id;
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
      const auditBefore = await prisma.auditLogEntry.count({ where: { companyId: source.companyId } });
      const response = await importModel(source.token, input);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe(expectedCode);
      expect((await exportModel(source.token)).text).toBe(before);
      expect(await prisma.auditLogEntry.count({ where: { companyId: source.companyId } })).toBe(auditBefore);
    };
    const missingVersion = structuredClone(firstExport.body) as Record<string, unknown>;
    delete missingVersion.schemaVersion;
    await unchangedAfter(missingVersion, "SCHEMA_VERSION_REQUIRED");
    await unchangedAfter({ ...firstExport.body, schemaVersion: 0 }, "SCHEMA_VERSION_UNSUPPORTED_LEGACY");
    await unchangedAfter({ ...firstExport.body, schemaVersion: 2 }, "SCHEMA_VERSION_UNSUPPORTED_FUTURE");
    const broken = structuredClone(firstExport.body) as ModelTransferDocument;
    broken.model.diagrams[0].componentIds.push("missing-component");
    await unchangedAfter(broken, "MODEL_REFERENCE_INVALID");
    const denied = structuredClone(firstExport.body) as ModelTransferDocument;
    const importedConnection = denied.model.connections[0];
    const sourceTypeId = denied.model.components.find((item) => item.id === importedConnection.sourceComponentId)!.componentTypeId;
    const targetTypeId = denied.model.components.find((item) => item.id === importedConnection.targetComponentId)!.componentTypeId;
    const matchingRule = denied.model.connectionRules.find((item) => item.sourceComponentTypeId === sourceTypeId
      && item.connectionTypeId === importedConnection.connectionTypeId && item.targetComponentTypeId === targetTypeId)!;
    matchingRule.allowed = false;
    matchingRule.severity = "error";
    await unchangedAfter(denied, "MODEL_DOMAIN_INVALID");
    const selfConnection = structuredClone(firstExport.body) as ModelTransferDocument;
    selfConnection.model.connections[0].targetComponentId = selfConnection.model.connections[0].sourceComponentId;
    await unchangedAfter(selfConnection, "MODEL_DOMAIN_INVALID");
    const viewpointDenied = structuredClone(firstExport.body) as ModelTransferDocument;
    const diagramViewpointRule = viewpointDenied.model.viewpointRules.find((item) => item.viewpointId === viewpointDenied.model.diagrams[0].viewpointId)!;
    const unrelatedTypeId = viewpointDenied.model.componentTypes.find((item) => item.id !== sourceTypeId && item.id !== targetTypeId)!.id;
    diagramViewpointRule.allowedComponentTypeIds = [unrelatedTypeId];
    await unchangedAfter(viewpointDenied, "MODEL_DOMAIN_INVALID");
    const duplicateViewpointRule = structuredClone(firstExport.body) as ModelTransferDocument;
    duplicateViewpointRule.model.viewpointRules.push({
      ...structuredClone(duplicateViewpointRule.model.viewpointRules[0]),
      id: randomUUID()
    });
    await unchangedAfter(duplicateViewpointRule, "MODEL_UNIQUENESS_INVALID");

    // A valid document can still fail inside the transaction. The trigger forces a late DB error;
    // earlier metamodel/component writes and the audit insert must roll back together.
    await prisma.$executeRawUnsafe(`CREATE FUNCTION req33_reject_name() RETURNS trigger AS $$ BEGIN IF NEW.name = 'ATOMIC-FAIL' THEN RAISE EXCEPTION 'REQ33 forced rollback'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER req33_reject_name BEFORE INSERT OR UPDATE ON "ComponentInstance" FOR EACH ROW EXECUTE FUNCTION req33_reject_name()`);
    const atomic = renameMetamodel(firstExport.body as ModelTransferDocument, "atomic-replacement-metamodel");
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

  it("deletes the previous company model graph when a replacement changes metamodel ids", async () => {
    const company = await registerCompany();
    const starter = await exportModel(company.token);
    expect(starter.status).toBe(200);

    const first = renameMetamodel(fixtureFrom(starter.body as ModelTransferDocument), "first-replacement-metamodel");
    expect((await importModel(company.token, first)).status).toBe(200);
    expect(await prisma.componentInstance.count({ where: { companyId: company.companyId } })).toBe(2);
    expect(await prisma.metamodel.count({ where: { companyId: company.companyId } })).toBe(1);

    const empty = renameMetamodel(starter.body as ModelTransferDocument, "empty-replacement-metamodel");
    empty.model.componentTypes = [];
    empty.model.connectionTypes = [];
    empty.model.connectionRules = [];
    empty.model.viewpoints = [];
    empty.model.viewpointRules = [];
    empty.model.validationRules = [];
    empty.model.components = [];
    empty.model.connections = [];
    empty.model.diagrams = [];
    empty.model.catalogs = [];
    const emptyImport = await importModel(company.token, empty);
    expect(emptyImport.status, JSON.stringify(emptyImport.body)).toBe(200);
    expect(await prisma.componentInstance.count({ where: { companyId: company.companyId } })).toBe(0);
    expect(await prisma.connectionInstance.count({ where: { companyId: company.companyId } })).toBe(0);
    expect(await prisma.diagram.count({ where: { companyId: company.companyId } })).toBe(0);
    expect(await prisma.componentType.count({ where: { metamodel: { companyId: company.companyId } } })).toBe(0);
    expect(await prisma.metamodel.count({ where: { companyId: company.companyId } })).toBe(1);

    const reused = renameMetamodel(fixtureFrom(starter.body as ModelTransferDocument), "reused-external-id-metamodel");
    const reusedImport = await importModel(company.token, reused);
    expect(reusedImport.status, JSON.stringify(reusedImport.body)).toBe(200);
    expect(await prisma.componentInstance.count({ where: { companyId: company.companyId, externalId: "EXT-Ü-001" } })).toBe(1);
    expect(await prisma.metamodel.count({ where: { companyId: company.companyId } })).toBe(1);
  }, 30_000);

  it("overwrites exported timestamps and clears every nullable upsert field across companies", async () => {
    const source = await registerCompany();
    const target = await registerCompany();
    const starter = await exportModel(source.token);
    expect(starter.status).toBe(200);

    const sourceDocument = renameMetamodel(starter.body as ModelTransferDocument, "upsert-field-audit");
    sourceDocument.model.metamodel.createdAt = "2001-02-03T04:05:06.000Z";
    sourceDocument.model.metamodel.updatedAt = "2002-03-04T05:06:07.000Z";
    sourceDocument.model.components = [];
    sourceDocument.model.connections = [];
    sourceDocument.model.catalogs = [];
    const componentType = sourceDocument.model.componentTypes[0];
    delete componentType.layer;
    delete componentType.category;
    delete componentType.shape;
    delete componentType.isRequiredInViewpoint;
    const connectionType = sourceDocument.model.connectionTypes[0];
    delete connectionType.directionDescription;
    delete connectionType.category;
    delete connectionType.semanticCategory;
    const viewpoint = sourceDocument.model.viewpoints[0];
    delete viewpoint.maxVisibleLayers;
    const connectionRule = sourceDocument.model.connectionRules[0];
    delete connectionRule.minOccurrences;
    delete connectionRule.maxOccurrences;
    const viewpointRule = sourceDocument.model.viewpointRules[0];
    delete viewpointRule.description;
    delete viewpointRule.severity;
    const auditValidationRule = {
      id: randomUUID(),
      name: "Nullable upsert audit",
      description: "",
      scope: "metamodel" as const,
      direction: "outgoing" as const,
      minOccurrences: 0,
      severity: "warning" as const,
      message: "Not applicable to empty diagram",
      active: true
    };
    sourceDocument.model.validationRules.push(auditValidationRule);
    const emptyViewpoint = {
      id: randomUUID(), name: "Empty audit view", description: "", stakeholderRole: "Architect", purpose: "Audit",
      allowedComponentTypeIds: [], allowedConnectionTypeIds: [], requiredComponentTypeIds: [], requiredConnectionTypeIds: []
    };
    sourceDocument.model.viewpoints.push(emptyViewpoint);
    sourceDocument.model.diagrams = [{
      id: randomUUID(), name: "Empty audit diagram", description: "", metamodelId: sourceDocument.model.metamodel.id,
      componentIds: [], connectionIds: [], positions: {}
    }];

    const targetDocument = structuredClone(sourceDocument);
    targetDocument.model.metamodel.createdAt = "2010-11-12T13:14:15.000Z";
    targetDocument.model.metamodel.updatedAt = "2011-12-13T14:15:16.000Z";
    Object.assign(targetDocument.model.componentTypes[0], {
      layer: "Legacy", category: "Legacy", shape: "box", isRequiredInViewpoint: true
    });
    Object.assign(targetDocument.model.connectionTypes[0], {
      directionDescription: "Legacy", category: "Legacy", semanticCategory: "Legacy"
    });
    targetDocument.model.viewpoints[0].maxVisibleLayers = 99;
    Object.assign(targetDocument.model.connectionRules[0], { minOccurrences: 0, maxOccurrences: 99 });
    Object.assign(targetDocument.model.viewpointRules[0], { description: "Legacy", severity: "warning" });
    Object.assign(targetDocument.model.validationRules.at(-1)!, {
      viewpointId: emptyViewpoint.id,
      sourceComponentTypeId: componentType.id,
      requiredConnectionTypeId: connectionType.id,
      targetComponentTypeId: componentType.id
    });
    targetDocument.model.diagrams[0].viewpointId = emptyViewpoint.id;

    expect((await importModel(source.token, sourceDocument)).status).toBe(200);
    expect((await importModel(target.token, targetDocument)).status).toBe(200);
    const portableSource = await exportModel(source.token);
    expect(portableSource.body.model.metamodel.createdAt).toBe("2001-02-03T04:05:06.000Z");
    expect(portableSource.body.model.metamodel.updatedAt).toBe("2002-03-04T05:06:07.000Z");
    const targetImport = await importModel(target.token, portableSource.body);
    expect(targetImport.status, JSON.stringify(targetImport.body)).toBe(200);
    const targetExport = await exportModel(target.token);
    expect(targetExport.text).toBe(portableSource.text);
  }, 30_000);
});
