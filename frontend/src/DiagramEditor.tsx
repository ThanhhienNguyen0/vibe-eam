import type { ReactNode } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type RefObject } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlowProvider,
  useReactFlow,
  useStore,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  useEdgesState,
  useNodesState
} from "reactflow";
import { ChevronDown, ChevronUp, CircleCheck, GitBranch, Grid3x3, Link2, Maximize, MousePointerClick, PanelLeftClose, PanelLeftOpen, Ruler, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import DiagramCoordinates from "./DiagramCoordinates";
import DiagramExportDialog, { type ExportChoice } from "./DiagramExportDialog";
import { copyText } from "./CopyLinkButton";
import { fitMenuInViewport } from "./contextMenuPosition";
import ShareMenu from "./ShareMenu";
import { absoluteLink, viewParam, type FocusTarget } from "./deepLink";
import {
  buildExportScene,
  clampPngScale,
  cropScene,
  downloadBlob,
  exportSize,
  renderDiagramSvg,
  renderIconMarkup,
  sceneBounds,
  sceneIcons,
  svgToPngBlob,
  viewportArea
} from "./diagramExport";
import ComponentTypeIcon from "./componentIcons";
import {
  EMPTY_SELECTION,
  applySelectChanges,
  diagramRemoval,
  diagramShortcut,
  isSelectionEmpty,
  pruneSelection,
  removalConfirmation,
  removalNotice,
  selectionForPanelElement,
  selectionLabel,
  visibleElementIds,
  type DiagramSelection,
  type SelectChange
} from "./diagramSelection";
import { isRectVisible, paletteAfterResize } from "./viewportFit";
import { GRID_SIZE as GRID_BG, changedNodeLayout, fallbackPosition, findFreePosition, shapeDefaultSize, snapPoint, type Rect } from "./diagramLayout";
import { sidebarApi } from "./Sidebar/sidebarApi";
import { runOptimisticMutation } from "./optimisticConflict";
import DuplicateHint from "./Sidebar/DuplicateHint";
import { elementNameError, placeholderQuestion, placeholderWarning } from "./Sidebar/nameRules";
import { useSecondConfirmation } from "./Sidebar/useSecondConfirmation";
import { deleteComponentConfirmation, findDuplicateComponents } from "./Sidebar/repositoryReferences";
import { useConfirm } from "./ConfirmDialog";
import { useAccess } from "./access";
import {
  getAllowedConnectionTypes,
  getApplicableViewpoints,
  getViewpointRule,
  isLocalViewpointPreview,
  projectDiagramToViewpoint,
  runIfDiagramWritable,
  validateDiagram,
  type DiagramValidationResult
} from "./Sidebar/metamodelRules";
import { COMPONENT_DRAG_MIME, COMPONENT_TYPE_DRAG_MIME } from "./Sidebar/sidebarTypes";
import type {
  ComponentInstance,
  ConnectionRule,
  ComponentShape,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  DiagramPosition,
  Metamodel,
  ValidationRule,
  ViewpointRule,
  Viewpoint
} from "./Sidebar/sidebarTypes";

interface Props {
  diagram: Diagram;
  /** All diagrams, needed to warn about other usages before deleting from the repository. */
  diagrams: Diagram[];
  metamodel: Metamodel;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  connectionRules: ConnectionRule[];
  viewpointRules: ViewpointRule[];
  validationRules: ValidationRule[];
  viewpoints: Viewpoint[];
  components: ComponentInstance[];
  connections: ConnectionInstance[];
  onDiagramChange: (updated: Diagram) => void;
  onConnectionCreated: (conn: ConnectionInstance) => void;
  onComponentCreated: (comp: ComponentInstance) => void;
  onComponentDeleted: (id: string) => void;
  onSelectComponent: (id: string) => void;
  onSelectConnection: (id: string) => void;
  onClose: () => void;
  /** REQ-12: Element aus einem Link markieren, zentrieren und kurz hervorheben (nonce = neuer Auftrag). */
  focusRequest?: { target: FocusTarget; nonce: number } | null;
  /** REQ-12: Ansichtsfilter aus einem Link setzen (Filter-ID, „“ = Alle Inhalte). */
  viewRequest?: { filterId: string; nonce: number } | null;
  /** Meldet den aktuell gewählten Ansichtsfilter, damit die Adresszeile ihn mitführt. */
  onViewChange?: (filterId: string) => void;
  /** #123: im Detail-Panel geöffnete Komponente/Verbindung – wird auf der Fläche markiert (null = nichts gewählt). */
  selectedElementId?: string | null;
}

interface Suggestion {
  conn: ConnectionInstance;
  otherComp: ComponentInstance | null;
  isCompAlreadyInDiagram: boolean;
  selected: boolean;
}

interface PendingAdd {
  compId: string;
  suggestions: Suggestion[];
  position?: DiagramPosition;
}

interface ContextMenu {
  visible: boolean;
  x: number;
  y: number;
  nodeId: string;
}

export type ConnectionModeAction =
  | { type: "start"; sourceId: string }
  | { type: "cancel" }
  | { type: "viewpoint-changed"; localPreviewActive: boolean };

export function connectionModeReducer(state: string | null, action: ConnectionModeAction): string | null {
  if (action.type === "start") return action.sourceId;
  if (action.type === "cancel") return null;
  return action.localPreviewActive ? null : state;
}

export function mergeSmartAddMemberships(
  diagram: Pick<Diagram, "componentIds" | "connectionIds">,
  componentId: string,
  extraComponentIds: string[],
  extraConnectionIds: string[]
): { componentIds: string[]; connectionIds: string[]; newComponentIds: string[] } {
  const existingComponentIds = new Set([...diagram.componentIds, componentId]);
  const componentIds = [...new Set([...diagram.componentIds, componentId, ...extraComponentIds])];
  const connectionIds = [...new Set([...diagram.connectionIds, ...extraConnectionIds])];
  const newComponentIds = [...new Set(extraComponentIds)].filter((id) => !existingComponentIds.has(id));

  return { componentIds, connectionIds, newComponentIds };
}

export async function handleDiagramNodeClick({
  connectingFrom,
  targetId,
  canWrite,
  cancelConnectionMode,
  selectComponent,
  createConnection
}: {
  connectingFrom: string | null;
  targetId: string;
  canWrite: boolean;
  cancelConnectionMode: () => void;
  selectComponent: (id: string) => void;
  createConnection: (sourceId: string, targetId: string) => Promise<void>;
}): Promise<void> {
  if (!connectingFrom) {
    selectComponent(targetId);
    return;
  }
  cancelConnectionMode();
  if (!canWrite || targetId === connectingFrom) return;
  await createConnection(connectingFrom, targetId);
}

const SELECTION_COLOR = "#2563eb";

const lineStyleDash: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "6 3",
  dotted: "2 3"
};

/* ── Custom Node: rendert Komponenten je nach Form (BPMN-angelehnt) ─────────── */

const SHAPE_MIN_SIZES: Record<ComponentShape, { width: number; height: number }> = {
  box: { width: 80, height: 48 },
  process: { width: 80, height: 48 },
  datastore: { width: 90, height: 56 },
  event: { width: 64, height: 64 },
  "event-start": { width: 64, height: 64 },
  "event-end": { width: 64, height: 64 },
  gateway: { width: 72, height: 72 },
  "gateway-xor": { width: 72, height: 72 },
  "gateway-and": { width: 72, height: 72 },
  "gateway-or": { width: 72, height: 72 },
  pool: { width: 240, height: 140 }
};

type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const RESIZE_HANDLES: { dir: ResizeDirection; className: string }[] = [
  { dir: "nw", className: "node-resize-corner node-resize-nw" },
  { dir: "n", className: "node-resize-edge node-resize-n" },
  { dir: "ne", className: "node-resize-corner node-resize-ne" },
  { dir: "e", className: "node-resize-edge node-resize-e" },
  { dir: "se", className: "node-resize-corner node-resize-se" },
  { dir: "s", className: "node-resize-edge node-resize-s" },
  { dir: "sw", className: "node-resize-corner node-resize-sw" },
  { dir: "w", className: "node-resize-edge node-resize-w" }
];

interface ShapedNodeData {
  name: string;
  typeName: string;
  typeIcon?: string;
  color: string;
  shape: ComponentShape;
  isSource: boolean;
  showInteraction: boolean;
  onInteractionStart?: (nodeId: string) => void;
  /** `start` is the node as rendered when the gesture began, so the editor can skip saving unchanged layouts (#109). */
  onTransformEnd?: (nodeId: string, end: NodeTransform, start: NodeTransform) => void;
}

type NodeTransform = { x: number; y: number; width: number; height: number };

/**
 * Interaktions-Overlay mit strikt getrennten Zonen:
 * - Mitte (node-move-zone): NUR verschieben
 * - Kanten: NUR in einer Richtung skalieren
 * - Ecken: NUR in zwei Richtungen skalieren
 * Resize-Zonen liegen über der Move-Zone (z-index), damit keine Konflikte entstehen.
 */
