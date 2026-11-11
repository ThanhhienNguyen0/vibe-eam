import { describe, expect, it } from "vitest";
import { absoluteLink, ALL_VIEWS, buildDeepLinkPath, filterIdFromView, parseDeepLink, resolveDeepLink, viewParam, type DeepLink } from "./deepLink";
import type { SidebarState } from "./Sidebar/sidebarTypes";

const state: SidebarState = {
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [
    { id: "proc", name: "Process", description: "", color: "#fff", icon: "", customPropertyKeys: [] },
    { id: "cap", name: "Capability", description: "", color: "#fff", icon: "", customPropertyKeys: [] },
    { id: "app", name: "Application", description: "", color: "#fff", icon: "", customPropertyKeys: [] }
  ],
  connectionTypes: [
    { id: "realizes", name: "realizes", description: "", color: "#fff", lineStyle: "solid", allowedSourceTypeIds: ["proc"], allowedTargetTypeIds: ["cap"] }
  ],
  connectionRules: [
    { id: "proc-cap", sourceComponentTypeId: "proc", connectionTypeId: "realizes", targetComponentTypeId: "cap", allowed: true, required: false, severity: "error", description: "", rationale: "", viewpointIds: ["business"] }
  ],
  viewpoints: [
    { id: "business", name: "Business", description: "", stakeholderRole: "Owner", purpose: "", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [] }
  ],
  viewpointRules: [
    { id: "vpr-business", viewpointId: "business", allowedComponentTypeIds: ["proc", "cap"], allowedConnectionTypeIds: ["realizes"], allowedConnectionRuleIds: ["proc-cap"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [], visibleComponentTypeIds: ["proc", "cap"], description: "", severity: "error" }
  ],
  validationRules: [],
  components: [
    { id: "p", name: "Bestellung", componentTypeId: "proc", description: "", properties: {} },
    { id: "c", name: "Vertrieb", componentTypeId: "cap", description: "", properties: {} },
    { id: "a", name: "CRM", componentTypeId: "app", description: "", properties: {} },
    { id: "orphan", name: "Altsystem", componentTypeId: "app", description: "", properties: {} }
  ],
  connections: [
    { id: "pc", name: "", connectionTypeId: "realizes", sourceComponentId: "p", targetComponentId: "c", description: "" }
  ],
  catalogs: [],
  diagrams: [{ id: "d1", name: "Landschaft", description: "", componentIds: ["p", "c", "a"], connectionIds: ["pc"], positions: {} }]
};

describe("REQ-12 deep links: URL schema", () => {
  it("parses diagram, element and filtered-view links", () => {
    expect(parseDeepLink("/")).toEqual({ kind: "home" });
    expect(parseDeepLink("/diagram/d1")).toEqual({ kind: "diagram", diagramId: "d1" });
    expect(parseDeepLink("/diagram/d1", "?select=p")).toEqual({ kind: "diagram", diagramId: "d1", selectId: "p" });
    expect(parseDeepLink("/diagram/d1/", "?view=business&select=p")).toEqual({ kind: "diagram", diagramId: "d1", selectId: "p", viewId: "business" });
    expect(parseDeepLink("/component/a")).toEqual({ kind: "component", id: "a" });
    expect(parseDeepLink("/connection/pc")).toEqual({ kind: "connection", id: "pc" });
    expect(parseDeepLink("/diagram")).toEqual({ kind: "invalid", path: "/diagram" });
    expect(parseDeepLink("/irgendwas/x")).toEqual({ kind: "invalid", path: "/irgendwas/x" });
  });

  it("builds links that parse back to the same target, also with special characters", () => {
    const links: DeepLink[] = [
      { kind: "diagram", diagramId: "d 1/ä", selectId: "c&1", viewId: "v?2" },
      { kind: "diagram", diagramId: "d1" },
      { kind: "component", id: "a/b" },
      { kind: "connection", id: "pc" }
    ];
    for (const link of links) {
      const [path, query = ""] = buildDeepLinkPath(link).split("?");
      expect(parseDeepLink(path, query ? `?${query}` : "")).toEqual(link);
    }
    expect(buildDeepLinkPath({ kind: "diagram", diagramId: "d1", selectId: "p", viewId: "business" })).toBe("/diagram/d1?view=business&select=p");
    expect(absoluteLink({ kind: "diagram", diagramId: "d1" }, "https://eam.example/")).toBe("https://eam.example/diagram/d1");
  });
});

describe("REQ-12 deep links: resolving against the model", () => {
  it("opens the diagram, applies the view and focuses the element", () => {
    expect(resolveDeepLink({ kind: "diagram", diagramId: "d1", selectId: "p", viewId: "business" }, state))
      .toEqual({ diagramId: "d1", viewId: "business", focus: { kind: "component", id: "p" } });
    expect(resolveDeepLink({ kind: "diagram", diagramId: "d1", selectId: "pc" }, state))
      .toEqual({ diagramId: "d1", focus: { kind: "connection", id: "pc" } });
  });

  it("shows an understandable error for unknown diagrams or elements", () => {
    expect(resolveDeepLink({ kind: "diagram", diagramId: "gibt-es-nicht" }, state).error).toMatch(/Diagramm gibt es nicht/);
    expect(resolveDeepLink({ kind: "component", id: "x" }, state).error).toMatch(/Komponente gibt es nicht/);
    // A connection id behind /component/ is not silently accepted.
    expect(resolveDeepLink({ kind: "component", id: "pc" }, state).error).toBeDefined();
    expect(resolveDeepLink({ kind: "invalid", path: "/foo/bar" }, state).error).toMatch(/Adresse kennt die App nicht/);
    expect(resolveDeepLink({ kind: "connection", id: "pc" }, state)).toEqual({ focus: { kind: "connection", id: "pc" } });
  });

  it("still opens the diagram when only part of the link is outdated", () => {
    const missing = resolveDeepLink({ kind: "diagram", diagramId: "d1", selectId: "weg" }, state);
    expect(missing).toMatchObject({ diagramId: "d1" });
    expect(missing.focus).toBeUndefined();
    expect(missing.notice).toMatch(/Element gibt es nicht/);

    const notInDiagram = resolveDeepLink({ kind: "diagram", diagramId: "d1", selectId: "orphan" }, state);
    expect(notInDiagram.notice).toMatch(/„Altsystem“ ist in diesem Diagramm nicht/);

    const unknownView = resolveDeepLink({ kind: "diagram", diagramId: "d1", viewId: "weg" }, state);
    expect(unknownView).toMatchObject({ diagramId: "d1", viewId: ALL_VIEWS });
    expect(unknownView.notice).toMatch(/Ansicht gibt es nicht mehr/);
  });

  it("drops the view filter when it would hide the linked element", () => {
    // CRM is an application; the Business view only shows processes and capabilities.
    const result = resolveDeepLink({ kind: "diagram", diagramId: "d1", selectId: "a", viewId: "business" }, state);
    expect(result).toMatchObject({ diagramId: "d1", viewId: ALL_VIEWS, focus: { kind: "component", id: "a" } });
    expect(result.notice).toMatch(/„CRM“ ist in der Ansicht „Business“ ausgeblendet/);

    // Same when the hiding filter is the diagram's saved default view (no view in the link).
    const withDefault = { ...state, diagrams: [{ ...state.diagrams[0], viewpointId: "business" }] };
    expect(resolveDeepLink({ kind: "diagram", diagramId: "d1", selectId: "a" }, withDefault)).toMatchObject({ viewId: ALL_VIEWS });
  });

  it("encodes the current filter relative to the diagram's saved default view", () => {
    expect(viewParam("", undefined)).toBeUndefined();
    expect(viewParam("business", undefined)).toBe("business");
    expect(viewParam("business", "business")).toBeUndefined();
    expect(viewParam("", "business")).toBe(ALL_VIEWS);
    expect(filterIdFromView(undefined, "business")).toBe("business");
    expect(filterIdFromView(ALL_VIEWS, "business")).toBe("");
    expect(filterIdFromView("other", "business")).toBe("other");
  });
});
