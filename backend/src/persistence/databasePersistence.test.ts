import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { applyMetamodelDefinition, extractMetamodelDefinition } from "../Sidebar/metamodelConfig.js";
import { validateDiagram } from "../Sidebar/metamodelRules.js";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import { assertDiagramMemberships, configuredStorageBackend, type SidebarStateRepository } from "./databaseSidebarRepository.js";
import {
  addConnectionToDiagramState,
  assertValidConnectionEndpoints,
  diagramWithContents,
  removeDanglingInstanceReferences,
  removeComponentWithConnections
} from "./stateOperations.js";

class MemoryRepository implements SidebarStateRepository {
  private states = new Map<string, SidebarState>();
  constructor(state: SidebarState | null = null) { if (state) this.states.set("company-a", structuredClone(state)); }
  async read(companyId: string): Promise<SidebarState | null> { const state = this.states.get(companyId); return state ? structuredClone(state) : null; }
  async write(state: SidebarState, companyId: string): Promise<SidebarState> { this.states.set(companyId, structuredClone(state)); return structuredClone(state); }
  async disconnect(): Promise<void> {}
}

const state: SidebarState = {
  metamodel: { id: "mm", name: "MM", description: "", version: "1", isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
  componentTypes: [
    { id: "ct-app", name: "Application", description: "", color: "#fff", icon: "app", customPropertyKeys: ["owner", "criticality"], layer: "Application" }
  ],
  connectionTypes: [
    { id: "conn-dep", name: "depends_on", description: "", color: "#000", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [] }
  ],
  connectionRules: [
    { id: "rule-dep", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-dep", targetComponentTypeId: "ct-app", allowed: true, required: false, severity: "error", description: "Application dependency", rationale: "" }
  ],
  viewpoints: [],
  viewpointRules: [],
  validationRules: [],
  components: [
    { id: "source", name: "Source", componentTypeId: "ct-app", description: "", properties: { owner: "Team A", nestedJson: JSON.stringify({ score: 3 }) } },
    { id: "target", name: "Target", componentTypeId: "ct-app", description: "", properties: { criticality: "high" } }
  ],
  connections: [
    { id: "connection", name: "", connectionTypeId: "conn-dep", sourceComponentId: "source", targetComponentId: "target", description: "", properties: { protocol: "HTTPS" } }
  ],
  diagrams: [
    { id: "diagram", name: "Diagram", description: "", metamodelId: "mm", componentIds: ["source", "target"], connectionIds: ["connection"], positions: { source: { x: 10, y: 20 }, target: { x: 30, y: 40 } } }
  ]
};

describe("database persistence repository contract", () => {
  it("selects database storage only with DATABASE_URL and rejects an incomplete explicit DB configuration", () => {
    expect(configuredStorageBackend({ DATABASE_URL: "postgresql://db", STORAGE_BACKEND: "database" })).toBe("database");
    expect(configuredStorageBackend({ STORAGE_BACKEND: "json" })).toBe("json");
    expect(configuredStorageBackend({})).toBe("json");
    expect(() => configuredStorageBackend({ STORAGE_BACKEND: "database" })).toThrow(/DATABASE_URL is required/);
    expect(() => configuredStorageBackend({ STORAGE_BACKEND: "typo", DATABASE_URL: "postgresql://db" })).toThrow(/STORAGE_BACKEND/);
  });
  it("stores and reads ComponentTypes and flexible JSON attributes", async () => {
    const repository = new MemoryRepository();
    await repository.write(state, "company-a");
    const restored = await repository.read("company-a");
    expect(restored?.componentTypes[0].customPropertyKeys).toEqual(["owner", "criticality"]);
    expect(restored?.components[0].properties).toEqual(state.components[0].properties);
    expect(restored?.connections[0].properties).toEqual({ protocol: "HTTPS" });
  });

  it("loads a diagram together with components, connections and positions", () => {
    const aggregate = diagramWithContents(state, "diagram");
    expect(aggregate?.components.map((item) => item.id)).toEqual(["source", "target"]);
    expect(aggregate?.connections.map((item) => item.id)).toEqual(["connection"]);
    expect(aggregate?.diagram.positions.source).toEqual({ x: 10, y: 20 });
  });

  it("rejects invalid connection endpoints", () => {
    expect(() => assertValidConnectionEndpoints(state, { ...state.connections[0], targetComponentId: "missing" })).toThrow(/valid source and target/);
  });

  it("cascades component deletion to attached connections and diagram membership", () => {
    const next = removeComponentWithConnections(state, "source");
    expect(next.components.some((item) => item.id === "source")).toBe(false);
    expect(next.connections).toHaveLength(0);
    expect(next.diagrams[0].connectionIds).toHaveLength(0);
    expect(next.diagrams[0].positions.source).toBeUndefined();
  });

  it("keeps ConnectionRules valid and preserves metamodel export/import structure after a repository round trip", async () => {
    const repository = new MemoryRepository();
    await repository.write(state, "company-a");
    const restored = (await repository.read("company-a"))!;
    expect(validateDiagram(restored.diagrams[0], restored, { includeRequiredRules: false }).valid).toBe(true);
    const exported = extractMetamodelDefinition(restored);
    expect(extractMetamodelDefinition(applyMetamodelDefinition(restored, exported))).toEqual(exported);
  });

  it("removes instance references that become invalid after a metamodel import", () => {
    const imported = removeDanglingInstanceReferences({ ...state, componentTypes: [], connectionTypes: [] });
    expect(imported.components).toEqual([]);
    expect(imported.connections).toEqual([]);
    expect(imported.diagrams[0]).toMatchObject({ componentIds: [], connectionIds: [], positions: {} });
  });

  it("declares PostgreSQL JSONB fields and database-level endpoint cascades", async () => {
    const schema = await readFile(new URL("../../prisma/schema.prisma", import.meta.url), "utf-8");
    expect(schema).toMatch(/customPropertyKeys\s+Json[\s\S]*@db\.JsonB/);
    expect(schema).toMatch(/properties\s+Json[\s\S]*@db\.JsonB/);
    expect(schema).toMatch(/sourceComponent\s+ComponentInstance[\s\S]*onDelete: Cascade/);
    expect(schema).toMatch(/targetComponent\s+ComponentInstance[\s\S]*onDelete: Cascade/);
    expect(schema).toMatch(/model Company[\s\S]*model User/);
    expect(schema).toMatch(/model Diagram[\s\S]*companyId\s+String/);
    expect(schema).toMatch(/model DiagramComponentMembership[\s\S]*position\s+Json[\s\S]*@db\.JsonB/);
    expect(schema).toMatch(/model DiagramConnectionMembership[\s\S]*connection\s+ConnectionInstance[\s\S]*onDelete: Cascade/);
  });

  it("stores a new connection and its diagram membership in one state transition", () => {
    const secondConnection = { ...state.connections[0], id: "connection-2" };
    const next = addConnectionToDiagramState(state, secondConnection, "diagram");
    expect(next.connections.map((item) => item.id)).toContain("connection-2");
    expect(next.diagrams[0].connectionIds).toContain("connection-2");
    expect(diagramWithContents(next, "diagram")?.connections.map((item) => item.id)).toEqual(["connection", "connection-2"]);
  });

  it("attaches an existing global connection without duplicating it", () => {
    const hiddenConnection = { ...state.connections[0], id: "hidden-connection" };
    const withHiddenConnection = { ...state, connections: [...state.connections, hiddenConnection] };
    const next = addConnectionToDiagramState(withHiddenConnection, hiddenConnection, "diagram");
    expect(next.connections).toHaveLength(withHiddenConnection.connections.length);
    expect(next.diagrams[0].connectionIds).toContain("hidden-connection");
  });

  it("rejects diagram connections whose endpoints are not both visible", () => {
    const diagramWithoutTarget = {
      ...state,
      diagrams: [{ ...state.diagrams[0], componentIds: ["source"], connectionIds: [] }]
    };
    expect(() => addConnectionToDiagramState(diagramWithoutTarget, { ...state.connections[0], id: "hidden-target" }, "diagram"))
      .toThrow(/both be visible/);
  });

  it("allows the same component and connection instances in multiple diagrams", () => {
    const secondDiagram = {
      ...state.diagrams[0],
      id: "diagram-2",
      name: "Second diagram",
      positions: { source: { x: 100, y: 120 }, target: { x: 300, y: 120 } }
    };

    expect(() => assertDiagramMemberships({
      ...state,
      diagrams: [...state.diagrams, secondDiagram]
    })).not.toThrow();
  });

  it("isolates persisted sidebar state by companyId", async () => {
    const repository = new MemoryRepository();
    await repository.write(state, "company-a");
    await repository.write({ ...state, diagrams: [{ ...state.diagrams[0], id: "company-b-diagram" }] }, "company-b");
    expect((await repository.read("company-a"))?.diagrams[0].id).toBe("diagram");
    expect((await repository.read("company-b"))?.diagrams[0].id).toBe("company-b-diagram");
  });
});
