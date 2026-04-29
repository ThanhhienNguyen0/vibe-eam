import React, { useState } from 'react';
import { X, Plus, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { EAMAsset, ArchiMateLayer } from '@shared/index';

interface AddAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const LAYERS: ArchiMateLayer[] = ['Business', 'Application', 'Technology', 'Implementation'];

export function AddAssetModal({ isOpen, onClose, onSuccess }: AddAssetModalProps) {
  const [formData, setFormData] = useState<Partial<EAMAsset>>({
    id: '',
    name: '',
    type: 'Application',
    layer: 'Application',
    description: '',
    risk: 'Low',
    cost: 0,
    lifecycle: {
      startDate: new Date().toISOString().split('T')[0],
      status: 'Production'
    }
  });

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-[#0A0C16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-bold text-white tracking-tight uppercase tracking-[0.1em]">Create New Asset</h3>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">Manual lifecycle entry</p>
            </div>
            <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20} /></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Asset ID</label>
                <input 
                  required
                  value={formData.id}
                  onChange={e => setFormData({ ...formData, id: e.target.value })}
                  placeholder="e.g. APP-402"
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Layer</label>
                <select 
                  value={formData.layer}
                  onChange={e => setFormData({ ...formData, layer: e.target.value as ArchiMateLayer })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all appearance-none [&>option]:bg-[#0A0C16] [&>option]:text-white"
                >
                  {LAYERS.map(layer => <option key={layer} value={layer}>{layer}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Name</label>
              <input 
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Product Service API"
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Type</label>
                <input 
                  value={formData.type}
                  onChange={e => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Risk</label>
                <select 
                  value={formData.risk}
                  onChange={e => setFormData({ ...formData, risk: e.target.value as any })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all appearance-none [&>option]:bg-[#0A0C16] [&>option]:text-white"
                >
                  {['Low', 'Medium', 'High'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Cost (€)</label>
                <input 
                  type="number"
                  value={formData.cost}
                  onChange={e => setFormData({ ...formData, cost: Number(e.target.value) })}
                  className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Description</label>
              <textarea 
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full bg-white/[0.03] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500/50 outline-none transition-all resize-none"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[10px] text-red-500 uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            <div className="pt-4">
              <button 
                type="submit"
                disabled={isSaving}
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {isSaving ? "Synchronizing..." : (
                  <>
                    <Save size={16} />
                    Persist Asset
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
