import { describe, expect, it } from "vitest";
import { buildExportSheets } from "./exportBuilder.js";
import { sampleState, sequentialIds } from "./fixtures.js";
import { countErrors, planImport, type PlannedRow } from "./importPlan.js";
import type { ParsedImportFile } from "./tabular.js";

const ELEMENT_HEADER = ["ID", "Externe ID", "Typ", "Name", "Beschreibung", "owner", "criticality", "classification"];
const RELATION_HEADER = ["ID", "Externe ID", "Typ", "Quelle", "Ziel", "Name", "Beschreibung"];
const plan = (file: ParsedImportFile, state = sampleState()) => planImport(state, file, { newId: sequentialIds() });
const row = (result: ReturnType<typeof plan>, sheet: PlannedRow["sheet"], number: number) => {
  const found = result.rows.find((item) => item.sheet === sheet && item.row === number);
  if (!found) throw new Error(`no planned row ${sheet}:${number}`);
  return found;
};

describe("element import", () => {
  it("creates new elements when neither ID nor external ID matches", () => {
    const result = plan({ elements: [ELEMENT_HEADER, ["", "", "Application", "Billing", "Invoices", "Finance", "high", ""]] });
    expect(row(result, "elements", 2)).toMatchObject({ status: "new", label: "Billing", id: "new-1" });
    const created = result.nextState.components.find((item) => item.id === "new-1");
    expect(created).toMatchObject({ name: "Billing", componentTypeId: "ct-app", description: "Invoices", properties: { owner: "Finance", criticality: "high" } });
    expect(created).not.toHaveProperty("externalId");
    expect(result.hasChanges).toBe(true);
  });

  it("matches by ID and reports each changed field", () => {
    const result = plan({ elements: [ELEMENT_HEADER, ["app-1", "", "", "ERP 2", "Core ERP", "Finance", "", ""]] });
    const planned = row(result, "elements", 2);
    expect(planned.status).toBe("changed");
    expect(planned.changes).toEqual([
      { field: "Name", from: "ERP", to: "ERP 2" },
      { field: "owner", from: "IT", to: "Finance" }
    ]);
    expect(result.nextState.components.find((item) => item.id === "app-1")?.name).toBe("ERP 2");
  });

  it("matches by external ID when the ID is empty and keeps the entry id", () => {
    const result = plan({ elements: [ELEMENT_HEADER, ["", "CMDB-1", "Application", "ERP", "Updated", "IT", "", ""]] });
    expect(row(result, "elements", 2)).toMatchObject({ status: "changed", id: "app-1" });
    expect(result.nextState.components.filter((item) => item.name === "ERP")).toHaveLength(1);
  });

  it("reports unchanged rows and does not flag changes", () => {
    const result = plan({ elements: [ELEMENT_HEADER, ["app-1", "CMDB-1", "Application", "ERP", "Core ERP", "IT", "", ""]] });
    expect(row(result, "elements", 2).status).toBe("unchanged");
    expect(result.hasChanges).toBe(false);
  });

  it("sets an external ID on an existing element but never clears it with an empty cell", () => {
    const set = plan({ elements: [ELEMENT_HEADER, ["app-2", "CRM-9", "", "CRM", "", "", "", ""]] });
    expect(row(set, "elements", 2).changes).toEqual([{ field: "Externe ID", from: "", to: "CRM-9" }]);
    const keep = plan({ elements: [ELEMENT_HEADER, ["app-1", "", "", "ERP", "Core ERP", "IT", "", ""]] });
    expect(row(keep, "elements", 2).status).toBe("unchanged");
    expect(keep.nextState.components.find((item) => item.id === "app-1")?.externalId).toBe("CMDB-1");
  });

  it("clears a property when its cell is empty and leaves missing columns untouched", () => {
    const cleared = plan({ elements: [ELEMENT_HEADER, ["app-1", "", "", "ERP", "Core ERP", "", "", ""]] });
    expect(row(cleared, "elements", 2).changes).toEqual([{ field: "owner", from: "IT", to: "" }]);
    expect(cleared.nextState.components.find((item) => item.id === "app-1")?.properties).toEqual({});
    const withoutColumns = plan({ elements: [["ID", "Typ", "Name"], ["app-1", "", "ERP"]] });
    expect(row(withoutColumns, "elements", 2).status).toBe("unchanged");
    expect(withoutColumns.nextState.components.find((item) => item.id === "app-1")?.properties).toEqual({ owner: "IT" });
    expect(withoutColumns.nextState.components.find((item) => item.id === "app-1")?.description).toBe("Core ERP");
  });

  it.each([
    ["unknown ID", ["nope", "", "Application", "X", "", "", "", ""], /ID „nope“ ist unbekannt/],
    ["missing name", ["", "", "Application", "", "", "", "", ""], /Name fehlt/],
    ["missing type", ["", "", "", "X", "", "", "", ""], /Typ fehlt/],
    ["unknown type", ["", "", "Banana", "X", "", "", "", ""], /Typ „Banana“ ist unbekannt/],
    ["abstract type", ["", "", "Abstract", "X", "", "", "", ""], /abstrakt/],
    ["external id owned by another element", ["app-2", "CMDB-1", "", "CRM", "", "", "", ""], /gehört zu einem anderen Element/],
    ["overlong name", ["", "", "Application", "x".repeat(201), "", "", "", ""], /Name ist länger/]
  ])("rejects a row with %s without touching the state", (_name, cells, message) => {
    const result = plan({ elements: [ELEMENT_HEADER, cells] });
    const planned = row(result, "elements", 2);
    expect(planned.status).toBe("error");
    expect(planned.errors.join(" ")).toMatch(message);
    expect(result.nextState.components).toEqual(sampleState().components);
    expect(result.hasChanges).toBe(false);
  });

  it("flags duplicates inside the file", () => {
    const result = plan({ elements: [
      ELEMENT_HEADER,
      ["app-2", "", "", "CRM", "", "", "", ""],
      ["app-2", "", "", "CRM again", "", "", "", ""],
      ["", "SAP-1", "Application", "SAP", "", "", "", ""],
      ["", "SAP-1", "Application", "SAP copy", "", "", "", ""]
    ] });
    expect(row(result, "elements", 3).errors.join(" ")).toMatch(/bereits in Zeile 2/);
    expect(row(result, "elements", 5).errors.join(" ")).toMatch(/Externe ID „SAP-1“ steht bereits in Zeile 4/);
    expect(result.summary.elements).toEqual({ new: 1, changed: 0, unchanged: 1, error: 2 });
  });

  it("ignores properties that do not belong to the type and warns only when a value is given", () => {
    const result = plan({ elements: [ELEMENT_HEADER, ["", "", "Data Object", "Order", "", "ignored-owner", "", "public"]] });
    const planned = row(result, "elements", 2);
    expect(planned.status).toBe("new");
    expect(planned.warnings.join(" ")).toMatch(/Eigenschaft „owner“/);
    expect(result.nextState.components.at(-1)?.properties).toEqual({ classification: "public" });
  });

  it("warns about an existing element with the same name and type but still creates", () => {
    const result = plan({ elements: [ELEMENT_HEADER, ["", "", "Application", "erp", "", "", "", ""]] });
    expect(row(result, "elements", 2)).toMatchObject({ status: "new" });
    expect(row(result, "elements", 2).warnings.join(" ")).toMatch(/gleichem Namen und Typ/);
  });

  it("reports missing required columns and unknown columns at file level", () => {
    const missing = plan({ elements: [["ID", "Name"], ["", "X"]] });
    expect(missing.fileErrors.join(" ")).toMatch(/Spalte „Typ“ fehlt/);
    expect(missing.rows).toHaveLength(0);
    expect(countErrors(missing)).toBe(1);
    const unknown = plan({ elements: [["Typ", "Name", "Mystery"], ["Application", "X", "?"]] });
    expect(unknown.fileWarnings.join(" ")).toMatch(/Mystery/);
    expect(row(unknown, "elements", 2).status).toBe("new");
  });

  it("skips fully empty rows and accepts English header aliases", () => {
    const result = plan({ elements: [["id", "external id", "type", "name", "description"], ["", "", "", "", ""], ["", "", "Application", "X", ""]] });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].row).toBe(3);
  });
});

