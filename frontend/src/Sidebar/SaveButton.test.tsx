import { useState, type ReactNode } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessContext } from "../access";
import { ApiError } from "../authApi";
import { SAVED_FEEDBACK_MS, announceNotice, announceSaved, clearSavedFeedback } from "../savedFeedback";
import { SaveButton, SavedNotice, SaveTargetContext } from "./SaveButton";
import SidebarPanels from "./SidebarPanels";
import type { SidebarState } from "./sidebarTypes";

// #117: saving is confirmed where the user saved, briefly, and only after the server confirmed it.

const api = vi.hoisted(() => ({ getAll: vi.fn(), updateComponent: vi.fn() }));
vi.mock("./sidebarApi", () => ({ sidebarApi: api }));

const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => typeof child === "string" ? child : textOf(child)).join("");
const saveButton = (renderer: ReactTestRenderer) => renderer.root.find((node) => node.type === "button" && String(node.props.className).includes("sb-save-btn"));
const status = (renderer: ReactTestRenderer) => renderer.root.findAll((node) => node.type === "span" && node.props.role === "status").map(textOf).join("");

function deferred<T = unknown>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

const inPanel = (target: string, children: ReactNode) => <SaveTargetContext.Provider value={target}>{children}</SaveTargetContext.Provider>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => {
  act(() => clearSavedFeedback());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("save button (#117)", () => {
  it("shows „Speichern …“ until the server answered", async () => {
    const answer = deferred();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(inPanel("component:crm", <SaveButton dirty onSave={() => answer.promise} />)); });

    act(() => { saveButton(renderer).props.onClick(); });
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern …");
    expect(saveButton(renderer).props.disabled).toBe(true);

    await act(async () => { answer.resolve(undefined); });
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");
  });

  it("shows „Gespeichert“ after a confirmed save and hides it again on its own", () => {
    vi.useFakeTimers();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(inPanel("component:crm", <SaveButton dirty={false} disabled onSave={() => undefined} />)); });
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");

    act(() => announceSaved("component:crm"));
    expect(textOf(saveButton(renderer)).trim()).toBe("Gespeichert");
    expect(saveButton(renderer).props.className).toContain("sb-save-btn--saved");
    expect(status(renderer)).toBe("Gespeichert");

    act(() => { vi.advanceTimersByTime(SAVED_FEEDBACK_MS); });
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");
    expect(status(renderer)).toBe("");
  });

  it("does not claim „Gespeichert“ for another element or while there are new edits", () => {
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(inPanel("component:crm", <SaveButton dirty={false} onSave={() => undefined} />)); });
    act(() => announceSaved("component:other"));
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");

    act(() => { renderer.update(inPanel("component:crm", <SaveButton dirty onSave={() => undefined} />)); });
    act(() => announceSaved("component:crm"));
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");
  });
});

describe("notice in the detail panel (#117)", () => {
  it("shows a short message after creating and hides it on its own", () => {
    vi.useFakeTimers();
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(inPanel("component:crm", <SavedNotice />)); });
    expect(renderer.toJSON()).toBeNull();

    act(() => announceNotice("component:crm", "Komponente „CRM“ angelegt und gespeichert."));
    expect(textOf(renderer.root.findByProps({ role: "status" }))).toContain("Komponente „CRM“ angelegt und gespeichert.");

    act(() => { vi.advanceTimersByTime(SAVED_FEEDBACK_MS); });
    expect(renderer.toJSON()).toBeNull();
  });

  it("is not shown for a plain save, which the button confirms", () => {
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(inPanel("component:crm", <SavedNotice />)); });
    act(() => announceSaved("component:crm"));
    expect(renderer.toJSON()).toBeNull();
  });
});

const state: SidebarState = {
  dataRevision: 1,
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [{ id: "app", name: "Application", description: "", color: "#2563eb", icon: "app", customPropertyKeys: [] }],
  connectionTypes: [], connectionRules: [], viewpoints: [], viewpointRules: [], validationRules: [], catalogs: [],
  components: [{ id: "crm", version: 1, name: "CRM", componentTypeId: "app", description: "", properties: {} }],
  connections: [],
  diagrams: []
};

function Panel({ chooseConflictResolution }: { chooseConflictResolution?: () => Promise<"reload" | "overwrite"> }) {
  const [current, setCurrent] = useState(state);
  return <AccessContext.Provider value="Architect">
    <SidebarPanels
      selection={{ kind: "component", id: "crm" }}
      sidebarState={current}
      onStateChange={setCurrent}
      onSelect={() => undefined}
      onOpenDiagram={() => undefined}
      onOpenCatalog={() => undefined}
      onClose={() => undefined}
      chooseConflictResolution={chooseConflictResolution}
    />
  </AccessContext.Provider>;
}

async function editDescription(renderer: ReactTestRenderer) {
  await act(async () => renderer.root.findByType("textarea").props.onChange({ target: { value: "Kundenverwaltung" } }));
}

describe("detail panel save (#117)", () => {
  it("confirms on the button after the server stored the component", async () => {
    api.updateComponent.mockResolvedValue({ ...state.components[0], description: "Kundenverwaltung", version: 2 });
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<Panel />); });
    await editDescription(renderer);

    await act(async () => { saveButton(renderer).props.onClick(); });
    expect(api.updateComponent).toHaveBeenCalledWith("crm", expect.objectContaining({ description: "Kundenverwaltung" }), 1);
    // The panel was rebuilt for version 2 and still shows the confirmation.
    expect(textOf(saveButton(renderer)).trim()).toBe("Gespeichert");
  });

  it("does not confirm when a conflict ended with „Neu laden“", async () => {
    api.updateComponent.mockRejectedValue(new ApiError(409, "Konflikt", { code: "OPTIMISTIC_LOCK_CONFLICT", current: { version: 2 } }));
    api.getAll.mockResolvedValue({ ...state, components: [{ ...state.components[0], version: 2 }] });
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<Panel chooseConflictResolution={async () => "reload"} />); });
    await editDescription(renderer);

    await act(async () => { saveButton(renderer).props.onClick(); });
    expect(api.getAll).toHaveBeenCalled();
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");
  });
});
