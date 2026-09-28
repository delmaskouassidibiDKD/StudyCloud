import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  FileText,
  Plus,
  Trash2,
  MoreVertical,
  Star,
  Download,
  Share2,
  BookOpen,
  Edit2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Maximize2,
  Minimize2,
  FileCode,
  Check,
  CheckSquare,
  Square,
  LayoutGrid,
  List,
  Eye,
  FileSpreadsheet,
  FileCheck2,
  Clock,
  Sparkles
} from 'lucide-react';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { storeFileBlob, getFileBlobUrl, deleteFileBlob } from '../services/localFileStorage';
import { compressFile } from '../utils/fileCompressor';
import { FileItem } from './Page1FilesMenuView';
import { DocumentCardPreview } from './DocumentCardPreview';
import { UploadQueue } from '../services/uploadQueue';
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

  // Lecteur de document actif (split ou modal plein écran)
  const [readingDoc, setReadingDoc] = useState<FileItem | null>(null);
  const [docBlobUrl, setDocBlobUrl] = useState<string>('');
  const [readerZoom, setReaderZoom] = useState(1);
  const [readerRotation, setReaderRotation] = useState(0);

  // Sélection multiple
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Menu déroulant
  const [menuDocId, setMenuDocId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Chargement des documents
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

    return () => {
      isMounted = false;
    };
  }, []);

  // Résoudre l'URL de prévisualisation du document quand on l'ouvre
  useEffect(() => {
    if (!readingDoc) {
      setDocBlobUrl('');
      return;
    }

    let isMounted = true;
    const resolveUrl = async () => {
      let target = readingDoc.previewUrl || readingDoc.url || '';
      if (!target.startsWith('http') && !target.startsWith('blob:')) {
        const local = await getFileBlobUrl(readingDoc.id);
        if (local) target = local;
      }
      if (isMounted) setDocBlobUrl(target);
    };

    resolveUrl();
    return () => {
      isMounted = false;
    };
  }, [readingDoc]);

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

        // Détection de catégorie de cours
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
          previewUrl: localBlobUrl,
          isNotepad: ext === 'txt'
        };

        return { file: comp.file, item };
      })
    );

    const newItems = newItemsWithFiles.map(x => x.item);
    setDocumentsList(prev => [...newItems, ...prev]);
    CloudDataStore.setDocuments([...newItems, ...documentsList] as any);

    // File d'attente d'upload cloud
    UploadQueue.enqueueExisting(newItemsWithFiles, { category: 'documents' });

    showToast(`${newItems.length} document(s) importé(s) avec succès !`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Suppression d'un document (mise à la corbeille)
  const handleDeleteDocument = async (doc: FileItem) => {
    setDocumentsList(prev => prev.filter(d => d.id !== doc.id));
    if (readingDoc?.id === doc.id) {
      setReadingDoc(null);
    }

    const trashedItem = { ...doc, originalCategory: 'documents', isTrash: true };
    CloudDataStore.moveToTrash(trashedItem as any);
    await CloudStorageAPI.deleteDocument(doc.id).catch(() => {});
    showToast(`"${doc.name}" déplacé dans la corbeille`);
    setMenuDocId(null);
  };

  // Basculer favori
  const handleToggleFavorite = async (doc: FileItem) => {
    const nextState = !doc.isFavorite;
    setDocumentsList(prev =>
      prev.map(d => (d.id === doc.id ? { ...d, isFavorite: nextState } : d))
    );
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
    CloudDataStore.updateFile(doc.id, { name: finalName });
    showToast(`Document renommé en "${finalName}"`);
    setMenuDocId(null);
  };

  // Téléchargement
  const handleDownload = async (doc: FileItem) => {
    let url = doc.previewUrl || doc.url;
    if (!url || (!url.startsWith('http') && !url.startsWith('blob:'))) {
      url = await getFileBlobUrl(doc.id);
    }
    if (url) {
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('Téléchargement démarré...');
    }
    setMenuDocId(null);
  };

  // Filtrage par onglet & recherche
  const filteredDocuments = useMemo(() => {
    let list = documentsList;

    if (activeFilter === 'pdf') {
      list = list.filter(d => (d.extension || '').toUpperCase() === 'PDF');
    } else if (activeFilter === 'cours') {
      list = list.filter(d => d.documentCategory === 'COURS' || d.name.toLowerCase().includes('cours'));
    } else if (activeFilter === 'td') {
      list = list.filter(d => d.documentCategory === 'TD' || d.name.toLowerCase().includes('td'));
    } else if (activeFilter === 'devoirs') {
      list = list.filter(d => d.documentCategory === 'DEVOIRS' || d.name.toLowerCase().includes('devoir'));
    } else if (activeFilter === 'txt') {
      list = list.filter(d => d.isNotepad || (d.extension || '').toUpperCase() === 'TXT');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(d => d.name.toLowerCase().includes(q));
    }

    return list;
  }, [documentsList, activeFilter, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* Input invisible pour l'import de documents */}
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
          {/* GAUCHE : Bouton Retour et Titre Documents */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
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
                <p className="text-[10px] sm:text-[11px] font-semibold text-blue-400/80 leading-tight">
                  {documentsList.length} document{documentsList.length > 1 ? 's' : ''} disponible{documentsList.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Documents */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-blue-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un document, cours, TD..."
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

          {/* DROITE : Bouton + Importer et Actions */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-blue-400 border border-blue-500/40 hover:border-blue-400 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm text-xs sm:text-sm font-black"
              title="Importer un fichier document"
            >
              <Plus className="w-4 h-4 text-blue-400 stroke-[2.5]" />
              <span className="hidden xs:inline">Importer document</span>
              <span className="xs:hidden">Importer</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-slate-300 hover:text-white border border-white/10"
              title={viewMode === 'grid' ? 'Vue liste' : 'Vue grille'}
            >
              {viewMode === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setIsSelectionMode(!isSelectionMode)}
              className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border transition-all cursor-pointer shrink-0 active:scale-95 ${
                isSelectionMode
                  ? 'bg-blue-500 text-black border-blue-400 font-bold'
                  : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
              }`}
              title={isSelectionMode ? 'Quitter la sélection' : 'Sélection multiple'}
            >
              <CheckSquare className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
              title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* BARRE DES FILTRES RAPIDES */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Tous' },
            { id: 'pdf', label: 'PDF' },
            { id: 'cours', label: 'Cours' },
            { id: 'td', label: 'TD' },
            { id: 'devoirs', label: 'Devoirs' },
            { id: 'txt', label: 'Notes (.txt)' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveFilter(tab.id as any)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-blue-500 text-black shadow-md shadow-blue-500/20'
                  : 'bg-[#10162A] text-slate-300 hover:text-white hover:bg-[#192242] border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* BANDEAU DE SÉLECTION MULTIPLE */}
      {isSelectionMode && (
        <div className="w-full bg-[#0F1424] border-b border-blue-500/30 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-blue-400">
              {selectedIds.length} sélectionné(s)
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedIds.length === filteredDocuments.length) {
                  setSelectedIds([]);
                } else {
                  setSelectedIds(filteredDocuments.map(d => d.id));
                }
              }}
              className="text-stone-300 hover:text-white underline ml-2"
            >
              {selectedIds.length === filteredDocuments.length ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const toDelete = documentsList.filter(d => selectedIds.includes(d.id));
                    toDelete.forEach(handleDeleteDocument);
                    setSelectedIds([]);
                    setIsSelectionMode(false);
                  }}
                  className="px-3 py-1 bg-red-500/20 text-red-300 hover:bg-red-500/30 border border-red-500/40 rounded-lg flex items-center gap-1 font-bold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Supprimer ({selectedIds.length})</span>
                </button>

                {onOpenStudySpace && (
                  <button
                    type="button"
                    onClick={() => {
                      const first = documentsList.find(d => d.id === selectedIds[0]);
                      onOpenStudySpace(first, 'Documents', documentsList);
                    }}
                    className="px-3 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg flex items-center gap-1 font-bold"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Espace d'étude</span>
                  </button>
                )}
              </>
            )}
            <button
              type="button"
              onClick={() => {
                setIsSelectionMode(false);
                setSelectedIds([]);
              }}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg"
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      {/* LECTEUR DE DOCUMENT INTÉGRÉ AU SOMMET (SI DOCUMENT OUVERT) */}
      {readingDoc && (
        <div className="w-full bg-[#0D1222] border-b border-blue-500/30 p-3 sm:p-5 shadow-2xl relative">
          <div className="max-w-6xl mx-auto flex flex-col gap-3">
            {/* Barre de contrôles du lecteur */}
            <div className="flex items-center justify-between gap-3 bg-[#060914] p-2.5 rounded-2xl border border-white/10">
              <div className="min-w-0 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                <h3 className="text-xs sm:text-sm font-black text-white truncate" title={readingDoc.name}>
                  {readingDoc.name}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setReaderZoom(Math.max(0.6, readerZoom - 0.2))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
                  title="Zoom arrière"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono px-1.5 text-slate-400">
                  {Math.round(readerZoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setReaderZoom(Math.min(2.5, readerZoom + 0.2))}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300"
                  title="Zoom avant"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setReaderRotation((readerRotation + 90) % 360)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-300 ml-1"
                  title="Pivoter à 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {onOpenStudySpace && (
                  <button
                    type="button"
                    onClick={() => onOpenStudySpace(readingDoc, 'Documents', documentsList)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-xs font-bold ml-1"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Espace d'étude</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setReadingDoc(null)}
                  className="p-1.5 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 ml-2"
                  title="Fermer le lecteur"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Zone d'affichage du Document (PDF / iframe / visionneuse) */}
            <div className="w-full h-[60vh] max-h-[750px] bg-[#04060C] rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center relative">
              {docBlobUrl ? (
                (readingDoc.extension || '').toUpperCase() === 'PDF' ? (
                  <div
                    className="w-full h-full overflow-auto flex items-center justify-center transition-transform"
                    style={{ transform: `scale(${readerZoom}) rotate(${readerRotation}deg)` }}
                  >
                    <iframe
                      src={`${docBlobUrl}#toolbar=1&navpanes=0`}
                      className="w-full h-full border-none rounded-xl"
                      title={readingDoc.name}
                    />
                  </div>
                ) : readingDoc.isNotepad || (readingDoc.extension || '').toUpperCase() === 'TXT' ? (
                  <div className="w-full h-full p-6 overflow-auto font-mono text-xs sm:text-sm text-slate-200 leading-relaxed bg-[#0B0F1E] rounded-xl whitespace-pre-wrap">
                    {readingDoc.content || 'Document texte vide.'}
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <FileText className="w-12 h-12 mx-auto text-blue-400 mb-3 opacity-60" />
                    <p className="text-sm font-bold text-white mb-2">{readingDoc.name}</p>
                    <p className="text-xs text-slate-400 mb-4">
                      Aperçu intégré non disponible pour le format {readingDoc.extension}. Téléchargez ou ouvrez le document.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleDownload(readingDoc)}
                      className="px-4 py-2 rounded-xl bg-blue-500 text-black font-bold text-xs inline-flex items-center gap-1.5"
                    >
                      <Download className="w-4 h-4" />
                      <span>Télécharger le fichier</span>
                    </button>
                  </div>
                )
              ) : (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>Chargement du document...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENU PRINCIPAL : LISTE OU GRILLE DES DOCUMENTS */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3">
            <div className="w-10 h-10 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-slate-400">Chargement de vos documents...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="py-24 flex flex-col items-center justify-center text-center max-w-md mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#121829] border border-blue-500/20 flex items-center justify-center mb-4 shadow-xl">
              <FileText className="w-10 h-10 text-blue-400 opacity-80 stroke-[1.5]" />
            </div>
            <h3 className="text-lg font-black text-white mb-1.5">
              {searchQuery ? 'Aucun document trouvé' : 'Aucun document disponible'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-6 leading-relaxed">
              {searchQuery
                ? `Aucun document ne correspond à "${searchQuery}".`
                : 'Importez vos cours, fiches de révision, exercices TD, examens au format PDF ou Word.'}
            </p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-black font-black text-sm shadow-lg shadow-blue-500/20 transition-all cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Importer un document</span>
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredDocuments.map((doc, idx) => {
              const isSelected = readingDoc?.id === doc.id;
              const isChecked = selectedIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      if (isChecked) setSelectedIds(selectedIds.filter(id => id !== doc.id));
                      else setSelectedIds([...selectedIds, doc.id]);
                    } else {
                      setReadingDoc(doc);
                    }
                  }}
                  className={`group relative rounded-2xl p-2.5 flex flex-col justify-between transition-all duration-200 cursor-pointer select-none border ${
                    isSelected
                      ? 'bg-[#151D33] border-blue-400 shadow-lg shadow-blue-500/10 scale-102'
                      : 'bg-[#0B0F1D] hover:bg-[#121828] border-white/10 hover:border-blue-400/40 shadow-sm'
                  }`}
                >
                  {/* Case à cocher ou Badge Catégorie */}
                  <div className="flex items-center justify-between mb-2">
                    {isSelectionMode ? (
                      <div className="text-blue-400">
                        {isChecked ? (
                          <CheckSquare className="w-5 h-5 fill-blue-500/20" />
                        ) : (
                          <Square className="w-5 h-5 text-slate-500" />
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-extrabold text-[10px] tracking-wide border border-blue-500/30">
                        {doc.extension || 'PDF'}
                      </span>
                    )}

                    <div className="relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setMenuDocId(menuDocId === doc.id ? null : doc.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>

                      {menuDocId === doc.id && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-2xl bg-[#121828] border border-white/15 shadow-2xl p-1.5 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
                          <button
                            type="button"
                            onClick={() => {
                              setReadingDoc(doc);
                              setMenuDocId(null);
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-400" />
                            <span>Lire</span>
                          </button>

                          {onOpenStudySpace && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenStudySpace(doc, 'Documents', documentsList);
                                setMenuDocId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Espace d'étude</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleToggleFavorite(doc)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span>{doc.isFavorite ? 'Retirer des favoris' : 'Favori'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Download className="w-3.5 h-3.5 text-sky-400" />
                            <span>Télécharger</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRenameDocument(doc)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                          >
                            <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Renommer</span>
                          </button>

                          {onOpenCreateShareLink && (
                            <button
                              type="button"
                              onClick={() => {
                                onOpenCreateShareLink([doc]);
                                setMenuDocId(null);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/10 rounded-xl text-left"
                            >
                              <Share2 className="w-3.5 h-3.5 text-purple-400" />
                              <span>Partager le lien</span>
                            </button>
                          )}

                          <div className="h-px bg-white/10 my-1" />

                          <button
                            type="button"
                            onClick={() => handleDeleteDocument(doc)}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 rounded-xl text-left"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Corbeille</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Aperçu Card */}
                  <div className="w-full h-28 rounded-xl bg-black/40 border border-white/5 overflow-hidden flex items-center justify-center p-2 mb-2 group-hover:scale-102 transition-transform">
                    <DocumentCardPreview doc={doc} />
                  </div>

                  {/* Nom & Infos */}
                  <div className="min-w-0">
                    <h4
                      className="text-xs font-bold text-white truncate group-hover:text-blue-300 transition-colors"
                      title={doc.name}
                    >
                      {doc.name}
                    </h4>
                    <p className="text-[10px] text-slate-400 truncate mt-0.5">
                      {doc.size} • {doc.date}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filteredDocuments.map((doc) => {
              const isSelected = readingDoc?.id === doc.id;
              const isChecked = selectedIds.includes(doc.id);

              return (
                <div
                  key={doc.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      if (isChecked) setSelectedIds(selectedIds.filter(id => id !== doc.id));
                      else setSelectedIds([...selectedIds, doc.id]);
                    } else {
                      setReadingDoc(doc);
                    }
                  }}
                  className={`group rounded-2xl p-3 flex items-center gap-3 transition-all duration-200 cursor-pointer border ${
                    isSelected
                      ? 'bg-[#151D33] border-blue-400'
                      : 'bg-[#0B0F1D] hover:bg-[#121828] border-white/10 hover:border-blue-400/40'
                  }`}
                >
                  {isSelectionMode && (
                    <div className="shrink-0 text-blue-400">
                      {isChecked ? <CheckSquare className="w-5 h-5 fill-blue-500/20" /> : <Square className="w-5 h-5 text-slate-500" />}
                    </div>
                  )}

                  <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-bold text-white truncate group-hover:text-blue-300">
                      {doc.name}
                    </h4>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {doc.documentCategory && doc.documentCategory !== "PAS D'INF..." && (
                        <span className="text-blue-400 font-bold mr-1.5">{doc.documentCategory}</span>
                      )}
                      {doc.size} • {doc.date}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(doc)}
                      className={`p-1.5 rounded-lg border transition-all ${
                        doc.isFavorite ? 'bg-amber-500/20 border-amber-400 text-amber-400' : 'border-white/10 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Star className={`w-4 h-4 ${doc.isFavorite ? 'fill-amber-400' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:border-sky-400"
                    >
                      <Download className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteDocument(doc)}
                      className="p-1.5 rounded-lg border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-blue-500/40 text-blue-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
