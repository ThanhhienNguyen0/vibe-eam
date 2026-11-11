import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Eye, ListTree, Maximize, Maximize2, Minus, MousePointerClick, Plus, RotateCcw, Sparkles } from "lucide-react";
import type { ComponentType, ConnectionType, Viewpoint } from "../Sidebar/sidebarTypes";
import {
  compact,
  displayConnectionName,
  displayLayerName,
  displayRuleRationale,
  displaySeverity,
  displayTypeName,
  displayViewpointName,
  edgeLabel,
  layerColor,
  layerOf,
  sortLayers,
  viewpointNames,
  yesNo
} from "./metamodelLabels";
import type { DetailTarget, EdgeRule, GraphEdge, GraphMode } from "./metamodelLabels";
import { EmptyHint, LayerChip, layerIconFor } from "./ui";

const MODES: Array<[GraphMode, string, typeof Sparkles]> = [
  ["simplified", "Vereinfachte Kernansicht", Sparkles],
  ["detailed", "Detailansicht", ListTree],
  ["viewpoint", "Sichtbezogen", Eye]
];

const VIEW_WIDTH = 1240;
const VIEW_HEIGHT = 700;
const NODE_HALF_WIDTH = 92;
const NODE_HALF_HEIGHT = 26;

export function RuleGraphTab({
  componentTypes,
  allLayers,
  edges,
  ruleCatalog,
  tooDense,
  positions,
  selection,
  onSelect,
  viewpoints,
  mode,
  onModeChange,
  selectedViewpoint,
  presentationMode,
  onPresentationModeChange,
  onMoveNode,
  onResetLayout,
  layerFilter,
  onLayerFilterChange,
  onlyRequired,
  onOnlyRequiredChange,
  onResetFilters,
  hasData
}: {
  componentTypes: ComponentType[];
  allLayers: string[];
  edges: GraphEdge[];
  ruleCatalog: EdgeRule[];
  tooDense: boolean;
  positions: Map<string, { x: number; y: number }>;
  selection: DetailTarget;
  onSelect: (value: DetailTarget) => void;
  viewpoints: Viewpoint[];
  mode: GraphMode;
  onModeChange: (mode: GraphMode) => void;
  selectedViewpoint?: Viewpoint;
  presentationMode: boolean;
  onPresentationModeChange: (value: boolean) => void;
  onMoveNode: (typeId: string, position: { x: number; y: number }) => void;
  onResetLayout: () => void;
  layerFilter: string;
  onLayerFilterChange: (layer: string) => void;
  onlyRequired: boolean;
  onOnlyRequiredChange: (value: boolean) => void;
  onResetFilters: () => void;
  hasData: boolean;
}) {
  const dragRef = useRef<{ typeId: string; dx: number; dy: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /** null = fit to the available width. */
  const [zoom, setZoom] = useState<number | null>(null);
  const selfRuleCount = ruleCatalog.filter((item) => item.sourceType.id === item.targetType.id).length;
  const graphLayers = sortLayers(componentTypes.map(layerOf));
  const legendConnectionTypes = [...new Map(edges.flatMap((edge) => edge.connectionTypes).map((type) => [type.id, type])).values()];
  const selectedEdgeId = selection?.kind === "edge" ? selection.item.id : null;
  const selectedTypeId = selection?.kind === "type" ? selection.type.id : null;

  function currentScale(): number {
    if (zoom !== null) return zoom;
    const width = canvasRef.current?.clientWidth ?? VIEW_WIDTH;
    return width / VIEW_WIDTH;
  }

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
    dragRef.current = { typeId, dx: point.x - pos.x, dy: point.y - pos.y, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!dragRef.current) return;
    const point = getSvgPoint(event);
    if (!point) return;
    dragRef.current.moved = true;
    onMoveNode(dragRef.current.typeId, {
      x: Math.max(100, Math.min(VIEW_WIDTH - 100, point.x - dragRef.current.dx)),
      y: Math.max(40, Math.min(VIEW_HEIGHT - 40, point.y - dragRef.current.dy))
    });
  }

  function stopDrag() {
    // A drag should not open the detail panel; a plain click should.
    suppressClickRef.current = Boolean(dragRef.current?.moved);
    dragRef.current = null;
  }

  function handleNodeClick(type: ComponentType) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect({ kind: "type", type });
  }

  const showGraph = componentTypes.length > 0 && edges.length > 0;
  const svgStyle = zoom === null ? { width: "100%" } : { width: `${VIEW_WIDTH * zoom}px` };

  return (
    <section className="metamodel-graph-tab">
      <div className="mm-card mm-graph-toolbar">
        <div className="mm-graph-toolbar-row">
          <span className="mm-toolbar-label">Darstellungsmodus</span>
          <div className="mm-segmented" role="group" aria-label="Darstellungsmodus">
            {MODES.map(([value, label, Icon]) => (
              <button key={value} type="button" className={mode === value ? "active" : ""} aria-pressed={mode === value} onClick={() => onModeChange(value)}>
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
          <button type="button" className="mm-ghost-button" onClick={() => { onResetLayout(); setZoom(null); }}>
            <RotateCcw size={13} /> Layout zurücksetzen
          </button>
        </div>
        <div className="mm-graph-toolbar-row">
          <div className="mm-chip-row" aria-label="Layer-Schnellfilter">
            <button type="button" className={`mm-chip${layerFilter === "all" ? " active" : ""}`} onClick={() => onLayerFilterChange("all")}>Alle Layer</button>
            {allLayers.map((layer) => (
              <LayerChip key={layer} layer={layer} active={layerFilter === layer} onClick={() => onLayerFilterChange(layerFilter === layer ? "all" : layer)} />
            ))}
          </div>
          <div className="mm-chip-row mm-push-right">
            <button type="button" className={`mm-chip${onlyRequired ? " active" : ""}`} aria-pressed={onlyRequired} onClick={() => onOnlyRequiredChange(!onlyRequired)}>Nur Pflichtregeln</button>
            <button type="button" className={`mm-chip${presentationMode ? " active" : ""}`} aria-pressed={presentationMode} onClick={() => onPresentationModeChange(!presentationMode)}>
              <Maximize2 size={12} /> Präsentationsmodus
            </button>
          </div>
        </div>
      </div>

      {!presentationMode && (
        <div className="metamodel-graph-note">
          {mode === "simplified" && "Vereinfachte Ansicht: kuratierte EAM-Kernregeln, Selbstbezüge ausgeblendet. Knoten können verschoben werden."}
          {mode === "detailed" && "Detailansicht: Die Grafik gruppiert Beziehungen; der Regelkatalog darunter zeigt alle gefilterten Regeln vollständig."}
          {mode === "viewpoint" && `Sichtbezogen: Regeln für ${displayViewpointName(selectedViewpoint, "die gewählte Sicht")}. Die Sicht wählst du oben in der Filterleiste.`}
          {" "}BPMN-Typen sind ausgeblendet, solange nicht der Layer BPMN gewählt ist.
        </div>
      )}

      {mode !== "simplified" && !presentationMode && (
        <div className="metamodel-graph-coverage">
          <span><strong>{ruleCatalog.length}</strong> gefilterte Regeln im Katalog</span>
          <span><strong>{edges.length}</strong> gruppierte Kanten in der Grafik</span>
          <span><strong>{selfRuleCount}</strong> Selbstbezüge</span>
        </div>
      )}

      {!hasData && <EmptyHint text="Metamodell wird geladen …" />}
      {hasData && !showGraph && (
        <EmptyHint text="Keine Verbindungsregeln passen zu den aktuellen Filtern." action={{ label: "Filter zurücksetzen", onClick: onResetFilters }} />
      )}
      {tooDense && (
        <div className="metamodel-warning">Viele Regeln für eine einzelne Grafik. Die Grafik gruppiert alle sichtbaren Quelle-Ziel-Paare; der Regelkatalog darunter bleibt vollständig und einzeln lesbar.</div>
      )}

      {showGraph && (
        <div className={`mm-graph-shell${presentationMode ? " presentation" : ""}`}>
          <div className="mm-card mm-graph-stage">
            <div className="metamodel-graph-canvas mm-graph-canvas" ref={canvasRef}>
              <svg
                viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
                role="img"
                aria-label="Regelgrafik des Metamodells"
                style={svgStyle}
                onPointerMove={handlePointerMove}
                onPointerUp={stopDrag}
                onPointerLeave={stopDrag}
              >
                <defs>
                  <marker id="metamodel-arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
                    <path d="M0,0 L0,6 L9,3 z" fill="#334155" />
                  </marker>
                </defs>
                {edges.map((edge, index) => {
                  const source = positions.get(edge.sourceType.id);
                  const target = positions.get(edge.targetType.id);
                  if (!source || !target) return null;
                  const color = edge.connectionTypes[0]?.color ?? "#475569";
                  const lineStyle = edge.connectionTypes.length === 1 ? edge.connectionTypes[0]?.lineStyle : "solid";
                  const required = edge.rules.some((item) => item.rule.required);
                  const selected = selectedEdgeId === edge.id;
                  const related = selectedTypeId !== null && (edge.sourceType.id === selectedTypeId || edge.targetType.id === selectedTypeId);
                  const faded = (selectedTypeId !== null && !related) || (selectedEdgeId !== null && !selected);
                  const bend = index % 4 === 0 ? -40 : index % 4 === 1 ? -12 : index % 4 === 2 ? 24 : 54;
                  const midX = (source.x + target.x) / 2;
                  const midY = (source.y + target.y) / 2 + bend;
                  const label = compact(edgeLabel(edge), mode === "detailed" ? 24 : 34);
                  const labelWidth = Math.min(190, Math.max(64, label.length * 6.6 + 18));
                  const startX = source.x + (source.x <= target.x ? NODE_HALF_WIDTH + 4 : -NODE_HALF_WIDTH - 4);
                  const endX = target.x + (source.x <= target.x ? -NODE_HALF_WIDTH - 4 : NODE_HALF_WIDTH + 4);
                  const controlX1 = startX + (endX - startX) * 0.42;
                  const controlX2 = startX + (endX - startX) * 0.58;
                  const path = `M ${startX} ${source.y} C ${controlX1} ${source.y + bend}, ${controlX2} ${target.y + bend}, ${endX} ${target.y}`;
                  return (
                    <g key={edge.id} className={`metamodel-graph-edge${selected ? " selected" : ""}`} opacity={faded ? 0.25 : 1} onClick={() => onSelect({ kind: "edge", item: edge })}>
                      <path d={path} fill="none" stroke="transparent" strokeWidth="14" />
                      <path
                        d={path}
                        fill="none"
                        stroke={selected || related ? color : "#475569"}
                        strokeWidth={selected ? "3.2" : required ? "2.4" : "1.6"}
                        strokeDasharray={lineStyle === "dashed" ? "7 5" : lineStyle === "dotted" ? "2 5" : undefined}
                        markerEnd="url(#metamodel-arrow)"
                        opacity={selected || related ? "0.95" : "0.7"}
                      />
                      <rect x={midX - labelWidth / 2} y={midY - 24} width={labelWidth} height="22" rx="6" className="metamodel-edge-label-bg" stroke={selected ? color : undefined} />
                      <text x={midX} y={midY - 9} textAnchor="middle" className="metamodel-edge-label">{label}</text>
                    </g>
                  );
                })}
                {componentTypes.map((type) => {
                  const pos = positions.get(type.id);
                  if (!pos) return null;
                  const layer = layerOf(type);
                  const color = layerColor(layer);
                  const selected = selectedTypeId === type.id;
                  const Icon = layerIconFor(layer);
                  const name = compact(displayTypeName(type), 22);
                  return (
                    <g
                      key={type.id}
                      onPointerDown={(event) => startDrag(event, type.id)}
                      onClick={() => handleNodeClick(type)}
                      className={`metamodel-graph-node${selected ? " selected" : ""}`}
                    >
                      <title>{`${displayTypeName(type)} · ${displayLayerName(layer)}`}</title>
                      <rect x={pos.x - NODE_HALF_WIDTH} y={pos.y - NODE_HALF_HEIGHT} width={NODE_HALF_WIDTH * 2} height={NODE_HALF_HEIGHT * 2} rx="14" fill="#ffffff" />
                      <rect
                        className="mm-node-body"
                        x={pos.x - NODE_HALF_WIDTH}
                        y={pos.y - NODE_HALF_HEIGHT}
                        width={NODE_HALF_WIDTH * 2}
                        height={NODE_HALF_HEIGHT * 2}
                        rx="14"
                        fill={color}
                        fillOpacity="0.16"
                        stroke={color}
                        strokeWidth={selected ? 3.5 : 2}
                      />
                      <Icon x={pos.x - NODE_HALF_WIDTH + 14} y={pos.y - 10} width={20} height={20} color={color} strokeWidth={2.2} />
                      <text x={pos.x + 12} y={pos.y + 5} textAnchor="middle" className="metamodel-node-title">{name}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            <div className="mm-zoom" role="group" aria-label="Zoom">
              <button type="button" onClick={() => setZoom(null)} title="Einpassen" aria-label="Einpassen"><Maximize size={14} /></button>
              <button type="button" onClick={() => setZoom(Math.max(0.4, currentScale() / 1.2))} title="Verkleinern" aria-label="Verkleinern"><Minus size={14} /></button>
              <button type="button" onClick={() => setZoom(Math.min(2.2, currentScale() * 1.2))} title="Vergrößern" aria-label="Vergrößern"><Plus size={14} /></button>
            </div>
          </div>

          <aside className="mm-card mm-graph-legend-card" aria-label="Legende">
            <h4>Legende</h4>
            <ul className="mm-legend">
              {graphLayers.map((layer) => (
                <li key={layer}>
                  <button type="button" onClick={() => onLayerFilterChange(layerFilter === layer ? "all" : layer)}>
                    <i style={{ background: layerColor(layer), borderRadius: "50%" }} />{displayLayerName(layer)}
                  </button>
                </li>
              ))}
            </ul>
            <h4>Beziehungen</h4>
            <ul className="mm-relation-legend">
              {legendConnectionTypes.map((type) => <RelationLegendItem key={type.id} type={type} />)}
            </ul>
            <p className="mm-graph-hint"><MousePointerClick size={13} /> Knoten oder Kante anklicken für Details. Knoten sind verschiebbar; dicke Linien = Pflicht.</p>
          </aside>
        </div>
      )}

      {mode !== "simplified" && !presentationMode && (
        <RuleCatalog rules={ruleCatalog} viewpoints={viewpoints} onSelect={(item) => onSelect({ kind: "rule", item })} />
      )}
    </section>
  );
}

function RelationLegendItem({ type }: { type: ConnectionType }) {
  return (
    <li>
      <svg width="34" height="10" aria-hidden="true">
        <line
          x1="1"
          y1="5"
          x2="28"
          y2="5"
          stroke={type.color}
          strokeWidth="2"
          strokeDasharray={type.lineStyle === "dashed" ? "5 3" : type.lineStyle === "dotted" ? "1.5 3" : undefined}
        />
        <path d="M28,1 L33,5 L28,9 z" fill={type.color} />
      </svg>
      {displayConnectionName(type)}
    </li>
  );
}

function RuleCatalog({ rules, viewpoints, onSelect }: { rules: EdgeRule[]; viewpoints: Viewpoint[]; onSelect: (item: EdgeRule) => void }) {
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
              <tr key={item.rule.id} className="mm-clickable-row" onClick={() => onSelect(item)}>
                <td>{displayTypeName(item.sourceType)}</td>
                <td><strong style={{ color: item.connectionType.color }}>{displayConnectionName(item.connectionType)}</strong></td>
                <td>{displayTypeName(item.targetType)}</td>
                <td>{yesNo(item.rule.allowed)}</td>
                <td>{yesNo(item.rule.required)}</td>
                <td>{displaySeverity(item.rule.severity)}</td>
                <td>{viewpointNames(item.rule.viewpointIds, viewpoints)}</td>
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
