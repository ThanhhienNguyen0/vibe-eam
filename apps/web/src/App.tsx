import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { InventoryTable } from './components/InventoryTable';
import { Visualization } from './components/Visualization';
import { UploadModal } from './components/UploadModal';
import { ExportModal } from './components/ExportModal';
import { AddAssetModal } from './components/AddAssetModal';
import { EAMData } from '@shared/index';
import { RefreshCw, Layers, Database, Server, Zap, Activity, TrendingUp, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [data, setData] = useState<EAMData>({ assets: [] } as any);
  const [activeTab, setActiveTab] = useState('inventory');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/inventory');
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
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

  const totalAssets = data?.assets?.length || 0;
  const businessAssets = data?.assets?.filter(a => a.layer === 'Business').length || 0;
  const applicationAssets = data?.assets?.filter(a => a.layer === 'Application').length || 0;
  const techAssets = data?.assets?.filter(a => a.layer === 'Technology' || a.layer === 'Implementation').length || 0;

  return (
    <div className="flex h-screen overflow-hidden font-sans bg-[#05060B] text-slate-200">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onUploadClick={() => setIsUploadOpen(true)} 
        onExportClick={() => setIsExportOpen(true)}
        onAddClick={() => setIsAddOpen(true)}
        isCollapsed={isSidebarCollapsed}
        setIsCollapsed={setIsSidebarCollapsed}
      />

      <main className={cn("flex-1 flex flex-col relative overflow-hidden transition-all duration-300")}>
        {/* Top Header */}
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-[#080A12]/60 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-slate-400">
              {activeTab === 'inventory' ? 'Structural Inventory' : 
               activeTab === 'graph' ? 'Relationship Matrix' : 'Strategy & Metrics'}
            </h2>
            <div className="h-4 w-px bg-white/10 mx-2" />
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 group cursor-help">
                <Activity size={14} className="text-amber-500 opacity-80" />
                <span className="text-[11px] font-mono text-slate-400 group-hover:text-amber-500 transition-colors">{businessAssets} BIZ</span>
              </div>
              <div className="flex items-center gap-2 group cursor-help">
                <Layers size={14} className="text-blue-500 opacity-80" />
                <span className="text-[11px] font-mono text-slate-400 group-hover:text-blue-500 transition-colors">{applicationAssets} APP</span>
              </div>
              <div className="flex items-center gap-2 group cursor-help">
                <Server size={14} className="text-emerald-500 opacity-80" />
                <span className="text-[11px] font-mono text-slate-400 group-hover:text-emerald-500 transition-colors">{techAssets} TECH</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end mr-4">
               <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest">Enterprise Mode</span>
               <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">Authorized</span>
            </div>
            <button 
              onClick={fetchData}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors text-slate-400 hover:text-white group"
            >
              <RefreshCw size={16} className={cn("transition-transform duration-700", isLoading ? 'animate-spin' : 'group-hover:rotate-180')} />
            </button>
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all cursor-pointer">
               <div className="w-4 h-4 rounded-sm bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"></div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <div className="flex-1 p-6 min-h-0 relative flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1 flex flex-col min-h-0"
            >
              {activeTab === 'inventory' && (
                <InventoryTable 
                  data={data} 
                  isLoading={isLoading} 
                  onAddClick={() => setIsAddOpen(true)} 
                  onAssetClick={(id) => setSelectedAssetId(id)}
                />
              )}
              {activeTab === 'graph' && (
                <Visualization 
                  data={data} 
                  onNodeClick={(id) => setSelectedAssetId(id)}
                />
              )}
              {activeTab === 'reports' && (
                <div className="flex-1 overflow-auto min-h-0 space-y-8 pr-2 custom-scrollbar">
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group hover:border-white/10 transition-colors">
                         <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <TrendingUp size={100} />
                         </div>
                         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Architectural Capital</h4>
                         <div className="text-3xl font-bold text-white tracking-tighter">
                            ${data?.assets?.reduce((sum, a) => sum + (a.cost || 0), 0).toLocaleString()}
                         </div>
                         <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase">
                            <span>Optimize efficiency +12%</span>
                         </div>
                      </div>
                      
                      <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-sm group hover:border-white/10 transition-colors">
                         <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-2">Security Exposure</h4>
                         <div className="text-3xl font-bold text-white tracking-tighter">
                            {data?.assets?.filter(a => a.risk === 'High').length || 0} Critical
                         </div>
                         <div className="mt-4 h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${((data?.assets?.filter(a => a.risk === 'High').length || 0) / (data?.assets?.length || 1)) * 100}%` }}
                              className="h-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]" 
                            />
                         </div>
                         <div className="mt-2 text-[10px] text-slate-600 font-mono font-bold uppercase tracking-widest">Risk Index Mapping Active</div>
                      </div>

                      <div className="bg-[#0A0C16] border border-white/10 rounded-3xl p-8 flex flex-col justify-between shadow-2xl">
                         <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Structural Composition</h4>
                         <div className="space-y-4">
                           {[
                             { label: 'Business Process', count: businessAssets, color: 'bg-amber-500' },
                             { label: 'Applications', count: applicationAssets, color: 'bg-blue-500' },
                             { label: 'Technology', count: techAssets, color: 'bg-emerald-500' }
                           ].map((stat) => (
                             <div key={stat.label} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                                <div className="flex items-center gap-3">
                                   <div className={cn("w-1.5 h-1.5 rounded-full", stat.color)}></div>
                                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                </div>
                                <span className="text-xs font-mono text-white font-bold">{stat.count}</span>
                             </div>
                           ))}
                         </div>
                      </div>
                   </div>

                   {/* Roadmap GANTT FA-07 */}
                   <div className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 backdrop-blur-sm border-l-4 border-l-blue-600">
                      <div className="flex items-center justify-between mb-8">
                         <div>
                            <h3 className="text-xl font-bold text-white tracking-tight">Lifecycle Roadmaps</h3>
                            <p className="text-xs text-slate-500 font-mono mt-1 uppercase tracking-tighter">GANTT Projection of Architectural Assets</p>
                         </div>
                         <div className="flex items-center gap-6 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Stable</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Growth</div>
                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-rose-500"></div> End of Life</div>
                         </div>
                      </div>

                      <div className="space-y-6">
                         {(data?.assets || []).map((asset, i) => (
                           <div key={asset.id} className="grid grid-cols-12 gap-6 items-center group">
                              <div className="col-span-3">
                                 <div className="text-[11px] font-bold text-white group-hover:text-blue-400 transition-colors uppercase truncate">{asset.name}</div>
                                 <div className="text-[9px] text-slate-600 font-mono uppercase font-bold tracking-tighter">{asset.id}</div>
                              </div>
                              <div className="col-span-9 h-10 bg-white/[0.01] rounded-lg border border-white/5 relative overflow-hidden shadow-inner">
                                 {/* Grid lines */}
                                 <div className="absolute left-[25%] top-0 bottom-0 w-px bg-white/5" />
                                 <div className="absolute left-[50%] top-0 bottom-0 w-px bg-white/5" />
                                 <div className="absolute left-[75%] top-0 bottom-0 w-px bg-white/5" />
                                 
                                 <motion.div 
                                    initial={{ width: 0, opacity: 0 }}
                                    animate={{ width: asset.risk === 'High' ? '40%' : '75%', opacity: 1 }}
                                    transition={{ duration: 1, delay: i * 0.1 }}
                                    className={cn(
                                       "absolute top-1.5 bottom-1.5 rounded shadow-lg flex items-center px-3",
                                       asset.layer === 'Business' ? "bg-amber-500/20 border border-amber-500/30" :
                                       asset.layer === 'Application' ? "bg-blue-500/20 border border-blue-500/30" :
                                       "bg-emerald-500/20 border border-emerald-500/30"
                                    )}
                                    style={{ left: `${(i % 3) * 10}%` }}
                                 >
                                    <div className="text-[8px] font-black uppercase text-white/40 tracking-widest">{asset.lifecycle?.status}</div>
                                 </motion.div>
                              </div>
                           </div>
                         ))}
                      </div>
                      
                      <div className="mt-8 flex justify-between text-[10px] font-black text-slate-700 px-2 border-t border-white/5 pt-4 uppercase tracking-[0.3em]">
                         <span>2024</span>
                         <span>2025</span>
                         <span>2026</span>
                         <span>2027</span>
                      </div>
                   </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer Stats bar */}
        <footer className="h-10 bg-blue-600/5 border-t border-white/10 flex items-center justify-between px-8 text-[10px] text-slate-600 font-bold">
          <div className="flex gap-8">
            <span className="uppercase tracking-[0.2em]">STRUCTURED OBJECTS: <strong className="text-slate-400 font-mono ml-1">{totalAssets}</strong></span>
            <span className="uppercase tracking-[0.2em]">INTEGRITY: <strong className="text-emerald-500 ml-1">98.2%</strong></span>
            <span className="uppercase tracking-[0.2em]">GATEWAY: <strong className="text-blue-500 ml-1">PRIMARY-SYNC</strong></span>
          </div>
          <div className="flex items-center gap-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
             <span className="uppercase tracking-widest font-mono opacity-60">Architect:V1.0.4 - ACTIVE</span>
          </div>
        </footer>
      </main>

      <UploadModal 
        isOpen={isUploadOpen} 
        onClose={() => setIsUploadOpen(false)} 
        onUploadSuccess={fetchData} 
      />

      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        data={data.assets}
      />

      <AddAssetModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSuccess={fetchData}
      />

      <AnimatePresence>
        {selectedAssetId && (
          <motion.div
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            className="fixed top-0 right-0 w-96 h-screen bg-[#080A12] border-l border-white/10 z-[110] shadow-2xl flex flex-col"
          >
            {(() => {
              const asset = data.assets.find(a => a.id === selectedAssetId);
              if (!asset) return null;
              return (
                <div className="flex flex-col h-full">
                  <div className="p-8 border-b border-white/5 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[.2em] text-blue-500 mb-1">{asset.layer} Layer</div>
                      <h3 className="text-xl font-bold text-white uppercase tracking-tight">{asset.name}</h3>
                    </div>
                    <button 
                      onClick={() => setSelectedAssetId(null)}
                      className="p-2 hover:bg-white/5 rounded-full transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <div className="flex-1 p-8 space-y-8 overflow-auto custom-scrollbar">
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">System Identity</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                          <div className="text-[9px] font-bold text-slate-600 uppercase mb-1">ID</div>
                          <div className="text-xs font-mono text-white">{asset.id}</div>
                        </div>
                        <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                          <div className="text-[9px] font-bold text-slate-600 uppercase mb-1">Type</div>
                          <div className="text-xs font-mono text-white">{asset.type}</div>
                        </div>
                      </div>
                    </section>
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Operational Meta</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                          <div className="text-[9px] font-bold text-emerald-500/60 uppercase mb-1">Status</div>
                          <div className="text-xs font-bold text-emerald-500">{asset.lifecycle?.status || 'UNKNOWN'}</div>
                        </div>
                        <div className="p-4 bg-amber-500/5 border border-amber-500/10 rounded-2xl">
                          <div className="text-[9px] font-bold text-amber-500/60 uppercase mb-1">Risk Profile</div>
                          <div className="text-xs font-bold text-amber-500">{asset.risk}</div>
                        </div>
                      </div>
                    </section>
                    <section>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Description</h4>
                      <p className="text-sm text-slate-400 leading-relaxed font-medium">{asset.description || 'No blueprint description provided for this architectural node.'}</p>
                    </section>
                    {asset.dependencies && asset.dependencies.length > 0 && (
                      <section>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-3">Upstream Dependencies</h4>
                        <div className="space-y-2">
                          {asset.dependencies.map(dep => (
                            <div key={dep} className="px-4 py-3 bg-white/[0.02] border border-white/5 rounded-xl text-xs font-mono text-slate-400 flex items-center justify-between hover:border-white/20 transition-all cursor-pointer">
                              {dep}
                              <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse"></div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                  <div className="p-8 border-t border-white/5 bg-white/[0.01]">
                    <button className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-[.3em] hover:bg-white/10 transition-all">
                      Open in Archimate Editor
                    </button>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
