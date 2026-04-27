import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import type { Connection, Edge, Node, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import './App.css';
import { ApiClient } from './api/ApiClient';
import type { Branch, DiagramDto, ElementDto } from './api/ApiClient';
import { config } from './config';
import { archimateCatalog } from './catalog/archimateCatalog';
import { Icon } from './ui/icons';
import { MarkerType } from 'reactflow';
import { useI18n } from './i18n/I18nProvider';
import type { Language } from './i18n/i18n';

const DEMO_USER_ID = '11111111-1111-4111-8111-111111111111';
const DEFAULT_DIAGRAM_NAME = 'Main';

const ALL_LAYERS: Array<'Business' | 'Application' | 'Information' | 'Technology'> = [
  'Business',
  'Application',
  'Information',
  'Technology',
];

function layerTint(layer: string) {
  switch (layer) {
    case 'Business':
      return 'rgba(34, 197, 94, 0.25)';
    case 'Application':
      return 'rgba(59, 130, 246, 0.25)';
    case 'Information':
      return 'rgba(168, 85, 247, 0.25)';
    case 'Technology':
      return 'rgba(245, 158, 11, 0.25)';
    default:
      return 'rgba(148, 163, 184, 0.18)';
  }
}

function heatColor(value: number, min: number, max: number) {
  const t = max === min ? 0 : Math.max(0, Math.min(1, (value - min) / (max - min)));
  const hue = 120 - Math.round(120 * t); // green->red
  return `hsl(${hue} 75% 55%)`;
}

function toFlowNodes(
  elements: ElementDto[],
  heatmapKey?: string,
  connectFromKey?: string | null,
): Node[] {
  let min = Infinity;
  let max = -Infinity;
  if (heatmapKey) {
    for (const e of elements) {
      const v = Number((e.attributes as any)?.[heatmapKey]);
      if (Number.isFinite(v)) {
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
  }

  return elements.map((e) => {
    const v = heatmapKey ? Number((e.attributes as any)?.[heatmapKey]) : NaN;
    const bg =
      heatmapKey && Number.isFinite(v) && Number.isFinite(min) && Number.isFinite(max)
        ? heatColor(v, min, max)
        : undefined;

    const tint = layerTint(e.layer);

    const et = archimateCatalog.getElementType(e.archiType);

    const connectFrom = connectFromKey != null && connectFromKey === e.key;

    return {
      id: e.key,
      position: { x: e.x, y: e.y },
      data: {
        label: e.name,
        archiType: e.archiType,
        layer: e.layer,
        bg,
        icon: et?.icon ?? 'box',
        connectFrom,
      },
      type: 'archi',
      style: {
        padding: 0,
        borderRadius: 12,
        border: `1px solid ${tint}`,
        background: bg
          ? `linear-gradient(180deg, color-mix(in oklab, ${bg} 28%, white), white)`
          : 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.92))',
        minWidth: 180,
        boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
      },
      className: `archiNode ${connectFrom ? 'archiNodeSelected' : ''}`,
    };
  });
}

// Legacy helper removed (edges now come from DiagramEdge)

function layoutDagre(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 90 });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) g.setNode(n.id, { width: 180, height: 48 });
  for (const e of edges) g.setEdge(e.source, e.target);
  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: { x: pos.x - 90, y: pos.y - 24 },
    };
  });
}

