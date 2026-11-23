import { describe, expect, it, vi } from "vitest";
import { connectionModeReducer, handleDiagramNodeClick, mergeSmartAddMemberships } from "./DiagramEditor";

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
