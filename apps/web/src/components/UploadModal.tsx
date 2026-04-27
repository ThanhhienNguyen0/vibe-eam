import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function UploadModal({ isOpen, onClose, onUploadSuccess }: UploadModalProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Upload failed');
      }

      setSuccess(true);
      onUploadSuccess();
      setTimeout(onClose, 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  }, [onClose, onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    multiple: false
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-md glass border-slate-700 rounded-2xl shadow-2xl relative overflow-hidden"
      >
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Upload size={20} className="text-blue-400" />
            Sync Asset Inventory
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div 
            {...getRootProps()} 
            className={`
              border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer
              ${isDragActive ? "border-blue-500 bg-blue-500/10" : "border-slate-700 hover:border-slate-500 hover:bg-slate-800/20"}
              ${isUploading ? "pointer-events-none opacity-50" : ""}
            `}
          >
            <input {...getInputProps()} />
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
              <FileText className={isDragActive ? "text-blue-400" : "text-slate-400"} size={32} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">Click or drag CSV file to sync</p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-widest font-mono">Format: ID, Name, Type, Description, ...</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 min-h-[40px]">
            {isUploading && (
              <div className="flex items-center gap-3 text-sm text-blue-400 animate-pulse">
                <Upload size={16} className="animate-spin" />
                Processing CSV records...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-3 text-sm text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-3 text-sm text-emerald-400 bg-emerald-400/10 p-3 rounded-lg border border-emerald-400/20">
                <CheckCircle2 size={16} />
                Inventory successfully updated.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 bg-slate-900/50 flex justify-end">
          <button 
            disabled={isUploading}
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium hover:text-white transition-colors"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </div>
  );
}
