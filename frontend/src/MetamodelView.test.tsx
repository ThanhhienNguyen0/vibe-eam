import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MetamodelView from "./MetamodelView";
import { MetamodelDetailDrawer } from "./metamodel/DetailContent";
import type { EdgeRule, MetamodelTab, TypeInsight } from "./metamodel/metamodelLabels";
import type { SidebarState } from "./Sidebar/sidebarTypes";

const noop = () => {};

const state: SidebarState = {
  metamodel: { id: "mm", name: "Test", description: "", version: "1", isActive: true, createdAt: "", updatedAt: "" },
  componentTypes: [
    { id: "t-app", name: "Kassensystem-Typ", description: "Anwendungstyp im Test", color: "#2563eb", icon: "app", customPropertyKeys: ["owner"], layer: "Application" },
    { id: "t-proc", name: "Vertriebsprozess-Typ", description: "Prozesstyp im Test", color: "#0f766e", icon: "box", customPropertyKeys: [], layer: "Business" },
    { id: "t-node", name: "Server-Typ", description: "Technologietyp im Test", color: "#475569", icon: "box", customPropertyKeys: [], layer: "Technology" }
  ],
  connectionTypes: [
    { id: "c-serves", name: "dient-Test", color: "#16a34a", lineStyle: "solid", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" },
    { id: "c-runs", name: "läuft-auf-Test", color: "#7c3aed", lineStyle: "dashed", allowedSourceTypeIds: [], allowedTargetTypeIds: [], description: "" }
  ],
  connectionRules: [
    { id: "r1", sourceComponentTypeId: "t-app", connectionTypeId: "c-serves", targetComponentTypeId: "t-proc", allowed: true, required: true, severity: "error", description: "", rationale: "Begründung-Eins" },
    { id: "r2", sourceComponentTypeId: "t-app", connectionTypeId: "c-runs", targetComponentTypeId: "t-node", allowed: true, required: false, severity: "warning", description: "", rationale: "Begründung-Zwei", viewpointIds: ["vp-ops"] }
  ],
  viewpoints: [
    { id: "vp-biz", name: "Fachsicht-Test", description: "", stakeholderRole: "Fachbereich", allowedComponentTypeIds: ["t-app", "t-proc"], allowedConnectionTypeIds: [], requiredComponentTypeIds: ["t-proc"], requiredConnectionTypeIds: [], purpose: "Zweck-Fach" },
    { id: "vp-ops", name: "Betriebssicht-Test", description: "", stakeholderRole: "Betrieb", allowedComponentTypeIds: ["t-app", "t-node"], allowedConnectionTypeIds: [], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], purpose: "Zweck-Betrieb" }
  ],
  viewpointRules: [
    { id: "vpr-biz", viewpointId: "vp-biz", allowedComponentTypeIds: ["t-app", "t-proc"], allowedConnectionTypeIds: [], allowedConnectionRuleIds: ["r1"], requiredComponentTypeIds: ["t-proc"], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [] },
    { id: "vpr-ops", viewpointId: "vp-ops", allowedComponentTypeIds: ["t-app", "t-node"], allowedConnectionTypeIds: [], allowedConnectionRuleIds: ["r2"], requiredComponentTypeIds: [], requiredConnectionTypeIds: [], requiredConnectionRuleIds: [] }
  ],
  validationRules: [
    { id: "v1", name: "Prüfregel-Eins", description: "Beschreibung-Prüfung", scope: "metamodel", sourceComponentTypeId: "t-app", requiredConnectionTypeId: "c-serves", targetComponentTypeId: "t-proc", direction: "outgoing", minOccurrences: 1, severity: "warning", message: "Meldung-Eins", active: true },
    { id: "v2", name: "Prüfregel-Zwei", description: "", scope: "viewpoint", viewpointId: "vp-ops", sourceComponentTypeId: "t-app", requiredConnectionTypeId: "c-runs", targetComponentTypeId: "t-node", direction: "outgoing", minOccurrences: 1, severity: "error", message: "Meldung-Zwei", active: false }
  ],
  components: [{ id: "comp-1", name: "ERP-Instanz", componentTypeId: "t-app", description: "", properties: {} }],
  connections: [],
  diagrams: [],
  catalogs: []
};

function render(tab: MetamodelTab, sidebarState: SidebarState = state): string {
  return renderToStaticMarkup(<MetamodelView sidebarState={sidebarState} onStateChange={noop} initialTab={tab} />);
}

