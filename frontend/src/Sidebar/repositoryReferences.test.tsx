import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeComponentName as backendNormalize } from "../../../backend/src/Sidebar/componentDuplicates";
import { AccessContext } from "../access";
import SidebarPanels from "./SidebarPanels";
import {
  deleteComponentConfirmation,
  deleteConnectionConfirmation,
  diagramsUsingComponent,
  findDuplicateComponents,
  findSameNameInOtherTypes,
  normalizeComponentName,
  removeComponentFromState,
  removeConnectionFromState,
  uniqueComponentName,
  uniqueName
} from "./repositoryReferences";
import type { Diagram, SidebarState } from "./sidebarTypes";

const noop = () => {};
const diagram = (id: string, name: string, componentIds: string[], connectionIds: string[] = []): Diagram => ({
  id, name, description: "", componentIds, connectionIds,
  positions: Object.fromEntries(componentIds.map((componentId) => [componentId, { x: 0, y: 0 }]))
});
const state: SidebarState = {
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [
    { id: "app", name: "Application", description: "", color: "#fff", icon: "app", customPropertyKeys: [] },
    { id: "cap", name: "Capability", description: "", color: "#fff", icon: "", customPropertyKeys: [] }
  ],
  connectionTypes: [], connectionRules: [], viewpoints: [], viewpointRules: [], validationRules: [], catalogs: [],
  components: [
    { id: "crm", name: "CRM System", componentTypeId: "app", description: "", properties: {} },
    { id: "crm-copy", name: "crm  system", componentTypeId: "app", description: "", properties: {} },
    { id: "erp", name: "ERP", componentTypeId: "app", description: "", properties: {} },
    { id: "crm-cap", name: "CRM System", componentTypeId: "cap", description: "", properties: {} }
  ],
  connections: [{ id: "crm-erp", name: "", connectionTypeId: "uses", sourceComponentId: "crm", targetComponentId: "erp", description: "" }],
  diagrams: [
    diagram("d1", "Kontext", ["crm", "erp"], ["crm-erp"]),
    diagram("d2", "Landschaft", ["crm"]),
    diagram("d3", "Finanzen", ["erp"])
  ]
};

describe("REQ-02 duplicate detection in the UI", () => {
  it("uses exactly the backend normalization", () => {
    for (const name of ["CRM System", "  crm   system ", "CRMSystem", "Äpfel Ü", "ERP"]) {
      expect(normalizeComponentName(name)).toBe(backendNormalize(name));
    }
  });

  it("finds same-type duplicates only and skips the element itself", () => {
    expect(findDuplicateComponents(state.components, { name: "Crm System", componentTypeId: "app" }).map((item) => item.id)).toEqual(["crm", "crm-copy"]);
    expect(findDuplicateComponents(state.components, { name: "CRM System", componentTypeId: "app" }, "crm").map((item) => item.id)).toEqual(["crm-copy"]);
  });

  it("warns about duplicate metamodel type names in the type editor", () => {
    const withTypes: SidebarState = {
      ...state,
      componentTypes: [...state.componentTypes, { id: "app-2", name: " application ", description: "", color: "#fff", icon: "", customPropertyKeys: [] }]
    };
    const html = renderToStaticMarkup(<AccessContext.Provider value="Admin">
      <SidebarPanels selection={{ kind: "componentType", id: "app-2" }} sidebarState={withTypes} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onOpenCatalog={noop} onClose={noop} />
    </AccessContext.Provider>);
    expect(html).toContain("Mögliches Duplikat");
    expect(html).toContain("Dieser Name ist bereits vergeben");
    expect(uniqueName(withTypes.componentTypes, "Application")).toBe("Application 2");
  });

  it("offers the existing element when a fresh element only differs by type", () => {
    const fresh: SidebarState = {
      ...state,
      components: [...state.components, { id: "fresh", name: "erp", componentTypeId: "cap", description: "", properties: {} }]
    };
    expect(findSameNameInOtherTypes(fresh.components, fresh.components[4], "fresh").map((item) => item.id)).toEqual(["erp"]);
    const html = renderToStaticMarkup(<AccessContext.Provider value="Architect">
      <SidebarPanels selection={{ kind: "component", id: "fresh" }} sidebarState={fresh} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onOpenCatalog={noop} onClose={noop} />
    </AccessContext.Provider>);
    expect(html).toContain("Gleicher Name bei anderem Typ");
    expect(html).toContain("ERP (Application)");
    expect(html).toContain("Vorhandenes Element verwenden");
  });

  it("generates unique default names for quick creation", () => {
    expect(uniqueComponentName(state.components, "ERP", "app")).toBe("ERP 2");
    expect(uniqueComponentName(state.components, "ERP", "cap")).toBe("ERP");
  });

  it("shows the hint with a link and the option to use the existing element", () => {
    const html = renderToStaticMarkup(<AccessContext.Provider value="Architect">
      <SidebarPanels selection={{ kind: "component", id: "crm-copy" }} sidebarState={state} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onOpenCatalog={noop} onClose={noop} />
    </AccessContext.Provider>);
    expect(html).toContain("Mögliches Duplikat");
    expect(html).toContain("Vorhandenes Element verwenden");
    expect(html).toContain("Verwendet in");
  });
});

describe("REQ-03 single source of truth", () => {
  it("lists every diagram that references an element", () => {
    expect(diagramsUsingComponent(state.diagrams, "crm").map((item) => item.name)).toEqual(["Kontext", "Landschaft"]);
  });

  it("removes a deleted element and its connections from every diagram", () => {
    const next = removeComponentFromState(state, "crm");
    expect(next.components.map((item) => item.id)).not.toContain("crm");
    expect(next.connections).toEqual([]);
    expect(next.diagrams.map((item) => item.componentIds)).toEqual([["erp"], [], ["erp"]]);
    expect(next.diagrams[0].connectionIds).toEqual([]);
    expect(next.diagrams[1].positions).toEqual({});
  });

  it("removes a deleted connection from every diagram", () => {
    expect(removeConnectionFromState(state, "crm-erp").diagrams[0].connectionIds).toEqual([]);
  });

  it("warns about other diagrams before deleting from the repository", () => {
    const request = deleteComponentConfirmation(state.components[0], state.diagrams, state.connections);
    expect(request.tone).toBe("danger");
    expect(request.itemsLabel).toContain("2 Diagrammen");
    expect(request.items).toEqual(["Kontext", "Landschaft"]);
    expect(request.notes).toContain("1 zugehörige Verbindung wird mit gelöscht.");
    const unused = deleteComponentConfirmation(state.components[3], state.diagrams, state.connections);
    expect(unused.items).toEqual([]);
    expect(unused.itemsLabel).toBeUndefined();
    expect(deleteConnectionConfirmation("CRM → ERP", "crm-erp", state.diagrams).itemsLabel).toContain("1 Diagramm.");
  });

  it("renders the 'Verwendet in' list in the properties panel", () => {
    const html = renderToStaticMarkup(<AccessContext.Provider value="Viewer">
      <SidebarPanels selection={{ kind: "component", id: "crm" }} sidebarState={state} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onOpenCatalog={noop} onClose={noop} />
    </AccessContext.Provider>);
    expect(html).toContain("Verwendet in");
    expect(html).toContain("Kontext");
    expect(html).toContain("Landschaft");
    expect(html).not.toContain("Finanzen");
  });
});
