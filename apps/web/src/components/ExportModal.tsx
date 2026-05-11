import React from 'react';
import { X, FileText, Download, Table } from 'lucide-react';
import * as XLSX from 'xlsx';
import { EAMAsset } from '@shared/index';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: EAMAsset[];
}

export function ExportModal({ isOpen, onClose, data }: ExportModalProps) {
  if (!isOpen) return null;

  const handleExport = (format: 'csv' | 'xlsx') => {
    const worksheet = XLSX.utils.json_to_sheet(data.map(asset => ({
      ID: asset.id,
      Name: asset.name,
      Type: asset.type,
      Layer: asset.layer,
      Description: asset.description || '',
      Criticality: asset.criticality,
      Risk: asset.risk || 'Low',
      Cost: asset.cost || 0,
      BusinessOwner: asset.businessOwner || '',
      ITOwner: asset.itOwner || '',
      BusinessCapability: asset.businessCapability || '',
      Process: asset.process || '',
      HostType: asset.hostType,
      Version: asset.version || '',
      Status: asset.lifecycle?.status || '',
      StartDate: asset.lifecycle?.startDate || '',
      EndOfSupport: asset.lifecycle?.endOfSupport || '',
      Relationships: asset.relationships?.map(r => `${r.targetId}(${r.type})`).join(',') || ''
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

    if (format === 'csv') {
      XLSX.writeFile(workbook, "EAM_Inventory_Export.csv", { bookType: 'csv' });
    } else {
      XLSX.writeFile(workbook, "EAM_Inventory_Export.xlsx", { bookType: 'xlsx' });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-[#0A0C16] border border-white/10 rounded-3xl shadow-2xl overflow-hidden p-8">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="mb-8">
          <h3 className="text-xl font-bold text-white tracking-tight uppercase tracking-[0.1em]">Export Hub</h3>
          <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">Select transport format for structural data</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <button 
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-blue-500/10 hover:border-blue-500/30 transition-all group"
          >
            <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform">
              <Table size={24} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white uppercase tracking-widest">Excel Workbook (.xlsx)</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Optimized for manual editing & reporting</div>
            </div>
            <Download size={16} className="ml-auto text-slate-600 group-hover:text-blue-500" />
          </button>

          <button 
            onClick={() => handleExport('csv')}
            className="flex items-center gap-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl hover:bg-emerald-500/10 hover:border-emerald-500/30 transition-all group"
          >
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500 group-hover:scale-110 transition-transform">
              <FileText size={24} />
            </div>
            <div className="text-left">
              <div className="text-sm font-bold text-white uppercase tracking-widest">Flat CSV File (.csv)</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-tighter">Standard swap format for automated sync</div>
            </div>
            <Download size={16} className="ml-auto text-slate-600 group-hover:text-emerald-500" />
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
           <div className="text-[9px] text-slate-600 font-mono uppercase tracking-widest">
              Security: AES-256 Transport
           </div>
           <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
              Ready for Download
           </div>
        </div>
      </div>
    </div>
  );
}
