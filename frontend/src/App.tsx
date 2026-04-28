import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type NodeDragHandler,
  useEdgesState,
  useNodesState
} from "reactflow";
import { Activity, Download, Flame, GitBranch, Plus, RefreshCw, Upload } from "lucide-react";
import { api } from "./api";
import {
  analyzeImpact,
  getAllowedRelationTypes,
  layerByElementType,
  type AnalysisStep,
  type ImpactMode
} from "./metamodel";
import {
  elementTypes,
  layers,
  riskLevels,
  statuses,
  type AuditLogEntry,
  type EamElement,
  type EamModel,
  type EamRelation,
  type ElementType,
  type Layer,
  type RelationType
} from "./types";
import {
  buildPortfolio,
  getRiskBubbleSize,
  normalizePortfolioPoint,
  type PortfolioCategory,
  type PortfolioEntry
} from "./portfolio";

type View = "canvas" | "capability" | "roadmap" | "portfolio" | "audit";
type HeatmapMode = "none" | "risk" | "cost";
type PortfolioSortKey = "impactScore" | "cost";

const layerColors: Record<Layer, string> = {
  Business: "#0f766e",
  Application: "#2563eb",
  Data: "#7c3aed",
  Technology: "#475569"
};

const riskColors = {
  low: "#16a34a",
  medium: "#f59e0b",
  high: "#dc2626"
};

const relationStyles: Record<RelationType, { stroke: string; strokeDasharray?: string }> = {
  uses: { stroke: "#7c3aed", strokeDasharray: "4 4" },
  depends_on: { stroke: "#dc2626" },
  serves: { stroke: "#2563eb", strokeDasharray: "8 4" },
  realizes: { stroke: "#0f766e" }
};

function costColor(cost: number): string {
  if (cost >= 180000) return "#b91c1c";
  if (cost >= 100000) return "#c2410c";
  return "#15803d";
}

function nodeStyle(element: EamElement, heatmapMode: HeatmapMode, impactDepth: number | null, selected: boolean): React.CSSProperties {
  const color = heatmapMode === "risk" ? riskColors[element.risk] : heatmapMode === "cost" ? costColor(element.cost) : layerColors[element.layer];
  const isDirect = impactDepth === 1;
  const isIndirect = impactDepth !== null && impactDepth > 1;
  return {
    border: selected ? "3px solid #0f172a" : isDirect ? "3px solid #f97316" : isIndirect ? "3px solid #facc15" : `2px solid ${color}`,
    borderLeft: `8px solid ${color}`,
    borderRadius: 8,
    padding: 10,
    minWidth: 190,
    color: "#172033",
    background: selected ? "#eef2ff" : isDirect ? "#fff7ed" : isIndirect ? "#fff8d6" : "#ffffff",
    boxShadow: selected
      ? "0 8px 20px rgba(15, 23, 42, 0.18)"
      : isDirect || isIndirect
        ? "0 8px 18px rgba(250, 204, 21, 0.26)"
        : "0 8px 18px rgba(15, 23, 42, 0.08)"
  };
}

function toNodes(model: EamModel, heatmapMode: HeatmapMode, impactResults: AnalysisStep[], selectedId: string | null): Node[] {
  const depthById = new Map(impactResults.map((result) => [result.elementId, result.depth]));
  return model.elements.map((element) => ({
    id: element.id,
    position: element.position,
    data: {
      label: (
        <div className="eam-node">
          <strong>{element.name}</strong>
          <span>{element.type}</span>
          <small>{element.risk} risk - {element.status}</small>
        </div>
      )
    },
    style: nodeStyle(element, heatmapMode, depthById.get(element.id) ?? null, selectedId === element.id)
  }));
}

function toEdges(model: EamModel, impactResults: AnalysisStep[]): Edge[] {
  const highlightedRelations = new Set(impactResults.map((result) => result.relationId));
  return model.relations.map((relation) => ({
    id: relation.id,
    source: relation.source,
    target: relation.target,
    label: relation.type,
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
    labelStyle: { fill: "#172033", fontWeight: 700, fontSize: 11 },
    labelBgStyle: { fill: "#ffffff", fillOpacity: 0.88 },
    animated: highlightedRelations.has(relation.id),
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: highlightedRelations.has(relation.id) ? "#eab308" : relationStyles[relation.type].stroke
    },
    style: {
      strokeWidth: highlightedRelations.has(relation.id) ? 3 : 2,
      stroke: highlightedRelations.has(relation.id) ? "#eab308" : relationStyles[relation.type].stroke,
      strokeDasharray: relationStyles[relation.type].strokeDasharray
    }
  }));
}