function NodeInteractionOverlay({
  nodeId,
  shape,
  visible,
  onInteractionStart,
  onTransformEnd
}: {
  nodeId: string;
  shape: ComponentShape;
  visible: boolean;
  onInteractionStart?: ShapedNodeData["onInteractionStart"];
  onTransformEnd?: ShapedNodeData["onTransformEnd"];
}) {
  const { getNode, setNodes, getZoom } = useReactFlow();
  const mins = SHAPE_MIN_SIZES[shape] ?? SHAPE_MIN_SIZES.box;
  const resizeSessionRef = useRef<{
    dir: ResizeDirection;
    x: number;
    y: number;
    width: number;
    height: number;
    px: number;
    py: number;
  } | null>(null);
  const moveSessionRef = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
    px: number;
    py: number;
  } | null>(null);

  if (!visible) return null;

  function applyTransform(transform: NodeTransform) {
    setNodes((nodes) =>
      nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              width: transform.width,
              height: transform.height,
              position: { x: transform.x, y: transform.y },
              style: { ...n.style, width: transform.width, height: transform.height }
            }
          : n
      )
    );
  }

  function computeResize(dir: ResizeDirection, clientX: number, clientY: number) {
    const start = resizeSessionRef.current;
    if (!start) return null;
    const zoom = getZoom();
    const dx = (clientX - start.px) / zoom;
    const dy = (clientY - start.py) / zoom;

    let { x, y, width, height } = start;

    if (dir.includes("e")) width = Math.max(mins.width, start.width + dx);
    if (dir.includes("w")) {
      const nextW = Math.max(mins.width, start.width - dx);
      x = start.x + (start.width - nextW);
      width = nextW;
    }
    if (dir.includes("s")) height = Math.max(mins.height, start.height + dy);
    if (dir.includes("n")) {
      const nextH = Math.max(mins.height, start.height - dy);
      y = start.y + (start.height - nextH);
      height = nextH;
    }

    return { x, y, width, height };
  }

  function computeMove(clientX: number, clientY: number) {
    const start = moveSessionRef.current;
    if (!start) return null;
    const zoom = getZoom();
    const dx = (clientX - start.px) / zoom;
    const dy = (clientY - start.py) / zoom;
    return { x: start.x + dx, y: start.y + dy, width: start.width, height: start.height };
  }

  function bindPointerSession(
    target: HTMLElement,
    e: React.PointerEvent,
    onMove: (ev: PointerEvent) => void,
    onFinish: (ev: PointerEvent) => void
  ) {
    target.setPointerCapture(e.pointerId);
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", onUp);
      onFinish(ev);
    };
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", onUp);
  }

  function onResizePointerDown(dir: ResizeDirection) {
    return (e: React.PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const node = getNode(nodeId);
      if (!node?.width || !node?.height) return;

      onInteractionStart?.(nodeId);
      resizeSessionRef.current = {
        dir,
        x: node.position.x,
        y: node.position.y,
        width: node.width,
        height: node.height,
        px: e.clientX,
        py: e.clientY
      };

      const target = e.currentTarget as HTMLElement;
      bindPointerSession(
        target,
        e,
        (ev) => {
          const transform = computeResize(dir, ev.clientX, ev.clientY);
          if (transform) applyTransform(transform);
        },
        (ev) => {
          const start = resizeSessionRef.current;
          const transform = computeResize(dir, ev.clientX, ev.clientY);
          resizeSessionRef.current = null;
          if (start && transform) onTransformEnd?.(nodeId, transform, start);
        }
      );
    };
  }

  function onMovePointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const node = getNode(nodeId);
    if (!node?.width || !node?.height) return;

    onInteractionStart?.(nodeId);
    moveSessionRef.current = {
      x: node.position.x,
      y: node.position.y,
      width: node.width,
      height: node.height,
      px: e.clientX,
      py: e.clientY
    };

    const target = e.currentTarget as HTMLElement;
    bindPointerSession(
      target,
      e,
      (ev) => {
        const transform = computeMove(ev.clientX, ev.clientY);
        if (transform) applyTransform(transform);
      },
      (ev) => {
        const start = moveSessionRef.current;
        const transform = computeMove(ev.clientX, ev.clientY);
        moveSessionRef.current = null;
        if (start && transform) onTransformEnd?.(nodeId, transform, start);
      }
    );
  }

  return (
    <div className="node-interaction-overlay nodrag nopan nowheel">
      <div
        className="node-move-zone nodrag nopan nowheel"
        onPointerDown={onMovePointerDown}
      />
      {RESIZE_HANDLES.map(({ dir, className }) => (
        <div
          key={dir}
          className={`node-resize-zone nodrag nopan nowheel ${className}`}
          onPointerDown={onResizePointerDown(dir)}
        />
      ))}
    </div>
  );
}

function ShapedNode({ id, data, selected }: NodeProps<ShapedNodeData>) {
  const { name, typeName, color, shape, isSource } = data;
  const typeBadge = (
    <span className="node-type-badge" style={{ color }} title={typeName}>
      <ComponentTypeIcon icon={data.typeIcon} typeName={typeName} shape={shape} size={14} />
    </span>
  );
  const showOverlay = !!(selected || data.showInteraction);
  const shellClass = (base: string) =>
    `${base}${isSource ? " is-source" : ""}${selected ? " is-node-selected" : ""}${showOverlay ? " is-interaction-visible" : ""}`;

  const interactionOverlay = (
    <NodeInteractionOverlay
      nodeId={id}
      shape={shape}
      visible={showOverlay}
      onInteractionStart={data.onInteractionStart}
      onTransformEnd={data.onTransformEnd}
    />
  );

  const handles = (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
      {/* #127: Unsichtbare Andockpunkte, damit Verbindungen an der Seite ansetzen, die zum Gegenüber zeigt. */}
      <Handle id="s-top" type="source" position={Position.Top} className="diagram-auto-handle" isConnectable={false} />
      <Handle id="s-bottom" type="source" position={Position.Bottom} className="diagram-auto-handle" isConnectable={false} />
      <Handle id="s-left" type="source" position={Position.Left} className="diagram-auto-handle" isConnectable={false} />
      <Handle id="t-top" type="target" position={Position.Top} className="diagram-auto-handle" isConnectable={false} />
      <Handle id="t-bottom" type="target" position={Position.Bottom} className="diagram-auto-handle" isConnectable={false} />
      <Handle id="t-right" type="target" position={Position.Right} className="diagram-auto-handle" isConnectable={false} />
    </>
  );

  if (shape === "pool") {
    return (
      <div className={shellClass("shaped-node shape-pool")} style={{ borderColor: color }}>
        {interactionOverlay}
        <div className="shape-pool-band" style={{ background: color }}>
          <span>{name}</span>
          <span className="node-type-badge node-type-badge--inline"><ComponentTypeIcon icon={data.typeIcon} typeName={typeName} shape={shape} size={14} /></span>
        </div>
        <div className="shape-pool-body">
          <span>{typeName}</span>
        </div>
        {handles}
      </div>
    );
  }

  if (shape === "event" || shape === "event-start" || shape === "event-end") {
    const variant = shape === "event-start" ? "start" : shape === "event-end" ? "end" : "intermediate";
    return (
      <div className={shellClass("shaped-node shape-event")}>
        {interactionOverlay}
        <div className={`shape-event-circle shape-event-circle--${variant}`} style={{ borderColor: color }}>
          {variant === "intermediate" && <div className="shape-event-inner" style={{ borderColor: color }} />}
          <strong>{name}</strong>
        </div>
        <span className="shape-caption">{typeName}</span>
        {handles}
      </div>
    );
  }

  if (shape === "gateway" || shape === "gateway-xor" || shape === "gateway-and" || shape === "gateway-or") {
    // #126: Raute und Marker als ein SVG – bleibt quadratisch und zentriert, egal wie groß der Knoten ist.
    return (
      <div className={shellClass("shaped-node shape-gateway")}>
        {interactionOverlay}
        <div className="shape-gateway-diamond">
          <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
            <polygon className="shape-gateway-outline" points="50,3 97,50 50,97 3,50" fill="#ffffff" stroke={color} strokeWidth={4} strokeLinejoin="round" />
            <GatewayMarker shape={shape} color={color} />
          </svg>
        </div>
        <div className="shape-gateway-label">
          <strong>{name}</strong>
          <span className="shape-caption">{typeName}</span>
        </div>
        {handles}
      </div>
    );
  }

  if (shape === "datastore") {
    return (
      <div className={shellClass("shaped-node shape-datastore")} style={{ borderColor: color }}>
        {interactionOverlay}
        <div className="shape-datastore-top" style={{ borderColor: color }} />
        {typeBadge}
        <strong>{name}</strong>
        <span>{typeName}</span>
        {handles}
      </div>
    );
  }

  if (shape === "process") {
    return (
      <div className={shellClass("shaped-node shape-process")} style={{ borderColor: color }}>
        {interactionOverlay}
        {typeBadge}
        <strong>{name}</strong>
        <span>{typeName}</span>
        {handles}
      </div>
    );
  }

  return (
    <div
      className={shellClass("shaped-node shape-box")}
      style={{ borderColor: color, borderLeftColor: color }}
    >
      {interactionOverlay}
      {typeBadge}
      <strong>{name}</strong>
      <span>{typeName}</span>
      {handles}
    </div>
  );
}

const nodeTypes = { shaped: ShapedNode };

/** #127: Lage und Größe eines Knotens aus gespeicherter Position und Formstandard – Grundlage für die Andockseite. */
export function componentRectLookup(
  diagram: Diagram,
  components: ComponentInstance[],
  componentTypes: ComponentType[]
): (componentId: string) => Rect | null {
  return (componentId) => {
    if (!diagram.componentIds.includes(componentId)) return null;
    const comp = components.find((c) => c.id === componentId);
    const shape = componentTypes.find((t) => t.id === comp?.componentTypeId)?.shape ?? "box";
    if (shape === "pool") return null; // Pools umschließen andere Knoten – dort bleibt es bei links/rechts.
    const pos = diagram.positions[componentId] ?? fallbackPosition(Math.max(diagram.componentIds.indexOf(componentId), 0));
    const defaults = shapeDefaultSize(shape);
    return { x: pos.x, y: pos.y, width: pos.width ?? defaults.width, height: pos.height ?? defaults.height };
  };
}

export function buildNodes(
  diagram: Diagram,
  components: ComponentInstance[],
  componentTypes: ComponentType[],
  connectingFrom: string | null,
  hoveredNodeId: string | null,
  activeNodeId: string | null,
  onInteractionStart: ShapedNodeData["onInteractionStart"],
  onTransformEnd: ShapedNodeData["onTransformEnd"],
  canEdit: boolean,
  highlightId: string | null = null,
  selectedNodeIds: ReadonlySet<string> = new Set()
): Node[] {
  return diagram.componentIds.flatMap((id) => {
    const comp = components.find((c) => c.id === id);
    if (!comp) return [];
    const type = componentTypes.find((t) => t.id === comp.componentTypeId);
    const shape = type?.shape ?? "box";
    const pos = diagram.positions[id] ?? fallbackPosition(Math.max(diagram.componentIds.indexOf(id), 0));
    const isPool = shape === "pool";
    const defaults = shapeDefaultSize(shape);
    const width = pos.width ?? defaults.width;
    const height = pos.height ?? defaults.height;
    const node: Node = {
      id: comp.id,
      type: "shaped",
      position: { x: pos.x, y: pos.y },
      width,
      height,
      data: {
        name: comp.name,
        typeName: type?.name ?? "?",
        typeIcon: type?.icon,
        color: type?.color ?? "#cbd5e1",
        shape,
        isSource: connectingFrom === id,
        showInteraction: canEdit && (id === hoveredNodeId || id === activeNodeId),
        onInteractionStart,
        onTransformEnd
      } satisfies ShapedNodeData,
      style: { width, height },
      draggable: false,
      // #119/#123: Auswahl kommt ausschließlich aus dem Editor-State, nie aus einem Rest-Zustand von React Flow.
      selected: selectedNodeIds.has(id),
      // REQ-12: per Link angesprungenes Element pulsiert kurz, damit man es sofort findet (Auswahl setzt der Editor).
      ...(id === highlightId ? { className: "is-link-target" } : {}),
      ...(isPool ? { zIndex: -1 } : {})
    };
    return [node];
  });
}

type Side = "top" | "right" | "bottom" | "left";
const OPPOSITE: Record<Side, Side> = { top: "bottom", bottom: "top", left: "right", right: "left" };

/**
 * #127: Seite, an der eine Verbindung den Quell- und den Zielknoten verlässt bzw. erreicht.
 * Liegen die Knoten übereinander (z. B. Capabilities untereinander), wird oben/unten angedockt,
 * sonst links/rechts – so laufen Linien nicht um Knoten herum und überlagern sich weniger.
 */
export function edgeSides(source: Rect, target: Rect): { source: Side; target: Side } {
  const scx = source.x + source.width / 2;
  const scy = source.y + source.height / 2;
  const tcx = target.x + target.width / 2;
  const tcy = target.y + target.height / 2;
  const overlapX = target.x < source.x + source.width && target.x + target.width > source.x;
  const overlapY = target.y < source.y + source.height && target.y + target.height > source.y;
  const vertical = overlapX && !overlapY ? true : overlapY && !overlapX ? false : Math.abs(tcy - scy) > Math.abs(tcx - scx);
  const side: Side = vertical ? (tcy >= scy ? "bottom" : "top") : (tcx >= scx ? "right" : "left");
  return { source: side, target: OPPOSITE[side] };
}