export default function App() {
  const api = useMemo(() => new ApiClient(config.apiBaseUrl), []);
  const { language, setLanguage, t } = useI18n();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);
  const [diagrams, setDiagrams] = useState<DiagramDto[]>([]);
  const [activeDiagramId, setActiveDiagramId] = useState<string | null>(null);
  const [elements, setElements] = useState<ElementDto[]>([]);
  // Legacy global relations removed from UI state (diagram rendering uses DiagramEdge).
  const [diagramNodes, setDiagramNodes] = useState<Array<{ id: string; elementKey: string; x: number; y: number }>>([]);
  const [diagramEdges, setDiagramEdges] = useState<Array<{ id: string; type: string; sourceKey: string; targetKey: string }>>([]);
  const [status, setStatus] = useState<string>('Loading…');
  const [heatmapKey, setHeatmapKey] = useState<string>('');
  const [filterText, setFilterText] = useState<string>('');
  const [layerFilter, setLayerFilter] = useState<string>('All');
  const [relationType, setRelationType] = useState<string>(archimateCatalog.relationTypes[0]!.id);
  const [connectMode, setConnectMode] = useState<boolean>(true);
  const [connectFromKey, setConnectFromKey] = useState<string | null>(null);

  const rf = useRef<ReactFlowInstance | null>(null);

  const filteredElements = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return elements.filter((e) => {
      if (layerFilter !== 'All' && e.layer !== layerFilter) return false;
      if (!q) return true;
      return e.name.toLowerCase().includes(q) || e.archiType.toLowerCase().includes(q);
    });
  }, [elements, filterText, layerFilter]);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeTypes = useMemo(
    () => ({
      archi: ({ data }: any) => (
        <div className={`nodeCard ${data.connectFrom ? 'nodeCardSelected' : ''}`}>
          <Handle
            type="target"
            position={Position.Left}
            className="archiHandle archiHandleTarget"
            isConnectable
          />
          <div className="nodeTop">
            <div className="nodeIcon" style={{ background: layerTint(data.layer) }}>
              <Icon name={data.icon} />
            </div>
            <div className="nodeTitle">{data.label}</div>
          </div>
          <div className="nodeMeta">
            {data.layer} · {data.archiType}
          </div>
          <Handle
            type="source"
            position={Position.Right}
            className="archiHandle archiHandleSource"
            isConnectable
          />
        </div>
      ),
    }),
    [],
  );

  const refresh = useCallback(async (branchId: string, diagramId: string | null) => {
    const ds = await api.listDiagrams(branchId);
    setDiagrams(ds);

    // Repository library (all elements in branch)
    const repoElements = await api.listElements(branchId);
    setElements(repoElements);

    if (diagramId) {
      const view = await api.diagramView(diagramId);
      setDiagramNodes(view.nodes.map((n) => ({ id: n.id, elementKey: n.elementKey, x: n.x, y: n.y })));
      setDiagramEdges(view.edges.map((e) => ({ id: e.id, type: e.type, sourceKey: e.sourceKey, targetKey: e.targetKey })));
    } else {
      setDiagramNodes([]);
      setDiagramEdges([]);
    }

    // legacy global relations exist in backend but are not needed for the diagram UI
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.listBranches();
        const branch =
          list.length === 0
            ? await api.createBranch({ name: 'main', createdById: DEMO_USER_ID })
            : list[0]!;
        setBranches(list.length === 0 ? [branch] : list);
        setActiveBranchId(branch.id);

        let ds = await api.listDiagrams(branch.id);
        if (ds.length === 0) {
          // Always have at least one diagram so drag & drop works out of the box.
          const main = await api.createDiagram({ branchId: branch.id, name: DEFAULT_DIAGRAM_NAME });
          ds = [main];
        }
        setDiagrams(ds);
        setActiveDiagramId(ds[0]!.id);
        await refresh(branch.id, ds[0]!.id);
        setStatus('Ready');
      } catch (e: any) {
        setStatus(`API error: ${e?.message ?? String(e)}`);
      }
    })();
  }, []);

  useEffect(() => {
    if (!activeDiagramId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const placed = diagramNodes
      .map((dn) => {
        const el = filteredElements.find((e) => e.key === dn.elementKey);
        if (!el) return null;
        return { ...el, x: dn.x, y: dn.y };
      })
      .filter(Boolean) as ElementDto[];

    setNodes(toFlowNodes(placed, heatmapKey || undefined, connectFromKey));
    setEdges(
      diagramEdges.map((e) => ({
        id: e.id,
        source: e.sourceKey,
        target: e.targetKey,
        label: e.type,
        animated: false,
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: '#94a3b8' },
      })),
    );
  }, [filteredElements, diagramNodes, diagramEdges, heatmapKey, activeDiagramId, connectFromKey]);

  const onConnect = useCallback(
    async (connection: Connection) => {
      if (!activeBranchId) return;
      if (!activeDiagramId) return;
      if (!connection.source || !connection.target) return;
      const created = await api.createDiagramEdge({
        diagramId: activeDiagramId,
        type: relationType,
        sourceKey: connection.source,
        targetKey: connection.target,
      });
      setDiagramEdges((prev) => [created, ...prev]);
      setEdges((eds) => addEdge({ ...connection, id: created.id, label: created.type }, eds));
    },
    [activeBranchId, activeDiagramId, relationType],
  );

  const onNodeClick = useCallback(
    async (_: any, node: Node) => {
      if (!connectMode) return;
      if (!activeBranchId || !activeDiagramId) return;

      if (!connectFromKey) {
        setConnectFromKey(node.id);
        return;
      }

      if (connectFromKey === node.id) {
        setConnectFromKey(null);
        return;
      }

      const created = await api.createDiagramEdge({
        diagramId: activeDiagramId,
        type: relationType,
        sourceKey: connectFromKey,
        targetKey: node.id,
      });
      setDiagramEdges((prev) => [created, ...prev]);
      setEdges((eds) => addEdge({ id: created.id, source: created.sourceKey, target: created.targetKey, label: created.type }, eds));
      setConnectFromKey(null);
    },
    [connectMode, connectFromKey, activeBranchId, activeDiagramId, relationType, api],
  );

  const onNodeDragStop = useCallback(
    async (_: any, node: Node) => {
      if (!activeDiagramId) return;
      const dn = diagramNodes.find((n) => n.elementKey === node.id);
      if (!dn) return;
      const updated = await api.movePlacedElement(dn.id, { x: node.position.x, y: node.position.y });
      setDiagramNodes((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, x: updated.x, y: updated.y } : p)),
      );
    },
    [diagramNodes, activeDiagramId, api],
  );

  const onNodeDoubleClick = useCallback(
    async (_: any, node: Node) => {
      const el = elements.find((e) => e.key === node.id);
      if (!el) return;
      const next = prompt('Name', el.name);
      if (!next || next.trim() === el.name) return;
      const updated = await api.updateElement(el.id, { name: next.trim() });
      setElements((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    },
    [elements, api],
  );

  const onDragStartLibrary = (elementKey: string) => (ev: React.DragEvent) => {
    ev.dataTransfer.setData('application/vibe-eam-element', elementKey);
    ev.dataTransfer.effectAllowed = 'move';
  };

  // Ensures we always have an active diagram; auto-creates "Main" if none exists.
  const ensureActiveDiagram = useCallback(async (): Promise<string | null> => {
    if (activeDiagramId) return activeDiagramId;
    if (!activeBranchId) return null;
    const created = await api.createDiagram({ branchId: activeBranchId, name: DEFAULT_DIAGRAM_NAME });
    setDiagrams((prev) => [created, ...prev]);
    setActiveDiagramId(created.id);
    return created.id;
  }, [activeBranchId, activeDiagramId, api]);

  const onDrop = useCallback(
    async (ev: React.DragEvent) => {
      ev.preventDefault();
      if (!rf.current) return;
      if (!activeBranchId) {
        setStatus(t('hint.selectDiagram'));
        return;
      }

      const existingKey = ev.dataTransfer.getData('application/vibe-eam-element');
      if (!existingKey) return;

      const diagramId = await ensureActiveDiagram();
      if (!diagramId) {
        setStatus(t('hint.selectDiagram'));
        return;
      }

      const position = rf.current.screenToFlowPosition({ x: ev.clientX, y: ev.clientY });

      try {
        const placed = await api.placeElement({
          diagramId,
          elementKey: existingKey,
          x: position.x,
          y: position.y,
        });
        setDiagramNodes((prev) => {
          const without = prev.filter((p) => p.id !== placed.id);
          return [{ id: placed.id, elementKey: placed.elementKey, x: placed.x, y: placed.y }, ...without];
        });
      } catch (e: any) {
        setStatus(`Drop failed: ${e?.message ?? String(e)}`);
      }
    },
    [activeBranchId, api, ensureActiveDiagram, t],
  );

  const createElementOfType = useCallback(
    async (archiType: string, layer: string, label: string) => {
      if (!activeBranchId) return;
      const promptMessage = t('prompt.newElement').replace('{type}', label);
      const name = prompt(promptMessage);
      if (!name || !name.trim()) return;
      try {
        const created = await api.createElement({
          branchId: activeBranchId,
          name: name.trim(),
          archiType,
          layer,
          attributes: { cost: 10, risk: 1 },
        });
        setElements((els) => [created, ...els]);
      } catch (e: any) {
        setStatus(`Create failed: ${e?.message ?? String(e)}`);
      }
    },
    [activeBranchId, api, t],
  );

  const onDragOver = useCallback((ev: React.DragEvent) => {
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  }, []);

  const autoLayout = useCallback(async () => {
    if (!activeBranchId) return;
    const next = layoutDagre(nodes, edges);
    setNodes(next);
    if (!activeDiagramId) return;
    // persist new positions (diagram placements)
    const byElementKey = new Map(diagramNodes.map((n) => [n.elementKey, n]));
    await Promise.all(
      next.map((n) => {
        const dn = byElementKey.get(n.id);
        if (!dn) return Promise.resolve();
        return api.movePlacedElement(dn.id, { x: n.position.x, y: n.position.y });
      }),
    );
    await refresh(activeBranchId, activeDiagramId);
  }, [activeBranchId, activeDiagramId, nodes, edges, diagramNodes]);

  const exportCsv = useCallback(async () => {
    if (!activeBranchId) return;
    const data = await api.exportCsv(activeBranchId);
    await navigator.clipboard.writeText(data.elementsCsv + '\n\n' + data.relationsCsv);
    alert(t('toast.exportedCsv'));
  }, [activeBranchId, api, t]);

  const runImpact = useCallback(async () => {
    if (!activeBranchId) return;
    const selected = rf.current?.getNodes()?.[0]?.id ?? nodes[0]?.id;
    if (!selected) return;
    const res = await api.impact({ branchId: activeBranchId, elementKey: selected, maxDepth: 4 });
    alert(`Impact visited ${res.visitedKeys.length} elements.`);
  }, [activeBranchId, nodes]);

  const layers = useMemo(() => ['All', 'Business', 'Application', 'Information', 'Technology'], []);

  // Tree: Layer -> ElementType -> instances (filtered by current search/layer filter)
  const repositoryTree = useMemo(() => {
    const byKey = new Map<string, ElementDto[]>();
    for (const e of filteredElements) {
      const k = `${e.layer}/${e.archiType}`;
      const arr = byKey.get(k);
      if (arr) arr.push(e);
      else byKey.set(k, [e]);
    }
    return ALL_LAYERS.map((layer) => {
      const types = archimateCatalog.elementTypes
        .filter((t) => t.layer === layer)
        .map((t) => ({
          type: t,
          instances: byKey.get(`${t.layer}/${t.id}`) ?? [],
        }));
      return { layer, types };
    });
  }, [filteredElements]);

  return (
    <div className="appShell">
      <header className="headerBar">
        <div className="headerLeft">
          <div className="brand">vibe-eam</div>
          <select
            value={activeBranchId ?? ''}
            onChange={async (e) => {
              const id = e.target.value;
              setActiveBranchId(id);
              let ds = await api.listDiagrams(id);
              if (ds.length === 0) {
                const main = await api.createDiagram({ branchId: id, name: DEFAULT_DIAGRAM_NAME });
                ds = [main];
              }
              setDiagrams(ds);
              const nextDiagramId = ds[0]!.id;
              setActiveDiagramId(nextDiagramId);
              await refresh(id, nextDiagramId);
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {t('label.branch')}: {b.name}
              </option>
            ))}
          </select>
          <select
            value={activeDiagramId ?? ''}
            onChange={async (e) => {
              const id = e.target.value;
              if (!id) return;
              setActiveDiagramId(id);
              if (activeBranchId) await refresh(activeBranchId, id);
            }}
          >
            {diagrams.map((d) => (
              <option key={d.id} value={d.id}>
                {t('label.diagram')}: {d.name}
              </option>
            ))}
          </select>
        </div>

        <div className="headerRight">
          <button
            type="button"
            className={connectMode ? (connectFromKey ? 'connectBtn connectArmed' : 'connectBtn connectOn') : 'connectBtn'}
            onClick={() => {
              setConnectMode((v) => !v);
              setConnectFromKey(null);
            }}
            title={
              connectMode
                ? connectFromKey
                  ? 'Quelle ausgewählt – jetzt Ziel‑Knoten anklicken'
                  : 'Connect Mode aktiv – Quell‑Knoten anklicken'
                : 'Connect Mode aktivieren'
            }
          >
            {connectMode
              ? connectFromKey
                ? 'Connect: → Ziel wählen'
                : 'Connect: Quelle wählen'
              : 'Connect: OFF'}
          </button>
          <select value={relationType} onChange={(e) => setRelationType(e.target.value)}>
            {archimateCatalog.relationTypes.map((r) => (
              <option key={r.id} value={r.id}>
                {t('label.relation')}: {r.label}
              </option>
            ))}
          </select>
          <select value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
            <option value="de">DE</option>
            <option value="en">EN</option>
          </select>
        </div>
      </header>

      <aside className="sidebar">
        <div className="sidebarHeader">
          <div className="title">{t('section.navigation')}</div>
          <div className="sub">{status}</div>
        </div>

        <div className="section">
          <div className="sectionTitle">{t('section.filter')}</div>
          <input
            placeholder={t('placeholder.search')}
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
          />
          <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value)}>
            {layers.map((l) => (
              <option key={l} value={l}>
                {l === 'All' ? t('layer.all') : l}
              </option>
            ))}
          </select>
        </div>

        <div className="navGroupTitle">{t('nav.repository')}</div>
        <div className="tree">
          {repositoryTree.map((layerGroup) => (
            <details key={layerGroup.layer} open className="treeLayer">
              <summary className="treeLayerSummary">
                <span className="treeChevron" aria-hidden>›</span>
                <span className="treeLayerDot" style={{ background: layerTint(layerGroup.layer) }} />
                <span className="treeLayerLabel">{layerGroup.layer}</span>
              </summary>
              <div className="treeLayerBody">
                {layerGroup.types.map(({ type, instances }) => (
                  <details key={type.id} className="treeType">
                    <summary className="treeTypeSummary">
                      <span className="treeChevron" aria-hidden>›</span>
                      <span className="treeTypeIcon" style={{ background: layerTint(type.layer) }}>
                        <Icon name={type.icon} size={14} />
                      </span>
                      <span className="treeTypeLabel">{type.label}</span>
                      <span className="treeCount">{instances.length}</span>
                      <button
                        type="button"
                        className="treeAddBtn"
                        title={`${t('action.newElement')}: ${type.label}`}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          createElementOfType(type.id, type.layer, type.label);
                        }}
                      >
                        +
                      </button>
                    </summary>
                    <div className="treeTypeBody">
                      {instances.length === 0 && (
                        <div className="treeEmpty">{t('hint.empty')}</div>
                      )}
                      {instances.map((inst) => (
                        <div
                          key={inst.id}
                          className="treeInstance"
                          draggable
                          onDragStart={onDragStartLibrary(inst.key)}
                          title={`${inst.name} — ${t('hint.dragHere')}`}
                        >
                          <span className="treeInstanceIcon" style={{ background: layerTint(inst.layer) }}>
                            <Icon name={archimateCatalog.getElementType(inst.archiType)?.icon ?? 'box'} size={12} />
                          </span>
                          <span className="treeInstanceLabel">{inst.name}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </details>
          ))}
        </div>

        <div className="navGroupTitle">{t('nav.diagrams')}</div>
        {diagrams.length === 0 && <div className="treeEmpty">{t('hint.empty')}</div>}
        {diagrams.map((d) => (
          <div
            key={d.id}
            className={`navItem navItemSmall ${activeDiagramId === d.id ? 'navItemActive' : ''}`}
            onClick={async () => {
              setActiveDiagramId(d.id);
              if (activeBranchId) await refresh(activeBranchId, d.id);
            }}
          >
            <div>
              <div className="navItemLabel">{d.name}</div>
              <div className="navItemMeta">{t('label.diagram')}</div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={async () => {
            if (!activeBranchId) return;
            const name = prompt(t('prompt.newDiagram'));
            if (!name) return;
            const d = await api.createDiagram({ branchId: activeBranchId, name });
            setDiagrams((prev) => [d, ...prev]);
            setActiveDiagramId(d.id);
            await refresh(activeBranchId, d.id);
          }}
        >
          {t('action.newDiagram')}
        </button>

        <div className="section">
          <div className="sectionTitle">{t('section.heatmap')}</div>
          <input
            placeholder={t('placeholder.heatmapKey')}
            value={heatmapKey}
            onChange={(e) => setHeatmapKey(e.target.value)}
          />
        </div>

        <div className="section">
          <div className="sectionTitle">{t('section.tools')}</div>
          <button type="button" onClick={autoLayout}>
            {t('action.autoLayout')}
          </button>
          <button type="button" onClick={runImpact}>
            {t('action.impactDemo')}
          </button>
          <button type="button" onClick={exportCsv}>
            {t('action.exportCsv')}
          </button>
        </div>
      </aside>

      <main className="canvasWrap" onDrop={onDrop} onDragOver={onDragOver}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onInit={(i) => (rf.current = i)}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDoubleClick={onNodeDoubleClick}
          onNodeDragStop={onNodeDragStop}
          snapToGrid
          snapGrid={[10, 10]}
          fitView
        >
          <Background gap={20} size={1} />
          <MiniMap pannable zoomable />
          <Controls />
        </ReactFlow>
      </main>
    </div>
  );
}
