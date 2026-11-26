import type { ConfirmRequest } from "./ConfirmDialog";
import type { ComponentInstance, ConnectionInstance, ConnectionType, Diagram, DiagramPosition } from "./Sidebar/sidebarTypes";

/**
 * #119/#123: The editor owns the canvas selection. React Flow only reports clicks, Shift-box and
 * multi-select as changes; the editor writes `selected` back onto every node/edge it builds. So the
 * selection survives re-renders (hover, saving) and nothing can stay selected without being shown.
 */
export interface DiagramSelection {
  nodeIds: string[];
  edgeIds: string[];
}

export const EMPTY_SELECTION: DiagramSelection = { nodeIds: [], edgeIds: [] };

export interface SelectChange {
  id: string;
  selected: boolean;
}

export interface VisibleElementIds {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
}

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index]);
}

export function isSelectionEmpty(selection: DiagramSelection): boolean {
  return selection.nodeIds.length === 0 && selection.edgeIds.length === 0;
}

export function selectionContains(selection: DiagramSelection, id: string): boolean {
  return selection.nodeIds.includes(id) || selection.edgeIds.includes(id);
}

/** Applies React Flow's `select` changes. Returns the same object if nothing changed (no re-render). */
export function applySelectChanges(
  selection: DiagramSelection,
  kind: "node" | "edge",
  changes: readonly SelectChange[]
): DiagramSelection {
  const key = kind === "node" ? "nodeIds" : "edgeIds";
  const next = [...selection[key]];
  for (const change of changes) {
    const index = next.indexOf(change.id);
    if (change.selected && index === -1) next.push(change.id);
    if (!change.selected && index !== -1) next.splice(index, 1);
  }
  return sameIds(next, selection[key]) ? selection : { ...selection, [key]: next };
}

/**
 * The elements that are actually drawn: components that exist, and connections whose two ends are drawn.
 * Same rules as the editor's node/edge building, so a filtered-out element never counts as selected.
 */
export function visibleElementIds(
  diagram: Pick<Diagram, "componentIds" | "connectionIds">,
  components: readonly Pick<ComponentInstance, "id">[],
  connections: readonly Pick<ConnectionInstance, "id" | "sourceComponentId" | "targetComponentId">[]
): VisibleElementIds {
  const componentIds = new Set(components.map((component) => component.id));
  const nodeIds = new Set(diagram.componentIds.filter((id) => componentIds.has(id)));
  const edgeIds = new Set(diagram.connectionIds.filter((id) => {
    const connection = connections.find((item) => item.id === id);
    return !!connection && nodeIds.has(connection.sourceComponentId) && nodeIds.has(connection.targetComponentId);
  }));
  return { nodeIds, edgeIds };
}

/** Drops everything that is no longer visible (removed, hidden by a view filter, deleted elsewhere). */
export function pruneSelection(selection: DiagramSelection, visible: VisibleElementIds): DiagramSelection {
  const nodeIds = selection.nodeIds.filter((id) => visible.nodeIds.has(id));
  const edgeIds = selection.edgeIds.filter((id) => visible.edgeIds.has(id));
  return nodeIds.length === selection.nodeIds.length && edgeIds.length === selection.edgeIds.length
    ? selection
    : { nodeIds, edgeIds };
}

/**
 * Mirrors the element opened in the detail panel onto the canvas. Keeps a multi-selection that already
 * contains it; clears the canvas when the panel shows something that is not drawn in this diagram.
 */
export function selectionForPanelElement(
  selection: DiagramSelection,
  elementId: string | null | undefined,
  visible: VisibleElementIds
): DiagramSelection {
  if (!elementId) return isSelectionEmpty(selection) ? selection : EMPTY_SELECTION;
  if (selectionContains(selection, elementId)) return selection;
  if (visible.nodeIds.has(elementId)) return { nodeIds: [elementId], edgeIds: [] };
  if (visible.edgeIds.has(elementId)) return { nodeIds: [], edgeIds: [elementId] };
  return isSelectionEmpty(selection) ? selection : EMPTY_SELECTION;
}

