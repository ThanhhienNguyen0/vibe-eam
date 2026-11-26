import request from "supertest";
import jwt from "jsonwebtoken";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../server.js";
import type { AuthRepository, StoredUser, UserRepository } from "../auth/authTypes.js";
import type { ComponentInstance, Diagram, SidebarState } from "./sidebarTypes.js";

// #108, #111, #113: what the save routes accept. The store is mocked; only the route checks are under test.

const baseState = (): SidebarState => ({
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  componentTypes: [
    { id: "ct-app", name: "Application", color: "#2563eb", icon: "app", description: "", customPropertyKeys: [] },
    { id: "ct-proc", name: "Business Process", color: "#0f766e", icon: "proc", description: "", customPropertyKeys: [] },
    { id: "ct-data", name: "Data Object", color: "#7c3aed", icon: "data", description: "", customPropertyKeys: [] },
    { id: "ct-service", name: "Application Service", color: "#0891b2", icon: "app", description: "", customPropertyKeys: [] }
  ],
  connectionTypes: [
    { id: "conn-uses", name: "uses", color: "#7c3aed", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" },
    { id: "conn-depends-on", name: "depends_on", color: "#dc2626", lineStyle: "dashed", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" }
  ],
  connectionRules: [
    { id: "r-app-uses-data", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-uses", targetComponentTypeId: "ct-data", allowed: true, required: false, severity: "error", description: "", rationale: "", viewpointIds: [] },
    { id: "r-service-uses-data", sourceComponentTypeId: "ct-service", connectionTypeId: "conn-uses", targetComponentTypeId: "ct-data", allowed: true, required: false, severity: "error", description: "", rationale: "", viewpointIds: [] },
    { id: "r-app-depends-app", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-depends-on", targetComponentTypeId: "ct-app", allowed: true, required: false, severity: "error", description: "", rationale: "", viewpointIds: [] }
  ],
  viewpointRules: [],
  validationRules: [],
  components: [
    { id: "crm", version: 1, name: "CRM", componentTypeId: "ct-app", properties: {}, description: "" },
    { id: "erp", version: 1, name: "ERP", componentTypeId: "ct-app", properties: {}, description: "" },
    { id: "customer", version: 1, name: "Kundendaten", componentTypeId: "ct-data", properties: {}, description: "" },
    { id: "legacy", version: 1, name: "Neue Komponente", componentTypeId: "ct-data", properties: {}, description: "" }
  ],
  connections: [
    { id: "crm-uses-customer", version: 1, name: "", connectionTypeId: "conn-uses", sourceComponentId: "crm", targetComponentId: "customer", description: "" },
    { id: "crm-depends-erp", version: 1, name: "", connectionTypeId: "conn-depends-on", sourceComponentId: "crm", targetComponentId: "erp", description: "" }
  ],
  catalogs: [],
  diagrams: [{ id: "d1", version: 1, name: "Vertrieb", description: "", componentIds: [], connectionIds: [], positions: {}, metamodelId: "mm" }],
  viewpoints: []
});

let state = baseState();

const store = vi.hoisted(() => ({
  addComponent: vi.fn(),
  updateComponent: vi.fn(),
  addDiagram: vi.fn(),
  updateDiagram: vi.fn(),
  addComponentToDiagram: vi.fn()
}));

vi.mock("./sidebarStore.js", async (original) => ({
  ...await original<typeof import("./sidebarStore.js")>(),
  readSidebarState: vi.fn(async () => structuredClone(state)),
  getComponents: vi.fn(async () => structuredClone(state.components)),
  addComponent: store.addComponent,
  updateComponent: store.updateComponent,
  addDiagram: store.addDiagram,
  updateDiagram: store.updateDiagram,
  addComponentToDiagram: store.addComponentToDiagram
}));

describe("save validation in the sidebar API", () => {
  const secret = "save-validation-test-only-signing-secret-32chars";
  const user: StoredUser = { id: "architect", role: "Architect", companyId: "company-a", companyName: "Test", email: "a@example.invalid", name: null, passwordHash: "unused" };
  const authRepository: AuthRepository = { createCompanyUser: vi.fn(), findUserByEmail: vi.fn(), findUserById: async () => user };
  const userRepository: UserRepository = { listCompanyUsers: vi.fn(async () => []), createLocalUser: vi.fn(), changeRole: vi.fn() };
  const app = createApp({ jwtSecret: secret, authRepository, userRepository });
  const bearer = `Bearer ${jwt.sign({}, secret, { subject: user.id, issuer: "eam-tool", audience: "eam-tool", expiresIn: "1h" })}`;
  const api = {
    post: (path: string) => request(app).post(`/api/sidebar${path}`).set("Authorization", bearer),
    patch: (path: string) => request(app).patch(`/api/sidebar${path}`).set("Authorization", bearer).set("If-Match", "1")
  };

  beforeEach(() => {
    state = baseState();
    store.addComponent.mockReset().mockImplementation(async (input: ComponentInstance) => input);
    store.updateComponent.mockReset().mockImplementation(async (id: string, patch: Partial<ComponentInstance>) => {
      const existing = state.components.find((item) => item.id === id);
      return existing ? { ...existing, ...patch, id } : null;
    });
    store.addDiagram.mockReset().mockImplementation(async (input: Diagram) => input);
    store.updateDiagram.mockReset().mockImplementation(async (id: string, patch: Partial<Diagram>) => {
      const existing = state.diagrams.find((item) => item.id === id);
      return existing ? { ...existing, ...patch, id } : null;
    });
    store.addComponentToDiagram.mockReset().mockImplementation(async (component: ComponentInstance) => ({ component, diagram: state.diagrams[0] }));
  });

  describe("#113 naming on create", () => {
    it("rejects empty, whitespace-only and unconfirmed placeholder component names before anything is stored", async () => {
      for (const name of [undefined, "", "   ", "Neue Komponente", "Neue Komponente 2"]) {
        const response = await api.post("/components").send({ name, componentTypeId: "ct-app" });
        expect(response.status).toBe(400);
        expect(response.body.field).toBe("name");
        expect(response.body.error).toMatch(/Namen/);
      }
      const notABoolean = await api.post("/components").send({ name: "Neue Komponente", componentTypeId: "ct-app", acknowledgePlaceholder: "true" });
      expect(notABoolean.status).toBe(400);
      const emptyConfirmed = await api.post("/components").send({ name: "  ", componentTypeId: "ct-app", acknowledgePlaceholder: true });
      expect(emptyConfirmed.body.code).toBe("NAME_REQUIRED");
      expect(store.addComponent).not.toHaveBeenCalled();
    });

    it("creates a placeholder name only after the explicit confirmation", async () => {
      const response = await api.post("/components").send({ name: " Neue Komponente ", componentTypeId: "ct-app", acknowledgePlaceholder: true });
      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Neue Komponente");
      expect(store.addComponent.mock.calls[0][0]).not.toHaveProperty("acknowledgePlaceholder");
    });

    it("stores a real component name trimmed", async () => {
      const response = await api.post("/components").send({ name: "  Billing  ", componentTypeId: "ct-app" });
      expect(response.status).toBe(201);
      expect(response.body.name).toBe("Billing");
    });

    it("applies the same rule to components created in a diagram", async () => {
      const rejected = await api.post("/diagrams/d1/components").set("If-Match", "1")
        .send({ name: "Neue Komponente", componentTypeId: "ct-app", position: { x: 0, y: 0 } });
      expect(rejected.status).toBe(400);
      expect(rejected.body.code).toBe("NAME_PLACEHOLDER");
      expect(store.addComponentToDiagram).not.toHaveBeenCalled();

      const created = await api.post("/diagrams/d1/components").set("If-Match", "1")
        .send({ name: " Billing ", componentTypeId: "ct-app", position: { x: 0, y: 0 } });
      expect(created.status).toBe(201);
      expect(store.addComponentToDiagram.mock.calls[0][0].name).toBe("Billing");

      const confirmed = await api.post("/diagrams/d1/components").set("If-Match", "1")
        .send({ name: "Neue Komponente", componentTypeId: "ct-app", position: { x: 0, y: 0 }, acknowledgePlaceholder: true });
      expect(confirmed.status).toBe(201);
    });

    it("applies the same rule to diagrams", async () => {
      for (const name of ["", "  ", "Neues Diagramm", "neues diagramm 3"]) {
        const response = await api.post("/diagrams").send({ name });
        expect(response.status).toBe(400);
        expect(response.body.field).toBe("name");
      }
      expect(store.addDiagram).not.toHaveBeenCalled();
      const created = await api.post("/diagrams").send({ name: " Vertrieb Nord " });
      expect(created.status).toBe(201);
      expect(created.body.name).toBe("Vertrieb Nord");

      const confirmed = await api.post("/diagrams").send({ name: "Neues Diagramm", acknowledgePlaceholder: true });
      expect(confirmed.status).toBe(201);
      expect(store.addDiagram.mock.calls[1][0]).not.toHaveProperty("acknowledgePlaceholder");
    });

    it("rejects an empty or unconfirmed placeholder name when a diagram is renamed", async () => {
      for (const name of ["   ", "Neues Diagramm"]) {
        const response = await api.patch("/diagrams/d1").send({ name });
        expect(response.status).toBe(400);
      }
      expect(store.updateDiagram).not.toHaveBeenCalled();
      const renamed = await api.patch("/diagrams/d1").send({ name: " Vertrieb Süd " });
      expect(renamed.status).toBe(200);
      expect(store.updateDiagram.mock.calls[0][1]).toEqual({ name: "Vertrieb Süd" });

      const confirmed = await api.patch("/diagrams/d1").send({ name: "Neues Diagramm", acknowledgePlaceholder: true });
      expect(confirmed.status).toBe(200);
      expect(store.updateDiagram.mock.calls[1][1]).toEqual({ name: "Neues Diagramm" });
    });
  });

  describe("#108 required name when a component is saved", () => {
    it("rejects missing or whitespace-only names in PATCH with a field error", async () => {
      for (const name of ["", "   ", null, 7]) {
        const response = await api.patch("/components/crm").send({ name, description: "x" });
        expect(response.status).toBe(400);
        expect(response.body).toEqual(expect.objectContaining({ code: "NAME_REQUIRED", field: "name" }));
      }
      expect(store.updateComponent).not.toHaveBeenCalled();
    });

    it("stores the trimmed name and leaves PATCH bodies without a name alone", async () => {
      const renamed = await api.patch("/components/crm").send({ name: "  CRM Cloud " });
      expect(renamed.status).toBe(200);
      expect(store.updateComponent.mock.calls[0][1]).toEqual({ name: "CRM Cloud" });

      const description = await api.patch("/components/crm").send({ description: "Kundenverwaltung" });
      expect(description.status).toBe(200);
    });

    it("does not block other edits of an existing placeholder, but asks for confirmation when renaming to one", async () => {
      const unchanged = await api.patch("/components/legacy").send({ name: "Neue Komponente", description: "aufräumen" });
      expect(unchanged.status).toBe(200);
      const toPlaceholder = await api.patch("/components/crm").send({ name: "Neue Komponente" });
      expect(toPlaceholder.status).toBe(400);
      expect(toPlaceholder.body.code).toBe("NAME_PLACEHOLDER");

      const confirmed = await api.patch("/components/crm").send({ name: "Neue Komponente", acknowledgePlaceholder: true });
      expect(confirmed.status).toBe(200);
      expect(store.updateComponent.mock.calls.at(-1)?.[1]).toEqual({ name: "Neue Komponente" });
    });

    it("returns 404 for an unknown component", async () => {
      const response = await api.patch("/components/missing").send({ name: "X" });
      expect(response.status).toBe(404);
    });
  });

  describe("#111 relationships after a type change", () => {
    it("rejects a type change that would leave a disallowed connection and names it", async () => {
      const response = await api.patch("/components/crm").send({ componentTypeId: "ct-service" });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("TYPE_CHANGE_INVALID_CONNECTIONS");
      expect(response.body.field).toBe("componentTypeId");
      expect(response.body.invalidConnections).toEqual([
        expect.objectContaining({ id: "crm-depends-erp", label: "CRM → ERP (depends_on)" })
      ]);
      expect(response.body.error).toBe(
        "Der Typ kann nicht auf „Application Service“ geändert werden. Diese Verbindung wäre laut Metamodell nicht mehr erlaubt: CRM → ERP (depends_on). Bitte zuerst entfernen oder ändern."
      );
      expect(store.updateComponent).not.toHaveBeenCalled();
    });

    it("lists all broken connections, including incoming ones", async () => {
      const response = await api.patch("/components/crm").send({ componentTypeId: "ct-proc" });
      expect(response.status).toBe(400);
      expect(response.body.invalidConnections.map((item: { id: string }) => item.id)).toEqual(["crm-uses-customer", "crm-depends-erp"]);
      const incoming = await api.patch("/components/customer").send({ componentTypeId: "ct-proc" });
      expect(incoming.body.invalidConnections.map((item: { id: string }) => item.id)).toEqual(["crm-uses-customer"]);
    });

    it("accepts a type change that keeps every connection allowed", async () => {
      state.connections = state.connections.filter((item) => item.id !== "crm-depends-erp");
      const response = await api.patch("/components/crm").send({ componentTypeId: "ct-service" });
      expect(response.status).toBe(200);
      expect(response.body.componentTypeId).toBe("ct-service");
    });

    it("rejects an unknown component type", async () => {
      const response = await api.patch("/components/crm").send({ componentTypeId: "ct-missing" });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("COMPONENT_TYPE_MISSING");
      expect(store.updateComponent).not.toHaveBeenCalled();
    });

    it("does not re-check connections when the type stays the same", async () => {
      state.connections.push({ id: "broken", version: 1, name: "", connectionTypeId: "conn-depends-on", sourceComponentId: "customer", targetComponentId: "crm", description: "" });
      const response = await api.patch("/components/customer").send({ componentTypeId: "ct-data", description: "x" });
      expect(response.status).toBe(200);
    });
  });
});
