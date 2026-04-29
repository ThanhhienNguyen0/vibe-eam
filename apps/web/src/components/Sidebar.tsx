import React from 'react';
import { 
  LayoutDashboard, 
  Share2, 
  FileText, 
  Database, 
  Server, 
  Settings, 
  Upload, 
  Plus, 
  ChevronLeft, 
  ChevronRight 
} from 'lucide-react';
import { cn } from '../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onUploadClick: () => void;
  onExportClick: () => void;
  onAddClick: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

const menuItems = [
  { id: 'inventory', label: 'Inventory', icon: LayoutDashboard },
  { id: 'graph', label: 'Dependency Graph', icon: Share2 },
  { id: 'reports', label: 'Reports', icon: FileText },
];

export function Sidebar({ 
  activeTab, 
  setActiveTab, 
  onUploadClick, 
  onExportClick, 
  onAddClick,
  isCollapsed,
  setIsCollapsed
}: SidebarProps) {
  return (
    <aside className={cn(
      "h-screen bg-[#080A12] border-r border-white/5 flex flex-col p-6 z-50 transition-all duration-300 relative",
      isCollapsed ? "w-20" : "w-64"
    )}>
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute -right-3 top-20 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg border border-white/10 hover:bg-blue-500 transition-colors z-[60]"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      <div className={cn("flex items-center gap-3 mb-12", isCollapsed ? "justify-center" : "")}>
        <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-blue-600/20 shrink-0">A</div>
        {!isCollapsed && <h1 className="text-sm font-bold uppercase tracking-[0.25em] text-white">Architect</h1>}
      </div>

      <nav className="flex-1 space-y-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded transition-all text-[11px] font-bold uppercase tracking-widest border",
              isCollapsed ? "justify-center" : "justify-between",
              activeTab === item.id 
                ? "bg-white/10 text-blue-400 border-white/10" 
                : "text-slate-500 border-transparent hover:text-slate-200 hover:bg-white/5"
            )}
          >
            <div className="flex items-center gap-3">
              <item.icon size={14} className={activeTab === item.id ? "text-blue-400" : "text-slate-500"} />
              {!isCollapsed && item.label}
            </div>
            {!isCollapsed && activeTab === item.id && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>}
          </button>
        ))}
      </nav>

      <div className="pt-8 mt-auto border-t border-white/5 space-y-6">
        <div className="space-y-4">
          <div className={cn(isCollapsed ? "px-0" : "px-4")}>
            {!isCollapsed && <div className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em] mb-4">Operations</div>}
            <div className="space-y-2">
              <button 
                onClick={onUploadClick}
                className={cn(
                  "w-full flex items-center gap-3 px-0 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-colors",
                  isCollapsed ? "justify-center" : ""
                )}
              >
                <Upload size={14} />
                {!isCollapsed && "Import Data"}
              </button>
              <button 
                className={cn(
                  "w-full flex items-center gap-3 px-0 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-300 hover:text-white transition-colors",
                  isCollapsed ? "justify-center" : ""
                )}
                onClick={onExportClick}
              >
                <Database size={14} />
                {!isCollapsed && "Export Data"}
              </button>
              <button className={cn(
                "w-full flex items-center gap-3 px-0 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-300 transition-colors",
                isCollapsed ? "justify-center" : ""
              )}>
                <Settings size={14} />
                {!isCollapsed && "Settings"}
              </button>
            </div>
          </div>
        </div>

        {!isCollapsed && (
          <div className="p-4 bg-white/[0.02] border border-white/5 rounded-xl">
             <div className="flex items-center justify-between mb-2">
               <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Active Stack</span>
               <div className="flex gap-1">
                  {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-emerald-500/50 animate-pulse"></div>)}
               </div>
             </div>
             <div className="text-[10px] font-mono text-slate-300">CLOUD-HYBRID:PROD</div>
          </div>
        )}
      </div>
    </aside>
  );
}
