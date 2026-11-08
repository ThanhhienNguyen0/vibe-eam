import { describe, expect, it } from "vitest";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import { auditMutation, diffSidebarStates, fieldChanges } from "./auditDiff.js";

const state = (): SidebarState => ({
  dataRevision: 7,
  metamodel: { id: "mm", name: "Test", description: "", version: "2.0", isActive: true, createdAt: "old", updatedAt: "new" },
  componentTypes: [{ id: "type", name: "Application", description: "", color: "#fff", icon: "box", customPropertyKeys: [] }],
  connectionTypes: [], connectionRules: [], viewpointRules: [], validationRules: [], viewpoints: [], catalogs: [],
  components: [{ id: "component", version: 3, name: "Before", componentTypeId: "type", description: "", properties: { owner: "A", apiToken: "must-not-leak" } }],
  connections: [], diagrams: []
});

describe("REQ-23 audit diff contract", () => {
  it("records stable field changes, redacts secret-shaped keys and excludes runtime revisions", () => {
    const before = state();
    const after = structuredClone(before);
    after.dataRevision = 8;
    after.components[0].version = 4;
    after.components[0].name = "After";
    after.components[0].properties.owner = "B";
    after.components[0].properties.apiToken = "different-secret";

    const entries = diffSidebarStates(before, after);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ action: "update", entityType: "component", entityId: "component" });
    expect(entries[0].changes).toEqual([
      { field: "name", before: "Before", after: "After" },
      { field: "properties.owner", before: "A", after: "B" }
    ]);
    expect(JSON.stringify(entries)).not.toContain("must-not-leak");
    expect(JSON.stringify(entries)).not.toContain("different-secret");
    expect(JSON.stringify(entries)).not.toContain("dataRevision");
    expect(JSON.stringify(entries)).not.toContain("version");
  });

  it("uses null for missing values and keeps create/delete explicit", () => {
    expect(fieldChanges({}, { description: "new" }).changes).toEqual([
      { field: "description", before: null, after: "new" }
    ]);
    expect(auditMutation("component", "id", "Komponente", null, { id: "id", name: "New" })).toMatchObject({ action: "create" });
    expect(auditMutation("component", "id", "Komponente", { id: "id", name: "Old" }, null)).toMatchObject({ action: "delete" });
  });

  it("does not create a mutation for a no-op", () => {
    expect(auditMutation("component", "id", "Komponente", { name: "Same" }, { name: "Same" })).toBeNull();
  });

  it("keeps the domain metamodel version distinct from technical object versions", () => {
    const before = state();
    const after = structuredClone(before);
    after.metamodel.version = "2.1";
    const entries = diffSidebarStates(before, after);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ entityType: "metamodel", entityId: "mm" });
    expect(entries[0].changes).toEqual([{ field: "version", before: "2.0", after: "2.1" }]);
  });
});
