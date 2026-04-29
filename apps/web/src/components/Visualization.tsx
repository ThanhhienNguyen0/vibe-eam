import React, { useMemo, useCallback, useEffect } from 'react';
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
  Connection
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EAMData } from '@shared/index';
import { Monitor, Server as ServerIcon, Database as DbIcon, Edit2, Check } from 'lucide-react';

const CustomNode = ({ data }: any) => {
  const Icon = data.type === 'Application' ? Monitor : data.type === 'Server' ? ServerIcon : DbIcon;
  const colorClass = data.type === 'Application' 
    ? 'text-blue-400 border-blue-500/30' 
    : data.type === 'Server' 
      ? 'text-purple-400 border-purple-500/30' 
      : 'text-orange-400 border-orange-500/30';

  return (
    <div className={`px-4 py-3 bg-[#080A12]/90 backdrop-blur-xl border rounded-xl shadow-2xl min-w-[200px] transition-all hover:border-white/20 group ${colorClass}`}>
      <Handle type="target" position={Position.Top} className="!bg-white/20 !w-3 !h-3 !-top-1.5 hover:!bg-white/50 transition-colors" />
      <div className="flex flex-col">
        <div className="flex justify-between items-start mb-1">
          <div className="text-[9px] uppercase font-bold opacity-60 tracking-wider font-mono">{data.type}</div>
          <Edit2 size={10} className="opacity-0 group-hover:opacity-40 transition-opacity cursor-pointer" />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-white/5">
            <Icon size={14} className="opacity-80" />
          </div>
          <div className="text-xs font-semibold text-slate-100 tracking-tight">{data.label}</div>
        </div>
        
        <div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-2">
          <div className="flex justify-between items-center text-[9px] font-mono">
            <span className="opacity-40 uppercase">Status</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <Check size={8} /> ONLINE
            </span>
          </div>
          {data.type === 'Application' && (
            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mt-1">
              <div className="h-full w-4/5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white/20 !w-3 !h-3 !-bottom-1.5 hover:!bg-white/50 transition-colors" />
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
};

interface VisualizationProps {
  data: EAMData;
}

export function Visualization({ data }: VisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    const allAssets = [
      ...(data?.applications || []),
      ...(data?.servers || []),
      ...(data?.databases || []),
    ];

    allAssets.forEach((asset, index) => {
      initialNodes.push({
        id: asset.id,
        type: 'custom',
        data: { label: asset.name, type: asset.type },
        position: { x: (index % 4) * 300, y: Math.floor(index / 4) * 200 },
        dragHandle: '.group', // Allow dragging when clicking the node group
      });

      if (asset.type === 'Application' && asset.dependencies) {
        asset.dependencies.forEach((depId) => {
          initialEdges.push({
            id: `e-${asset.id}-${depId}`,
            source: asset.id,
            target: depId,
            animated: true,
            style: { stroke: 'rgba(59, 130, 246, 0.4)', strokeWidth: 2 },
          });
        });
      }
    });

    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [data, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ 
      ...params, 
      animated: true, 
      style: { stroke: 'rgba(59, 130, 246, 0.4)', strokeWidth: 2 } 
    }, eds)),
    [setEdges]
  );

  return (
    <div className="flex-1 bg-[#05060B] border border-white/5 rounded-2xl relative overflow-hidden flex flex-col group/flow">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-[0.02] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
          backgroundSize: '40px 40px' 
        }} 
      />

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="px-3 py-1.5 bg-[#0A0C16]/90 backdrop-blur-md border border-white/10 rounded-lg shadow-xl">
          <div className="text-[10px] font-bold text-slate-100 uppercase tracking-widest flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            Interactive Mode
          </div>
        </div>
        <div className="text-[9px] text-slate-500 font-mono bg-[#0A0C16]/40 px-2 py-1 rounded backdrop-blur-sm">
          DRAG TO REORDER • CONNECT HANDLES TO MAP DEPENDENCIES
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className="bg-transparent"
          deleteKeyCode="Delete"
        >
          <Background color="transparent" />
          <Controls className="bg-[#0A0C16] border-white/10 fill-slate-300 rounded-lg overflow-hidden !m-4 shadow-2xl" />
          <MiniMap 
            nodeColor={(n) => {
              if (n.data?.type === 'Application') return '#3b82f6';
              if (n.data?.type === 'Server') return '#a855f7';
              return '#f97316';
            }}
            maskColor="rgba(8, 10, 18, 0.8)" 
            className="bg-[#0A0C16] border border-white/10 rounded-xl overflow-hidden !bottom-4 !right-4 !m-0 shadow-2xl" 
          />
        </ReactFlow>
      </div>
      
      <div className="absolute bottom-4 left-4 bg-[#0A0C16]/90 backdrop-blur-lg border border-white/10 p-5 rounded-2xl text-[10px] space-y-3 z-10 shadow-2xl min-w-[160px]">
        <div className="font-bold uppercase tracking-[0.2em] text-slate-300 mb-2 border-b border-white/10 pb-2 flex items-center justify-between">
          Legend
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
        </div>
        <div className="flex items-center gap-3 group/item">
          <div className="w-3 h-3 rounded-md bg-blue-500/20 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.2)] group-hover/item:scale-110 transition-transform" /> 
          <span className="text-slate-400 group-hover/item:text-slate-200 transition-colors uppercase tracking-tight font-medium">Application</span>
        </div>
        <div className="flex items-center gap-3 group/item">
          <div className="w-3 h-3 rounded-md bg-purple-500/20 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.2)] group-hover/item:scale-110 transition-transform" /> 
          <span className="text-slate-400 group-hover/item:text-slate-200 transition-colors uppercase tracking-tight font-medium">Microservice</span>
        </div>
        <div className="flex items-center gap-3 group/item">
          <div className="w-3 h-3 rounded-md bg-orange-500/20 border border-orange-500/40 shadow-[0_0_12px_rgba(249,115,22,0.2)] group-hover/item:scale-110 transition-transform" /> 
          <span className="text-slate-400 group-hover/item:text-slate-200 transition-colors uppercase tracking-tight font-medium">Database</span>
        </div>
      </div>
    </div>
  );
}
