import type { AuditEntryInput } from "../audit/auditTypes.js";
import type { ComponentInstance } from "./sidebarTypes.js";

// REQ-02: duplicates are reported as warnings, never as hard errors.
export type DuplicateWarningCode = "DUPLICATE_COMPONENT" | "DUPLICATE_COMPONENT_TYPE" | "DUPLICATE_CONNECTION_TYPE";

export interface DuplicateWarning {
  code: DuplicateWarningCode;
  message: string;
  duplicates: Array<{ id: string; name: string }>;
}

interface Named {
  id: string;
  name: string;
}

/** Case-insensitive and ignores all whitespace, so "SAP ERP", " sap  erp " and "SAPERP" match. */
export function normalizeComponentName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("de-DE");
}

/** Metamodel types (component and connection types) must have distinct names within the metamodel. */
export function findDuplicatesByName<T extends Named>(items: T[], name: string, excludeId?: string): T[] {
  const key = normalizeComponentName(name);
  if (!key) return [];
  return items.filter((item) => item.id !== excludeId && normalizeComponentName(item.name) === key);
}

/** Components are only duplicates within the same component type. */
export function findDuplicateComponents(
  components: ComponentInstance[],
  candidate: Pick<ComponentInstance, "name" | "componentTypeId">,
  excludeId?: string
): ComponentInstance[] {
  return findDuplicatesByName(
    components.filter((component) => component.componentTypeId === candidate.componentTypeId),
    candidate.name,
    excludeId
  );
}

const SUBJECTS: Record<DuplicateWarningCode, string> = {
  DUPLICATE_COMPONENT: "A component with the same name and type",
  DUPLICATE_COMPONENT_TYPE: "A component type with the same name",
  DUPLICATE_CONNECTION_TYPE: "A connection type with the same name"
};

export function duplicateWarnings(code: DuplicateWarningCode, duplicates: Named[]): DuplicateWarning[] {
  if (duplicates.length === 0) return [];
  return [{
    code,
    message: `${SUBJECTS[code]} already exists: ${duplicates.map((item) => `'${item.name}'`).join(", ")}.`,
    duplicates: duplicates.map(({ id, name }) => ({ id, name }))
  }];
}

export function duplicateComponentWarnings(duplicates: ComponentInstance[]): DuplicateWarning[] {
  return duplicateWarnings("DUPLICATE_COMPONENT", duplicates);
}

export type DuplicateAuditEntityType = "component" | "component-type" | "connection-type";

const AUDIT_LABELS: Record<DuplicateAuditEntityType, string> = {
  component: "Komponente",
  "component-type": "Komponententyp",
  "connection-type": "Verbindungstyp"
};

/**
 * REQ-02 business event for the REQ-23 audit log, written in the same transaction as the change.
 * Returns undefined when there is nothing to record.
 */
export function duplicateAuditEvent(
  entityType: DuplicateAuditEntityType,
  verb: "created" | "updated",
  item: Named,
  duplicates: Named[],
  acknowledged: boolean
): AuditEntryInput | undefined {
  if (duplicates.length === 0) return undefined;
  return {
    action: "duplicate.accepted",
    entityType,
    entityId: item.id,
    summary: `${AUDIT_LABELS[entityType]} „${item.name}“ trotz Duplikatwarnung ${verb === "created" ? "erstellt" : "gespeichert"}${acknowledged ? " (Warnung bestätigt)" : ""}.`,
    details: {
      requirement: "REQ-02",
      acknowledged,
      duplicates: duplicates.map(({ id, name }) => ({ id, name }))
    }
  };
}
