import React, { useMemo } from 'react';
import { EAMData, ArchiMateLayer } from '@shared/index';
import { Search, Monitor, Cpu, Database as DbIcon, ShieldAlert, TrendingDown, Plus } from 'lucide-react';
import { cn } from '../lib/utils';

interface InventoryTableProps {
  data: EAMData;
  isLoading: boolean;
  onAddClick: () => void;
  onAssetClick: (id: string) => void;
}

export function InventoryTable({ data, isLoading, onAddClick, onAssetClick }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<string>('All');

  const filteredAssets = useMemo(() => {
    if (!data?.assets) return [];
    return data.assets.filter(asset => {
      const name = asset.name || "";
      const description = asset.description || "";
      const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           asset.id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = activeFilter === 'All' || asset.layer === activeFilter;
      return matchesSearch && matchesFilter;
    });
  }, [data, searchTerm, activeFilter]);

  const getLayerColor = (layer: ArchiMateLayer) => {
    switch(layer) {
      case 'Business': return 'bg-amber-500/10 border-amber-500/20 text-amber-500';
      case 'Application': return 'bg-blue-500/10 border-blue-500/20 text-blue-500';
      case 'Technology': return 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500';
      default: return 'bg-slate-500/10 border-slate-500/20 text-slate-500';
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4">
      {/* Table Header Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['All', 'Business', 'Application', 'Technology'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border transition-all",
                activeFilter === filter 
                  ? "bg-white text-black border-white" 
                  : "bg-transparent text-slate-500 border-white/10 hover:border-white/30"
              )}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input 
              type="text" 
              placeholder="Search enterprise inventory..."
              className="bg-white/[0.03] border border-white/5 rounded pl-10 pr-4 py-1.5 text-xs text-slate-100 w-72 focus:outline-none focus:border-white/20 transition-colors"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={onAddClick}
            className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-600/10"
          >
            <Plus size={14} />
            Add Fragment
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl overflow-auto backdrop-blur-md">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-[#0A0C16] border-b border-white/5 text-slate-500 sticky top-0 z-20">
            <tr>
              <th className="w-32 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-center">Layer</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest">Architectural Fragment</th>
              <th className="w-40 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest">Classification</th>
              <th className="w-32 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-center">Risk Level</th>
              <th className="w-24 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                   <td colSpan={5} className="px-4 py-4 h-12 bg-white/[0.01]"></td>
                </tr>
              ))
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-20 text-center text-slate-500 text-xs italic">
                  No fragments found in the current structural view.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => (
                <tr 
                  key={asset.id} 
                  onClick={() => onAssetClick(asset.id)}
                  className="hover:bg-white/[0.03] transition-colors group cursor-pointer bg-white/[0.01]"
                >
                  <td className="px-4 py-4">
                    <div className="flex justify-center">
                      <span className={cn(
                        "text-[9px] font-black px-2 py-0.5 rounded border uppercase tracking-widest leading-none",
                        getLayerColor(asset.layer)
                      )}>
                        {asset.layer}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-white transition-colors">{asset.name}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[9px] text-slate-600 font-mono tracking-tighter uppercase font-bold">UID:</span>
                        <span className="text-[9px] text-slate-400 font-mono tracking-tighter">{asset.id}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                        <span className="text-[10px] text-slate-400 font-mono uppercase tracking-tight">
                          {asset.type}
                        </span>
                     </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                       {asset.risk === 'High' ? (
                         <div className="flex items-center gap-2 text-rose-500 px-2 py-0.5 bg-rose-500/5 border border-rose-500/10 rounded">
                           <ShieldAlert size={10} />
                           <span className="text-[9px] font-bold uppercase tracking-wider">Critical</span>
                         </div>
                       ) : asset.risk === 'Medium' ? (
                        <div className="flex items-center gap-2 text-amber-500 px-2 py-0.5 bg-amber-500/5 border border-amber-500/10 rounded">
                          <TrendingDown size={10} />
                          <span className="text-[9px] font-bold uppercase tracking-wider">Moderate</span>
                        </div>
                       ) : (
                        <div className="flex items-center gap-2 text-emerald-500 px-2 py-0.5 bg-emerald-500/5 border border-emerald-500/10 rounded">
                          <span className="text-[9px] font-bold uppercase tracking-wider">Low</span>
                        </div>
                       )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className={cn(
                      "text-[9px] font-bold tracking-widest uppercase",
                      asset.lifecycle?.status === 'Production' ? "text-emerald-500" : "text-slate-600"
                    )}>
                      {asset.lifecycle?.status || 'Unknown'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer / Summary Info */}
      <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono uppercase tracking-[0.2em] px-2 mb-2">
        <div className="flex items-center gap-6">
          <span>Active Fragments: <span className="text-white">{filteredAssets.length}</span></span>
          <div className="w-1 h-1 rounded-full bg-white/20" />
          <span>Total Capital: <span className="text-white">${filteredAssets.reduce((sum, a) => sum + (a.cost || 0), 0).toLocaleString()}</span></span>
        </div>
        <div className="flex items-center gap-2 text-slate-100">
           <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
           System Integrity: 98.4%
        </div>
      </div>
    </div>
  );
}
