import React from 'react';
import { FileText, ExternalLink, Download } from 'lucide-react';

interface PdfRendererProps {
  data: {
    url?: string;
    pdfUrl?: string;
    title?: string;
  };
  title?: string;
}

export function PdfRenderer({ data, title }: PdfRendererProps) {
  const pdfUrl = data.url || data.pdfUrl || '';

  return (
    <div className="w-full h-full flex flex-col p-4 sm:p-6 text-zinc-100 overflow-hidden">
      <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-700/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-red-400 shrink-0" />
          <h3 className="text-sm font-bold text-zinc-200 truncate">
            {title || 'Document PDF'}
          </h3>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold transition-all border border-zinc-700"
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ouvrir</span>
          </a>
          <a
            href={pdfUrl}
            download
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-sm"
            title="Télécharger le PDF"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Télécharger</span>
          </a>
        </div>
      </div>

      <div className="flex-1 w-full bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 shadow-xl">
        <iframe
          src={`${pdfUrl}#toolbar=1&navpanes=0`}
          className="w-full h-full border-0 rounded-2xl"
          title={title || 'Aperçu PDF'}
        />
      </div>
    </div>
  );
}
export default PdfRenderer;
