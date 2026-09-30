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

import { CloudDataStore, FileItem } from '../services/cloudDataStore';
import { CloudStorageAPI } from '../services/cloudStorageService';

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

const MONTH_MAP: Record<string, number> = {
  'janv': 0, 'janvier': 0, 'jan': 0,
  'févr': 1, 'février': 1, 'fevr': 1, 'fevrier': 1, 'feb': 1,
  'mars': 2, 'mar': 2,
  'avr': 3, 'avril': 3, 'apr': 3,
  'mai': 4, 'may': 4,
  'juin': 5, 'jun': 5,
  'juil': 6, 'juillet': 6, 'jul': 6,
  'août': 7, 'aout': 7, 'aug': 7,
  'sept': 8, 'septembre': 8, 'sep': 8,
  'oct': 9, 'octobre': 9,
  'nov': 10, 'novembre': 10,
  'déc': 11, 'décembre': 11, 'dec': 11, 'decembre': 11
};

export function getFileTimestamp(item: any): number {
  if (!item) return 0;

  // 1. Champs temporels directs (numériques ou chaînes ISO)
  for (const field of ['timestamp', 'importedAt', 'createdAt', 'created_at', 'updated_at', 'last_imported', 'lastModified', 'downloadedAt']) {
    const val = item[field];
    if (typeof val === 'number' && !isNaN(val) && val > 0) {
      return val < 10000000000 ? val * 1000 : val;
    }
    if (typeof val === 'string' && val.trim()) {
      const parsed = Date.parse(val);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 2. Timestamp milliseconde incrusté dans l'identifiant (ex: doc-1790781234567 ou 1790781234567)
  if (item.id && typeof item.id === 'string') {
    const match = item.id.match(/1[6-9]\d{11,12}/);
    if (match) {
      const parsed = parseInt(match[0], 10);
      if (!isNaN(parsed) && parsed > 1000000000000) return parsed;
    }
  }

  // 3. Date incluse dans le nom du fichier (ex: Screenshot_20260930_103941 ou 2026-09-30)
  if (item.name && typeof item.name === 'string') {
    const matchDate = item.name.match(/20\d{2}[-_]?(0[1-9]|1[0-2])[-_]?([0-2][0-9]|3[01])(?:[-_]?([01][0-9]|2[0-3])([0-5][0-9])([0-5][0-9]))?/);
    if (matchDate) {
      const full = matchDate[0].replace(/[-_]/g, '');
      if (full.length >= 8) {
        const year = parseInt(full.substring(0, 4), 10);
        const month = parseInt(full.substring(4, 6), 10) - 1;
        const day = parseInt(full.substring(6, 8), 10);
        const hour = full.length >= 10 ? parseInt(full.substring(8, 10), 10) : 12;
        const min = full.length >= 12 ? parseInt(full.substring(10, 12), 10) : 0;
        const sec = full.length >= 14 ? parseInt(full.substring(12, 14), 10) : 0;
        const d = new Date(year, month, day, hour, min, sec).getTime();
        if (!isNaN(d) && d > 0) return d;
      }
    }
  }

  // 4. Analyse des dates textuelles en français dans le champ `date`
  if (item.date && typeof item.date === 'string') {
    const raw = item.date.trim().toLowerCase();

    // "À l'instant", "À l’instant"
    if (raw.includes("l'instant") || raw.includes("l’instant")) {
      return Date.now();
    }

    // "Aujourd'hui, 14:30" ou "Aujourd'hui"
    if (raw.includes("aujourd'hui") || raw.includes("aujourd’hui")) {
      const now = new Date();
      const timeMatch = raw.match(/(\d{1,2})[:h](\d{2})/);
      if (timeMatch) {
        now.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      }
      return now.getTime();
    }

    // "Hier, 10:15" ou "Hier"
    if (raw.includes("hier")) {
      const yesterday = new Date(Date.now() - 86400000);
      const timeMatch = raw.match(/(\d{1,2})[:h](\d{2})/);
      if (timeMatch) {
        yesterday.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
      }
      return yesterday.getTime();
    }

    // "Il y a X jours"
    const daysAgoMatch = raw.match(/il y a (\d+)\s*jour/);
    if (daysAgoMatch) {
      const days = parseInt(daysAgoMatch[1], 10);
      return Date.now() - days * 86400000;
    }

    // Date "DD/MM/YYYY" ou "DD-MM-YYYY" ou "DD.MM.YYYY"
    const dm = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (dm) {
      const d = new Date(parseInt(dm[3], 10), parseInt(dm[2], 10) - 1, parseInt(dm[1], 10)).getTime();
      if (!isNaN(d) && d > 0) return d;
    }

    // Date "DD [mois] YYYY" (ex: "30 sept. 2026", "25 septembre 2026")
    const frMatch = raw.match(/^(\d{1,2})\s+([a-zéû.]+)\s+(\d{4})/);
    if (frMatch) {
      const day = parseInt(frMatch[1], 10);
      const mStr = frMatch[2].replace('.', '').toLowerCase();
      const year = parseInt(frMatch[3], 10);
      const month = MONTH_MAP[mStr];
      if (month !== undefined) {
        const d = new Date(year, month, day, 12, 0, 0).getTime();
        if (!isNaN(d) && d > 0) return d;
      }
    }

    // Fallback ISO standard
    const stdParsed = Date.parse(item.date);
    if (!isNaN(stdParsed) && stdParsed > 0) return stdParsed;
  }

  return 0;
}

export const parseDateToTime = getFileTimestamp;

export function isItemPinned(item: any): boolean {
  if (!item) return false;
  if (item.isPinned === true || item.is_pinned === true || item.is_pinned === 1) return true;
  if (!item.id) return false;

  try {
    const pinSet = CloudDataStore.getState()?.pinIdSet;
    if (pinSet && pinSet.has(item.id)) return true;
  } catch {}

  try {
    const rawLocal = localStorage.getItem('studycloud_pinned_ids');
    if (rawLocal) {
      const arr = JSON.parse(rawLocal);
      if (Array.isArray(arr) && arr.includes(item.id)) return true;
    }
  } catch {}

  return false;
}

export function getAllDatabaseFiles(): any[] {
  const allFiles: any[] = [];
  const seenIds = new Set<string>();

  const addItems = (arr: any[]) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (item && item.id && !seenIds.has(item.id)) {
        seenIds.add(item.id);
        allFiles.push(item);
      }
    }
  };

  try {
    const store = CloudDataStore.getState();
    addItems(store.documents || []);
    addItems(store.images || []);
    addItems(store.videos || []);
    addItems(store.audio || []);
    addItems(store.downloads || []);
    addItems(store.secure || []);
    addItems(store.trash || []);
    addItems(store.recentFiles || []);
    if (store.folderFilesMap) {
      for (const folderList of Object.values(store.folderFilesMap)) {
        addItems(folderList);
      }
    }
  } catch {}

  try {
    const userFiles = JSON.parse(localStorage.getItem('unifolder_user_files') || '[]');
    addItems(userFiles);
  } catch {}

  try {
    const menuItems = JSON.parse(localStorage.getItem('unifolder_files_menu_items') || '[]');
    addItems(menuItems);
  } catch {}

  return allFiles;
}

