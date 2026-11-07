import { useState } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccessContext } from "../access";
import { ApiError } from "../authApi";
import SidebarPanels from "./SidebarPanels";
import type { SidebarState } from "./sidebarTypes";

const api = vi.hoisted(() => ({
  getAll: vi.fn(),
  updateComponent: vi.fn()
}));

vi.mock("./sidebarApi", () => ({ sidebarApi: api }));

const initialState: SidebarState = {
  dataRevision: 1,
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [{ id: "type", name: "Application", description: "", color: "#fff", icon: "app", customPropertyKeys: [] }],
  connectionTypes: [], connectionRules: [], viewpoints: [], viewpointRules: [], validationRules: [],
  components: [{ id: "component", version: 1, name: "Server v1", componentTypeId: "type", description: "", properties: {} }],
  connections: [], diagrams: [], catalogs: []
};

const conflict = (version: number) => new ApiError(409, "conflict", {
  code: "OPTIMISTIC_LOCK_CONFLICT",
  current: { id: "component", version, name: `Server v${version}` }
});

function Harness({ choose }: { choose: () => Promise<"reload" | "overwrite"> }) {
  const [state, setState] = useState(initialState);
  return <AccessContext.Provider value="Architect">
    <SidebarPanels
      selection={{ kind: "component", id: "component" }}
      sidebarState={state}
      onStateChange={setState}
      onSelect={() => undefined}
      onOpenDiagram={() => undefined}
      onOpenCatalog={() => undefined}
      onClose={() => undefined}
      chooseConflictResolution={choose}
    />
  </AccessContext.Provider>;
}

function nameInput(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType("input")[0];
}

function saveButton(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType("button").find((button) => button.children.includes("Speichern"))!;
}

describe("optimistic editor integration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("keeps the draft until the decision and replaces it with the reloaded server revision", async () => {
    const reloaded: SidebarState = {
      ...initialState,
      dataRevision: 2,
      components: [{ ...initialState.components[0], version: 2, name: "Server v2" }]
    };
    api.updateComponent.mockRejectedValueOnce(conflict(2));
    api.getAll.mockResolvedValueOnce(reloaded);
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<Harness choose={async () => "reload"} />); });

    await act(async () => nameInput(renderer).props.onChange({ target: { value: "Local draft" } }));
    expect(nameInput(renderer).props.value).toBe("Local draft");
    await act(async () => saveButton(renderer).props.onClick());

    expect(api.updateComponent).toHaveBeenCalledWith("component", expect.objectContaining({ name: "Local draft" }), 1);
    expect(nameInput(renderer).props.value).toBe("Server v2");

    api.updateComponent.mockResolvedValueOnce({ ...reloaded.components[0], version: 3, name: "Saved after reload" });
    await act(async () => nameInput(renderer).props.onChange({ target: { value: "Saved after reload" } }));
    await act(async () => saveButton(renderer).props.onClick());
    expect(api.updateComponent).toHaveBeenLastCalledWith("component", expect.objectContaining({ name: "Saved after reload" }), 2);
    expect(nameInput(renderer).props.value).toBe("Saved after reload");
    expect(saveButton(renderer).props.disabled).toBe(true);
  });

  it("preserves the same draft through repeated overwrite conflicts and advances each precondition", async () => {
    api.updateComponent
      .mockRejectedValueOnce(conflict(2))
      .mockRejectedValueOnce(conflict(3))
      .mockResolvedValueOnce({ ...initialState.components[0], version: 4, name: "Persistent draft" });
    const choose = vi.fn(async () => "overwrite" as const);
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<Harness choose={choose} />); });
    await act(async () => nameInput(renderer).props.onChange({ target: { value: "Persistent draft" } }));
    await act(async () => saveButton(renderer).props.onClick());

    expect(api.updateComponent.mock.calls.map((call) => call[2])).toEqual([1, 2, 3]);
    expect(api.updateComponent.mock.calls.every((call) => call[1].name === "Persistent draft")).toBe(true);
    expect(choose).toHaveBeenCalledTimes(2);
    expect(nameInput(renderer).props.value).toBe("Persistent draft");
    expect(saveButton(renderer).props.disabled).toBe(true);
  });
});