describe("relation import", () => {
  it("creates relations that reference elements by ID, external ID or unique name", () => {
    const result = plan({ relations: [
      RELATION_HEADER,
      ["", "", "uses", "app-2", "data-1", "", ""],
      ["", "", "depends_on", "CMDB-1", "crm", "", ""]
    ] });
    expect(row(result, "relations", 2)).toMatchObject({ status: "new", label: "CRM → Invoice" });
    expect(row(result, "relations", 3)).toMatchObject({ status: "new", label: "ERP → CRM" });
    expect(result.nextState.connections).toHaveLength(3);
  });

  it("resolves references to elements created in the same file", () => {
    const result = plan({
      elements: [ELEMENT_HEADER, ["", "NEW-1", "Application", "Billing", "", "", "", ""]],
      relations: [RELATION_HEADER, ["", "", "uses", "NEW-1", "Invoice", "", ""]]
    });
    expect(row(result, "relations", 2).status).toBe("new");
    const billing = result.nextState.components.find((item) => item.name === "Billing");
    expect(result.nextState.connections.at(-1)).toMatchObject({ sourceComponentId: billing?.id, targetComponentId: "data-1" });
  });

  it("rejects relations whose endpoints are missing, ambiguous or from a failed element row", () => {
    const state = sampleState();
    state.components.push({ id: "app-3", name: "CRM", componentTypeId: "ct-app", description: "", properties: {} });
    const result = plan({
      elements: [ELEMENT_HEADER, ["", "", "Banana", "Broken", "", "", "", ""]],
      relations: [RELATION_HEADER, ["", "", "depends_on", "CRM", "ERP", "", ""], ["", "", "uses", "Broken", "Invoice", "", ""], ["", "", "uses", "Ghost", "Invoice", "", ""]]
    }, state);
    expect(row(result, "relations", 2).errors.join(" ")).toMatch(/mehrdeutig/);
    expect(row(result, "relations", 3).errors.join(" ")).toMatch(/nicht gefunden/);
    expect(row(result, "relations", 4).errors.join(" ")).toMatch(/nicht gefunden/);
  });

  it("enforces the metamodel connection rules", () => {
    const result = plan({ relations: [RELATION_HEADER, ["", "", "uses", "Invoice", "ERP", "", ""]] });
    const planned = row(result, "relations", 2);
    expect(planned.status).toBe("error");
    expect(planned.errors.join(" ")).toMatch(/according to the active metamodel/);
  });

  it("rejects an identical relation when no ID is given and updates it when the ID is given", () => {
    const duplicate = plan({ relations: [RELATION_HEADER, ["", "", "uses", "ERP", "Invoice", "", ""]] });
    expect(row(duplicate, "relations", 2).errors.join(" ")).toMatch(/identische Verbindung existiert bereits \(ID c-1\)/);
    const update = plan({ relations: [RELATION_HEADER, ["c-1", "", "uses", "ERP", "Invoice", "reads", "Reads invoices"]] });
    expect(row(update, "relations", 2).changes).toEqual([
      { field: "Name", from: "", to: "reads" },
      { field: "Beschreibung", from: "", to: "Reads invoices" }
    ]);
  });

  it("matches existing relations by external ID", () => {
    const result = plan({ relations: [RELATION_HEADER, ["", "REL-1", "", "", "", "label", ""]] });
    expect(row(result, "relations", 2)).toMatchObject({ status: "changed", id: "c-1" });
    expect(result.nextState.connections[0]).toMatchObject({ name: "label", sourceComponentId: "app-1", targetComponentId: "data-1" });
  });

  it("reports missing required columns and ignores the informational name columns", () => {
    const result = plan({ relations: [["ID", "Typ", "Quelle"], ["", "uses", "ERP"]] });
    expect(result.fileErrors.join(" ")).toMatch(/Spalte „Ziel“ fehlt/);
    const informational = plan({ relations: [[...RELATION_HEADER, "Quelle (Name)", "Ziel (Name)"], ["c-1", "", "uses", "app-1", "data-1", "", "", "ERP", "Invoice"]] });
    expect(informational.fileWarnings).toEqual([]);
    expect(row(informational, "relations", 2).status).toBe("unchanged");
  });
});

describe("export and re-import", () => {
  it("re-importing an unmodified export yields only unchanged rows", () => {
    const state = sampleState();
    const [elements, relations] = buildExportSheets(state);
    const result = planImport(state, { elements: elements.rows, relations: relations.rows });
    expect(result.rows.length).toBe(4);
    expect(result.rows.every((item) => item.status === "unchanged")).toBe(true);
    expect(result.hasChanges).toBe(false);
  });

  it("applies edits made in the spreadsheet to the exported rows", () => {
    const state = sampleState();
    const [elements] = buildExportSheets(state, { sheet: "elements" });
    const edited = elements.rows.map((cells) => [...cells]);
    edited[1][3] = "ERP (renamed)";
    const result = planImport(state, { elements: edited });
    expect(result.summary.elements).toEqual({ new: 0, changed: 1, unchanged: 2, error: 0 });
  });
});
