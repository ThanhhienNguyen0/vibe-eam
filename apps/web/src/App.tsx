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
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const json = await response.json();
      if (json && json.applications) {
        setData(json);
      } else {
        throw new Error("Invalid data format received");
      }
    } catch (error) {
      console.error('Error fetching inventory:', error);
      // Keep existing data or handle error state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalAssets = (data?.applications?.length || 0) + (data?.servers?.length || 0) + (data?.databases?.length || 0);

  return (
    <div className="flex h-screen overflow-hidden font-sans">
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
              {activeTab === 'inventory' ? 'Architecture Inventory' : 
               activeTab === 'graph' ? 'Dependency Mapping' : 'System Reports'}
            </h2>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 border border-white/10 uppercase font-mono tracking-tight">v1.0.0</span>
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
                <div className="h-full overflow-auto">
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="col-span-1 lg:col-span-2 bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Governance & Compliance</h3>
                            <p className="text-xs text-slate-500 font-mono mt-1">Architecture integrity metrics</p>
                          </div>
                          <div className="px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold uppercase tracking-widest">Active</div>
                        </div>
                        <div className="space-y-6">
                          {[
                            { label: 'Cloud Architecture Integrity', value: 94 },
                            { label: 'Security Policy Alignment', value: 87 },
                            { label: 'Resource Utilization Efficiency', value: 62 },
                            { label: 'Backup & Recovery Readiness', value: 100 }
                          ].map((item) => (
                            <div key={item.label}>
                              <div className="flex justify-between items-center mb-2">
                                <span className="text-xs font-semibold text-slate-400 uppercase tracking-tight">{item.label}</span>
                                <span className="text-xs font-mono text-slate-100">{item.value}%</span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${item.value}%` }}
                                  className={cn(
                                    "h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] transition-all duration-1000",
                                    item.value > 80 ? "bg-blue-500" : item.value > 60 ? "bg-amber-500" : "bg-red-500"
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex flex-col justify-between">
                         <div>
                            <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-6">Inventory Matrix</h4>
                            <div className="space-y-4">
                              {[
                                { label: 'Applications', count: data?.applications?.length || 0, color: 'bg-blue-500' },
                                { label: 'Servers', count: data?.servers?.length || 0, color: 'bg-emerald-500' },
                                { label: 'Databases', count: data?.databases?.length || 0, color: 'bg-purple-500' }
                              ].map((stat) => (
                                <div key={stat.label} className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                                   <div className="flex items-center gap-3">
                                      <div className={cn("w-2 h-2 rounded-full", stat.color)}></div>
                                      <span className="text-xs font-medium text-slate-300">{stat.label}</span>
                                   </div>
                                   <span className="text-xs font-mono text-white">{stat.count}</span>
                                </div>
                              ))}
                            </div>
                         </div>
                         <button className="w-full mt-8 py-3 bg-white/10 hover:bg-white/20 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all">
                           Generate Audit PDF
                         </button>
                      </div>
                   </div>
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
            <span className="uppercase tracking-widest font-mono opacity-60">System:Connected</span>
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
