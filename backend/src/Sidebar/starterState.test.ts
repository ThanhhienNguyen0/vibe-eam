import { describe, expect, it } from "vitest";
import { extractMetamodelDefinition, validateMetamodelDefinition } from "./metamodelConfig.js";
import { validateDiagram } from "./metamodelRules.js";
import { buildInitialSidebarStateForCompany } from "./sidebarStore.js";

describe("new company starter diagrams", () => {
  it("provides four editable EAM and simplified BPMN examples", () => {
    const state = buildInitialSidebarStateForCompany("company-demo");
    expect(state.diagrams.map((diagram) => diagram.name)).toEqual([
      "Demo – EAM Gesamtarchitektur",
      "Demo – EAM Business & Capability",
      "Demo – Application, Data & Technology",
      "Demo – BPMN Bestellfreigabe (vereinfacht)"
    ]);
    expect(state.components.some((component) => component.componentTypeId.endsWith(":ct-event-start"))).toBe(true);
    expect(state.components.some((component) => component.componentTypeId.endsWith(":ct-gw-xor"))).toBe(true);
    expect(state.connectionRules.some((rule) => rule.connectionTypeId.endsWith(":conn-seq"))).toBe(true);
  });

  it("keeps every starter diagram valid against its ConnectionRules and ViewpointRules", () => {
    const state = buildInitialSidebarStateForCompany("company-validation");
    for (const diagram of state.diagrams) {
      const result = validateDiagram(diagram, state);
      expect(result.errors, diagram.name).toEqual([]);
      expect(result.valid, diagram.name).toBe(true);
    }
  });

  it("creates a self-consistent exportable metamodel including the BPMN demo rules", () => {
    const state = buildInitialSidebarStateForCompany("company-metamodel");
    const result = validateMetamodelDefinition(extractMetamodelDefinition(state));
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("uses company-specific IDs and does not share starter data between companies", () => {
    const first = buildInitialSidebarStateForCompany("company-a");
    const second = buildInitialSidebarStateForCompany("company-b");
    expect(first.diagrams[0].id).not.toBe(second.diagrams[0].id);
    expect(first.diagrams.every((diagram) => diagram.id.startsWith("company-a:"))).toBe(true);
    expect(second.diagrams.every((diagram) => diagram.id.startsWith("company-b:"))).toBe(true);
  });

  it("can disable example instances without removing the metamodel", () => {
    const state = buildInitialSidebarStateForCompany("company-empty", false);
    expect(state.components).toEqual([]);
    expect(state.connections).toEqual([]);
    expect(state.diagrams).toEqual([]);
    expect(state.connectionRules.some((rule) => rule.connectionTypeId.endsWith(":conn-seq"))).toBe(true);
    expect(state.viewpoints.some((viewpoint) => viewpoint.id.endsWith(":vp-bpmn-demo"))).toBe(true);
  });
});
