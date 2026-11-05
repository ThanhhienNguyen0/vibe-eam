import { describe, expect, it } from "vitest";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import {
  exportModelTransferDocument,
  materializeModelTransferState,
  ModelTransferError,
  parseModelTransferDocument
} from "./modelTransfer.js";

const state: SidebarState = {
  metamodel: {
    id: "mm",
    name: "Minimal",
    description: "",
    version: "domain-1",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z"
  },
  componentTypes: [],
  connectionTypes: [],
  connectionRules: [],
  viewpointRules: [],
  validationRules: [],
  components: [],
  connections: [],
  diagrams: [],
  viewpoints: [],
  catalogs: []
};

function validDomainState(): SidebarState {
  return {
    ...structuredClone(state),
    componentTypes: [
      { id: "source-type", name: "Source", color: "", icon: "", description: "", customPropertyKeys: [] },
      { id: "target-type", name: "Target", color: "", icon: "", description: "", customPropertyKeys: [] }
    ],
    connectionTypes: [{
      id: "relation-type", name: "relates", color: "", lineStyle: "solid",
      allowedSourceTypeIds: ["source-type"], allowedTargetTypeIds: ["target-type"], description: ""
    }],
    connectionRules: [{
      id: "relation-rule", sourceComponentTypeId: "source-type", connectionTypeId: "relation-type",
      targetComponentTypeId: "target-type", allowed: true, required: false, severity: "error",
      description: "Source relates to target", rationale: "Test rule", viewpointIds: ["viewpoint"]
    }],
    viewpoints: [{
      id: "viewpoint", name: "Viewpoint", description: "", stakeholderRole: "Architect", purpose: "Test",
      allowedComponentTypeIds: ["source-type", "target-type"], allowedConnectionTypeIds: ["relation-type"],
      requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: []
    }],
    viewpointRules: [{
      id: "viewpoint-rule", viewpointId: "viewpoint",
      allowedComponentTypeIds: ["source-type", "target-type"], allowedConnectionTypeIds: ["relation-type"],
      allowedConnectionRuleIds: ["relation-rule"], requiredComponentTypeIds: [],
      requiredConnectionTypeIds: [], requiredConnectionRuleIds: []
    }],
    components: [
      { id: "source", name: "Source", componentTypeId: "source-type", description: "", properties: {} },
      { id: "target", name: "Target", componentTypeId: "target-type", description: "", properties: {} }
    ],
    connections: [{
      id: "relation", name: "", connectionTypeId: "relation-type", sourceComponentId: "source",
      targetComponentId: "target", description: "", properties: {}
    }],
    diagrams: [{
      id: "diagram", name: "Diagram", description: "", metamodelId: "mm", viewpointId: "viewpoint",
      componentIds: ["source", "target"], connectionIds: ["relation"],
      positions: { source: { x: 0, y: 0 }, target: { x: 100, y: 0 } }
    }]
  };
}

