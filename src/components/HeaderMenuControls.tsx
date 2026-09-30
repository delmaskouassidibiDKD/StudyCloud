import React, { useState, useEffect, useRef } from 'react';
import {
  Maximize2,
  Minimize2,
  Menu,
  Clock,
  Pin,
  Copy,
  HardDrive,
  RotateCcw,
  Check,
  X
} from 'lucide-react';

export type SortOption = 'recent' | 'oldest' | 'pinned' | 'duplicates' | 'size-desc';

export interface HeaderMenuControlsProps {
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  sortOption: SortOption;
  onSortChange: (option: SortOption) => void;
  isImageMenu?: boolean;
  onRestoreWallpaper?: () => void;
  extraMenuItems?: React.ReactNode;
  className?: string;
}

export function parseSizeToBytes(sizeStr?: string | number, sizeBytes?: number): number {
  if (typeof sizeBytes === 'number' && !isNaN(sizeBytes) && sizeBytes > 0) return sizeBytes;
  if (typeof sizeStr === 'number') return sizeStr;
  if (!sizeStr || typeof sizeStr !== 'string') return 0;
  const cleaned = sizeStr.trim().replace(',', '.');
  const match = cleaned.match(/^([\d.]+)\s*([a-zA-Z]+)?$/);
  if (!match) return 0;
  const val = parseFloat(match[1]);
  if (isNaN(val)) return 0;
  const unit = (match[2] || '').toLowerCase();
  if (unit.startsWith('g')) return val * 1024 * 1024 * 1024;
  if (unit.startsWith('m')) return val * 1024 * 1024;
  if (unit.startsWith('k')) return val * 1024;
  return val;
}

export function parseDateToTime(dateStr?: string, timestamp?: number): number {
  if (typeof timestamp === 'number' && !isNaN(timestamp)) return timestamp;
  if (!dateStr) return 0;
  const parsed = Date.parse(dateStr);
  if (!isNaN(parsed)) return parsed;
  const dm = dateStr.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dm) {
    return new Date(parseInt(dm[3], 10), parseInt(dm[2], 10) - 1, parseInt(dm[1], 10)).getTime();
  }
  return 0;
}

