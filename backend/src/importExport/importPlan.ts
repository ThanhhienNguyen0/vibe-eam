import { randomUUID } from "node:crypto";
import { validateConnectionInstance } from "../Sidebar/metamodelRules.js";
import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  SidebarState
} from "../Sidebar/sidebarTypes.js";
import { normalizeHeader, type ParsedImportFile, type SheetKind, type Table } from "./tabular.js";

export type RowStatus = "new" | "changed" | "unchanged" | "error";

export interface FieldChange {
  field: string;
  from: string;
  to: string;
}

export interface PlannedRow {
  sheet: SheetKind;
  /** Row number as shown in Excel (header = 1). */
  row: number;
  status: RowStatus;
  /** Component or connection id when the row matches an existing entry. */
  id?: string;
  label: string;
  changes: FieldChange[];
  errors: string[];
  warnings: string[];
}

export interface SheetSummary {
  new: number;
  changed: number;
  unchanged: number;
  error: number;
}

export interface ImportPlan {
  rows: PlannedRow[];
  summary: Record<SheetKind, SheetSummary>;
  /** Problems that affect a whole sheet (missing columns, duplicate headers). */
  fileErrors: string[];
  fileWarnings: string[];
  /** State after applying every row that is not an error. Never sent to clients. */
  nextState: SidebarState;
  /** True when at least one row would create or change data. */
  hasChanges: boolean;
}

export interface PlanOptions {
  newId?: () => string;
}

const MAX_NAME_LENGTH = 200;
const MAX_EXTERNAL_ID_LENGTH = 200;

const COLUMN_ALIASES = {
  id: ["id"],
  externalId: ["externeid", "externalid", "extid"],
  name: ["name", "bezeichnung"],
  description: ["beschreibung", "description"]
} as const;

const ELEMENT_ALIASES = {
  ...COLUMN_ALIASES,
  type: ["typ", "type", "elementtyp", "komponententyp"]
} as const;

const RELATION_ALIASES = {
  ...COLUMN_ALIASES,
  type: ["typ", "type", "verbindungstyp", "relationstyp"],
  source: ["quelle", "source", "von", "from"],
  target: ["ziel", "target", "nach", "to"]
} as const;

/** Informational export columns that are accepted but never read. */
const INFORMATIONAL_COLUMNS = new Set(["quellename", "zielname", "sourcename", "targetname"]);

type ColumnMap<Field extends string> = {
  index: Partial<Record<Field, number>>;
  extras: Array<{ header: string; column: number }>;
  errors: string[];
};

function mapColumns<Field extends string>(header: string[], aliases: Record<Field, readonly string[]>): ColumnMap<Field> {
  const index: Partial<Record<Field, number>> = {};
  const extras: Array<{ header: string; column: number }> = [];
  const errors: string[] = [];
  header.forEach((rawHeader, column) => {
    const normalized = normalizeHeader(rawHeader);
    if (!normalized) return;
    const field = (Object.keys(aliases) as Field[]).find((candidate) => aliases[candidate].includes(normalized));
    if (field) {
      if (index[field] !== undefined) {
        errors.push(`Die Spalte „${rawHeader}“ kommt mehrfach vor.`);
      } else {
        index[field] = column;
      }
    } else if (!INFORMATIONAL_COLUMNS.has(normalized)) {
      extras.push({ header: rawHeader, column });
    }
  });
  return { index, extras, errors };
}

const cellAt = (row: string[], column: number | undefined): string => (column === undefined ? "" : (row[column] ?? "").trim());
const isEmptyRow = (row: string[]): boolean => row.every((cell) => cell.trim() === "");
const lower = (value: string): string => value.toLocaleLowerCase("de");

function emptySummary(): SheetSummary {
  return { new: 0, changed: 0, unchanged: 0, error: 0 };
}

function resolveByIdOrName<T extends { id: string; name: string }>(
  reference: string,
  items: T[],
  kind: string
): { item?: T; error?: string } {
  const byId = items.find((item) => item.id === reference);
  if (byId) return { item: byId };
  const matches = items.filter((item) => lower(item.name) === lower(reference));
  if (matches.length === 1) return { item: matches[0] };
  if (matches.length > 1) return { error: `${kind} „${reference}“ ist mehrdeutig. Bitte die ID verwenden.` };
  return { error: `${kind} „${reference}“ ist unbekannt.` };
}

interface ElementPhase {
  rows: PlannedRow[];
  components: ComponentInstance[];
  fileErrors: string[];
  fileWarnings: string[];
}

