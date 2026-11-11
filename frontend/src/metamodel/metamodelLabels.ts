import type {
  ComponentType,
  ConnectionRule,
  ConnectionType,
  SidebarState,
  ValidationRule,
  Viewpoint,
  ViewpointRule
} from "../Sidebar/sidebarTypes";

export interface EdgeRule {
  rule: ConnectionRule;
  connectionType: ConnectionType;
  sourceType: ComponentType;
  targetType: ComponentType;
}

export type MetamodelTab = "overview" | "components" | "rules" | "viewpoints" | "validation" | "graph";
export type SortKey = "source" | "connection";
export type GraphMode = "simplified" | "detailed" | "viewpoint";

export interface GraphEdge {
  id: string;
  sourceType: ComponentType;
  targetType: ComponentType;
  connectionTypes: ConnectionType[];
  rules: EdgeRule[];
}

/** What the right-hand detail drawer currently shows. */
export type DetailTarget =
  | { kind: "type"; type: ComponentType }
  | { kind: "rule"; item: EdgeRule }
  | { kind: "edge"; item: GraphEdge }
  | null;

export interface TypeInsight {
  rules: EdgeRule[];
  viewpoints: Viewpoint[];
  requiredIn: Viewpoint[];
}

export const TABS: Array<[MetamodelTab, string]> = [
  ["overview", "Überblick"],
  ["components", "Komponententypen"],
  ["rules", "Verbindungsregeln"],
  ["viewpoints", "Sichten"],
  ["validation", "Prüfregeln"],
  ["graph", "Regelgrafik"]
];

export const SIMPLIFIED_RULE_IDS = new Set([
  "rule-stakeholder-interested-capability",
  "rule-stakeholder-responsible-application",
  "rule-goal-supports-capability",
  "rule-process-realizes-capability",
  "rule-application-serves-process",
  "rule-application-uses-data-object",
  "rule-application-depends-technology",
  "rule-org-owns-application"
]);

export const SIMPLIFIED_POSITIONS: Record<string, { x: number; y: number }> = {
  "ct-goal": { x: 150, y: 130 },
  "ct-stakeholder": { x: 150, y: 430 },
  "ct-org-unit": { x: 150, y: 570 },
  "ct-capability": { x: 420, y: 185 },
  "ct-proc": { x: 420, y: 400 },
  "ct-app": { x: 700, y: 320 },
  "ct-data-object": { x: 980, y: 220 },
  "ct-technology-node": { x: 980, y: 455 }
};

export const LAYER_ORDER = ["Motivation", "Business", "Organization", "Application", "Data", "Technology", "BPMN", "Other"];
export const GRAPH_RULE_LIMIT = 50;

/** One stable colour per architecture layer (used for chips, charts, graph nodes). */
export const LAYER_COLORS: Record<string, string> = {
  Motivation: "#22c55e",
  Business: "#f97316",
  Organization: "#ec4899",
  Application: "#3b82f6",
  Data: "#a78bfa",
  Technology: "#38bdf8",
  BPMN: "#eab308",
  Other: "#94a3b8"
};

/** One-letter abbreviations for compact matrix headers. */
export const LAYER_SHORT: Record<string, string> = {
  Motivation: "M",
  Business: "B",
  Organization: "O",
  Application: "A",
  Data: "D",
  Technology: "T",
  BPMN: "P",
  Other: "S"
};

export function layerShort(layer: string): string {
  return LAYER_SHORT[layer] ?? layer.slice(0, 1).toUpperCase();
}

const FALLBACK_LAYER_COLORS = ["#db2777", "#0891b2", "#65a30d", "#9333ea", "#dc2626"];

export function layerColor(layer: string): string {
  if (LAYER_COLORS[layer]) return LAYER_COLORS[layer];
  let hash = 0;
  for (const char of layer) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return FALLBACK_LAYER_COLORS[hash % FALLBACK_LAYER_COLORS.length];
}

