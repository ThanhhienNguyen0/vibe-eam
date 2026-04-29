import React, { useMemo, useCallback, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  Node,
  Edge,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  MarkerType
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import { EAMData, EAMAsset } from '@shared/index';
import { Monitor, Cpu, Database as DbIcon, Zap, Activity, Info } from 'lucide-react';
import { cn } from '../lib/utils';

// DAGRE LAYOUT ENGINE
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: 220, height: 80 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;
    node.position = {
      x: nodeWithPosition.x - 110,
      y: nodeWithPosition.y - 40,
    };
  });

  return { nodes, edges };
};

const CustomNode = ({ data, selected }: any) => {
  const isBusiness = data.asset.layer === 'Business';
  const isApplication = data.asset.layer === 'Application';
  const isTechnology = data.asset.layer === 'Technology' || data.asset.layer === 'Implementation';

  const layerColor = isBusiness ? 'border-amber-500/50' : isApplication ? 'border-blue-500/50' : 'border-emerald-500/50';
  const iconColor = isBusiness ? 'text-amber-400' : isApplication ? 'text-blue-400' : 'text-emerald-400';
  
  return (
    <div className={cn(
      "px-4 py-3 bg-[#080A12]/95 backdrop-blur-xl border rounded-xl shadow-2xl min-w-[220px] transition-all group relative",
      layerColor,
      selected && "ring-2 ring-white/50 ring-offset-2 ring-offset-[#080A12]",
      data.impacted && "ring-2 ring-rose-500 shadow-[0_0_20px_rgba(244,63,94,0.3)] border-rose-500/50"
    )}>
      <Handle type="target" position={Position.Top} className="!bg-white/20 !w-3 !h-3 !-top-1.5 hover:!bg-white/50 transition-colors" />
      
      <div className="flex flex-col">
        <div className="flex justify-between items-start mb-2">
          <div className={cn("text-[8px] font-black uppercase tracking-[0.2em] font-mono opacity-60", iconColor)}>
            {data.asset.layer}
          </div>
          {data.impacted && (
             <div className="px-1.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/50 text-rose-500 text-[7px] font-bold uppercase animate-pulse">
                Impact Warning
             </div>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-white/5 border border-white/5">
            {isBusiness ? <Activity size={16} className={iconColor} /> : 
             isApplication ? <Monitor size={16} className={iconColor} /> : 
             <Cpu size={16} className={iconColor} />}
          </div>
          <div className="flex flex-col min-w-0">
             <div className="text-xs font-bold text-slate-100 tracking-tight truncate">{data.label}</div>
             <div className="text-[8px] text-slate-500 font-mono uppercase font-bold">{data.asset.type}</div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2">
           <div className="flex items-center gap-1.5">
              <div className={cn(
                "w-1 h-1 rounded-full",
                data.asset.risk === 'High' ? 'bg-rose-500' : data.asset.risk === 'Medium' ? 'bg-amber-500' : 'bg-emerald-500'
              )} />
              <span className="text-[8px] text-slate-500 font-bold uppercase font-mono">Risk: {data.asset.risk || 'Low'}</span>
           </div>
           <Info size={10} className="text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-white/20 !w-3 !h-3 !-bottom-1.5 hover:!bg-white/50 transition-colors" />
    </div>
  );
};

const nodeTypesRaw = {
  custom: CustomNode,
};

interface VisualizationProps {
  data: EAMData;
  onNodeClick?: (id: string) => void;
}

export function Visualization({ data, onNodeClick }: VisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const performImpactAnalysis = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
    if (nodeId && onNodeClick) {
      onNodeClick(nodeId);
    }
    
    if (!nodeId) {
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, impacted: false } })));
      setEdges((eds) => eds.map((e) => ({ ...e, style: { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 } })));
      return;
    }

    // Find all downstream impacts
    const impactedIds = new Set<string>();
    const findImpacts = (id: string, visited = new Set<string>()) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      edges.forEach(edge => {
        if (edge.source === id) {
          impactedIds.add(edge.target);
          findImpacts(edge.target, visited);
        }
      });
    };

    findImpacts(nodeId);

    setNodes((nds) => nds.map((n) => ({
      ...n,
      data: { ...n.data, impacted: n.id === nodeId || impactedIds.has(n.id) }
    })));

    setEdges((eds) => eds.map((e) => {
      const isPartofImpact = e.source === nodeId || impactedIds.has(e.source);
      return {
        ...e,
        style: isPartofImpact 
          ? { stroke: '#f43f5e', strokeWidth: 3, opacity: 1 } 
          : { stroke: 'rgba(255, 255, 255, 0.05)', strokeWidth: 1, opacity: 0.3 }
      };
    }));
  }, [edges, setNodes, setEdges]);

  useEffect(() => {
    if (!data?.assets) return;
    
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    data.assets.forEach((asset) => {
      initialNodes.push({
        id: asset.id,
        type: 'custom',
        data: { label: asset.name, asset, impacted: false },
        position: { x: 0, y: 0 },
      });

      if ((asset as any).dependencies) {
        (asset as any).dependencies.forEach((depId: string) => {
          initialEdges.push({
            id: `e-${asset.id}-${depId}`,
            source: asset.id,
            target: depId,
            animated: true,
            style: { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1.5 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: 'rgba(255, 255, 255, 0.2)',
            },
          });
        });
      }
    });

    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges);
    setNodes(layoutedNodes);
    setEdges(layoutedEdges);
  }, [data, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 1.5 } 
    }, eds)),
    [setEdges]
  );

  const nodeTypes = useMemo(() => ({
    custom: CustomNode,
  }), []);

  return (
    <div className="flex-1 bg-[#05060B] border border-white/5 rounded-2xl relative overflow-hidden flex flex-col">
      {/* HUD Header */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <div className="px-3 py-1.5 bg-[#0A0C16]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl flex items-center gap-3">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live EA Graph</span>
          </div>
          <div className="text-[8px] text-slate-500 font-mono bg-[#0A0C16]/40 px-2 py-1 rounded backdrop-blur-sm border border-white/5 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
             ENGINE: DAGRE-ORCHESTRATOR v2.4
          </div>
        </div>

        {selectedNodeId && (
          <button 
            onClick={() => performImpactAnalysis(null)}
            className="px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-[9px] font-bold uppercase tracking-widest hover:bg-rose-500/20 transition-all flex items-center gap-2 shadow-2xl"
          >
            Clear Impact Filter
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => performImpactAnalysis(node.id)}
          onPaneClick={() => performImpactAnalysis(null)}
          nodeTypes={nodeTypes}
          fitView
          className="bg-transparent"
          deleteKeyCode="Delete"
          selectionKeyCode="Shift"
          multiSelectionKeyCode="Control"
        >
          <Background color="transparent" />
          <Controls className="bg-[#0A0C16] border-white/10 fill-slate-300 rounded-lg overflow-hidden shadow-2xl" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.data?.asset?.layer === 'Business') return '#f59e0b';
              if (n.data?.asset?.layer === 'Application') return '#3b82f6';
              return '#10b981';
            }}
            maskColor="rgba(8, 10, 18, 0.8)" 
            className="bg-[#0A0C16] border border-white/10 rounded-xl overflow-hidden !bottom-4 !right-4 shadow-2xl" 
          />
        </ReactFlow>
      </div>
      
      {/* Legend Overlay */}
      <div className="absolute top-4 right-4 bg-[#0A0C16]/80 backdrop-blur-md border border-white/10 p-4 rounded-xl text-[9px] space-y-2 z-10 shadow-2xl">
        <div className="font-black uppercase tracking-[0.2em] text-slate-500 border-b border-white/5 pb-1 mb-2">Layers</div>
        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded bg-amber-500/20 border border-amber-500/50" /> <span className="text-slate-300 font-bold uppercase tracking-widest">Business</span></div>
        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded bg-blue-500/20 border border-blue-500/50" /> <span className="text-slate-300 font-bold uppercase tracking-widest">Application</span></div>
        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/50" /> <span className="text-slate-100 font-bold uppercase tracking-widest">Technology</span></div>
        <div className="mt-4 pt-2 border-t border-white/5 opacity-50 flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
           <span className="text-slate-400 font-medium">Arrow Direction = Source ➔ Dependency</span>
        </div>
      </div>
    </div>
  );
}
