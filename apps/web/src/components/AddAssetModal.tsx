import React, { useState, useMemo } from 'react';
import { X, Plus, Save, Search, User, Briefcase, Cpu, Link2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EAMAsset, ArchiMateLayer, RelationshipType, Criticality, HostType, EAMRelationship } from '@shared/index';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  allAssets: EAMAsset[];
}

const LAYERS: ArchiMateLayer[] = ['Business', 'Application', 'Technology', 'Implementation'];
const REL_TYPES: RelationshipType[] = ['Serving/Usage', 'Composition', 'Flow', 'Realization', 'Influence'];
const CRITICALITIES: Criticality[] = ['Low', 'Medium', 'High', 'Mission Critical'];
const HOST_TYPES: HostType[] = ['SaaS', 'On-Premise', 'Cloud/PaaS'];
const STATUSES = ['Planning', 'Active', 'Retired'] as const;

export function AddAssetModal({ isOpen, onClose, onSuccess, allAssets }: AddAssetModalProps) {
  const [formData, setFormData] = useState<Partial<EAMAsset>>({
    id: '',
    name: '',
    type: '',
    layer: 'Application',
    description: '',
    risk: 'Low',
    cost: 0,
    criticality: 'Medium',
    hostType: 'On-Premise',
    relationships: [],
    lifecycle: {
      startDate: new Date().toISOString().split('T')[0],
      status: 'Active'
    }
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredAssets = useMemo(() => {
    if (!searchTerm) return [];
    return allAssets
      .filter(a => 
        a.id !== formData.id && 
        (a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
         a.id.toLowerCase().includes(searchTerm.toLowerCase())) &&
        !formData.relationships?.some(rel => rel.targetId === a.id)
      )
      .slice(0, 5);
  }, [searchTerm, allAssets, formData.id, formData.relationships]);

  if (!isOpen) return null;

  const addRelationship = (targetId: string, type: RelationshipType) => {
    setFormData(prev => ({
      ...prev,
      relationships: [
        ...(prev.relationships || []),
        { targetId, type }
      ]
    }));
    setSearchTerm('');
  };

  const removeRelationship = (targetId: string) => {
    setFormData(prev => ({
      ...prev,
      relationships: prev.relationships?.filter(r => r.targetId !== targetId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (!response.ok) throw new Error('Failed to save asset');
      
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const SectionLabel = ({ icon: Icon, label, color = "text-blue-500" }: { icon: any, label: string, color?: string }) => (
    <div className={`flex items-center gap-2 mb-4 pt-4 border-t border-white/5 first:border-t-0 first:pt-0`}>
      <Icon size={14} className={color} />
      <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${color}`}>{label}</span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-2xl bg-[#0A0C16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight uppercase tracking-[0.1em]">Architectural Node Constructor</h3>
            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-mono font-bold">Standard EAM Registry v2.0</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {/* Section 1: Header */}
          <section>
            <SectionLabel icon={Cpu} label="1. Header & Identity" />
            <div className="grid grid-cols-6 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset ID</label>
                <input 
                  required
                  value={formData.id}
                  onChange={e => setFormData({ ...formData, id: e.target.value })}
                  placeholder="APP-100"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all font-mono"
                />
              </div>
              <div className="col-span-4 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset Name</label>
                <input 
                  required
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Customer Engagement API"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all font-medium"
                />
              </div>
              <div className="col-span-3 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Status</label>
                <select 
                  value={formData.lifecycle?.status}
                  onChange={e => setFormData({ ...formData, lifecycle: { ...formData.lifecycle!, status: e.target.value as any } })}
                  className="w-full bg-[#0F111A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none appearance-none cursor-pointer"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-3 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Deployment Layer</label>
                <select 
                  value={formData.layer}
                  onChange={e => setFormData({ ...formData, layer: e.target.value as ArchiMateLayer })}
                  className="w-full bg-[#0F111A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none appearance-none cursor-pointer"
                >
                  {LAYERS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Section 2: Ownership */}
          <section>
            <SectionLabel icon={User} label="2. Governance & Ownership" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Business Owner</label>
                <input 
                  value={formData.businessOwner}
                  onChange={e => setFormData({ ...formData, businessOwner: e.target.value })}
                  placeholder="e.g. Maria Schmidt (Sales)"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">IT Owner</label>
                <input 
                  value={formData.itOwner}
                  onChange={e => setFormData({ ...formData, itOwner: e.target.value })}
                  placeholder="e.g. Tech Lead DevOps"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
            </div>
          </section>

          {/* Section 3: Business Context */}
          <section>
            <SectionLabel icon={Briefcase} label="3. Business Context" />
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Business Capability</label>
                <input 
                  value={formData.businessCapability}
                  onChange={e => setFormData({ ...formData, businessCapability: e.target.value })}
                  placeholder="Order Fulfillment"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Criticality</label>
                <select 
                  value={formData.criticality}
                  onChange={e => setFormData({ ...formData, criticality: e.target.value as Criticality })}
                  className="w-full bg-[#0F111A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none appearance-none cursor-pointer"
                >
                  {CRITICALITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
          </section>

          {/* Section 4: Technical Stack */}
          <section>
            <SectionLabel icon={Cpu} label="4. Technical Stack" />
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Host Type</label>
                <select 
                  value={formData.hostType}
                  onChange={e => setFormData({ ...formData, hostType: e.target.value as HostType })}
                  className="w-full bg-[#0F111A] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none appearance-none cursor-pointer"
                >
                  {HOST_TYPES.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Software Stack</label>
                <input 
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  placeholder="e.g. Node.js / PostgreSQL"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Version</label>
                <input 
                  value={formData.version}
                  onChange={e => setFormData({ ...formData, version: e.target.value })}
                  placeholder="v2.1.0"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
            </div>
          </section>

          {/* Section 5: Dependencies */}
          <section>
            <SectionLabel icon={Link2} label="5. Intelligent Dependencies" />
            <div className="space-y-4">
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={14} /></div>
                <input 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search existing assets to link..."
                  className="w-full bg-white/[0.01] border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-blue-500/30 outline-none transition-all"
                />
              </div>

              {filteredAssets.length > 0 && (
                <div className="bg-[#0F111A] border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
                  {filteredAssets.map(asset => (
                    <div key={asset.id} className="p-3 flex items-center justify-between hover:bg-white/[0.02] group">
                      <div>
                        <div className="text-[10px] font-bold text-white leading-none">{asset.name}</div>
                        <div className="text-[8px] font-mono text-slate-500 mt-1 uppercase">{asset.id} | {asset.layer}</div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {REL_TYPES.map(type => (
                          <button 
                            key={type}
                            type="button"
                            onClick={() => addRelationship(asset.id, type)}
                            className="px-2 py-1 bg-blue-600/10 border border-blue-500/20 rounded-md text-[8px] font-bold text-blue-400 hover:bg-blue-600 hover:text-white transition-all"
                            title={type}
                          >
                            {type.split('/')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                {formData.relationships?.map(rel => (
                  <div key={rel.targetId} className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/5 rounded-xl group">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase text-blue-500 mb-0.5 tracking-tighter">{rel.type}</span>
                      <span className="text-[10px] font-bold text-white leading-none">{rel.targetId}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => removeRelationship(rel.targetId)}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Section 6: Lifecycle */}
          <section>
            <SectionLabel icon={Calendar} label="6. Lifecycle Timeline" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Go-Live Date</label>
                <input 
                  type="date"
                  value={formData.lifecycle?.startDate}
                  onChange={e => setFormData({ ...formData, lifecycle: { ...formData.lifecycle!, startDate: e.target.value } })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">End of Support</label>
                <input 
                  type="date"
                  value={formData.lifecycle?.endOfSupport}
                  onChange={e => setFormData({ ...formData, lifecycle: { ...formData.lifecycle!, endOfSupport: e.target.value } })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none"
                />
              </div>
            </div>
          </section>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-500 uppercase tracking-widest text-center animate-pulse">
              {error}
            </div>
          )}
        </form>

        <div className="p-6 border-t border-white/10 bg-white/[0.01]">
          <button 
            onClick={handleSubmit}
            disabled={isSaving}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {isSaving ? "Synchronizing Repository..." : (
              <>
                <Save size={16} />
                Persist Architectural Node
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
