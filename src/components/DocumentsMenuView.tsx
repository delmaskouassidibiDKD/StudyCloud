import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  FileText,
  Search,
  Plus,
  Star,
  Share2,
  Download,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  X,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Check
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { UploadQueue } from '../services/uploadQueue';
import { DocumentCardPreview } from './DocumentCardPreview';
import { ModernDocumentViewer } from './ModernDocumentViewer';
import { PdfHorizontalViewer } from './PdfHorizontalViewer';

interface DocumentsMenuViewProps {
  onBack: () => void;
  onOpenStudySpace?: (file?: any, folderName?: string, folderFiles?: any[]) => void;
  onOpenCreateShareLink?: (items: any[]) => void;
}

export const DocumentsMenuView: React.FC<DocumentsMenuViewProps> = ({
  onBack,
  onOpenStudySpace,
  onOpenCreateShareLink
}) => {
  const [documentsList, setDocumentsList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().documents || [];
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'pdf' | 'cours' | 'td' | 'devoirs' | 'txt'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Lecteur de document actif (split à droite)
  const [selectedDoc, setSelectedDoc] = useState<FileItem | null>(null);
  const [splitResolvedPdfUrl, setSplitResolvedPdfUrl] = useState<string>('');
  const [docLayoutMode, setDocLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [docCurrentPage, setDocCurrentPage] = useState(1);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [viewerRotation, setViewerRotation] = useState(0);
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // Menu déroulant par document
  const [menuDocId, setMenuDocId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement et synchronisation avec CloudDataStore
  useEffect(() => {
    let isMounted = true;
    CloudStorageAPI.getDocumentsList()
      .then((data) => {
        if (isMounted && data && Array.isArray(data)) {
          setDocumentsList(data);
          CloudDataStore.setDocuments(data as any);
        }
      })
      .catch((err) => console.warn('[DocumentsMenuView] Error fetching documents:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    const unsubscribe = CloudDataStore.subscribe((state) => {
      if (isMounted) {
        setDocumentsList(state.documents || []);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Résolution du Blob URL quand un document est sélectionné
  useEffect(() => {
    if (!selectedDoc) {
      setSplitResolvedPdfUrl('');
      return;
    }

    let isMounted = true;
    const isPdf =
      selectedDoc.extension === 'pdf' ||
      selectedDoc.name.toLowerCase().endsWith('.pdf') ||
      (selectedDoc.url && selectedDoc.url.toLowerCase().includes('.pdf')) ||
      Boolean(selectedDoc.type?.includes('pdf'));

    if (isPdf && selectedDoc.id) {
      getFileBlobUrl(selectedDoc.id)
        .then((blobUrl) => {
          if (isMounted && blobUrl) {
            setSplitResolvedPdfUrl(blobUrl);
          }
        })
        .catch(() => {});
    }

    return () => {
      isMounted = false;
    };
  }, [selectedDoc?.id]);

  // Navigation entre documents
  const handleNavigateDoc = (direction: 'prev' | 'next') => {
    if (filteredDocuments.length === 0) return;
    const currentIndex = selectedDoc
      ? filteredDocuments.findIndex(d => d.id === selectedDoc.id)
      : 0;
    let newIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (newIndex < 0) newIndex = filteredDocuments.length - 1;
    if (newIndex >= filteredDocuments.length) newIndex = 0;
    const nextDoc = filteredDocuments[newIndex];
    if (nextDoc) {
      setSelectedDoc(nextDoc);
      setViewerZoom(1);
      setViewerRotation(0);
      setDocCurrentPage(1);
    }
  };

  // Import de documents
  const handleImportDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files = Array.from(e.target.files) as File[];

    showToast(`Préparation de ${files.length} document(s)...`);

    const newItemsWithFiles = await Promise.all(
      files.map(async (f, idx) => {
        const ext = f.name.includes('.') ? f.name.split('.').pop()?.toLowerCase() || 'pdf' : 'pdf';
        const comp = await compressFile(f, 'documents');
        const fileId = `doc-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
        const localBlobUrl = URL.createObjectURL(comp.file);

        await storeFileBlob(fileId, comp.file as any).catch(() => {});

        let docCat: FileItem['documentCategory'] = "PAS D'INF...";
        const lowerName = f.name.toLowerCase();
        if (lowerName.includes('cours') || lowerName.includes('chapitre') || lowerName.includes('leçon')) {
          docCat = 'COURS';
        } else if (lowerName.includes('td') || lowerName.includes('travaux')) {
          docCat = 'TD';
        } else if (lowerName.includes('devoir') || lowerName.includes('examen') || lowerName.includes('ds') || lowerName.includes('test')) {
          docCat = 'DEVOIRS';
        }

        const item: FileItem = {
          id: fileId,
          name: f.name,
          category: 'documents',
          source: 'Documents',
          documentCategory: docCat,
          size: comp.originalSizeFormatted,
          sizeBytes: comp.originalSizeBytes,
          date: new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }),
          extension: ext.toUpperCase(),
          url: localBlobUrl,
          previewUrl: localBlobUrl
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setDocumentsList(prev => [...newItems, ...prev]);
    CloudDataStore.setDocuments([...newItems, ...documentsList] as any);

    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'documents' });
    showToast(`${newItems.length} document(s) importé(s) !`);

    if (newItems.length > 0 && !selectedDoc) {
      setSelectedDoc(newItems[0]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Favoris
  const handleToggleFavorite = async (doc: FileItem) => {
    const nextState = !doc.isFavorite;
    setDocumentsList(prev =>
      prev.map(d => (d.id === doc.id ? { ...d, isFavorite: nextState } : d))
    );
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(prev => (prev ? { ...prev, isFavorite: nextState } : null));
    }
    CloudDataStore.updateFile(doc.id, { isFavorite: nextState });
    if (nextState) {
      await CloudStorageAPI.addFavorite(doc.id, 'documents').catch(() => {});
    } else {
      await CloudStorageAPI.removeFavorite(doc.id).catch(() => {});
    }
    showToast(nextState ? 'Ajouté aux favoris ⭐' : 'Retiré des favoris');
    setMenuDocId(null);
  };

  // Renommer
  const handleRenameDocument = async (doc: FileItem) => {
    const newName = window.prompt('Nouveau nom du document :', doc.name);
    if (!newName || !newName.trim() || newName.trim() === doc.name) return;

    const trimmed = newName.trim();
    const finalName = trimmed.includes('.') ? trimmed : `${trimmed}.${(doc.extension || 'pdf').toLowerCase()}`;

    setDocumentsList(prev =>
      prev.map(d => (d.id === doc.id ? { ...d, name: finalName } : d))
    );
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(prev => (prev ? { ...prev, name: finalName } : null));
    }
    CloudDataStore.updateFile(doc.id, { name: finalName });
    showToast(`Document renommé en "${finalName}"`);
    setMenuDocId(null);
  };

  // Suppression
  const handleDeleteDocument = async (doc: FileItem) => {
    if (!window.confirm(`Supprimer définitivement "${doc.name}" ?`)) return;

    setDocumentsList(prev => prev.filter(d => d.id !== doc.id));
    if (selectedDoc?.id === doc.id) {
      setSelectedDoc(null);
    }
    CloudDataStore.removeFile(doc.id);
    deleteFileBlob(doc.id).catch(() => {});
    await CloudStorageAPI.deleteDocument(doc.id).catch(() => {});
    showToast(`"${doc.name}" supprimé`);
    setMenuDocId(null);
  };

  // Téléchargement
  const handleDownload = async (doc: FileItem) => {
    let url = doc.previewUrl || doc.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(doc.id);
    }
    if (!url) {
      showToast('Fichier introuvable');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast(`Téléchargement de "${doc.name}"`);
  };

  // Partager
  const handleShare = (doc: FileItem) => {
    if (onOpenCreateShareLink) {
      onOpenCreateShareLink([doc]);
    } else {
      showToast('Partage StudyCloud');
    }
  };

  // Filtrage
  const filteredDocuments = useMemo(() => {
    let list = documentsList;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }
    if (activeFilter === 'pdf') {
      list = list.filter(d => (d.extension || '').toLowerCase() === 'pdf');
    } else if (activeFilter === 'cours') {
      list = list.filter(d => d.documentCategory === 'COURS');
    } else if (activeFilter === 'td') {
      list = list.filter(d => d.documentCategory === 'TD');
    } else if (activeFilter === 'devoirs') {
      list = list.filter(d => d.documentCategory === 'DEVOIRS');
    } else if (activeFilter === 'txt') {
      list = list.filter(d => ['txt', 'md'].includes((d.extension || '').toLowerCase()));
    }
    return list;
  }, [documentsList, searchQuery, activeFilter]);

  // Rendu du lecteur de document dédié (Image 3)
  const renderDocumentReader = (file: FileItem) => {
    const isPdf =
      file.extension === 'pdf' ||
      file.name.toLowerCase().endsWith('.pdf') ||
      (file.url && file.url.toLowerCase().includes('.pdf')) ||
      Boolean(file.type?.includes('pdf'));
    const pdfUrl = splitResolvedPdfUrl || file.url || '';
    const cleanPdfBase = pdfUrl.split('#')[0];
    const nativePdfUrl = cleanPdfBase ? cleanPdfBase + '#toolbar=1&navpanes=0&view=FitH' : '';

    return (
      <div className="w-full h-full flex flex-col bg-[#04060A] text-white overflow-hidden select-none">
        {/* Barre supérieure du lecteur document (Image 3) */}
        <div className="sticky top-0 z-20 w-full bg-[#04060A]/95 backdrop-blur-md px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/10 flex items-center justify-between gap-2 shadow-md shrink-0">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleNavigateDoc('prev')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Document précédent"
            >
              <ChevronLeft className="w-4 h-4 stroke-[2.2]" />
            </button>
            <button
              type="button"
              onClick={() => handleNavigateDoc('next')}
              className="w-8 h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer shrink-0"
              title="Document suivant"
            >
              <ChevronRight className="w-4 h-4 stroke-[2.2]" />
            </button>

            <div className="min-w-0 ml-1">
              <p className="text-xs sm:text-sm font-bold text-white truncate max-w-[150px] sm:max-w-[220px]" title={file.name}>
                {file.name}
              </p>
              {file.size && (
                <p className="text-[10px] text-slate-400 font-semibold truncate">
                  {file.size}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => setViewerZoom(prev => Math.max(0.5, prev - 0.25))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Zoom arrière (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewerZoom(prev => Math.min(3, prev + 0.25))}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Zoom avant (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewerRotation(prev => (prev + 90) % 360)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Faire pivoter"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Bouton Mode Vertical / Horizontal (Image 3) */}
            <button
              type="button"
              onClick={() => {
                const nextMode = docLayoutMode === 'vertical' ? 'horizontal' : 'vertical';
                setDocLayoutMode(nextMode);
                setDocCurrentPage(1);
                showToast(nextMode === 'horizontal' ? 'Mode défilement horizontal activé' : 'Mode défilement vertical activé');
              }}
              className={`h-7 sm:h-8 px-2.5 sm:px-3 rounded-full flex items-center gap-1.5 text-xs font-bold border transition-all cursor-pointer shadow-sm active:scale-95 ${
                docLayoutMode === 'horizontal'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 ring-1 ring-amber-400/40'
                  : 'bg-blue-500/20 text-blue-300 border-blue-500/50 hover:bg-blue-500/30 ring-1 ring-blue-400/40'
              }`}
              title={docLayoutMode === 'vertical' ? 'Défilement vertical (Cliquer pour passer en horizontal)' : 'Défilement horizontal (Cliquer pour passer en vertical)'}
            >
              <SlidersHorizontal className={`w-3.5 h-3.5 ${docLayoutMode === 'vertical' ? 'rotate-90 text-blue-400' : 'text-amber-400'}`} />
              <span className="text-[11px] font-black">{docLayoutMode === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleShare(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-slate-800 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Partager"
            >
              <Share2 className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleDownload(file)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/60 hover:bg-orange-600 text-white flex items-center justify-center border border-white/10 transition-colors cursor-pointer"
              title="Télécharger"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(file, 'Documents', documentsList)}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 bg-[#04060A] hover:bg-emerald-950 text-emerald-400 border-white/10 hover:border-emerald-500/50"
                title="Ouvrir dans l'Espace d'étude"
              >
                <BookOpen className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsViewerMaximized(!isViewerMaximized)}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 ${
                isViewerMaximized ? 'bg-blue-600 text-white border-blue-400' : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
              }`}
              title={isViewerMaximized ? 'Réduire la vue' : "Agrandir dans l'espace"}
            >
              {isViewerMaximized ? <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" /> : <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedDoc(null)}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center border border-rose-400/40 transition-colors cursor-pointer shadow-sm active:scale-95"
              title="Fermer le lecteur de document"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>

        {/* Corps du Document (Image 3) */}
        <div className="flex-1 w-full h-full flex flex-col overflow-hidden bg-stone-100 dark:bg-stone-900 select-text">
          {isPdf ? (
            docLayoutMode === 'horizontal' ? (
              <PdfHorizontalViewer
                fileId={file.id}
                file={file}
                url={splitResolvedPdfUrl || file.url}
                docZoom={Math.round(viewerZoom * 100)}
                layoutMode="horizontal"
                currentPage={docCurrentPage}
                onPageChange={setDocCurrentPage}
                isFullscreen={isViewerMaximized}
              />
            ) : nativePdfUrl ? (
              <div className="w-full h-full flex-1 flex flex-col items-center overflow-hidden bg-stone-100 dark:bg-stone-900">
                <object
                  key={`pdf-native-${file.id || cleanPdfBase}`}
                  data={nativePdfUrl}
                  type="application/pdf"
                  className="w-full h-full border-0 block flex-1"
                  style={{ width: '100%', height: '100%' }}
                >
                  <iframe
                    key={`iframe-pdf-native-${file.id || cleanPdfBase}`}
                    src={nativePdfUrl}
                    title={file.name || 'Document PDF'}
                    className="w-full h-full border-0 block flex-1"
                    style={{ width: '100%', height: '100%' }}
                  />
                </object>
              </div>
            ) : (
              <PdfHorizontalViewer
                fileId={file.id}
                file={file}
                url={file.url}
                docZoom={Math.round(viewerZoom * 100)}
                layoutMode="vertical"
                currentPage={docCurrentPage}
                onPageChange={setDocCurrentPage}
                isFullscreen={isViewerMaximized}
              />
            )
          ) : (
            <ModernDocumentViewer
              fileId={file.id}
              url={file.url}
              fileName={file.name}
              fileSize={file.size}
              className="w-full h-full border-0 rounded-none shadow-none"
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col bg-stone-50 dark:bg-[#070B14] overflow-hidden select-none">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 bg-black/90 text-white border border-white/20 rounded-xl shadow-2xl text-xs sm:text-sm font-semibold flex items-center gap-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Input de sélection de fichier */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportDocuments}
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.odt,.rtf"
        multiple
        className="hidden"
      />

      {/* EN-TÊTE FIXE DU MENU DOCUMENTS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Retour et Titre */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-blue-400">
                <FileText className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Documents
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-400 leading-tight">
                  StudyCloud
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher dans Documents..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* DROITE : Espace d'étude & + Importer */}
          <div className="shrink-0 flex items-center gap-2">
            {onOpenStudySpace && (
              <button
                type="button"
                onClick={() => onOpenStudySpace(selectedDoc || undefined, 'Documents', documentsList)}
                className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#101827] text-emerald-400 border border-emerald-500/30 transition-all font-bold text-xs"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Espace d'étude</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-blue-400 border border-blue-500/40 hover:border-blue-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer un document"
            >
              <Plus className="w-4 h-4 text-blue-400 stroke-[2.5]" />
              <span>+ Importer</span>
            </button>
          </div>
        </div>
      </header>

      {/* DISPOSITION SPLIT (IMAGE 3) */}
      <div className="flex-1 flex flex-col md:flex-row w-full overflow-hidden relative min-h-[calc(100vh-120px)]">
        {/* PANNEAU DE GAUCHE : LISTE DES DOCUMENTS */}
        <div className={`transition-all duration-300 overflow-y-auto px-3 sm:px-5 py-3 sm:py-4 pb-64 sm:pb-80 ${
          isViewerMaximized
            ? 'hidden'
            : selectedDoc
              ? 'w-full md:w-5/12 lg:w-5/12 xl:w-5/12 border-b md:border-b-0 md:border-r border-stone-300/80 dark:border-slate-800/80'
              : 'w-full px-3 sm:px-6 md:px-10 lg:px-12'
        }`}>
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs font-bold text-stone-500 dark:text-slate-400">
                {filteredDocuments.length} document{filteredDocuments.length > 1 ? 's' : ''} disponible{filteredDocuments.length > 1 ? 's' : ''}
              </span>
            </div>

            {loading ? (
              <div className="py-20 text-center text-stone-400">
                <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs">Chargement des documents...</p>
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-20 text-center text-stone-500 dark:text-slate-400">
                <FileText className="w-12 h-12 mx-auto mb-3 opacity-30 stroke-[1.5] text-blue-400" />
                <p className="text-sm font-semibold">Aucun document disponible</p>
                <p className="text-xs opacity-70 mt-1 max-w-sm mx-auto">
                  Ce dossier ne contient aucun document pour le moment.
                </p>
              </div>
            ) : (
              <div className={`grid gap-2.5 sm:gap-3.5 ${
                selectedDoc
                  ? 'grid-cols-2 min-[480px]:grid-cols-3 md:grid-cols-3 xl:grid-cols-3'
                  : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'
              }`}>
                {filteredDocuments.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  const isMenuOpen = menuDocId === doc.id;

                  return (
                    <div
                      key={doc.id}
                      onClick={() => {
                        setSelectedDoc(doc);
                      }}
                      className={`group relative flex flex-col rounded-2xl p-2.5 transition-all cursor-pointer border select-none ${
                        isSelected
                          ? 'bg-blue-500/10 dark:bg-blue-950/30 border-blue-400 dark:border-blue-500 shadow-md ring-1 ring-blue-400/40'
                          : 'bg-white dark:bg-slate-900/80 border-stone-200/90 dark:border-slate-800 hover:border-blue-400/50 hover:shadow-lg'
                      }`}
                    >
                      {/* Vignette Preview */}
                      <div className="w-full aspect-[4/3] rounded-xl overflow-hidden bg-slate-950 relative flex items-center justify-center shadow-inner">
                        <DocumentCardPreview doc={doc} className="w-full h-full object-cover" />
                        {doc.extension && (
                          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] font-black uppercase text-white tracking-wider">
                            {doc.extension}
                          </span>
                        )}
                        {doc.isFavorite && (
                          <Star className="absolute top-1.5 right-1.5 w-3.5 h-3.5 text-amber-400 fill-amber-400 filter drop-shadow" />
                        )}
                      </div>

                      {/* Titre & métadonnées */}
                      <div className="mt-2 min-w-0">
                        <h4 className={`text-xs font-bold truncate leading-tight ${
                          isSelected ? 'text-blue-500 dark:text-blue-300' : 'text-stone-800 dark:text-white group-hover:text-blue-500'
                        }`}>
                          {doc.name}
                        </h4>
                        <p className="text-[10px] text-stone-400 dark:text-slate-500 font-medium truncate mt-0.5">
                          {doc.size || 'Document'} • {doc.date}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* PANNEAU DE DROITE : LECTEUR DOCUMENT DÉDIÉ (IMAGE 3) */}
        {selectedDoc && (
          <div className={`transition-all duration-300 flex flex-col bg-[#04060A] ${
            isViewerMaximized
              ? 'w-full flex-1 h-full min-h-[calc(100vh-68px)]'
              : 'w-full md:w-7/12 lg:w-7/12 xl:w-7/12 min-h-[550px] border-t md:border-t-0 md:border-l border-white/10'
          }`}>
            {renderDocumentReader(selectedDoc)}
          </div>
        )}
      </div>
    </div>
  );
};
