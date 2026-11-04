import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AccessContext, ROLES, type Role } from "./access";
import CatalogView from "./CatalogView";
import SidebarPanels from "./Sidebar/SidebarPanels";
import ImportDialog, { describeImportResult } from "./ImportDialog";
import { buildExportQuery, type ImportPreview } from "./transferApi";
import type { SidebarState } from "./Sidebar/sidebarTypes";

const noop = () => {};
const state: SidebarState = {
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [{ id: "type", name: "Application", description: "", color: "#fff", icon: "app", customPropertyKeys: ["owner"] }],
  connectionTypes: [], connectionRules: [], viewpoints: [], viewpointRules: [], validationRules: [],
  components: [{ id: "c1", externalId: "CMDB-7", name: "Inventory", componentTypeId: "type", description: "Details", properties: { owner: "Team" } }],
  connections: [], diagrams: [],
  catalogs: [{ id: "cat", name: "Anwendungen", description: "", kind: "elements", componentTypeIds: ["type"], connectionTypeIds: [], propertyKeys: ["owner"], columns: ["externalId"] }]
};

describe("CatalogView", () => {
  it.each(ROLES)("lists elements and offers export for %s, import only for writers", (role: Role) => {
    const html = renderToStaticMarkup(
      <AccessContext.Provider value={role}>
        <CatalogView catalog={state.catalogs[0]} onClose={noop} sidebarState={state} onStateChange={noop} selection={null} onSelect={noop} />
      </AccessContext.Provider>
    );
    expect(html).toContain("Inventory");
    expect(html).toContain("CMDB-7");
    expect(html).toContain("owner");
    expect(html).toContain("Team");
    expect(html).not.toContain("Ebene<");
    expect(html).toContain("Excel");
    expect(html).toContain("CSV");
    expect(html.includes("Importieren")).toBe(role === "Admin" || role === "Architect");
  });
});

describe("catalog editor panel", () => {
  it.each(ROLES)("lets only writers save catalog changes (%s)", (role: Role) => {
    const html = renderToStaticMarkup(
      <AccessContext.Provider value={role}>
        <SidebarPanels selection={{ kind: "catalog", id: "cat" }} sidebarState={state} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onOpenCatalog={noop} onClose={noop} />
      </AccessContext.Provider>
    );
    expect(html).toContain("Anwendungen");
    expect(html).toContain("Katalog öffnen");
    expect(html).toContain("owner");
    expect(html.includes("Speichern")).toBe(role === "Admin" || role === "Architect");
  });
});

describe("import helpers", () => {
  it("renders the dialog without a file", () => {
    const html = renderToStaticMarkup(<ImportDialog onClose={noop} onImported={async () => {}} />);
    expect(html).toContain("Datei wählen");
    expect(html).toContain("Import übernehmen");
  });

  it("builds a filtered export query", () => {
    const query = new URLSearchParams(buildExportQuery({ format: "csv", sheet: "elements", typeIds: ["a", "b"], query: " erp " }));
    expect(query.get("format")).toBe("csv");
    expect(query.get("typeIds")).toBe("a,b");
    expect(query.get("q")).toBe("erp");
    expect(query.has("connectionTypeIds")).toBe(false);
  });

  it("summarises an import result", () => {
    const preview = {
      summary: { elements: { new: 2, changed: 1, unchanged: 0, error: 1 }, relations: { new: 0, changed: 0, unchanged: 0, error: 0 } }
    } as unknown as ImportPreview;
    expect(describeImportResult(preview)).toBe("2 neu angelegt, 1 geändert, 1 fehlerhafte Zeilen übersprungen.");
  });
});
