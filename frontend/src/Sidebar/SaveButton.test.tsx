import { useState, type ReactNode } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccessContext } from "../access";
import { ApiError } from "../authApi";
import { SAVED_FEEDBACK_MS, announceInSidebar, announceSaved, clearSavedFeedback } from "../savedFeedback";
import { SaveButton, SaveTargetContext } from "./SaveButton";
import Sidebar from "./Sidebar";
import SidebarPanels from "./SidebarPanels";
import type { SidebarState } from "./sidebarTypes";

// #117: saving is confirmed where the user saved, briefly, and only after the server confirmed it.

const api = vi.hoisted(() => ({ getAll: vi.fn(), updateComponent: vi.fn(), createComponent: vi.fn(), deleteComponent: vi.fn() }));
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
  // Without a ConfirmProvider the sidebar falls back to window.confirm.
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn(), confirm: vi.fn(() => true) });
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

  it("ignores changes made in the sidebar, which are confirmed there", () => {
    let renderer!: ReactTestRenderer;
    act(() => { renderer = create(inPanel("component:crm", <SaveButton dirty={false} onSave={() => undefined} />)); });
    act(() => announceInSidebar("component:crm", "„CRM“ gespeichert."));
    expect(textOf(saveButton(renderer)).trim()).toBe("Speichern");
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

function SidebarHarness() {
  const [current, setCurrent] = useState(state);
  return <AccessContext.Provider value="Architect">
    <Sidebar onSelect={() => undefined} selection={null} sidebarState={current} onStateChange={setCurrent} onOpenDiagram={() => undefined} activeDiagramId={null} defaultOpen />
  </AccessContext.Provider>;
}

const hasClass = (node: ReactTestInstance, className: string) => typeof node.type === "string" && String(node.props.className ?? "").split(" ").includes(className);
const row = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll((node) => hasClass(node, "sb-row") && textOf(node).trim() === label)[0];
const sidebarNotice = (renderer: ReactTestRenderer) =>
  renderer.root.findAll((node) => hasClass(node, "sb-sidebar-notice")).map(textOf).join("").trim();

describe("sidebar confirmation (#117)", () => {
  it("confirms a rename in the sidebar: row highlight and a short message there", async () => {
    vi.useFakeTimers();
    api.updateComponent.mockResolvedValue({ ...state.components[0], name: "CRM Neu", version: 2 });
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SidebarHarness />); });

    await act(async () => row(renderer, "CRM").props.onContextMenu({ preventDefault: () => undefined, stopPropagation: () => undefined, clientX: 10, clientY: 10 }));
    const rename = renderer.root.findAll((node) => node.type === "button" && textOf(node).includes("Umbenennen"))[0];
    await act(async () => rename.props.onClick());
    const input = renderer.root.find((node) => hasClass(node, "sb-rename-input"));
    await act(async () => input.props.onChange({ target: { value: "CRM Neu" } }));
    await act(async () => input.props.onKeyDown({ key: "Enter" }));

    expect(api.updateComponent).toHaveBeenCalledWith("crm", { name: "CRM Neu" }, 1);
    expect(row(renderer, "CRM Neu").props.className).toContain("sb-row--saved");
    expect(sidebarNotice(renderer)).toBe("„CRM Neu“ gespeichert.");

    act(() => { vi.advanceTimersByTime(SAVED_FEEDBACK_MS); });
    expect(row(renderer, "CRM Neu").props.className).not.toContain("sb-row--saved");
    expect(sidebarNotice(renderer)).toBe("");
  });

  it("confirms a new component in the sidebar, where it was created", async () => {
    api.createComponent.mockImplementation(async (input: object) => ({ ...input, id: "billing", version: 1 }));
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SidebarHarness />); });

    const add = renderer.root.findAll((node) => node.type === "button" && node.props.title === "Neue Komponente")[0];
    await act(async () => add.props.onClick({ stopPropagation: () => undefined }));
    const form = renderer.root.findByType("form");
    await act(async () => form.findByType("input").props.onChange({ target: { value: "Billing" } }));
    await act(async () => form.props.onSubmit({ preventDefault: () => undefined }));

    expect(row(renderer, "Billing").props.className).toContain("sb-row--saved");
    expect(sidebarNotice(renderer)).toBe("Komponente „Billing“ angelegt und gespeichert.");
  });

  const deleteButton = (renderer: ReactTestRenderer, label: string) =>
    row(renderer, label).findAll((node) => node.type === "button" && node.props.title === "Aus Repository löschen")[0];

  it("confirms a permanent deletion in the sidebar after the server deleted it", async () => {
    api.deleteComponent.mockResolvedValue(undefined);
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SidebarHarness />); });

    await act(async () => deleteButton(renderer, "CRM").props.onClick({ stopPropagation: () => undefined }));
    expect(api.deleteComponent).toHaveBeenCalledWith("crm", 1);
    expect(row(renderer, "CRM")).toBeUndefined();
    expect(sidebarNotice(renderer)).toBe("Komponente „CRM“ endgültig aus dem Repository gelöscht.");
  });

  it("says nothing when the deletion was cancelled, and nothing before the server deleted it", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<SidebarHarness />); });

    (window.confirm as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);
    await act(async () => deleteButton(renderer, "CRM").props.onClick({ stopPropagation: () => undefined }));
    expect(api.deleteComponent).not.toHaveBeenCalled();
    expect(sidebarNotice(renderer)).toBe("");

    const answer = deferred();
    api.deleteComponent.mockReturnValue(answer.promise);
    await act(async () => deleteButton(renderer, "CRM").props.onClick({ stopPropagation: () => undefined }));
    expect(api.deleteComponent).toHaveBeenCalledTimes(1);
    expect(row(renderer, "CRM")).toBeDefined();
    expect(sidebarNotice(renderer)).toBe("");

    await act(async () => { answer.resolve(undefined); });
    expect(sidebarNotice(renderer)).toBe("Komponente „CRM“ endgültig aus dem Repository gelöscht.");
  });
});
