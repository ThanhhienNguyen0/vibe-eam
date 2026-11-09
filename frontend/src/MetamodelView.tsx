import { useCallback, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Boxes, Download, Eye, GitBranch, Layers, RotateCcw, Search, ShieldCheck, Upload, Waypoints } from "lucide-react";
import { sidebarApi } from "./Sidebar/sidebarApi";
import { getAllowedConnectionRules } from "./Sidebar/metamodelRules";
import type { ComponentType, MetamodelImportResult, SidebarState } from "./Sidebar/sidebarTypes";
import {
  displayConnectionName,
  displayLayerName,
  displayViewpointName,
  downloadJson,
  GRAPH_RULE_LIMIT,
  isBpmn,
  isLegacyRule,
  isSimplifiedRule,
  layerOf,
  layerRank,
  SIMPLIFIED_POSITIONS,
  sortLayers,
  TABS,
  viewpointRuleFor
} from "./metamodel/metamodelLabels";
import type { DetailTarget, EdgeRule, GraphEdge, GraphMode, MetamodelTab, SortKey, TypeInsight } from "./metamodel/metamodelLabels";
import { KpiCard } from "./metamodel/ui";
import { MetamodelDetailDrawer } from "./metamodel/DetailContent";
import { OverviewTab } from "./metamodel/OverviewTab";
import { ComponentTypesTab } from "./metamodel/ComponentTypesTab";
import { ConnectionRulesTab } from "./metamodel/ConnectionRulesTab";
import { ViewpointsTab } from "./metamodel/ViewpointsTab";
import { ValidationRulesTab } from "./metamodel/ValidationRulesTab";
import { RuleGraphTab } from "./metamodel/RuleGraphTab";

interface Props {
  sidebarState: SidebarState;
  onStateChange: (state: SidebarState) => void;
  /** Mainly for tests and deep links; defaults to the overview. */
  initialTab?: MetamodelTab;
}

