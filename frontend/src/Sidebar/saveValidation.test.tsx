import { useState, type ComponentProps } from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkElementName as backendCheckName } from "../../../backend/src/Sidebar/nameRules";
import { AccessContext } from "../access";
import CreateElementDialog from "./CreateElementDialog";
import Sidebar from "./Sidebar";
import SidebarPanels from "./SidebarPanels";
import { connectionsInvalidAfterTypeChange } from "./metamodelRules";
import { elementNameError, isPlaceholderName, placeholderWarning } from "./nameRules";
import type { SidebarState } from "./sidebarTypes";

// #108, #111, #113 in the UI: the same rules as the server, applied before anything is sent.

const api = vi.hoisted(() => ({
  getAll: vi.fn(),
  createComponent: vi.fn(),
  createDiagram: vi.fn(),
  updateComponent: vi.fn(),
  updateDiagram: vi.fn()
}));

vi.mock("./sidebarApi", () => ({ sidebarApi: api }));

const state: SidebarState = {
  dataRevision: 1,
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [
    { id: "app", name: "Application", description: "", color: "#2563eb", icon: "app", customPropertyKeys: [] },
    { id: "data", name: "Data Object", description: "", color: "#7c3aed", icon: "data", customPropertyKeys: [] },
    { id: "proc", name: "Business Process", description: "", color: "#0f766e", icon: "proc", customPropertyKeys: [] },
    { id: "service", name: "Application Service", description: "", color: "#0891b2", icon: "app", customPropertyKeys: [] }
  ],
  connectionTypes: [{ id: "uses", name: "uses", color: "#7c3aed", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" }],
  connectionRules: [
    { id: "r1", sourceComponentTypeId: "app", connectionTypeId: "uses", targetComponentTypeId: "data", allowed: true, required: false, severity: "error", description: "", rationale: "", viewpointIds: [] },
    { id: "r2", sourceComponentTypeId: "service", connectionTypeId: "uses", targetComponentTypeId: "data", allowed: true, required: false, severity: "error", description: "", rationale: "", viewpointIds: [] }
  ],
  viewpoints: [], viewpointRules: [], validationRules: [], catalogs: [],
  components: [
    { id: "crm", version: 1, name: "CRM", componentTypeId: "app", description: "", properties: {} },
    { id: "customer", version: 1, name: "Kundendaten", componentTypeId: "data", description: "", properties: {} }
  ],
  connections: [{ id: "crm-uses-customer", version: 1, name: "", connectionTypeId: "uses", sourceComponentId: "crm", targetComponentId: "customer", description: "" }],
  diagrams: [{ id: "d1", version: 1, name: "Vertrieb", description: "", componentIds: [], connectionIds: [], positions: {} }]
};

const textOf = (node: ReactTestInstance): string =>
  node.children.map((child) => typeof child === "string" ? child : textOf(child)).join("");
const byClass = (renderer: ReactTestRenderer, className: string) =>
  renderer.root.findAll((node) => typeof node.props.className === "string" && node.props.className.split(" ").includes(className) && typeof node.type === "string");
const button = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAllByType("button").find((item) => textOf(item).trim() === label)!;

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("name rule mirror (#108/#113)", () => {
  it("behaves exactly like the server rule", () => {
    const cases: Array<[string, string | undefined]> = [
      ["", undefined], ["   ", undefined], ["Neue Komponente", undefined], ["neue komponente 2", undefined],
      ["Neues Diagramm (3)", undefined], ["CRM", undefined], ["  CRM  ", undefined],
      ["Neue Komponente", "Neue Komponente"], ["Neue Komponente", "CRM"], ["  ", "Neue Komponente"]
    ];
    for (const [value, previousName] of cases) {
      const server = backendCheckName(value, { previousName });
      const confirmed = backendCheckName(value, { previousName, acknowledgePlaceholder: true });
      // Blocking in the UI exactly when the server rejects even a confirmed name.
      expect(elementNameError(value)).toBe("error" in confirmed ? confirmed.error : null);
      // Second confirmation in the UI exactly when the server needs acknowledgePlaceholder.
      expect(placeholderWarning(value, previousName) !== null).toBe("code" in server && server.code === "NAME_PLACEHOLDER");
    }
    expect(isPlaceholderName("Neues Diagramm")).toBe(true);
    expect(isPlaceholderName("Neue Komponentenbibliothek")).toBe(false);
  });
});

describe("type change preview (#111)", () => {
  it("names the connection that a new type would break", () => {
    expect(connectionsInvalidAfterTypeChange(state, "crm", "proc")).toEqual([{
      id: "crm-uses-customer",
      label: "CRM → Kundendaten (uses)",
      reason: "Business Process darf laut Metamodell nicht über „uses“ mit Data Object verbunden sein."
    }]);
    expect(connectionsInvalidAfterTypeChange(state, "crm", "service")).toEqual([]);
  });
});

function PanelHarness({ selection }: { selection: { kind: "component" | "diagram"; id: string } }) {
  const [current, setCurrent] = useState(state);
  return <AccessContext.Provider value="Architect">
    <SidebarPanels
      selection={selection}
      sidebarState={current}
      onStateChange={setCurrent}
      onSelect={() => undefined}
      onOpenDiagram={() => undefined}
      onOpenCatalog={() => undefined}
      onClose={() => undefined}
    />
  </AccessContext.Provider>;
}

describe("detail panel (#108/#111)", () => {
  it("shows a missing component name at the field and blocks saving", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<PanelHarness selection={{ kind: "component", id: "crm" }} />); });
    const name = () => renderer.root.findAllByType("input")[0];
    await act(async () => name().props.onChange({ target: { value: "   " } }));

    expect(name().props["aria-invalid"]).toBe(true);
    expect(textOf(byClass(renderer, "sb-field-error")[0])).toContain("Bitte einen Namen eingeben");
    expect(button(renderer, "Speichern").props.disabled).toBe(true);
    await act(async () => button(renderer, "Speichern").props.onClick());
    expect(api.updateComponent).not.toHaveBeenCalled();

    await act(async () => name().props.onChange({ target: { value: "CRM Cloud" } }));
    expect(byClass(renderer, "sb-field-error")).toHaveLength(0);
    expect(button(renderer, "Speichern").props.disabled).toBe(false);
  });

  it("names connections that a type change would break and blocks saving", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<PanelHarness selection={{ kind: "component", id: "crm" }} />); });
    const typeSelect = () => renderer.root.findAllByType("select")[0];

    await act(async () => typeSelect().props.onChange({ target: { value: "proc" } }));
    const box = byClass(renderer, "sb-field-error-box");
    expect(box).toHaveLength(1);
    expect(textOf(box[0])).toContain("Mit dem Typ „Business Process“ wäre diese Verbindung laut Metamodell nicht mehr erlaubt:");
    expect(textOf(box[0])).toContain("CRM → Kundendaten (uses)");
    expect(typeSelect().props["aria-invalid"]).toBe(true);
    expect(button(renderer, "Speichern").props.disabled).toBe(true);

    await act(async () => typeSelect().props.onChange({ target: { value: "service" } }));
    expect(byClass(renderer, "sb-field-error-box")).toHaveLength(0);
    expect(button(renderer, "Speichern").props.disabled).toBe(false);
  });

  it("applies the name rule to diagrams as well", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<PanelHarness selection={{ kind: "diagram", id: "d1" }} />); });
    await act(async () => renderer.root.findAllByType("input")[0].props.onChange({ target: { value: "  " } }));
    expect(textOf(byClass(renderer, "sb-field-error")[0])).toContain("Bitte einen Namen eingeben");
    expect(button(renderer, "Speichern").props.disabled).toBe(true);
  });

  it("saves a placeholder name only after a warning and a second click", async () => {
    api.updateDiagram.mockImplementation(async (_id: string, patch: object) => ({ ...state.diagrams[0], ...patch, version: 2 }));
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<PanelHarness selection={{ kind: "diagram", id: "d1" }} />); });
    await act(async () => renderer.root.findAllByType("input")[0].props.onChange({ target: { value: "Neues Diagramm" } }));
    expect(textOf(byClass(renderer, "sb-field-hint")[0])).toContain("„Neues Diagramm“ ist ein Platzhaltername");
    expect(button(renderer, "Speichern").props.disabled).toBe(false);

    await act(async () => button(renderer, "Speichern").props.onClick());
    expect(api.updateDiagram).not.toHaveBeenCalled();
    expect(textOf(byClass(renderer, "sb-field-confirm")[0])).toContain("Wirklich den Platzhalternamen „Neues Diagramm“ verwenden?");

    await act(async () => button(renderer, "Ja, mit Platzhalter speichern").props.onClick());
    expect(api.updateDiagram).toHaveBeenCalledWith("d1", expect.objectContaining({ name: "Neues Diagramm" }), 1, { acknowledgePlaceholder: true });
  });

  it("starts the confirmation over when the placeholder name changes", async () => {
    let renderer!: ReactTestRenderer;
    await act(async () => { renderer = create(<PanelHarness selection={{ kind: "component", id: "crm" }} />); });
    const name = () => renderer.root.findAllByType("input")[0];
    await act(async () => name().props.onChange({ target: { value: "Neue Komponente" } }));
    await act(async () => button(renderer, "Speichern").props.onClick());
    expect(byClass(renderer, "sb-field-confirm")).toHaveLength(1);

    await act(async () => name().props.onChange({ target: { value: "Neue Komponente 2" } }));
    expect(byClass(renderer, "sb-field-confirm")).toHaveLength(0);
    await act(async () => button(renderer, "Speichern").props.onClick());
    expect(api.updateComponent).not.toHaveBeenCalled();
  });
});

