import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  Cloud,
  HardDrive,
  RefreshCw,
  Sparkles,
  Zap,
  ShieldCheck,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FolderArchive,
  Trash2,
  Download,
  Share2,
  ChevronRight,
  TrendingUp,
  Check,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { CloudStorageAPI, CloudOverviewData } from '../services/cloudStorageService';
import { CloudDataStore } from '../services/cloudDataStore';
import { FileItem } from './Page1FilesMenuView';
import { getFileBlobUrl } from '../services/localFileStorage';

interface CloudSpaceMenuViewProps {
  onBack: () => void;
  onOpenPricing?: (tab?: 'storage' | 'ai' | 'renewal') => void;
  onNavigateToCategory?: (category: 'audio' | 'documents' | 'videos' | 'images' | 'trash' | 'classeur') => void;
}

export const CloudSpaceMenuView: React.FC<CloudSpaceMenuViewProps> = ({
  onBack,
  onOpenPricing,
  onNavigateToCategory
}) => {
  const [overview, setOverview] = useState<CloudOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const data = await CloudStorageAPI.getOverview();
      if (data) {
        setOverview(data);
      } else {
        // Calcul de repli local depuis CloudDataStore
        const docs = CloudDataStore.getDocuments();
        const imgs = CloudDataStore.getImages();
        const vids = CloudDataStore.getVideos();
        const auds = CloudDataStore.getAudio();
        const trash = CloudDataStore.getTrash();

        const totalBytes = [...docs, ...imgs, ...vids, ...auds, ...trash].reduce(
          (sum, f) => sum + (f.sizeBytes || 0),
          0
        );

        setOverview({
          counts: {
            classeurFolders: 4,
            classeurFiles: 0,
            audio: auds.length,
            images: imgs.length,
            videos: vids.length,
            documents: docs.length,
            downloads: 0,
            secure: 0,
            trash: trash.length
          },
          totalBytes,
          totalFormatted: (totalBytes / (1024 * 1024)).toFixed(1) + ' Mo',
          recentFiles: [...docs, ...imgs, ...vids, ...auds].slice(0, 6)
        });
      }
      if (isManual) showToast('Espace Cloud synchronisé avec succès !');
    } catch {
      if (isManual) showToast('Erreur lors de la synchronisation.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalQuotaBytes = 10 * 1024 * 1024 * 1024; // 10 Go par défaut
  const usedBytes = overview?.totalBytes || 2.5 * 1024 * 1024;
  const usedPercentage = Math.min(100, Math.max(1, Math.round((usedBytes / totalQuotaBytes) * 100)));

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU ESPACE CLOUD */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Espace Cloud */}
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
              <div className="p-2 rounded-xl bg-black border border-white/10 text-cyan-400">
                <Cloud className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Espace Cloud
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-cyan-400/80 leading-tight">
                  Stockage Sécurisé Cloudflare D1 & R2
                </p>
              </div>
            </div>
          </div>

          {/* DROITE : Bouton Synchroniser et Forfait */}
          <div className="shrink-0 flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-cyan-300 border border-cyan-500/40 text-xs font-bold transition-all cursor-pointer active:scale-95"
              title="Synchroniser avec le serveur"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Synchroniser</span>
            </button>

            {onOpenPricing && (
              <button
                type="button"
                onClick={() => onOpenPricing('storage')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black font-black text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Augmenter</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* CONTENU PRINCIPAL : TABLEAU DE BORD ESPACE CLOUD */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-5 pb-32 space-y-6">
        {/* BANDEAU PRINCIPAL : JAUGE DE STOCKAGE */}
        <section className="rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#0F172A] via-[#0C1222] to-[#080D1A] border border-cyan-500/30 shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-lg">
              <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-black uppercase tracking-wider">
                Forfait Actif • 10 Go Inclus
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {overview?.totalFormatted || '2.5 Mo'} utilisés sur 10 Go
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Vos cours, audios, vidéos et schémas sont automatiquement chiffrés et répliqués sur l'infrastructure Cloudflare globale.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-3">
              <div className="text-center p-3 sm:p-4 rounded-2xl bg-black/50 border border-white/10 min-w-[120px]">
                <span className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
                  {usedPercentage}%
                </span>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5">Espace occupé</p>
              </div>
            </div>
          </div>

          {/* Barre de progression animée */}
          <div className="mt-6 relative z-10">
            <div className="w-full h-3 sm:h-3.5 bg-black/60 rounded-full overflow-hidden p-0.5 border border-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 transition-all duration-700 shadow-lg shadow-cyan-500/50"
                style={{ width: `${usedPercentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 mt-2 px-1">
              <span>0 Go</span>
              <span>5 Go</span>
              <span>10 Go max</span>
            </div>
          </div>
        </section>

        {/* SECTION 2 : RÉPARTITION PAR CATÉGORIE (CARTES CLIQUABLES) */}
        <section className="space-y-3">
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <span>Détail par catégorie</span>
            <span className="text-xs font-normal text-slate-400">(Cliquez pour ouvrir le menu dédié)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[
              {
                id: 'documents' as const,
                title: 'Documents & Cours',
                icon: FileText,
                color: 'text-blue-400',
                bgColor: 'bg-blue-500/10',
                borderColor: 'hover:border-blue-400/50',
                count: `${overview?.counts.documents || 0} document(s)`
              },
              {
                id: 'images' as const,
                title: 'Images & Schémas',
                icon: ImageIcon,
                color: 'text-emerald-400',
                bgColor: 'bg-emerald-500/10',
                borderColor: 'hover:border-emerald-400/50',
                count: `${overview?.counts.images || 0} image(s)`
              },
              {
                id: 'videos' as const,
                title: 'Vidéos de cours',
                icon: Film,
                color: 'text-purple-400',
                bgColor: 'bg-purple-500/10',
                borderColor: 'hover:border-purple-400/50',
                count: `${overview?.counts.videos || 0} vidéo(s)`
              },
              {
                id: 'audio' as const,
                title: 'Audio & Musique',
                icon: Music,
                color: 'text-amber-400',
                bgColor: 'bg-amber-500/10',
                borderColor: 'hover:border-amber-400/50',
                count: `${overview?.counts.audio || 0} piste(s)`
              },
              {
                id: 'classeur' as const,
                title: 'Dossiers Classeur 3D',
                icon: FolderArchive,
                color: 'text-orange-400',
                bgColor: 'bg-orange-500/10',
                borderColor: 'hover:border-orange-400/50',
                count: `${overview?.counts.classeurFolders || 0} dossier(s)`
              },
              {
                id: 'trash' as const,
                title: 'Corbeille',
                icon: Trash2,
                color: 'text-red-400',
                bgColor: 'bg-red-500/10',
                borderColor: 'hover:border-red-400/50',
                count: `${overview?.counts.trash || 0} élément(s)`
              }
            ].map((cat) => {
              const Icon = cat.icon;

              return (
                <div
                  key={cat.id}
                  onClick={() => {
                    if (onNavigateToCategory) onNavigateToCategory(cat.id);
                  }}
                  className={`group rounded-2xl p-4 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 ${cat.borderColor} shadow-md transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 hover:scale-101`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-3 rounded-xl bg-black/60 border border-white/10 shrink-0 ${cat.color}`}>
                      <Icon className="w-5 h-5 stroke-[2]" />
                    </div>

                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                        {cat.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                        {cat.count}
                      </p>
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 3 : ÉTAT DU CLOUD & SÉCURITÉ */}
        <section className="rounded-3xl p-5 sm:p-6 bg-[#0B0F1D] border border-white/10 space-y-4">
          <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Infrastructure Cloudflare & Sécurité</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Base D1 Connectée</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Métadonnées indexées et répliquées instantanément.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 font-bold text-cyan-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Stockage R2 Actif</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Fichiers volumineux hébergés sans perte de qualité.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-1">
              <div className="flex items-center gap-2 font-bold text-indigo-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Cache Local IndexedDB</span>
              </div>
              <p className="text-[11px] text-slate-400">
                Accès ultra-rapide hors-ligne (0 ms).
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* TOAST FLOTTANT */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#0F1424] border border-cyan-500/40 text-cyan-300 px-4 py-2.5 rounded-full shadow-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
