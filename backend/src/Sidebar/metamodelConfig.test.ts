import { describe, expect, it } from "vitest";
import { applyMetamodelDefinition, extractMetamodelDefinition, validateMetamodelDefinition } from "./metamodelConfig.js";
import { validateDiagram } from "./metamodelRules.js";
import type { MetamodelDefinition, SidebarState } from "./sidebarTypes.js";

const definition: MetamodelDefinition = {
  metamodel: {
    id: "mm-import-test",
    name: "Import Test Metamodel",
    description: "Test metamodel.",
    version: "1.0.0",
    isActive: true,
    createdAt: "2026-06-13T00:00:00.000Z",
    updatedAt: "2026-06-13T00:00:00.000Z"
  },
  componentTypes: [
    { id: "ct-stakeholder", name: "Stakeholder", description: "Role.", color: "#0891b2", icon: "user", shape: "box", layer: "Business", category: "EAM", customPropertyKeys: [] },
    { id: "ct-app", name: "Application", description: "Application.", color: "#2563eb", icon: "app", shape: "box", layer: "Application", category: "EAM", customPropertyKeys: [] },
    { id: "ct-proc", name: "Business Process", description: "Process.", color: "#0f766e", icon: "proc", shape: "process", layer: "Business", category: "EAM", customPropertyKeys: [] },
    { id: "ct-capability", name: "Business Capability", description: "Capability.", color: "#0f766e", icon: "cap", shape: "box", layer: "Business", category: "EAM", customPropertyKeys: [] }
  ],
  connectionTypes: [
    { id: "conn-serves", name: "serves", description: "Serves.", color: "#2563eb", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [] },
    { id: "conn-responsible-for", name: "responsible_for", description: "Responsible.", color: "#ea580c", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [] }
  ],
  connectionRules: [
    {
      id: "rule-app-serves-process",
      sourceComponentTypeId: "ct-app",
      connectionTypeId: "conn-serves",
      targetComponentTypeId: "ct-proc",
      allowed: true,
      required: true,
      severity: "error",
      description: "Application serves Business Process.",
      rationale: "Applications should be traceable to processes.",
      viewpointIds: ["vp-business-owner"]
    },
    {
      id: "rule-stakeholder-responsible-app",
      sourceComponentTypeId: "ct-stakeholder",
      connectionTypeId: "conn-responsible-for",
      targetComponentTypeId: "ct-app",
      allowed: true,
      required: false,
      severity: "error",
      description: "Stakeholder responsible_for Application.",
      rationale: "Application ownership is explicit.",
      viewpointIds: ["vp-business-owner"]
    }
  ],
  viewpoints: [
    {
      id: "vp-business-owner",
      name: "Business Owner View",
      description: "Business owner view.",
      stakeholderRole: "Business Owner",
      purpose: "Understand business support.",
      allowedComponentTypeIds: ["ct-stakeholder", "ct-app", "ct-proc", "ct-capability"],
      allowedConnectionTypeIds: ["conn-serves", "conn-responsible-for"],
      requiredComponentTypeIds: [],
      requiredConnectionTypeIds: []
    }
  ],
  viewpointRules: [
    {
      id: "vpr-business-owner",
      viewpointId: "vp-business-owner",
      allowedComponentTypeIds: ["ct-stakeholder", "ct-app", "ct-proc", "ct-capability"],
      allowedConnectionTypeIds: ["conn-serves", "conn-responsible-for"],
      allowedConnectionRuleIds: ["rule-app-serves-process", "rule-stakeholder-responsible-app"],
      requiredComponentTypeIds: [],
      requiredConnectionTypeIds: [],
      requiredConnectionRuleIds: []
    }
  ],
  validationRules: [
    {
      id: "vr-application-owner",
      name: "Application has responsible stakeholder",
      description: "Every application should have an owner.",
      scope: "metamodel",
      sourceComponentTypeId: "ct-app",
      requiredConnectionTypeId: "conn-responsible-for",
      targetComponentTypeId: "ct-stakeholder",
      direction: "incoming",
      minOccurrences: 1,
      severity: "warning",
      message: "Application should have at least one responsible Stakeholder.",
      active: true
    }
  ]
};