/** Handle-IDs zu den Seiten; rechts (Quelle) und links (Ziel) sind die sichtbaren Standard-Handles ohne ID. */
export function edgeHandles(sides: { source: Side; target: Side }): { sourceHandle?: string; targetHandle?: string } {
  return {
    ...(sides.source === "right" ? {} : { sourceHandle: `s-${sides.source}` }),
    ...(sides.target === "left" ? {} : { targetHandle: `t-${sides.target}` })
  };
}

export function buildEdges(
  diagram: Diagram,
  connections: ConnectionInstance[],
  connectionTypes: ConnectionType[],
  highlightId: string | null = null,
  selectedEdgeIds: ReadonlySet<string> = new Set(),
  rectOf?: (componentId: string) => Rect | null
): Edge[] {
  return diagram.connectionIds.flatMap((id) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return [];
    if (!diagram.componentIds.includes(conn.sourceComponentId) || !diagram.componentIds.includes(conn.targetComponentId)) return [];
    const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
    const highlighted = id === highlightId;
    const selected = selectedEdgeIds.has(id);
    // #123: Die Typfarbe steht inline am Pfad und schlägt jedes CSS – deshalb Auswahlfarbe hier setzen.
    const stroke = selected ? SELECTION_COLOR : type?.color ?? "#475569";
    const sourceRect = rectOf?.(conn.sourceComponentId);
    const targetRect = rectOf?.(conn.targetComponentId);
    const handles = sourceRect && targetRect && conn.sourceComponentId !== conn.targetComponentId
      ? edgeHandles(edgeSides(sourceRect, targetRect))
      : {};
    return [
      {
        id: conn.id,
        ...handles,
        selected,
        ...(highlighted ? { className: "is-link-target", animated: true } : {}),
        source: conn.sourceComponentId,
        target: conn.targetComponentId,
        label: conn.name || type?.name || "",
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fill: "#172033", fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
        markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        style: {
          stroke,
          strokeWidth: highlighted ? 4 : selected ? 3 : 2,
          strokeDasharray: lineStyleDash[type?.lineStyle ?? "solid"]
        }
      }
    ];
  });
}

/**
 * #123: Schreibt den aktuellen Zoom als CSS-Variable an die Fläche, damit Auswahlrahmen und -schein
 * auf dem Bildschirm in jeder Zoomstufe gleich dick bleiben. Eigene Komponente, damit nicht der ganze
 * Editor bei jedem Zoom-Schritt neu rendert.
 */
function ZoomCssVariable({ target }: { target: RefObject<HTMLDivElement> }) {
  const zoom = useStore((state) => state.transform[2]);
  useLayoutEffect(() => {
    target.current?.style.setProperty("--diagram-zoom", String(zoom || 1));
  }, [target, zoom]);
  return null;
}

/* ── Komponenten-Palette (Drag & Drop oder Klick) ───────────────────────────── */

interface PaletteProps {
  components: ComponentInstance[];
  componentTypes: ComponentType[];
  onAdd: (compId: string) => void;
}

function Palette({ components, componentTypes, onAdd }: PaletteProps) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const visible = q
    ? components.filter((c) => c.name.toLowerCase().includes(q))
    : components;

  const groups = useMemo(() => {
    const usedTypeIds = [...new Set(visible.map((c) => c.componentTypeId))];
    const grouped = componentTypes
      .filter((ct) => usedTypeIds.includes(ct.id))
      .map((ct) => ({ type: ct, items: visible.filter((c) => c.componentTypeId === ct.id) }));
    const ungrouped = visible.filter((c) => !componentTypes.find((t) => t.id === c.componentTypeId));
    return { grouped, ungrouped };
  }, [visible, componentTypes]);

  return (
    <aside className="diagram-palette" aria-label="Komponenten-Palette">
      <div className="diagram-palette-header">
        <strong>Komponenten</strong>
        <span className="muted">Ziehen oder klicken</span>
      </div>
      <div className="diagram-palette-search">
        <Search size={12} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filtern…"
          aria-label="Palette filtern"
        />
        {q && <button title="Filter leeren" onClick={() => setQuery("")}><X size={11} /></button>}
      </div>
      <div className="diagram-palette-list">
        {groups.grouped.map(({ type, items }) => (
          <div key={type.id} className="diagram-palette-group">
            <div className="diagram-palette-group-label">
              <ComponentTypeIcon icon={type.icon} typeName={type.name} shape={type.shape} color={type.color} size={14} />
              {type.name}
            </div>
            {items.map((comp) => (
              <PaletteItem key={comp.id} comp={comp} color={type.color} shape={type.shape ?? "box"} icon={<ComponentTypeIcon icon={type.icon} typeName={type.name} shape={type.shape} color={type.color} size={14} />} onAdd={onAdd} />
            ))}
          </div>
        ))}
        {groups.ungrouped.map((comp) => (
          <PaletteItem key={comp.id} comp={comp} color="#cbd5e1" shape="box" onAdd={onAdd} />
        ))}
        {components.length === 0 && (
          <p className="diagram-palette-empty">Alle Komponenten sind bereits im Diagramm.</p>
        )}
        {components.length > 0 && visible.length === 0 && (
          <p className="diagram-palette-empty">Keine Treffer.</p>
        )}
      </div>
    </aside>
  );
}

/** #142: Bewegung bis zu dieser Strecke gilt als Klick, nicht als Ziehen. */
const PALETTE_CLICK_TOLERANCE = 6;

export function isPaletteClick(start: { x: number; y: number }, end: { x: number; y: number }): boolean {
  // Manche Browser melden beim Abbruch keine Koordinaten (0,0) – im Zweifel nichts hinzufügen.
  if (end.x === 0 && end.y === 0) return false;
  return Math.hypot(end.x - start.x, end.y - start.y) <= PALETTE_CLICK_TOLERANCE;
}