function emptyElement(index: number): Partial<EamElement> {
  return {
    name: `New Capability ${index}`,
    type: "Business Capability",
    layer: "Business",
    description: "",
    risk: "medium",
    cost: 0,
    status: "planned",
    startDate: new Date().toISOString().slice(0, 10),
    endOfLifeDate: "",
    customAttributes: {},
    position: { x: 120 + index * 20, y: 120 + index * 20 }
  };
}

export default function App() {
  const [model, setModel] = useState<EamModel>({ elements: [], relations: [] });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>("canvas");
  const [layerFilter, setLayerFilter] = useState<Layer | "all">("all");
  const [typeFilter, setTypeFilter] = useState<ElementType | "all">("all");
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMode>("risk");
  const [impactMode, setImpactMode] = useState<ImpactMode>("downstream");
  const [portfolioLayerFilter, setPortfolioLayerFilter] = useState<Layer | "all">("all");
  const [portfolioRiskFilter, setPortfolioRiskFilter] = useState<EamElement["risk"] | "all">("all");
  const [portfolioCategoryFilter, setPortfolioCategoryFilter] = useState<PortfolioCategory | "all">("all");
  const [portfolioSortKey, setPortfolioSortKey] = useState<PortfolioSortKey>("impactScore");
  const [portfolioSortDirection, setPortfolioSortDirection] = useState<"asc" | "desc">("desc");
  const [validationError, setValidationError] = useState("");
  const [impactResults, setImpactResults] = useState<AnalysisStep[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [relationDraft, setRelationDraft] = useState<Partial<EamRelation>>({ type: "uses" });

  const selectedElement = model.elements.find((element) => element.id === selectedId) ?? null;
  const portfolioEntries = useMemo(() => buildPortfolio(model), [model]);

  const visibleModel = useMemo(() => {
    const elements = model.elements.filter((element) => {
      const layerOk = layerFilter === "all" || element.layer === layerFilter;
      const typeOk = typeFilter === "all" || element.type === typeFilter;
      return layerOk && typeOk;
    });
    const ids = new Set(elements.map((element) => element.id));
    const relations = model.relations.filter((relation) => ids.has(relation.source) && ids.has(relation.target));
    return { elements, relations };
  }, [layerFilter, model, typeFilter]);

  const refresh = useCallback(async () => {
    const [freshModel, freshAudit] = await Promise.all([api.getModel(), api.getAuditLog()]);
    setModel(freshModel);
    setAuditLog(freshAudit);
    setValidationError("");
  }, []);

  useEffect(() => {
    refresh().catch((error) => setValidationError(error.message));
  }, [refresh]);

  useEffect(() => {
    setNodes(toNodes(visibleModel, heatmapMode, impactResults, selectedId));
    setEdges(toEdges(visibleModel, impactResults));
  }, [heatmapMode, impactResults, selectedId, setEdges, setNodes, visibleModel]);

  async function createElement() {
    try {
      const result = await api.createElement(emptyElement(model.elements.length + 1));
      setModel(result.model);
      setSelectedId(result.element.id);
      setValidationError("");
      setAuditLog(await api.getAuditLog());
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not create element.");
    }
  }

  async function patchElement(patch: Partial<EamElement>) {
    if (!selectedElement) return;
    const nextPatch = patch.type ? { ...patch, layer: layerByElementType[patch.type] } : patch;
    const optimistic = model.elements.map((element) => (element.id === selectedElement.id ? { ...element, ...nextPatch } : element));
    setModel({ ...model, elements: optimistic });
    try {
      await api.updateElement(selectedElement.id, nextPatch);
      setAuditLog(await api.getAuditLog());
      setValidationError("");
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not update element.");
      await refresh();
    }
  }

  async function removeSelected() {
    if (!selectedElement) return;
    try {
      await api.deleteElement(selectedElement.id);
      setSelectedId(null);
      await refresh();
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not delete element.");
    }
  }

  async function createRelation(source: string, target: string, type: RelationType = "uses", description = "") {
    try {
      const result = await api.createRelation({ source, target, type, description });
      setModel(result.model);
      setValidationError("");
      setAuditLog(await api.getAuditLog());
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Could not create relation.");
    }
  }

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const source = model.elements.find((element) => element.id === connection.source);
      const target = model.elements.find((element) => element.id === connection.target);
      const allowedTypes = getAllowedRelationTypes(source?.type, target?.type);
      const type = allowedTypes[0];
      if (!type) {
        setValidationError("No relation type is allowed for this source and target by the EAM metamodel.");
        return;
      }
      await createRelation(connection.source, connection.target, type, "Created from canvas connection.");
    },
    [model.elements]
  );

  const onNodeDragStop: NodeDragHandler = async (_event, node) => {
    const element = model.elements.find((item) => item.id === node.id);
    if (!element) return;
    await api.updateElement(element.id, { position: node.position }).catch((error) => setValidationError(error.message));
    setModel((current) => ({
      ...current,
      elements: current.elements.map((item) => (item.id === node.id ? { ...item, position: node.position } : item))
    }));
  };

  function runImpactAnalysis() {
    if (!selectedElement) {
      setValidationError("Select an element before running impact analysis.");
      return;
    }
    const results = analyzeImpact(model, selectedElement.id, impactMode);
    setImpactResults(results);
    setValidationError(
      results.length
        ? ""
        : impactMode === "downstream"
          ? "No downstream impact found based on the current metamodel relations."
          : "No upstream dependencies found based on the current metamodel relations."
    );
  }

  async function submitRelation() {
    if (!relationDraft.source || !relationDraft.target || !relationDraft.type) {
      setValidationError("Relation source, target and type are required.");
      return;
    }
    const source = model.elements.find((element) => element.id === relationDraft.source);
    const target = model.elements.find((element) => element.id === relationDraft.target);
    const allowedTypes = getAllowedRelationTypes(source?.type, target?.type);
    if (!allowedTypes.includes(relationDraft.type)) {
      setValidationError("This relation is not allowed by the EAM metamodel.");
      return;
    }
    await createRelation(relationDraft.source, relationDraft.target, relationDraft.type, relationDraft.description ?? "");
    setRelationDraft({ type: "uses" });
  }

  async function exportJson() {
    const exported = await api.exportModel();
    const blob = new Blob([JSON.stringify(exported, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "eam-model.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text()) as EamModel;
      const nextModel = await api.importModel(imported);
      setModel(nextModel);
      setSelectedId(null);
      setImpactResults([]);
      setValidationError("");
      setAuditLog(await api.getAuditLog());
    } catch (error) {
      setValidationError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>EAM Prototype</h1>
          <p>AI-assisted research artifact for lightweight enterprise architecture modelling</p>
        </div>
        <nav className="tabs" aria-label="Views">
          <button className={view === "canvas" ? "active" : ""} onClick={() => setView("canvas")}>Canvas</button>
          <button className={view === "capability" ? "active" : ""} onClick={() => setView("capability")}>Capability Map</button>
          <button className={view === "roadmap" ? "active" : ""} onClick={() => setView("roadmap")}>Lifecycle Roadmap</button>
          <button className={view === "portfolio" ? "active" : ""} onClick={() => setView("portfolio")}>Risk-Cost Portfolio</button>
          <button className={view === "audit" ? "active" : ""} onClick={() => setView("audit")}>Audit Log</button>
        </nav>
      </header>

      <main className="workspace">
        <section className="tool-area">
          <div className="toolbar">
            <button onClick={createElement} title="Add element"><Plus size={18} /> Element</button>
            <button onClick={runImpactAnalysis} title="Run impact analysis"><Activity size={18} /> Impact</button>
            <button onClick={() => setImpactResults([])} title="Clear impact highlight"><RefreshCw size={18} /></button>
            <button onClick={exportJson} title="Export model as JSON"><Download size={18} /></button>
            <label className="file-button" title="Import JSON model">
              <Upload size={18} />
              <input type="file" accept="application/json" onChange={(event) => importJson(event.target.files?.[0])} />
            </label>
            <select value={layerFilter} onChange={(event) => setLayerFilter(event.target.value as Layer | "all")} aria-label="Layer filter">
              <option value="all">All layers</option>
              {layers.map((layer) => <option key={layer} value={layer}>{layer}</option>)}
            </select>
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as ElementType | "all")} aria-label="Type filter">
              <option value="all">All types</option>
              {elementTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <select value={heatmapMode} onChange={(event) => setHeatmapMode(event.target.value as HeatmapMode)} aria-label="Heatmap mode">
              <option value="none">Layer colors</option>
              <option value="risk">Risk heatmap</option>
              <option value="cost">Cost heatmap</option>
            </select>
            <select value={impactMode} onChange={(event) => setImpactMode(event.target.value as ImpactMode)} aria-label="Impact analysis mode">
              <option value="downstream">Downstream Business Impact</option>
              <option value="upstream">Upstream Dependencies</option>
            </select>
          </div>

          {validationError && <div className="error-banner">{validationError}</div>}
          <ViewHelp view={view} />

          {view === "canvas" && (
            <div className="canvas">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={(_event, node) => setSelectedId(node.id)}
                onNodeDragStop={onNodeDragStop}
                fitView
              >
                <MiniMap nodeStrokeWidth={3} pannable zoomable />
                <Controls />
                <Background gap={24} />
              </ReactFlow>
            </div>
          )}

          {view === "capability" && <CapabilityMap model={model} heatmapMode={heatmapMode} />}
          {view === "roadmap" && <Roadmap model={model} />}
          {view === "portfolio" && (
            <RiskCostPortfolio
              entries={portfolioEntries}
              layerFilter={portfolioLayerFilter}
              riskFilter={portfolioRiskFilter}
              categoryFilter={portfolioCategoryFilter}
              sortKey={portfolioSortKey}
              sortDirection={portfolioSortDirection}
              onLayerFilterChange={setPortfolioLayerFilter}
              onRiskFilterChange={setPortfolioRiskFilter}
              onCategoryFilterChange={setPortfolioCategoryFilter}
              onSortChange={(sortKey) => {
                if (portfolioSortKey === sortKey) {
                  setPortfolioSortDirection((current) => (current === "desc" ? "asc" : "desc"));
                } else {
                  setPortfolioSortKey(sortKey);
                  setPortfolioSortDirection("desc");
                }
              }}
            />
          )}
          {view === "audit" && <AuditLog entries={auditLog} />}
        </section>

        <aside className="side-panel">
          <PropertyPanel
            element={selectedElement}
            onPatch={patchElement}
            onDelete={removeSelected}
            onImpact={runImpactAnalysis}
          />
          <RelationForm
            model={model}
            draft={relationDraft}
            onChange={setRelationDraft}
            onSubmit={submitRelation}
          />
          <ImpactList model={model} results={impactResults} mode={impactMode} />
        </aside>
      </main>
    </div>
  );
}

function ViewHelp({ view }: { view: View }) {
  const content: Record<View, { title: string; text: string }> = {
    canvas: {
      title: "Architecture Canvas",
      text: "Models EAM elements and directed relations. It answers: how are business, application, data and technology elements connected?"
    },
    capability: {
      title: "Capability Map",
      text: "Shows business capabilities and supporting applications. It answers: which applications support which business capabilities?"
    },
    roadmap: {
      title: "Lifecycle Roadmap",
      text: "Lists start, status and end-of-life data. It answers: which architecture elements need lifecycle attention?"
    },
    portfolio: {
      title: "Risk-Cost Portfolio",
      text: "Ranks elements by risk, cost and calculated downstream impact. It answers: where should architecture attention go first?"
    },
    audit: {
      title: "Audit Log",
      text: "Shows model changes. It answers: what has changed in this prototype model?"
    }
  };

  return (
    <div className="view-help">
      <strong>{content[view].title}</strong>
      <span>{content[view].text}</span>
    </div>
  );
}

function PropertyPanel({
  element,
  onPatch,
  onDelete,
  onImpact
}: {
  element: EamElement | null;
  onPatch: (patch: Partial<EamElement>) => void;
  onDelete: () => void;
  onImpact: () => void;
}) {
  const [newAttrKey, setNewAttrKey] = useState("");
  const [newAttrValue, setNewAttrValue] = useState("");

  if (!element) {
    return (
      <section className="panel">
        <h2>Properties</h2>
        <p className="muted">Select a node to edit architecture element details.</p>
      </section>
    );
  }

  const currentElement = element;

  function updateAttribute(key: string, value: string) {
    onPatch({ customAttributes: { ...currentElement.customAttributes, [key]: value } });
  }

  function addAttribute() {
    if (!newAttrKey.trim()) return;
    onPatch({ customAttributes: { ...currentElement.customAttributes, [newAttrKey.trim()]: newAttrValue } });
    setNewAttrKey("");
    setNewAttrValue("");
  }

  function removeAttribute(key: string) {
    const next = { ...currentElement.customAttributes };
    delete next[key];
    onPatch({ customAttributes: next });
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Properties</h2>
        <button onClick={onImpact} title="Impact analysis"><Activity size={16} /></button>
      </div>
      <label>Name<input value={element.name} onChange={(event) => onPatch({ name: event.target.value })} /></label>
      <label>Description<textarea value={element.description} onChange={(event) => onPatch({ description: event.target.value })} /></label>
      <label>Type
        <select value={element.type} onChange={(event) => onPatch({ type: event.target.value as ElementType })}>
          {elementTypes.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      <div className="two-col">
        <label>Risk
          <select value={element.risk} onChange={(event) => onPatch({ risk: event.target.value as EamElement["risk"] })}>
            {riskLevels.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
          </select>
        </label>
        <label>Status
          <select value={element.status} onChange={(event) => onPatch({ status: event.target.value as EamElement["status"] })}>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
      </div>
      <label>Cost<input type="number" min="0" value={element.cost} onChange={(event) => onPatch({ cost: Number(event.target.value) })} /></label>
      <div className="two-col">
        <label>Start<input type="date" value={element.startDate} onChange={(event) => onPatch({ startDate: event.target.value })} /></label>
        <label>End of Life<input type="date" value={element.endOfLifeDate} onChange={(event) => onPatch({ endOfLifeDate: event.target.value })} /></label>
      </div>
      <h3>Custom Attributes</h3>
      {Object.entries(element.customAttributes).map(([key, value]) => (
        <div className="attribute-row" key={key}>
          <span>{key}</span>
          <input value={value} onChange={(event) => updateAttribute(key, event.target.value)} />
          <button onClick={() => removeAttribute(key)}>Remove</button>
        </div>
      ))}
      <div className="attribute-row">
        <input placeholder="key" value={newAttrKey} onChange={(event) => setNewAttrKey(event.target.value)} />
        <input placeholder="value" value={newAttrValue} onChange={(event) => setNewAttrValue(event.target.value)} />
        <button onClick={addAttribute}>Add</button>
      </div>
      <button className="danger" onClick={onDelete}>Delete Element</button>
    </section>
  );
}

function RelationForm({
  model,
  draft,
  onChange,
  onSubmit
}: {
  model: EamModel;
  draft: Partial<EamRelation>;
  onChange: (draft: Partial<EamRelation>) => void;
  onSubmit: () => void;
}) {
  const source = model.elements.find((element) => element.id === draft.source);
  const target = model.elements.find((element) => element.id === draft.target);
  const allowedTypes = getAllowedRelationTypes(source?.type, target?.type);
  const typeOptions = allowedTypes.length > 0 ? allowedTypes : [];

  function updateEndpoint(patch: Partial<EamRelation>) {
    const nextDraft = { ...draft, ...patch };
    const nextSource = model.elements.find((element) => element.id === nextDraft.source);
    const nextTarget = model.elements.find((element) => element.id === nextDraft.target);
    const nextAllowedTypes = getAllowedRelationTypes(nextSource?.type, nextTarget?.type);
    const currentTypeAllowed = nextDraft.type && nextAllowedTypes.includes(nextDraft.type);
    onChange({ ...nextDraft, type: currentTypeAllowed ? nextDraft.type : nextAllowedTypes[0] });
  }

  return (
    <section className="panel">
      <div className="panel-heading">
        <h2>Relation</h2>
        <GitBranch size={17} />
      </div>
      <label>Source
        <select value={draft.source ?? ""} onChange={(event) => updateEndpoint({ source: event.target.value })}>
          <option value="">Select source</option>
          {model.elements.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}
        </select>
      </label>
      <label>Target
        <select value={draft.target ?? ""} onChange={(event) => updateEndpoint({ target: event.target.value })}>
          <option value="">Select target</option>
          {model.elements.map((element) => <option key={element.id} value={element.id}>{element.name}</option>)}
        </select>
      </label>
      <label>Type
        <select
          value={draft.type ?? ""}
          disabled={!draft.source || !draft.target || typeOptions.length === 0}
          onChange={(event) => onChange({ ...draft, type: event.target.value as RelationType })}
        >
          <option value="">{draft.source && draft.target ? "No allowed type" : "Select endpoints"}</option>
          {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
        </select>
      </label>
      {source && target && typeOptions.length === 0 && (
        <p className="muted">No relation type is allowed for {source.type} to {target.type} by the current EAM metamodel.</p>
      )}
      <label>Description<input value={draft.description ?? ""} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></label>
      <button onClick={onSubmit} disabled={!draft.source || !draft.target || !draft.type || typeOptions.length === 0}>Create Relation</button>
    </section>
  );
}

function ImpactList({ model, results, mode }: { model: EamModel; results: AnalysisStep[]; mode: ImpactMode }) {
  const elementById = new Map(model.elements.map((element) => [element.id, element]));
  const label = mode === "downstream" ? "Downstream Business Impact" : "Upstream Dependencies";
  const question = mode === "downstream" ? "What is affected?" : "What does it depend on?";
  const emptyMessage =
    mode === "downstream"
      ? "No downstream impact found based on the current metamodel relations."
      : "No upstream dependencies found based on the current metamodel relations.";

  return (
    <section className="panel">
      <h2>{label}</h2>
      <p className="muted">{question}</p>
      {results.length === 0 ? <p className="muted">{emptyMessage}</p> : (
        <ul className="impact-list">
          {results.map((result) => {
            const element = elementById.get(result.elementId);
            const path = result.path.map((id) => elementById.get(id)?.name ?? id).join(" -> ");
            return (
              <li key={`${result.relationId}-${result.elementId}`}>
                <Flame size={15} />
                <div>
                  <strong>{element?.name ?? result.elementId}</strong>
                  <span>{element?.type ?? "Unknown"} - {element?.layer ?? "Unknown"} - {result.relationType} - level {result.depth}</span>
                  <small>{path}</small>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function RiskCostPortfolio({
  entries,
  layerFilter,
  riskFilter,
  categoryFilter,
  sortKey,
  sortDirection,
  onLayerFilterChange,
  onRiskFilterChange,
  onCategoryFilterChange,
  onSortChange
}: {
  entries: PortfolioEntry[];
  layerFilter: Layer | "all";
  riskFilter: EamElement["risk"] | "all";
  categoryFilter: PortfolioCategory | "all";
  sortKey: PortfolioSortKey;
  sortDirection: "asc" | "desc";
  onLayerFilterChange: (layer: Layer | "all") => void;
  onRiskFilterChange: (risk: EamElement["risk"] | "all") => void;
  onCategoryFilterChange: (category: PortfolioCategory | "all") => void;
  onSortChange: (sortKey: PortfolioSortKey) => void;
}) {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [showDetailsTable, setShowDetailsTable] = useState(false);
  const filteredEntries = entries
    .filter((entry) => layerFilter === "all" || entry.element.layer === layerFilter)
    .filter((entry) => riskFilter === "all" || entry.element.risk === riskFilter)
    .filter((entry) => categoryFilter === "all" || entry.category === categoryFilter)
    .sort((a, b) => {
      const aValue = sortKey === "cost" ? a.element.cost : a.impactScore;
      const bValue = sortKey === "cost" ? b.element.cost : b.impactScore;
      return sortDirection === "desc" ? bValue - aValue : aValue - bValue;
    });

  const selectedEntry = filteredEntries.find((entry) => entry.element.id === selectedElementId) ?? null;
  const elementById = new Map(entries.map((entry) => [entry.element.id, entry.element]));
  const totalCost = filteredEntries.reduce((sum, entry) => sum + entry.element.cost, 0);
  const averageCost = filteredEntries.length ? Math.round(totalCost / filteredEntries.length) : 0;
  const highRiskCount = filteredEntries.filter((entry) => entry.element.risk === "high").length;
  const highImpactCount = filteredEntries.filter((entry) => entry.impactLevel === "high").length;
  const highestImpact = filteredEntries.reduce((max, entry) => Math.max(max, entry.impactScore), 0);
  const maxCost = Math.max(...filteredEntries.map((entry) => entry.element.cost), 1);
  const maxImpact = Math.max(...filteredEntries.map((entry) => entry.impactScore), 1);
  const tableEntries = [...filteredEntries].sort((a, b) => b.impactScore - a.impactScore);
  const categoryOptions = Array.from(new Set(entries.map((entry) => entry.category)));

  return (
    <div className="portfolio-view">
      <div className="portfolio-hero">
        <div>
          <h2>Risk-Cost Portfolio</h2>
          <p>Prioritizes architecture elements by cost, calculated downstream impact and risk.</p>
        </div>
        <span>This view helps identify architecture elements that combine high downstream impact, high cost and high risk.</span>
      </div>

      <div className="summary-grid">
        <SummaryTile label="Elements" value={filteredEntries.length.toString()} />
        <SummaryTile label="Average Cost" value={averageCost.toLocaleString()} />
        <SummaryTile label="High Risk" value={highRiskCount.toString()} />
        <SummaryTile label="High Impact" value={highImpactCount.toString()} />
        <SummaryTile label="Highest Impact" value={highestImpact.toString()} />
      </div>

      <div className="portfolio-controls">
        <label>Layer
          <select value={layerFilter} onChange={(event) => onLayerFilterChange(event.target.value as Layer | "all")}>
            <option value="all">All layers</option>
            {layers.map((layer) => <option key={layer} value={layer}>{layer}</option>)}
          </select>
        </label>
        <label>Risk
          <select value={riskFilter} onChange={(event) => onRiskFilterChange(event.target.value as EamElement["risk"] | "all")}>
            <option value="all">All risks</option>
            {riskLevels.map((risk) => <option key={risk} value={risk}>{risk}</option>)}
          </select>
        </label>
        <label>Portfolio Category
          <select value={categoryFilter} onChange={(event) => onCategoryFilterChange(event.target.value as PortfolioCategory | "all")}>
            <option value="all">All categories</option>
            {categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
      </div>

      <div className="portfolio-main-grid">
        <div className="portfolio-chart-card">
          <div className="portfolio-chart-header">
            <div>
              <h3>Management portfolio matrix</h3>
              <p>Cost increases to the right. Calculated downstream impact increases upward.</p>
            </div>
          </div>
          <div className="portfolio-chart" aria-label="Risk-cost portfolio coordinate system">
            <span className="quadrant-label top-left">High impact / efficient</span>
            <span className="quadrant-label top-right">Critical attention</span>
            <span className="quadrant-label bottom-left">Monitor</span>
            <span className="quadrant-label bottom-right">Cost optimization</span>
            <span className="axis-label y-axis-label">Calculated downstream impact</span>
            <span className="axis-label x-axis-label">Cost</span>
            <span className="axis-end-label cost-low">Low cost</span>
            <span className="axis-end-label cost-high">High cost</span>
            <span className="axis-end-label impact-low">Low impact</span>
            <span className="axis-end-label impact-high">High impact</span>
            <span className="axis-line y-axis-line" />
            <span className="axis-line x-axis-line" />

            {filteredEntries.map((entry, index) => {
              const point = normalizePortfolioPoint(entry.element.cost, entry.impactScore, maxCost, maxImpact, 11);
              const size = getRiskBubbleSize(entry.element.risk);
              const jitterX = ((index % 4) - 1.5) * 1.05;
              const jitterY = ((Math.floor(index / 4) % 4) - 1.5) * 0.95;
              const left = Math.min(90, Math.max(11, point.xPercent + jitterX));
              const bottom = Math.min(88, Math.max(13, point.yPercent + jitterY));
              const selected = selectedEntry?.element.id === entry.element.id;
              const hovered = hoveredElementId === entry.element.id;

              return (
                <button
                  key={entry.element.id}
                  className={`portfolio-bubble layer-${entry.element.layer.toLowerCase()} risk-${entry.element.risk} ${selected ? "selected" : ""}`}
                  style={{ left: `${left}%`, bottom: `${bottom}%`, width: size, height: size }}
                  onMouseEnter={() => setHoveredElementId(entry.element.id)}
                  onMouseLeave={() => setHoveredElementId(null)}
                  onFocus={() => setHoveredElementId(entry.element.id)}
                  onBlur={() => setHoveredElementId(null)}
                  onClick={() => setSelectedElementId(entry.element.id)}
                  aria-label={`${entry.element.name}, ${entry.category}`}
                >
                  <span>{elementAbbreviation(entry.element.type)}</span>
                  {hovered && <PortfolioTooltip entry={entry} />}
                </button>
              );
            })}
          </div>

          <div className="portfolio-legend">
            <div><strong>X-axis</strong><span>Cost</span></div>
            <div><strong>Y-axis</strong><span>Calculated downstream impact</span></div>
            <div className="risk-legend">
              <strong>Bubble size = Risk</strong>
              <span className="risk-size low">low</span>
              <span className="risk-size medium">medium</span>
              <span className="risk-size high">high</span>
            </div>
            <div className="layer-legend">
              <strong>Color = Layer</strong>
              {layers.map((layer) => <span key={layer}><i className={`layer-swatch layer-${layer.toLowerCase()}`} />{layer}</span>)}
            </div>
          </div>
        </div>

        <PortfolioDetailCard entry={selectedEntry} elementById={elementById} />
      </div>

      <div className="portfolio-table-section">
        <button className="details-toggle" onClick={() => setShowDetailsTable((current) => !current)}>
          {showDetailsTable ? "Hide details table" : "Show details table"}
        </button>
        {showDetailsTable && (
          <div className="table-wrap portfolio-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Layer</th>
                  <th>Risk</th>
                  <th>Cost</th>
                  <th>Status</th>
                  <th>Impact</th>
                  <th>Category</th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map((entry) => (
                  <tr
                    key={entry.element.id}
                    className={selectedEntry?.element.id === entry.element.id ? "selected-row" : ""}
                    onClick={() => setSelectedElementId(entry.element.id)}
                  >
                    <td>{entry.element.name}</td>
                    <td>{entry.element.type}</td>
                    <td>{entry.element.layer}</td>
                    <td><span className={`badge ${entry.element.risk}`}>{entry.element.risk}</span></td>
                    <td>{entry.element.cost.toLocaleString()}</td>
                    <td>{entry.element.status}</td>
                    <td><strong>{entry.impactScore}</strong> <span className={`impact-level ${entry.impactLevel}`}>{entry.impactLevel}</span></td>
                    <td>{entry.category}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-tile">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PortfolioTooltip({ entry }: { entry: PortfolioEntry }) {
  return (
    <span className="portfolio-tooltip" role="tooltip">
      <strong>{entry.element.name}</strong>
      <span>Type: {entry.element.type}</span>
      <span>Risk: {entry.element.risk}</span>
      <span>Cost: {entry.element.cost.toLocaleString()}</span>
      <span>Impact Score: {entry.impactScore}</span>
      <span>{entry.category}</span>
    </span>
  );
}

function PortfolioDetailCard({ entry, elementById }: { entry: PortfolioEntry | null; elementById: Map<string, EamElement> }) {
  if (!entry) {
    return (
      <aside className="portfolio-detail-card empty">
        <span className="eyebrow">Selected element</span>
        <h3>Select a bubble to inspect details.</h3>
        <p className="muted">The detail card shows risk, cost, impact and downstream dependencies for the selected architecture element.</p>
      </aside>
    );
  }

  return (
    <aside className="portfolio-detail-card">
      <span className="eyebrow">Selected element</span>
      <h3>{entry.element.name}</h3>
      <p>{entry.element.type}</p>
      <div className="detail-badges">
        <span className={`badge ${entry.element.risk}`}>{entry.element.risk} risk</span>
        <span className={`impact-level ${entry.impactLevel}`}>{entry.impactLevel} impact</span>
      </div>
      <div className="detail-metrics">
        <div>
          <span>Cost</span>
          <strong>{entry.element.cost.toLocaleString()}</strong>
        </div>
        <div>
          <span>Impact Score</span>
          <strong>{entry.impactScore}</strong>
        </div>
      </div>
      <dl>
        <div><dt>Layer</dt><dd>{entry.element.layer}</dd></div>
        <div><dt>Status</dt><dd>{entry.element.status}</dd></div>
        <div><dt>Category</dt><dd>{entry.category}</dd></div>
      </dl>
      <p className="detail-rationale">{entry.rationale}</p>
      <div className="impacted-elements">
        <strong>Downstream impacted elements</strong>
        {entry.impactedElementIds.length === 0 ? (
          <p className="muted">No downstream impacted elements in the current model.</p>
        ) : (
          <ul>
            {entry.impactedElementIds.map((id) => {
              const element = elementById.get(id);
              return <li key={id}>{element ? `${element.name} - ${element.type}` : id}</li>;
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

function elementAbbreviation(type: ElementType): string {
  if (type === "Business Capability") return "CAP";
  if (type === "Business Process") return "PROC";
  if (type === "Application Component") return "APP";
  if (type === "Data Object") return "DATA";
  return "TECH";
}

function CapabilityMap({ model, heatmapMode }: { model: EamModel; heatmapMode: HeatmapMode }) {
  const capabilities = model.elements.filter((element) => element.type === "Business Capability");
  const processesByCapability = new Map<string, string[]>();
  const appsByCapability = new Map<string, EamElement[]>();

  for (const relation of model.relations.filter((item) => item.type === "realizes")) {
    processesByCapability.set(relation.target, [...(processesByCapability.get(relation.target) ?? []), relation.source]);
  }

  for (const relation of model.relations.filter((item) => item.type === "serves")) {
    for (const [capabilityId, processIds] of processesByCapability.entries()) {
      if (processIds.includes(relation.target)) {
        const app = model.elements.find((element) => element.id === relation.source && element.type === "Application Component");
        if (app) appsByCapability.set(capabilityId, [...(appsByCapability.get(capabilityId) ?? []), app]);
      }
    }
  }

  return (
    <div className="capability-grid">
      {capabilities.map((capability) => (
        <article key={capability.id} className="capability-card" style={{ borderTopColor: heatmapMode === "cost" ? costColor(capability.cost) : riskColors[capability.risk] }}>
          <h2>{capability.name}</h2>
          <p>{capability.description}</p>
          <span className={`badge ${capability.risk}`}>{capability.risk} risk</span>
          <h3>Applications</h3>
          <ul>
            {(appsByCapability.get(capability.id) ?? []).map((app) => <li key={app.id}>{app.name} - {app.status}</li>)}
          </ul>
        </article>
      ))}
    </div>
  );
}

function Roadmap({ model }: { model: EamModel }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Element</th>
            <th>Layer</th>
            <th>Status</th>
            <th>Start</th>
            <th>End of Life</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {[...model.elements].sort((a, b) => a.startDate.localeCompare(b.startDate)).map((element) => (
            <tr key={element.id} className={element.status === "deprecated" || element.status === "retired" ? "attention" : ""}>
              <td>{element.name}</td>
              <td>{element.layer}</td>
              <td>{element.status}</td>
              <td>{element.startDate}</td>
              <td>{element.endOfLifeDate}</td>
              <td>{element.cost.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuditLog({ entries }: { entries: AuditLogEntry[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td>{new Date(entry.timestamp).toLocaleString()}</td>
              <td>{entry.action}</td>
              <td>{entry.entityId}</td>
              <td>{entry.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
