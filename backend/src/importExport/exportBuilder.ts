import {
  filterElements,
  filterRelations,
  propertyKeysForTypes,
  type CatalogSource,
  type ElementFilter,
  type RelationFilter
} from "../catalog/catalogModel.js";
import type { ConnectionRule, SidebarState } from "../Sidebar/sidebarTypes.js";
import type { NamedSheet, SheetKind, Table } from "./tabular.js";

export const SHEET_TITLES: Record<SheetKind, string> = {
  elements: "Elemente",
  relations: "Relationen"
};

export const ELEMENT_BASE_HEADERS = ["ID", "Externe ID", "Typ", "Name", "Beschreibung"] as const;
export const RELATION_HEADERS = [
  "ID", "Externe ID", "Typ", "Quelle", "Ziel", "Name", "Beschreibung", "Quelle (Name)", "Ziel (Name)"
] as const;

export type ExportSource = Pick<SidebarState, "componentTypes" | "connectionTypes" | "connectionRules" | "components" | "connections" | "diagrams">;

export interface ExportOptions {
  /** Restrict the workbook to a single sheet. Required for CSV. */
  sheet?: SheetKind;
  elementFilter?: ElementFilter;
  relationFilter?: RelationFilter;
}

function elementSheet(source: CatalogSource, filter: ElementFilter): { rows: Table; ids: Set<string> } {
  const components = filterElements(source, filter);
  const types = new Map(source.componentTypes.map((type) => [type.id, type]));
  const usedTypes = [...new Set(components.map((component) => component.componentTypeId))]
    .map((id) => types.get(id))
    .filter((type): type is NonNullable<typeof type> => Boolean(type));
  const propertyKeys = propertyKeysForTypes(usedTypes);
  const rows: Table = [[...ELEMENT_BASE_HEADERS, ...propertyKeys]];
  for (const component of components) {
    rows.push([
      component.id,
      component.externalId ?? "",
      types.get(component.componentTypeId)?.name ?? component.componentTypeId,
      component.name,
      component.description,
      ...propertyKeys.map((key) => component.properties?.[key] ?? "")
    ]);
  }
  return { rows, ids: new Set(components.map((component) => component.id)) };
}

function relationSheet(source: CatalogSource, filter: RelationFilter, endpointIds?: Set<string>): Table {
  const typeNames = new Map(source.connectionTypes.map((type) => [type.id, type.name]));
  const components = new Map(source.components.map((component) => [component.id, component]));
  const reference = (id: string): string => components.get(id)?.externalId || id;
  const rows: Table = [[...RELATION_HEADERS]];
  for (const connection of filterRelations(source, filter)) {
    if (endpointIds && (!endpointIds.has(connection.sourceComponentId) || !endpointIds.has(connection.targetComponentId))) continue;
    rows.push([
      connection.id,
      connection.externalId ?? "",
      typeNames.get(connection.connectionTypeId) ?? connection.connectionTypeId,
      reference(connection.sourceComponentId),
      reference(connection.targetComponentId),
      connection.name,
      connection.description,
      components.get(connection.sourceComponentId)?.name ?? "",
      components.get(connection.targetComponentId)?.name ?? ""
    ]);
  }
  return rows;
}

const widthsFor = (rows: Table): number[] =>
  (rows[0] ?? []).map((header, column) => {
    const longest = rows.slice(0, 200).reduce((max, row) => Math.max(max, (row[column] ?? "").length), header.length);
    return Math.min(Math.max(longest + 2, 12), 60);
  });

/** Builds the sheets for an export of the whole model or of the current catalog selection. */
export function buildExportSheets(source: ExportSource, options: ExportOptions = {}): NamedSheet[] {
  const sheets: NamedSheet[] = [];
  if (options.sheet !== "relations") {
    const { rows, ids } = elementSheet(source, options.elementFilter ?? {});
    sheets.push({ name: SHEET_TITLES.elements, rows, widths: widthsFor(rows) });
    if (options.sheet === "elements") return sheets;
    // Combined export: only relations whose both endpoints are part of the exported elements.
    const relationRows = relationSheet(source, options.relationFilter ?? {}, ids);
    sheets.push({ name: SHEET_TITLES.relations, rows: relationRows, widths: widthsFor(relationRows) });
    return sheets;
  }
  const relationRows = relationSheet(source, options.relationFilter ?? {});
  return [{ name: SHEET_TITLES.relations, rows: relationRows, widths: widthsFor(relationRows) }];
}

