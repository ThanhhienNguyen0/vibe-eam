import { describe, expect, it } from "vitest";
import { analyzeImpact, isRelationAllowed } from "./metamodel.js";
import { validateRelation } from "./validation.js";
import type { EamElement, EamModel } from "./types.js";

function element(id: string, name: string, type: EamElement["type"], x = 0): EamElement {
  const layer = type === "Application Component" ? "Application" : type === "Data Object" ? "Data" : type === "Technology Node" ? "Technology" : "Business";
  return {
    id,
    name,
    type,
    layer,
    description: "",
    risk: "medium",
    cost: 0,
    status: "active",
    startDate: "2026-01-01",
    endOfLifeDate: "2030-01-01",
    customAttributes: {},
    position: { x, y: 0 }
  };
}

const model: EamModel = {
  elements: [
    element("cap", "Customer Management", "Business Capability"),
    element("process", "Customer Onboarding", "Business Process"),
    element("app", "CRM System", "Application Component"),
    element("data", "Customer Data", "Data Object"),
    element("tech", "Database Cluster", "Technology Node"),
    element("runtime", "Cloud Runtime", "Technology Node")
  ],
  relations: [
    { id: "r1", source: "process", target: "cap", type: "realizes", description: "" },
    { id: "r2", source: "app", target: "process", type: "serves", description: "" },
    { id: "r3", source: "app", target: "data", type: "uses", description: "" },
    { id: "r4", source: "data", target: "tech", type: "depends_on", description: "" },
    { id: "r5", source: "tech", target: "runtime", type: "depends_on", description: "" }
  ]
};

describe("EAM metamodel", () => {
  it("allows a defined relation rule", () => {
    expect(isRelationAllowed("Application Component", "uses", "Data Object")).toBe(true);
  });

  it("rejects an invalid relation semantically", () => {
    const result = validateRelation({ id: "invalid", source: "data", target: "cap", type: "serves", description: "" }, model);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Relation 'serves' from Data Object to Business Capability is not allowed by the EAM metamodel.");
  });

  it("computes downstream business impact recursively", () => {
    const result = analyzeImpact(model, "tech", "downstream");
    expect(result.map((step) => step.elementId)).toEqual(["data", "app", "process", "cap"]);
    expect(result.at(-1)?.path).toEqual(["tech", "data", "app", "process", "cap"]);
  });

  it("computes upstream dependencies recursively", () => {
    const result = analyzeImpact(model, "cap", "upstream");
    expect(result.map((step) => step.elementId)).toEqual(["process", "app", "data", "tech", "runtime"]);
  });

  it("prevents cycles during graph traversal", () => {
    const cyclicModel: EamModel = {
      elements: [element("a", "App A", "Application Component"), element("b", "App B", "Application Component")],
      relations: [
        { id: "ab", source: "a", target: "b", type: "depends_on", description: "" },
        { id: "ba", source: "b", target: "a", type: "depends_on", description: "" }
      ]
    };

    const result = analyzeImpact(cyclicModel, "a", "upstream");
    expect(result).toHaveLength(1);
    expect(result[0].elementId).toBe("b");
  });
});
