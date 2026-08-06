import { describe, expect, it } from "vitest";
import { getAllowedConnectionTypes, validateConnectionInstance, validateDiagram } from "./metamodelRules.js";
import type { ConnectionRule, SidebarState, ValidationRule, ViewpointRule } from "./sidebarTypes.js";

const connectionRules: ConnectionRule[] = [
  { id: "rule-app-serves-proc", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-serves", targetComponentTypeId: "ct-proc", allowed: true, required: true, severity: "error", description: "Application serves Business Process.", rationale: "", viewpointIds: ["vp-business-owner"] },
  { id: "rule-proc-realizes-cap", sourceComponentTypeId: "ct-proc", connectionTypeId: "conn-realizes", targetComponentTypeId: "ct-capability", allowed: true, required: false, severity: "error", description: "Business Process realizes Business Capability.", rationale: "", viewpointIds: ["vp-business-owner"] },
  { id: "rule-stakeholder-responsible-app", sourceComponentTypeId: "ct-stakeholder", connectionTypeId: "conn-responsible-for", targetComponentTypeId: "ct-app", allowed: true, required: false, severity: "error", description: "Stakeholder responsible_for Application.", rationale: "", viewpointIds: ["vp-application-owner"] },
  { id: "rule-app-uses-data", sourceComponentTypeId: "ct-app", connectionTypeId: "conn-uses", targetComponentTypeId: "ct-data-object", allowed: true, required: false, severity: "error", description: "Application uses Data Object.", rationale: "", viewpointIds: ["vp-application-owner"] }
];

const viewpointRules: ViewpointRule[] = [
  {
    id: "vpr-management",
    viewpointId: "vp-management",
    allowedComponentTypeIds: ["ct-stakeholder", "ct-capability", "ct-app"],
    allowedConnectionTypeIds: ["conn-serves"],
    allowedConnectionRuleIds: [],
    requiredComponentTypeIds: ["ct-capability"],
    requiredConnectionTypeIds: [],
    requiredConnectionRuleIds: []
  },
  {
    id: "vpr-business-owner",
    viewpointId: "vp-business-owner",
    allowedComponentTypeIds: ["ct-capability", "ct-proc", "ct-app"],
    allowedConnectionTypeIds: ["conn-serves", "conn-realizes"],
    allowedConnectionRuleIds: ["rule-app-serves-proc", "rule-proc-realizes-cap"],
    requiredComponentTypeIds: ["ct-capability"],
    requiredConnectionTypeIds: ["conn-serves"],
    requiredConnectionRuleIds: []
  },
  {
    id: "vpr-application-owner",
    viewpointId: "vp-application-owner",
    allowedComponentTypeIds: ["ct-stakeholder", "ct-app", "ct-data-object"],
    allowedConnectionTypeIds: ["conn-responsible-for", "conn-uses"],
    allowedConnectionRuleIds: ["rule-stakeholder-responsible-app", "rule-app-uses-data"],
    requiredComponentTypeIds: [],
    requiredConnectionTypeIds: [],
    requiredConnectionRuleIds: []
  }
];

const validationRules: ValidationRule[] = [
  {
    id: "vr-application-owner",
    name: "Application has responsible stakeholder",
    description: "",
    scope: "metamodel",
    sourceComponentTypeId: "ct-app",
    requiredConnectionTypeId: "conn-responsible-for",
    targetComponentTypeId: "ct-stakeholder",
    direction: "incoming",
    minOccurrences: 1,
    severity: "warning",
    message: "Application should have at least one responsible Stakeholder.",
    active: true
  },
  {
    id: "vr-capability-realized",
    name: "Capability is realized",
    description: "",
    scope: "metamodel",
    sourceComponentTypeId: "ct-capability",
    requiredConnectionTypeId: "conn-realizes",
    targetComponentTypeId: "ct-proc",
    direction: "incoming",
    minOccurrences: 1,
    severity: "warning",
    message: "Business Capability should be realized by at least one Business Process.",
    active: true
  },
  {
    id: "vr-application-serves-process",
    name: "Application serves process",
    description: "",
    scope: "metamodel",
    sourceComponentTypeId: "ct-app",
    requiredConnectionTypeId: "conn-serves",
    targetComponentTypeId: "ct-proc",
    direction: "outgoing",
    minOccurrences: 1,
    severity: "warning",
    message: "Application should serve at least one Business Process.",
    active: true
  },
  {
    id: "vr-application-depends-technology",
    name: "Application has technology dependency",
    description: "",
    scope: "metamodel",
    sourceComponentTypeId: "ct-app",
    requiredConnectionTypeId: "conn-depends-on",
    targetComponentTypeId: "ct-technology-node",
    direction: "outgoing",
    minOccurrences: 1,
    severity: "warning",
    message: "Application should depend on at least one Technology Node.",
    active: true
  }
];

const state: SidebarState = {
  metamodel: {
    id: "mm",
    name: "Test Metamodel",
    description: "",
    version: "1",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  componentTypes: [
    { id: "ct-stakeholder", name: "Stakeholder", color: "#0891b2", icon: "user", description: "", customPropertyKeys: [], layer: "Business" },
    { id: "ct-app", name: "Application", color: "#2563eb", icon: "app", description: "", customPropertyKeys: [], layer: "Application" },
    { id: "ct-proc", name: "Business Process", color: "#0f766e", icon: "proc", description: "", customPropertyKeys: [], layer: "Business" },
    { id: "ct-capability", name: "Business Capability", color: "#0f766e", icon: "cap", description: "", customPropertyKeys: [], layer: "Business" },
    { id: "ct-data-object", name: "Data Object", color: "#7c3aed", icon: "data", description: "", customPropertyKeys: [], layer: "Data" },
    { id: "ct-technology-node", name: "Technology Node", color: "#475569", icon: "server", description: "", customPropertyKeys: [], layer: "Technology" }
  ],
  connectionTypes: [
    { id: "conn-serves", name: "serves", color: "#2563eb", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" },
    { id: "conn-realizes", name: "realizes", color: "#0f766e", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" },
    { id: "conn-uses", name: "uses", color: "#7c3aed", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" },
    { id: "conn-depends-on", name: "depends_on", color: "#dc2626", lineStyle: "dashed", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" },
    { id: "conn-responsible-for", name: "responsible_for", color: "#ea580c", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" }
  ],
  connectionRules,
  viewpointRules,
  validationRules,
  components: [
    { id: "stakeholder", name: "Application Owner", componentTypeId: "ct-stakeholder", properties: {}, description: "" },
    { id: "app", name: "ERP System", componentTypeId: "ct-app", properties: {}, description: "" },
    { id: "proc", name: "Order to Cash", componentTypeId: "ct-proc", properties: {}, description: "" },
    { id: "cap", name: "Order Management", componentTypeId: "ct-capability", properties: {}, description: "" },
    { id: "data", name: "Invoice Data", componentTypeId: "ct-data-object", properties: {}, description: "" },
    { id: "tech", name: "Database Cluster", componentTypeId: "ct-technology-node", properties: {}, description: "" }
  ],
  connections: [
    { id: "app-serves-proc", name: "", connectionTypeId: "conn-serves", sourceComponentId: "app", targetComponentId: "proc", description: "" },
    { id: "data-serves-cap", name: "", connectionTypeId: "conn-serves", sourceComponentId: "data", targetComponentId: "cap", description: "" },
    { id: "stakeholder-responsible-app", name: "", connectionTypeId: "conn-responsible-for", sourceComponentId: "stakeholder", targetComponentId: "app", description: "" },
    { id: "stakeholder-depends-tech", name: "", connectionTypeId: "conn-depends-on", sourceComponentId: "stakeholder", targetComponentId: "tech", description: "" },
    { id: "proc-realizes-cap", name: "", connectionTypeId: "conn-realizes", sourceComponentId: "proc", targetComponentId: "cap", description: "" }
  ],
  diagrams: [],
  viewpoints: [
    {
      id: "vp-management",
      name: "Management View",
      description: "",
      stakeholderRole: "Management",
      purpose: "",
      allowedComponentTypeIds: ["ct-stakeholder", "ct-capability", "ct-app"],
      allowedConnectionTypeIds: ["conn-serves"],
      requiredComponentTypeIds: ["ct-capability"],
      requiredConnectionTypeIds: []
    },
    {
      id: "vp-business-owner",
      name: "Business Owner View",
      description: "",
      stakeholderRole: "Business Owner",
      purpose: "",
      allowedComponentTypeIds: ["ct-capability", "ct-proc", "ct-app"],
      allowedConnectionTypeIds: ["conn-serves", "conn-realizes"],
      requiredComponentTypeIds: ["ct-capability"],
      requiredConnectionTypeIds: ["conn-serves"]
    },
    {
      id: "vp-application-owner",
      name: "Application Owner View",
      description: "",
      stakeholderRole: "Application Owner",
      purpose: "",
      allowedComponentTypeIds: ["ct-stakeholder", "ct-app", "ct-data-object"],
      allowedConnectionTypeIds: ["conn-responsible-for", "conn-uses"],
      requiredComponentTypeIds: [],
      requiredConnectionTypeIds: []
    }
  ]
};

describe("Sidebar metamodel connection rules", () => {
  it("produces a ValidationResult from validateDiagram", () => {
    const result = validateDiagram({ id: "d0", name: "Empty", description: "", componentIds: [], connectionIds: [], positions: {} }, state);
    expect(result).toMatchObject({ valid: true, errors: [], warnings: [] });
  });

  it("uses active Metamodel as default when Diagram has no metamodelId", () => {
    const result = validateDiagram({ id: "d0", name: "Empty", description: "", componentIds: [], connectionIds: [], positions: {} }, state);
    expect(result.errors.some((item) => item.code === "METAMODEL_MISMATCH")).toBe(false);
  });

  it("allows Application --serves--> Business Process", () => {
    const result = validateConnectionInstance(state.connections[0], state);
    expect(result.valid).toBe(true);
  });

  it("allows the same connection type from one source to multiple valid targets", () => {
    const extendedState: SidebarState = {
      ...state,
      components: [
        ...state.components,
        { id: "data-2", name: "Invoice Data 2", componentTypeId: "ct-data-object", properties: {}, description: "" }
      ]
    };
    const first = validateConnectionInstance({ id: "uses-1", name: "", connectionTypeId: "conn-uses", sourceComponentId: "app", targetComponentId: "data", description: "" }, extendedState);
    const second = validateConnectionInstance({ id: "uses-2", name: "", connectionTypeId: "conn-uses", sourceComponentId: "app", targetComponentId: "data-2", description: "" }, extendedState);
    expect(first.valid).toBe(true);
    expect(second.valid).toBe(true);
  });

  it("rejects Data Object --serves--> Business Capability", () => {
    const result = validateConnectionInstance(state.connections[1], state);
    expect(result.valid).toBe(false);
    expect(result.errors[0].message).toBe("Data Object may not serve Business Capability according to the active metamodel.");
    expect(result.errors[0].scope).toBe("metamodel");
    expect(result.errors[0].ruleType).toBe("connection-rule");
  });

  it("allows Stakeholder --responsible_for--> Application", () => {
    const result = validateConnectionInstance(state.connections[2], state);
    expect(result.valid).toBe(true);
  });

  it("rejects Stakeholder --depends_on--> Technology Node", () => {
    const result = validateConnectionInstance(state.connections[3], state);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("CONNECTION_RULE_MISSING");
  });

  it("ViewpointRule rejects Technology Node in Management View", () => {
    const diagram = { id: "d1", name: "Management", description: "", viewpointId: "vp-management", componentIds: ["app", "cap", "tech"], connectionIds: [], positions: {} };
    const result = validateDiagram(diagram, state, { includeRequiredRules: false });
    expect(result.valid).toBe(false);
    expect(result.errors.map((item) => item.message)).toContain("Technology Node is not allowed in Management View.");
  });

  it("ViewpointRule allows Application in Management View", () => {
    const diagram = { id: "d1a", name: "Management", description: "", viewpointId: "vp-management", componentIds: ["app", "cap"], connectionIds: [], positions: {} };
    const result = validateDiagram(diagram, state, { includeRequiredRules: false });
    expect(result.errors.some((item) => item.affectedEntityId === "app")).toBe(false);
  });

  it("reports missing Business Capability in Business Owner View", () => {
    const diagram = { id: "d2", name: "Business Owner", description: "", viewpointId: "vp-business-owner", componentIds: ["app", "proc"], connectionIds: ["app-serves-proc"], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.errors.map((item) => item.message)).toContain("Business Owner View requires at least one Business Capability.");
  });

  it("ValidationRule warns when Application has no responsible Stakeholder", () => {
    const diagram = { id: "d3", name: "Application", description: "", componentIds: ["app", "proc"], connectionIds: ["app-serves-proc"], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.warnings.map((item) => item.message)).toContain("ERP System: Application should have at least one responsible Stakeholder.");
  });

  it("ValidationRule warns when Business Capability has no incoming realizes", () => {
    const diagram = { id: "d4", name: "Capability", description: "", componentIds: ["cap"], connectionIds: [], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.warnings.map((item) => item.message)).toContain("Order Management: Business Capability should be realized by at least one Business Process.");
  });

  it("ValidationRule warns when Application serves no Business Process", () => {
    const diagram = { id: "d4a", name: "Application", description: "", componentIds: ["app"], connectionIds: [], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.warnings.map((item) => item.message)).toContain("ERP System: Application should serve at least one Business Process.");
  });

  it("checks required ConnectionRules without a selected viewpoint", () => {
    const diagram = { id: "d4-required", name: "Application", description: "", componentIds: ["app"], connectionIds: [], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.code === "REQUIRED_CONNECTION_RULE_MISSING" && item.ruleId === "rule-app-serves-proc")).toBe(true);
  });

  it("counts a second Data Object connection only after it belongs to the diagram", () => {
    const data2 = { id: "data-2", name: "Invoice Data 2", componentTypeId: "ct-data-object", properties: {}, description: "" };
    const usesData2 = { id: "uses-data-2", name: "", connectionTypeId: "conn-uses", sourceComponentId: "app", targetComponentId: "data-2", description: "" };
    const focusedState: SidebarState = {
      ...state,
      connectionRules: [{ ...connectionRules[3], required: true }],
      validationRules: [],
      components: [state.components[1], data2],
      connections: [usesData2]
    };
    const hidden = validateDiagram({ id: "data-diagram", name: "Data", description: "", componentIds: ["app", "data-2"], connectionIds: [], positions: {} }, focusedState);
    const visible = validateDiagram({ id: "data-diagram", name: "Data", description: "", componentIds: ["app", "data-2"], connectionIds: ["uses-data-2"], positions: {} }, focusedState);
    expect(hidden.errors.some((item) => item.code === "REQUIRED_CONNECTION_RULE_MISSING")).toBe(true);
    expect(visible.valid).toBe(true);
  });

  it("ValidationRule warns when Application has no technology dependency", () => {
    const diagram = { id: "d4b", name: "Application", description: "", componentIds: ["app", "proc"], connectionIds: ["app-serves-proc"], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.warnings.map((item) => item.message)).toContain("ERP System: Application should depend on at least one Technology Node.");
  });

  it("does not apply a ValidationRule whose target type is excluded by the selected viewpoint", () => {
    const diagram = { id: "d-app-view", name: "Application", description: "", viewpointId: "vp-application-owner", componentIds: ["stakeholder", "app", "data", "tech"], connectionIds: ["stakeholder-responsible-app"], positions: {} };
    const result = validateDiagram(diagram, state, { includeRequiredRules: false });
    expect(result.warnings.map((item) => item.message)).not.toContain("ERP System: Application should serve at least one Business Process.");
  });

  it("filters allowed connection types by ConnectionRule and ViewpointRule", () => {
    const allowed = getAllowedConnectionTypes(state, "ct-app", "ct-proc", "vp-business-owner");
    expect(allowed.map((type) => type.id)).toEqual(["conn-serves"]);
  });

  it("returns no fallback type when no ConnectionRule exists", () => {
    const allowed = getAllowedConnectionTypes(state, "ct-data-object", "ct-capability", "vp-business-owner");
    expect(allowed).toEqual([]);
  });

  it("does not treat allowedSourceTypeIds/allowedTargetTypeIds as the primary rule source", () => {
    const legacyOnlyState: SidebarState = {
      ...state,
      connectionTypes: state.connectionTypes.map((type) => (
        type.id === "conn-serves"
          ? { ...type, allowedSourceTypeIds: ["ct-data-object"], allowedTargetTypeIds: ["ct-capability"] }
          : type
      ))
    };
    const result = validateConnectionInstance(state.connections[1], legacyOnlyState);
    expect(result.valid).toBe(false);
    expect(result.errors[0].code).toBe("CONNECTION_RULE_MISSING");
  });

  it("returns structured ValidationMessages with severity and scope", () => {
    const diagram = { id: "d5", name: "Invalid", description: "", metamodelId: "other-mm", componentIds: ["data", "cap"], connectionIds: ["data-serves-cap"], positions: {} };
    const result = validateDiagram(diagram, state);
    expect(result.valid).toBe(false);
    expect(result.errors.some((item) => item.severity === "error" && item.scope === "metamodel")).toBe(true);
    expect(result.warnings.some((item) => item.severity === "warning" && item.scope === "required-rule")).toBe(true);
  });
});