export default function MetamodelView({ sidebarState, onStateChange, initialTab = "overview" }: Props) {
  const { componentTypes, connectionTypes, connectionRules, viewpoints, viewpointRules, validationRules } = sidebarState;
  const explicitConnectionRules = useMemo(() => connectionRules.filter((rule) => !isLegacyRule(rule)), [connectionRules]);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const [activeTab, setActiveTab] = useState<MetamodelTab>(initialTab);
  const [viewpointId, setViewpointId] = useState("all");
  const [layerFilter, setLayerFilter] = useState("all");
  const [connectionTypeFilter, setConnectionTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showOnlySelectedViewpoint, setShowOnlySelectedViewpoint] = useState(true);
  const [showValidationRules, setShowValidationRules] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("source");
  const [detail, setDetail] = useState<DetailTarget>(null);
  const [graphMode, setGraphMode] = useState<GraphMode>("simplified");
  const [graphOnlyRequired, setGraphOnlyRequired] = useState(false);
  const [graphNodeOverrides, setGraphNodeOverrides] = useState<Record<string, { x: number; y: number }>>({});
  const [presentationMode, setPresentationMode] = useState(false);
  const [metamodelActionMessage, setMetamodelActionMessage] = useState("");
  const [metamodelActionError, setMetamodelActionError] = useState("");
  const [lastImportResult, setLastImportResult] = useState<MetamodelImportResult | null>(null);

  const selectedViewpoint = viewpointId === "all" ? undefined : viewpoints.find((viewpoint) => viewpoint.id === viewpointId);
  const selectedViewpointRule = selectedViewpoint ? viewpointRuleFor(selectedViewpoint, sidebarState) : undefined;
  const normalizedSearch = search.trim().toLowerCase();
  const closeDetail = useCallback(() => setDetail(null), []);

  const layers = useMemo(() => sortLayers(componentTypes.map(layerOf)), [componentTypes]);

  /** Every explicit rule resolved to its types, independent of the filters (for detail panels and overview). */
  const allEdgeRules = useMemo<EdgeRule[]>(() => explicitConnectionRules.flatMap((rule) => {
    const sourceType = componentTypes.find((type) => type.id === rule.sourceComponentTypeId);
    const targetType = componentTypes.find((type) => type.id === rule.targetComponentTypeId);
    const connectionType = connectionTypes.find((type) => type.id === rule.connectionTypeId);
    return sourceType && targetType && connectionType ? [{ rule, sourceType, targetType, connectionType }] : [];
  }), [componentTypes, connectionTypes, explicitConnectionRules]);

  const edgeRules = useMemo<EdgeRule[]>(() => {
    const viewpoint = selectedViewpoint && showOnlySelectedViewpoint ? selectedViewpoint.id : undefined;
    return allEdgeRules.filter(({ rule, sourceType, targetType, connectionType }) => {
      if (connectionTypeFilter !== "all" && rule.connectionTypeId !== connectionTypeFilter) return false;
      if (layerFilter !== "all" && layerOf(sourceType) !== layerFilter) return false;
      if (viewpoint) {
        const allowed = getAllowedConnectionRules(sidebarState, sourceType.id, targetType.id, viewpoint);
        if (!allowed.some((item) => item.id === rule.id)) return false;
      }
      if (normalizedSearch) {
        const haystack = `${sourceType.name} ${targetType.name} ${connectionType.name} ${rule.description} ${rule.rationale}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortKey === "connection") {
        return a.connectionType.name.localeCompare(b.connectionType.name) || a.sourceType.name.localeCompare(b.sourceType.name);
      }
      return a.sourceType.name.localeCompare(b.sourceType.name) || a.connectionType.name.localeCompare(b.connectionType.name);
    });
  }, [allEdgeRules, connectionTypeFilter, layerFilter, normalizedSearch, selectedViewpoint, showOnlySelectedViewpoint, sidebarState, sortKey]);

  const typeInsights = useMemo(() => {
    const viewpointRulesById = new Map(viewpoints.map((viewpoint) => [viewpoint.id, viewpointRuleFor(viewpoint, sidebarState)]));
    return new Map<string, TypeInsight>(componentTypes.map((type) => {
      const rules = allEdgeRules.filter((item) => item.sourceType.id === type.id || item.targetType.id === type.id);
      const typeViewpoints = viewpoints.filter((viewpoint) => viewpointRulesById.get(viewpoint.id)?.allowedComponentTypeIds.includes(type.id));
      const requiredIn = viewpoints.filter((viewpoint) => viewpointRulesById.get(viewpoint.id)?.requiredComponentTypeIds.includes(type.id));
      return [type.id, { rules, viewpoints: typeViewpoints, requiredIn }];
    }));
  }, [allEdgeRules, componentTypes, sidebarState, viewpoints]);

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
    return [...groups.entries()].sort((a, b) => layerRank(a[0]) - layerRank(b[0]) || a[0].localeCompare(b[0]));
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
    let rules = edgeRules;
    if (graphMode === "viewpoint" && selectedViewpoint) {
      rules = rules.filter((item) => getAllowedConnectionRules(sidebarState, item.sourceType.id, item.targetType.id, selectedViewpoint.id)
        .some((rule) => rule.id === item.rule.id));
    }
    if (graphMode === "simplified") {
      rules = rules.filter((item) => isSimplifiedRule(item));
    }
    if (graphOnlyRequired) {
      rules = rules.filter((item) => item.rule.required);
    }
    return rules;
  }, [edgeRules, graphMode, graphOnlyRequired, selectedViewpoint, sidebarState]);

  const graphComponentTypes = useMemo(() => {
    const idsFromRules = new Set(graphBaseRules.flatMap((item) => [item.sourceType.id, item.targetType.id]));
    return componentTypes.filter((type) => {
      if (!idsFromRules.has(type.id)) return false;
      if (layerFilter !== "BPMN" && isBpmn(type)) return false;
      return true;
    });
  }, [componentTypes, graphBaseRules, layerFilter]);

  const graphRules = useMemo(() => {
    const graphTypeIds = new Set(graphComponentTypes.map((type) => type.id));
    return graphBaseRules.filter((item) => graphTypeIds.has(item.sourceType.id) && graphTypeIds.has(item.targetType.id));
  }, [graphBaseRules, graphComponentTypes]);
  const graphTooDense = graphMode !== "simplified" && graphRules.length > GRAPH_RULE_LIMIT;

  const graphEdges = useMemo<GraphEdge[]>(() => {
    const grouped = new Map<string, GraphEdge>();
    for (const item of graphRules.filter((rule) => rule.sourceType.id !== rule.targetType.id)) {
      const id = `${item.sourceType.id}->${item.targetType.id}`;
      const current = grouped.get(id);
      if (!current) {
        grouped.set(id, { id, sourceType: item.sourceType, targetType: item.targetType, connectionTypes: [item.connectionType], rules: [item] });
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
    const positions = new Map<string, { x: number; y: number }>();
    if (graphMode === "simplified") {
      for (const type of graphComponentTypes) {
        positions.set(type.id, SIMPLIFIED_POSITIONS[type.id] ?? { x: 620, y: 330 });
      }
    } else {
      const grouped = new Map<number, ComponentType[]>();
      for (const type of graphComponentTypes) {
        const col = columnFor(type);
        grouped.set(col, [...(grouped.get(col) ?? []), type]);
      }
      for (const [col, types] of grouped.entries()) {
        const sorted = [...types].sort((a, b) => a.name.localeCompare(b.name));
        const gap = 128;
        const startY = 96 + Math.max(0, 4 - sorted.length) * 34;
        sorted.forEach((type, index) => {
          positions.set(type.id, { x: 120 + col * 220, y: startY + index * gap });
        });
      }
    }
    for (const [typeId, position] of Object.entries(graphNodeOverrides)) {
      if (positions.has(typeId)) positions.set(typeId, position);
    }
    return positions;
  }, [graphComponentTypes, graphMode, graphNodeOverrides]);

  function resetFilters() {
    setViewpointId("all");
    setLayerFilter("all");
    setConnectionTypeFilter("all");
    setSearch("");
    setGraphOnlyRequired(false);
  }

  function changeGraphMode(mode: GraphMode) {
    // The viewpoint mode never starts empty: pick the first viewpoint if none is chosen yet.
    if (mode === "viewpoint" && !selectedViewpoint && viewpoints.length > 0) {
      setViewpointId(viewpoints[0].id);
      setShowOnlySelectedViewpoint(true);
    }
    setGraphMode(mode);
    setDetail(null);
    setGraphNodeOverrides({});
  }

  function navigate(tab: MetamodelTab) {
    setActiveTab(tab);
    setDetail(null);
    // When the sticky tab bar is used further down the page, jump to the start of the new tab content.
    const view = viewRef.current;
    const nav = navRef.current;
    if (view && nav && view.scrollTop > nav.offsetTop) view.scrollTop = nav.offsetTop;
  }

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
        setDetail(null);
        setMetamodelActionMessage(`Metamodell-JSON importiert: ${result.importedCounts.componentTypes} Komponententypen, ${result.importedCounts.connectionRules} Verbindungsregeln.`);
      }
    } catch (error) {
      setMetamodelActionError(error instanceof Error ? error.message : "Import des Metamodells fehlgeschlagen.");
    }
  }

  const tabCounts: Partial<Record<MetamodelTab, number>> = {
    components: componentTypes.length,
    rules: explicitConnectionRules.length,
    viewpoints: viewpoints.length,
    validation: validationRules.length
  };

  return (
    <div ref={viewRef} className="metamodel-view metamodel-view--structured">
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
        <div className="metamodel-kpis mm-kpis">
          <KpiCard label="Komponententypen" value={componentTypes.length} icon={<Boxes size={17} />} onClick={() => navigate("components")} />
          <KpiCard label="Verbindungsregeln" value={explicitConnectionRules.length} icon={<GitBranch size={17} />} onClick={() => navigate("rules")} />
          <KpiCard label="Verbindungstypen" value={connectionTypes.length} icon={<Waypoints size={17} />} onClick={() => navigate("graph")} />
          <KpiCard label="Sichten" value={viewpoints.length} icon={<Eye size={17} />} onClick={() => navigate("viewpoints")} />
          <KpiCard label="Sichtregeln" value={viewpointRules.length} icon={<Layers size={17} />} onClick={() => navigate("viewpoints")} />
          <KpiCard label="Prüfregeln" value={validationRules.length} icon={<ShieldCheck size={17} />} onClick={() => navigate("validation")} />
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
        <label className="mm-search">
          Suche
          <span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Typen, Regeln, Begründungen suchen" />
            <Search size={14} aria-hidden="true" />
          </span>
        </label>
        <label className="metamodel-toggle">
          <input type="checkbox" checked={showOnlySelectedViewpoint} onChange={(e) => setShowOnlySelectedViewpoint(e.target.checked)} disabled={!selectedViewpoint} />
          Nur gewählte Sicht
        </label>
        <label className="metamodel-toggle">
          <input type="checkbox" checked={showValidationRules} onChange={(e) => setShowValidationRules(e.target.checked)} />
          Prüfregeln anzeigen
        </label>
        <button type="button" className="mm-reset-button" onClick={resetFilters}>
          <RotateCcw size={13} /> Filter zurücksetzen
        </button>
      </section>

      <nav ref={navRef} className="metamodel-tabs" aria-label="Metamodell-Bereiche">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" className={activeTab === id ? "active" : ""} onClick={() => navigate(id)}>
            {label}
            {tabCounts[id] !== undefined && <span className="mm-tab-count">{tabCounts[id]}</span>}
          </button>
        ))}
      </nav>

      <main className="metamodel-tab-panel">
        {activeTab === "overview" && (
          <OverviewTab
            viewpoints={viewpoints}
            selectedViewpoint={selectedViewpoint}
            componentTypes={componentTypes}
            connectionTypes={connectionTypes}
            allRules={allEdgeRules}
            validationRuleCount={validationRules.length}
            onNavigate={navigate}
            onLayerSelect={(layer) => { setLayerFilter(layer); navigate("components"); }}
            onConnectionTypeSelect={(id) => { setConnectionTypeFilter(id); navigate("rules"); }}
            onViewpointSelect={(id) => { setViewpointId(id); setShowOnlySelectedViewpoint(true); navigate("viewpoints"); }}
          />
        )}

        {activeTab === "components" && (
          <ComponentTypesTab
            groups={groupedComponentTypes}
            allComponentTypes={componentTypes}
            insights={typeInsights}
            layerFilter={layerFilter}
            onLayerFilterChange={setLayerFilter}
            onSelect={(type) => setDetail({ kind: "type", type })}
            onResetFilters={resetFilters}
          />
        )}

        {activeTab === "rules" && (
          <ConnectionRulesTab
            rules={edgeRules}
            viewpoints={viewpoints}
            sortKey={sortKey}
            onSortChange={setSortKey}
            onSelect={(item) => setDetail({ kind: "rule", item })}
            connectionTypeFilter={connectionTypeFilter}
            onConnectionTypeFilterChange={setConnectionTypeFilter}
            onResetFilters={resetFilters}
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
            onSelectType={(type) => setDetail({ kind: "type", type })}
          />
        )}

        {activeTab === "validation" && (
          <ValidationRulesTab
            rules={visibleValidationRules}
            componentTypes={componentTypes}
            connectionTypes={connectionTypes}
            viewpoints={viewpoints}
            hidden={!showValidationRules}
            onShow={() => setShowValidationRules(true)}
          />
        )}

        {activeTab === "graph" && (
          <RuleGraphTab
            componentTypes={graphComponentTypes}
            allLayers={layers}
            edges={graphEdges}
            ruleCatalog={graphRules}
            tooDense={graphTooDense}
            positions={graphPositions}
            selection={detail}
            onSelect={setDetail}
            viewpoints={viewpoints}
            mode={graphMode}
            onModeChange={changeGraphMode}
            selectedViewpoint={selectedViewpoint}
            presentationMode={presentationMode}
            onPresentationModeChange={setPresentationMode}
            onMoveNode={(typeId, position) => setGraphNodeOverrides((current) => ({ ...current, [typeId]: position }))}
            onResetLayout={() => setGraphNodeOverrides({})}
            layerFilter={layerFilter}
            onLayerFilterChange={setLayerFilter}
            onlyRequired={graphOnlyRequired}
            onOnlyRequiredChange={setGraphOnlyRequired}
            onResetFilters={resetFilters}
            hasData={componentTypes.length > 0}
          />
        )}
      </main>

      <MetamodelDetailDrawer
        target={detail}
        context={{ componentTypes, connectionTypes, viewpoints, validationRules, components: sidebarState.components, typeInsights }}
        onSelect={setDetail}
        onClose={closeDetail}
      />
    </div>
  );
}
