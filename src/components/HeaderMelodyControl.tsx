import React, { useState, useRef, useEffect } from 'react';
import { Music, Play, Pause, SkipBack, SkipForward, Repeat, X, Disc3 } from 'lucide-react';
import { useGlobalAudio } from '../context/GlobalAudioContext';
import { useAudioList } from '../hooks/useCloudQueries';
import { CloudDataStore, FileItem } from '../services/cloudDataStore';

interface HeaderMelodyControlProps {
  isDarkMode?: boolean;
  dashboardWallpaper?: string | null;
  viewMode?: string;
  compact?: boolean;
}

export const HeaderMelodyControl: React.FC<HeaderMelodyControlProps> = ({
  isDarkMode = false,
  dashboardWallpaper = null,
  viewMode = 'home',
  compact = false
}) => {
  const isDark = isDarkMode || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const {
    currentTrack,
    isAudioPlaying,
    isAudioRepeat,
    togglePlayPause,
    handleAudioNext,
    handleAudioPrev,
    toggleAudioRepeat,
    stopAndClose,
    playTrack
  } = useGlobalAudio();

  const { data: serverAudio = [] } = useAudioList();
  const [localAudioList, setLocalAudioList] = useState<FileItem[]>(() => {
    return CloudDataStore.getState().audio || [];
  });
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Synchronisation dynamique avec CloudDataStore (RAM/D1)
  useEffect(() => {
    const unsub = CloudDataStore.subscribe((state) => {
      if (state.audio) {
        setLocalAudioList(state.audio);
      }
    });
    return unsub;
  }, []);

  // Liste consolidée des musiques (D1 query prioritaire, sinon RAM)
  const audioList = serverAudio && serverAudio.length > 0 ? serverAudio : localAudioList;

  // Fermer le menu déroulant si on clique en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('pointerdown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isDropdownOpen]);

  return (
    <div className={`hidden md:flex items-center ${compact ? 'gap-1.5' : 'gap-2'} relative z-30 select-none`}>
      {/* ─── WIDGET MINI-LECTEUR DEVANT LE BOUTON MÉLODIE (SI UN SON EST SÉLECTIONNÉ) ─── */}
      {currentTrack && (
        <div
          className={`flex items-center gap-1.5 sm:gap-2 ${compact ? 'px-2 py-0.5 rounded-xl border' : 'px-2.5 py-1 rounded-2xl border-2'} transition-all shadow-sm ${
            isDark
              ? 'bg-[#1e293b]/95 border-amber-500/50 text-white'
              : 'bg-[#FDFBF7] border-amber-500/60 text-stone-800 shadow-[1px_1px_0px_0px_#d97706]'
          }`}
        >
          {/* Bloc Titre + Bâtons d'égaliseur animés */}
          <div className={`flex flex-col min-w-0 ${compact ? 'max-w-[100px] sm:max-w-[125px]' : 'max-w-[125px] sm:max-w-[145px]'}`}>
            <div className="flex items-center gap-1 min-w-0">
              {/* Les 4 bâtons qui bougent quand la chanson joue et se figent à l'arrêt */}
              <div
                className={`flex items-end gap-0.5 ${compact ? 'h-3' : 'h-3.5'} px-0.5 shrink-0`}
                title={isAudioPlaying ? 'Lecture en cours' : 'En pause'}
              >
                <span
                  className={`w-0.5 rounded-full bg-amber-500 ${isAudioPlaying ? 'music-bar-1' : ''}`}
                  style={{
                    height: isAudioPlaying ? undefined : '3px',
                    animation: isAudioPlaying ? undefined : 'none',
                    animationPlayState: isAudioPlaying ? 'running' : 'paused'
                  }}
                />
                <span
                  className={`w-0.5 rounded-full bg-amber-400 ${isAudioPlaying ? 'music-bar-2' : ''}`}
                  style={{
                    height: isAudioPlaying ? undefined : '9px',
                    animation: isAudioPlaying ? undefined : 'none',
                    animationPlayState: isAudioPlaying ? 'running' : 'paused'
                  }}
                />
                <span
                  className={`w-0.5 rounded-full bg-yellow-400 ${isAudioPlaying ? 'music-bar-3' : ''}`}
                  style={{
                    height: isAudioPlaying ? undefined : '6px',
                    animation: isAudioPlaying ? undefined : 'none',
                    animationPlayState: isAudioPlaying ? 'running' : 'paused'
                  }}
                />
                <span
                  className={`w-0.5 rounded-full bg-amber-500 ${isAudioPlaying ? 'music-bar-4' : ''}`}
                  style={{
                    height: isAudioPlaying ? undefined : '2px',
                    animation: isAudioPlaying ? undefined : 'none',
                    animationPlayState: isAudioPlaying ? 'running' : 'paused'
                  }}
                />
              </div>

              <span
                className="text-[10px] sm:text-[11px] font-black truncate text-amber-600 dark:text-amber-300 leading-tight"
                title={currentTrack.name}
              >
                {currentTrack.name}
              </span>
            </div>

            {/* Commandes juste en bas du bâton : Précédent, Play/Pause, Suivant, Boucle, Croix */}
            <div className="flex items-center gap-1.5 mt-0.5">
              {/* Bouton Précédent */}
              <button
                type="button"
                onClick={handleAudioPrev}
                className="p-0.5 text-stone-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer active:scale-90"
                title="Piste précédente"
              >
                <SkipBack className="w-2.5 h-2.5 fill-current" />
              </button>

              {/* Bouton Play / Pause au centre */}
              <button
                type="button"
                onClick={togglePlayPause}
                className="w-4 h-4 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-stone-950 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-90"
                title={isAudioPlaying ? 'Mettre en pause' : 'Reprendre la lecture'}
              >
                {isAudioPlaying ? (
                  <Pause className="w-2.5 h-2.5 fill-current" />
                ) : (
                  <Play className="w-2.5 h-2.5 fill-current ml-0.5" />
                )}
              </button>

              {/* Bouton Suivant */}
              <button
                type="button"
                onClick={handleAudioNext}
                className="p-0.5 text-stone-500 dark:text-slate-300 hover:text-amber-500 dark:hover:text-amber-300 transition-colors cursor-pointer active:scale-90"
                title="Piste suivante"
              >
                <SkipForward className="w-2.5 h-2.5 fill-current" />
              </button>

              {/* Bouton Boucle */}
              <button
                type="button"
                onClick={toggleAudioRepeat}
                className={`p-0.5 transition-colors cursor-pointer relative active:scale-90 ${
                  isAudioRepeat !== 'off'
                    ? 'text-amber-500 dark:text-amber-400 font-black'
                    : 'text-stone-400 dark:text-slate-500 hover:text-stone-700 dark:hover:text-white'
                }`}
                title={
                  isAudioRepeat === 'one'
                    ? 'Boucle 1 titre activée'
                    : isAudioRepeat === 'all'
                    ? 'Boucle tous les titres activée'
                    : 'Boucle désactivée'
                }
              >
                <Repeat className="w-2.5 h-2.5 stroke-[2.2]" />
                {isAudioRepeat === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[6.5px] font-black text-amber-500">1</span>
                )}
              </button>

              {/* Bouton Croix pour tout fermer et enlever */}
              <button
                type="button"
                onClick={stopAndClose}
                className="p-0.5 text-stone-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 transition-colors cursor-pointer active:scale-90 ml-0.5"
                title="Fermer et arrêter la lecture"
              >
                <X className="w-2.5 h-2.5 stroke-[2.5]" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── BOUTON MÉLODIE (ORANGE BIEN DESSINÉ) AVEC SON DROPDOWN ─── */}
      <div className="flex flex-col items-center relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className={`${compact ? 'p-1 rounded-lg border-2' : 'p-1.5 sm:p-2 rounded-xl border-2'} transition-all cursor-pointer flex items-center justify-center active:scale-95 group relative ${
            isDropdownOpen
              ? 'bg-amber-500/20 text-amber-500 border-amber-500 shadow-sm ring-2 ring-amber-400/40'
              : isDark
              ? 'bg-[#1e293b] hover:bg-[#283852] text-amber-400 border-amber-500/50 shadow-sm'
              : 'bg-[#F5F1E9] hover:bg-amber-50 text-amber-600 border-amber-600 shadow-[1px_1px_0px_0px_#d97706]'
          }`}
          title="Musiques & sons de l'utilisateur"
        >
          {/* Logo mélodie bien dessiné orange */}
          <div className="relative flex items-center justify-center">
            <Music className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-amber-500 stroke-[2.4] drop-shadow-sm group-hover:scale-110 transition-transform`} />
            {isAudioPlaying && (
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            )}
          </div>
        </button>

        <span
          className={`${compact ? 'text-[7.5px] sm:text-[8px] font-black' : 'text-[10px] font-extrabold'} leading-none mt-0.5 ${
            dashboardWallpaper && viewMode === 'home'
              ? 'text-white drop-shadow-[0_1.5px_2px_rgba(0,0,0,0.9)]'
              : isDark
              ? 'text-white'
              : 'text-stone-700'
          }`}
        >
          Musique
        </span>

        {/* ─── PETIT MENU DÉROULANT SOUS LE BOUTON MÉLODIE ─── */}
        {isDropdownOpen && (
          <div
            className={`absolute top-full mt-2.5 right-0 z-50 w-72 max-h-80 overflow-hidden flex flex-col rounded-2xl border-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 ${
              isDarkMode
                ? 'bg-[#0f172a]/95 border-amber-500/50 text-white divide-y divide-slate-800'
                : 'bg-white/98 border-amber-500/70 text-stone-800 divide-y divide-stone-100 shadow-[0_15px_30px_rgba(217,119,6,0.15)]'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête du menu */}
            <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-amber-500/10 to-transparent">
              <div className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-amber-500 stroke-[2.3]" />
                <span className="text-xs font-black text-amber-600 dark:text-amber-400">
                  Mes sons ({audioList.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsDropdownOpen(false)}
                className="p-1 hover:bg-stone-200 dark:hover:bg-slate-800 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-white transition-colors cursor-pointer"
                title="Fermer"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {/* Liste scrollable des sons de la base D1 */}
            <div className="overflow-y-auto max-h-64 p-1.5 space-y-1">
              {audioList.length === 0 ? (
                <div className="py-8 text-center px-4">
                  <Disc3 className="w-8 h-8 text-amber-500/40 mx-auto mb-2 animate-spin-slow" />
                  <p className="text-xs font-bold text-stone-500 dark:text-slate-400">
                    Aucun son enregistré
                  </p>
                  <p className="text-[10px] text-stone-400 dark:text-slate-500 mt-0.5">
                    Importez des fichiers audio dans le menu Audio pour les écouter ici.
                  </p>
                </div>
              ) : (
                audioList.map((track) => {
                  const isThisTrack = currentTrack?.id === track.id;
                  const isPlayingThis = isThisTrack && isAudioPlaying;

                  return (
                    <div
                      key={track.id}
                      onClick={() => {
                        if (isThisTrack) {
                          togglePlayPause();
                        } else {
                          playTrack(track, audioList);
                        }
                      }}
                      className={`group flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left cursor-pointer transition-all border ${
                        isThisTrack
                          ? 'bg-amber-500/15 border-amber-400 dark:border-amber-500/60 shadow-sm'
                          : 'border-transparent hover:bg-amber-500/5 hover:border-amber-500/20'
                      }`}
                    >
                      {/* Vignette / icône musicale */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                            isThisTrack
                              ? 'bg-amber-500 text-stone-950 border-amber-400 shadow-sm'
                              : 'bg-stone-100 dark:bg-slate-800 text-amber-500 border-amber-500/20 group-hover:border-amber-500/50'
                          }`}
                        >
                          {isPlayingThis ? (
                            <div className="flex items-end gap-0.5 h-3 px-0.5">
                              <span className="w-0.5 rounded-full bg-stone-950 music-bar-1" />
                              <span className="w-0.5 rounded-full bg-stone-950 music-bar-2" />
                              <span className="w-0.5 rounded-full bg-stone-950 music-bar-3" />
                            </div>
                          ) : (
                            <Music className="w-3.5 h-3.5 stroke-[2.2]" />
                          )}
                        </div>

                        {/* Nom + détails */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs font-bold truncate leading-tight ${
                              isThisTrack ? 'text-amber-600 dark:text-amber-300' : 'text-stone-800 dark:text-slate-200'
                            }`}
                          >
                            {track.name}
                          </p>
                          <p className="text-[10px] text-stone-400 dark:text-slate-400 truncate mt-0.5">
                            {track.artist || track.size || 'Audio'}
                          </p>
                        </div>
                      </div>

                      {/* Bouton Play/Pause sur chaque ligne */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isThisTrack) {
                            togglePlayPause();
                          } else {
                            playTrack(track, audioList);
                          }
                        }}
                        className={`w-6 h-6 rounded-full flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                          isPlayingThis
                            ? 'bg-amber-500 text-stone-950 shadow-sm'
                            : 'bg-stone-200/70 dark:bg-slate-800 text-stone-700 dark:text-slate-300 hover:bg-amber-500 hover:text-stone-950'
                        }`}
                        title={isPlayingThis ? 'Pause' : 'Lire'}
                      >
                        {isPlayingThis ? (
                          <Pause className="w-3 h-3 fill-current" />
                        ) : (
                          <Play className="w-3 h-3 fill-current ml-0.5" />
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
