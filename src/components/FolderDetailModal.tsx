import React from 'react';
import { X, FileText, Download } from 'lucide-react';
import { SharedFolder } from '../types';
import { FileIconBadge } from './FileIconBadge';

interface FolderDetailModalProps {
  folder: SharedFolder;
  onClose: () => void;
  onOpenQR: (folder: SharedFolder) => void;
  setActivePreviewItem?: (item: any) => void;
}

export const FolderDetailModal: React.FC<FolderDetailModalProps> = ({ folder, onClose, setActivePreviewItem }) => {
  const handleDownloadSingle = (file: { name: string; url?: string; size: number }, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const content = file.url || `Ceci est le fichier ${file.name} téléchargé depuis UniFolder Share.\nDossier: ${folder.title}`;
    const blob = file.url && file.url.startsWith('data:') 
      ? fetch(file.url).then(r => r.blob()).catch(() => new Blob([content], { type: 'text/plain;charset=utf-8' }))
      : Promise.resolve(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    
    blob.then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-fadeIn">
      <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl shadow-[8px_8px_0px_0px_#1c1917] max-w-4xl w-full p-4 sm:p-6 relative flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 border-b-2 border-stone-800 mb-4 sm:mb-5 shrink-0">
          <div>
            <h3 className="text-base sm:text-lg font-extrabold text-stone-900">
              {folder.title} ({folder.files.length} fichiers)
            </h3>
            <p className="text-xs text-stone-600 font-medium">
              {folder.description || 'Dossier partagé'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-white hover:bg-stone-100 text-stone-800 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
            title="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Compact Grid with reduced element sizes */}
        <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {folder.files.map((file) => {
            const isPdf = file.name.toLowerCase().endsWith('.pdf');
            const fileExt = file.name.split('.').pop() || 'FILE';
            return (
              <div
                key={file.id}
                onClick={() => {
                  if (setActivePreviewItem) {
                    setActivePreviewItem(file);
                  }
                }}
                className="bg-[#2A2B2E] border-2 border-stone-800 rounded-xl p-2 flex flex-col justify-between shadow-sm hover:shadow-md transition-all relative group cursor-pointer select-none"
              >
                <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden rounded-lg bg-[#1E1F22] relative mb-1.5 aspect-square">
                  {file.isImage && file.url ? (
                    <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-stone-300">
                      <FileIconBadge fileName={file.name} size={36} />
                    </div>
                  )}

                  {/* Download button top-left */}
                  <button
                    onClick={(e) => handleDownloadSingle(file, e)}
                    className="absolute top-1 left-1 w-5 h-5 bg-black/70 hover:bg-black text-orange-400 rounded-full flex items-center justify-center shadow transition-colors cursor-pointer z-10"
                    title="Télécharger"
                  >
                    <Download className="w-2.5 h-2.5" />
                  </button>
                </div>

                <div>
                  <p className="text-[10px] font-semibold text-stone-100 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[8px] text-stone-400 font-mono">
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
