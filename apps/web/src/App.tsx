import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { InventoryTable } from './components/InventoryTable';
import { Visualization } from './components/Visualization';
import { UploadModal } from './components/UploadModal';
import { EAMData } from '@shared/index';
import { AlertCircle, RefreshCw, Layers, Database, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [data, setData] = useState<EAMData>({ applications: [], servers: [], databases: [] });
  const [activeTab, setActiveTab] = useState('inventory');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/inventory');
      const json = await response.json();
      setData(json);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalAssets = data.applications.length + data.servers.length + data.databases.length;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onUploadClick={() => setIsUploadOpen(true)} 
      />

      <main className="flex-1 flex flex-col relative overflow-hidden bg-[#05060B]">
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#080A12]/40 backdrop-blur-sm sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-medium text-slate-100">
              {activeTab === 'inventory' ? 'Dynamic Asset Inventory' : 
               activeTab === 'graph' ? 'Dependency Mapping' : 'System Reports'}
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-white/10 uppercase font-mono tracking-tight">v1.2.0-alpha</span>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-blue-500 opacity-80" />
                <span className="text-[11px] font-mono text-slate-400">{data.applications.length} Apps</span>
              </div>
              <div className="flex items-center gap-2">
                <Server size={14} className="text-emerald-500 opacity-80" />
                <span className="text-[11px] font-mono text-slate-400">{data.servers.length} Servers</span>
              </div>
              <div className="flex items-center gap-2">
                <Database size={14} className="text-purple-500 opacity-80" />
                <span className="text-[11px] font-mono text-slate-400">{data.databases.length} DBs</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={fetchData}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-slate-100 group"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={cn("transition-transform duration-500", isLoading ? 'animate-spin' : 'group-hover:rotate-180')} />
            </button>
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 border border-white/20 shadow-lg shadow-blue-500/10 cursor-pointer hover:scale-105 transition-transform"></div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 p-6 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="h-full flex flex-col"
            >
              {activeTab === 'inventory' && (
                <InventoryTable data={data} isLoading={isLoading} />
              )}
              {activeTab === 'graph' && (
                <Visualization data={data} />
              )}
              {activeTab === 'reports' && (
                <div className="flex flex-col items-center justify-center h-full text-slate-500">
                  <div className="p-6 bg-blue-500/5 rounded-full border border-blue-500/10 mb-6 group">
                    <AlertCircle size={40} className="text-blue-500/50 group-hover:scale-110 transition-transform" />
                  </div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-[0.2em] mb-2">Upcoming Milestone</h3>
                  <p className="text-sm text-slate-500 text-center max-w-xs leading-relaxed italic opacity-60">Compliance and Lifecycle reports are scheduled for Phase 2 implementation.</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Stats bar */}
        <footer className="h-10 bg-blue-600/5 border-t border-white/10 flex items-center justify-between px-8 text-[11px] text-slate-500">
          <div className="flex gap-8">
            <span className="uppercase tracking-wider">TOTAL ASSETS: <strong className="text-slate-300 font-mono tracking-normal ml-1">{totalAssets}</strong></span>
            <span className="uppercase tracking-wider">ORPHAN NODES: <strong className="text-slate-300 font-mono tracking-normal ml-1">3</strong></span>
            <span className="uppercase tracking-wider">SYSTEM STATUS: <strong className="text-emerald-500 ml-1">STABLE</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            <span className="uppercase tracking-widest font-mono opacity-60">api.eam.local:connected</span>
          </div>
        </footer>
      </main>

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        onUploadSuccess={fetchData} 
      />
    </div>
  );
}
