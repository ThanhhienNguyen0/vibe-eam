import { useCallback, useEffect, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Connection,
  type Edge,
  type Node,
  type NodeDragHandler,
  useEdgesState,
  useNodesState
} from "reactflow";
import { GitBranch, Plus, X } from "lucide-react";
import { sidebarApi } from "./Sidebar/sidebarApi";
import type {
  ComponentInstance,
  ComponentType,
  ConnectionInstance,
  ConnectionType,
  Diagram
} from "./Sidebar/sidebarTypes";

interface Props {
  diagram: Diagram;
  componentTypes: ComponentType[];
  connectionTypes: ConnectionType[];
  components: ComponentInstance[];
  connections: ConnectionInstance[];
  onDiagramChange: (updated: Diagram) => void;
  onConnectionCreated: (conn: ConnectionInstance) => void;
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

function buildNodes(
  diagram: Diagram,
  components: ComponentInstance[],
  componentTypes: ComponentType[],
  connectingFrom: string | null
): Node[] {
  return diagram.componentIds.flatMap((id) => {
    const comp = components.find((c) => c.id === id);
    if (!comp) return [];
    const type = componentTypes.find((t) => t.id === comp.componentTypeId);
    const pos = diagram.positions[id] ?? { x: 80 + Math.random() * 400, y: 80 + Math.random() * 300 };
    const isSource = connectingFrom === id;
    return [
      {
        id: comp.id,
        position: pos,
        data: {
          label: (
            <div className="diagram-node">
              <strong>{comp.name}</strong>
              <span>{type?.name ?? "?"}</span>
            </div>
          )
        },
        style: {
          border: isSource ? "2px solid #1d4ed8" : `2px solid ${type?.color ?? "#cbd5e1"}`,
          borderLeft: `8px solid ${type?.color ?? "#cbd5e1"}`,
          borderRadius: 8,
          minWidth: 160,
          background: isSource ? "#eff6ff" : "#ffffff",
          padding: 10,
          boxShadow: isSource ? "0 0 0 3px #bfdbfe" : undefined
        }
      }
    ];
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

export default function DiagramEditor({
  diagram,
  componentTypes,
  connectionTypes,
  components,
  connections,
  onDiagramChange,
  onConnectionCreated,
  onClose
}: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState(
    buildNodes(diagram, components, componentTypes, null)
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    buildEdges(diagram, connections, connectionTypes)
  );
  const [showPicker, setShowPicker] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<PendingAdd | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenu>({ visible: false, x: 0, y: 0, nodeId: "" });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [error, setError] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNodes(buildNodes(diagram, components, componentTypes, connectingFrom));
    setEdges(buildEdges(diagram, connections, connectionTypes));
  }, [diagram.componentIds, diagram.connectionIds, connections, connectingFrom]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu.visible) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
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

      const connType = allowed[0] ?? connectionTypes[0];
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

  // ── Node click: handle connect mode ────────────────────────────────────────

  const onNodeClick = useCallback(
    async (_e: React.MouseEvent, node: Node) => {
      if (!connectingFrom) return;
      const target = node.id;
      setConnectingFrom(null);
      if (target === connectingFrom) return;
      await createConnectionBetween(connectingFrom, target);
    },
    [connectingFrom, createConnectionBetween]
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
      const updatedPositions = { ...diagram.positions, [node.id]: node.position };
      const updated = await sidebarApi.updateDiagram(diagram.id, { positions: updatedPositions });
      onDiagramChange(updated);
    },
    [diagram, onDiagramChange]
  );

  // ── Smart add ───────────────────────────────────────────────────────────────

  async function startAddComponent(compId: string) {
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
      await doAdd(compId, [], []);
      setShowPicker(false);
      return;
    }

    setPendingAdd({ compId, suggestions });
    setShowPicker(false);
  }

  function toggleSuggestion(index: number) {
    setPendingAdd((p) =>
      p ? { ...p, suggestions: p.suggestions.map((s, i) => i === index ? { ...s, selected: !s.selected } : s) } : null
    );
  }

  async function doAdd(compId: string, extraCompIds: string[], extraConnIds: string[]) {
    const newCompIds = [
      ...diagram.componentIds, compId,
      ...extraCompIds.filter((id) => !diagram.componentIds.includes(id))
    ];
    const newConnIds = [
      ...diagram.connectionIds,
      ...extraConnIds.filter((id) => !diagram.connectionIds.includes(id))
    ];
    const updated = await sidebarApi.updateDiagram(diagram.id, { componentIds: newCompIds, connectionIds: newConnIds });
    onDiagramChange(updated);
  }

  async function confirmAdd() {
    if (!pendingAdd) return;
    const selected = pendingAdd.suggestions.filter((s) => s.selected);
    await doAdd(pendingAdd.compId, selected.flatMap((s) => (s.otherComp ? [s.otherComp.id] : [])), selected.map((s) => s.conn.id));
    setPendingAdd(null);
  }

  async function addCompOnly() {
    if (!pendingAdd) return;
    await doAdd(pendingAdd.compId, [], []);
    setPendingAdd(null);
  }

  const availableComponents = components.filter((c) => !diagram.componentIds.includes(c.id));
  const contextComp = components.find((c) => c.id === contextMenu.nodeId);

  return (
    <div className="diagram-editor">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="diagram-toolbar">
        <strong className="diagram-title">{diagram.name}</strong>
        <button onClick={() => { setShowPicker((v) => !v); setPendingAdd(null); }} title="Komponente hinzufügen">
          <Plus size={16} /> Komponente
        </button>
        <span className="muted diagram-hint">Rechtsklick auf Node für Optionen</span>
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

      {/* ── Component picker ────────────────────────────────────────────────── */}
      {showPicker && (
        <div className="diagram-picker">
          <strong>Komponente hinzufügen</strong>
          {availableComponents.length === 0 && <p className="muted">Alle Komponenten bereits im Diagramm.</p>}
          <div className="diagram-picker-list">
            {availableComponents.map((comp) => {
              const type = componentTypes.find((t) => t.id === comp.componentTypeId);
              return (
                <button
                  key={comp.id}
                  className="diagram-picker-item"
                  style={{ borderLeftColor: type?.color ?? "#cbd5e1" }}
                  onClick={() => startAddComponent(comp.id)}
                >
                  <strong>{comp.name}</strong>
                  <span>{type?.name ?? "?"}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

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

      {/* ── ReactFlow canvas ────────────────────────────────────────────────── */}
      <div className="diagram-canvas">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
          fitView
        >
          <MiniMap nodeStrokeWidth={3} pannable zoomable />
          <Controls />
          <Background gap={24} />
        </ReactFlow>
      </div>

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