function planElements(state: SidebarState, table: Table, newId: () => string): ElementPhase {
  const result: ElementPhase = { rows: [], components: state.components.map((item) => ({ ...item })), fileErrors: [], fileWarnings: [] };
  const columns = mapColumns(table[0] ?? [], ELEMENT_ALIASES);
  result.fileErrors.push(...columns.errors.map((message) => `Blatt „Elemente“: ${message}`));
  for (const required of ["type", "name"] as const) {
    if (columns.index[required] === undefined) {
      result.fileErrors.push(`Blatt „Elemente“: Die Spalte „${required === "type" ? "Typ" : "Name"}“ fehlt.`);
    }
  }
  if (result.fileErrors.length > 0) return result;

  const typesById = new Map(state.componentTypes.map((type) => [type.id, type]));
  const propertyKeys = new Map<string, string>();
  for (const type of state.componentTypes) {
    for (const key of type.customPropertyKeys ?? []) propertyKeys.set(normalizeHeader(key), key);
  }
  const propertyColumns: Array<{ key: string; column: number }> = [];
  for (const extra of columns.extras) {
    const key = propertyKeys.get(normalizeHeader(extra.header));
    if (key) {
      propertyColumns.push({ key, column: extra.column });
    } else {
      result.fileWarnings.push(`Blatt „Elemente“: Spalte „${extra.header}“ ist unbekannt und wird ignoriert.`);
    }
  }

  const existingById = new Map(state.components.map((item) => [item.id, item]));
  const existingByExternalId = new Map(state.components.filter((item) => item.externalId).map((item) => [item.externalId as string, item]));
  const seenMatched = new Map<string, number>();
  const seenExternal = new Map<string, number>();
  const working = new Map(result.components.map((item) => [item.id, item]));
  const created: ComponentInstance[] = [];
  const index = columns.index;

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const raw = table[rowIndex];
    if (isEmptyRow(raw)) continue;
    const excelRow = rowIndex + 1;
    const id = cellAt(raw, index.id);
    const externalId = cellAt(raw, index.externalId);
    const typeRaw = cellAt(raw, index.type);
    const name = cellAt(raw, index.name);
    const description = cellAt(raw, index.description);
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. Matching: ID, then external ID, otherwise create.
    let existing: ComponentInstance | undefined;
    if (id) {
      existing = existingById.get(id);
      if (!existing) errors.push(`Die ID „${id}“ ist unbekannt. Für Neuanlagen die ID leer lassen.`);
    } else if (externalId) {
      existing = existingByExternalId.get(externalId);
    }
    if (existing && id && externalId) {
      const owner = existingByExternalId.get(externalId);
      if (owner && owner.id !== existing.id) errors.push(`Die Externe ID „${externalId}“ gehört zu einem anderen Element.`);
    }
    if (existing) {
      const firstRow = seenMatched.get(existing.id);
      if (firstRow) errors.push(`Dieses Element steht bereits in Zeile ${firstRow}.`);
      else seenMatched.set(existing.id, excelRow);
    }
    if (externalId) {
      const firstRow = seenExternal.get(externalId);
      if (firstRow && !(existing && seenMatched.get(existing.id) === firstRow)) {
        errors.push(`Die Externe ID „${externalId}“ steht bereits in Zeile ${firstRow}.`);
      } else if (!firstRow) {
        seenExternal.set(externalId, excelRow);
      }
    }

    // 2. Type.
    let type: ComponentType | undefined;
    if (typeRaw) {
      const resolved = resolveByIdOrName(typeRaw, state.componentTypes, "Der Typ");
      type = resolved.item;
      if (resolved.error) errors.push(resolved.error);
      else if (type?.isAbstract) errors.push(`Der Typ „${type.name}“ ist abstrakt und kann nicht verwendet werden.`);
    } else if (existing) {
      type = typesById.get(existing.componentTypeId);
    } else if (!id) {
      errors.push("Der Typ fehlt.");
    }

    // 3. Plain fields.
    if (!name) errors.push("Der Name fehlt.");
    if (name.length > MAX_NAME_LENGTH) errors.push(`Der Name ist länger als ${MAX_NAME_LENGTH} Zeichen.`);
    if (externalId.length > MAX_EXTERNAL_ID_LENGTH) errors.push(`Die Externe ID ist länger als ${MAX_EXTERNAL_ID_LENGTH} Zeichen.`);

    // 4. Properties valid for the resolved type.
    const desiredProperties = new Map<string, string>();
    for (const { key, column } of propertyColumns) {
      const value = cellAt(raw, column);
      if (type && !(type.customPropertyKeys ?? []).includes(key)) {
        if (value) warnings.push(`Die Eigenschaft „${key}“ gehört nicht zum Typ „${type.name}“ und wird ignoriert.`);
        continue;
      }
      desiredProperties.set(key, value);
    }

    const label = name || `Zeile ${excelRow}`;
    if (errors.length > 0 || !type) {
      result.rows.push({ sheet: "elements", row: excelRow, status: "error", id: existing?.id, label, changes: [], errors, warnings });
      continue;
    }

    if (!existing) {
      const component: ComponentInstance = {
        id: newId(),
        name,
        componentTypeId: type.id,
        description,
        properties: Object.fromEntries([...desiredProperties].filter(([, value]) => value !== "")),
        ...(externalId ? { externalId } : {})
      };
      const duplicate = [...working.values(), ...created].some((other) =>
        other.componentTypeId === type.id && lower(other.name) === lower(name));
      if (duplicate) warnings.push("Es gibt bereits ein Element mit gleichem Namen und Typ. Es wird trotzdem neu angelegt.");
      created.push(component);
      result.rows.push({ sheet: "elements", row: excelRow, status: "new", id: component.id, label, changes: [], errors, warnings });
      continue;
    }

    const changes: FieldChange[] = [];
    const next: ComponentInstance = { ...existing, properties: { ...existing.properties } };
    if (next.name !== name) {
      changes.push({ field: "Name", from: next.name, to: name });
      next.name = name;
    }
    if (next.componentTypeId !== type.id) {
      const previous = typesById.get(next.componentTypeId)?.name ?? next.componentTypeId;
      changes.push({ field: "Typ", from: previous, to: type.name });
      warnings.push("Der Typ ändert sich. Bestehende Verbindungen dieses Elements werden dabei nicht erneut geprüft.");
      next.componentTypeId = type.id;
    }
    if (index.description !== undefined && next.description !== description) {
      changes.push({ field: "Beschreibung", from: next.description, to: description });
      next.description = description;
    }
    if (externalId && next.externalId !== externalId) {
      changes.push({ field: "Externe ID", from: next.externalId ?? "", to: externalId });
      next.externalId = externalId;
    }
    for (const [key, value] of desiredProperties) {
      const previous = next.properties[key] ?? "";
      if (previous === value) continue;
      changes.push({ field: key, from: previous, to: value });
      if (value === "") delete next.properties[key];
      else next.properties[key] = value;
    }
    if (changes.length > 0) working.set(existing.id, next);
    result.rows.push({
      sheet: "elements", row: excelRow, status: changes.length > 0 ? "changed" : "unchanged",
      id: existing.id, label, changes, errors, warnings
    });
  }

  result.components = [...working.values(), ...created];
  return result;
}