function allowedRuleLines(source: ExportSource): Table {
  const componentTypes = new Map(source.componentTypes.map((type) => [type.id, type.name]));
  const connectionTypes = new Map(source.connectionTypes.map((type) => [type.id, type.name]));
  const lines = (source.connectionRules as ConnectionRule[])
    .filter((rule) => rule.allowed)
    .map((rule) => [
      "Erlaubte Relation",
      `${componentTypes.get(rule.sourceComponentTypeId) ?? rule.sourceComponentTypeId} – ${connectionTypes.get(rule.connectionTypeId) ?? rule.connectionTypeId} → ${componentTypes.get(rule.targetComponentTypeId) ?? rule.targetComponentTypeId}`
    ]);
  return [...new Map(lines.map((line) => [line[1], line])).values()].sort((a, b) => a[1].localeCompare(b[1], "de"));
}

/** Import template: header-only sheets for elements and relations plus an instruction sheet. */
export function buildTemplateSheets(source: ExportSource, sheet?: SheetKind): NamedSheet[] {
  const concreteTypes = source.componentTypes.filter((type) => !type.isAbstract);
  const elementHeaders = [...ELEMENT_BASE_HEADERS, ...propertyKeysForTypes(concreteTypes)];
  const sheets: NamedSheet[] = [];
  if (sheet !== "relations") {
    sheets.push({ name: SHEET_TITLES.elements, rows: [elementHeaders], widths: widthsFor([elementHeaders]) });
  }
  if (sheet !== "elements") {
    sheets.push({ name: SHEET_TITLES.relations, rows: [[...RELATION_HEADERS]], widths: widthsFor([[...RELATION_HEADERS]]) });
  }
  if (sheet) return sheets;

  const notes: Table = [
    ["Thema", "Beschreibung"],
    ["Ablauf", "Blätter „Elemente“ und „Relationen“ ausfüllen, Datei im Katalog-Bereich hochladen, Vorschau prüfen und erst dann übernehmen."],
    ["Abgleich", "Zeilen mit ID werden dieser Komponente bzw. Verbindung zugeordnet. Ohne ID wird über die Externe ID abgeglichen. Ist beides leer oder die Externe ID unbekannt, wird neu angelegt."],
    ["ID", "Nur für bestehende Einträge verwenden (siehe Export). Für Neuanlagen leer lassen. Eine unbekannte ID ist ein Fehler."],
    ["Externe ID", "Kennung aus einem Quellsystem. Pro Unternehmen eindeutig, für Elemente und Relationen getrennt. Eine leere Zelle ändert eine vorhandene Externe ID nicht."],
    ["Typ", "Name oder ID des Typs (siehe unten). Bei bestehenden Zeilen kann die Typ-Zelle leer bleiben."],
    ["Quelle / Ziel", "Verweis auf ein Element über ID, Externe ID oder eindeutigen Namen. Auch in derselben Datei neu angelegte Elemente sind möglich."],
    ["Eigenschaften", "Spalten rechts neben „Beschreibung“ entsprechen den Eigenschaften der Typen. Werte für Eigenschaften, die der Typ nicht kennt, werden ignoriert."],
    ["Spalten „(Name)“", "Nur zur Lesbarkeit im Export. Sie werden beim Import ignoriert."],
    ["CSV", "Trennzeichen „;“, „,“ oder Tab werden erkannt, Kodierung UTF-8. Pro CSV-Datei entweder Elemente oder Relationen."],
    ["Grenzen", "Maximal 5000 Datenzeilen je Blatt und 10 MB je Datei."],
    ...concreteTypes.map((type): string[] => [
      "Elementtyp",
      `${type.name}${type.layer ? ` (${type.layer})` : ""}${(type.customPropertyKeys ?? []).length > 0 ? ` – Eigenschaften: ${type.customPropertyKeys.join(", ")}` : ""}`
    ]),
    ...source.connectionTypes.map((type): string[] => ["Verbindungstyp", type.name]),
    ...allowedRuleLines(source)
  ];
  sheets.push({ name: "Hinweise", rows: notes, widths: [22, 110] });
  return sheets;
}
