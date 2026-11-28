import { describe, expect, it } from "vitest";
import {
  EMPTY_SELECTION,
  applySelectChanges,
  connectionLabel,
  diagramRemoval,
  diagramShortcut,
  isTextEntryTarget,
  pruneSelection,
  removalConfirmation,
  removalNotice,
  selectionForPanelElement,
  selectionLabel,
  visibleElementIds,
  type DiagramSelection,
  type ShortcutContext
} from "./diagramSelection";
import type { ComponentInstance, ConnectionInstance, ConnectionType, Diagram } from "./Sidebar/sidebarTypes";

const component = (id: string, name: string): ComponentInstance => ({ id, name, componentTypeId: "app", properties: {}, description: "" });
const connection = (id: string, source: string, target: string, name = ""): ConnectionInstance => ({
  id, name, connectionTypeId: "uses", sourceComponentId: source, targetComponentId: target, description: ""
});

const components = [component("crm", "CRM"), component("erp", "ERP"), component("dwh", "DWH")];
const connections = [connection("crm-erp", "crm", "erp"), connection("erp-dwh", "erp", "dwh", "Liefert")];
const connectionTypes: ConnectionType[] = [{
  id: "uses", name: "Nutzt", color: "#000", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: ""
}];
const labels = { components, connections, connectionTypes };

const diagram: Diagram = {
  id: "d1",
  name: "Landschaft",
  description: "",
  componentIds: ["crm", "erp", "dwh"],
  connectionIds: ["crm-erp", "erp-dwh"],
  positions: { crm: { x: 0, y: 0 }, erp: { x: 300, y: 0 }, dwh: { x: 600, y: 0 } }
};

const visible = visibleElementIds(diagram, components, connections);
const select = (nodeIds: string[], edgeIds: string[] = []): DiagramSelection => ({ nodeIds, edgeIds });

describe("diagram selection state (#119/#123)", () => {
  it("applies click/multi-select changes and keeps the same object when nothing changes", () => {
    const one = applySelectChanges(EMPTY_SELECTION, "node", [{ id: "crm", selected: true }]);
    expect(one).toEqual(select(["crm"]));
    // React Flow switches from a node to an edge: node is unselected, edge selected.
    const switched = applySelectChanges(applySelectChanges(one, "node", [{ id: "crm", selected: false }]), "edge", [{ id: "crm-erp", selected: true }]);
    expect(switched).toEqual(select([], ["crm-erp"]));
    expect(applySelectChanges(switched, "edge", [{ id: "crm-erp", selected: true }])).toBe(switched);
  });

  it("only counts drawn elements as visible", () => {
    const filtered = { ...diagram, componentIds: ["crm", "erp"] };
    const ids = visibleElementIds(filtered, components, connections);
    expect([...ids.nodeIds]).toEqual(["crm", "erp"]);
    // erp-dwh has a hidden end, so it is not drawn and cannot be selected.
    expect([...ids.edgeIds]).toEqual(["crm-erp"]);
    // A component that was deleted elsewhere is not drawn either.
    expect([...visibleElementIds(diagram, components.slice(0, 2), connections).nodeIds]).toEqual(["crm", "erp"]);
  });

  it("drops a stale selection that is no longer visible, keeps the object otherwise", () => {
    const selection = select(["crm", "dwh"], ["erp-dwh"]);
    expect(pruneSelection(selection, visible)).toBe(selection);
    const hidden = visibleElementIds({ ...diagram, componentIds: ["crm", "erp"] }, components, connections);
    expect(pruneSelection(selection, hidden)).toEqual(select(["crm"]));
  });

  it("mirrors the detail panel element on the canvas", () => {
    expect(selectionForPanelElement(EMPTY_SELECTION, "erp", visible)).toEqual(select(["erp"]));
    expect(selectionForPanelElement(EMPTY_SELECTION, "crm-erp", visible)).toEqual(select([], ["crm-erp"]));
    // Multi-selection that contains the panel element stays as it is.
    const multi = select(["crm", "erp"]);
    expect(selectionForPanelElement(multi, "erp", visible)).toBe(multi);
    // Panel closed or showing something that is not drawn here: nothing stays highlighted.
    expect(selectionForPanelElement(multi, null, visible)).toEqual(EMPTY_SELECTION);
    expect(selectionForPanelElement(multi, "other-diagram-element", visible)).toEqual(EMPTY_SELECTION);
  });
});