interface RelationPhase {
  rows: PlannedRow[];
  connections: ConnectionInstance[];
  fileErrors: string[];
  fileWarnings: string[];
}

function planRelations(
  state: SidebarState,
  components: ComponentInstance[],
  table: Table,
  newId: () => string
): RelationPhase {
  const result: RelationPhase = { rows: [], connections: state.connections.map((item) => ({ ...item })), fileErrors: [], fileWarnings: [] };
  const columns = mapColumns(table[0] ?? [], RELATION_ALIASES);
  result.fileErrors.push(...columns.errors.map((message) => `Blatt „Relationen“: ${message}`));
  for (const [field, title] of [["type", "Typ"], ["source", "Quelle"], ["target", "Ziel"]] as const) {
    if (columns.index[field] === undefined) result.fileErrors.push(`Blatt „Relationen“: Die Spalte „${title}“ fehlt.`);
  }
  for (const extra of columns.extras) {
    result.fileWarnings.push(`Blatt „Relationen“: Spalte „${extra.header}“ ist unbekannt und wird ignoriert.`);
  }
  if (result.fileErrors.length > 0) return result;

  const validationState: SidebarState = { ...state, components };
  const componentsById = new Map(components.map((item) => [item.id, item]));
  const componentsByExternalId = new Map(components.filter((item) => item.externalId).map((item) => [item.externalId as string, item]));
  const connectionTypes: ConnectionType[] = state.connectionTypes;
  const existingById = new Map(state.connections.map((item) => [item.id, item]));
  const existingByExternalId = new Map(state.connections.filter((item) => item.externalId).map((item) => [item.externalId as string, item]));
  const working = new Map(result.connections.map((item) => [item.id, item]));
  const created: ConnectionInstance[] = [];
  const tripleKey = (item: Pick<ConnectionInstance, "connectionTypeId" | "sourceComponentId" | "targetComponentId">) =>
    `${item.connectionTypeId}|${item.sourceComponentId}|${item.targetComponentId}`;
  const triples = new Map(state.connections.map((item) => [tripleKey(item), item.id]));
  const seenMatched = new Map<string, number>();
  const seenExternal = new Map<string, number>();
  const index = columns.index;

  const resolveComponent = (reference: string, role: string): { item?: ComponentInstance; error?: string } => {
    const byId = componentsById.get(reference) ?? componentsByExternalId.get(reference);
    if (byId) return { item: byId };
    const matches = components.filter((item) => lower(item.name) === lower(reference));
    if (matches.length === 1) return { item: matches[0] };
    if (matches.length > 1) return { error: `${role} „${reference}“ ist mehrdeutig. Bitte ID oder Externe ID verwenden.` };
    return { error: `${role} „${reference}“ wurde nicht gefunden (oder die zugehörige Elementzeile ist fehlerhaft).` };
  };

  for (let rowIndex = 1; rowIndex < table.length; rowIndex += 1) {
    const raw = table[rowIndex];
    if (isEmptyRow(raw)) continue;
    const excelRow = rowIndex + 1;
    const id = cellAt(raw, index.id);
    const externalId = cellAt(raw, index.externalId);
    const typeRaw = cellAt(raw, index.type);
    const sourceRaw = cellAt(raw, index.source);
    const targetRaw = cellAt(raw, index.target);
    const name = cellAt(raw, index.name);
    const description = cellAt(raw, index.description);
    const errors: string[] = [];
    const warnings: string[] = [];

    let existing: ConnectionInstance | undefined;
    if (id) {
      existing = existingById.get(id);
      if (!existing) errors.push(`Die ID „${id}“ ist unbekannt. Für Neuanlagen die ID leer lassen.`);
    } else if (externalId) {
      existing = existingByExternalId.get(externalId);
    }
    if (existing && id && externalId) {
      const owner = existingByExternalId.get(externalId);
      if (owner && owner.id !== existing.id) errors.push(`Die Externe ID „${externalId}“ gehört zu einer anderen Verbindung.`);
    }
    if (existing) {
      const firstRow = seenMatched.get(existing.id);
      if (firstRow) errors.push(`Diese Verbindung steht bereits in Zeile ${firstRow}.`);
      else seenMatched.set(existing.id, excelRow);
    }
    if (externalId) {
      const firstRow = seenExternal.get(externalId);
      if (firstRow && !(existing && seenMatched.get(existing.id) === firstRow)) {
        errors.push(`Die Externe ID „${externalId}“ steht bereits in Zeile ${firstRow}.`);
      } else if (!firstRow) {
        seenExternal.set(externalId, excelRow);
      }
    }
    if (externalId.length > MAX_EXTERNAL_ID_LENGTH) errors.push(`Die Externe ID ist länger als ${MAX_EXTERNAL_ID_LENGTH} Zeichen.`);

    let connectionTypeId = existing?.connectionTypeId;
    if (typeRaw) {
      const resolved = resolveByIdOrName(typeRaw, connectionTypes, "Der Verbindungstyp");
      if (resolved.error) errors.push(resolved.error);
      else connectionTypeId = resolved.item?.id;
    } else if (!existing && !id) {
      errors.push("Der Typ fehlt.");
    }

    let sourceId = existing?.sourceComponentId;
    if (sourceRaw) {
      const resolved = resolveComponent(sourceRaw, "Die Quelle");
      if (resolved.error) errors.push(resolved.error);
      else sourceId = resolved.item?.id;
    } else if (!existing) {
      errors.push("Die Quelle fehlt.");
    }
    let targetId = existing?.targetComponentId;
    if (targetRaw) {
      const resolved = resolveComponent(targetRaw, "Das Ziel");
      if (resolved.error) errors.push(resolved.error);
      else targetId = resolved.item?.id;
    } else if (!existing) {
      errors.push("Das Ziel fehlt.");
    }

    const sourceLabel = componentsById.get(sourceId ?? "")?.name ?? sourceRaw;
    const targetLabel = componentsById.get(targetId ?? "")?.name ?? targetRaw;
    const label = `${sourceLabel || "?"} → ${targetLabel || "?"}`;

    if (errors.length === 0 && connectionTypeId && sourceId && targetId) {
      const candidate: ConnectionInstance = {
        ...(existing ?? { properties: {} }),
        id: existing?.id ?? newId(),
        connectionTypeId,
        sourceComponentId: sourceId,
        targetComponentId: targetId,
        name: index.name !== undefined || !existing ? name : existing.name,
        description: index.description !== undefined || !existing ? description : existing.description,
        ...(externalId ? { externalId } : existing?.externalId ? { externalId: existing.externalId } : {})
      };
      const duplicateOf = triples.get(tripleKey(candidate));
      if (duplicateOf && duplicateOf !== candidate.id) {
        errors.push(existing
          ? "Eine identische Verbindung (gleicher Typ, gleiche Quelle und gleiches Ziel) existiert bereits."
          : `Eine identische Verbindung existiert bereits (ID ${duplicateOf}). Mit dieser ID kann sie aktualisiert werden.`);
      }
      const validation = validateConnectionInstance(candidate, validationState);
      errors.push(...validation.errors.map((item) => item.message));
      warnings.push(...validation.warnings.map((item) => item.message));

      if (errors.length === 0) {
        if (!existing) {
          triples.set(tripleKey(candidate), candidate.id);
          created.push(candidate);
          result.rows.push({ sheet: "relations", row: excelRow, status: "new", id: candidate.id, label, changes: [], errors, warnings });
          continue;
        }
        const typeName = (typeId: string) => connectionTypes.find((type) => type.id === typeId)?.name ?? typeId;
        const componentName = (componentId: string) => componentsById.get(componentId)?.name ?? componentId;
        const changes: FieldChange[] = [];
        if (existing.connectionTypeId !== candidate.connectionTypeId) changes.push({ field: "Typ", from: typeName(existing.connectionTypeId), to: typeName(candidate.connectionTypeId) });
        if (existing.sourceComponentId !== candidate.sourceComponentId) changes.push({ field: "Quelle", from: componentName(existing.sourceComponentId), to: componentName(candidate.sourceComponentId) });
        if (existing.targetComponentId !== candidate.targetComponentId) changes.push({ field: "Ziel", from: componentName(existing.targetComponentId), to: componentName(candidate.targetComponentId) });
        if (existing.name !== candidate.name) changes.push({ field: "Name", from: existing.name, to: candidate.name });
        if (existing.description !== candidate.description) changes.push({ field: "Beschreibung", from: existing.description, to: candidate.description });
        if ((existing.externalId ?? "") !== (candidate.externalId ?? "")) changes.push({ field: "Externe ID", from: existing.externalId ?? "", to: candidate.externalId ?? "" });
        if (changes.length > 0) {
          triples.delete(tripleKey(existing));
          triples.set(tripleKey(candidate), candidate.id);
          working.set(existing.id, candidate);
        }
        result.rows.push({
          sheet: "relations", row: excelRow, status: changes.length > 0 ? "changed" : "unchanged",
          id: existing.id, label, changes, errors, warnings
        });
        continue;
      }
    }
    result.rows.push({ sheet: "relations", row: excelRow, status: "error", id: existing?.id, label, changes: [], errors, warnings });
  }

  result.connections = [...working.values(), ...created];
  return result;
}

