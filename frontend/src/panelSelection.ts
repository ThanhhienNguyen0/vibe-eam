import type { SidebarSelection } from "./Sidebar/Sidebar";

type DiagramMembers = { id: string; componentIds: string[]; connectionIds: string[] };

/**
 * #114: Welche Auswahl das Detail-Panel nach einem Kontextwechsel behalten darf.
 * - Wechsel in ein Diagramm: nur Komponenten/Verbindungen, die dort enthalten sind, oder das Diagramm selbst.
 * - Wechsel in einen anderen Bereich (Kataloge, Metamodell, Nutzer, Protokoll, Übersicht): Panel leeren.
 */
export function selectionAfterContextChange(
  selection: SidebarSelection | null,
  next: { kind: "diagram"; diagram: DiagramMembers | null | undefined } | { kind: "area" }
): SidebarSelection | null {
  if (!selection || next.kind === "area" || !next.diagram) return null;
  const { diagram } = next;
  if (selection.kind === "component") return diagram.componentIds.includes(selection.id) ? selection : null;
  if (selection.kind === "connection") return diagram.connectionIds.includes(selection.id) ? selection : null;
  if (selection.kind === "diagram") return selection.id === diagram.id ? selection : null;
  return null;
}
