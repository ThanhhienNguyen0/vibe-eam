import React, { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge,
  Handle,
  Position
} from 'reactflow';
import 'reactflow/dist/style.css';
import { EAMData } from '@shared/index';
import { Monitor, Server as ServerIcon, Database as DbIcon } from 'lucide-react';

const CustomNode = ({ data }: any) => {
  const Icon = data.type === 'Application' ? Monitor : data.type === 'Server' ? ServerIcon : DbIcon;
  const colorClass = data.type === 'Application' 
    ? 'text-blue-400 border-blue-500/30' 
    : data.type === 'Server' 
      ? 'text-purple-400 border-purple-500/30' 
      : 'text-orange-400 border-orange-500/30';

  return (
    <div className={`px-4 py-3 bg-[#080A12]/80 backdrop-blur-xl border rounded-xl shadow-2xl min-w-[180px] ${colorClass}`}>
      <Handle type="target" position={Position.Top} className="!bg-white/20 !w-2 !h-2 !-top-1" />
      <div className="flex flex-col">
        <div className="text-[9px] uppercase font-bold opacity-60 tracking-wider mb-1">{data.type}</div>
        <div className="flex items-center gap-2">
          <Icon size={14} className="opacity-80" />
          <div className="text-xs font-semibold text-slate-100">{data.label}</div>
        </div>
        {data.type === 'Application' && (
          <div className="mt-3 h-1 w-full bg-white/5 rounded-full overflow-hidden">
            <div className="h-full w-4/5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white/20 !w-2 !h-2 !-bottom-1" />
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
  const { nodes, edges } = useMemo(() => {
    const initialNodes: Node[] = [];
    const initialEdges: Edge[] = [];

    const allAssets = [
      ...data.applications,
      ...data.servers,
      ...data.databases,
    ];

    allAssets.forEach((asset, index) => {
      initialNodes.push({
        id: asset.id,
        type: 'custom',
        data: { label: asset.name, type: asset.type },
        position: { x: (index % 4) * 250, y: Math.floor(index / 4) * 150 },
      });

      if (asset.type === 'Application') {
        asset.dependencies.forEach((depId) => {
          initialEdges.push({
            id: `e-${asset.id}-${depId}`,
            source: asset.id,
            target: depId,
            animated: true,
            style: { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1.5 },
          });
        });
      }
    });

    return { nodes: initialNodes, edges: initialEdges };
  }, [data]);

  return (
    <div className="w-full h-full bg-[#080A12] border border-white/10 rounded-2xl relative overflow-hidden">
      {/* Grid Pattern Background */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none" 
        style={{ 
          backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
          backgroundSize: '32px 32px' 
        }} 
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
      >
        <Background color="transparent" />
        <Controls className="bg-[#0A0C16] border-white/10 fill-slate-300 rounded-lg overflow-hidden" />
        <MiniMap 
          nodeColor={(n) => {
            if (n.data?.type === 'Application') return '#3b82f6';
            if (n.data?.type === 'Server') return '#a855f7';
            return '#f97316';
          }}
          maskColor="rgba(8, 10, 18, 0.8)" 
          className="bg-[#0A0C16] border border-white/10 rounded-xl overflow-hidden !bottom-4 !right-4" 
        />
      </ReactFlow>
      
      <div className="absolute bottom-4 left-4 bg-[#0A0C16]/90 backdrop-blur-md border border-white/10 p-4 rounded-xl text-[10px] space-y-2 z-10">
        <div className="font-semibold uppercase tracking-widest text-slate-500 mb-1 border-b border-white/5 pb-1">Legend</div>
        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]" /> <span>Interface / UI</span></div>
        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.3)]" /> <span>API Microservice</span></div>
        <div className="flex items-center gap-3"><div className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.3)]" /> <span>Data Persistence</span></div>
      </div>
    </div>
  );
}