const baseState: SidebarState = {
  ...definition,
  components: [
    { id: "stakeholder", name: "Owner", componentTypeId: "ct-stakeholder", properties: {}, description: "" },
    { id: "app", name: "ERP", componentTypeId: "ct-app", properties: {}, description: "" },
    { id: "proc", name: "Order to Cash", componentTypeId: "ct-proc", properties: {}, description: "" },
    { id: "cap", name: "Order Management", componentTypeId: "ct-capability", properties: {}, description: "" }
  ],
  connections: [
    { id: "app-serves-proc", name: "", connectionTypeId: "conn-serves", sourceComponentId: "app", targetComponentId: "proc", description: "" },
    { id: "owner-responsible-app", name: "", connectionTypeId: "conn-responsible-for", sourceComponentId: "stakeholder", targetComponentId: "app", description: "" }
  ],
  diagrams: [
    { id: "diagram", name: "Diagram", description: "", componentIds: ["stakeholder", "app", "proc"], connectionIds: ["app-serves-proc", "owner-responsible-app"], positions: {}, metamodelId: "old-mm", viewpointId: "vp-business-owner" }
  ]
};

describe("Metamodel JSON configuration", () => {
  it("exports a complete metamodel JSON structure without diagram instances", () => {
    const exported = extractMetamodelDefinition(baseState);
    expect(exported.metamodel.id).toBe("mm-import-test");
    expect(exported.componentTypes).toHaveLength(4);
    expect(exported.connectionTypes).toHaveLength(2);
    expect(exported.connectionRules).toHaveLength(2);
    expect(exported.viewpoints).toHaveLength(1);
    expect(exported.viewpointRules).toHaveLength(1);
    expect(exported.validationRules).toHaveLength(1);
    expect("components" in exported).toBe(false);
    expect("diagrams" in exported).toBe(false);
  });

  it("accepts a valid metamodel JSON definition", () => {
    const result = validateMetamodelDefinition(definition);
    expect(result.success).toBe(true);
    expect(result.importedCounts.connectionRules).toBe(2);
  });

  it("rejects a ConnectionRule with an unknown ComponentType", () => {
    const invalid: MetamodelDefinition = {
      ...definition,
      connectionRules: [{ ...definition.connectionRules[0], sourceComponentTypeId: "ct-missing" }]
    };
    const result = validateMetamodelDefinition(invalid);
    expect(result.success).toBe(false);
    expect(result.definition).toBeUndefined();
    expect(result.errors.some((error) => error.code === "UNKNOWN_SOURCE_COMPONENT_TYPE")).toBe(true);
  });

  it("rejects a ConnectionRule with an unknown ConnectionType", () => {
    const invalid: MetamodelDefinition = {
      ...definition,
      connectionRules: [{ ...definition.connectionRules[0], connectionTypeId: "conn-missing" }]
    };
    const result = validateMetamodelDefinition(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.code === "UNKNOWN_CONNECTION_TYPE")).toBe(true);
  });

  it("rejects legacy migration rules in imported metamodel JSON", () => {
    const invalid: MetamodelDefinition = {
      ...definition,
      connectionRules: [{ ...definition.connectionRules[0], id: "legacy-rule-conn-serves-ct-app-ct-proc" }]
    };
    const result = validateMetamodelDefinition(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.code === "LEGACY_CONNECTION_RULE_NOT_ALLOWED")).toBe(true);
  });

  it("rejects an invalid ViewpointRule reference", () => {
    const invalid: MetamodelDefinition = {
      ...definition,
      viewpointRules: [{ ...definition.viewpointRules[0], allowedConnectionRuleIds: ["rule-missing"] }]
    };
    const result = validateMetamodelDefinition(invalid);
    expect(result.success).toBe(false);
    expect(result.errors.some((error) => error.code === "UNKNOWN_ALLOWED_CONNECTION_RULE")).toBe(true);
  });

  it("updates diagram metamodelId when a metamodel definition is applied", () => {
    const nextState = applyMetamodelDefinition(baseState, definition);
    expect(nextState.diagrams[0].metamodelId).toBe(definition.metamodel.id);
  });

  it("validates a diagram against imported ConnectionRules", () => {
    const nextState = applyMetamodelDefinition(baseState, definition);
    const result = validateDiagram(nextState.diagrams[0], nextState, { includeRequiredRules: false });
    expect(result.valid).toBe(true);
  });
});
