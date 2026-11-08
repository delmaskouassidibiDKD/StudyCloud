import React, { useState, useEffect } from 'react';
import { FileText, FileSpreadsheet, Presentation, FileCode, AlignLeft } from 'lucide-react';
import { FileItem } from './Page1FilesMenuView';
import { getWorkerApiUrl } from '../services/api';

interface DocumentCardPreviewProps {
  doc: FileItem;
}

function isImageThumbnailUrl(url?: string | null): boolean {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;
  if (url.includes('/api/cloud/thumbnail/') || url.includes('/api/storage/thumbnail/') || url.includes('/thumbnails/') || url.includes('media_thumbnails') || url.includes('/thumbnail?')) return true;
  const path = url.split('?')[0].split('#')[0].toLowerCase();
  return /\.(jpe?g|png|webp|gif|svg|avif)$/i.test(path);
}

export const DocumentCardPreview: React.FC<DocumentCardPreviewProps> = ({ doc }) => {
  const resolveThumb = () => {
    if (isImageThumbnailUrl(doc.thumbnailUrl)) return doc.thumbnailUrl!;
    if (isImageThumbnailUrl(doc.previewUrl)) return doc.previewUrl!;
    if (doc.id) {
      const baseUrl = getWorkerApiUrl().replace(/\/+$/, '');
      const uid = (doc as any).userId || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || 'default-user';
      return `${baseUrl}/api/cloud/thumbnail/${encodeURIComponent(doc.id)}?userId=${encodeURIComponent(uid)}`;
    }
    return null;
  };

  const [thumbUrl, setThumbUrl] = useState<string | null>(resolveThumb);

  useEffect(() => {
    setThumbUrl(resolveThumb());
  }, [doc.id, doc.previewUrl, doc.thumbnailUrl]);

  const ext = (doc.extension || (doc.name.includes('.') ? doc.name.split('.').pop() || 'PDF' : 'PDF')).toLowerCase();
  const isPdf = ext === 'pdf' || (doc.type && doc.type.includes('pdf'));
  const isExcel = ['xls', 'xlsx', 'csv'].includes(ext);
  const isPpt = ['ppt', 'pptx'].includes(ext);
  const isCode = ['js', 'ts', 'py', 'html', 'css', 'json', 'sql', 'cpp', 'java'].includes(ext);

  // Si on a une miniature réelle (générée ou image R2)
  if (thumbUrl) {
    return (
      <div className="w-full h-full relative overflow-hidden rounded-md bg-stone-100 flex items-center justify-center pointer-events-none">
        <img
          src={thumbUrl}
          alt={doc.name}
          className="w-full h-full object-cover object-top select-none"
          loading="lazy"
          onError={() => setThumbUrl(null)}
        />
        {/* Légère ombre et badge extension discret en bas */}
        <div className="absolute inset-x-0 bottom-0 py-0.5 px-1 bg-black/60 backdrop-blur-xs flex items-center justify-between text-[7px] text-white font-bold">
          <span className="truncate max-w-[80%]">{doc.name}</span>
          <span className="uppercase text-[6.5px] bg-white/20 px-1 rounded">{ext}</span>
        </div>
      </div>
    );
  }

  // Fallback dynamique et réaliste adapté aux métadonnées réelles du fichier
  const cleanTitle = doc.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
  const categoryLabel = doc.documentCategory || (ext === 'pdf' ? 'DOCUMENT PDF' : ext.toUpperCase());

  return (
    <div className="w-full h-full flex flex-col justify-between bg-white text-stone-800 p-2 select-none overflow-hidden rounded-md border border-stone-200/80 shadow-xs pointer-events-none">
      {/* En-tête : catégorie et badge StudyCloud */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-1 shrink-0">
        <div className="flex items-center gap-1 min-w-0">
          {isExcel ? (
            <FileSpreadsheet className="w-3 h-3 text-emerald-600 shrink-0" />
          ) : isPpt ? (
            <Presentation className="w-3 h-3 text-orange-600 shrink-0" />
          ) : isCode ? (
            <FileCode className="w-3 h-3 text-purple-600 shrink-0" />
          ) : (
            <FileText className="w-3 h-3 text-blue-600 shrink-0" />
          )}
          <span className="text-[7px] font-black uppercase tracking-tight text-stone-700 truncate">
            {categoryLabel}
          </span>
        </div>
        <span className="text-[6.5px] font-black bg-stone-900 text-white px-1 py-0.2 rounded shrink-0">
          StudyCloud
        </span>
      </div>

      {/* Titre réel du document au milieu */}
      <div className="my-1 shrink-0">
        <p className="text-[7.5px] sm:text-[8px] font-black text-stone-900 leading-tight uppercase line-clamp-2" title={cleanTitle}>
          {cleanTitle}
        </p>
      </div>

      {/* Rendu visuel dynamique selon le type */}
      <div className="flex-1 w-full bg-stone-50 rounded border border-stone-200/70 p-1.5 flex flex-col justify-center overflow-hidden my-0.5">
        {isExcel ? (
          // Simulation grille Excel
          <div className="space-y-1 w-full opacity-70">
            <div className="grid grid-cols-3 gap-1 border-b border-stone-300 pb-0.5">
              <div className="h-1.5 bg-emerald-200 rounded-xs" />
              <div className="h-1.5 bg-stone-300 rounded-xs" />
              <div className="h-1.5 bg-stone-300 rounded-xs" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1 bg-stone-200 rounded-xs" />
              <div className="h-1 bg-stone-200 rounded-xs" />
              <div className="h-1 bg-stone-200 rounded-xs" />
            </div>
            <div className="grid grid-cols-3 gap-1">
              <div className="h-1 bg-stone-200 rounded-xs" />
              <div className="h-1 bg-stone-200 rounded-xs" />
              <div className="h-1 bg-stone-200 rounded-xs" />
            </div>
          </div>
        ) : isPpt ? (
          // Simulation slide PowerPoint
          <div className="w-full h-full flex flex-col justify-center items-center p-1 bg-amber-50/50 rounded">
            <div className="w-4/5 h-2 bg-orange-400/80 rounded-xs mb-1" />
            <div className="w-3/5 h-1.5 bg-stone-300 rounded-xs" />
          </div>
        ) : (
          // Simulation texte document standard
          <div className="space-y-1 w-full opacity-75">
            <div className="h-1 bg-stone-700 rounded-full w-4/5" />
            <div className="h-1 bg-stone-400 rounded-full w-full" />
            <div className="h-1 bg-stone-400 rounded-full w-5/6" />
            <div className="h-1 bg-stone-400 rounded-full w-3/4" />
          </div>
        )}
      </div>

      {/* Pied de document : lignes et filigrane de page */}
      <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[6.5px] text-stone-500 font-semibold shrink-0">
        <span>{doc.size || 'Document'}</span>
        <span className="uppercase">{ext}</span>
      </div>
    </div>
  );
};