function PaletteItem({
  comp,
  color,
  shape,
  icon,
  onAdd
}: {
  comp: ComponentInstance;
  color: string;
  shape: ComponentShape;
  icon?: ReactNode;
  onAdd: (id: string) => void;
}) {
  // #142: Bei draggable-Elementen startet der Browser schon bei minimaler Mausbewegung einen Drag – dann
  // kommt kein click an. Ein „Drag“ ohne Ablage und praktisch ohne Weg zählt deshalb als Klick.
  const press = useRef<{ x: number; y: number } | null>(null);
  const handledAsClick = useRef(false);
  return (
    <button
      type="button"
      className="diagram-palette-item"
      style={{ borderLeftColor: color }}
      draggable
      onPointerDown={(e) => {
        press.current = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
        handledAsClick.current = false;
      }}
      onDragStart={(e) => {
        e.dataTransfer.setData(COMPONENT_DRAG_MIME, comp.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onDragEnd={(e) => {
        const start = press.current;
        press.current = null;
        if (!start || e.dataTransfer.dropEffect !== "none") return;
        if (isPaletteClick(start, { x: e.clientX, y: e.clientY })) {
          handledAsClick.current = true;
          onAdd(comp.id);
        }
      }}
      onClick={() => {
        press.current = null;
        if (handledAsClick.current) {
          handledAsClick.current = false;
          return;
        }
        onAdd(comp.id);
      }}
      title="Auf die Fläche ziehen oder klicken zum Hinzufügen"
    >
      {icon ?? <span className={`shape-glyph shape-glyph--${shape}`} style={{ borderColor: color }} />}
      <strong>{comp.name}</strong>
    </button>
  );
}

/* ── Dialog: Neue Komponente aus gezogenem Typ erstellen ────────────────────── */

function CreateComponentDialog({
  type,
  components,
  onConfirm,
  onUseExisting,
  onShowExisting,
  onCancel
}: {
  type: ComponentType;
  components: ComponentInstance[];
  onConfirm: (name: string, properties: Record<string, string>, acknowledgeDuplicate: boolean, acknowledgePlaceholder: boolean) => Promise<void>;
  onUseExisting: (id: string) => void;
  onShowExisting: (id: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [properties, setProperties] = useState<Record<string, string>>({});
  // While saving, the new element is already in `components` and would match itself.
  const [saving, setSaving] = useState(false);
  // #113: same name rule as everywhere else; the error shows once something was typed.
  const nameError = elementNameError(name);
  const placeholderHint = placeholderWarning(name);
  const placeholderStep = useSecondConfirmation(placeholderHint, name);
  const canConfirm = !nameError && !saving;
  const duplicates = saving ? [] : findDuplicateComponents(components, { name, componentTypeId: type.id });

  async function confirm() {
    if (!canConfirm) return;
    // A placeholder name needs a second click (or Enter) before the component is created.
    if (!placeholderStep.confirm()) return;
    setSaving(true);
    try {
      await onConfirm(name.trim(), properties, duplicates.length > 0, placeholderHint !== null);
    } finally {
      setSaving(false);
    }
  }

  const confirmLabel = placeholderStep.awaiting
    ? "Ja, mit Platzhalter anlegen"
    : duplicates.length > 0 ? "Trotzdem neu anlegen" : "Erstellen & einfügen";

  return (
    <div className="diagram-suggestion-overlay" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
      <div className="diagram-suggestion-card">
        <div className="diagram-suggestion-header">
          <strong>Neue Komponente erstellen</strong>
          <button className="sb-close-btn" onClick={onCancel}><X size={14} /></button>
        </div>
        <div className="diagram-create-type">
          <span className={`shape-glyph shape-glyph--${type.shape ?? "box"}`} style={{ borderColor: type.color }} />
          <span>Typ: <strong>{type.name}</strong></span>
        </div>
        <div className="sb-form">
          <label>Name
            <input
              autoFocus
              value={name}
              placeholder="Aussagekräftigen Namen eingeben"
              aria-invalid={name && nameError ? true : undefined}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
            {name && nameError && <span className="sb-field-error" role="alert">{nameError}</span>}
            {placeholderHint && !placeholderStep.awaiting && <span className="sb-field-hint">{placeholderHint}</span>}
          </label>
          {placeholderStep.awaiting && (
            <p className="sb-field-confirm" role="alert">
              {placeholderQuestion(name)} Zum Bestätigen noch einmal auf „{confirmLabel}“ klicken.
            </p>
          )}
          {type.customPropertyKeys.map((k) => (
            <label key={k}>{k}
              <input
                value={properties[k] ?? ""}
                onChange={(e) => setProperties((p) => ({ ...p, [k]: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && confirm()}
              />
            </label>
          ))}
        </div>
        <DuplicateHint
          duplicates={duplicates}
          typeName={type.name}
          onOpen={onShowExisting}
          onUseExisting={onUseExisting}
          note="„Trotzdem neu anlegen“ erzeugt ein zweites Element; das wird im Audit Log vermerkt."
        />
        <div className="diagram-suggestion-actions">
          <button className="sb-save-btn" style={{ margin: 0 }} disabled={!canConfirm} onClick={confirm}>
            {saving ? "Wird angelegt …" : confirmLabel}
          </button>
          <button onClick={onCancel}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}

/* ── Editor ─────────────────────────────────────────────────────────────────── */

function DiagramEditorInner({
  diagram,
  diagrams,
  metamodel,
  componentTypes,
  connectionTypes,
  connectionRules,
  viewpointRules,
  validationRules,
  viewpoints,
  components,
  connections,
  onDiagramChange,
  onConnectionCreated,
  onComponentCreated,
  onComponentDeleted,
  onSelectComponent,
  onSelectConnection,
  onClose,
  focusRequest,
  viewRequest,
  onViewChange,
  selectedElementId = null
}: Props) {
  const { canWrite: roleCanWrite } = useAccess();
  const confirm = useConfirm();
  const [viewpointFilterId, setViewpointFilterId] = useState(diagram.viewpointId ?? "");
  const localPreviewActive = isLocalViewpointPreview(diagram, viewpointFilterId || undefined);
  const canWrite = roleCanWrite && !localPreviewActive;
  const runMutation = useCallback(
    <T,>(mutation: () => Promise<T>) => runIfDiagramWritable(canWrite, mutation),
    [canWrite]
  );
  const updateDiagramWithConflict = useCallback(async (current: Diagram, patch: Partial<Diagram>) => {
    const result = await runMutation(() => runOptimisticMutation(
      current.version ?? 1,
      (version) => sidebarApi.updateDiagram(current.id, patch, version),
      async () => {
        const fresh = await sidebarApi.getAll();
        const reloaded = fresh.diagrams.find((item) => item.id === current.id);
        if (reloaded) onDiagramChange(reloaded);
      }
    ));
    return result?.applied ? result.value : undefined;
  }, [onDiagramChange, runMutation]);
  // Knotengröße nach Skalieren persistieren (inkl. Position, falls oben/links gezogen wurde)
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const hoverLeaveTimer = useRef<number>();
  const snapRef = useRef(true);
  const activeNodeIdRef = useRef<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  activeNodeIdRef.current = activeNodeId;

  const onInteractionStart = useCallback((nodeId: string) => {
    window.clearTimeout(hoverLeaveTimer.current);
    setActiveNodeId(nodeId);
    setHoveredNodeId(nodeId);
  }, []);

  const onNodeTransformEnd = useCallback(
    async (nodeId: string, end: Rect, start: Rect) => {
      if (!canWrite) return;
      setActiveNodeId(null);
      const current = diagramRef.current;
      // #109: a click without movement (or a drag that snaps back) must not create a version or audit entry.
      const next = changedNodeLayout(current.positions[nodeId], start, end, snapRef.current);
      if (!next) return;
      const updatedPositions = { ...current.positions, [nodeId]: next };
      const updated = await updateDiagramWithConflict(current, { positions: updatedPositions });
      if (!updated) return;
      onDiagramChange(updated);
    },
    [canWrite, onDiagramChange, updateDiagramWithConflict]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    buildNodes(diagram, components, componentTypes, null, hoveredNodeId, activeNodeId, onInteractionStart, onNodeTransformEnd, canWrite)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    buildEdges(diagram, connections, connectionTypes, null, new Set(), componentRectLookup(diagram, components, componentTypes))
  );
  const [paletteOpen, setPaletteOpen] = useState(true);
  // #128: Palette bei schmaler Editorfläche automatisch einklappen (und danach wieder öffnen).
  const paletteAutoRef = useRef({ autoCollapsed: false, narrow: false });
  const paletteOpenRef = useRef(paletteOpen);
  paletteOpenRef.current = paletteOpen;
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [pendingAddError, setPendingAddError] = useState("");
  const [pendingAddSaving, setPendingAddSaving] = useState(false);
  const [pendingCreate, setPendingCreate] = useState<{ typeId: string; position: DiagramPosition } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ visible: false, x: 0, y: 0, nodeId: "" });
  const [connectingFrom, dispatchConnectionMode] = useReducer(connectionModeReducer, null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState("");
  // #117: a permanent deletion is shown in red, everything else in green.
  const [notice, setNotice] = useState<{ text: string; tone?: "danger" } | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [showRulers, setShowRulers] = useState(true);
  snapRef.current = snapEnabled;
  const canvasRef = useRef<HTMLDivElement>(null);
  const [validationResult, setValidationResult] = useState<DiagramValidationResult | null>(null);
  const [validationCollapsed, setValidationCollapsed] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, fitView, getViewport, setCenter, getZoom, getNode } = useReactFlow();
  const [linkHighlightId, setLinkHighlightId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const activeViewpoint = viewpointFilterId ? viewpoints.find((viewpoint) => viewpoint.id === viewpointFilterId) : undefined;
  const sidebarState = useMemo(
    () => ({ metamodel, componentTypes, connectionTypes, connectionRules, viewpointRules, validationRules, viewpoints, components, connections, diagrams: [diagram], catalogs: [] }),
    [metamodel, componentTypes, connectionTypes, connectionRules, viewpointRules, validationRules, viewpoints, components, connections, diagram]
  );
  const displayedDiagram = useMemo(
    () => projectDiagramToViewpoint(diagram, sidebarState, viewpointFilterId || undefined),
    [diagram, sidebarState, viewpointFilterId]
  );
  const applicableViewpoints = useMemo(
    () => getApplicableViewpoints(diagram, sidebarState),
    [diagram, sidebarState]
  );
  const activeViewpointRule = useMemo(
    () => getViewpointRule(sidebarState, viewpointFilterId || undefined),
    [sidebarState, viewpointFilterId]
  );
  const activeVisibleTypeIds = useMemo(() => {
    if (!activeViewpointRule) return null;
    const visibleIds = activeViewpointRule.visibleComponentTypeIds ?? [];
    const ids = visibleIds.length > 0 ? visibleIds : activeViewpointRule.allowedComponentTypeIds;
    return ids.length > 0 ? new Set(ids) : null;
  }, [activeViewpointRule]);
  const visibleComponentTypes = useMemo(
    () => activeVisibleTypeIds ? componentTypes.filter((type) => activeVisibleTypeIds.has(type.id)) : componentTypes,
    [activeVisibleTypeIds, componentTypes]
  );

  /* ── #119/#123: Auswahl auf der Fläche (einzige Quelle, siehe diagramSelection.ts) ─────────── */
  const [selection, setSelection] = useState<DiagramSelection>(EMPTY_SELECTION);
  const selectedNodeIds = useMemo(() => new Set(selection.nodeIds), [selection.nodeIds]);
  const selectedEdgeIds = useMemo(() => new Set(selection.edgeIds), [selection.edgeIds]);
  const visibleIds = useMemo(
    () => visibleElementIds(displayedDiagram, components, connections),
    [displayedDiagram, components, connections]
  );
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const visibleIdsRef = useRef(visibleIds);
  visibleIdsRef.current = visibleIds;
  const selectedElementIdRef = useRef(selectedElementId);
  selectedElementIdRef.current = selectedElementId;

  // Entfernte, gefilterte oder anderswo gelöschte Elemente dürfen nicht unsichtbar ausgewählt bleiben.
  useEffect(() => {
    setSelection((current) => pruneSelection(current, visibleIds));
  }, [visibleIds]);

  // Was im Detail-Panel offen ist, ist auch auf der Fläche markiert (und umgekehrt beim Schließen nicht mehr).
  useEffect(() => {
    setSelection((current) => selectionForPanelElement(current, selectedElementId, visibleIdsRef.current));
  }, [selectedElementId]);

  // React Flow meldet Klick-, Mehrfach- und Rahmenauswahl nur noch; übernommen wird sie in den Editor-State.
  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const selects = changes.filter((change): change is SelectChange & NodeChange => change.type === "select");
    if (selects.length > 0) setSelection((current) => applySelectChanges(current, "node", selects));
    const rest = changes.filter((change) => change.type !== "select");
    if (rest.length > 0) onNodesChange(rest);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes: EdgeChange[]) => {
    const selects = changes.filter((change): change is SelectChange & EdgeChange => change.type === "select");
    if (selects.length > 0) setSelection((current) => applySelectChanges(current, "edge", selects));
    const rest = changes.filter((change) => change.type !== "select");
    if (rest.length > 0) onEdgesChange(rest);
  }, [onEdgesChange]);

  // Short confirmation messages disappear on their own.
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const fitDiagram = useCallback(() => {
    void fitView({ padding: 0.2, maxZoom: 1.2, duration: 250 });
  }, [fitView]);

  // Center the diagram whenever another diagram is opened.
  useEffect(() => {
    const frame = requestAnimationFrame(() => { void fitView({ padding: 0.2, maxZoom: 1.2 }); });
    return () => cancelAnimationFrame(frame);
  }, [diagram.id, fitView]);

  // Escape leaves the connect mode.
  useEffect(() => {
    if (!connectingFrom) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") dispatchConnectionMode({ type: "cancel" });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [connectingFrom]);

  useEffect(() => {
    setViewpointFilterId(diagram.viewpointId ?? "");
    setValidationResult(null);
    setError("");
    setNotice(null);
    // Anderes Diagramm: keine Auswahl mitnehmen (gleiche Komponente kann in beiden liegen), nur das Panel-Element.
    setSelection(selectionForPanelElement(EMPTY_SELECTION, selectedElementIdRef.current, visibleIdsRef.current));
  }, [diagram.id, diagram.viewpointId]);

  // REQ-12: Ansicht aus einem Link übernehmen (läuft nach dem Zurücksetzen oben).
  useEffect(() => {
    if (viewRequest) setViewpointFilterId(viewRequest.filterId);
  }, [viewRequest]);

  // Die Adresszeile führt den gewählten Filter mit, damit „Link kopieren“ aus dem Browser auch passt.
  useEffect(() => {
    onViewChange?.(viewpointFilterId);
  }, [onViewChange, viewpointFilterId]);

  useEffect(() => {
    if (!localPreviewActive) return;
    setPendingAdd(null);
    setPendingCreate(null);
    dispatchConnectionMode({ type: "viewpoint-changed", localPreviewActive });
    setContextMenu({ visible: false, x: 0, y: 0, nodeId: "" });
    setIsDragOver(false);
  }, [localPreviewActive]);

  useEffect(() => {
    setNodes(buildNodes(displayedDiagram, components, componentTypes, connectingFrom, hoveredNodeId, activeNodeId, onInteractionStart, onNodeTransformEnd, canWrite, linkHighlightId, selectedNodeIds));
    setEdges(buildEdges(displayedDiagram, connections, connectionTypes, linkHighlightId, selectedEdgeIds, componentRectLookup(displayedDiagram, components, componentTypes)));
  }, [canWrite, displayedDiagram, components, componentTypes, connections, connectionTypes, connectingFrom, hoveredNodeId, activeNodeId, onInteractionStart, onNodeTransformEnd, setNodes, setEdges, linkHighlightId, selectedNodeIds, selectedEdgeIds]);

  useEffect(() => () => window.clearTimeout(hoverLeaveTimer.current), []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) {
        setContextMenu((m) => ({ ...m, visible: false }));
      }
    };
    window.addEventListener("pointerdown", handler);
    return () => window.removeEventListener("pointerdown", handler);
  }, [contextMenu.visible]);

  // #122: keep the menu inside the window; runs before paint, so it never shows cut off.
  useLayoutEffect(() => {
    if (!contextMenu.visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const { x, y } = fitMenuInViewport(contextMenu, rect, { width: window.innerWidth, height: window.innerHeight });
    if (x !== contextMenu.x || y !== contextMenu.y) {
      setContextMenu((current) => ({ ...current, x, y }));
    }
  }, [contextMenu]);

  // ── Shared connection creation ──────────────────────────────────────────────

  const createConnectionBetween = useCallback(
    async (sourceId: string, targetId: string) => {
      if (!canWrite) return;
      const srcComp = components.find((c) => c.id === sourceId);
      const tgtComp = components.find((c) => c.id === targetId);
      if (!srcComp || !tgtComp) return;

      const allowed = getAllowedConnectionTypes(sidebarState, srcComp.componentTypeId, tgtComp.componentTypeId, activeViewpoint?.id);

      // Spezifischere Typen (mit eingeschränkten Quell-/Ziel-Listen) gewinnen
      // gegenüber Catch-all-Typen ohne Einschränkungen.
      const specificity = (ct: ConnectionType) =>
        (ct.allowedSourceTypeIds.length > 0 ? 1 : 0) + (ct.allowedTargetTypeIds.length > 0 ? 1 : 0);
      const connType = [...allowed].sort((a, b) => specificity(b) - specificity(a))[0];
      if (!connType) {
        setError("Diese Verbindung ist nicht erlaubt: Für diese Kombination aus Quelle und Ziel gibt es keine Verbindungsregel im Metamodell.");
        return;
      }

      try {
        const result = await runMutation(() => sidebarApi.createDiagramConnection(diagram.id, {
          name: "",
          connectionTypeId: connType.id,
          sourceComponentId: sourceId,
          targetComponentId: targetId,
          description: ""
        }));
        if (!result) return;
        const wasInDiagram = diagram.connectionIds.includes(result.connection.id);
        if (result.created) onConnectionCreated(result.connection);
        onDiagramChange(result.diagram);
        setError("");
        const label = `„${connType.name}“ von ${srcComp.name} zu ${tgtComp.name}`;
        setNotice({
          text: result.created
            ? `Verbindung ${label} erstellt.`
            : wasInDiagram
              ? `Diese Verbindung ${label} gibt es bereits – es wurde keine neue angelegt.`
              : `Bestehende Verbindung ${label} zum Diagramm hinzugefügt.`
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verbindung konnte nicht erstellt werden.");
      }
    },
    [activeViewpoint, canWrite, components, diagram, onConnectionCreated, onDiagramChange, runMutation, sidebarState]
  );

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      await createConnectionBetween(connection.source, connection.target);
    },
    [createConnectionBetween]
  );

  // ── Node click: connect mode oder Properties öffnen ────────────────────────

  const onNodeClick = useCallback(
    async (_e: React.MouseEvent, node: Node) => {
      await handleDiagramNodeClick({
        connectingFrom,
        targetId: node.id,
        canWrite,
        cancelConnectionMode: () => dispatchConnectionMode({ type: "cancel" }),
        selectComponent: onSelectComponent,
        createConnection: createConnectionBetween
      });
    },
    [canWrite, connectingFrom, createConnectionBetween, onSelectComponent]
  );

  const onEdgeClick = useCallback(
    (_e: React.MouseEvent, edge: Edge) => {
      onSelectConnection(edge.id);
    },
    [onSelectConnection]
  );

  // ── Context menu ────────────────────────────────────────────────────────────

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault();
    dispatchConnectionMode({ type: "cancel" });
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  async function deleteFromRepository(nodeId: string) {
    setContextMenu((menu) => ({ ...menu, visible: false }));
    const component = components.find((item) => item.id === nodeId);
    if (!canWrite || !component) return;
    if (!await confirm(deleteComponentConfirmation(component, diagrams, connections))) return;
    try {
      const result = await runMutation(() => runOptimisticMutation(
        component.version ?? 1,
        (version) => sidebarApi.deleteComponent(nodeId, version),
        async () => {
          const fresh = await sidebarApi.getAll();
          const reloaded = fresh.diagrams.find((item) => item.id === diagram.id);
          if (reloaded) onDiagramChange(reloaded);
        }
      ));
      if (!result?.applied) return;
      onComponentDeleted(nodeId);
      setError("");
      setNotice({ text: `„${component.name}“ endgültig aus dem Repository gelöscht (auch aus allen anderen Diagrammen entfernt).`, tone: "danger" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Element konnte nicht aus dem Repository gelöscht werden.");
    }
  }

  async function removeNodesFromDiagram(nodeIds: string[]) {
    if (!canWrite || nodeIds.length === 0) return;
    const removed = new Set(nodeIds);
    const newCompIds = diagram.componentIds.filter((id) => !removed.has(id));
    const newConnIds = diagram.connectionIds.filter((id) => {
      const conn = connections.find((c) => c.id === id);
      return conn && !removed.has(conn.sourceComponentId) && !removed.has(conn.targetComponentId);
    });
    const newPositions = Object.fromEntries(
      Object.entries(diagram.positions).filter(([componentId]) => !removed.has(componentId))
    );
    try {
      const updated = await updateDiagramWithConflict(diagram, {
        componentIds: newCompIds,
        connectionIds: newConnIds,
        positions: newPositions
      });
      if (!updated) return;
      onDiagramChange(updated);
      setError("");
      setNotice({ text: nodeIds.length === 1 ? "Aus dem Diagramm entfernt (bleibt im Modell erhalten)." : `${nodeIds.length} Elemente aus dem Diagramm entfernt (bleiben im Modell erhalten).` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Element konnte nicht aus dem Diagramm entfernt werden.");
    } finally {
      setContextMenu((menu) => ({ ...menu, visible: false }));
    }
  }

  const removeFromDiagram = (nodeId: string) => removeNodesFromDiagram([nodeId]);

  /**
   * #119/#120: Entf und „Aus Diagramm entfernen“ in der Auswahlleiste. Betrifft nur, was gerade sichtbar
   * ausgewählt ist, und fragt vorher nach – Komponenten und Verbindungen verhalten sich gleich.
   */
  const removingSelectionRef = useRef(false);
  async function removeSelectionFromDiagram() {
    if (!canWrite || removingSelectionRef.current) return;
    const target = pruneSelection(selectionRef.current, visibleIdsRef.current);
    if (isSelectionEmpty(target)) return;
    removingSelectionRef.current = true;
    try {
      const preview = diagramRemoval(diagramRef.current, connections, target.nodeIds, target.edgeIds);
      const labels = { components, connections, connectionTypes };
      if (!await confirm(removalConfirmation(target, preview.attachedConnectionIds.length, labels))) return;
      // Während der Rückfrage kann sich das Diagramm geändert haben: auf dem aktuellen Stand rechnen.
      const current = diagramRef.current;
      const { componentIds, connectionIds, positions } = diagramRemoval(current, connections, target.nodeIds, target.edgeIds);
      const updated = await updateDiagramWithConflict(current, { componentIds, connectionIds, positions });
      if (!updated) return;
      onDiagramChange(updated);
      setSelection(EMPTY_SELECTION);
      setError("");
      setNotice({ text: removalNotice(target.nodeIds.length, target.edgeIds.length) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auswahl konnte nicht aus dem Diagramm entfernt werden.");
    } finally {
      removingSelectionRef.current = false;
    }
  }
  const removeSelectionRef = useRef(removeSelectionFromDiagram);
  removeSelectionRef.current = removeSelectionFromDiagram;

  // Tastatur: nur wenn der Fokus auf der Diagrammfläche liegt (nicht in Sidebar, Panel, Feldern oder Dialogen).
  const editorDialogOpen = !!pendingAdd || !!pendingCreate || exportOpen;
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target;
      const action = diagramShortcut(event, {
        inEditor: target === document.body || (target instanceof globalThis.Node && !!editorRef.current?.contains(target)),
        blocked: editorDialogOpen || removingSelectionRef.current,
        canWrite,
        connecting: !!connectingFrom,
        selection: selectionRef.current,
        visible: visibleIdsRef.current
      });
      if (action === "clear") setSelection(EMPTY_SELECTION);
      if (action !== "remove") return;
      event.preventDefault();
      if (!event.repeat) void removeSelectionRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canWrite, connectingFrom, editorDialogOpen]);

  // ── Platzierung neuer Elemente ──────────────────────────────────────────────

  const occupiedRects = useCallback((positions: Record<string, DiagramPosition>): Rect[] =>
    Object.entries(positions).map(([id, pos]) => {
      const component = components.find((item) => item.id === id);
      const shape = componentTypes.find((type) => type.id === component?.componentTypeId)?.shape ?? "box";
      const defaults = shapeDefaultSize(shape);
      return { x: pos.x, y: pos.y, width: pos.width ?? defaults.width, height: pos.height ?? defaults.height };
    }), [componentTypes, components]);

  /** Free spot near the middle of what the user currently sees (instead of random or stacked positions). */
  const placeNewComponent = useCallback((compId: string, positions: Record<string, DiagramPosition>, preferred?: DiagramPosition): DiagramPosition => {
    const component = components.find((item) => item.id === compId);
    const shape = componentTypes.find((type) => type.id === component?.componentTypeId)?.shape ?? "box";
    const size = shapeDefaultSize(shape);
    let center = preferred;
    if (!center) {
      const box = canvasRef.current?.getBoundingClientRect();
      center = box
        ? screenToFlowPosition({ x: box.left + box.width / 2, y: box.top + box.height / 2 })
        : { x: 200, y: 160 };
      center = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
    }
    return findFreePosition(occupiedRects(positions), center, size, { snap: snapEnabled });
  }, [componentTypes, components, occupiedRects, screenToFlowPosition, snapEnabled]);

  // ── Drop aus Sidebar/Palette ────────────────────────────────────────────────

  const onCanvasDragOver = useCallback((e: React.DragEvent) => {
    const accepts =
      e.dataTransfer.types.includes(COMPONENT_DRAG_MIME) ||
      e.dataTransfer.types.includes(COMPONENT_TYPE_DRAG_MIME);
    if (!accepts) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setIsDragOver(true);
  }, []);

  const onCanvasDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as globalThis.Node | null)) return;
    setIsDragOver(false);
  }, []);

  function onCanvasDrop(e: React.DragEvent) {
      if (!canWrite) return;
      setIsDragOver(false);
      const position = snapPoint(screenToFlowPosition({ x: e.clientX, y: e.clientY }), snapEnabled);

      // Typ gezogen → Dialog zum Erstellen einer neuen Komponente
      const typeId = e.dataTransfer.getData(COMPONENT_TYPE_DRAG_MIME);
      if (typeId) {
        e.preventDefault();
        setPendingCreate({ typeId, position });
        return;
      }

      // Bestehende Komponente gezogen → direkt hinzufügen
      const compId = e.dataTransfer.getData(COMPONENT_DRAG_MIME);
      if (!compId) return;
      e.preventDefault();
      startAddComponent(compId, position);
  }

  async function createAndPlaceComponent(name: string, properties: Record<string, string>, acknowledgeDuplicate: boolean, acknowledgePlaceholder: boolean) {
    if (!canWrite || !pendingCreate) return;
    const { typeId, position } = pendingCreate;
    if (activeViewpoint && activeVisibleTypeIds && !activeVisibleTypeIds.has(typeId)) {
      const type = componentTypes.find((item) => item.id === typeId);
      setError(`${type?.name ?? "Dieser Komponententyp"} ist in der Ansicht „${activeViewpoint.name}“ nicht erlaubt.`);
      return;
    }
    try {
      const result = await runMutation(() => runOptimisticMutation(
        diagram.version ?? 1,
        (version) => sidebarApi.createComponentInDiagram(diagram.id, {
          name,
          componentTypeId: typeId,
          properties,
          description: "",
          position
        }, version, acknowledgePlaceholder ? { acknowledgeDuplicate, acknowledgePlaceholder } : { acknowledgeDuplicate }),
        async () => {
          const fresh = await sidebarApi.getAll();
          const reloaded = fresh.diagrams.find((item) => item.id === diagram.id);
          if (reloaded) onDiagramChange(reloaded);
        }
      ));
      if (!result?.applied) return;
      onComponentCreated(result.value.component);
      onDiagramChange(result.value.diagram);
      setPendingCreate(null);
      setError("");
      setNotice({ text: `Komponente „${name}“ angelegt und im Diagramm platziert.` });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Komponente konnte nicht erstellt werden.");
    }
  }

  function placeExistingInsteadOfCreating(compId: string) {
    const position = pendingCreate?.position;
    setPendingCreate(null);
    if (diagram.componentIds.includes(compId)) {
      // Already placed here: show it instead of creating a second element.
      onSelectComponent(compId);
      return;
    }
    void startAddComponent(compId, position);
  }

  // ── Smart add ───────────────────────────────────────────────────────────────

  // #142: Solange ein Hinzufügen läuft, weitere Klicks ignorieren (sonst Konflikte mit veraltetem Diagrammstand).
  const addingComponentRef = useRef(false);
  async function startAddComponent(compId: string, position?: DiagramPosition) {
    if (addingComponentRef.current) return;
    addingComponentRef.current = true;
    try {
      await startAddComponentNow(compId, position);
    } finally {
      addingComponentRef.current = false;
    }
  }

  async function startAddComponentNow(compId: string, position?: DiagramPosition) {
    if (!canWrite) return;
    if (diagram.componentIds.includes(compId)) return;
    const component = components.find((item) => item.id === compId);
    const componentType = componentTypes.find((type) => type.id === component?.componentTypeId);
    if (activeViewpoint && activeVisibleTypeIds && componentType && !activeVisibleTypeIds.has(componentType.id)) {
      setError(`${componentType.name} ist in der Ansicht „${activeViewpoint.name}“ nicht erlaubt.`);
      return;
    }

    const related = connections.filter(
      (c) => c.sourceComponentId === compId || c.targetComponentId === compId
    );

    const suggestions: Suggestion[] = related.flatMap((conn) => {
      if (diagram.connectionIds.includes(conn.id)) return [];
      const otherId = conn.sourceComponentId === compId ? conn.targetComponentId : conn.sourceComponentId;
      const isCompAlreadyInDiagram = diagram.componentIds.includes(otherId);
      const otherComp = isCompAlreadyInDiagram ? null : (components.find((c) => c.id === otherId) ?? null);
      if (!isCompAlreadyInDiagram && !otherComp) return [];
      return [{ conn, otherComp, isCompAlreadyInDiagram, selected: true }];
    });

    if (suggestions.length === 0) {
      await doAdd(compId, [], [], position);
      return;
    }

    setPendingAddError("");
    setPendingAdd({ compId, suggestions, position });
  }

  function toggleSuggestion(index: number) {
    setPendingAdd((p) =>
      p ? { ...p, suggestions: p.suggestions.map((s, i) => i === index ? { ...s, selected: !s.selected } : s) } : null
    );
  }

  async function doAdd(compId: string, extraCompIds: string[], extraConnIds: string[], position?: DiagramPosition) {
    if (!canWrite) return;
    const memberships = mergeSmartAddMemberships(diagram, compId, extraCompIds, extraConnIds);
    const newPositions = { ...diagram.positions };
    newPositions[compId] = position ?? placeNewComponent(compId, newPositions);
    const anchor = newPositions[compId];
    // Mit-hinzugefügte Nachbarn neben dem Element platzieren, ohne dass sie sich überlappen
    memberships.newComponentIds.forEach((id, i) => {
      if (!newPositions[id]) newPositions[id] = placeNewComponent(id, newPositions, { x: anchor.x + 260, y: anchor.y + i * 110 });
    });
    const updated = await updateDiagramWithConflict(diagram, {
      componentIds: memberships.componentIds,
      connectionIds: memberships.connectionIds,
      positions: newPositions
    });
    if (!updated) return;
    onDiagramChange(updated);
    setError("");
    setNotice({ text: `${components.find((item) => item.id === compId)?.name ?? "Komponente"} zum Diagramm hinzugefügt.` });
  }

  async function confirmAdd() {
    if (!canWrite || !pendingAdd || pendingAddSaving) return;
    setPendingAddSaving(true);
    setPendingAddError("");
    try {
      const selected = pendingAdd.suggestions.filter((s) => s.selected);
      await doAdd(
        pendingAdd.compId,
        selected.flatMap((s) => (s.otherComp ? [s.otherComp.id] : [])),
        selected.map((s) => s.conn.id),
        pendingAdd.position
      );
      setPendingAdd(null);
    } catch (err) {
      setPendingAddError(err instanceof Error ? err.message : "Auswahl konnte nicht hinzugefuegt werden.");
    } finally {
      setPendingAddSaving(false);
    }
  }

  async function addCompOnly() {
    if (!canWrite || !pendingAdd || pendingAddSaving) return;
    setPendingAddSaving(true);
    setPendingAddError("");
    try {
      await doAdd(pendingAdd.compId, [], [], pendingAdd.position);
      setPendingAdd(null);
    } catch (err) {
      setPendingAddError(err instanceof Error ? err.message : "Komponente konnte nicht hinzugefuegt werden.");
    } finally {
      setPendingAddSaving(false);
    }
  }

  // #129: Jede Prüfung bekommt eine Nummer; nur die jüngste darf ihr Ergebnis anzeigen.
  const validationRunRef = useRef(0);
  const [validationStale, setValidationStale] = useState(false);

  async function runDiagramValidation(options: { expand?: boolean } = {}) {
    const run = ++validationRunRef.current;
    const local = validateDiagram(displayedDiagram, sidebarState);
    setValidationResult(local);
    setValidationStale(false);
    if (options.expand ?? true) setValidationCollapsed(false);
    if (viewpointFilterId !== (diagram.viewpointId ?? "")) {
      setError("");
      return;
    }
    try {
      const server = await sidebarApi.validateDiagram(diagram.id);
      if (run !== validationRunRef.current) return;
      setValidationResult(server);
      setError("");
    } catch (err) {
      if (run !== validationRunRef.current) return;
      setError(err instanceof Error ? err.message : "Diagrammvalidierung konnte nicht ausgefuehrt werden.");
    }
  }

  // #129: Ist das Prüfergebnis offen, wird es nach Modelländerungen neu berechnet statt stehen zu bleiben.
  // Kurz entprellt, damit Verschieben oder mehrere schnelle Änderungen nur eine Prüfung auslösen.
  const validationOpen = validationResult !== null;
  const runValidationRef = useRef(runDiagramValidation);
  runValidationRef.current = runDiagramValidation;
  const lastValidatedRef = useRef<{ diagram: Diagram; state: typeof sidebarState } | null>(null);
  useEffect(() => {
    if (!validationOpen) {
      lastValidatedRef.current = null;
      return;
    }
    const last = lastValidatedRef.current;
    lastValidatedRef.current = { diagram: displayedDiagram, state: sidebarState };
    if (!last || (last.diagram === displayedDiagram && last.state === sidebarState)) return;
    setValidationStale(true);
    const timer = window.setTimeout(() => void runValidationRef.current({ expand: false }), 400);
    return () => window.clearTimeout(timer);
  }, [validationOpen, displayedDiagram, sidebarState]);

  /* ── REQ-11: Export als PNG/SVG ────────────────────────────────────────── */
  // Grundlage ist das gefilterte Diagramm: ein aktiver Ansichtsfilter gilt auch im Export.
  const exportScene = useMemo(
    () => buildExportScene(displayedDiagram, components, componentTypes, connections, connectionTypes),
    [displayedDiagram, components, componentTypes, connections, connectionTypes]
  );
  const exportFullArea = useMemo(() => sceneBounds(exportScene), [exportScene]);
  const [exportViewArea, setExportViewArea] = useState<Rect | null>(null);

  /* ── REQ-12: per Link angesprungenes Element zentrieren und hervorheben ──── */
  const handledFocusNonce = useRef<number | null>(null);
  useEffect(() => {
    if (!focusRequest || handledFocusNonce.current === focusRequest.nonce) return;
    const { target } = focusRequest;
    const rect = (id: string) => exportScene.nodes.find((n) => n.id === id);
    let center: { x: number; y: number } | null = null;
    if (target.kind === "component") {
      const node = rect(target.id);
      if (node) center = { x: node.x + node.width / 2, y: node.y + node.height / 2 };
    } else {
      const edge = exportScene.edges.find((e) => e.id === target.id);
      const source = edge && rect(edge.sourceId);
      const goal = edge && rect(edge.targetId);
      if (source && goal) {
        center = {
          x: (source.x + source.width / 2 + goal.x + goal.width / 2) / 2,
          y: (source.y + source.height / 2 + goal.y + goal.height / 2) / 2
        };
      }
    }
    // Erst wenn das Element sichtbar im Diagramm liegt (z. B. nachdem der Link-Filter gesetzt ist).
    if (!center) return;
    handledFocusNonce.current = focusRequest.nonce;
    const point = center;
    // Nach dem automatischen Einpassen beim Öffnen ausführen (React Flow passt nach dem Vermessen
    // der Knoten ein), sonst würde das Zentrieren überschrieben. Die Animation zeigt dabei, wohin es geht.
    const timer = window.setTimeout(() => {
      void setCenter(point.x, point.y, { zoom: Math.max(getZoom(), 1), duration: 600 });
      setLinkHighlightId(target.id);
      setSelection(target.kind === "component" ? { nodeIds: [target.id], edgeIds: [] } : { nodeIds: [], edgeIds: [target.id] });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [focusRequest, exportScene, setCenter, getZoom]);

  // #128: Editorbreite beobachten – Palette einklappen, wenn sonst kaum Fläche übrig bleibt.
  useEffect(() => {
    const element = editorRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const current = { open: paletteOpenRef.current, ...paletteAutoRef.current };
      const next = paletteAfterResize(current, entry.contentRect.width);
      if (next === current) return;
      paletteAutoRef.current = { autoCollapsed: next.autoCollapsed, narrow: next.narrow };
      if (next.open !== current.open) setPaletteOpen(next.open);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // #128: Das im Detail-Panel geöffnete Element bleibt sichtbar – auch wenn das Panel die Fläche schmaler macht.
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = canvasRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      setCanvasSize({ width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!selectedElementId || canvasSize.width === 0) return;
    const timer = window.setTimeout(() => {
      const rectOf = (id: string) => {
        const node = getNode(id);
        if (!node?.width || !node.height) return null;
        const position = node.positionAbsolute ?? node.position;
        return { x: position.x, y: position.y, width: node.width, height: node.height };
      };
      let target = rectOf(selectedElementId);
      if (!target) {
        const connection = connections.find((item) => item.id === selectedElementId);
        const source = connection && rectOf(connection.sourceComponentId);
        const goal = connection && rectOf(connection.targetComponentId);
        if (!source || !goal) return;
        const x = Math.min(source.x, goal.x);
        const y = Math.min(source.y, goal.y);
        target = { x, y, width: Math.max(source.x + source.width, goal.x + goal.width) - x, height: Math.max(source.y + source.height, goal.y + goal.height) - y };
      }
      if (isRectVisible(target, getViewport(), canvasSize)) return;
      void setCenter(target.x + target.width / 2, target.y + target.height / 2, { zoom: getZoom(), duration: 300 });
    }, 250);
    return () => window.clearTimeout(timer);
    // Bewusst nur bei neuem Panel-Element oder geänderter Flächengröße – nicht bei jedem Verschieben.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedElementId, canvasSize.width, canvasSize.height]);

  // Hervorhebung nach ein paar Sekunden wieder entfernen.
  useEffect(() => {
    if (!linkHighlightId) return;
    const timer = window.setTimeout(() => setLinkHighlightId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [linkHighlightId]);

  /** Teilbarer Link auf dieses Diagramm mit aktuellem Ansichtsfilter, optional auf ein Element. */
  const diagramLink = useCallback((selectId?: string) => absoluteLink({
    kind: "diagram",
    diagramId: diagram.id,
    viewId: viewParam(viewpointFilterId, diagram.viewpointId),
    ...(selectId ? { selectId } : {})
  }, window.location.origin), [diagram.id, diagram.viewpointId, viewpointFilterId]);

  async function copyElementLink(elementId: string, name: string) {
    setContextMenu((m) => ({ ...m, visible: false }));
    const url = diagramLink(elementId);
    if (await copyText(url)) setNotice({ text: `Link zu „${name}“ kopiert` });
    else setError(`Kopieren nicht möglich – bitte manuell kopieren: ${url}`);
  }

  function openExportDialog() {
    const canvas = canvasRef.current;
    setExportViewArea(canvas ? viewportArea(getViewport(), { width: canvas.clientWidth, height: canvas.clientHeight }) : null);
    setExportOpen(true);
  }

  function exportTarget(area: ExportChoice["area"]) {
    const target = area === "viewport" ? exportViewArea : exportFullArea;
    if (!target) return null;
    return { target, scene: area === "viewport" ? cropScene(exportScene, target) : exportScene };
  }

  function measureExport(area: ExportChoice["area"], legend: boolean) {
    const resolved = exportTarget(area);
    return resolved ? exportSize(resolved.scene, resolved.target, legend) : null;
  }

  /** Ein SVG für Export und Vorschau – die Vorschau zeigt damit exakt das spätere Ergebnis. */
  async function buildExportSvg(area: ExportChoice["area"], legend: boolean) {
    const resolved = exportTarget(area);
    if (!resolved) throw new Error("Es gibt nichts zu exportieren.");
    const icons = await renderIconMarkup(sceneIcons(resolved.scene));
    return renderDiagramSvg(resolved.scene, resolved.target, diagram.name, { icons, legend });
  }

  async function exportDiagram({ format, area, scale, legend, fileName }: ExportChoice) {
    const { svg, width, height } = await buildExportSvg(area, legend);
    if (format === "svg") {
      downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), fileName);
    } else {
      const size = { width, height };
      const { scale: safeScale } = clampPngScale(size, scale);
      downloadBlob(await svgToPngBlob(svg, size, safeScale), fileName);
    }
    setNotice({ text: `Exportiert als ${fileName}` });
  }

  const visibleComponentTypeIds = new Set(visibleComponentTypes.map((type) => type.id));
  const availableComponents = components.filter((c) => !diagram.componentIds.includes(c.id) && visibleComponentTypeIds.has(c.componentTypeId));
  const contextComp = components.find((c) => c.id === contextMenu.nodeId);
  const diagramIsEmpty = diagram.componentIds.length === 0;
  const validationGroups = validationResult ? [
    { title: "Metamodel errors", items: validationResult.errors.filter((item) => item.scope === "metamodel") },
    { title: "Viewpoint errors", items: validationResult.errors.filter((item) => item.scope === "viewpoint") },
    { title: "Diagram errors", items: validationResult.errors.filter((item) => !item.scope || item.scope === "diagram") },
    { title: "Required rule errors", items: validationResult.errors.filter((item) => item.scope === "required-rule") },
    { title: "Required rule warnings", items: validationResult.warnings.filter((item) => item.scope === "required-rule") },
    { title: "Viewpoint warnings", items: validationResult.warnings.filter((item) => item.scope === "viewpoint") },
    { title: "Other warnings", items: validationResult.warnings.filter((item) => !item.scope || (item.scope !== "required-rule" && item.scope !== "viewpoint")) }
  ].filter((group) => group.items.length > 0) : [];
  const validationStatus = validationResult
    ? validationResult.valid
      ? validationResult.warnings.length > 0 ? "Ansicht gültig mit Warnungen" : "Ansicht gültig"
      : "Ansicht ungültig"
    : "";

  const selectionInfo = isSelectionEmpty(selection)
    ? null
    : selectionLabel(selection, { components, connections, connectionTypes });
  const validationErrorCount = validationResult?.errors.length ?? 0;
  const validationWarningCount = validationResult?.warnings.length ?? 0;

  return (
    <div className="diagram-editor" ref={editorRef}>

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="diagram-toolbar">
        {canWrite && <button
          className="diagram-palette-toggle"
          onClick={() => {
            paletteAutoRef.current = { ...paletteAutoRef.current, autoCollapsed: false };
            setPaletteOpen((v) => !v);
          }}
          title={paletteOpen ? "Palette ausblenden" : "Palette einblenden"}
          aria-pressed={paletteOpen}
        >
          {paletteOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          <span className="diagram-tb-label">Palette</span>
        </button>}
        <strong className="diagram-title">{diagram.name}</strong>
        <label className="diagram-viewpoint-filter">
          <span>Ansicht</span>
          <select
            className="diagram-viewpoint-select"
            aria-label="Diagrammansicht filtern"
            value={viewpointFilterId}
            onChange={(e) => {
              setViewpointFilterId(e.target.value);
              setValidationResult(null);
              setError("");
            }}
            title="Filtert nur die sichtbaren Inhalte und ändert das Diagramm nicht"
          >
            <option value="">Alle Inhalte</option>
            {applicableViewpoints.map((viewpoint) => <option key={viewpoint.id} value={viewpoint.id}>{viewpoint.name}</option>)}
          </select>
        </label>
        <button className="diagram-palette-toggle" onClick={fitDiagram} title="Alle Elemente einpassen und zentrieren">
          <Maximize size={16} /> <span className="diagram-tb-label">Ansicht einpassen</span>
        </button>
        <ShareMenu
          className="diagram-palette-toggle"
          onExportImage={openExportDialog}
          exportDisabledReason={exportFullArea ? undefined : "Das Diagramm ist leer – füge zuerst Elemente hinzu"}
          getLink={() => diagramLink()}
        />
        <button
          className={`diagram-palette-toggle${showRulers ? " diagram-toggle--on" : ""}`}
          onClick={() => setShowRulers((v) => !v)}
          aria-pressed={showRulers}
          title="Koordinatensystem mit Linealen und Achsen ein-/ausblenden"
        >
          <Ruler size={16} /> <span className="diagram-tb-label">Koordinaten</span>
        </button>
        <button
          className={`diagram-palette-toggle${snapEnabled ? " diagram-toggle--on" : ""}`}
          onClick={() => setSnapEnabled((v) => !v)}
          aria-pressed={snapEnabled}
          title="Raster: sichtbare Rasterlinien, Elemente rasten beim Platzieren, Verschieben und Skalieren ein"
        >
          <Grid3x3 size={16} /> <span className="diagram-tb-label">Raster</span>
        </button>
        <button className="diagram-palette-toggle" onClick={() => void runDiagramValidation()} title="Diagramm gegen die Regeln der Ansicht prüfen">
          <SlidersHorizontal size={16} /> <span className="diagram-tb-label">Ansicht prüfen</span>
        </button>
        <span className="muted diagram-hint">
          {activeViewpoint
            ? `Zielgruppe: ${activeViewpoint.stakeholderRole} · ${activeViewpoint.purpose} · keine Benutzerrolle`
            : "Alle Diagramminhalte · Ansichtsfilter speichert nichts"}
          {localPreviewActive ? " · Vorschau, nicht bearbeitbar" : !roleCanWrite && " · Leseansicht"}
        </span>
        <button className="diagram-close-btn" onClick={onClose} title="Tab schließen"><X size={16} /></button>
      </div>

      {error && (
        <div className="error-banner diagram-error" role="alert">
          <span>{error}</span>
          <button type="button" className="diagram-banner-close" onClick={() => setError("")} aria-label="Meldung schließen"><X size={14} /></button>
        </div>
      )}
      {notice && !error && (
        <div className={`diagram-notice${notice.tone === "danger" ? " diagram-notice--danger" : ""}`} role="status" aria-live="polite">
          {notice.tone === "danger" ? <Trash2 size={14} /> : <CircleCheck size={14} />} {notice.text}
        </div>
      )}

      {/* ── Connect mode banner ─────────────────────────────────────────────── */}
      {/* #124: schließbar, einklappbar, höhenbegrenzt (scrollt intern) – die Fläche bleibt nutzbar. */}
      {validationResult && (
        <section
          className={`diagram-validation-panel${validationResult.valid ? " diagram-validation-panel--valid" : ""}`}
          aria-label="Ergebnis der Ansichtsprüfung"
        >
          <div className="diagram-validation-header">
            <strong role="status">{validationStatus}</strong>
            <span className="diagram-validation-counts">
              {validationErrorCount} Fehler · {validationWarningCount} {validationWarningCount === 1 ? "Warnung" : "Warnungen"}
              {validationStale && " · wird aktualisiert …"}
            </span>
            {validationGroups.length > 0 && (
              <button
                type="button"
                className="diagram-validation-toggle"
                aria-expanded={!validationCollapsed}
                aria-controls="diagram-validation-details"
                onClick={() => setValidationCollapsed((collapsed) => !collapsed)}
              >
                {validationCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                {validationCollapsed ? "Details anzeigen" : "Details ausblenden"}
              </button>
            )}
            <button
              type="button"
              className="diagram-banner-close"
              onClick={() => setValidationResult(null)}
              aria-label="Prüfergebnis schließen"
              title="Schließen – „Ansicht prüfen“ öffnet es erneut"
            >
              <X size={14} />
            </button>
          </div>
          {!validationCollapsed && validationGroups.length > 0 && (
            <div className="diagram-validation-details" id="diagram-validation-details">
              {validationGroups.map((group) => (
                <div key={group.title} className="diagram-validation-group">
                  <span className="muted">{group.title}</span>
                  <ul>
                    {group.items.map((item, index) => (
                      <li key={`${group.title}-${index}`}>
                        <strong>{item.severity.toUpperCase()} {item.code}</strong>: {item.message}
                        {(item.ruleId || item.affectedEntityId) && <span className="muted"> ({item.ruleId ?? item.affectedEntityId})</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {connectingFrom && (() => {
        const fromComp = components.find((c) => c.id === connectingFrom);
        return (
          <div className="diagram-connect-banner">
            <GitBranch size={14} />
            <span><strong>Verbindungsmodus:</strong> Von <strong>{fromComp?.name}</strong> aus – klicke auf die Ziel-Komponente (Esc zum Abbrechen)</span>
            <button onClick={() => dispatchConnectionMode({ type: "cancel" })}>Abbrechen</button>
          </div>
        );
      })()}

      {/* ── Palette + Canvas ────────────────────────────────────────────────── */}
      <div className="diagram-body">
        {canWrite && paletteOpen && (
          <Palette
            components={availableComponents}
            componentTypes={visibleComponentTypes}
            onAdd={(id) => startAddComponent(id)}
          />
        )}

        <div
          ref={canvasRef}
          className={`diagram-canvas${isDragOver ? " diagram-canvas--drop" : ""}${connectingFrom ? " diagram-canvas--connecting" : ""}`}
          onDragOver={canWrite ? onCanvasDragOver : undefined}
          onDragLeave={onCanvasDragLeave}
          onDrop={canWrite ? onCanvasDrop : undefined}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={canWrite}
            edgesFocusable={canWrite}
            // #119: Entf/Backspace behandelt der Editor selbst (nur sichtbare Auswahl, mit Rückfrage).
            deleteKeyCode={null}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={canWrite ? onConnect : undefined}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeContextMenu={canWrite ? onNodeContextMenu : undefined}
            onNodeMouseEnter={(_e, node) => {
              window.clearTimeout(hoverLeaveTimer.current);
              setHoveredNodeId(node.id);
            }}
            onNodeMouseLeave={(_e, node) => {
              if (activeNodeIdRef.current === node.id) return;
              hoverLeaveTimer.current = window.setTimeout(() => {
                setHoveredNodeId((prev) => (prev === node.id ? null : prev));
              }, 120);
            }}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }}
            minZoom={0.1}
            maxZoom={2.5}
          >
            <MiniMap nodeStrokeWidth={3} pannable zoomable />
            <Controls showInteractive={false} fitViewOptions={{ padding: 0.2, maxZoom: 1.2 }} />
            {snapEnabled ? <Background variant={BackgroundVariant.Lines} gap={GRID_BG} color="#dbe3ee" /> : <Background variant={BackgroundVariant.Dots} gap={GRID_BG * 2} size={1} />}
            <DiagramCoordinates showRulers={showRulers} />
            <ZoomCssVariable target={canvasRef} />
          </ReactFlow>

          {/* #120/#123: zeigt, was ausgewählt ist, und macht das Entfernen (auch von Verbindungen) auffindbar. */}
          {selectionInfo && (
            <div className="diagram-selection-bar" role="toolbar" aria-label="Auswahl">
              <span className="diagram-selection-label" title={selectionInfo}>
                <MousePointerClick size={14} aria-hidden="true" />
                <span>{selectionInfo}</span>
              </span>
              {canWrite && (
                <button
                  type="button"
                  className="diagram-selection-action"
                  onClick={() => void removeSelectionFromDiagram()}
                  title="Nur aus diesem Diagramm entfernen – bleibt im Repository erhalten (Taste Entf)"
                >
                  <Trash2 size={14} /> Aus Diagramm entfernen <kbd>Entf</kbd>
                </button>
              )}
              <button
                type="button"
                className="diagram-selection-clear"
                onClick={() => setSelection(EMPTY_SELECTION)}
                aria-label="Auswahl aufheben"
                title="Auswahl aufheben (Esc)"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {diagramIsEmpty && (
            <div className="diagram-empty-hint">
              <MousePointerClick size={28} />
              <strong>Diagramm ist noch leer</strong>
              <span>Ziehe eine Komponente aus der Palette hierher{paletteOpen ? "" : " (Palette links einblenden)"} oder klicke sie an.</span>
            </div>
          )}
        </div>
      </div>

      {exportOpen && (
        <DiagramExportDialog
          diagramName={diagram.name}
          activeViewName={activeViewpoint?.name}
          measure={measureExport}
          renderPreview={async (area, legend) => (await buildExportSvg(area, legend)).svg}
          onExport={exportDiagram}
          onClose={() => setExportOpen(false)}
        />
      )}

      {/* ── Dialog: neue Komponente aus gezogenem Typ ───────────────────────── */}
      {pendingCreate && (() => {
        const type = componentTypes.find((t) => t.id === pendingCreate.typeId);
        if (!type) return null;
        return (
          <CreateComponentDialog
            type={type}
            components={components}
            onConfirm={createAndPlaceComponent}
            onUseExisting={placeExistingInsteadOfCreating}
            onShowExisting={onSelectComponent}
            onCancel={() => setPendingCreate(null)}
          />
        );
      })()}

      {/* ── Smart-add suggestion overlay ────────────────────────────────────── */}
      {pendingAdd && (() => {
        const comp = components.find((c) => c.id === pendingAdd.compId);
        return (
          <div className="diagram-suggestion-overlay" role="dialog" aria-modal="true" aria-labelledby="diagram-suggestion-title">
            <div className="diagram-suggestion-card">
              <div className="diagram-suggestion-header">
                <strong id="diagram-suggestion-title">Verbindungen gefunden</strong>
                <button className="sb-close-btn" disabled={pendingAddSaving} onClick={() => setPendingAdd(null)}><X size={14} /></button>
              </div>
              <p className="muted">
                <strong style={{ color: "#172033" }}>{comp?.name}</strong> hat bestehende Verbindungen.
                Sollen diese auch ins Diagramm? Jede Zeile steht für eine Verbindung; dieselbe Komponente wird nur einmal hinzugefügt.
              </p>
              <div className="diagram-suggestion-list">
                {pendingAdd.suggestions.map((s, i) => {
                  const connType = connectionTypes.find((t) => t.id === s.conn.connectionTypeId);
                  const otherId = s.conn.sourceComponentId === pendingAdd.compId ? s.conn.targetComponentId : s.conn.sourceComponentId;
                  const otherComp = components.find((c) => c.id === otherId);
                  const otherType = componentTypes.find((t) => t.id === otherComp?.componentTypeId);
                  const direction = s.conn.sourceComponentId === pendingAdd.compId ? "→" : "←";
                  const sameTargetSuggestions = pendingAdd.suggestions.filter((candidate) => {
                    const candidateOtherId = candidate.conn.sourceComponentId === pendingAdd.compId
                      ? candidate.conn.targetComponentId
                      : candidate.conn.sourceComponentId;
                    return candidateOtherId === otherId;
                  });
                  const relationIndex = sameTargetSuggestions.findIndex((candidate) => candidate.conn.id === s.conn.id) + 1;
                  return (
                    <label key={s.conn.id} className="diagram-suggestion-row">
                      <input type="checkbox" checked={s.selected} onChange={() => toggleSuggestion(i)} />
                      <span className="sb-color-dot" style={{ background: otherType?.color ?? "#cbd5e1" }} />
                      <span className="diagram-suggestion-label">
                        <strong>{otherComp?.name ?? "?"}</strong>
                        <span className="muted">
                          {direction} via {connType?.name ?? "?"}
                          {sameTargetSuggestions.length > 1 && ` · Beziehung ${relationIndex} von ${sameTargetSuggestions.length}`}
                        </span>
                        {s.isCompAlreadyInDiagram && (
                          <span className="diagram-suggestion-hint">Verbindung hinzufügen (Komponente bereits im Diagramm)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {pendingAddError && <div className="error-banner" role="alert">{pendingAddError}</div>}
              <div className="diagram-suggestion-actions">
                <button className="sb-save-btn" style={{ margin: 0 }} disabled={pendingAddSaving} onClick={confirmAdd}>Mit Auswahl hinzufügen</button>
                <button disabled={pendingAddSaving} onClick={addCompOnly}>Nur Komponente</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Context menu (fixed to viewport) ────────────────────────────────── */}
      {contextMenu.visible && (
        <div
          ref={menuRef}
          className="diagram-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {contextComp && (
            <div className="diagram-context-label">{contextComp.name}</div>
          )}
          <button
            className="diagram-context-item"
            onClick={() => {
              onSelectComponent(contextMenu.nodeId);
              setContextMenu((m) => ({ ...m, visible: false }));
            }}
          >
            <SlidersHorizontal size={14} /> Eigenschaften anzeigen
          </button>
          <button
            className="diagram-context-item"
            onClick={() => void copyElementLink(contextMenu.nodeId, contextComp?.name ?? "Element")}
          >
            <Link2 size={14} /> Link zu diesem Element kopieren
          </button>
          <button
            className="diagram-context-item"
            onClick={() => {
              dispatchConnectionMode({ type: "start", sourceId: contextMenu.nodeId });
              setContextMenu((m) => ({ ...m, visible: false }));
            }}
          >
            <GitBranch size={14} /> Neue Verbindung starten
          </button>
          <div className="diagram-context-separator" />
          <button
            className="diagram-context-item danger"
            title="Nur aus diesem Diagramm entfernen; das Element bleibt im Repository und in anderen Diagrammen erhalten."
            onClick={() => removeFromDiagram(contextMenu.nodeId)}
          >
            <X size={14} /> Aus Diagramm entfernen
          </button>
          <button
            className="diagram-context-item danger"
            title="Element endgültig löschen; es verschwindet aus allen Diagrammen."
            onClick={() => deleteFromRepository(contextMenu.nodeId)}
          >
            <Trash2 size={14} /> Aus Repository löschen…
          </button>
        </div>
      )}
    </div>
  );
}

/** #126: Geometrischer Marker statt Textzeichen (✕/+/○), damit er unabhängig von Schriftart mittig sitzt. */
function GatewayMarker({ shape, color }: { shape: string; color: string }) {
  const common = { stroke: color, strokeWidth: 7, strokeLinecap: "round" as const, fill: "none" };
  if (shape === "gateway-xor") return <path d="M37 37 L63 63 M63 37 L37 63" {...common} />;
  if (shape === "gateway-and") return <path d="M50 32 L50 68 M32 50 L68 50" {...common} />;
  if (shape === "gateway-or") return <circle cx={50} cy={50} r={15} {...common} strokeWidth={6} />;
  return null;
}

export default function DiagramEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner {...props} />
    </ReactFlowProvider>
  );
}
