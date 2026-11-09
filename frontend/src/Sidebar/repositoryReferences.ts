import type { ConfirmRequest } from "../ConfirmDialog";
import type { ComponentInstance, ConnectionInstance, Diagram, SidebarState } from "./sidebarTypes";

// REQ-02/REQ-03: diagrams only reference repository elements; these helpers keep that view consistent.

/** Same normalization as the backend: case-insensitive and ignores all whitespace. */
export function normalizeComponentName(name: string): string {
  return name.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase("de-DE");
}

/** Metamodel types (component and connection types) must have distinct names within the metamodel. */
export function findDuplicatesByName<T extends { id: string; name: string }>(items: T[], name: string, excludeId?: string): T[] {
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

/**
 * Same name but another component type. Not a duplicate by the REQ-02 rule, but relevant for a fresh
 * element: quick creation in the sidebar assigns the first type before the user picks the real one.
 */
export function findSameNameInOtherTypes(
  components: ComponentInstance[],
  candidate: Pick<ComponentInstance, "name" | "componentTypeId">,
  excludeId?: string
): ComponentInstance[] {
  return findDuplicatesByName(components, candidate.name, excludeId)
    .filter((component) => component.componentTypeId !== candidate.componentTypeId);
}

/** "Neuer Typ", "Neuer Typ 2", ... so that quick creation does not trigger duplicate warnings. */
export function uniqueName(items: Array<{ id: string; name: string }>, base: string): string {
  let name = base;
  for (let index = 2; findDuplicatesByName(items, name).length > 0; index++) {
    name = `${base} ${index}`;
  }
  return name;
}

export function uniqueComponentName(components: ComponentInstance[], base: string, componentTypeId: string): string {
  return uniqueName(components.filter((component) => component.componentTypeId === componentTypeId), base);
}

export function diagramsUsingComponent(diagrams: Diagram[], componentId: string): Diagram[] {
  return diagrams.filter((diagram) => diagram.componentIds.includes(componentId));
}

export function diagramsUsingConnection(diagrams: Diagram[], connectionId: string): Diagram[] {
  return diagrams.filter((diagram) => diagram.connectionIds.includes(connectionId));
}

export function attachedConnections(connections: ConnectionInstance[], componentId: string): ConnectionInstance[] {
  return connections.filter((item) => item.sourceComponentId === componentId || item.targetComponentId === componentId);
}

/** Mirrors the backend cascade: attached connections and every diagram reference are removed too. */
export function removeComponentFromState(state: SidebarState, componentId: string): SidebarState {
  const removedConnectionIds = new Set(attachedConnections(state.connections, componentId).map((item) => item.id));
  return {
    ...state,
    components: state.components.filter((item) => item.id !== componentId),
    connections: state.connections.filter((item) => !removedConnectionIds.has(item.id)),
    diagrams: state.diagrams.map((diagram) => ({
      ...diagram,
      componentIds: diagram.componentIds.filter((id) => id !== componentId),
      connectionIds: diagram.connectionIds.filter((id) => !removedConnectionIds.has(id)),
      positions: Object.fromEntries(Object.entries(diagram.positions).filter(([id]) => id !== componentId))
    }))
  };
}

export function removeConnectionFromState(state: SidebarState, connectionId: string): SidebarState {
  return {
    ...state,
    connections: state.connections.filter((item) => item.id !== connectionId),
    diagrams: state.diagrams.map((diagram) => ({
      ...diagram,
      connectionIds: diagram.connectionIds.filter((id) => id !== connectionId)
    }))
  };
}

function usageLabel(count: number): string {
  return `Noch verwendet in ${count} Diagramm${count === 1 ? "" : "en"}. Sie verschwindet dort ebenfalls:`;
}

export function deleteComponentConfirmation(
  component: ComponentInstance,
  diagrams: Diagram[],
  connections: ConnectionInstance[]
): ConfirmRequest {
  const usedIn = diagramsUsingComponent(diagrams, component.id);
  const connectionCount = attachedConnections(connections, component.id).length;
  const notes: string[] = [];
  if (connectionCount > 0) {
    notes.push(`${connectionCount} zugehörige Verbindung${connectionCount === 1 ? " wird" : "en werden"} mit gelöscht.`);
  }
  notes.push("Nur aus einem Diagramm entfernen: Rechtsklick im Diagramm → „Aus Diagramm entfernen“.");
  return {
    title: "Aus Repository löschen?",
    message: `Die Komponente „${component.name}“ wird endgültig aus dem Repository gelöscht.`,
    items: usedIn.map((diagram) => diagram.name),
    itemsLabel: usedIn.length > 0 ? usageLabel(usedIn.length) : undefined,
    notes,
    confirmLabel: "Endgültig löschen",
    tone: "danger"
  };
}

export function deleteConnectionConfirmation(label: string, connectionId: string, diagrams: Diagram[]): ConfirmRequest {
  const usedIn = diagramsUsingConnection(diagrams, connectionId);
  return {
    title: "Aus Repository löschen?",
    message: `Die Verbindung „${label}“ wird endgültig aus dem Repository gelöscht.`,
    items: usedIn.map((diagram) => diagram.name),
    itemsLabel: usedIn.length > 0 ? usageLabel(usedIn.length) : undefined,
    confirmLabel: "Endgültig löschen",
    tone: "danger"
  };
}

/** Plain deletions (types, rules, viewpoints, diagrams) in the same popup style. */
export function simpleDeleteConfirmation(subject: string, name: string, consequence?: string): ConfirmRequest {
  return {
    title: `${subject} löschen?`,
    message: `${subject} „${name}“ wird gelöscht.`,
    notes: consequence ? [consequence] : undefined,
    confirmLabel: "Löschen",
    tone: "danger"
  };
}