describe("MetamodelView keeps every piece of metamodel information", () => {
  it("overview shows KPIs, function steps, charts and viewpoints", () => {
    const html = render("overview");
    expect(html).toContain("Ein Metamodell begrenzt den Diagrammbau");
    expect(html).toContain("Komponententypen pro Layer");
    expect(html).toContain("Verbindungsregeln pro Beziehungstyp");
    expect(html).toContain("So funktioniert das Metamodell");
    expect(html).toContain("Fachsicht-Test");
    expect(html).toContain("Zweck-Betrieb");
    expect(html).toContain("ERP System");
  });

  it("component types tab shows layer chips, donut, every type and the full table", () => {
    const html = render("components");
    for (const type of state.componentTypes) expect(html).toContain(type.name);
    expect(html).toContain("Verteilung nach Layer");
    expect(html).toContain("Vollständige Tabelle");
    expect(html).toContain("Anwendung");
    expect(html).toContain("Technologie");
    expect(html).toContain("2 Regeln");
  });

  it("connection rules tab shows summary, heatmap, groups and the full detail table", () => {
    const html = render("rules");
    expect(html).toContain("Regeln zwischen Layern");
    expect(html).toContain("dient-Test");
    expect(html).toContain("läuft-auf-Test");
    expect(html).toContain("Begründung-Eins");
    expect(html).toContain("Begründung-Zwei");
    expect(html).toContain("Betriebssicht-Test");
    expect(html).toContain("<th>Begründung</th>");
  });

  it("viewpoints tab keeps details and adds the comparison matrix", () => {
    const html = render("viewpoints");
    expect(html).toContain("Fachbereich");
    expect(html).toContain("Erlaubte Komponententypen");
    expect(html).toContain("Pflicht-Komponententypen");
    expect(html).toContain("Sichten × Komponententypen");
    expect(html).toContain('aria-label="Pflicht"');
  });

  it("validation tab shows status cards and expandable explanations", () => {
    const html = render("validation");
    expect(html).toContain("Prüfregel-Eins");
    expect(html).toContain("Prüfregel-Zwei");
    expect(html).toContain("Meldung-Eins");
    expect(html).toContain("Beschreibung-Prüfung");
    expect(html).toContain("Erklärung");
    expect(html).toContain("inaktiv");
  });

  it("rule graph renders nodes with quick filters instead of starting empty", () => {
    const simplifiedState: SidebarState = {
      ...state,
      connectionRules: state.connectionRules.map((rule, index) => ({ ...rule, id: index === 0 ? "rule-application-serves-process" : "rule-application-depends-technology" }))
    };
    const html = render("graph", simplifiedState);
    expect(html).toContain("Regelgrafik des Metamodells");
    expect(html).toContain("Nur Pflichtregeln");
    expect(html).toContain("Alle Layer");
    expect(html).toContain("Kassensystem-Typ");
    expect(html).not.toContain("Keine Verbindungsregeln passen");
  });

  it("rule graph shows a loading hint when no metamodel is loaded yet", () => {
    const html = render("graph", { ...state, componentTypes: [], connectionTypes: [], connectionRules: [] });
    expect(html).toContain("Metamodell wird geladen");
  });
});

describe("MetamodelDetailDrawer", () => {
  const [app, proc, node] = state.componentTypes;
  const rules: EdgeRule[] = [
    { rule: state.connectionRules[0], sourceType: app, targetType: proc, connectionType: state.connectionTypes[0] },
    { rule: state.connectionRules[1], sourceType: app, targetType: node, connectionType: state.connectionTypes[1] }
  ];
  const insights = new Map<string, TypeInsight>([[app.id, { rules, viewpoints: state.viewpoints, requiredIn: [] }]]);
  const context = { ...state, typeInsights: insights };

  it("shows description, viewpoints, rules, validation rules and example instances for a type", () => {
    const html = renderToStaticMarkup(<MetamodelDetailDrawer target={{ kind: "type", type: app }} context={context} onSelect={noop} onClose={noop} />);
    expect(html).toContain("Anwendungstyp im Test");
    expect(html).toContain("Verwendbar in Sichten");
    expect(html).toContain("Betriebssicht-Test");
    expect(html).toContain("Ausgehende Regeln");
    expect(html).toContain("Prüfregel-Eins");
    expect(html).toContain("ERP-Instanz");
    expect(html).toContain("owner");
  });

  it("shows all facts of a single rule", () => {
    const html = renderToStaticMarkup(<MetamodelDetailDrawer target={{ kind: "rule", item: rules[1] }} context={context} onSelect={noop} onClose={noop} />);
    expect(html).toContain("Begründung-Zwei");
    expect(html).toContain("Betriebssicht-Test");
    expect(html).toContain("Warnung");
    expect(html).toContain("r2");
  });

  it("renders nothing when no target is selected", () => {
    expect(renderToStaticMarkup(<MetamodelDetailDrawer target={null} context={context} onSelect={noop} onClose={noop} />)).toBe("");
  });
});