/** Keyboard shortcuts must not fire while the user types into a field. */
export function isTextEntryTarget(target: unknown): boolean {
  if (!target || typeof target !== "object") return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  if (element.isContentEditable === true) return true;
  const tag = typeof element.tagName === "string" ? element.tagName.toUpperCase() : "";
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function isDeleteKey(key: string): boolean {
  return key === "Delete" || key === "Backspace";
}

export interface ShortcutContext {
  /** Focus is on the canvas/editor (or nowhere), not in the sidebar, detail panel or a dialog. */
  inEditor: boolean;
  /** A dialog of the editor (smart add, create, export) or the removal question is open. */
  blocked: boolean;
  canWrite: boolean;
  connecting: boolean;
  selection: DiagramSelection;
  visible: VisibleElementIds;
}

export type ShortcutAction = "remove" | "clear" | null;

/**
 * #119: What a key press does on the diagram. Delete/Backspace only ever removes the *visible* selection
 * and only while the focus is on the diagram – a stale or hidden selection can never be hit.
 */
export function diagramShortcut(
  event: { key: string; target: unknown; defaultPrevented?: boolean },
  context: ShortcutContext
): ShortcutAction {
  if (event.defaultPrevented || context.blocked || !context.inEditor || isTextEntryTarget(event.target)) return null;
  if (event.key === "Escape") return context.connecting || isSelectionEmpty(context.selection) ? null : "clear";
  if (!isDeleteKey(event.key) || !context.canWrite) return null;
  return isSelectionEmpty(pruneSelection(context.selection, context.visible)) ? null : "remove";
}

export interface DiagramRemoval {
  componentIds: string[];
  connectionIds: string[];
  positions: Record<string, DiagramPosition>;
  /** Connections that leave the diagram only because one of their ends is removed. */
  attachedConnectionIds: string[];
}

/** Diagram patch for "remove from diagram": components, the given connections and connections attached to removed components. */
export function diagramRemoval(
  diagram: Pick<Diagram, "componentIds" | "connectionIds" | "positions">,
  connections: readonly Pick<ConnectionInstance, "id" | "sourceComponentId" | "targetComponentId">[],
  nodeIds: readonly string[],
  edgeIds: readonly string[]
): DiagramRemoval {
  const removedNodes = new Set(nodeIds);
  const removedEdges = new Set(edgeIds);
  const attachedConnectionIds: string[] = [];
  const connectionIds = diagram.connectionIds.filter((id) => {
    if (removedEdges.has(id)) return false;
    const connection = connections.find((item) => item.id === id);
    if (connection && (removedNodes.has(connection.sourceComponentId) || removedNodes.has(connection.targetComponentId))) {
      attachedConnectionIds.push(id);
      return false;
    }
    return true;
  });
  return {
    componentIds: diagram.componentIds.filter((id) => !removedNodes.has(id)),
    connectionIds,
    positions: Object.fromEntries(Object.entries(diagram.positions).filter(([id]) => !removedNodes.has(id))),
    attachedConnectionIds
  };
}

interface LabelContext {
  components: readonly Pick<ComponentInstance, "id" | "name">[];
  connections: readonly ConnectionInstance[];
  connectionTypes: readonly Pick<ConnectionType, "id" | "name">[];
}

export function componentLabel(id: string, { components }: Pick<LabelContext, "components">): string {
  return components.find((component) => component.id === id)?.name ?? "Unbenannte Komponente";
}

/** "„Nutzt“: CRM → ERP" – a connection is only recognisable together with its ends. */
export function connectionLabel(id: string, context: LabelContext): string {
  const connection = context.connections.find((item) => item.id === id);
  if (!connection) return "Verbindung";
  const typeName = context.connectionTypes.find((type) => type.id === connection.connectionTypeId)?.name;
  const name = connection.name || typeName || "Verbindung";
  return `„${name}“: ${componentLabel(connection.sourceComponentId, context)} → ${componentLabel(connection.targetComponentId, context)}`;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Text of the selection bar on the canvas. */
export function selectionLabel(selection: DiagramSelection, context: LabelContext): string {
  const { nodeIds, edgeIds } = selection;
  if (nodeIds.length === 1 && edgeIds.length === 0) return `Komponente „${componentLabel(nodeIds[0], context)}“`;
  if (nodeIds.length === 0 && edgeIds.length === 1) return `Verbindung ${connectionLabel(edgeIds[0], context)}`;
  const parts = [
    nodeIds.length > 0 ? countLabel(nodeIds.length, "Komponente", "Komponenten") : "",
    edgeIds.length > 0 ? countLabel(edgeIds.length, "Verbindung", "Verbindungen") : ""
  ].filter(Boolean);
  return parts.join(" und ");
}

/** Safety question before removing the selection from the diagram (keyboard and selection bar). */
export function removalConfirmation(
  selection: DiagramSelection,
  attachedConnectionCount: number,
  context: LabelContext
): ConfirmRequest {
  const { nodeIds, edgeIds } = selection;
  const total = nodeIds.length + edgeIds.length;
  const onlyEdges = nodeIds.length === 0;
  const title = total === 1
    ? onlyEdges ? "Verbindung aus dem Diagramm entfernen?" : `„${componentLabel(nodeIds[0], context)}“ aus dem Diagramm entfernen?`
    : `${total} Elemente aus dem Diagramm entfernen?`;
  const notes = attachedConnectionCount > 0
    ? [`Zusätzlich verschwinden ${countLabel(attachedConnectionCount, "angeschlossene Verbindung", "angeschlossene Verbindungen")} aus dem Diagramm.`]
    : [];
  return {
    title,
    message: total === 1
      ? `Nur dieses Diagramm ändert sich. ${onlyEdges ? "Die Verbindung" : "Die Komponente"} bleibt im Repository und in anderen Diagrammen erhalten.`
      : "Nur dieses Diagramm ändert sich. Die Elemente bleiben im Repository und in anderen Diagrammen erhalten.",
    items: [
      ...nodeIds.map((id) => `Komponente „${componentLabel(id, context)}“`),
      ...edgeIds.map((id) => `Verbindung ${connectionLabel(id, context)}`)
    ],
    itemsLabel: "Betroffen:",
    notes,
    confirmLabel: "Aus Diagramm entfernen",
    tone: "default"
  };
}

export function removalNotice(nodeCount: number, edgeCount: number): string {
  if (nodeCount === 0 && edgeCount === 1) return "Verbindung aus dem Diagramm entfernt (bleibt im Modell erhalten).";
  if (nodeCount === 1 && edgeCount === 0) return "Aus dem Diagramm entfernt (bleibt im Modell erhalten).";
  return `${nodeCount + edgeCount} Elemente aus dem Diagramm entfernt (bleiben im Modell erhalten).`;
}