export const SEVERITY_COLORS: Record<string, string> = {
  error: "#dc2626",
  warning: "#d97706"
};

const TYPE_LABELS: Record<string, string> = {
  "ct-stakeholder": "Stakeholder",
  "ct-goal": "Ziel / Objective",
  "ct-capability": "Business Capability",
  "ct-proc": "Geschäftsprozess",
  "ct-app": "Anwendung",
  "ct-data-object": "Datenobjekt",
  "ct-technology-node": "Technologie-Knoten",
  "ct-org-unit": "Organisationseinheit"
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  "ct-stakeholder": "Person oder Rolle mit Interesse an der Architektur.",
  "ct-goal": "Geschäftliches Ziel oder messbares Vorhaben.",
  "ct-capability": "Stabile geschäftliche Fähigkeit, die das Unternehmen benötigt.",
  "ct-proc": "Geschäftsprozess, der Fähigkeiten realisiert und von Anwendungen unterstützt wird.",
  "ct-app": "Software-Anwendung oder Anwendungskomponente.",
  "ct-data-object": "Relevantes Geschäfts- oder Anwendungsdatenobjekt.",
  "ct-technology-node": "Infrastruktur- oder Laufzeitkomponente für Anwendungen.",
  "ct-org-unit": "Team, Abteilung oder Organisationseinheit."
};

const CONNECTION_LABELS: Record<string, string> = {
  "conn-realizes": "realisiert",
  "conn-serves": "bedient",
  "conn-uses": "nutzt",
  "conn-depends-on": "hängt ab von",
  "conn-owns": "besitzt",
  "conn-responsible-for": "verantwortlich für",
  "conn-interested-in": "interessiert an",
  "conn-supports": "unterstützt",
  "conn-reports-to": "berichtet an"
};

const VIEWPOINT_LABELS: Record<string, string> = {
  "vp-management": "Management-Sicht",
  "vp-business-owner": "Business-Owner-Sicht",
  "vp-application-owner": "Application-Owner-Sicht",
  "vp-it-operations": "IT-Betriebssicht",
  "vp-full-architecture": "Vollständige Architektursicht"
};

const VIEWPOINT_PURPOSES: Record<string, string> = {
  "vp-management": "Schnelle Übersicht über geschäftskritische Architekturteile.",
  "vp-business-owner": "Geschäftsprozesse, Fähigkeiten und unterstützende Anwendungen verstehen.",
  "vp-application-owner": "Anwendungs-, Daten- und Technologieabhängigkeiten verstehen.",
  "vp-it-operations": "Technische Betriebsabhängigkeiten analysieren.",
  "vp-full-architecture": "Vollständige Sicht für Architektinnen und Architekten."
};

const CONNECTION_RULE_RATIONALES: Record<string, string> = {
  "rule-process-realizes-capability": "Geschäftsprozesse operationalisieren Business Capabilities.",
  "rule-application-serves-process": "Anwendungen sollen auf die Geschäftsprozesse zurückführbar sein, die sie unterstützen.",
  "rule-application-serves-capability": "Eine direkte Beziehung von Anwendung zu Capability ist für Management-Zusammenfassungen hilfreich.",
  "rule-application-uses-data-object": "Datenabhängigkeiten sollen für Governance und Verantwortlichkeiten sichtbar sein.",
  "rule-application-depends-technology": "Betriebsabhängigkeiten verbinden Anwendungen mit Laufzeit- oder Infrastrukturkomponenten.",
  "rule-application-depends-application": "Anwendungsabhängigkeiten sind wichtig für Auswirkungsanalysen.",
  "rule-data-depends-technology": "Datenobjekte können von Speicher- oder Plattformtechnologie abhängen.",
  "rule-technology-depends-technology": "Technologieabhängigkeiten unterstützen betriebliche Auswirkungsanalysen.",
  "rule-stakeholder-responsible-application": "Stakeholder sind modellierbare Elemente, damit Verantwortung direkt im Diagramm sichtbar ist.",
  "rule-stakeholder-responsible-capability": "Capability-Verantwortung hilft KMU, Zuständigkeiten explizit zu machen.",
  "rule-stakeholder-interested-goal": "Stakeholder-Interessen erklären, warum ein Ziel relevant ist.",
  "rule-stakeholder-interested-capability": "Management- und Business-Sichten profitieren von sichtbaren Stakeholder-Interessen.",
  "rule-org-owns-application": "Anwendungsverantwortung soll einer realen Organisationseinheit zugeordnet sein.",
  "rule-org-owns-process": "Prozessverantwortung hilft KMU, Zuständigkeiten explizit zu halten.",
  "rule-goal-supports-capability": "Ziele erklären die geschäftliche Absicht hinter Business Capabilities."
};

