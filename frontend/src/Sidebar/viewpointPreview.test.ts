import { describe, expect, it } from "vitest";
import starterStateJson from "../../../backend/src/data/sidebar.json";
import { getApplicableViewpoints, projectDiagramToViewpoint, validateDiagram } from "./metamodelRules";
import type { SidebarState } from "./sidebarTypes";

const state: SidebarState = {
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [
    { id: "proc", name: "Process", description: "", color: "#fff", icon: "", customPropertyKeys: [] },
    { id: "cap", name: "Capability", description: "", color: "#fff", icon: "", customPropertyKeys: [] },
    { id: "app", name: "Application", description: "", color: "#fff", icon: "", customPropertyKeys: [] },
    { id: "data", name: "Data", description: "", color: "#fff", icon: "", customPropertyKeys: [] }
  ],
  connectionTypes: [
    { id: "realizes", name: "realizes", description: "", color: "#fff", lineStyle: "solid", allowedSourceTypeIds: ["proc"], allowedTargetTypeIds: ["cap"] },
    { id: "uses", name: "uses", description: "", color: "#fff", lineStyle: "solid", allowedSourceTypeIds: ["app"], allowedTargetTypeIds: ["data"] }
  ],
  connectionRules: [
    { id: "proc-cap", sourceComponentTypeId: "proc", connectionTypeId: "realizes", targetComponentTypeId: "cap", allowed: true, required: false, severity: "error", description: "Process realizes Capability.", rationale: "", viewpointIds: ["business", "full"] },
    { id: "app-data", sourceComponentTypeId: "app", connectionTypeId: "uses", targetComponentTypeId: "data", allowed: true, required: false, severity: "error", description: "Application uses Data.", rationale: "", viewpointIds: ["application", "full"] }
  ],
  viewpoints: [
    { id: "business", name: "Business", description: "", stakeholderRole: "Owner", purpose: "", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] },
    { id: "application", name: "Application", description: "", stakeholderRole: "Owner", purpose: "", allowedComponentTypeIds: ["app", "data"], allowedConnectionTypeIds: ["uses"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] },
    { id: "full", name: "Full", description: "", stakeholderRole: "Architect", purpose: "", allowedComponentTypeIds: ["proc", "cap", "app", "data"], allowedConnectionTypeIds: ["realizes", "uses"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] }
  ],
  viewpointRules: [
    { id: "vpr-business", viewpointId: "business", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], allowedConnectionRuleIds: ["proc-cap"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [], visibleComponentTypeIds: ["proc", "cap"], description: "", severity: "error" },
    { id: "vpr-application", viewpointId: "application", allowedComponentTypeIds: ["app", "data"], allowedConnectionTypeIds: ["uses"], allowedConnectionRuleIds: ["app-data"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [], visibleComponentTypeIds: ["app", "data"], description: "", severity: "error" },
    { id: "vpr-full", viewpointId: "full", allowedComponentTypeIds: ["proc", "cap", "app", "data"], allowedConnectionTypeIds: ["realizes", "uses"], allowedConnectionRuleIds: ["proc-cap", "app-data"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [], visibleComponentTypeIds: ["proc", "cap", "app", "data"], description: "", severity: "error" }
  ],
  validationRules: [],
  components: [
    { id: "p", name: "P", componentTypeId: "proc", description: "", properties: {} },
    { id: "c", name: "C", componentTypeId: "cap", description: "", properties: {} },
    { id: "a", name: "A", componentTypeId: "app", description: "", properties: {} },
    { id: "d", name: "D", componentTypeId: "data", description: "", properties: {} }
  ],
  connections: [
    { id: "pc", name: "", connectionTypeId: "realizes", sourceComponentId: "p", targetComponentId: "c", description: "" },
    { id: "ad", name: "", connectionTypeId: "uses", sourceComponentId: "a", targetComponentId: "d", description: "" }
  ],
  diagrams: [{ id: "diagram", name: "Full", description: "", componentIds: ["p", "c", "a", "d"], connectionIds: ["pc", "ad"], positions: {}, viewpointId: "full" }]
};

describe("viewpoint preview", () => {
  it.each([
    ["business", ["p", "c"], ["pc"]],
    ["application", ["a", "d"], ["ad"]],
    ["full", ["p", "c", "a", "d"], ["pc", "ad"]]
  ] as const)("projects a full diagram into %s without viewpoint errors", (viewpointId, componentIds, connectionIds) => {
    const projected = projectDiagramToViewpoint(state.diagrams[0], state, viewpointId);
    expect(projected.componentIds).toEqual(componentIds);
    expect(projected.connectionIds).toEqual(connectionIds);
    expect(validateDiagram(projected, state).errors).toEqual([]);
  });

  it("does not mutate the persisted full diagram", () => {
    const projected = projectDiagramToViewpoint(state.diagrams[0], state, "business");
    expect(projected).not.toBe(state.diagrams[0]);
    expect(state.diagrams[0].viewpointId).toBe("full");
    expect(state.diagrams[0].componentIds).toEqual(["p", "c", "a", "d"]);
  });

  it("hides connections without an allowed metamodel rule", () => {
    const unsafeState: SidebarState = {
      ...state,
      connectionRules: state.connectionRules.map((rule) =>
        rule.id === "proc-cap" ? { ...rule, allowed: false } : rule
      ),
      connections: [
        ...state.connections,
        { id: "unruled", name: "", connectionTypeId: "realizes", sourceComponentId: "p", targetComponentId: "a", description: "" }
      ],
      diagrams: [{ ...state.diagrams[0], connectionIds: ["pc", "unruled", "ad"] }]
    };

    const projected = projectDiagramToViewpoint(unsafeState.diagrams[0], unsafeState, "full");
    expect(projected.connectionIds).toEqual(["ad"]);
  });

  it("offers only viewpoints that contain at least one diagram type", () => {
    const withUnrelatedView = {
      ...state,
      viewpoints: [...state.viewpoints, { id: "unrelated", name: "Unrelated", description: "", stakeholderRole: "Other", purpose: "", allowedComponentTypeIds: ["foreign"], allowedConnectionTypeIds: [], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] }]
    };
    expect(getApplicableViewpoints(state.diagrams[0], withUnrelatedView).map((viewpoint) => viewpoint.id)).toEqual(["business", "application", "full"]);
  });

  it("projects the real full-architecture starter through every EAM viewpoint without errors", () => {
    const starterState = starterStateJson as unknown as SidebarState;
    const fullDiagram = starterState.diagrams.find((diagram) => diagram.id === "diagram-order-management-demo");
    expect(fullDiagram).toBeDefined();

    for (const viewpointId of ["vp-management", "vp-business-owner", "vp-application-owner", "vp-it-operations", "vp-full-architecture"]) {
      const projected = projectDiagramToViewpoint(fullDiagram!, starterState, viewpointId);
      expect(projected.componentIds.length, viewpointId).toBeGreaterThan(0);
      expect(validateDiagram(projected, starterState).errors, viewpointId).toEqual([]);
    }
  });
});
