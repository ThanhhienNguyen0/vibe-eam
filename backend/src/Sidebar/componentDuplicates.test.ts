import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../server.js";
import type { AuthRepository, StoredUser, UserRepository } from "../auth/authTypes.js";
import type { AuditEntryInput } from "../audit/auditTypes.js";
import type { ComponentInstance, ComponentType } from "./sidebarTypes.js";
import { duplicateAuditEvent, duplicateComponentWarnings, findDuplicateComponents, findDuplicatesByName, normalizeComponentName } from "./componentDuplicates.js";

const repositoryComponents: ComponentInstance[] = [];
const repositoryTypes: ComponentType[] = [];

// Every store write receives the optional REQ-23 business event as its last argument.
const store = vi.hoisted(() => ({
  addComponent: vi.fn(),
  updateComponent: vi.fn(),
  addComponentType: vi.fn(),
  updateComponentType: vi.fn()
}));

vi.mock("./sidebarStore.js", async (original) => ({
  ...await original<typeof import("./sidebarStore.js")>(),
  getComponents: vi.fn(async () => structuredClone(repositoryComponents)),
  addComponent: store.addComponent,
  updateComponent: store.updateComponent,
  getComponentTypes: vi.fn(async () => structuredClone(repositoryTypes)),
  addComponentType: store.addComponentType,
  updateComponentType: store.updateComponentType
}));

const component = (id: string, name: string, componentTypeId = "ct-app"): ComponentInstance =>
  ({ id, version: 1, name, componentTypeId, properties: {}, description: "" });

const lastEvent = (mock: ReturnType<typeof vi.fn>): AuditEntryInput | undefined => mock.mock.calls.at(-1)?.at(-1) as AuditEntryInput | undefined;

describe("REQ-02 duplicate detection rules", () => {
  it("normalizes case and whitespace", () => {
    expect(normalizeComponentName("  SAP   ERP ")).toBe(normalizeComponentName("sap erp"));
    expect(normalizeComponentName("SAP ERP")).toBe(normalizeComponentName("SAPERP"));
    expect(normalizeComponentName("SAP ERP")).not.toBe(normalizeComponentName("SAP CRM"));
  });

  it("only matches within the same component type and excludes the element itself", () => {
    const items = [component("a", "CRM"), component("b", "crm", "ct-capability"), component("c", "C R M")];
    expect(findDuplicateComponents(items, { name: "Crm", componentTypeId: "ct-app" }).map((item) => item.id)).toEqual(["a", "c"]);
    expect(findDuplicateComponents(items, { name: "CRM", componentTypeId: "ct-app" }, "a").map((item) => item.id)).toEqual(["c"]);
    expect(findDuplicateComponents(items, { name: "   ", componentTypeId: "ct-app" })).toEqual([]);
  });

  it("compares metamodel types by name only", () => {
    const types = [{ id: "t1", name: "Duplikat" }, { id: "t2", name: "Server" }];
    expect(findDuplicatesByName(types, " duplikat ").map((item) => item.id)).toEqual(["t1"]);
    expect(findDuplicatesByName(types, "Duplikat", "t1")).toEqual([]);
  });

  it("builds one warning listing all duplicates", () => {
    expect(duplicateComponentWarnings([])).toEqual([]);
    expect(duplicateComponentWarnings([component("a", "CRM")])).toEqual([
      expect.objectContaining({ code: "DUPLICATE_COMPONENT", duplicates: [{ id: "a", name: "CRM" }] })
    ]);
  });

  it("creates a REQ-23 business event only when duplicates exist", () => {
    expect(duplicateAuditEvent("component", "created", { id: "n", name: "CRM" }, [], true)).toBeUndefined();
    expect(duplicateAuditEvent("component", "created", { id: "n", name: "CRM" }, [component("a", "CRM")], true)).toEqual({
      action: "duplicate.accepted",
      entityType: "component",
      entityId: "n",
      summary: "Komponente „CRM“ trotz Duplikatwarnung erstellt (Warnung bestätigt).",
      details: { requirement: "REQ-02", acknowledged: true, duplicates: [{ id: "a", name: "CRM" }] }
    });
  });
});