const VALIDATION_RULE_NAMES: Record<string, string> = {
  "vr-application-has-responsible-stakeholder": "Jede Anwendung braucht einen verantwortlichen Stakeholder",
  "vr-capability-realized-by-process": "Jede Business Capability soll realisiert werden",
  "vr-application-serves-process": "Jede Anwendung soll einen Geschäftsprozess bedienen",
  "vr-application-has-technology-dependency": "Jede Anwendung soll eine Technologieabhängigkeit haben"
};

const VALIDATION_RULE_MESSAGES: Record<string, string> = {
  "vr-application-has-responsible-stakeholder": "Eine Anwendung sollte mindestens einen verantwortlichen Stakeholder haben.",
  "vr-capability-realized-by-process": "Eine Business Capability sollte durch mindestens einen Geschäftsprozess realisiert werden.",
  "vr-application-serves-process": "Eine Anwendung sollte mindestens einen Geschäftsprozess bedienen.",
  "vr-application-has-technology-dependency": "Eine Anwendung sollte von mindestens einem Technologie-Knoten abhängen."
};

export function layerOf(type: ComponentType): string {
  if (type.layer) return type.layer;
  if (type.category === "BPMN") return "BPMN";
  if (type.category) return type.category;
  return "Other";
}

export function layerRank(layer: string): number {
  const index = LAYER_ORDER.indexOf(layer);
  return index === -1 ? 99 : index;
}

export function sortLayers(layers: Iterable<string>): string[] {
  return [...new Set(layers)].sort((a, b) => layerRank(a) - layerRank(b) || a.localeCompare(b));
}

export function displayLayerName(layer: string): string {
  if (layer === "Motivation") return "Motivation";
  if (layer === "Business") return "Business";
  if (layer === "Organization") return "Organisation";
  if (layer === "Application") return "Anwendung";
  if (layer === "Data") return "Daten";
  if (layer === "Technology") return "Technologie";
  if (layer === "Other") return "Sonstige";
  return layer;
}

export function displayTypeName(type: ComponentType | undefined, fallback = "Unbekannter Typ"): string {
  if (!type) return fallback;
  return TYPE_LABELS[type.id] ?? type.name;
}

export function displayTypeDescription(type: ComponentType): string {
  return TYPE_DESCRIPTIONS[type.id] ?? type.description ?? "Keine Beschreibung hinterlegt.";
}

export function displayConnectionName(type: ConnectionType | undefined, fallback = "unbekannte Beziehung"): string {
  if (!type) return fallback;
  return CONNECTION_LABELS[type.id] ?? type.name;
}

export function displayViewpointName(viewpoint: Viewpoint | undefined, fallback = "Alle Sichten"): string {
  if (!viewpoint) return fallback;
  return VIEWPOINT_LABELS[viewpoint.id] ?? viewpoint.name;
}

export function displayViewpointPurpose(viewpoint: Viewpoint | undefined, fallback = "Kein Zweck hinterlegt."): string {
  if (!viewpoint) return fallback;
  return VIEWPOINT_PURPOSES[viewpoint.id] ?? viewpoint.purpose ?? viewpoint.description ?? fallback;
}