describe("REQ-33 model transfer format", () => {
  it("creates a deterministic schema-versioned document and accepts its own output", () => {
    const first = exportModelTransferDocument(state);
    const second = exportModelTransferDocument(structuredClone(state));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.schemaVersion).toBe(1);
    expect(first.model.metamodel.version).toBe("domain-1");
    expect(parseModelTransferDocument(first)).toEqual(first);
  });

  it("removes tenant prefixes from portable ids and materializes them for the target tenant", () => {
    const tenantState = structuredClone(state);
    tenantState.metamodel.id = "company-a:mm";
    const portable = exportModelTransferDocument(tenantState, "company-a");
    expect(portable.model.metamodel.id).toBe("mm");
    expect(materializeModelTransferState(portable, "company-b").metamodel.id).toBe("company-b:mm");
    expect(exportModelTransferDocument(materializeModelTransferState(portable, "company-b"), "company-b")).toEqual(portable);
  });

  it("keeps mixed tenant-prefixed and legacy ids bijective across every reference", () => {
    const mixed = structuredClone(state);
    mixed.metamodel.id = "company-a:mm";
    mixed.componentTypes = [
      { id: "company-a:type", name: "Prefixed", color: "", icon: "", description: "", customPropertyKeys: [] },
      { id: "type", name: "Legacy", color: "", icon: "", description: "", customPropertyKeys: [] }
    ];
    mixed.components = [
      { id: "company-a:component", name: "Prefixed", componentTypeId: "company-a:type", description: "", properties: {} },
      { id: "component", name: "Legacy", componentTypeId: "type", description: "", properties: {} }
    ];
    const portable = exportModelTransferDocument(mixed, "company-a");
    expect(new Set(portable.model.componentTypes.map((item) => item.id)).size).toBe(2);
    expect(new Set(portable.model.components.map((item) => item.id)).size).toBe(2);
    expect(portable.model.components.map((item) => item.componentTypeId).sort())
      .toEqual(portable.model.componentTypes.map((item) => item.id).sort());
    expect(parseModelTransferDocument(portable)).toEqual(portable);
    expect(exportModelTransferDocument(materializeModelTransferState(portable, "company-b"), "company-b"))
      .toEqual(portable);
  });

  it("rejects connection and diagram domain-rule violations but accepts the valid whole state", () => {
    const valid = exportModelTransferDocument(validDomainState());
    expect(parseModelTransferDocument(valid)).toEqual(valid);

    const missingRule = structuredClone(valid);
    missingRule.model.connectionRules = [];
    missingRule.model.viewpointRules[0].allowedConnectionRuleIds = [];
    missingRule.model.diagrams[0].connectionIds = [];
    expect(() => parseModelTransferDocument(missingRule)).toThrowError(expect.objectContaining({
      code: "MODEL_DOMAIN_INVALID",
      details: expect.arrayContaining([expect.stringContaining("CONNECTION_RULE_MISSING")])
    }) as ModelTransferError);

    const deniedRule = structuredClone(valid);
    deniedRule.model.connectionRules[0].allowed = false;
    expect(() => parseModelTransferDocument(deniedRule)).toThrowError(expect.objectContaining({
      code: "MODEL_DOMAIN_INVALID",
      details: expect.arrayContaining([expect.stringContaining("CONNECTION_RULE_DENIED")])
    }) as ModelTransferError);

    const selfConnection = structuredClone(valid);
    selfConnection.model.connections[0].targetComponentId = "source";
    selfConnection.model.diagrams[0].componentIds = ["source"];
    delete selfConnection.model.diagrams[0].positions.target;
    expect(() => parseModelTransferDocument(selfConnection)).toThrowError(expect.objectContaining({
      code: "MODEL_DOMAIN_INVALID",
      details: expect.arrayContaining([expect.stringContaining("SELF_CONNECTION")])
    }) as ModelTransferError);

    const viewpointViolation = structuredClone(valid);
    viewpointViolation.model.viewpointRules[0].allowedComponentTypeIds = ["source-type"];
    expect(() => parseModelTransferDocument(viewpointViolation)).toThrowError(expect.objectContaining({
      code: "MODEL_DOMAIN_INVALID",
      details: expect.arrayContaining([expect.stringContaining("VIEWPOINT_COMPONENT_DENIED")])
    }) as ModelTransferError);

    const diagramRuleViolation = structuredClone(valid);
    diagramRuleViolation.model.diagrams[0].connectionIds = [];
    diagramRuleViolation.model.viewpointRules[0].requiredConnectionRuleIds = ["relation-rule"];
    expect(() => parseModelTransferDocument(diagramRuleViolation)).toThrowError(expect.objectContaining({
      code: "MODEL_DOMAIN_INVALID",
      details: expect.arrayContaining([expect.stringContaining("REQUIRED_CONNECTION_RULE_MISSING")])
    }) as ModelTransferError);
  });

  it("never emits an export that fails the transfer contract itself", () => {
    const invalidStoredState = validDomainState();
    invalidStoredState.connectionRules = [];
    invalidStoredState.viewpointRules[0].allowedConnectionRuleIds = [];
    invalidStoredState.diagrams[0].connectionIds = [];
    expect(() => exportModelTransferDocument(invalidStoredState)).toThrowError(expect.objectContaining({
      status: 500,
      code: "MODEL_EXPORT_INVALID",
      details: expect.arrayContaining([expect.stringContaining("CONNECTION_RULE_MISSING")])
    }) as ModelTransferError);
  });

  it.each([
    [{ format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_REQUIRED"],
    [{ schemaVersion: 0, format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_UNSUPPORTED_LEGACY"],
    [{ schemaVersion: 2, format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_UNSUPPORTED_FUTURE"],
    [{ schemaVersion: 1.5, format: "vibe-eam-model", model: state }, "SCHEMA_VERSION_INVALID"]
  ])("rejects missing, legacy, future and malformed versions before import", (input, code) => {
    expect(() => parseModelTransferDocument(input)).toThrowError(expect.objectContaining({ code }) as ModelTransferError);
  });

  it("uses the repository JSON Schema strictly", () => {
    const invalid = { ...exportModelTransferDocument(state), unexpected: true };
    expect(() => parseModelTransferDocument(invalid)).toThrowError(expect.objectContaining({ code: "MODEL_SCHEMA_INVALID" }) as ModelTransferError);
  });

  it("rejects dangling references instead of normalizing them away", () => {
    const invalid = {
      schemaVersion: 1 as const,
      format: "vibe-eam-model" as const,
      model: {
        ...state,
        diagrams: [{
        id: "diagram",
        name: "Broken",
        description: "",
        componentIds: ["missing"],
        connectionIds: [],
        positions: {}
        }]
      }
    };
    expect(() => parseModelTransferDocument(invalid)).toThrowError(expect.objectContaining({ code: "MODEL_REFERENCE_INVALID" }) as ModelTransferError);
  });
});