describe("naming before creation (#113)", () => {
  async function renderDialog(onSubmit: ComponentProps<typeof CreateElementDialog>["onSubmit"]) {
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<CreateElementDialog title="Neue Komponente anlegen" placeholder="z. B. CRM" types={state.componentTypes} onSubmit={onSubmit} onCancel={() => undefined} />);
    });
    return {
      renderer,
      name: () => renderer.root.findByType("input"),
      submit: async () => act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: () => undefined }))
    };
  }

  it("does not submit an empty name and asks twice for a placeholder", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { renderer, name, submit } = await renderDialog(onSubmit);

    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textOf(byClass(renderer, "sb-field-error")[0])).toContain("Bitte einen Namen eingeben");

    await act(async () => name().props.onChange({ target: { value: "Neue Komponente" } }));
    expect(textOf(byClass(renderer, "sb-field-hint")[0])).toContain("ist ein Platzhaltername");
    await submit();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textOf(byClass(renderer, "sb-field-confirm")[0])).toContain("Zum Bestätigen noch einmal auf „Ja, mit Platzhalter anlegen“ klicken.");
    await submit();
    expect(onSubmit).toHaveBeenCalledWith("Neue Komponente", "app", { acknowledgeDuplicate: false, acknowledgePlaceholder: true });
  });

  it("creates a real name with one click, trimmed and with the chosen type", async () => {
    const onSubmit = vi.fn(async () => undefined);
    const { renderer, name, submit } = await renderDialog(onSubmit);
    await act(async () => renderer.root.findByType("select").props.onChange({ target: { value: "data" } }));
    await act(async () => name().props.onChange({ target: { value: "  Kundendaten Archiv " } }));
    await submit();
    expect(onSubmit).toHaveBeenCalledWith("Kundendaten Archiv", "data", { acknowledgeDuplicate: false, acknowledgePlaceholder: false });
  });

  it("shows a server rejection inside the dialog instead of closing it", async () => {
    const onSubmit = vi.fn(async () => { throw new Error("Diagramm konnte nicht angelegt werden."); });
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<CreateElementDialog title="Neues Diagramm anlegen" placeholder="" onSubmit={onSubmit} onCancel={() => undefined} />);
    });
    await act(async () => renderer.root.findByType("input").props.onChange({ target: { value: "Vertrieb" } }));
    await act(async () => renderer.root.findByType("form").props.onSubmit({ preventDefault: () => undefined }));
    expect(textOf(byClass(renderer, "sb-error")[0])).toContain("konnte nicht angelegt werden");
  });

  it("asks for the name in the sidebar instead of storing „Neue Komponente“", async () => {
    api.createComponent.mockImplementation(async (input: object) => ({ ...input, id: "new", version: 1 }));
    const onSelect = vi.fn();
    let renderer!: ReactTestRenderer;
    await act(async () => {
      renderer = create(<AccessContext.Provider value="Architect">
        <Sidebar onSelect={onSelect} selection={null} sidebarState={state} onStateChange={() => undefined} onOpenDiagram={() => undefined} activeDiagramId={null} />
      </AccessContext.Provider>);
    });
    const addComponent = renderer.root.findAll((node) => node.type === "button" && node.props.title === "Neue Komponente")[0];
    await act(async () => addComponent.props.onClick({ stopPropagation: () => undefined }));

    expect(api.createComponent).not.toHaveBeenCalled();
    const dialog = renderer.root.findByType(CreateElementDialog);
    expect(dialog.props.title).toBe("Neue Komponente anlegen");

    await act(async () => dialog.findByType("input").props.onChange({ target: { value: "Billing" } }));
    await act(async () => dialog.findByType("form").props.onSubmit({ preventDefault: () => undefined }));
    expect(api.createComponent).toHaveBeenCalledWith(
      { name: "Billing", componentTypeId: "app", properties: {}, description: "" },
      {}
    );
    expect(onSelect).toHaveBeenCalledWith({ kind: "component", id: "new" });
    expect(renderer.root.findAllByType(CreateElementDialog)).toHaveLength(0);
  });
});