export function displaySeverity(value: string): string {
  if (value === "error") return "Fehler";
  if (value === "warning") return "Warnung";
  return value;
}

export function yesNo(value: boolean): string {
  return value ? "Ja" : "Nein";
}

export function isBpmn(type: ComponentType): boolean {
  return layerOf(type) === "BPMN" || type.category === "BPMN";
}

export function compact(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

export function viewpointRuleFor(viewpoint: Viewpoint, state: SidebarState): ViewpointRule {
  const existing = state.viewpointRules.find((rule) => rule.viewpointId === viewpoint.id);
  if (existing) return existing;
  return {
    id: `derived-${viewpoint.id}`,
    viewpointId: viewpoint.id,
    allowedComponentTypeIds: viewpoint.allowedComponentTypeIds,
    allowedConnectionTypeIds: viewpoint.allowedConnectionTypeIds,
    allowedConnectionRuleIds: state.connectionRules
      .filter((rule) => !rule.viewpointIds || rule.viewpointIds.length === 0 || rule.viewpointIds.includes(viewpoint.id))
      .map((rule) => rule.id),
    requiredComponentTypeIds: viewpoint.requiredComponentTypeIds,
    requiredConnectionTypeIds: viewpoint.requiredConnectionTypeIds,
    requiredConnectionRuleIds: viewpoint.requiredConnectionRuleIds ?? [],
    visibleComponentTypeIds: viewpoint.allowedComponentTypeIds,
    description: "Aus alten Viewpoint-Feldern abgeleitet."
  };
}

export function ruleLabel(item: EdgeRule): string {
  return `${displayTypeName(item.sourceType)} -> ${displayConnectionName(item.connectionType)} -> ${displayTypeName(item.targetType)}`;
}

export function edgeLabel(edge: GraphEdge): string {
  return [...new Set(edge.connectionTypes.map((type) => displayConnectionName(type)))].join(", ");
}

export function displayRuleRationale(item: EdgeRule): string {
  return CONNECTION_RULE_RATIONALES[item.rule.id] ?? item.rule.rationale ?? item.rule.description ?? "Keine Begründung hinterlegt.";
}

export function displayValidationRuleName(rule: ValidationRule): string {
  return VALIDATION_RULE_NAMES[rule.id] ?? rule.name;
}

export function displayValidationRuleMessage(rule: ValidationRule): string {
  return VALIDATION_RULE_MESSAGES[rule.id] ?? rule.message;
}

export function isLegacyRule(rule: ConnectionRule): boolean {
  return rule.id.startsWith("legacy-rule-");
}

export function isSimplifiedRule(item: EdgeRule): boolean {
  return SIMPLIFIED_RULE_IDS.has(item.rule.id);
}

export function viewpointNames(ids: string[] | undefined, viewpoints: Viewpoint[]): string {
  return (ids ?? []).map((id) => displayViewpointName(viewpoints.find((vp) => vp.id === id), id)).join(", ") || "Alle";
}

export function validationRuleParts(rule: ValidationRule, componentTypes: ComponentType[], connectionTypes: ConnectionType[]): [string, string, string] {
  const source = displayTypeName(componentTypes.find((type) => type.id === rule.sourceComponentTypeId), rule.sourceComponentTypeId ?? "?");
  const relation = displayConnectionName(connectionTypes.find((type) => type.id === rule.requiredConnectionTypeId), rule.requiredConnectionTypeId ?? "?");
  const target = displayTypeName(componentTypes.find((type) => type.id === rule.targetComponentTypeId), rule.targetComponentTypeId ?? "?");
  return rule.direction === "incoming" ? [target, relation, source] : [source, relation, target];
}

export function validationRuleLabel(rule: ValidationRule, componentTypes: ComponentType[], connectionTypes: ConnectionType[]): string {
  return validationRuleParts(rule, componentTypes, connectionTypes).join(" -> ");
}

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
