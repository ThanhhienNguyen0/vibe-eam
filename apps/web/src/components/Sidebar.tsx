import React from 'react';
import { LayoutDashboard, Share2, FileText, Database, Server, Settings, Upload } from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUploadClick: () => void;
}

const menuItems = [
  { id: 'inventory', label: 'Inventory', icon: LayoutDashboard },
  { id: 'graph', label: 'Dependency Graph', icon: Share2 },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export function Sidebar({ activeTab, setActiveTab, onUploadClick }: SidebarProps) {
  return (
    <aside className="w-64 h-screen bg-[#080A12]/80 backdrop-blur-xl border-r border-white/10 flex flex-col p-6 z-50">
      <div className="flex items-center gap-3 mb-10">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20">E</div>
        <h1 className="text-lg font-semibold tracking-tight text-white">EAM Architect</h1>
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium border",
              activeTab === item.id 
                ? "bg-white/10 text-blue-400 border-white/10 shadow-sm shadow-blue-500/5" 
                : "text-slate-400 border-transparent hover:text-slate-100 hover:bg-white/5"
            )}
          >
            <item.icon size={18} className={activeTab === item.id ? "text-blue-400" : "text-slate-500"} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="pt-6 mt-6 border-t border-white/5 space-y-4">
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300">
          <div className="font-semibold mb-1 uppercase tracking-wider opacity-60">Active Workspace</div>
          <div className="flex items-center justify-between">
            <span className="font-medium">Cloud-Native-Stack</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
          </div>
        </div>

        <div className="space-y-1">
          <button 
            onClick={onUploadClick}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-emerald-400 hover:bg-emerald-600/10 transition-all border border-transparent hover:border-emerald-500/20"
          >
            <Upload size={16} />
            Sync Assets
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-100 hover:bg-white/5 transition-all">
            <Settings size={16} />
            Settings
          </button>
        </div>
      </div>
    </aside>
  );
}