describe("REQ-02 duplicate warnings in the components API", () => {
  const secret = "req02-test-only-signing-secret-at-least-32-characters";
  const user: StoredUser = { id: "architect", role: "Architect", companyId: "company-a", companyName: "Test", email: "a@example.invalid", name: null, passwordHash: "unused" };
  const authRepository: AuthRepository = { createCompanyUser: vi.fn(), findUserByEmail: vi.fn(), findUserById: async () => user };
  const userRepository: UserRepository = { listCompanyUsers: vi.fn(async () => []), createLocalUser: vi.fn(), changeRole: vi.fn() };
  const app = createApp({ jwtSecret: secret, authRepository, userRepository });
  const bearer = `Bearer ${jwt.sign({}, secret, { subject: user.id, issuer: "eam-tool", audience: "eam-tool", expiresIn: "1h" })}`;

  beforeEach(() => {
    repositoryComponents.splice(0, repositoryComponents.length, component("existing", "Customer Portal"));
    store.addComponent.mockReset().mockImplementation(async (input: ComponentInstance) => input);
    store.updateComponent.mockReset().mockImplementation(async (id: string, patch: Partial<ComponentInstance>) => {
      const existing = repositoryComponents.find((item) => item.id === id);
      return existing ? { ...existing, ...patch, id } : null;
    });
    store.addComponentType.mockReset().mockImplementation(async (input: ComponentType) => input);
    store.updateComponentType.mockReset().mockImplementation(async (id: string, patch: Partial<ComponentType>) => {
      const existing = repositoryTypes.find((item) => item.id === id);
      return existing ? { ...existing, ...patch, id } : null;
    });
  });

  it("creates the element, returns a warning and passes an audit event to the same write", async () => {
    const response = await request(app).post("/api/sidebar/components").set("Authorization", bearer)
      .send({ name: "customer  portal", componentTypeId: "ct-app", acknowledgeDuplicate: true });
    expect(response.status).toBe(201);
    expect(response.body.name).toBe("customer  portal");
    expect(response.body.warnings).toEqual([expect.objectContaining({ code: "DUPLICATE_COMPONENT", duplicates: [{ id: "existing", name: "Customer Portal" }] })]);
    expect(lastEvent(store.addComponent)).toEqual(expect.objectContaining({
      action: "duplicate.accepted", entityType: "component", entityId: response.body.id,
      details: expect.objectContaining({ acknowledged: true })
    }));
  });

  it("returns no warning and no audit event for a unique name or another type", async () => {
    for (const body of [{ name: "Billing", componentTypeId: "ct-app" }, { name: "Customer Portal", componentTypeId: "ct-capability" }]) {
      const response = await request(app).post("/api/sidebar/components").set("Authorization", bearer).send(body);
      expect(response.status).toBe(201);
      expect(response.body.warnings).toEqual([]);
      expect(lastEvent(store.addComponent)).toBeUndefined();
    }
  });

  it("warns when a rename creates a duplicate and never stores the acknowledgement flag", async () => {
    repositoryComponents.push(component("new", "Neue Komponente"));
    const response = await request(app).patch("/api/sidebar/components/new").set("Authorization", bearer).set("If-Match", "1")
      .send({ name: "Customer Portal", acknowledgeDuplicate: false });
    expect(response.status).toBe(200);
    expect(response.body).not.toHaveProperty("acknowledgeDuplicate");
    expect(store.updateComponent.mock.calls[0][1]).not.toHaveProperty("acknowledgeDuplicate");
    expect(response.body.warnings[0].duplicates).toEqual([{ id: "existing", name: "Customer Portal" }]);
    expect(lastEvent(store.updateComponent)).toEqual(expect.objectContaining({
      entityId: "new", details: expect.objectContaining({ acknowledged: false })
    }));

    const unrelated = await request(app).patch("/api/sidebar/components/existing").set("Authorization", bearer).set("If-Match", "1").send({ description: "x" });
    expect(unrelated.body.warnings).toEqual([]);
    expect(lastEvent(store.updateComponent)).toBeUndefined();
  });

  it("warns about a duplicate component type name on create and rename", async () => {
    const admin = { ...user, id: "admin", role: "Admin" as const };
    const adminApp = createApp({ jwtSecret: secret, authRepository: { ...authRepository, findUserById: async () => admin }, userRepository });
    const adminBearer = `Bearer ${jwt.sign({}, secret, { subject: admin.id, issuer: "eam-tool", audience: "eam-tool", expiresIn: "1h" })}`;
    repositoryTypes.splice(0, repositoryTypes.length,
      { id: "t-dup", name: "Duplikat", description: "", color: "#000", icon: "box", customPropertyKeys: [] },
      { id: "t-new", name: "Neuer Typ", description: "", color: "#000", icon: "box", customPropertyKeys: [] });

    const created = await request(adminApp).post("/api/sidebar/component-types").set("Authorization", adminBearer).send({ name: "duplikat" });
    expect(created.status).toBe(201);
    expect(created.body.warnings).toEqual([expect.objectContaining({ code: "DUPLICATE_COMPONENT_TYPE", duplicates: [{ id: "t-dup", name: "Duplikat" }] })]);
    expect(lastEvent(store.addComponentType)).toEqual(expect.objectContaining({ entityType: "component-type", entityId: created.body.id }));

    const renamed = await request(adminApp).patch("/api/sidebar/component-types/t-new").set("Authorization", adminBearer).send({ name: "Duplikat", acknowledgeDuplicate: true });
    expect(renamed.status).toBe(200);
    expect(renamed.body).not.toHaveProperty("acknowledgeDuplicate");
    expect(renamed.body.warnings[0].code).toBe("DUPLICATE_COMPONENT_TYPE");

    const unique = await request(adminApp).post("/api/sidebar/component-types").set("Authorization", adminBearer).send({ name: "Gateway" });
    expect(unique.body.warnings).toEqual([]);
    expect(lastEvent(store.addComponentType)).toBeUndefined();
  });
});
