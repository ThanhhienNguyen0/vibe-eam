import { describe, expect, it } from "vitest";
import { sampleState } from "../importExport/fixtures.js";
import { buildExportSheets, buildTemplateSheets } from "../importExport/exportBuilder.js";
import {
  elementCatalogRows,
  NO_MATCH_ID,
  availablePropertyKeys,
  catalogComponentTypes,
  catalogElementFilter,
  catalogPropertyKeys,
  catalogRelationFilter,
  filterElements,
  filterRelations,
  propertyKeysForTypes,
  relationCatalogRows
} from "./catalogModel.js";

describe("catalog model", () => {
  const state = sampleState();

  it("resolves catalog selections against existing types", () => {
    const apps = { componentTypeIds: ["ct-app"], connectionTypeIds: [], propertyKeys: ["owner", "gone"], columns: [], kind: "elements" as const };
    expect(catalogComponentTypes(apps, state).map((type) => type.id)).toEqual(["ct-app"]);
    expect(availablePropertyKeys(apps, state)).toEqual(["owner", "criticality"]);
    expect(catalogPropertyKeys(apps, state)).toEqual(["owner"]);
    expect(catalogElementFilter(apps, state).typeIds).toEqual(["ct-app"]);
    // empty selection means all concrete types, a selection of deleted types matches nothing
    expect(catalogComponentTypes({ componentTypeIds: [] }, state).map((type) => type.id)).toEqual(["ct-app", "ct-data"]);
    expect(filterElements(state, catalogElementFilter({ componentTypeIds: ["deleted"] }, state))).toEqual([]);
    expect(catalogElementFilter({ componentTypeIds: ["deleted"] }, state).typeIds).toEqual([NO_MATCH_ID]);
    expect(catalogRelationFilter({ connectionTypeIds: ["conn-uses"] }, state).connectionTypeIds).toEqual(["conn-uses"]);
  });

  it("filters elements by type and by a case-insensitive query over name, type, external id and properties", () => {
    expect(filterElements(state, { typeIds: ["ct-data"] }).map((item) => item.id)).toEqual(["data-1"]);
    expect(filterElements(state, { query: "cmdb" }).map((item) => item.id)).toEqual(["app-1"]);
    expect(filterElements(state, { query: "INTERNAL" }).map((item) => item.id)).toEqual(["data-1"]);
    expect(filterElements(state, { query: "data object" }).map((item) => item.id)).toEqual(["data-1"]);
    expect(filterElements(state, { typeIds: ["ct-app"], query: "invoice" })).toEqual([]);
  });

  it("filters relations by type and by endpoint names", () => {
    expect(filterRelations(state, { connectionTypeIds: ["conn-depends"] })).toEqual([]);
    expect(filterRelations(state, { query: "invoice" }).map((item) => item.id)).toEqual(["c-1"]);
  });

  it("reports usage: connection counts and diagrams containing the element", () => {
    const rows = elementCatalogRows(state);
    expect(rows.find((item) => item.id === "app-1")).toMatchObject({ outgoing: 1, incoming: 0, diagrams: ["Overview"], externalId: "CMDB-1", layer: "Application" });
    expect(rows.find((item) => item.id === "app-2")).toMatchObject({ outgoing: 0, incoming: 0, diagrams: [] });
    expect(relationCatalogRows(state)[0]).toMatchObject({ sourceName: "ERP", targetName: "Invoice", typeName: "uses" });
  });

  it("keeps property column order stable across types", () => {
    expect(propertyKeysForTypes(state.componentTypes)).toEqual(["owner", "criticality", "classification"]);
  });
});

describe("export builder", () => {
  const state = sampleState();

  it("exports exactly the filtered elements and only relations between them", () => {
    const [elements, relations] = buildExportSheets(state, { elementFilter: { typeIds: ["ct-app"] } });
    expect(elements.rows.map((row) => row[0])).toEqual(["ID", "app-1", "app-2"]);
    expect(elements.rows[0]).toEqual(["ID", "Externe ID", "Typ", "Name", "Beschreibung", "owner", "criticality"]);
    expect(relations.rows).toHaveLength(1);
    const all = buildExportSheets(state);
    expect(all[1].rows[1].slice(0, 5)).toEqual(["c-1", "REL-1", "uses", "CMDB-1", "data-1"]);
  });

  it("supports a relations-only export with its own filter", () => {
    const [relations] = buildExportSheets(state, { sheet: "relations", relationFilter: { connectionTypeIds: ["conn-uses"] } });
    expect(relations.name).toBe("Relationen");
    expect(relations.rows.map((row) => row[0])).toEqual(["ID", "c-1"]);
    expect(buildExportSheets(state, { sheet: "relations", relationFilter: { query: "nothing" } })[0].rows).toHaveLength(1);
  });

  it("builds a template with header-only sheets and an instruction sheet", () => {
    const sheets = buildTemplateSheets(state);
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Elemente", "Relationen", "Hinweise"]);
    expect(sheets[0].rows).toEqual([["ID", "Externe ID", "Typ", "Name", "Beschreibung", "owner", "criticality", "classification"]]);
    expect(sheets[1].rows).toHaveLength(1);
    const notes = sheets[2].rows.map((row) => row.join(" "));
    expect(notes.some((line) => line.startsWith("Elementtyp Application"))).toBe(true);
    expect(notes.some((line) => line.includes("Application – uses → Data Object"))).toBe(true);
    expect(notes.some((line) => line.includes("Abstract"))).toBe(false);
    expect(buildTemplateSheets(state, "relations").map((sheet) => sheet.name)).toEqual(["Relationen"]);
  });
});

describe("catalog export", () => {
  const state = sampleState();

  it("restricts property and standard columns but keeps ID, type and name for re-import", () => {
    const [sheet] = buildExportSheets(state, {
      sheet: "elements",
      elementFilter: catalogElementFilter(state.catalogs[0], state),
      propertyKeys: catalogPropertyKeys(state.catalogs[0], state),
      columns: state.catalogs[0].columns
    });
    expect(sheet.rows[0]).toEqual(["ID", "Typ", "Name", "Beschreibung", "owner"]);
    expect(sheet.rows.map((row) => row[0])).toEqual(["ID", "app-1", "app-2"]);
  });

  it("exports a relation catalog with its own columns", () => {
    const [sheet] = buildExportSheets(state, { sheet: "relations", relationFilter: catalogRelationFilter(state.catalogs[1], state), columns: state.catalogs[1].columns });
    expect(sheet.rows[0]).toEqual(["ID", "Externe ID", "Typ", "Quelle", "Ziel", "Quelle (Name)", "Ziel (Name)"]);
    expect(sheet.rows).toHaveLength(2);
  });
});