export function isDuplicateFile(file: any, allFiles: any[]): boolean {
  if (!file || !file.name) return false;
  const cleanName = (str: string) => {
    return str.trim().toLowerCase().replace(/\s*\(\d+\)(\.[^.]*)?$/, '$1').replace(/\s*-\s*copie(\.[^.]*)?$/, '$1');
  };
  const exactName = file.name.trim().toLowerCase();
  const baseName = cleanName(file.name);
  const sizeStr = file.size?.trim().toLowerCase();

  for (const f of allFiles) {
    if (f.id === file.id) continue;
    const otherExact = f.name?.trim().toLowerCase();
    const otherBase = f.name ? cleanName(f.name) : '';
    const otherSize = f.size?.trim().toLowerCase();

    if (otherExact === exactName) return true;
    if (otherBase === baseName && baseName.length > 3) return true;
    if (sizeStr && sizeStr !== '0 b' && sizeStr !== '0 ko' && otherSize === sizeStr && file.extension && f.extension && file.extension.toLowerCase() === f.extension.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export function applyFileSorting<T extends { name: string; size?: string; sizeBytes?: number; date?: string; isPinned?: boolean; id: string; extension?: string }>(
  list: T[],
  sortOption: SortOption
): T[] {
  let result = [...list];

  if (sortOption === 'pinned') {
    result.sort((a, b) => {
      const pA = Boolean(a.isPinned);
      const pB = Boolean(b.isPinned);
      if (pA && !pB) return -1;
      if (!pA && pB) return 1;
      return 0;
    });
  } else if (sortOption === 'duplicates') {
    const dupes = list.filter(item => isDuplicateFile(item, list));
    dupes.sort((a, b) => {
      const nA = a.name.trim().toLowerCase().replace(/\s*\(\d+\)(\.[^.]*)?$/, '$1');
      const nB = b.name.trim().toLowerCase().replace(/\s*\(\d+\)(\.[^.]*)?$/, '$1');
      if (nA === nB) return a.name.localeCompare(b.name);
      return nA.localeCompare(nB);
    });
    return dupes;
  } else if (sortOption === 'size-desc') {
    result.sort((a, b) => parseSizeToBytes(b.size, b.sizeBytes) - parseSizeToBytes(a.size, a.sizeBytes));
  } else if (sortOption === 'oldest') {
    result.sort((a, b) => {
      const tA = parseDateToTime(a.date, (a as any).timestamp || (a as any).createdAt);
      const tB = parseDateToTime(b.date, (b as any).timestamp || (b as any).createdAt);
      if (tA && tB && tA !== tB) return tA - tB;
      return 0;
    });
  } else {
    // 'recent'
    result.sort((a, b) => {
      const tA = parseDateToTime(a.date, (a as any).timestamp || (a as any).createdAt);
      const tB = parseDateToTime(b.date, (b as any).timestamp || (b as any).createdAt);
      if (tA && tB && tA !== tB) return tB - tA;
      return 0;
    });
  }

  return result;
}

export function restoreDefaultWallpaperAndAvatar(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('studycloud_dashboard_wallpaper');
    localStorage.removeItem('unifolder_user_avatar');
  } catch {}
  window.dispatchEvent(new CustomEvent('studycloud_wallpaper_updated', { detail: { wallpaper: null } }));
  window.dispatchEvent(new CustomEvent('studycloud_avatar_updated', { detail: { avatar: null } }));
}

export const HeaderMenuControls: React.FC<HeaderMenuControlsProps> = ({
  isFullscreen = false,
  onToggleFullscreen,
  sortOption,
  onSortChange,
  isImageMenu = false,
  onRestoreWallpaper,
  extraMenuItems,
  className = ''
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => document.removeEventListener('pointerdown', handleOutsideClick);
  }, [isMenuOpen]);

  const handleSelectSort = (option: SortOption) => {
    onSortChange(option);
    setIsMenuOpen(false);
  };

  const handleRestore = () => {
    restoreDefaultWallpaperAndAvatar();
    if (onRestoreWallpaper) {
      onRestoreWallpaper();
    }
    setIsMenuOpen(false);
  };

  return (
    <div ref={containerRef} className={`flex items-center gap-1.5 sm:gap-2 shrink-0 relative ${className}`}>
      {/* 1. BOUTON PLEIN ÉCRAN (IDENTIQUE À CELUI ENTOURÉ EN ROUGE À L'ACCUEIL) */}
      <button
        type="button"
        onClick={onToggleFullscreen}
        className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full bg-[#04060A] hover:bg-[#0A0E18] text-white border border-white/10 transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm"
        title={isFullscreen ? "Quitter le plein écran" : "Plein écran complet (Prendre tout l'écran)"}
      >
        {isFullscreen ? (
          <Minimize2 className="w-4 h-4 stroke-[2.2]" />
        ) : (
          <Maximize2 className="w-4 h-4 stroke-[2.2]" />
        )}
      </button>

      {/* 2. BOUTON 3 TRAITS DERRIÈRE LUI (MENU D'OPTIONS & TRI) */}
      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsMenuOpen(!isMenuOpen);
          }}
          className={`flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full transition-all cursor-pointer shrink-0 active:scale-95 shadow-sm border ${
            isMenuOpen
              ? 'bg-amber-500/20 text-amber-400 border-amber-400/40'
              : 'bg-[#04060A] hover:bg-[#0A0E18] text-white border-white/10'
          }`}
          title="Options de tri et d'affichage (3 traits)"
        >
          <Menu className="w-4 h-4 stroke-[2.2]" />
        </button>

        {/* 3. MENU DROPDOWN D'OPTIONS ET DE TRI */}
        {isMenuOpen && (
          <div
            className="studycloud-file-menu-panel absolute right-0 top-11 sm:top-12 z-50 w-64 bg-[#0A0F1D] border-2 border-slate-500/90 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.98),0_0_0_1px_rgba(255,255,255,0.15)] text-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête du menu */}
            <div className="px-3.5 py-2.5 bg-slate-900 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
              <div>
                <p className="text-[11px] font-black text-white">Options de tri & Affichage</p>
                <p className="text-[9px] font-semibold text-slate-400">StudyCloud</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
                title="Fermer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Liste des options */}
            <div className="py-1 divide-y divide-white/5">
              {/* Éléments additionnels (si spécifiés) */}
              {extraMenuItems && (
                <div className="py-1">
                  {extraMenuItems}
                </div>
              )}

              {/* Options de tri */}
              <div className="py-1">
                {/* 1. Trier récent */}
                <button
                  type="button"
                  onClick={() => handleSelectSort('recent')}
                  className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                    sortOption === 'recent'
                      ? 'bg-blue-600/20 text-blue-400 font-bold'
                      : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                    <span>Trier par plus récent</span>
                  </div>
                  {sortOption === 'recent' && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                </button>

                {/* 2. Plus ancien */}
                <button
                  type="button"
                  onClick={() => handleSelectSort('oldest')}
                  className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                    sortOption === 'oldest'
                      ? 'bg-purple-600/20 text-purple-400 font-bold'
                      : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-3.5 h-3.5 shrink-0 text-purple-400" />
                    <span>Plus ancien</span>
                  </div>
                  {sortOption === 'oldest' && <Check className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                </button>

                {/* 3. Épinglés */}
                <button
                  type="button"
                  onClick={() => handleSelectSort('pinned')}
                  className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                    sortOption === 'pinned'
                      ? 'bg-amber-600/20 text-amber-400 font-bold'
                      : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Pin className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                    <span>Épinglés en premier</span>
                  </div>
                  {sortOption === 'pinned' && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>

                {/* 4. Fichiers doublons */}
                <button
                  type="button"
                  onClick={() => handleSelectSort('duplicates')}
                  className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                    sortOption === 'duplicates'
                      ? 'bg-indigo-600/20 text-indigo-400 font-bold'
                      : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Copy className="w-3.5 h-3.5 shrink-0 text-indigo-400" />
                    <span>Fichiers doublons</span>
                  </div>
                  {sortOption === 'duplicates' && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                </button>

                {/* 5. Trier par plus lourd */}
                <button
                  type="button"
                  onClick={() => handleSelectSort('size-desc')}
                  className={`w-full px-3 py-2 flex items-center justify-between text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer text-left ${
                    sortOption === 'size-desc'
                      ? 'bg-orange-600/20 text-orange-400 font-bold'
                      : 'text-slate-100 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <HardDrive className="w-3.5 h-3.5 shrink-0 text-orange-400" />
                    <span>Trier par plus lourd (taille)</span>
                  </div>
                  {sortOption === 'size-desc' && <Check className="w-3.5 h-3.5 text-orange-400 shrink-0" />}
                </button>
              </div>

              {/* 6. Spécialement pour le menu Image : Restaurer le fond d'écran */}
              {isImageMenu && (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={handleRestore}
                    className="w-full px-3 py-2 flex items-center gap-2.5 text-[11px] sm:text-xs font-semibold text-rose-400 hover:bg-rose-500/15 transition-colors cursor-pointer text-left"
                  >
                    <RotateCcw className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                    <span>Restaurer le fond d'écran</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
