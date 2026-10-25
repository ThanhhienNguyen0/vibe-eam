import { describe, expect, it, vi } from "vitest";
import { connectionModeReducer, handleDiagramNodeClick } from "./DiagramEditor";

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
