import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Check, 
  Sparkles, 
  Upload, 
  RotateCcw, 
  Palette, 
  Image as ImageIcon,
  CheckCircle2,
  Monitor,
  Maximize2,
  StretchHorizontal
} from 'lucide-react';
import { 
  PRESET_WALLPAPERS, 
  DEFAULT_WALLPAPER_URL, 
  applyDashboardWallpaper 
} from '../utils/wallpaperHelper';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { invalidateCloudQueries } from '../services/queryClient';

export const WallpaperSelectorDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('studycloud_dashboard_wallpaper');
      if (saved && !saved.startsWith('blob:')) return saved;
    } catch {}
    return DEFAULT_WALLPAPER_URL;
  });
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>(() => {
    try {
      const saved = localStorage.getItem('studycloud_wallpaper_fit_mode');
      if (saved === 'cover' || saved === 'contain') return saved;
    } catch {}
    return 'contain';
  });

  // Écoute de l'événement d'ouverture depuis n'importe quel composant
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleWallpaperUpdate = (e: any) => {
      const wp = e?.detail?.wallpaper;
      if (wp) {
        setCurrentWallpaper(wp);
      } else {
        setCurrentWallpaper(DEFAULT_WALLPAPER_URL);
      }
    };

    window.addEventListener('studycloud_open_wallpaper_drawer', handleOpen);
    window.addEventListener('studycloud_close_wallpaper_drawer', handleClose);
    window.addEventListener('studycloud_wallpaper_updated', handleWallpaperUpdate);
    const handleFitModeUpdate = (e: any) => {
      const mode = e?.detail?.fitMode;
      if (mode === 'cover' || mode === 'contain') setFitMode(mode);
    };
    window.addEventListener('studycloud_wallpaper_fit_mode_updated', handleFitModeUpdate);

    return () => {
      window.removeEventListener('studycloud_open_wallpaper_drawer', handleOpen);
      window.removeEventListener('studycloud_close_wallpaper_drawer', handleClose);
      window.removeEventListener('studycloud_wallpaper_updated', handleWallpaperUpdate);
      window.removeEventListener('studycloud_wallpaper_fit_mode_updated', handleFitModeUpdate);
    };
  }, []);

  const handleSelectFitMode = (mode: 'contain' | 'cover') => {
    setFitMode(mode);
    try {
      localStorage.setItem('studycloud_wallpaper_fit_mode', mode);
    } catch {}
    window.dispatchEvent(new CustomEvent('studycloud_wallpaper_fit_mode_updated', { detail: { fitMode: mode } }));
    showToast(mode === 'contain' ? "Mode Vue Complète (Anti-zoom PC) activé !" : "Mode Plein Écran (Rempli) activé !");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSelectPreset = (url: string, name: string) => {
    setCurrentWallpaper(url);
    try {
      localStorage.setItem('studycloud_dashboard_wallpaper', url);
      localStorage.setItem('studycloud_dashboard_wallpaper_meta', JSON.stringify({ name, url, isPreset: true }));
    } catch {}

    // Déclenchement réactif 0ms
    window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: url } }));
    showToast(`Fond d'écran "${name}" appliqué avec succès !`);

    // Synchronisation en arrière-plan vers D1
    CloudStorageAPI.saveWallpaper(url, name)
      .then(() => invalidateCloudQueries.wallpaper())
      .catch((err) => console.warn('[WallpaperDrawer] saveWallpaper sync warning:', err));
  };

  const handleCustomUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    showToast("Application de votre photo personnelle...");
    try {
      const appliedUrl = await applyDashboardWallpaper(file, file.name);
      setCurrentWallpaper(appliedUrl);
      showToast("Votre photo a été définie comme fond d'écran !");
    } catch (err) {
      console.error('[WallpaperDrawer] Upload error:', err);
      showToast("Erreur lors de l'application de votre image.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRestoreDefault = () => {
    handleSelectPreset(DEFAULT_WALLPAPER_URL, 'Rivage Turquoise');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[999999] flex select-none">
      {/* 1. Backdrop d'arrière-plan avec flou */}
      <div 
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={() => setIsOpen(false)}
      />

      {/* 2. Tiroir latéral gauche (Drawer) un peu grand */}
      <div className="relative w-full sm:w-[480px] md:w-[540px] max-w-[92vw] h-full bg-[#0a0e17] text-slate-100 shadow-2xl border-r border-white/10 flex flex-col z-10 animate-slideInLeft">
        
        {/* En-tête du panneau */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#0e1422]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>Fonds d'écran</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Tableau de bord
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Personnalisez l'arrière-plan de votre accueil StudyCloud
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 border border-white/10"
            title="Fermer le panneau"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps défilable avec les propositions d'images */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 scrollbar-thin scrollbar-thumb-white/20">

          {/* Toast de confirmation en haut du panneau */}
          {toastMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Palette className="w-3.5 h-3.5 text-amber-400" />
              <span>Galerie officielle ({PRESET_WALLPAPERS.length} thèmes)</span>
            </span>
            <button
              type="button"
              onClick={handleRestoreDefault}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Réinitialiser par défaut</span>
            </button>
          </div>

          {/* Grille des 4 images proposées */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {PRESET_WALLPAPERS.map((wp) => {
              const isSelected = currentWallpaper === wp.url;
              return (
                <div
                  key={wp.id}
                  onClick={() => handleSelectPreset(wp.url, wp.name)}
                  className={`group relative rounded-2xl overflow-hidden border-2 cursor-pointer transition-all duration-300 bg-[#121826] hover:scale-[1.02] flex flex-col ${
                    isSelected 
                      ? 'border-emerald-400 ring-4 ring-emerald-500/20 shadow-lg shadow-emerald-950/40' 
                      : 'border-white/10 hover:border-amber-400/50 hover:shadow-md'
                  }`}
                >
                  {/* Aperçu de l'image */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900">
                    <img 
                      src={wp.url} 
                      alt={wp.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                    {/* Badge Par défaut */}
                    {wp.isDefault && (
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black uppercase tracking-wider shadow">
                        Par défaut
                      </div>
                    )}

                    {/* Badge Actif */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Actif</span>
                      </div>
                    )}
                  </div>

                  {/* Informations sur l'image */}
                  <div className="p-3 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                        {wp.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 font-normal leading-relaxed">
                        {wp.subtitle}
                      </p>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">0 Ko (Intégré)</span>
                      <span className={`font-bold transition-colors ${isSelected ? 'text-emerald-400' : 'text-slate-400 group-hover:text-white'}`}>
                        {isSelected ? '✓ Appliqué' : 'Choisir →'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Section d'import personnalisé */}
          <div className="pt-2">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 space-y-3">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs sm:text-sm font-bold text-white">
                  Vous avez votre propre photo ?
                </h4>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Vous pouvez également choisir n'importe quelle photo depuis vos fichiers pour en faire votre fond d'écran personnel.
              </p>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 transition-all font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <Upload className="w-4 h-4" />
                <span>Sélectionner une photo depuis l'appareil</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleCustomUpload}
                className="hidden"
              />
            </div>
          </div>

        </div>

        {/* Pied du tiroir */}
        <div className="p-4 border-t border-white/10 bg-[#0e1422] flex items-center justify-between text-xs text-slate-400">
          <span>StudyCloud Thèmes Visuels</span>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};