export function isDuplicateFile(file: any, comparisonPool?: any[]): boolean {
  if (!file || !file.name) return false;

  const pool = comparisonPool && comparisonPool.length > 0 ? comparisonPool : getAllDatabaseFiles();

  const normalizeName = (str: string): string => {
    return str
      .trim()
      .toLowerCase()
      .replace(/\s*-\s*copie(\s*\(\d+\))?(\.[^.]*)?$/i, '$2')
      .replace(/\s*\(\d+\)(\.[^.]*)?$/i, '$1')
      .trim();
  };

  const exactName = file.name.trim().toLowerCase();
  const baseName = normalizeName(file.name);
  const sizeBytes = parseSizeToBytes(file.size, file.sizeBytes);
  const ext = (file.extension || file.name.split('.').pop() || '').trim().toLowerCase();

  for (const other of pool) {
    if (other.id === file.id) continue;
    if (!other.name) continue;

    const otherExact = other.name.trim().toLowerCase();
    const otherBase = normalizeName(other.name);
    const otherBytes = parseSizeToBytes(other.size, other.sizeBytes);
    const otherExt = (other.extension || other.name.split('.').pop() || '').trim().toLowerCase();

    // 1. Nom de fichier strictement identique
    if (otherExact === exactName) {
      return true;
    }

    // 2. Nom de base identique après suppression de suffixes (ex: fichier (1).pdf vs fichier.pdf ou - Copie)
    if (baseName.length >= 3 && otherBase === baseName) {
      return true;
    }

    // 3. Même taille en octets (> 100 octets) et même extension
    if (sizeBytes > 100 && otherBytes > 100 && sizeBytes === otherBytes && ext && ext === otherExt) {
      return true;
    }

    // 4. Même clé R2 distante ou URL cloud
    if (file.r2Key && other.r2Key && file.r2Key === other.r2Key) {
      return true;
    }
    if (file.url && other.url && file.url === other.url && !file.url.startsWith('blob:')) {
      return true;
    }
  }

  return false;
}

