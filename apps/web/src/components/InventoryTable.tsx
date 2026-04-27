import React from 'react';
import { EAMData, Application, Server, Database } from '@shared/index';
import { Search, Filter, Monitor, Database as DbIcon, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';

interface InventoryTableProps {
  data: EAMData;
  isLoading: boolean;
}

export function InventoryTable({ data, isLoading }: InventoryTableProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [activeFilter, setActiveFilter] = React.useState<string>('All');

  const allAssets = [
    ...data.applications,
    ...data.servers,
    ...data.databases,
  ];

  const filteredAssets = allAssets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         asset.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = activeFilter === 'All' || asset.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'Application': return <Monitor size={14} className="text-blue-400" />;
      case 'Server': return <Cpu size={14} className="text-emerald-400" />;
      case 'Database': return <DbIcon size={14} className="text-purple-400" />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Table Header Controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {['All', 'Application', 'Server', 'Database'].map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                activeFilter === filter 
                  ? "bg-slate-100 text-slate-900 border-slate-100" 
                  : "bg-transparent text-slate-400 border-slate-700 hover:border-slate-500"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search assets..."
            className="glass-input pl-9 text-sm w-64"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="flex-1 bg-white/[0.03] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
        <table className="w-full text-left border-collapse table-fixed">
          <thead className="bg-white/[0.02] border-b border-white/5 text-slate-400">
            <tr>
              <th className="w-24 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest">Type</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest">Asset Name</th>
              <th className="w-40 px-4 py-3 text-[10px] font-semibold uppercase tracking-widest">Details</th>
              <th className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-right">Health</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={4} className="px-4 py-4 h-12 bg-white/[0.01]"></td>
                </tr>
              ))
            ) : filteredAssets.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-20 text-center text-slate-500 text-xs italic tracking-wide">
                  No assets found. Synchronize your catalog to populate.
                </td>
              </tr>
            ) : (
              filteredAssets.map((asset) => (
                <tr key={asset.id} className="hover:bg-white/[0.03] transition-colors group cursor-pointer bg-white/[0.01]">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                       {getIcon(asset.type)}
                       <span className={cn(
                         "text-[10px] font-mono px-1.5 py-0.5 rounded border leading-none",
                         asset.type === 'Application' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                         asset.type === 'Server' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                         "bg-purple-500/10 border-purple-500/20 text-purple-400"
                       )}>
                         {asset.type.substring(0, 3).toUpperCase()}
                       </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition-colors uppercase tracking-tight">{asset.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono mt-0.5">{asset.id}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-[11px] text-slate-400 font-medium">
                      {asset.type === 'Application' && (asset as Application).technology}
                      {asset.type === 'Server' && (asset as Server).ipAddress}
                      {asset.type === 'Database' && (asset as Database).dbType}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="text-[10px] font-semibold text-emerald-400 underline decoration-emerald-400/30 underline-offset-4 tracking-widest uppercase">Stable</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Footer / Summary */}
      <div className="flex items-center justify-between px-2 text-[10px] text-slate-500 font-mono uppercase tracking-widest">
        <span>Total Records: {filteredAssets.length}</span>
        <span>Filter: {activeFilter}</span>
      </div>
    </div>
  );
}