describe("delete shortcut (#119)", () => {
  const body = { tagName: "BODY" };
  const context = (overrides: Partial<ShortcutContext> = {}): ShortcutContext => ({
    inEditor: true,
    blocked: false,
    canWrite: true,
    connecting: false,
    selection: select(["crm"]),
    visible,
    ...overrides
  });

  it("removes the visible selection with Delete and Backspace", () => {
    expect(diagramShortcut({ key: "Delete", target: body }, context())).toBe("remove");
    expect(diagramShortcut({ key: "Backspace", target: body }, context({ selection: select([], ["crm-erp"]) }))).toBe("remove");
  });

  it("never hits a stale or hidden selection", () => {
    const hidden = visibleElementIds({ ...diagram, componentIds: ["erp", "dwh"] }, components, connections);
    expect(diagramShortcut({ key: "Delete", target: body }, context({ visible: hidden }))).toBeNull();
    expect(diagramShortcut({ key: "Delete", target: body }, context({ selection: EMPTY_SELECTION }))).toBeNull();
  });

  it("ignores the key outside the diagram, in text fields, dialogs and read-only mode", () => {
    expect(diagramShortcut({ key: "Delete", target: body }, context({ inEditor: false }))).toBeNull();
    expect(diagramShortcut({ key: "Backspace", target: { tagName: "INPUT" } }, context())).toBeNull();
    expect(diagramShortcut({ key: "Delete", target: { tagName: "textarea" } }, context())).toBeNull();
    expect(diagramShortcut({ key: "Delete", target: { tagName: "DIV", isContentEditable: true } }, context())).toBeNull();
    expect(diagramShortcut({ key: "Delete", target: body }, context({ blocked: true }))).toBeNull();
    expect(diagramShortcut({ key: "Delete", target: body }, context({ canWrite: false }))).toBeNull();
    expect(diagramShortcut({ key: "Delete", target: body, defaultPrevented: true }, context())).toBeNull();
    expect(diagramShortcut({ key: "a", target: body }, context())).toBeNull();
  });

  it("clears the selection with Escape, but leaves Escape to the connect mode", () => {
    expect(diagramShortcut({ key: "Escape", target: body }, context())).toBe("clear");
    expect(diagramShortcut({ key: "Escape", target: body }, context({ canWrite: false }))).toBe("clear");
    expect(diagramShortcut({ key: "Escape", target: body }, context({ connecting: true }))).toBeNull();
    expect(diagramShortcut({ key: "Escape", target: body }, context({ selection: EMPTY_SELECTION }))).toBeNull();
  });

  it("recognises text entry targets without a DOM", () => {
    expect(isTextEntryTarget(null)).toBe(false);
    expect(isTextEntryTarget({ tagName: "BUTTON" })).toBe(false);
    expect(isTextEntryTarget({ tagName: "SELECT" })).toBe(true);
  });
});

describe("removing the selection from the diagram (#119/#120)", () => {
  it("removes only the selected connection", () => {
    const removal = diagramRemoval(diagram, connections, [], ["crm-erp"]);
    expect(removal.componentIds).toEqual(["crm", "erp", "dwh"]);
    expect(removal.connectionIds).toEqual(["erp-dwh"]);
    expect(removal.positions).toEqual(diagram.positions);
    expect(removal.attachedConnectionIds).toEqual([]);
  });

  it("removes a component together with its attached connections and its position", () => {
    const removal = diagramRemoval(diagram, connections, ["erp"], []);
    expect(removal.componentIds).toEqual(["crm", "dwh"]);
    expect(removal.connectionIds).toEqual([]);
    expect(Object.keys(removal.positions)).toEqual(["crm", "dwh"]);
    expect(removal.attachedConnectionIds).toEqual(["crm-erp", "erp-dwh"]);
  });

  it("does not count an explicitly selected connection as attached", () => {
    expect(diagramRemoval(diagram, connections, ["erp"], ["crm-erp"]).attachedConnectionIds).toEqual(["erp-dwh"]);
  });

  it("asks before removing and names exactly what is affected", () => {
    const edge = removalConfirmation(select([], ["erp-dwh"]), 0, labels);
    expect(edge.title).toBe("Verbindung aus dem Diagramm entfernen?");
    expect(edge.items).toEqual(["Verbindung „Liefert“: ERP → DWH"]);
    expect(edge.confirmLabel).toBe("Aus Diagramm entfernen");
    expect(edge.message).toContain("bleibt im Repository");

    const node = removalConfirmation(select(["crm"]), 1, labels);
    expect(node.title).toBe("„CRM“ aus dem Diagramm entfernen?");
    expect(node.notes).toEqual(["Zusätzlich verschwinden 1 angeschlossene Verbindung aus dem Diagramm."]);

    expect(removalConfirmation(select(["crm", "erp"], ["erp-dwh"]), 0, labels).title).toBe("3 Elemente aus dem Diagramm entfernen?");
  });

  it("describes the result", () => {
    expect(removalNotice(0, 1)).toBe("Verbindung aus dem Diagramm entfernt (bleibt im Modell erhalten).");
    expect(removalNotice(1, 0)).toBe("Aus dem Diagramm entfernt (bleibt im Modell erhalten).");
    expect(removalNotice(2, 1)).toBe("3 Elemente aus dem Diagramm entfernt (bleiben im Modell erhalten).");
  });
});

describe("selection labels (#120/#123)", () => {
  it("names a single component or connection with its ends", () => {
    expect(selectionLabel(select(["crm"]), labels)).toBe("Komponente „CRM“");
    // Unnamed connection falls back to its type name.
    expect(selectionLabel(select([], ["crm-erp"]), labels)).toBe("Verbindung „Nutzt“: CRM → ERP");
    expect(connectionLabel("missing", labels)).toBe("Verbindung");
  });

  it("counts a multi-selection", () => {
    expect(selectionLabel(select(["crm", "erp"]), labels)).toBe("2 Komponenten");
    expect(selectionLabel(select(["crm"], ["crm-erp", "erp-dwh"]), labels)).toBe("1 Komponente und 2 Verbindungen");
  });
});
