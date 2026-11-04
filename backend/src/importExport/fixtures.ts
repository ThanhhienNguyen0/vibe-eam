import type { SidebarState } from "../Sidebar/sidebarTypes.js";

/** Small, self-contained state shared by the REQ-31 tests (not used at runtime). */
export function sampleState(): SidebarState {
  return {
    metamodel: { id: "mm", name: "MM", description: "", version: "1", isActive: true, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" },
    componentTypes: [
      { id: "ct-app", name: "Application", description: "", color: "#fff", icon: "app", customPropertyKeys: ["owner", "criticality"], layer: "Application" },
      { id: "ct-data", name: "Data Object", description: "", color: "#fff", icon: "db", customPropertyKeys: ["classification"], layer: "Data" },
      { id: "ct-abstract", name: "Abstract", description: "", color: "#fff", icon: "x", customPropertyKeys: [], isAbstract: true }
    ],
    connectionTypes: [
      { id: "conn-uses", name: "uses", description: "", color: "#000", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [] },
      { id: "conn-depends", name: "depends_on", description: "", color: "#000", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [] }
    ],
    connectionRules: [
      { id: "r1", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-uses", targetComponentTypeId: "ct-data", allowed: true, required: false, severity: "error", description: "", rationale: "" },
      { id: "r2", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-depends", targetComponentTypeId: "ct-app", allowed: true, required: false, severity: "error", description: "", rationale: "" }
    ],
    viewpoints: [],
    viewpointRules: [],
    validationRules: [],
    components: [
      { id: "app-1", externalId: "CMDB-1", name: "ERP", componentTypeId: "ct-app", description: "Core ERP", properties: { owner: "IT" } },
      { id: "app-2", name: "CRM", componentTypeId: "ct-app", description: "", properties: {} },
      { id: "data-1", name: "Invoice", componentTypeId: "ct-data", description: "", properties: { classification: "internal" } }
    ],
    connections: [
      { id: "c-1", externalId: "REL-1", name: "", connectionTypeId: "conn-uses", sourceComponentId: "app-1", targetComponentId: "data-1", description: "", properties: {} }
    ],
    catalogs: [
      { id: "cat-apps", name: "Anwendungen", description: "", kind: "elements", componentTypeIds: ["ct-app"], connectionTypeIds: [], propertyKeys: ["owner"], columns: ["description"] },
      { id: "cat-rel", name: "Nutzung", description: "", kind: "relations", componentTypeIds: [], connectionTypeIds: ["conn-uses"], propertyKeys: [], columns: ["externalId"] }
    ],
    diagrams: [
      { id: "d-1", name: "Overview", description: "", metamodelId: "mm", componentIds: ["app-1", "data-1"], connectionIds: ["c-1"], positions: {} }
    ]
  };
}

/** Deterministic ids so that assertions can name the created entries. */
export function sequentialIds(prefix = "new"): () => string {
  let counter = 0;
  return () => `${prefix}-${++counter}`;
}
