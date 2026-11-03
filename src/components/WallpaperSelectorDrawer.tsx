import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  RotateCcw, 
  Palette, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { 
  PRESET_WALLPAPERS, 
  DEFAULT_WALLPAPER_URL,
  DEFAULT_WALLPAPER_NAME,
  applyDashboardWallpaper,
  isWallpaperAutoRotationEnabled,
  setWallpaperAutoRotationEnabled,
  isPresetWallpaper,
  LS_WALLPAPER_LAST_ROTATION_TIME
} from '../utils/wallpaperHelper';
import { CloudStorageAPI } from '../services/cloudStorageService';
import { invalidateCloudQueries } from '../services/queryClient';

export const WallpaperSelectorDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentWallpaper, setCurrentWallpaper] = useState<string>(() => {
    try {
      const local = localStorage.getItem('studycloud_dashboard_wallpaper_local');
      if (local && !local.startsWith('blob:')) return local;
      const saved = localStorage.getItem('studycloud_dashboard_wallpaper');
      if (saved && !saved.startsWith('blob:')) return saved;
    } catch {}
    return DEFAULT_WALLPAPER_URL;
  });
  const [autoRotation, setAutoRotation] = useState<boolean>(() => isWallpaperAutoRotationEnabled());
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Écoute des événements d'ouverture, mise à jour et rotation auto
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    const handleClose = () => setIsOpen(false);
    const handleWallpaperUpdate = (e: any) => {
      const wp = e?.detail?.wallpaper;
      if (wp) {
        setCurrentWallpaper(wp);
      } else {
        const local = localStorage.getItem('studycloud_dashboard_wallpaper_local');
        const saved = local || localStorage.getItem('studycloud_dashboard_wallpaper');
        setCurrentWallpaper(saved || DEFAULT_WALLPAPER_URL);
      }
    };
    const handleAutoRotationChanged = (e: any) => {
      if (typeof e?.detail?.enabled === 'boolean') {
        setAutoRotation(e.detail.enabled);
      }
    };

    window.addEventListener('studycloud_open_wallpaper_drawer', handleOpen);
    window.addEventListener('studycloud_close_wallpaper_drawer', handleClose);
    window.addEventListener('studycloud_wallpaper_updated', handleWallpaperUpdate);
    window.addEventListener('studycloud_wallpaper_auto_rotation_changed', handleAutoRotationChanged as any);

    return () => {
      window.removeEventListener('studycloud_open_wallpaper_drawer', handleOpen);
      window.removeEventListener('studycloud_close_wallpaper_drawer', handleClose);
      window.removeEventListener('studycloud_wallpaper_updated', handleWallpaperUpdate);
      window.removeEventListener('studycloud_wallpaper_auto_rotation_changed', handleAutoRotationChanged as any);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleAutoRotation = () => {
    const nextState = !autoRotation;
    setAutoRotation(nextState);
    setWallpaperAutoRotationEnabled(nextState);
    if (nextState) {
      showToast('Rotation auto activée (change toutes les 48h)');
    } else {
      showToast('Rotation auto arrêtée : votre fond d\'écran restera fixe');
    }
  };

  const handleSelectPreset = (url: string, name: string) => {
    setCurrentWallpaper(url);
    showToast(`Fond d'écran "${name}" appliqué avec succès !`);
    try {
      localStorage.setItem(LS_WALLPAPER_LAST_ROTATION_TIME, String(Date.now()));
    } catch {}
    applyDashboardWallpaper(url, name)
      .catch((err) => console.warn('[WallpaperDrawer] applyDashboardWallpaper warning:', err));
  };

  const handleRestoreDefault = () => {
    handleSelectPreset(DEFAULT_WALLPAPER_URL, DEFAULT_WALLPAPER_NAME);
  };

  if (!isOpen) return null;

  const isCustomActive = !isPresetWallpaper(currentWallpaper);

  return (
    <div className="fixed inset-0 z-[999999] flex select-none">
      {/* 1. Backdrop d'arrière-plan avec flou */}
      <div 
        className="fixed inset-0 bg-black/65 backdrop-blur-sm transition-opacity animate-fadeIn"
        onClick={() => setIsOpen(false)}
      />

      {/* 2. Tiroir latéral gauche (Drawer) */}
      <div className="relative w-full sm:w-[480px] md:w-[540px] max-w-[92vw] h-full bg-[#0a0e17] text-slate-100 shadow-2xl border-r border-white/10 flex flex-col z-10 animate-slideInLeft">
        
        {/* En-tête épuré du panneau avec bouton bascule d'arrêt / activation de la rotation automatique */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/10 flex items-center justify-between bg-[#0e1422] gap-2.5">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black tracking-tight text-white truncate">
              Fonds d'écran
            </h2>
            <p className="text-xs text-slate-400 font-medium truncate">
              Personnalisez l'arrière-plan de votre accueil StudyCloud
            </p>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Bouton de bascule pour arrêter / activer la rotation automatique (48h) */}
            <button
              type="button"
              onClick={toggleAutoRotation}
              className={`group relative flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer select-none active:scale-95 ${
                autoRotation
                  ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)] hover:bg-emerald-500/25'
                  : 'bg-white/5 border-white/15 text-slate-400 hover:text-slate-200 hover:bg-white/10'
              }`}
              title={
                autoRotation
                  ? 'Changement automatique actif : passe au fond suivant toutes les 48h. Cliquez pour arrêter et figer votre fond.'
                  : 'Changement automatique arrêté : votre fond choisi reste pour toujours. Cliquez pour réactiver la rotation 48h.'
              }
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${autoRotation ? 'bg-emerald-400 shadow-[0_0_6px_#34d399] animate-pulse' : 'bg-slate-500'}`} />
              <span className="hidden sm:inline font-black tracking-wide">
                {autoRotation ? 'Rotation 48h' : 'Fond fixe'}
              </span>
              <span className="sm:hidden font-black text-[11px]">
                {autoRotation ? '48h' : 'Fixe'}
              </span>
              
              {/* Switch visuel interactif */}
              <div className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center shrink-0 ${
                autoRotation ? 'bg-emerald-500 justify-end' : 'bg-slate-700 justify-start'
              }`}>
                <div className="w-3 h-3 rounded-full bg-white shadow-sm transition-transform duration-200" />
              </div>
            </button>

            {/* Bouton Fermer */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-9 h-9 rounded-full bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 border border-white/10"
              title="Fermer le panneau"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps défilable avec les propositions d'images */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5 scrollbar-thin scrollbar-thumb-white/20">

          {/* Toast de confirmation en haut du panneau */}
          {toastMessage && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{toastMessage}</span>
            </div>
          )}

          {/* Indicateur explicatif si l'utilisateur utilise une image importée personnelle */}
          {isCustomActive && (
            <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-xl text-sky-200 text-xs font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
              <span>Vous utilisez une image importée personnelle. La rotation automatique ne s'applique que lorsque vous utilisez l'un de nos thèmes officiels ci-dessous.</span>
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

          {/* Grille des propositions d'images */}
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

                    {/* Badge Actif */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>Actif</span>
                      </div>
                    )}
                  </div>

                  {/* Informations sur l'image */}
                  <div className="p-3 flex-1 flex flex-col justify-center">
                    <h3 className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                      {wp.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-2 mt-1 font-normal leading-relaxed">
                      {wp.subtitle}
                    </p>
                  </div>
                </div>
              );
            })}
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
