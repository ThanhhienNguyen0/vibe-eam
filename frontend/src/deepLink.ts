/**
 * REQ-12 – Deep Links auf Diagramme, Elemente und gefilterte Ansichten.
 *
 * URL-Schema (Pfad-basiert; nginx und der Vite-Dev-Server liefern für jeden Pfad die App aus):
 *   /diagram/:id                     Diagramm öffnen
 *   /diagram/:id?select=:elementId   … und Element (Komponente oder Verbindung) markieren + zentrieren
 *   /diagram/:id?view=:viewpointId   … mit Ansichtsfilter (kombinierbar mit select)
 *   /diagram/:id?view=all            … ausdrücklich ohne Filter („Alle Inhalte“), auch wenn das
 *                                    Diagramm eine gespeicherte Standard-Ansicht hat
 *   /component/:id, /connection/:id  Eigenschaften eines Elements ohne Diagramm-Kontext
 *
 * Alles hier ist rein (ohne DOM) und daher direkt testbar.
 */
import { projectDiagramToViewpoint } from "./Sidebar/metamodelRules";
import type { SidebarState } from "./Sidebar/sidebarTypes";

export type DeepLink =
  | { kind: "home" }
  | { kind: "diagram"; diagramId: string; selectId?: string; viewId?: string }
  | { kind: "component"; id: string }
  | { kind: "connection"; id: string }
  | { kind: "invalid"; path: string };

/** `view`-Wert für „Alle Inhalte“ (kein Filter). */
export const ALL_VIEWS = "all";

/**
 * `view`-Parameter für den aktuellen Filter: ohne Parameter, wenn der Filter der gespeicherten
 * Standard-Ansicht des Diagramms entspricht; „all“, wenn bewusst kein Filter gesetzt ist.
 */
export function viewParam(currentFilterId: string, diagramDefaultViewId?: string): string | undefined {
  if (currentFilterId === (diagramDefaultViewId ?? "")) return undefined;
  return currentFilterId || ALL_VIEWS;
}

/** Umkehrung von `viewParam`: Filter-ID für den Editor („“ = Alle Inhalte). */
export function filterIdFromView(viewId: string | undefined, diagramDefaultViewId?: string): string {
  if (viewId === undefined) return diagramDefaultViewId ?? "";
  return viewId === ALL_VIEWS ? "" : viewId;
}

const decode = (value: string) => {
  try { return decodeURIComponent(value); } catch { return value; }
};

export function parseDeepLink(pathname: string, search = ""): DeepLink {
  const parts = pathname.split("/").filter(Boolean).map(decode);
  if (parts.length === 0) return { kind: "home" };
  const params = new URLSearchParams(search);
  const [section, id, ...rest] = parts;
  if (!id || rest.length > 0) return { kind: "invalid", path: pathname };
  if (section === "diagram") {
    const selectId = params.get("select")?.trim() || undefined;
    const viewId = params.get("view")?.trim() || undefined;
    return { kind: "diagram", diagramId: id, ...(selectId ? { selectId } : {}), ...(viewId ? { viewId } : {}) };
  }
  if (section === "component") return { kind: "component", id };
  if (section === "connection") return { kind: "connection", id };
  return { kind: "invalid", path: pathname };
}

/** Relativer Pfad inkl. Query, z. B. „/diagram/d1?view=vp2&select=c7“. */
export function buildDeepLinkPath(link: DeepLink): string {
  switch (link.kind) {
    case "diagram": {
      const params = new URLSearchParams();
      if (link.viewId) params.set("view", link.viewId);
      if (link.selectId) params.set("select", link.selectId);
      const query = params.toString();
      return `/diagram/${encodeURIComponent(link.diagramId)}${query ? `?${query}` : ""}`;
    }
    case "component":
    case "connection":
      return `/${link.kind}/${encodeURIComponent(link.id)}`;
    default:
      return "/";
  }
}

/** Vollständige, teilbare URL. */
export function absoluteLink(link: DeepLink, origin: string): string {
  return `${origin.replace(/\/$/, "")}${buildDeepLinkPath(link)}`;
}

/* ── Auflösen gegen die geladenen Daten ──────────────────────────────────────── */

export type FocusTarget = { kind: "component" | "connection"; id: string };

