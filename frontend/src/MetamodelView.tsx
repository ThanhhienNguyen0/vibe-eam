import { useMemo, useRef, useState } from "react";
import type { ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { Download, Upload } from "lucide-react";
import { sidebarApi } from "./Sidebar/sidebarApi";
import { getAllowedConnectionRules } from "./Sidebar/metamodelRules";
import type {
  ComponentType,
  ConnectionRule,
  ConnectionType,
  MetamodelImportResult,
  SidebarState,
  ValidationRule,
  Viewpoint,
  ViewpointRule
} from "./Sidebar/sidebarTypes";

interface Props {
  sidebarState: SidebarState;
  onStateChange: (state: SidebarState) => void;
}

interface EdgeRule {
  rule: ConnectionRule;
  connectionType: ConnectionType;
  sourceType: ComponentType;
  targetType: ComponentType;
}

type MetamodelTab = "overview" | "components" | "rules" | "viewpoints" | "validation" | "graph";
type SortKey = "source" | "connection";
type GraphMode = "simplified" | "detailed" | "viewpoint";
interface GraphEdge {
  id: string;
  sourceType: ComponentType;
  targetType: ComponentType;
  connectionTypes: ConnectionType[];
  rules: EdgeRule[];
}

type GraphSelection =
  | { kind: "node"; type: ComponentType }
  | { kind: "edge"; item: GraphEdge }
  | null;

const CORE_EAM_TYPE_IDS = new Set([
  "ct-stakeholder",
  "ct-goal",
  "ct-capability",
  "ct-proc",
  "ct-app",
  "ct-data-object",
  "ct-technology-node",
  "ct-org-unit"
]);

const SIMPLIFIED_RULE_IDS = new Set([
  "rule-stakeholder-interested-capability",
  "rule-stakeholder-responsible-application",
  "rule-goal-supports-capability",
  "rule-process-realizes-capability",
  "rule-application-serves-process",
  "rule-application-uses-data-object",
  "rule-application-depends-technology",
  "rule-org-owns-application"
]);

const SIMPLIFIED_POSITIONS: Record<string, { x: number; y: number }> = {
  "ct-goal": { x: 150, y: 130 },
  "ct-stakeholder": { x: 150, y: 430 },
  "ct-org-unit": { x: 150, y: 570 },
  "ct-capability": { x: 420, y: 185 },
  "ct-proc": { x: 420, y: 400 },
  "ct-app": { x: 700, y: 320 },
  "ct-data-object": { x: 980, y: 220 },
  "ct-technology-node": { x: 980, y: 455 }
};

const LAYER_ORDER = ["Motivation", "Business", "Organization", "Application", "Data", "Technology", "BPMN", "Other"];
const GRAPH_RULE_LIMIT = 50;

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

function layerOf(type: ComponentType): string {
  if (type.layer) return type.layer;
  if (type.category === "BPMN") return "BPMN";
  if (type.category) return type.category;
  return "Other";
}

function displayLayerName(layer: string): string {
  if (layer === "Motivation") return "Motivation";
  if (layer === "Business") return "Business";
  if (layer === "Organization") return "Organisation";
  if (layer === "Application") return "Anwendung";
  if (layer === "Data") return "Daten";
  if (layer === "Technology") return "Technologie";
  if (layer === "Other") return "Sonstige";
  return layer;
}

function displayTypeName(type: ComponentType | undefined, fallback = "Unbekannter Typ"): string {
  if (!type) return fallback;
  return TYPE_LABELS[type.id] ?? type.name;
}

function displayTypeDescription(type: ComponentType): string {
  return TYPE_DESCRIPTIONS[type.id] ?? type.description ?? "Keine Beschreibung hinterlegt.";
}

function displayConnectionName(type: ConnectionType | undefined, fallback = "unbekannte Beziehung"): string {
  if (!type) return fallback;
  return CONNECTION_LABELS[type.id] ?? type.name;
}

function displayViewpointName(viewpoint: Viewpoint | undefined, fallback = "Alle Sichten"): string {
  if (!viewpoint) return fallback;
  return VIEWPOINT_LABELS[viewpoint.id] ?? viewpoint.name;
}

function displayViewpointPurpose(viewpoint: Viewpoint | undefined, fallback = "Kein Zweck hinterlegt."): string {
  if (!viewpoint) return fallback;
  return VIEWPOINT_PURPOSES[viewpoint.id] ?? viewpoint.purpose ?? viewpoint.description ?? fallback;
}

function displaySeverity(value: string): string {
  if (value === "error") return "Fehler";
  if (value === "warning") return "Warnung";
  return value;
}

function yesNo(value: boolean): string {
  return value ? "Ja" : "Nein";
}

function isBpmn(type: ComponentType): boolean {
  return layerOf(type) === "BPMN" || type.category === "BPMN";
}

function compact(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}

function viewpointRuleFor(viewpoint: Viewpoint, state: SidebarState): ViewpointRule {
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

function ruleLabel(item: EdgeRule): string {
  return `${displayTypeName(item.sourceType)} -> ${displayConnectionName(item.connectionType)} -> ${displayTypeName(item.targetType)}`;
}

function edgeLabel(edge: GraphEdge): string {
  return [...new Set(edge.connectionTypes.map((type) => displayConnectionName(type)))].join(", ");
}

function displayRuleRationale(item: EdgeRule): string {
  return CONNECTION_RULE_RATIONALES[item.rule.id] ?? item.rule.rationale ?? item.rule.description ?? "Keine Begründung hinterlegt.";
}

function displayValidationRuleName(rule: ValidationRule): string {
  return VALIDATION_RULE_NAMES[rule.id] ?? rule.name;
}

function displayValidationRuleMessage(rule: ValidationRule): string {
  return VALIDATION_RULE_MESSAGES[rule.id] ?? rule.message;
}

function isLegacyRule(rule: ConnectionRule): boolean {
  return rule.id.startsWith("legacy-rule-");
}

function isSimplifiedRule(item: EdgeRule): boolean {
  return SIMPLIFIED_RULE_IDS.has(item.rule.id);
}

function downloadJson(data: unknown, filename: string): void {
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

function validationRuleLabel(rule: ValidationRule, componentTypes: ComponentType[], connectionTypes: ConnectionType[]): string {
  const source = displayTypeName(componentTypes.find((type) => type.id === rule.sourceComponentTypeId), rule.sourceComponentTypeId ?? "?");
  const relation = displayConnectionName(connectionTypes.find((type) => type.id === rule.requiredConnectionTypeId), rule.requiredConnectionTypeId ?? "?");
  const target = displayTypeName(componentTypes.find((type) => type.id === rule.targetComponentTypeId), rule.targetComponentTypeId ?? "?");
  return rule.direction === "incoming"
    ? `${target} -> ${relation} -> ${source}`
    : `${source} -> ${relation} -> ${target}`;
}

export default function MetamodelView({ sidebarState, onStateChange }: Props) {
  const { componentTypes, connectionTypes, connectionRules, viewpoints, viewpointRules, validationRules } = sidebarState;
  const explicitConnectionRules = useMemo(() => connectionRules.filter((rule) => !isLegacyRule(rule)), [connectionRules]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<MetamodelTab>("overview");
  const [viewpointId, setViewpointId] = useState("all");
  const [layerFilter, setLayerFilter] = useState("all");
  const [connectionTypeFilter, setConnectionTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showOnlySelectedViewpoint, setShowOnlySelectedViewpoint] = useState(true);
  const [showValidationRules, setShowValidationRules] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("source");
  const [graphSelection, setGraphSelection] = useState<GraphSelection>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>("simplified");
  const [graphNodeOverrides, setGraphNodeOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [presentationMode, setPresentationMode] = useState(false);
  const [metamodelActionMessage, setMetamodelActionMessage] = useState("");
  const [metamodelActionError, setMetamodelActionError] = useState("");
  const [lastImportResult, setLastImportResult] = useState<MetamodelImportResult | null>(null);

  const selectedViewpoint = viewpointId === "all" ? undefined : viewpoints.find((viewpoint) => viewpoint.id === viewpointId);
  const selectedViewpointRule = selectedViewpoint ? viewpointRuleFor(selectedViewpoint, sidebarState) : undefined;
  const normalizedSearch = search.trim().toLowerCase();

  const layers = useMemo(
    () => [...new Set(componentTypes.map(layerOf))]
      .sort((a, b) => (LAYER_ORDER.indexOf(a) === -1 ? 99 : LAYER_ORDER.indexOf(a)) - (LAYER_ORDER.indexOf(b) === -1 ? 99 : LAYER_ORDER.indexOf(b))),
    [componentTypes]
  );

  const edgeRules = useMemo<EdgeRule[]>(() => {
    const viewpoint = selectedViewpoint && showOnlySelectedViewpoint ? selectedViewpoint.id : undefined;
    return explicitConnectionRules.flatMap((rule) => {
      if (connectionTypeFilter !== "all" && rule.connectionTypeId !== connectionTypeFilter) return [];
      const sourceType = componentTypes.find((type) => type.id === rule.sourceComponentTypeId);
      const targetType = componentTypes.find((type) => type.id === rule.targetComponentTypeId);
      const connectionType = connectionTypes.find((type) => type.id === rule.connectionTypeId);
      if (!sourceType || !targetType || !connectionType) return [];
      if (layerFilter !== "all" && layerOf(sourceType) !== layerFilter) return [];
      if (viewpoint) {
        const allowed = getAllowedConnectionRules(sidebarState, sourceType.id, targetType.id, viewpoint);
        if (!allowed.some((item) => item.id === rule.id)) return [];
      }
      if (normalizedSearch) {
        const haystack = `${sourceType.name} ${targetType.name} ${connectionType.name} ${rule.description} ${rule.rationale}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return [];
      }
      return [{ rule, sourceType, targetType, connectionType }];
    }).sort((a, b) => {
      if (sortKey === "connection") {
        return a.connectionType.name.localeCompare(b.connectionType.name) || a.sourceType.name.localeCompare(b.sourceType.name);
      }
      return a.sourceType.name.localeCompare(b.sourceType.name) || a.connectionType.name.localeCompare(b.connectionType.name);
    });
  }, [componentTypes, explicitConnectionRules, connectionTypeFilter, connectionTypes, layerFilter, normalizedSearch, selectedViewpoint, showOnlySelectedViewpoint, sidebarState, sortKey]);

  const componentTypeStats = useMemo(() => {
    return new Map(componentTypes.map((type) => {
      const ruleCount = explicitConnectionRules.filter((rule) => rule.sourceComponentTypeId === type.id || rule.targetComponentTypeId === type.id).length;
      const viewpointCount = viewpointRules.filter((rule) => rule.allowedComponentTypeIds.includes(type.id)).length;
      return [type.id, { ruleCount, viewpointCount }];
    }));
  }, [componentTypes, explicitConnectionRules, viewpointRules]);

  const filteredComponentTypes = useMemo(() => componentTypes.filter((type) => {
    if (selectedViewpointRule && showOnlySelectedViewpoint && selectedViewpointRule.allowedComponentTypeIds.length > 0 && !selectedViewpointRule.allowedComponentTypeIds.includes(type.id)) return false;
    if (layerFilter !== "all" && layerOf(type) !== layerFilter) return false;
    if (normalizedSearch && !`${type.name} ${type.description} ${layerOf(type)}`.toLowerCase().includes(normalizedSearch)) return false;
    return true;
  }), [componentTypes, layerFilter, normalizedSearch, selectedViewpointRule, showOnlySelectedViewpoint]);

  const groupedComponentTypes = useMemo(() => {
    const groups = new Map<string, ComponentType[]>();
    for (const type of filteredComponentTypes) {
      const layer = layerOf(type);
      groups.set(layer, [...(groups.get(layer) ?? []), type]);
    }
    return [...groups.entries()].sort((a, b) => {
      const aIndex = LAYER_ORDER.indexOf(a[0]);
      const bIndex = LAYER_ORDER.indexOf(b[0]);
      return (aIndex === -1 ? 99 : aIndex) - (bIndex === -1 ? 99 : bIndex) || a[0].localeCompare(b[0]);
    });
  }, [filteredComponentTypes]);

  const visibleViewpointRules = selectedViewpoint && showOnlySelectedViewpoint
    ? viewpointRules.filter((rule) => rule.viewpointId === selectedViewpoint.id)
    : viewpointRules;

  const visibleValidationRules = validationRules.filter((rule) => {
    if (!showValidationRules) return false;
    if (selectedViewpoint && showOnlySelectedViewpoint && rule.scope === "viewpoint" && rule.viewpointId !== selectedViewpoint.id) return false;
    if (normalizedSearch && !`${rule.name} ${rule.description} ${rule.message}`.toLowerCase().includes(normalizedSearch)) return false;
    return true;
  });

  const graphBaseRules = useMemo(() => {
    if (graphMode === "viewpoint" && !selectedViewpoint) return [];
    let rules = edgeRules;
    if (graphMode === "viewpoint" && selectedViewpoint) {
      rules = rules.filter((item) => getAllowedConnectionRules(sidebarState, item.sourceType.id, item.targetType.id, selectedViewpoint.id)
        .some((rule) => rule.id === item.rule.id));
    }
    if (graphMode === "simplified") {
      rules = rules.filter((item) => isSimplifiedRule(item));
    }
    return rules;
  }, [edgeRules, graphMode, selectedViewpoint, sidebarState]);

  const graphComponentTypes = useMemo(() => {
    const idsFromRules = new Set(graphBaseRules.flatMap((item) => [item.sourceType.id, item.targetType.id]));
    return componentTypes.filter((type) => {
      if (!idsFromRules.has(type.id)) return false;
      if (layerFilter !== "BPMN" && isBpmn(type)) return false;
      return true;
    });
  }, [componentTypes, graphBaseRules, layerFilter]);

  const graphTypeIds = new Set(graphComponentTypes.map((type) => type.id));
  const graphRules = graphBaseRules.filter((item) => graphTypeIds.has(item.sourceType.id) && graphTypeIds.has(item.targetType.id));
  const graphTooDense = graphMode !== "simplified" && graphRules.length > GRAPH_RULE_LIMIT;
  const graphEdges = useMemo<GraphEdge[]>(() => {
    const visibleRules = graphRules;
    const grouped = new Map<string, GraphEdge>();
    for (const item of visibleRules.filter((rule) => rule.sourceType.id !== rule.targetType.id)) {
      const id = `${item.sourceType.id}->${item.targetType.id}`;
      const current = grouped.get(id);
      if (!current) {
        grouped.set(id, {
          id,
          sourceType: item.sourceType,
          targetType: item.targetType,
          connectionTypes: [item.connectionType],
          rules: [item]
        });
        continue;
      }
      if (!current.connectionTypes.some((type) => type.name === item.connectionType.name)) {
        current.connectionTypes.push(item.connectionType);
      }
      current.rules.push(item);
    }
    return [...grouped.values()].sort((a, b) => a.sourceType.name.localeCompare(b.sourceType.name) || a.targetType.name.localeCompare(b.targetType.name));
  }, [graphRules]);

  const graphPositions = useMemo(() => {
    const columnFor = (type: ComponentType): number => {
      const layer = layerOf(type);
      if (type.id === "ct-stakeholder" || layer === "Motivation") return 0;
      if (layer === "Business" || layer === "Organization") return 1;
      if (layer === "Application") return 2;
      if (layer === "Data") return 3;
      if (layer === "Technology") return 4;
      return 5;
    };
    const grouped = new Map<number, ComponentType[]>();
    for (const type of graphComponentTypes) {
      const col = columnFor(type);
      grouped.set(col, [...(grouped.get(col) ?? []), type]);
    }
    const positions = new Map<string, { x: number; y: number }>();
    if (graphMode === "simplified") {
      for (const type of graphComponentTypes) {
        positions.set(type.id, SIMPLIFIED_POSITIONS[type.id] ?? { x: 620, y: 330 });
      }
      for (const [typeId, position] of Object.entries(graphNodeOverrides)) {
        if (positions.has(typeId)) positions.set(typeId, position);
      }
      return positions;
    }
    for (const [col, types] of grouped.entries()) {
      const sorted = [...types].sort((a, b) => a.name.localeCompare(b.name));
      const gap = 128;
      const startY = 96 + Math.max(0, 4 - sorted.length) * 34;
      sorted.forEach((type, index) => {
        positions.set(type.id, { x: 120 + col * 220, y: startY + index * gap });
      });
    }
    for (const [typeId, position] of Object.entries(graphNodeOverrides)) {
      if (positions.has(typeId)) positions.set(typeId, position);
    }
    return positions;
  }, [graphComponentTypes, graphMode, graphNodeOverrides]);

  const selectedEdge = graphSelection?.kind === "edge" ? graphSelection.item : null;
  const selectedNode = graphSelection?.kind === "node" ? graphSelection.type : null;

  async function handleExportMetamodel(defaultDefinition = false) {
    setMetamodelActionError("");
    setMetamodelActionMessage("");
    setLastImportResult(null);
    try {
      const definition = defaultDefinition
        ? await sidebarApi.getDefaultMetamodel()
        : await sidebarApi.exportMetamodel();
      const safeName = definition.metamodel.id || "eam-metamodel";
      const safeVersion = definition.metamodel.version || "v1";
      downloadJson(definition, defaultDefinition ? "default-eam-metamodel.json" : `${safeName}-${safeVersion}.json`);
      setMetamodelActionMessage(defaultDefinition ? "Default-EAM-Metamodell heruntergeladen." : "Metamodell als JSON exportiert.");
    } catch (error) {
      setMetamodelActionError(error instanceof Error ? error.message : "Export des Metamodells fehlgeschlagen.");
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setMetamodelActionError("");
    setMetamodelActionMessage("");
    setLastImportResult(null);
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as unknown;
      const result = await sidebarApi.importMetamodel(parsed);
      setLastImportResult(result);
      if (result.success) {
        const nextState = await sidebarApi.getAll();
        onStateChange(nextState);
        setMetamodelActionMessage(`Metamodell-JSON importiert: ${result.importedCounts.componentTypes} Komponententypen, ${result.importedCounts.connectionRules} Verbindungsregeln.`);
      }
    } catch (error) {
      setMetamodelActionError(error instanceof Error ? error.message : "Import des Metamodells fehlgeschlagen.");
    }
  }

  return (
    <div className="metamodel-view metamodel-view--structured">
      <header className="metamodel-page-header">
        <div>
          <h2>Metamodell</h2>
          <p>Legt fest, welche Komponenten, Verbindungen und Stakeholder-Sichten beim Diagrammbau erlaubt sind.</p>
        </div>
        <div className="metamodel-header-actions">
          <span>Metamodell-JSON enthält Regeln, Typen und Sichten. Es enthält keine konkreten Diagramme.</span>
          <div>
            <button type="button" onClick={() => handleExportMetamodel(false)}>
              <Download size={15} /> Metamodell exportieren
            </button>
            <button type="button" onClick={() => importInputRef.current?.click()}>
              <Upload size={15} /> Metamodell importieren
            </button>
            <button type="button" onClick={() => handleExportMetamodel(true)}>
              <Download size={15} /> Default-EAM-Metamodell herunterladen
            </button>
          </div>
          <input ref={importInputRef} type="file" accept="application/json,.json" onChange={handleImportFile} hidden />
        </div>
        <div className="metamodel-kpis">
          <Metric label="Komponententypen" value={componentTypes.length} />
          <Metric label="Verbindungsregeln" value={explicitConnectionRules.length} />
          <Metric label="Sichtregeln" value={viewpointRules.length} />
          <Metric label="Prüfregeln" value={validationRules.length} />
        </div>
      </header>
      {(metamodelActionMessage || metamodelActionError || lastImportResult) && (
        <section className={`metamodel-import-status${metamodelActionError ? " error" : ""}`}>
          {metamodelActionMessage && <strong>{metamodelActionMessage}</strong>}
          {metamodelActionError && <strong>{metamodelActionError}</strong>}
          {lastImportResult && (
            <div>
              <span>{lastImportResult.success ? "Import angenommen" : "Import blockiert"}</span>
              {lastImportResult.errors.map((item) => <p key={`${item.code}-${item.path ?? item.message}`}>{item.message}</p>)}
              {lastImportResult.warnings.map((item) => <p key={`${item.code}-${item.path ?? item.message}`}>Warnung: {item.message}</p>)}
            </div>
          )}
        </section>
      )}

      <section className="metamodel-controls" aria-label="Metamodell-Filter">
        <label>
          Sicht
          <select value={viewpointId} onChange={(e) => setViewpointId(e.target.value)}>
            <option value="all">Alle Sichten</option>
            {viewpoints.map((viewpoint) => <option key={viewpoint.id} value={viewpoint.id}>{displayViewpointName(viewpoint)}</option>)}
          </select>
        </label>
        <label>
          Layer
          <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value)}>
            <option value="all">Alle Layer, BPMN im Graph ausgeblendet</option>
            {layers.map((layer) => <option key={layer} value={layer}>{displayLayerName(layer)}</option>)}
          </select>
        </label>
        <label>
          Verbindungstyp
          <select value={connectionTypeFilter} onChange={(e) => setConnectionTypeFilter(e.target.value)}>
            <option value="all">Alle Verbindungstypen</option>
            {connectionTypes.map((type) => <option key={type.id} value={type.id}>{displayConnectionName(type)}</option>)}
          </select>
        </label>
        <label>
          Suche
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Typen, Regeln, Begründungen suchen" />
        </label>
        <label className="metamodel-toggle">
          <input type="checkbox" checked={showOnlySelectedViewpoint} onChange={(e) => setShowOnlySelectedViewpoint(e.target.checked)} disabled={!selectedViewpoint} />
          Nur gewählte Sicht
        </label>
        <label className="metamodel-toggle">
          <input type="checkbox" checked={showValidationRules} onChange={(e) => setShowValidationRules(e.target.checked)} />
          Prüfregeln anzeigen
        </label>
      </section>

      <nav className="metamodel-tabs" aria-label="Metamodell-Bereiche">
        {[
          ["overview", "Überblick"],
          ["components", "Komponententypen"],
          ["rules", "Verbindungsregeln"],
          ["viewpoints", "Sichten"],
          ["validation", "Prüfregeln"],
          ["graph", "Regelgrafik"]
        ].map(([id, label]) => (
          <button key={id} className={activeTab === id ? "active" : ""} onClick={() => setActiveTab(id as MetamodelTab)}>{label}</button>
        ))}
      </nav>

      <main className="metamodel-tab-panel">
        {activeTab === "overview" && (
          <OverviewTab viewpoints={viewpoints} selectedViewpoint={selectedViewpoint} />
        )}

        {activeTab === "components" && (
          <ComponentTypesTab groups={groupedComponentTypes} stats={componentTypeStats} />
        )}

        {activeTab === "rules" && (
          <ConnectionRulesTab
            rules={edgeRules}
            viewpoints={viewpoints}
            sortKey={sortKey}
            onSortChange={setSortKey}
          />
        )}

        {activeTab === "viewpoints" && (
          <ViewpointsTab
            viewpoints={viewpoints}
            viewpointRules={visibleViewpointRules}
            componentTypes={componentTypes}
            connectionRules={explicitConnectionRules}
            validationRules={visibleValidationRules}
            connectionTypes={connectionTypes}
          />
        )}

        {activeTab === "validation" && (
          <ValidationRulesTab
            rules={visibleValidationRules}
            componentTypes={componentTypes}
            connectionTypes={connectionTypes}
            hidden={!showValidationRules}
          />
        )}

        {activeTab === "graph" && (
          <RuleGraphTab
            componentTypes={graphComponentTypes}
            edges={graphEdges}
            ruleCatalog={graphRules}
            tooDense={graphTooDense}
            positions={graphPositions}
            selection={graphSelection}
            onSelect={setGraphSelection}
            selectedNode={selectedNode}
            selectedEdge={selectedEdge}
            viewpoints={viewpoints}
            mode={graphMode}
            onModeChange={(mode) => {
              setGraphMode(mode);
              setGraphSelection(null);
              setGraphNodeOverrides({});
            }}
            selectedViewpoint={selectedViewpoint}
            presentationMode={presentationMode}
            onPresentationModeChange={setPresentationMode}
            onMoveNode={(typeId, position) => setGraphNodeOverrides((current) => ({ ...current, [typeId]: position }))}
            onResetLayout={() => setGraphNodeOverrides({})}
          />
        )}
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metamodel-kpi">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function OverviewTab({ viewpoints, selectedViewpoint }: { viewpoints: Viewpoint[]; selectedViewpoint?: Viewpoint }) {
  return (
    <section className="metamodel-overview">
      <div className="metamodel-explain">
        <h3>Zusammenfassung</h3>
        <p>Ein Metamodell begrenzt den Diagrammbau: Es definiert erlaubte Komponententypen, erlaubte Verbindungsregeln und rollenbezogene Sichten.</p>
      </div>
      <div className="metamodel-example-grid">
        <article>
          <span className="metamodel-eyebrow">Beispiel-Regel</span>
          <strong>Anwendung &rarr; bedient &rarr; Geschäftsprozess</strong>
          <p>Verbindungsregel: Diese Beziehung auf Typebene ist erlaubt.</p>
        </article>
        <article>
          <span className="metamodel-eyebrow">Konkrete Diagramminstanz</span>
          <strong>ERP System &rarr; bedient &rarr; Order to Cash</strong>
          <p>Konkrete Verbindung: Diese Beziehung im Diagramm ist gültig, weil eine passende Regel existiert.</p>
        </article>
      </div>
      <section>
        <h3>{selectedViewpoint ? "Gewählte Sicht" : "Stakeholder-Sichten"}</h3>
        <div className="metamodel-viewpoint-list">
          {(selectedViewpoint ? [selectedViewpoint] : viewpoints).map((viewpoint) => (
            <article key={viewpoint.id} className="metamodel-viewpoint-card">
              <strong>{displayViewpointName(viewpoint)}</strong>
              <span>{viewpoint.stakeholderRole}</span>
              <p>{displayViewpointPurpose(viewpoint)}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function ComponentTypesTab({ groups, stats }: { groups: [string, ComponentType[]][]; stats: Map<string, { ruleCount: number; viewpointCount: number }> }) {
  if (groups.length === 0) return <EmptyHint text="Keine Komponententypen passen zu den aktuellen Filtern." />;
  return (
    <div className="metamodel-component-groups">
      {groups.map(([layer, types]) => (
        <section key={layer} className="metamodel-layer-group">
          <h3>{displayLayerName(layer)}</h3>
          <div className="metamodel-component-grid">
            {types.map((type) => {
              const stat = stats.get(type.id);
              return (
                <article key={type.id} className="metamodel-component-card" style={{ borderLeftColor: type.color }}>
                  <div>
                    <strong>{displayTypeName(type)}</strong>
                    <span>{displayLayerName(layerOf(type))}</span>
                  </div>
                  <p>{compact(displayTypeDescription(type), 105)}</p>
                  <footer>
                    <span>{stat?.ruleCount ?? 0} Regeln</span>
                    <span>{stat?.viewpointCount ?? 0} Sichten</span>
                  </footer>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function ConnectionRulesTab({ rules, viewpoints, sortKey, onSortChange }: {
  rules: EdgeRule[];
  viewpoints: Viewpoint[];
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
}) {
  if (rules.length === 0) return <EmptyHint text="Keine Verbindungsregeln passen zu den aktuellen Filtern." />;
  return (
    <section className="metamodel-table-section">
      <div className="metamodel-table-toolbar">
        <span>{rules.length} passende Verbindungsregeln</span>
        <label>
          Sortierung
          <select value={sortKey} onChange={(e) => onSortChange(e.target.value as SortKey)}>
            <option value="source">Quelltyp</option>
            <option value="connection">Verbindungstyp</option>
          </select>
        </label>
      </div>
      <div className="metamodel-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quelle</th>
              <th>Beziehung</th>
              <th>Ziel</th>
              <th>Pflicht</th>
              <th>Schweregrad</th>
              <th>Sichten</th>
              <th>Begründung</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((item) => (
              <tr key={item.rule.id}>
                <td>{displayTypeName(item.sourceType)}</td>
                <td><strong style={{ color: item.connectionType.color }}>{displayConnectionName(item.connectionType)}</strong></td>
                <td>{displayTypeName(item.targetType)}</td>
                <td>{item.rule.required ? "Ja" : "Nein"}</td>
                <td>{displaySeverity(item.rule.severity)}</td>
                <td>{(item.rule.viewpointIds ?? []).map((id) => displayViewpointName(viewpoints.find((vp) => vp.id === id), id)).join(", ") || "Alle"}</td>
                <td>{compact(displayRuleRationale(item), 140)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ViewpointsTab({ viewpoints, viewpointRules, componentTypes, connectionRules, validationRules, connectionTypes }: {
  viewpoints: Viewpoint[];
  viewpointRules: ViewpointRule[];
  componentTypes: ComponentType[];
  connectionRules: ConnectionRule[];
  validationRules: ValidationRule[];
  connectionTypes: ConnectionType[];
}) {
  return (
    <section className="metamodel-viewpoints-tab">
      <div className="metamodel-info-strip">Eine Sicht ist ein Rollenfilter. Ein Stakeholder bleibt ein modellierbares Element im Diagramm.</div>
      <div className="metamodel-viewpoint-list">
        {viewpointRules.map((rule) => {
          const viewpoint = viewpoints.find((item) => item.id === rule.viewpointId);
          const relevantValidationRules = validationRules.filter((item) => item.scope === "metamodel" || item.viewpointId === rule.viewpointId);
          return (
            <article key={rule.id} className="metamodel-viewpoint-card">
              <strong>{displayViewpointName(viewpoint, rule.viewpointId)}</strong>
              <span>{viewpoint?.stakeholderRole ?? "Unbekannte Rolle"}</span>
              <p>{displayViewpointPurpose(viewpoint, rule.description || "Kein Zweck hinterlegt.")}</p>
              <dl>
                <dt>Erlaubte Komponententypen</dt>
                <dd>{rule.allowedComponentTypeIds.map((id) => displayTypeName(componentTypes.find((type) => type.id === id), id)).join(", ") || "Keine"}</dd>
                <dt>Erlaubte Verbindungsregeln</dt>
                <dd>{rule.allowedConnectionRuleIds.length || connectionRules.filter((item) => item.viewpointIds?.includes(rule.viewpointId)).length}</dd>
                <dt>Pflicht-Komponententypen</dt>
                <dd>{rule.requiredComponentTypeIds.map((id) => displayTypeName(componentTypes.find((type) => type.id === id), id)).join(", ") || "Keine"}</dd>
                <dt>Pflicht-Verbindungsregeln</dt>
                <dd>{rule.requiredConnectionRuleIds.length || "Keine"}</dd>
                <dt>Prüfregeln</dt>
                <dd>{relevantValidationRules.map((item) => validationRuleLabel(item, componentTypes, connectionTypes)).join("; ") || "Keine"}</dd>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ValidationRulesTab({ rules, componentTypes, connectionTypes, hidden }: {
  rules: ValidationRule[];
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  hidden: boolean;
}) {
  if (hidden) return <EmptyHint text="Prüfregeln sind ausgeblendet. Aktiviere 'Prüfregeln anzeigen' in der Filterleiste." />;
  if (rules.length === 0) return <EmptyHint text="Keine Prüfregeln passen zu den aktuellen Filtern." />;
  return (
    <div className="metamodel-validation-grid">
      {rules.map((rule) => (
        <article key={rule.id} className="metamodel-validation-card">
          <div>
            <strong>{displayValidationRuleName(rule)}</strong>
            <span>{rule.scope === "metamodel" ? "Metamodell" : "Sicht"} / {displaySeverity(rule.severity)} / {rule.active ? "aktiv" : "inaktiv"}</span>
          </div>
          <p>{validationRuleLabel(rule, componentTypes, connectionTypes)}</p>
          <small>{displayValidationRuleMessage(rule)}</small>
        </article>
      ))}
    </div>
  );
}

function RuleGraphTab({
  componentTypes,
  edges,
  ruleCatalog,
  tooDense,
  positions,
  selection,
  onSelect,
  selectedNode,
  selectedEdge,
  viewpoints,
  mode,
  onModeChange,
  selectedViewpoint,
  presentationMode,
  onPresentationModeChange,
  onMoveNode,
  onResetLayout
}: {
  componentTypes: ComponentType[];
  edges: GraphEdge[];
  ruleCatalog: EdgeRule[];
  tooDense: boolean;
  positions: Map<string, { x: number; y: number }>;
  selection: GraphSelection;
  onSelect: (value: GraphSelection) => void;
  selectedNode: ComponentType | null;
  selectedEdge: GraphEdge | null;
  viewpoints: Viewpoint[];
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  selectedViewpoint?: Viewpoint;
  presentationMode: boolean;
  onPresentationModeChange: (value: boolean) => void;
  onMoveNode: (typeId: string, position: { x: number; y: number }) => void;
  onResetLayout: () => void;
}) {
  const dragRef = useRef<{ typeId: string; dx: number; dy: number } | null>(null);
  const selfRuleCount = ruleCatalog.filter((item) => item.sourceType.id === item.targetType.id).length;
  const incomingCount = selectedNode
    ? edges.filter((edge) => edge.targetType.id === selectedNode.id).reduce((sum, edge) => sum + edge.rules.length, 0)
    : 0;
  const outgoingCount = selectedNode
    ? edges.filter((edge) => edge.sourceType.id === selectedNode.id).reduce((sum, edge) => sum + edge.rules.length, 0)
    : 0;
  const nodeViewpoints = selectedNode
    ? viewpoints.filter((viewpoint) => viewpoint.allowedComponentTypeIds.includes(selectedNode.id))
    : [];

  function getSvgPoint(event: ReactPointerEvent<SVGSVGElement | SVGGElement>): { x: number; y: number } | null {
    const svg = event.currentTarget instanceof SVGSVGElement
      ? event.currentTarget
      : event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM()?.inverse();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const transformed = point.matrixTransform(matrix);
    return { x: transformed.x, y: transformed.y };
  }

  function startDrag(event: ReactPointerEvent<SVGGElement>, typeId: string) {
    const pos = positions.get(typeId);
    const point = getSvgPoint(event);
    if (!pos || !point) return;
    event.stopPropagation();
    dragRef.current = { typeId, dx: point.x - pos.x, dy: point.y - pos.y };
    event.currentTarget.setPointerCapture(event.pointerId);
    const type = componentTypes.find((item) => item.id === typeId);
    if (type) onSelect({ kind: "node", type });
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const point = getSvgPoint(event);
    if (!point) return;
    onMoveNode(dragRef.current.typeId, {
      x: Math.max(90, Math.min(1130, point.x - dragRef.current.dx)),
      y: Math.max(70, Math.min(630, point.y - dragRef.current.dy))
    });
  }

  function stopDrag() {
    dragRef.current = null;
  }

  return (
    <section className="metamodel-graph-tab">
      <div className="metamodel-graph-toolbar">
        <label>
          Darstellungsmodus
          <select value={mode} onChange={(event) => onModeChange(event.target.value as GraphMode)}>
            <option value="simplified">Vereinfachte Kernansicht</option>
            <option value="detailed">Detailansicht</option>
            <option value="viewpoint">Sichtbezogen</option>
          </select>
        </label>
        <label className="metamodel-toggle">
          <input type="checkbox" checked={presentationMode} onChange={(event) => onPresentationModeChange(event.target.checked)} />
          Präsentationsmodus
        </label>
        <button type="button" onClick={onResetLayout}>Layout zurücksetzen</button>
        <span>
          {mode === "simplified" && "Kuratierte EAM-Kernansicht. Knoten können verschoben werden."}
          {mode === "detailed" && "Die Grafik gruppiert Beziehungen; der Regelkatalog darunter zeigt alle gefilterten Regeln vollständig."}
          {mode === "viewpoint" && (selectedViewpoint ? `Regeln für ${displayViewpointName(selectedViewpoint)}.` : "Wähle eine Sicht, um sichtbezogene Einschränkungen zu prüfen.")}
        </span>
      </div>
      {mode === "simplified" && (
        <div className="metamodel-graph-note">
          Die vereinfachte Ansicht zeigt die kuratierten Kernregeln und blendet Selbstbezüge aus. Die Detailansicht zeigt den vollständigen Regelkatalog.
        </div>
      )}
      {mode !== "simplified" && (
        <div className="metamodel-graph-coverage">
          <span><strong>{ruleCatalog.length}</strong> gefilterte Regeln im Katalog</span>
          <span><strong>{edges.length}</strong> gruppierte Kanten in der Grafik</span>
          <span><strong>{selfRuleCount}</strong> Selbstbezüge</span>
        </div>
      )}
      {mode === "viewpoint" && !selectedViewpoint && <EmptyHint text="Wähle eine Sicht, um sichtbezogene Einschränkungen zu prüfen." />}
      {(componentTypes.length === 0 || edges.length === 0) && !(mode === "viewpoint" && !selectedViewpoint) && (
        <EmptyHint text="Keine Verbindungsregeln passen zu den aktuellen Filtern." />
      )}
      {tooDense && (
        <div className="metamodel-warning">Viele Regeln für eine einzelne Grafik. Die Grafik gruppiert alle sichtbaren Quelle-Ziel-Paare; der Regelkatalog darunter bleibt vollständig und einzeln lesbar.</div>
      )}
      {componentTypes.length > 0 && edges.length > 0 && (
      <div className={`metamodel-graph-layout${presentationMode ? " presentation" : ""}`}>
        <div className="metamodel-graph-canvas">
          <svg
            viewBox="0 0 1240 700"
            role="img"
            onPointerMove={handlePointerMove}
            onPointerUp={stopDrag}
            onPointerLeave={stopDrag}
          >
            <defs>
              <marker id="metamodel-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                <path d="M0,0 L0,6 L9,3 z" fill="#475569" />
              </marker>
            </defs>
            {edges.map((edge, index) => {
              const source = positions.get(edge.sourceType.id);
              const target = positions.get(edge.targetType.id);
              if (!source || !target) return null;
              const color = edge.connectionTypes[0]?.color ?? "#475569";
              const lineStyle = edge.connectionTypes.length === 1 ? edge.connectionTypes[0]?.lineStyle : "solid";
              const required = edge.rules.some((item) => item.rule.required);
              const selected = selection?.kind === "edge" && selection.item.id === edge.id;
              const bend = index % 4 === 0 ? -40 : index % 4 === 1 ? -12 : index % 4 === 2 ? 24 : 54;
              const midX = (source.x + target.x) / 2;
              const midY = (source.y + target.y) / 2 + bend;
              const label = compact(edgeLabel(edge), mode === "detailed" ? 24 : 34);
              const labelWidth = Math.min(190, Math.max(70, label.length * 6.5 + 18));
              const startX = source.x + (source.x <= target.x ? 96 : -96);
              const endX = target.x + (source.x <= target.x ? -96 : 96);
              const controlX1 = startX + (endX - startX) * 0.42;
              const controlX2 = startX + (endX - startX) * 0.58;
              const path = `M ${startX} ${source.y} C ${controlX1} ${source.y + bend}, ${controlX2} ${target.y + bend}, ${endX} ${target.y}`;
              const labelX = midX;
              const labelY = midY - 9;
              return (
                <g key={edge.id} className="metamodel-graph-edge" onClick={() => onSelect({ kind: "edge", item: edge })}>
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={required ? "2.7" : "1.8"}
                    strokeDasharray={lineStyle === "dashed" ? "7 5" : lineStyle === "dotted" ? "2 5" : undefined}
                    markerEnd="url(#metamodel-arrow)"
                    opacity={selected ? "0.95" : "0.55"}
                  />
                  <rect x={labelX - labelWidth / 2} y={labelY - 15} width={labelWidth} height="22" rx="5" className="metamodel-edge-label-bg" />
                  <text x={labelX} y={labelY} textAnchor="middle" className="metamodel-edge-label">{label}</text>
                </g>
              );
            })}
            {componentTypes.map((type) => {
              const pos = positions.get(type.id);
              if (!pos) return null;
              return (
                <g
                  key={type.id}
                  onPointerDown={(event) => startDrag(event, type.id)}
                  onClick={() => onSelect({ kind: "node", type })}
                  className="metamodel-graph-node"
                >
                  <rect x={pos.x - 94} y={pos.y - 34} width="188" height="68" rx="8" fill="#ffffff" stroke={type.color} strokeWidth="3" />
                  <text x={pos.x} y={pos.y - 4} textAnchor="middle" className="metamodel-node-title">{displayTypeName(type)}</text>
                  <text x={pos.x} y={pos.y + 15} textAnchor="middle" className="metamodel-node-subtitle">{displayLayerName(layerOf(type))}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <aside className="metamodel-graph-detail">
          {!selectedNode && !selectedEdge && (
            <>
              <h3>Regelgrafik</h3>
              <p>Wähle einen Knoten oder eine Kante, um Details zu sehen. Die Grafik erklärt die Struktur, der Katalog darunter zeigt alle Regeln.</p>
              <span className="muted">BPMN-Typen sind standardmäßig ausgeblendet. Wähle Layer BPMN, um sie zu prüfen.</span>
            </>
          )}
          {selectedNode && (
            <>
              <h3>{displayTypeName(selectedNode)}</h3>
              <span>{displayLayerName(layerOf(selectedNode))}</span>
              <p>{displayTypeDescription(selectedNode)}</p>
              <dl>
                <dt>Eingehende Regeln</dt>
                <dd>{incomingCount}</dd>
                <dt>Ausgehende Regeln</dt>
                <dd>{outgoingCount}</dd>
                <dt>Erlaubte Sichten</dt>
                <dd>{nodeViewpoints.map((viewpoint) => displayViewpointName(viewpoint)).join(", ") || "Keine"}</dd>
              </dl>
            </>
          )}
          {selectedEdge && (
            <>
              <h3>{displayTypeName(selectedEdge.sourceType)} &rarr; {displayTypeName(selectedEdge.targetType)}</h3>
              <span>{edgeLabel(selectedEdge)}</span>
              <p>{selectedEdge.rules.map(displayRuleRationale).slice(0, 2).join(" ") || "Keine Begründung hinterlegt."}</p>
              <dl>
                <dt>Regeln</dt>
                <dd>{selectedEdge.rules.map(ruleLabel).join("; ")}</dd>
                <dt>Pflicht</dt>
                <dd>{selectedEdge.rules.some((item) => item.rule.required) ? "Mindestens eine Beziehung ist verpflichtend" : "Freiwillig"}</dd>
                <dt>Schweregrad</dt>
                <dd>{[...new Set(selectedEdge.rules.map((item) => displaySeverity(item.rule.severity)))].join(", ")}</dd>
                <dt>Sichten</dt>
                <dd>{[...new Set(selectedEdge.rules.flatMap((item) => item.rule.viewpointIds ?? []))]
                  .map((id) => displayViewpointName(viewpoints.find((viewpoint) => viewpoint.id === id), id))
                  .join(", ") || "Alle"}</dd>
              </dl>
            </>
          )}
        </aside>
      </div>
      )}
      {mode !== "simplified" && (
        <RuleCatalog rules={ruleCatalog} viewpoints={viewpoints} />
      )}
    </section>
  );
}

function RuleCatalog({ rules, viewpoints }: { rules: EdgeRule[]; viewpoints: Viewpoint[] }) {
  if (rules.length === 0) return null;
  return (
    <section className="metamodel-rule-catalog">
      <div className="metamodel-rule-catalog-header">
        <div>
          <h3>Vollständiger Regelkatalog</h3>
          <p>Diese Tabelle deckt alle aktuell gefilterten Regeln ab. Die Grafik darüber gruppiert nur zur Orientierung.</p>
        </div>
        <span>{rules.length} Regeln</span>
      </div>
      <div className="metamodel-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Quelle</th>
              <th>Beziehung</th>
              <th>Ziel</th>
              <th>Erlaubt</th>
              <th>Pflicht</th>
              <th>Schweregrad</th>
              <th>Sichten</th>
              <th>Typ</th>
              <th>Begründung</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((item) => (
              <tr key={item.rule.id}>
                <td>{displayTypeName(item.sourceType)}</td>
                <td><strong style={{ color: item.connectionType.color }}>{displayConnectionName(item.connectionType)}</strong></td>
                <td>{displayTypeName(item.targetType)}</td>
                <td>{yesNo(item.rule.allowed)}</td>
                <td>{yesNo(item.rule.required)}</td>
                <td>{displaySeverity(item.rule.severity)}</td>
                <td>{(item.rule.viewpointIds ?? []).map((id) => displayViewpointName(viewpoints.find((viewpoint) => viewpoint.id === id), id)).join(", ") || "Alle"}</td>
                <td>
                  {item.sourceType.id === item.targetType.id && <span className="metamodel-rule-badge">Selbstbezug</span>}
                  {item.sourceType.id !== item.targetType.id && <span className="metamodel-rule-badge metamodel-rule-badge--explicit">Explizit</span>}
                </td>
                <td>{displayRuleRationale(item)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyHint({ text }: { text: string }) {
  return <div className="metamodel-empty">{text}</div>;
}
