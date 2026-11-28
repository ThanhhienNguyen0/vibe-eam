import { describe, expect, it, vi } from "vitest";
import { buildEdges, buildNodes, connectionModeReducer, handleDiagramNodeClick, mergeSmartAddMemberships } from "./DiagramEditor";
import type { ComponentInstance, ComponentType, ConnectionInstance, ConnectionType, Diagram } from "./Sidebar/sidebarTypes";

describe("DiagramEditor smart add", () => {
  it("adds a shared neighbor only once when multiple selected connections target it", () => {
    expect(mergeSmartAddMemberships(
      { componentIds: [], connectionIds: [] },
      "erp",
      ["invoice", "invoice"],
      ["erp-uses-invoice", "erp-writes-invoice"]
    )).toEqual({
      componentIds: ["erp", "invoice"],
      connectionIds: ["erp-uses-invoice", "erp-writes-invoice"],
      newComponentIds: ["invoice"]
    });
  });

  it("supports adding only the selected component", () => {
    expect(mergeSmartAddMemberships(
      { componentIds: ["existing"], connectionIds: ["existing-connection"] },
      "erp",
      [],
      []
    )).toEqual({
      componentIds: ["existing", "erp"],
      connectionIds: ["existing-connection"],
      newComponentIds: []
    });
  });

  it("keeps existing memberships unique and reports only newly placed neighbors", () => {
    expect(mergeSmartAddMemberships(
      { componentIds: ["existing", "invoice"], connectionIds: ["existing-connection"] },
      "erp",
      ["invoice", "new-data", "new-data"],
      ["existing-connection", "new-connection", "new-connection"]
    )).toEqual({
      componentIds: ["existing", "invoice", "erp", "new-data"],
      connectionIds: ["existing-connection", "new-connection"],
      newComponentIds: ["new-data"]
    });
  });
});

describe("DiagramEditor viewpoint transition", () => {
  it("cancels connection mode on a local preview switch and does not connect on the following target click", async () => {
    let connectingFrom = connectionModeReducer(null, { type: "start", sourceId: "p" });
    expect(connectingFrom).toBe("p");

    connectingFrom = connectionModeReducer(connectingFrom, {
      type: "viewpoint-changed",
      localPreviewActive: true
    });
    expect(connectingFrom).toBeNull();

    const createConnection = vi.fn(async () => undefined);
    const selectComponent = vi.fn();
    await handleDiagramNodeClick({
      connectingFrom,
      targetId: "c",
      canWrite: false,
      cancelConnectionMode: vi.fn(),
      selectComponent,
      createConnection
    });

    expect(selectComponent).toHaveBeenCalledWith("c");
    expect(createConnection).not.toHaveBeenCalled();
  });

  it("fails closed when a stale connection click reaches the handler after the preview became read-only", async () => {
    const createConnection = vi.fn(async () => undefined);
    const cancelConnectionMode = vi.fn();

    await handleDiagramNodeClick({
      connectingFrom: "p",
      targetId: "c",
      canWrite: false,
      cancelConnectionMode,
      selectComponent: vi.fn(),
      createConnection
    });

    expect(cancelConnectionMode).toHaveBeenCalledOnce();
    expect(createConnection).not.toHaveBeenCalled();
  });
});

describe("DiagramEditor selection rendering (#119/#123)", () => {
  const componentTypes: ComponentType[] = [{ id: "app", name: "Anwendung", color: "#0ea5e9", icon: "", description: "", customPropertyKeys: [] }];
  const connectionTypes: ConnectionType[] = [{
    id: "uses", name: "Nutzt", color: "#f97316", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: ""
  }];
  const components: ComponentInstance[] = ["a", "b"].map((id) => ({ id, name: id.toUpperCase(), componentTypeId: "app", properties: {}, description: "" }));
  const connections: ConnectionInstance[] = [{ id: "a-b", name: "", connectionTypeId: "uses", sourceComponentId: "a", targetComponentId: "b", description: "" }];
  const diagram: Diagram = {
    id: "d", name: "D", description: "", componentIds: ["a", "b"], connectionIds: ["a-b"],
    positions: { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } }
  };
  const nodes = (highlightId: string | null, selected: string[]) =>
    buildNodes(diagram, components, componentTypes, null, null, null, undefined, undefined, true, highlightId, new Set(selected));

  it("marks exactly the selected nodes, nothing else", () => {
    expect(nodes(null, ["b"]).map((node) => [node.id, node.selected])).toEqual([["a", false], ["b", true]]);
    expect(nodes(null, []).every((node) => node.selected === false)).toBe(true);
  });

  it("does not select a link target behind the editor's back", () => {
    const [a] = nodes("a", []);
    expect(a.className).toBe("is-link-target");
    expect(a.selected).toBe(false);
    const [edge] = buildEdges(diagram, connections, connectionTypes, "a-b");
    expect(edge.selected).toBe(false);
  });

  it("draws a selected connection in the selection colour instead of its type colour", () => {
    const [plain] = buildEdges(diagram, connections, connectionTypes);
    expect(plain.selected).toBe(false);
    expect(plain.style?.stroke).toBe("#f97316");
    const [selected] = buildEdges(diagram, connections, connectionTypes, null, new Set(["a-b"]));
    expect(selected.selected).toBe(true);
    expect(selected.style?.stroke).toBe("#2563eb");
    expect(selected.style?.strokeWidth).toBe(3);
    expect(selected.markerEnd).toMatchObject({ color: "#2563eb" });
  });
});