export function applyFileSorting<T extends { name: string; size?: string; sizeBytes?: number; date?: string; isPinned?: boolean; id: string; extension?: string }>(
  list: T[],
  sortOption: SortOption,
  comparisonPool?: any[]
): T[] {
  let result = [...list];

  if (sortOption === 'pinned') {
    const withIndex = result.map((item, idx) => ({
      item,
      idx,
      pinned: isItemPinned(item),
      t: getFileTimestamp(item)
    }));

    withIndex.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      if (a.t > 0 && b.t > 0 && a.t !== b.t) return b.t - a.t;
      return a.idx - b.idx;
    });

    return withIndex.map(x => x.item);
  } else if (sortOption === 'duplicates') {
    const pool = comparisonPool && comparisonPool.length > 0 ? comparisonPool : getAllDatabaseFiles();
    const dupes = list.filter(item => isDuplicateFile(item, pool));

    // Regrouper les doublons côte à côte
    dupes.sort((a, b) => {
      const nA = a.name.trim().toLowerCase().replace(/\s*-\s*copie.*$/i, '').replace(/\s*\(\d+\).*$/i, '');
      const nB = b.name.trim().toLowerCase().replace(/\s*-\s*copie.*$/i, '').replace(/\s*\(\d+\).*$/i, '');
      if (nA === nB) return a.name.localeCompare(b.name);
      return nA.localeCompare(nB);
    });

    return dupes;
  } else if (sortOption === 'size-desc') {
    result.sort((a, b) => parseSizeToBytes(b.size, b.sizeBytes) - parseSizeToBytes(a.size, a.sizeBytes));
  } else if (sortOption === 'oldest') {
    const withIndex = result.map((item, idx) => ({
      item,
      idx,
      t: getFileTimestamp(item)
    }));

    withIndex.sort((a, b) => {
      if (a.t > 0 && b.t > 0 && a.t !== b.t) {
        return a.t - b.t; // plus ancien d'abord
      }
      if (a.t > 0 && b.t === 0) return -1;
      if (a.t === 0 && b.t > 0) return 1;
      // Si pas de timestamp différent, inverser l'ordre initial garanti
      return b.idx - a.idx;
    });

    return withIndex.map(x => x.item);
  } else {
    // 'recent'
    const withIndex = result.map((item, idx) => ({
      item,
      idx,
      t: getFileTimestamp(item)
    }));

    withIndex.sort((a, b) => {
      if (a.t > 0 && b.t > 0 && a.t !== b.t) {
        return b.t - a.t; // plus récent d'abord
      }
      if (a.t > 0 && b.t === 0) return -1;
      if (a.t === 0 && b.t > 0) return 1;
      return a.idx - b.idx;
    });

    return withIndex.map(x => x.item);
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
    if (option === 'duplicates') {
      CloudDataStore.sync(true).catch(() => {});
    } else if (option === 'pinned') {
      CloudStorageAPI.getPinned().catch(() => {});
    }
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
