import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi, afterEach } from "vitest";
import { AccessContext, ROLES, type Role } from "./access";
import { HomeView } from "./App";
import Sidebar from "./Sidebar/Sidebar";
import SidebarPanels from "./Sidebar/SidebarPanels";
import UserManagement from "./UserManagement";
import { handleAuthStatus, apiRequest } from "./authApi";
import type { SidebarState } from "./Sidebar/sidebarTypes";

const noop = () => {};
const state: SidebarState = {
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [{ id: "type", name: "Application", description: "", color: "#fff", icon: "app", customPropertyKeys: [] }],
  connectionTypes: [], connectionRules: [], viewpoints: [], viewpointRules: [], validationRules: [],
  components: [{ id: "component", name: "Inventory", componentTypeId: "type", description: "Details", properties: { owner: "Team" } }], connections: [], diagrams: []
};

afterEach(() => vi.unstubAllGlobals());
describe("role-aware rendering", () => {
  it.each([...ROLES, null])("renders usable controls for %s only", (role: Role | null) => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {}); // React SSR useLayoutEffect notice in existing tree.
    const html = renderToStaticMarkup(<AccessContext.Provider value={role}>
      <Sidebar selection={null} onSelect={noop} sidebarState={state} onStateChange={noop} onOpenDiagram={noop} activeDiagramId={null} />
      <HomeView sidebarState={state} onOpenDiagram={noop} onCreateDiagram={noop} canWrite={role === "Admin" || role === "Architect"} />
      <UserManagement onRoleChanged={noop} />
    </AccessContext.Provider>);
    spy.mockRestore();
    expect(html.includes("Nutzerverwaltung")).toBe(role === "Admin");
    expect(html.includes("Neues Diagramm")).toBe(role === "Admin" || role === "Architect");
    expect(html.includes('title="Löschen"')).toBe(role === "Admin" || role === "Architect");
    expect(html.includes('title="Neuer Komponenten-Typ"')).toBe(role === "Admin");
  });

  it.each(ROLES)("shows instance editing and metamodel editing according to %s", (role) => {
    const render = (kind: "component" | "componentType", id: string) => renderToStaticMarkup(<AccessContext.Provider value={role}>
      <SidebarPanels selection={{ kind, id }} sidebarState={state} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onClose={noop} />
    </AccessContext.Provider>);
    expect(render("component", "component").includes("Speichern")).toBe(role !== "Viewer");
    expect(render("componentType", "type").includes("Speichern")).toBe(role === "Admin");
    expect(render("component", "component")).toContain("Inventory");
  });

  it("renders viewer component details as a semantic read-only view", () => {
    const html = renderToStaticMarkup(<AccessContext.Provider value="Viewer">
      <SidebarPanels selection={{ kind: "component", id: "component" }} sidebarState={state} onStateChange={noop} onSelect={noop} onOpenDiagram={noop} onClose={noop} />
    </AccessContext.Provider>);

    expect(html).toContain("Leseansicht");
    expect(html).toContain("Typ");
    expect(html).toContain("Application");
    expect(html).toContain("Beschreibung");
    expect(html).toContain("Details");
    expect(html).toContain("Eigenschaften");
    expect(html).toContain("owner");
    expect(html).toContain("Team");
    expect(html).not.toContain("componentTypeId");
    expect(html).not.toContain("<dt>id</dt>");
    expect(html).not.toContain("Speichern");
  });

  it("keeps credentials on 403 and clears them only on 401", () => {
    const removeItem = vi.fn(); const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { localStorage: { removeItem }, dispatchEvent });
    handleAuthStatus(403);
    expect(removeItem).not.toHaveBeenCalled();
    expect(dispatchEvent.mock.calls[0][0].type).toBe("eam:forbidden");
    handleAuthStatus(401);
    expect(removeItem).toHaveBeenCalledWith("eam.auth.token");
    expect(dispatchEvent.mock.calls[1][0].type).toBe("eam:unauthorized");
  });

  it("does not recursively refresh when /auth/me returns 403", async () => {
    const removeItem = vi.fn(); const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { localStorage: { getItem: () => "test-only-token", removeItem }, dispatchEvent });
    vi.stubGlobal("fetch", async () => ({ ok: false, status: 403, json: async () => ({ error: "No valid role" }) }));
    await expect(apiRequest("/api/auth/me")).rejects.toMatchObject({ status: 403 });
    expect(removeItem).not.toHaveBeenCalled();
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
