import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  NodeResizer,
  Position,
  ReactFlowProvider,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeDragHandler,
  type NodeProps,
  useEdgesState,
  useNodesState
} from "reactflow";
import { GitBranch, MousePointerClick, PanelLeftClose, PanelLeftOpen, Search, SlidersHorizontal, X } from "lucide-react";
import { sidebarApi } from "./Sidebar/sidebarApi";
import { COMPONENT_DRAG_MIME, COMPONENT_TYPE_DRAG_MIME } from "./Sidebar/sidebarTypes";
import type {
  ComponentInstance,
  ComponentShape,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram,
  DiagramPosition
} from "./Sidebar/sidebarTypes";

interface Props {
  diagram: Diagram;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  connections: ConnectionInstance[];
  onDiagramChange: (updated: Diagram) => void;
  onConnectionCreated: (conn: ConnectionInstance) => void;
  onComponentCreated: (comp: ComponentInstance) => void;
  onSelectComponent: (id: string) => void;
  onSelectConnection: (id: string) => void;
  onClose: () => void;
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

const lineStyleDash: Record<string, string | undefined> = {
  solid: undefined,
  dashed: "6 3",
  dotted: "2 3"
};

/* ── Custom Node: rendert Komponenten je nach Form (BPMN-angelehnt) ─────────── */

const POOL_DEFAULT = { width: 480, height: 260 };

interface ShapedNodeData {
  name: string;
  typeName: string;
  color: string;
  shape: ComponentShape;
  isSource: boolean;
  onResizeEnd?: (nodeId: string, pos: { x: number; y: number; width: number; height: number }) => void;
}

function ShapedNode({ id, data, selected }: NodeProps<ShapedNodeData>) {
  const { name, typeName, color, shape, isSource } = data;

  const handles = (
    <>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </>
  );

  if (shape === "pool") {
    return (
      <div className={`shaped-node shape-pool${isSource ? " is-source" : ""}`} style={{ borderColor: color }}>
        <NodeResizer
          isVisible={selected}
          minWidth={240}
          minHeight={140}
          lineClassName="shape-pool-resize-line"
          handleClassName="shape-pool-resize-handle"
          onResizeEnd={(_e, params) =>
            data.onResizeEnd?.(id, { x: params.x, y: params.y, width: params.width, height: params.height })
          }
        />
        <div className="shape-pool-band" style={{ background: color }}>
          <span>{name}</span>
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
      <div className={`shaped-node shape-event${isSource ? " is-source" : ""}`}>
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
    const marker = shape === "gateway-xor" ? "✕" : shape === "gateway-and" ? "+" : shape === "gateway-or" ? "○" : null;
    return (
      <div className={`shaped-node shape-gateway${isSource ? " is-source" : ""}`}>
        <div className="shape-gateway-diamond" style={{ borderColor: color }}>
          {marker && <span className="shape-gateway-marker" style={{ color }}>{marker}</span>}
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
      <div className={`shaped-node shape-datastore${isSource ? " is-source" : ""}`} style={{ borderColor: color }}>
        <div className="shape-datastore-top" style={{ borderColor: color }} />
        <strong>{name}</strong>
        <span>{typeName}</span>
        {handles}
      </div>
    );
  }

  if (shape === "process") {
    return (
      <div className={`shaped-node shape-process${isSource ? " is-source" : ""}`} style={{ borderColor: color }}>
        <strong>{name}</strong>
        <span>{typeName}</span>
        {handles}
      </div>
    );
  }

  return (
    <div
      className={`shaped-node shape-box${isSource ? " is-source" : ""}`}
      style={{ borderColor: color, borderLeftColor: color }}
    >
      <strong>{name}</strong>
      <span>{typeName}</span>
      {handles}
    </div>
  );
}

const nodeTypes = { shaped: ShapedNode };

function buildNodes(
  diagram: Diagram,
  components: ComponentInstance[],
  componentTypes: ComponentType[],
  connectingFrom: string | null,
  onResizeEnd: ShapedNodeData["onResizeEnd"]
): Node[] {
  return diagram.componentIds.flatMap((id) => {
    const comp = components.find((c) => c.id === id);
    if (!comp) return [];
    const type = componentTypes.find((t) => t.id === comp.componentTypeId);
    const shape = type?.shape ?? "box";
    const pos = diagram.positions[id] ?? { x: 80 + Math.random() * 400, y: 80 + Math.random() * 300 };
    const isPool = shape === "pool";
    const node: Node = {
      id: comp.id,
      type: "shaped",
      position: { x: pos.x, y: pos.y },
      data: {
        name: comp.name,
        typeName: type?.name ?? "?",
        color: type?.color ?? "#cbd5e1",
        shape,
        isSource: connectingFrom === id,
        onResizeEnd
      } satisfies ShapedNodeData,
      // Pools liegen hinter den anderen Knoten, damit man Elemente darauf platzieren kann
      ...(isPool
        ? {
            zIndex: -1,
            style: {
              width: pos.width ?? POOL_DEFAULT.width,
              height: pos.height ?? POOL_DEFAULT.height
            }
          }
        : {})
    };
    return [node];
  });
}

function buildEdges(
  diagram: Diagram,
  connections: ConnectionInstance[],
  connectionTypes: ConnectionType[]
): Edge[] {
  return diagram.connectionIds.flatMap((id) => {
    const conn = connections.find((c) => c.id === id);
    if (!conn) return [];
    if (!diagram.componentIds.includes(conn.sourceComponentId) || !diagram.componentIds.includes(conn.targetComponentId)) return [];
    const type = connectionTypes.find((t) => t.id === conn.connectionTypeId);
    return [
      {
        id: conn.id,
        source: conn.sourceComponentId,
        target: conn.targetComponentId,
        label: type?.name ?? conn.name,
        labelBgPadding: [6, 3] as [number, number],
        labelBgBorderRadius: 4,
        labelStyle: { fill: "#172033", fontWeight: 700, fontSize: 11 },
        labelBgStyle: { fill: "#ffffff", fillOpacity: 0.9 },
        markerEnd: { type: MarkerType.ArrowClosed, color: type?.color ?? "#475569" },
        style: {
          stroke: type?.color ?? "#475569",
          strokeWidth: 2,
          strokeDasharray: lineStyleDash[type?.lineStyle ?? "solid"]
        }
      }
    ];
  });
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
              <span className="sb-color-dot" style={{ background: type.color }} />
              {type.name}
            </div>
            {items.map((comp) => (
              <PaletteItem key={comp.id} comp={comp} color={type.color} shape={type.shape ?? "box"} onAdd={onAdd} />
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

function PaletteItem({
  comp,
  color,
  shape,
  onAdd
}: {
  comp: ComponentInstance;
  color: string;
  shape: ComponentShape;
  onAdd: (id: string) => void;
}) {
  return (
    <button
      className="diagram-palette-item"
      style={{ borderLeftColor: color }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(COMPONENT_DRAG_MIME, comp.id);
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onAdd(comp.id)}
      title="Auf die Fläche ziehen oder klicken zum Hinzufügen"
    >
      <span className={`shape-glyph shape-glyph--${shape}`} style={{ borderColor: color }} />
      <strong>{comp.name}</strong>
    </button>
  );
}

/* ── Dialog: Neue Komponente aus gezogenem Typ erstellen ────────────────────── */

function CreateComponentDialog({
  type,
  onConfirm,
  onCancel
}: {
  type: ComponentType;
  onConfirm: (name: string, properties: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [properties, setProperties] = useState<Record<string, string>>({});
  const canConfirm = name.trim().length > 0;

  function confirm() {
    if (canConfirm) onConfirm(name.trim(), properties);
  }

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
              placeholder={`Neue ${type.name}`}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirm()}
            />
          </label>
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
        <div className="diagram-suggestion-actions">
          <button className="sb-save-btn" style={{ margin: 0 }} disabled={!canConfirm} onClick={confirm}>
            Erstellen & einfügen
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
  componentTypes,
  connectionTypes,
  components,
  connections,
  onDiagramChange,
  onConnectionCreated,
  onComponentCreated,
  onSelectComponent,
  onSelectConnection,
  onClose
}: Props) {
  // Pool-Größe nach Skalieren persistieren (inkl. Position, falls oben/links gezogen wurde)
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;

  const onPoolResizeEnd = useCallback(
    async (nodeId: string, pos: { x: number; y: number; width: number; height: number }) => {
      const current = diagramRef.current;
      const updatedPositions = { ...current.positions, [nodeId]: pos };
      const updated = await sidebarApi.updateDiagram(current.id, { positions: updatedPositions });
      onDiagramChange(updated);
    },
    [onDiagramChange]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(
    buildNodes(diagram, components, componentTypes, null, onPoolResizeEnd)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    buildEdges(diagram, connections, connectionTypes)
  );
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [pendingCreate, setPendingCreate] = useState<{ typeId: string; position: DiagramPosition } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ visible: false, x: 0, y: 0, nodeId: "" });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();

  useEffect(() => {
    setNodes(buildNodes(diagram, components, componentTypes, connectingFrom, onPoolResizeEnd));
    setEdges(buildEdges(diagram, connections, connectionTypes));
  }, [diagram.componentIds, diagram.connectionIds, components, componentTypes, connections, connectingFrom]);

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

  // ── Shared connection creation ──────────────────────────────────────────────

  const createConnectionBetween = useCallback(
    async (sourceId: string, targetId: string) => {
      const srcComp = components.find((c) => c.id === sourceId);
      const tgtComp = components.find((c) => c.id === targetId);
      if (!srcComp || !tgtComp) return;

      const allowed = connectionTypes.filter((ct) => {
        const srcOk = ct.allowedSourceTypeIds.length === 0 || ct.allowedSourceTypeIds.includes(srcComp.componentTypeId);
        const tgtOk = ct.allowedTargetTypeIds.length === 0 || ct.allowedTargetTypeIds.includes(tgtComp.componentTypeId);
        return srcOk && tgtOk;
      });

      // Spezifischere Typen (mit eingeschränkten Quell-/Ziel-Listen) gewinnen
      // gegenüber Catch-all-Typen ohne Einschränkungen.
      const specificity = (ct: ConnectionType) =>
        (ct.allowedSourceTypeIds.length > 0 ? 1 : 0) + (ct.allowedTargetTypeIds.length > 0 ? 1 : 0);
      const connType = [...allowed].sort((a, b) => specificity(b) - specificity(a))[0] ?? connectionTypes[0];
      if (!connType) { setError("Keine Verbindungs-Typen definiert."); return; }

      try {
        const newConn = await sidebarApi.createConnection({
          name: "",
          connectionTypeId: connType.id,
          sourceComponentId: sourceId,
          targetComponentId: targetId,
          description: ""
        });
        onConnectionCreated(newConn);
        const updatedDiagram = await sidebarApi.updateDiagram(diagram.id, {
          connectionIds: [...diagram.connectionIds, newConn.id]
        });
        onDiagramChange(updatedDiagram);
        setError("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Verbindung konnte nicht erstellt werden.");
      }
    },
    [components, connectionTypes, diagram, onConnectionCreated, onDiagramChange]
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
      if (!connectingFrom) {
        onSelectComponent(node.id);
        return;
      }
      const target = node.id;
      setConnectingFrom(null);
      if (target === connectingFrom) return;
      await createConnectionBetween(connectingFrom, target);
    },
    [connectingFrom, createConnectionBetween, onSelectComponent]
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
    setConnectingFrom(null);
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, nodeId: node.id });
  }, []);

  async function removeFromDiagram(nodeId: string) {
    const newCompIds = diagram.componentIds.filter((id) => id !== nodeId);
    const newConnIds = diagram.connectionIds.filter((id) => {
      const conn = connections.find((c) => c.id === id);
      return conn && conn.sourceComponentId !== nodeId && conn.targetComponentId !== nodeId;
    });
    const updated = await sidebarApi.updateDiagram(diagram.id, {
      componentIds: newCompIds,
      connectionIds: newConnIds
    });
    onDiagramChange(updated);
    setContextMenu((m) => ({ ...m, visible: false }));
  }

  // ── Drag stop ───────────────────────────────────────────────────────────────

  const onNodeDragStop: NodeDragHandler = useCallback(
    async (_event, node) => {
      // Bestehende Größe (z. B. von Pools) beim Verschieben nicht verlieren
      const prev = diagram.positions[node.id];
      const updatedPositions = { ...diagram.positions, [node.id]: { ...prev, ...node.position } };
      const updated = await sidebarApi.updateDiagram(diagram.id, { positions: updatedPositions });
      onDiagramChange(updated);
    },
    [diagram, onDiagramChange]
  );

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

  const onCanvasDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDragOver(false);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

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
    },
    [screenToFlowPosition, diagram, connections, components]
  );

  async function createAndPlaceComponent(name: string, properties: Record<string, string>) {
    if (!pendingCreate) return;
    const { typeId, position } = pendingCreate;
    try {
      const comp = await sidebarApi.createComponent({
        name,
        componentTypeId: typeId,
        properties,
        description: ""
      });
      onComponentCreated(comp);
      const updated = await sidebarApi.updateDiagram(diagram.id, {
        componentIds: [...diagram.componentIds, comp.id],
        positions: { ...diagram.positions, [comp.id]: position }
      });
      onDiagramChange(updated);
      setPendingCreate(null);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Komponente konnte nicht erstellt werden.");
    }
  }

  // ── Smart add ───────────────────────────────────────────────────────────────

  async function startAddComponent(compId: string, position?: DiagramPosition) {
    if (diagram.componentIds.includes(compId)) return;

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

    setPendingAdd({ compId, suggestions, position });
  }

  function toggleSuggestion(index: number) {
    setPendingAdd((p) =>
      p ? { ...p, suggestions: p.suggestions.map((s, i) => i === index ? { ...s, selected: !s.selected } : s) } : null
    );
  }

  async function doAdd(compId: string, extraCompIds: string[], extraConnIds: string[], position?: DiagramPosition) {
    const newCompIds = [
      ...diagram.componentIds, compId,
      ...extraCompIds.filter((id) => !diagram.componentIds.includes(id))
    ];
    const newConnIds = [
      ...diagram.connectionIds,
      ...extraConnIds.filter((id) => !diagram.connectionIds.includes(id))
    ];
    const newPositions = { ...diagram.positions };
    if (position) {
      newPositions[compId] = position;
      // Mit-hinzugefügte Nachbarn fächerförmig neben der Drop-Position platzieren
      extraCompIds.forEach((id, i) => {
        if (!newPositions[id]) newPositions[id] = { x: position.x + 260, y: position.y + i * 110 };
      });
    }
    const updated = await sidebarApi.updateDiagram(diagram.id, {
      componentIds: newCompIds,
      connectionIds: newConnIds,
      positions: newPositions
    });
    onDiagramChange(updated);
  }

  async function confirmAdd() {
    if (!pendingAdd) return;
    const selected = pendingAdd.suggestions.filter((s) => s.selected);
    await doAdd(
      pendingAdd.compId,
      selected.flatMap((s) => (s.otherComp ? [s.otherComp.id] : [])),
      selected.map((s) => s.conn.id),
      pendingAdd.position
    );
    setPendingAdd(null);
  }

  async function addCompOnly() {
    if (!pendingAdd) return;
    await doAdd(pendingAdd.compId, [], [], pendingAdd.position);
    setPendingAdd(null);
  }

  const availableComponents = components.filter((c) => !diagram.componentIds.includes(c.id));
  const contextComp = components.find((c) => c.id === contextMenu.nodeId);
  const diagramIsEmpty = diagram.componentIds.length === 0;

  return (
    <div className="diagram-editor">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="diagram-toolbar">
        <button
          className="diagram-palette-toggle"
          onClick={() => setPaletteOpen((v) => !v)}
          title={paletteOpen ? "Palette ausblenden" : "Palette einblenden"}
          aria-pressed={paletteOpen}
        >
          {paletteOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
          Palette
        </button>
        <strong className="diagram-title">{diagram.name}</strong>
        <span className="muted diagram-hint">
          Aus der Palette ziehen · Klick auf Knoten/Verbindung zeigt Eigenschaften · Rechtsklick für Optionen
        </span>
        <button className="diagram-close-btn" onClick={onClose} title="Tab schließen"><X size={16} /></button>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {/* ── Connect mode banner ─────────────────────────────────────────────── */}
      {connectingFrom && (() => {
        const fromComp = components.find((c) => c.id === connectingFrom);
        return (
          <div className="diagram-connect-banner">
            <GitBranch size={14} />
            <span>Verbindung von <strong>{fromComp?.name}</strong> — Klicke auf Ziel-Komponente</span>
            <button onClick={() => setConnectingFrom(null)}>Abbrechen</button>
          </div>
        );
      })()}

      {/* ── Palette + Canvas ────────────────────────────────────────────────── */}
      <div className="diagram-body">
        {paletteOpen && (
          <Palette
            components={availableComponents}
            componentTypes={componentTypes}
            onAdd={(id) => startAddComponent(id)}
          />
        )}

        <div
          className={`diagram-canvas${isDragOver ? " diagram-canvas--drop" : ""}`}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onEdgeClick={onEdgeClick}
            onNodeContextMenu={onNodeContextMenu}
            onNodeDragStop={onNodeDragStop}
            fitView
          >
            <MiniMap nodeStrokeWidth={3} pannable zoomable />
            <Controls />
            <Background gap={24} />
          </ReactFlow>

          {diagramIsEmpty && (
            <div className="diagram-empty-hint">
              <MousePointerClick size={28} />
              <strong>Diagramm ist noch leer</strong>
              <span>Ziehe eine Komponente aus der Palette hierher{paletteOpen ? "" : " (Palette links einblenden)"} oder klicke sie an.</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Dialog: neue Komponente aus gezogenem Typ ───────────────────────── */}
      {pendingCreate && (() => {
        const type = componentTypes.find((t) => t.id === pendingCreate.typeId);
        if (!type) return null;
        return (
          <CreateComponentDialog
            type={type}
            onConfirm={createAndPlaceComponent}
            onCancel={() => setPendingCreate(null)}
          />
        );
      })()}

      {/* ── Smart-add suggestion overlay ────────────────────────────────────── */}
      {pendingAdd && (() => {
        const comp = components.find((c) => c.id === pendingAdd.compId);
        return (
          <div className="diagram-suggestion-overlay">
            <div className="diagram-suggestion-card">
              <div className="diagram-suggestion-header">
                <strong>Verbindungen gefunden</strong>
                <button className="sb-close-btn" onClick={() => setPendingAdd(null)}><X size={14} /></button>
              </div>
              <p className="muted">
                <strong style={{ color: "#172033" }}>{comp?.name}</strong> hat bestehende Verbindungen.
                Sollen diese auch ins Diagramm?
              </p>
              <div className="diagram-suggestion-list">
                {pendingAdd.suggestions.map((s, i) => {
                  const connType = connectionTypes.find((t) => t.id === s.conn.connectionTypeId);
                  const otherId = s.conn.sourceComponentId === pendingAdd.compId ? s.conn.targetComponentId : s.conn.sourceComponentId;
                  const otherComp = components.find((c) => c.id === otherId);
                  const otherType = componentTypes.find((t) => t.id === otherComp?.componentTypeId);
                  const direction = s.conn.sourceComponentId === pendingAdd.compId ? "→" : "←";
                  return (
                    <label key={s.conn.id} className="diagram-suggestion-row">
                      <input type="checkbox" checked={s.selected} onChange={() => toggleSuggestion(i)} />
                      <span className="sb-color-dot" style={{ background: otherType?.color ?? "#cbd5e1" }} />
                      <span className="diagram-suggestion-label">
                        <strong>{otherComp?.name ?? "?"}</strong>
                        <span className="muted">{direction} via {connType?.name ?? "?"}</span>
                        {s.isCompAlreadyInDiagram && (
                          <span className="diagram-suggestion-hint">Verbindung hinzufügen (Komponente bereits im Diagramm)</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="diagram-suggestion-actions">
                <button className="sb-save-btn" style={{ margin: 0 }} onClick={confirmAdd}>Mit Auswahl hinzufügen</button>
                <button onClick={addCompOnly}>Nur Komponente</button>
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
            onClick={() => {
              setConnectingFrom(contextMenu.nodeId);
              setContextMenu((m) => ({ ...m, visible: false }));
            }}
          >
            <GitBranch size={14} /> Neue Verbindung starten
          </button>
          <div className="diagram-context-separator" />
          <button
            className="diagram-context-item danger"
            onClick={() => removeFromDiagram(contextMenu.nodeId)}
          >
            <X size={14} /> Aus Diagramm entfernen
          </button>
        </div>
      )}
    </div>
  );
}

export default function DiagramEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <DiagramEditorInner {...props} />
    </ReactFlowProvider>
  );
}