/**
 * Pure dry-run: compares the uploaded tables with the current state and reports, per row,
 * whether it would be created, changed, left alone or rejected. Nothing is written here.
 */
export function planImport(state: SidebarState, file: ParsedImportFile, options: PlanOptions = {}): ImportPlan {
  const newId = options.newId ?? randomUUID;
  const rows: PlannedRow[] = [];
  const fileErrors: string[] = [];
  const fileWarnings: string[] = [];
  let components = state.components;
  let connections = state.connections;

  if (file.elements) {
    const phase = planElements(state, file.elements, newId);
    rows.push(...phase.rows);
    fileErrors.push(...phase.fileErrors);
    fileWarnings.push(...phase.fileWarnings);
    if (phase.fileErrors.length === 0) components = phase.components;
  }
  if (file.relations) {
    const phase = planRelations(state, components, file.relations, newId);
    rows.push(...phase.rows);
    fileErrors.push(...phase.fileErrors);
    fileWarnings.push(...phase.fileWarnings);
    if (phase.fileErrors.length === 0) connections = phase.connections;
  }

  const summary: Record<SheetKind, SheetSummary> = { elements: emptySummary(), relations: emptySummary() };
  for (const row of rows) summary[row.sheet][row.status] += 1;
  const hasChanges = rows.some((row) => row.status === "new" || row.status === "changed");
  return { rows, summary, fileErrors, fileWarnings, nextState: { ...state, components, connections }, hasChanges };
}

export function countErrors(plan: ImportPlan): number {
  return plan.summary.elements.error + plan.summary.relations.error + plan.fileErrors.length;
}
