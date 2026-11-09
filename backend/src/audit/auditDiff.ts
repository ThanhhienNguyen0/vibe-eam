import { isDeepStrictEqual } from "node:util";
import type { SidebarState } from "../Sidebar/sidebarTypes.js";
import type { AuditFieldChange, AuditJsonValue, AuditMutationInput } from "./auditTypes.js";

const SECRET_KEY = /(password|passwd|token|secret|authorization|credential|private.?key|api.?key)/i;
const MAX_DEPTH = 6;
const MAX_KEYS = 100;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING = 2_000;
const MAX_CHANGES = 200;

function sanitized(value: unknown, key = "", depth = 0): AuditJsonValue {
  if (SECRET_KEY.test(key)) return "[REDACTED]";
  if (value === undefined || value === null) return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}…[truncated]` : value;
  if (depth >= MAX_DEPTH) return "[depth-limit]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitized(item, key, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    const limited = entries.slice(0, MAX_KEYS);
    const result: Record<string, AuditJsonValue> = Object.fromEntries(
      limited.map(([childKey, child]) => [childKey, sanitized(child, childKey, depth + 1)])
    );
    if (entries.length > MAX_KEYS) result.__truncated__ = `${entries.length - MAX_KEYS} more fields`;
    return result;
  }
  return String(value);
}

function flatten(value: AuditJsonValue, prefix = "", target = new Map<string, AuditJsonValue>()): Map<string, AuditJsonValue> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0 && prefix) target.set(prefix, {});
    for (const [key, child] of entries) flatten(child, prefix ? `${prefix}.${key}` : key, target);
    return target;
  }
  if (prefix) target.set(prefix, value);
  return target;
}

export function fieldChanges(before: unknown, after: unknown): { changes: AuditFieldChange[]; truncated: boolean } {
  const left = flatten(sanitized(before));
  const right = flatten(sanitized(after));
  const fields = [...new Set([...left.keys(), ...right.keys()])].sort();
  const changes: AuditFieldChange[] = [];
  for (const field of fields) {
    const previous = left.get(field) ?? null;
    const next = right.get(field) ?? null;
    if (!isDeepStrictEqual(previous, next)) changes.push({ field, before: previous, after: next });
    if (changes.length === MAX_CHANGES) return { changes, truncated: fields.length > MAX_CHANGES };
  }
  return { changes, truncated: false };
}

type AuditedEntity = { id: string; value: Record<string, unknown> };

function withoutTechnicalFields(value: Record<string, unknown>, keepDomainVersion = false): Record<string, unknown> {
  const technical = new Set(["dataRevision", "createdAt", "updatedAt"]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !technical.has(key) && (keepDomainVersion || key !== "version")));
}

function entities(state: SidebarState): Array<{ type: string; label: string; items: AuditedEntity[] }> {
  const collection = (type: string, label: string, values: Array<Record<string, unknown> & { id: string }>, keepDomainVersion = false) => ({
    type,
    label,
    items: values.map((value) => ({ id: value.id, value: withoutTechnicalFields(value, keepDomainVersion) }))
  });
  return [
    collection("metamodel", "Metamodell", [state.metamodel as unknown as Record<string, unknown> & { id: string }], true),
    collection("component-type", "Komponententyp", state.componentTypes as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("connection-type", "Verbindungstyp", state.connectionTypes as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("connection-rule", "Verbindungsregel", state.connectionRules as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("viewpoint", "Viewpoint", state.viewpoints as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("viewpoint-rule", "Viewpoint-Regel", state.viewpointRules as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("validation-rule", "Validierungsregel", state.validationRules as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("component", "Komponente", state.components as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("connection", "Verbindung", state.connections as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("diagram", "Diagramm", state.diagrams as unknown as Array<Record<string, unknown> & { id: string }>),
    collection("catalog", "Katalog", state.catalogs as unknown as Array<Record<string, unknown> & { id: string }>)
  ];
}

export function diffSidebarStates(before: SidebarState | null, after: SidebarState): AuditMutationInput[] {
  const prior = new Map((before ? entities(before) : []).map((group) => [group.type, group]));
  const result: AuditMutationInput[] = [];
  for (const group of entities(after)) {
    const oldItems = new Map((prior.get(group.type)?.items ?? []).map((item) => [item.id, item.value]));
    const newItems = new Map(group.items.map((item) => [item.id, item.value]));
    const ids = [...new Set([...oldItems.keys(), ...newItems.keys()])].sort();
    for (const id of ids) {
      const oldValue = oldItems.get(id);
      const newValue = newItems.get(id);
      const action = oldValue === undefined ? "create" : newValue === undefined ? "delete" : "update";
      const { changes, truncated } = fieldChanges(oldValue ?? {}, newValue ?? {});
      if (changes.length === 0) continue;
      result.push({
        action,
        entityType: group.type,
        entityId: id,
        summary: `${group.label} ${action === "create" ? "erstellt" : action === "delete" ? "gelöscht" : "geändert"}.`,
        changes,
        ...(truncated ? { details: { changesTruncated: true } } : {})
      });
    }
  }
  return result;
}

export function auditMutation(
  entityType: string,
  entityId: string,
  label: string,
  before: unknown,
  after: unknown
): AuditMutationInput | null {
  const { changes, truncated } = fieldChanges(before ?? {}, after ?? {});
  if (changes.length === 0) return null;
  const action = before === null || before === undefined ? "create" : after === null || after === undefined ? "delete" : "update";
  return {
    action,
    entityType,
    entityId,
    summary: `${label} ${action === "create" ? "erstellt" : action === "delete" ? "gelöscht" : "geändert"}.`,
    changes,
    ...(truncated ? { details: { changesTruncated: true } } : {})
  };
}