export interface DeepLinkResolution {
  /** Zu öffnendes Diagramm (fehlt, wenn der Link nicht auf ein Diagramm zeigt oder ungültig ist). */
  diagramId?: string;
  /** Ansichtsfilter, der beim Öffnen gesetzt wird. */
  viewId?: string;
  /** Element, das markiert, zentriert und im Eigenschaftenpanel geöffnet wird. */
  focus?: FocusTarget;
  /** Der Link ist unbrauchbar – Meldung statt leerem Bildschirm, Rückweg zur Übersicht. */
  error?: string;
  /** Der Link funktioniert, aber nicht ganz wie gedacht (z. B. Element nicht mehr im Diagramm). */
  notice?: string;
}

const NOT_FOUND_HINT = "Vielleicht wurde es gelöscht, oder der Link gehört zu einem anderen Unternehmen.";

function findElement(state: SidebarState, id: string): { target: FocusTarget; name: string } | null {
  const component = state.components.find((c) => c.id === id);
  if (component) return { target: { kind: "component", id }, name: component.name };
  const connection = state.connections.find((c) => c.id === id);
  if (connection) {
    const source = state.components.find((c) => c.id === connection.sourceComponentId)?.name ?? "?";
    const target = state.components.find((c) => c.id === connection.targetComponentId)?.name ?? "?";
    return { target: { kind: "connection", id }, name: connection.name || `${source} → ${target}` };
  }
  return null;
}

/**
 * Prüft einen Link gegen den aktuellen Datenstand. Ungültige Teile führen zu einer verständlichen
 * Meldung; was noch passt, wird trotzdem geöffnet (lieber das Diagramm ohne Markierung als gar nichts).
 */
export function resolveDeepLink(link: DeepLink, state: SidebarState): DeepLinkResolution {
  if (link.kind === "home") return {};
  if (link.kind === "invalid") {
    return { error: "Diese Adresse kennt die App nicht. Prüfe den Link oder öffne ein Diagramm aus der Übersicht." };
  }
  if (link.kind === "component" || link.kind === "connection") {
    const found = findElement(state, link.id);
    if (!found || found.target.kind !== link.kind) {
      const what = link.kind === "component" ? "Die verlinkte Komponente" : "Die verlinkte Verbindung";
      return { error: `${what} gibt es nicht (mehr). ${NOT_FOUND_HINT}` };
    }
    return { focus: found.target };
  }

  const diagram = state.diagrams.find((d) => d.id === link.diagramId);
  if (!diagram) return { error: `Das verlinkte Diagramm gibt es nicht (mehr). ${NOT_FOUND_HINT}` };

  const notices: string[] = [];
  let viewId = link.viewId;
  if (viewId && viewId !== ALL_VIEWS && !state.viewpoints.some((v) => v.id === viewId)) {
    notices.push("Die verlinkte Ansicht gibt es nicht mehr – es werden alle Inhalte gezeigt.");
    viewId = ALL_VIEWS;
  }

  let focus: FocusTarget | undefined;
  if (link.selectId) {
    const found = findElement(state, link.selectId);
    const inDiagram = found && (found.target.kind === "component"
      ? diagram.componentIds.includes(found.target.id)
      : diagram.connectionIds.includes(found.target.id));
    if (!found) {
      notices.push("Das verlinkte Element gibt es nicht (mehr). Das Diagramm wird ohne Markierung geöffnet.");
    } else if (!inDiagram) {
      notices.push(`„${found.name}“ ist in diesem Diagramm nicht (mehr) enthalten.`);
    } else {
      focus = found.target;
      const effectiveView = filterIdFromView(viewId, diagram.viewpointId);
      if (effectiveView && !isVisibleInView(diagram.id, found.target, state, effectiveView)) {
        const viewName = state.viewpoints.find((v) => v.id === effectiveView)?.name ?? "";
        notices.push(`„${found.name}“ ist in der Ansicht „${viewName}“ ausgeblendet – es werden alle Inhalte gezeigt.`);
        viewId = ALL_VIEWS;
      }
    }
  }

  return {
    diagramId: diagram.id,
    ...(viewId ? { viewId } : {}),
    ...(focus ? { focus } : {}),
    ...(notices.length > 0 ? { notice: notices.join(" ") } : {})
  };
}

function isVisibleInView(diagramId: string, target: FocusTarget, state: SidebarState, viewId: string): boolean {
  const diagram = state.diagrams.find((d) => d.id === diagramId);
  if (!diagram) return false;
  const projected = projectDiagramToViewpoint(diagram, state, viewId);
  return target.kind === "component" ? projected.componentIds.includes(target.id) : projected.connectionIds.includes(target.id);
}
