import React, { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  MessageSquare,
  Users2,
  Layers,
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Search,
  Plus,
  X,
  Check,
  Calendar,
  Sparkles,
  Trash2,
  Pencil,
  AlertTriangle,
  School,
  FolderPlus,
  Upload,
  Building2,
  BookOpen,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Copy,
  Maximize2,
  Minimize2,
  Cloud,
  CloudOff,
  Loader2,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { ViewerSuperExpandButton } from '../ViewerSuperExpandButton';
import { DnaLogo } from '../DnaLogo';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../../utils/viewerExpandManager';
import { SubjectGradebookView } from './SubjectGradebookView';
import { ClassAverageSheetView } from './ClassAverageSheetView';
import { SchoolWorkspaceLayout } from './SchoolWorkspaceLayout';
import { TeacherTransferView } from './TeacherTransferView';
import { TeacherAnimatedBackground } from './TeacherAnimatedBackground';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import { useAuth } from '../../context/AuthContext';
import {
  TeacherGradebookAPI,
  generateTeacherEntityId,
  getTeacherAuthToken,
  readUserBootstrapCache,
  writeUserBootstrapCache,
  clearLegacyUnscopedTeacherData,
  clearUserGradebookCaches,
  isOfflineOrNetworkError,
} from '../../services/teacherGradebookApi';
import type { GradebookInspection } from '../../utils/teacherTransferEngine';
import {
  readTeacherNavSnapshot,
  writeTeacherNavSnapshot,
  resolveTeacherNavSnapshot,
  paginateTeacherSchools,
  getTeacherSchoolPageForIndex,
  TEACHER_SCHOOLS_PER_PAGE,
  type TeacherNavSnapshot,
  type TeacherDashboardTab,
} from '../../utils/teacherNavPersistence';

export type CardColorStyle = 'accent' | 'full';

export interface SchoolYearItem {
  id: string;
  label: string; // ex: "2026 - 2027"
  color: string; // hex ou 'white'
  textColor?: string;
  colorStyle?: CardColorStyle;
  createdAt: number;
}

export interface SchoolItem {
  id: string;
  yearId: string; // Attache l'école à la rentrée scolaire sélectionnée
  name: string; // Nom de l'école (requis)
  logoUrl?: string; // Logo de l'école (URL signée R2 ou aperçu temporaire)
  logoR2Key?: string; // Clé privée R2 (teacher-school-logos/{user_id}/...)
  color: string; // hex couleur de la carte
  textColor: string;
  borderColor: string;
  borderDarkColor: string; // pour l'effet 3D en bas
  colorStyle?: CardColorStyle;
  createdAt: number;
}

export interface StudyLevelItem {
  id: string;
  schoolId: string; // Attache le niveau d'étude à l'école sélectionnée
  yearId: string; // Attache à l'année scolaire sélectionnée
  name: string; // ex: "CP1", "6ème", "2nde", "Terminale", "Licence 1" (requis)
  color?: string; // Couleur d'accent du bouton mince rectangulaire
  textColor?: string;
  borderColor?: string;
  colorStyle?: CardColorStyle;
  createdAt: number;
}

export interface ClassItem {
  id: string;
  levelId?: string; // Attache la classe au niveau d'étude sélectionné
  schoolId: string; // Attache la classe à l'école sélectionnée
  yearId: string; // Attache à l'année scolaire sélectionnée
  level: string; // Nom du niveau d'étude parent (ex: "CP1", "2nde", "Terminale")
  name?: string; // Nom de la classe donné par l'utilisateur (ex: "2nde C1", "Classe A", "Groupe 1")
  slogan?: string; // ex: "Rigueur et Succès" (facultatif)
  teacherName: string; // ex: "M. Delmas Kouassi" (requis)
  subject?: string; // facultatif
  color: string; // hex
  textColor: string;
  borderColor: string;
  borderDarkColor: string;
  colorStyle?: CardColorStyle;
  iconGradient: string;
  mentionRules?: Array<{ min: number; label: string; scale?: number }> | null;
  showMatricule?: boolean;
  averageScale?: number;
  columnOrder?: { left: string[]; right: string[] } | null;
  createdAt: number;
}

const getClassDisplayName = (cls: ClassItem): string => {
  return cls.name?.trim() ? cls.name.trim() : cls.level;
};

const getClassFullLabel = (cls: ClassItem): string => {
  const cname = cls.name?.trim();
  if (!cname) return cls.level;
  if (cname.toLowerCase().includes(cls.level.trim().toLowerCase())) return cname;
  return `${cls.level} • ${cname}`;
};

export interface TermItem {
  id: string;
  classId: string; // Attache le trimestre à sa classe
  schoolId: string;
  yearId: string;
  number: number; // 1, 2, 3, 4...
  name: string; // ex: "Trimestre 1", "Trimestre 2"...
  coefficient?: number; // Coefficient du trimestre (facultatif, ex: 1, 2, 3)
  createdAt: number;
}

export interface SubjectItem {
  id: string;
  classId: string; // Attache la matière à la classe sélectionnée
  termId?: string; // Attache la matière au trimestre sélectionné de la classe
  schoolId: string; // Attache à l'école
  yearId: string; // Attache à l'année scolaire
  name: string; // Nom de la matière (ex: Mathématiques)
  coefficient?: number; // Coefficient (facultatif, ex: 3, 2, 1)
  color: string; // hex couleur (Blanc par défaut si non choisi)
  textColor: string;
  borderColor: string;
  borderDarkColor: string;
  colorStyle?: CardColorStyle;
  createdAt: number;
}

/**
 * Sélecteur visuel du mode d'application de la couleur (Bande latérale vs Carte complète).
 * Proposé dans chaque menu/modale disposant d'une palette de couleurs.
 */
const ColorStyleSelector: React.FC<{
  value: CardColorStyle;
  onChange: (next: CardColorStyle) => void;
  accentHex: string;
  isWhiteColor: boolean;
  compact?: boolean;
}> = ({ value, onChange, accentHex, isWhiteColor, compact = false }) => {
  const visualHex = isWhiteColor ? '#2563eb' : accentHex;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          Style de couleur
        </span>
        {isWhiteColor && (
          <span className="text-[9.5px] font-medium text-slate-400 dark:text-slate-400">
            Actif dès qu&apos;une couleur est choisie
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {/* Option 1 : Version actuelle (Bande latérale colorée) */}
        <button
          type="button"
          onClick={() => onChange('accent')}
          className={`group relative rounded-xl border text-left transition cursor-pointer ${
            compact ? 'p-2' : 'p-2.5'
          } ${
            value === 'accent'
              ? 'border-[#0051c3] dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-[#0051c3]/40'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0f172a] hover:border-slate-400 dark:hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Miniature visuelle : carte blanche avec barre latérale colorée */}
            <div className="relative w-9 h-7 rounded-md bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-500 overflow-hidden shrink-0 flex flex-col justify-center gap-1 pl-2 pr-1.5">
              <span
                className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                style={{ backgroundColor: visualHex }}
              />
              <span className="w-full h-1 rounded-full bg-slate-400/80 dark:bg-slate-400/70" />
              <span className="w-2/3 h-1 rounded-full bg-slate-300 dark:bg-slate-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight truncate">
                Bande latérale
              </div>
              {!compact && (
                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate">
                  Style actuel
                </div>
              )}
            </div>
          </div>
          {value === 'accent' && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#0051c3] dark:bg-blue-500 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          )}
        </button>

        {/* Option 2 : Ancienne version (Toute la carte colorée) */}
        <button
          type="button"
          onClick={() => onChange('full')}
          className={`group relative rounded-xl border text-left transition cursor-pointer ${
            compact ? 'p-2' : 'p-2.5'
          } ${
            value === 'full'
              ? 'border-[#0051c3] dark:border-blue-400 bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-[#0051c3]/40'
              : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#0f172a] hover:border-slate-400 dark:hover:border-slate-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {/* Miniature visuelle : carte entièrement remplie de couleur */}
            <div
              className="w-9 h-7 rounded-md border border-black/15 overflow-hidden shrink-0 flex flex-col justify-center gap-1 px-1.5"
              style={{ backgroundColor: visualHex }}
            >
              <span className="w-full h-1 rounded-full bg-white/90" />
              <span className="w-2/3 h-1 rounded-full bg-white/60" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight truncate">
                Carte complète
              </div>
              {!compact && (
                <div className="text-[9.5px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5 truncate">
                  Tout coloré
                </div>
              )}
            </div>
          </div>
          {value === 'full' && (
            <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#0051c3] dark:bg-blue-500 text-white flex items-center justify-center">
              <Check className="w-2.5 h-2.5 stroke-[3]" />
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

/**
 * Sélecteur compact "Un seul" vs "Créer plusieurs" présent dans chaque menu de création.
 */
const CreationModeToggle: React.FC<{
  mode: 'single' | 'batch';
  onChange: (next: 'single' | 'batch') => void;
  singleLabel: string;
  batchLabel: string;
  batchCount?: number;
}> = ({ mode, onChange, singleLabel, batchLabel, batchCount }) => (
  <div className="inline-flex w-full p-1 rounded-xl bg-slate-100 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 gap-1 select-none">
    <button
      type="button"
      onClick={() => onChange('single')}
      className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
        mode === 'single'
          ? 'bg-white dark:bg-[#1e293b] text-slate-900 dark:text-white shadow-xs border border-slate-200/90 dark:border-slate-600'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
      }`}
    >
      <span>{singleLabel}</span>
    </button>
    <button
      type="button"
      onClick={() => onChange('batch')}
      className={`flex-1 py-1.5 px-2.5 rounded-lg text-[11px] font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
        mode === 'batch'
          ? 'bg-[#00313d] dark:bg-blue-600 text-white shadow-xs border border-[#00313d] dark:border-blue-500'
          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 border border-transparent'
      }`}
    >
      <Layers className="w-3.5 h-3.5 shrink-0" />
      <span>{batchLabel}</span>
      {mode === 'batch' && typeof batchCount === 'number' && batchCount > 0 && (
        <span className="px-1.5 py-0.2 rounded-full bg-white/20 text-white text-[10px] font-black">
          {batchCount}
        </span>
      )}
    </button>
  </div>
);

const compressLogoFileToDataUrl = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () => resolve(null);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => resolve(null);
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else if (height > MAX_SIZE) {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png', 0.85));
      };
      img.src = String(event.target?.result || '');
    };
    reader.readAsDataURL(file);
  });

const makeBatchRowUid = () => `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

export interface ClassAverageCardItem {
  id: string;
  classId: string;
  termId?: string; // Absent pour la carte annuelle ("Moyenne générale de l'année"), présent pour chaque trimestre
  schoolId: string;
  yearId: string;
  kind: 'annual' | 'term';
  title: string;
  sortOrder: number;
  color: string;
  textColor: string;
  borderColor: string;
  borderDarkColor: string;
  createdAt: number;
}

interface TeacherClassesViewProps {
  onBack: () => void;
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
}

// Couleurs proposées pour la rentrée scolaire
const YEAR_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc (Défaut)', bg: '#ffffff', text: '#0f172a', border: '#cbd5e1' },
  { id: 'teal', label: 'Pétrole / Lagon', bg: '#00313d', text: '#ffffff', border: '#00252e' },
  { id: 'blue', label: 'Bleu Roi', bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490' },
  { id: 'emerald', label: 'Émeraude', bg: '#059669', text: '#ffffff', border: '#047857' },
  { id: 'orange', label: 'Orange Ambré', bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  { id: 'rose', label: 'Rose Framboise', bg: '#db2777', text: '#ffffff', border: '#be185d' },
  { id: 'purple', label: 'Violet Sombre', bg: '#7c3aed', text: '#ffffff', border: '#6d28d9' },
  { id: 'gold', label: 'Or / Safran', bg: '#d97706', text: '#ffffff', border: '#b45309' },
  { id: 'red', label: 'Rouge Écarlate', bg: '#dc2626', text: '#ffffff', border: '#b91c1c' },
];

// Style lumineux éclatant pour les éléments sélectionnés (inspiré des halos de la barre latérale gauche, plus lumineux et jamais noir)
interface LuminousSelectionTheme {
  bg: string;
  border: string;
  shadow: string;
  aura: string;
  dot: string;
  dotShadow: string;
  text: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

const getLuminousLevelTheme = (colorHex?: string): LuminousSelectionTheme => {
  switch ((colorHex || '').toLowerCase()) {
    case '#2563eb': // Bleu Roi
      return {
        bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 55%, #e0f2fe 100%)',
        border: '#3b82f6',
        shadow: '0 0 0 2px rgba(96, 165, 250, 0.6), 0 0 18px 4px rgba(59, 130, 246, 0.6), 0 0 32px 0px rgba(96, 165, 250, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(96, 165, 250, 0.7) 0%, transparent 72%)',
        dot: '#3b82f6',
        dotShadow: '0 0 10px 2px rgba(59, 130, 246, 0.95)',
        text: '#1e3a8a',
        badgeBg: 'rgba(59, 130, 246, 0.14)',
        badgeText: '#1d4ed8',
        badgeBorder: 'rgba(59, 130, 246, 0.55)',
      };
    case '#059669': // Émeraude
      return {
        bg: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 55%, #ccfbf1 100%)',
        border: '#10b981',
        shadow: '0 0 0 2px rgba(52, 211, 153, 0.6), 0 0 18px 4px rgba(16, 185, 129, 0.6), 0 0 32px 0px rgba(52, 211, 153, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(52, 211, 153, 0.7) 0%, transparent 72%)',
        dot: '#10b981',
        dotShadow: '0 0 10px 2px rgba(16, 185, 129, 0.95)',
        text: '#064e3b',
        badgeBg: 'rgba(16, 185, 129, 0.14)',
        badgeText: '#047857',
        badgeBorder: 'rgba(16, 185, 129, 0.55)',
      };
    case '#ea580c': // Orange Ambré
      return {
        bg: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 55%, #fef3c7 100%)',
        border: '#f97316',
        shadow: '0 0 0 2px rgba(251, 146, 60, 0.65), 0 0 18px 4px rgba(249, 115, 22, 0.62), 0 0 32px 0px rgba(251, 146, 60, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(251, 146, 60, 0.72) 0%, transparent 72%)',
        dot: '#f97316',
        dotShadow: '0 0 10px 2px rgba(249, 115, 22, 0.95)',
        text: '#7c2d12',
        badgeBg: 'rgba(249, 115, 22, 0.14)',
        badgeText: '#c2410c',
        badgeBorder: 'rgba(249, 115, 22, 0.55)',
      };
    case '#db2777': // Rose Framboise
      return {
        bg: 'linear-gradient(135deg, #fdf2f8 0%, #fce7f3 55%, #fae8ff 100%)',
        border: '#ec4899',
        shadow: '0 0 0 2px rgba(244, 114, 182, 0.65), 0 0 18px 4px rgba(236, 72, 153, 0.6), 0 0 32px 0px rgba(244, 114, 182, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(244, 114, 182, 0.72) 0%, transparent 72%)',
        dot: '#ec4899',
        dotShadow: '0 0 10px 2px rgba(236, 72, 153, 0.95)',
        text: '#831843',
        badgeBg: 'rgba(236, 72, 153, 0.14)',
        badgeText: '#be185d',
        badgeBorder: 'rgba(236, 72, 153, 0.55)',
      };
    case '#7c3aed': // Violet Lumineux
      return {
        bg: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 55%, #fae8ff 100%)',
        border: '#8b5cf6',
        shadow: '0 0 0 2px rgba(167, 139, 250, 0.65), 0 0 18px 4px rgba(139, 92, 246, 0.6), 0 0 32px 0px rgba(167, 139, 250, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(167, 139, 250, 0.72) 0%, transparent 72%)',
        dot: '#8b5cf6',
        dotShadow: '0 0 10px 2px rgba(139, 92, 246, 0.95)',
        text: '#4c1d95',
        badgeBg: 'rgba(139, 92, 246, 0.14)',
        badgeText: '#6d28d9',
        badgeBorder: 'rgba(139, 92, 246, 0.55)',
      };
    case '#d97706': // Or / Safran
      return {
        bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 55%, #ffedd5 100%)',
        border: '#f59e0b',
        shadow: '0 0 0 2px rgba(251, 191, 36, 0.65), 0 0 18px 4px rgba(245, 158, 11, 0.6), 0 0 32px 0px rgba(251, 191, 36, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(251, 191, 36, 0.72) 0%, transparent 72%)',
        dot: '#f59e0b',
        dotShadow: '0 0 10px 2px rgba(245, 158, 11, 0.95)',
        text: '#78350f',
        badgeBg: 'rgba(245, 158, 11, 0.16)',
        badgeText: '#b45309',
        badgeBorder: 'rgba(245, 158, 11, 0.55)',
      };
    case '#dc2626': // Rouge Écarlate
      return {
        bg: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 55%, #ffedd5 100%)',
        border: '#ef4444',
        shadow: '0 0 0 2px rgba(248, 113, 113, 0.65), 0 0 18px 4px rgba(239, 68, 68, 0.6), 0 0 32px 0px rgba(248, 113, 113, 0.45), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(248, 113, 113, 0.72) 0%, transparent 72%)',
        dot: '#ef4444',
        dotShadow: '0 0 10px 2px rgba(239, 68, 68, 0.95)',
        text: '#7f1d1d',
        badgeBg: 'rgba(239, 68, 68, 0.14)',
        badgeText: '#b91c1c',
        badgeBorder: 'rgba(239, 68, 68, 0.55)',
      };
    default: // Cyan Électrique / Bleu Ciel Lumineux (par défaut)
      return {
        bg: 'linear-gradient(135deg, #ecfeff 0%, #cffafe 55%, #e0f2fe 100%)',
        border: '#06b6d4',
        shadow: '0 0 0 2px rgba(34, 211, 238, 0.65), 0 0 20px 4px rgba(6, 182, 212, 0.62), 0 0 34px 0px rgba(56, 189, 248, 0.48), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
        aura: 'radial-gradient(circle, rgba(34, 211, 238, 0.75) 0%, transparent 72%)',
        dot: '#06b6d4',
        dotShadow: '0 0 10px 2px rgba(6, 182, 212, 0.98)',
        text: '#083344',
        badgeBg: 'rgba(6, 182, 212, 0.16)',
        badgeText: '#0e7490',
        badgeBorder: 'rgba(6, 182, 212, 0.6)',
      };
  }
};

// Couleurs proposées pour les classes (Orange Ambré comme sur l'image par défaut)
const CLASS_COLOR_OPTIONS = [
  { id: 'amber', label: 'Orange Ambré (Style Référence)', bg: '#ea580c', text: '#ffffff', border: '#c2410c', borderDark: '#9a3412', iconGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  { id: 'white', label: 'Blanc Épuré', bg: '#ffffff', text: '#0f172a', border: '#e2e8f0', borderDark: '#94a3b8', iconGradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' },
  { id: 'teal', label: 'Bleu Pétrole', bg: '#00313d', text: '#ffffff', border: '#00252e', borderDark: '#00141a', iconGradient: 'linear-gradient(135deg, #0d9488 0%, #00313d 100%)' },
  { id: 'blue', label: 'Bleu Océan', bg: '#1d4ed8', text: '#ffffff', border: '#1e40af', borderDark: '#172554', iconGradient: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490', borderDark: '#155e75', iconGradient: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)' },
  { id: 'emerald', label: 'Vert Émeraude', bg: '#047857', text: '#ffffff', border: '#065f46', borderDark: '#064e3b', iconGradient: 'linear-gradient(135deg, #34d399 0%, #047857 100%)' },
  { id: 'red', label: 'Rouge Carmin', bg: '#b91c1c', text: '#ffffff', border: '#991b1b', borderDark: '#7f1d1d', iconGradient: 'linear-gradient(135deg, #f87171 0%, #b91c1c 100%)' },
  { id: 'purple', label: 'Violet Profond', bg: '#6b21a8', text: '#ffffff', border: '#581c87', borderDark: '#3b0764', iconGradient: 'linear-gradient(135deg, #c084fc 0%, #6b21a8 100%)' },
  { id: 'gold', label: 'Or / Safran', bg: '#d97706', text: '#ffffff', border: '#b45309', borderDark: '#92400e', iconGradient: 'linear-gradient(135deg, #facc15 0%, #d97706 100%)' },
  { id: 'rose', label: 'Rose Framboise', bg: '#be185d', text: '#ffffff', border: '#9d174d', borderDark: '#831843', iconGradient: 'linear-gradient(135deg, #f472b6 0%, #be185d 100%)' },
];

// Couleurs proposées pour les matières (Blanc par défaut si non choisi)
const SUBJECT_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc (Défaut)', bg: '#ffffff', text: '#0f172a', border: '#cbd5e1', borderDark: '#94a3b8' },
  { id: 'teal', label: 'Bleu Pétrole', bg: '#00313d', text: '#ffffff', border: '#00252e', borderDark: '#00141a' },
  { id: 'blue', label: 'Bleu Roi', bg: '#2563eb', text: '#ffffff', border: '#1d4ed8', borderDark: '#1e40af' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490', borderDark: '#155e75' },
  { id: 'emerald', label: 'Vert Émeraude', bg: '#059669', text: '#ffffff', border: '#047857', borderDark: '#064e3b' },
  { id: 'amber', label: 'Orange Ambré', bg: '#ea580c', text: '#ffffff', border: '#c2410c', borderDark: '#9a3412' },
  { id: 'red', label: 'Rouge Carmin', bg: '#dc2626', text: '#ffffff', border: '#b91c1c', borderDark: '#991b1b' },
  { id: 'purple', label: 'Violet Sombre', bg: '#7c3aed', text: '#ffffff', border: '#6d28d9', borderDark: '#5b21b6' },
  { id: 'gold', label: 'Or / Safran', bg: '#d97706', text: '#ffffff', border: '#b45309', borderDark: '#92400e' },
  { id: 'rose', label: 'Rose Framboise', bg: '#db2777', text: '#ffffff', border: '#be185d', borderDark: '#9d174d' },
];

const CLASS_LEVEL_SUGGESTIONS = [
  'CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2',
  '6ème', '5ème', '4ème', '3ème',
  '2nde', '1ère', 'Terminale',
  'Licence 1', 'Licence 2', 'Master 1'
];

const CLASS_SUBJECT_SUGGESTIONS = [
  'Mathématiques', 'Français', 'Physique-Chimie', 'SVT',
  'Histoire-Géo', 'Anglais', 'Philosophie', 'Informatique',
  'EPS / Sport', 'Arts Plastiques', 'Musique', 'Économie',
  'Espagnol', 'Allemand'
];

// Couleurs proposées pour les écoles (Blanc par défaut si non choisi)
const SCHOOL_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc (Défaut)', bg: '#ffffff', text: '#0f172a', border: '#e2e8f0', borderDark: '#94a3b8' },
  { id: 'teal', label: 'Bleu Pétrole', bg: '#00313d', text: '#ffffff', border: '#00252e', borderDark: '#00141a' },
  { id: 'blue', label: 'Bleu Océan', bg: '#1d4ed8', text: '#ffffff', border: '#1e40af', borderDark: '#172554' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490', borderDark: '#155e75' },
  { id: 'emerald', label: 'Vert Émeraude', bg: '#047857', text: '#ffffff', border: '#065f46', borderDark: '#064e3b' },
  { id: 'amber', label: 'Orange Ambré', bg: '#c2410c', text: '#ffffff', border: '#9a3412', borderDark: '#7c2d12' },
  { id: 'red', label: 'Rouge Carmin', bg: '#b91c1c', text: '#ffffff', border: '#991b1b', borderDark: '#7f1d1d' },
  { id: 'purple', label: 'Violet Profond', bg: '#6b21a8', text: '#ffffff', border: '#581c87', borderDark: '#3b0764' },
  { id: 'indigo', label: 'Indigo Nuit', bg: '#3730a3', text: '#ffffff', border: '#312e81', borderDark: '#1e1b4b' },
  { id: 'slate', label: 'Gris Ardoise', bg: '#334155', text: '#ffffff', border: '#1e293b', borderDark: '#0f172a' },
];

// Années suggérées automatiquement à partir de l'année courante (2026)
const CURRENT_YEAR = new Date().getFullYear() || 2026;
const SUGGESTED_YEARS = [
  `${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR + 1} - ${CURRENT_YEAR + 2}`,
  `${CURRENT_YEAR + 2} - ${CURRENT_YEAR + 3}`,
  `${CURRENT_YEAR + 3} - ${CURRENT_YEAR + 4}`,
  `${CURRENT_YEAR - 1} - ${CURRENT_YEAR}`,
];

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

interface InlineSectionSearchProps {
  isOpen: boolean;
  query: string;
  placeholder: string;
  onToggle: () => void;
  onChange: (value: string) => void;
  onClose: () => void;
}

const InlineSectionSearch: React.FC<InlineSectionSearchProps> = ({
  isOpen,
  query,
  placeholder,
  onToggle,
  onChange,
  onClose,
}) => {
  return (
    <div className="inline-flex items-center gap-1 shrink-0">
      <button
        type="button"
        onClick={onToggle}
        className={`w-6 h-6 rounded-md border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
          isOpen
            ? 'bg-cyan-50 text-cyan-700 border-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.35)]'
            : 'bg-white/90 hover:bg-white text-slate-600 hover:text-[#00313d] border-slate-200/90 shadow-2xs'
        }`}
        title={isOpen ? 'Fermer la recherche' : placeholder}
      >
        <Search className="w-3 h-3 stroke-[2.4]" />
      </button>

      {isOpen && (
        <div className="h-6 px-2 rounded-md bg-white/95 border border-cyan-400/80 shadow-2xs flex items-center gap-1 animate-in fade-in duration-150">
          <input
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder={placeholder}
            className="w-28 sm:w-36 bg-transparent text-[11px] font-semibold text-slate-800 placeholder-slate-400 focus:outline-none leading-none"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="w-4 h-4 rounded flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-slate-100 transition cursor-pointer shrink-0"
            title="Fermer la recherche"
          >
            <X className="w-3 h-3 stroke-[2.5]" />
          </button>
        </div>
      )}
    </div>
  );
};

export const TeacherClassesView: React.FC<TeacherClassesViewProps> = ({ onBack, user }) => {
  const { user: authUser } = useAuth();
  const authUserId =
    authUser?.id ||
    (user as any)?.id ||
    (typeof localStorage !== 'undefined'
      ? localStorage.getItem('unifolder_user_id') || localStorage.getItem('studycloud_user_id') || ''
      : '');
  const initialCloudCache = useMemo(
    () => (authUserId ? readUserBootstrapCache(authUserId) : null),
    [authUserId]
  );
  // Restauration persistante de l'emplacement exact (école, niveau, classe, trimestre, tableau matière, moyenne générale, transfert)
  // afin de retomber toujours exactement au même endroit après rechargement ou mise à jour
  const initialNavSnapshot = useMemo(
    () => (authUserId ? readTeacherNavSnapshot(authUserId) : null),
    [authUserId]
  );
  const initialResolvedNav = useMemo(
    () =>
      resolveTeacherNavSnapshot(
        initialNavSnapshot,
        initialCloudCache
          ? {
              schoolYears: initialCloudCache.schoolYears || [],
              schools: initialCloudCache.schools || [],
              studyLevels: initialCloudCache.studyLevels || [],
              classes: initialCloudCache.classes || [],
              terms: initialCloudCache.terms || [],
              subjects: initialCloudCache.subjects || [],
              classAverages: initialCloudCache.classAverages || [],
            }
          : null
      ),
    [initialNavSnapshot, initialCloudCache]
  );
  const pendingNavRestoreRef = useRef<TeacherNavSnapshot | null>(
    initialResolvedNav.needsCloudHydration ? initialNavSnapshot : null
  );
  const [isRestoringNav, setIsRestoringNav] = useState<boolean>(
    () => Boolean(initialResolvedNav.needsCloudHydration && getTeacherAuthToken())
  );

  // État de synchronisation Cloudflare D1 + R2 (automatique + bouton manuel "Enregistrer")
  const [cloudStatus, setCloudStatus] = useState<'loading' | 'ready' | 'syncing' | 'error'>(() =>
    getTeacherAuthToken() ? 'loading' : 'ready'
  );
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [saveUiState, setSaveUiState] = useState<'idle' | 'saving' | 'saved' | 'offline' | 'error'>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'idle'
  );
  const [saveFeedbackMessage, setSaveFeedbackMessage] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const activeSaveCountRef = useRef<number>(0);
  const [serverGradebookStats, setServerGradebookStats] = useState<Record<string, GradebookInspection>>(
    () => initialCloudCache?.gradebookStats || {}
  );
  const isCloudHydratedRef = useRef<boolean>(false);

  // Surveillance temps réel de la connexion Internet (hors ligne / en ligne)
  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setSaveUiState('offline');
      setSaveFeedbackMessage('Hors ligne : échec de la connexion. Vérifiez votre connexion Internet puis appuyez sur Enregistrer.');
    };
    const handleOnline = () => {
      setIsOnline(true);
      setSaveUiState((prev) => (prev === 'offline' ? 'idle' : prev));
      setSaveFeedbackMessage((prev) => (prev && prev.toLowerCase().includes('hors ligne') ? null : prev));
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Exécuteur unifié de toute écriture D1/R2 : met à jour le statut "Enregistrement en cours..." -> "Enregistré avec succès" ou "Hors ligne — Échec"
  const runCloudMutation = useCallback(async <T,>(
    task: () => Promise<T>,
    errorFallback: string
  ): Promise<T | null> => {
    if (!getTeacherAuthToken()) {
      setSaveUiState('error');
      setSaveFeedbackMessage('Session non connectée. Veuillez vous reconnecter pour enregistrer vos données.');
      return null;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsOnline(false);
      setSaveUiState('offline');
      setSaveFeedbackMessage("Hors ligne — Échec de l'enregistrement : aucune connexion Internet détectée.");
      return null;
    }

    activeSaveCountRef.current += 1;
    setSaveUiState('saving');
    setSaveFeedbackMessage(null);
    setCloudError(null);

    try {
      const result = await task();
      activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      if (activeSaveCountRef.current === 0) {
        setSaveUiState('saved');
        setCloudStatus('ready');
      }
      return result;
    } catch (err: any) {
      activeSaveCountRef.current = Math.max(0, activeSaveCountRef.current - 1);
      if (isOfflineOrNetworkError(err)) {
        setIsOnline(false);
        setSaveUiState('offline');
        setSaveFeedbackMessage("Hors ligne — Échec de l'enregistrement. Vérifiez votre connexion Internet.");
      } else if (err?.isStorageLimitExceeded) {
        setSaveUiState('error');
        setSaveFeedbackMessage(err?.message || "Votre espace de stockage est plein. Veuillez augmenter votre stockage.");
        setCloudStatus('error');
        setCloudError(err?.message || "Espace de stockage saturé.");
        // Annuler immédiatement toute création optimiste locale en resynchronisant l'état exact de D1
        TeacherGradebookAPI.bootstrap()
          .then((fresh) => {
            setSchoolYears(fresh.schoolYears);
            setSchools(fresh.schools);
            setStudyLevels(fresh.studyLevels);
            setClasses(fresh.classes);
            setTerms(fresh.terms);
            setSubjects(fresh.subjects);
            setClassAverages(fresh.classAverages || []);
            setServerGradebookStats(fresh.gradebookStats || {});
            setSelectedYearId((prev) =>
              prev && fresh.schoolYears.some((y) => y.id === prev) ? prev : fresh.schoolYears[0]?.id || ''
            );
            setSelectedSchoolInside((prev) =>
              prev ? fresh.schools.find((s) => s.id === prev.id) || null : null
            );
            setSelectedSubjectInside((prev) =>
              prev ? fresh.subjects.find((s) => s.id === prev.id) || null : null
            );
            if (authUserId) writeUserBootstrapCache(authUserId, fresh);
          })
          .catch(() => {});
      } else {
        setSaveUiState('error');
        setSaveFeedbackMessage(err?.message || errorFallback);
        setCloudStatus('error');
        setCloudError(err?.message || errorFallback);
      }
      return null;
    }
  }, [authUserId]);

  // 1. Accueil par défaut de cette application : le bouton "Tableau de bord" (restauré si quitté ailleurs)
  const [activeNavTab, setActiveNavTab] = useState<TeacherDashboardTab>(
    () => initialResolvedNav.activeNavTab
  );

  // Pagination horizontale des établissements scolaires (3 lignes x 4 colonnes = 12 cases : 1 bouton "+" + 11 écoles / page)
  const [schoolsPageByYear, setSchoolsPageByYear] = useState<Record<string, number>>(
    () => initialResolvedNav.schoolsPageByYear
  );
  const [searchSchoolsPageIndex, setSearchSchoolsPageIndex] = useState<number>(0);
  const schoolsTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Recherches rapides par section (Établissements, Niveaux, Classes, Matières)
  const [isSchoolSearchOpen, setIsSchoolSearchOpen] = useState(false);
  const [schoolSearchQuery, setSchoolSearchQuery] = useState('');
  const [isLevelSearchOpen, setIsLevelSearchOpen] = useState(false);
  const [levelSearchQuery, setLevelSearchQuery] = useState('');
  const [isClassSearchOpen, setIsClassSearchOpen] = useState(false);
  const [classSearchQuery, setClassSearchQuery] = useState('');
  const [isSubjectSearchOpen, setIsSubjectSearchOpen] = useState(false);
  const [subjectSearchQuery, setSubjectSearchQuery] = useState('');

  // Vue dédiée de transfert / duplication (s'ouvre "à l'intérieur" comme les cartes)
  const [isTransferViewOpen, setIsTransferViewOpen] = useState<boolean>(
    () => initialResolvedNav.isTransferViewOpen
  );

  // Agrandissement progressif et plein écran (Image 2 & 3 - Desktop uniquement)
  const viewerExpandLevel = useViewerExpandLevel();
  const hasRestoredExpandRef = useRef<boolean>(initialResolvedNav.viewerExpandLevel === 0);
  const [isViewerMaximized, setIsViewerMaximized] = useState<boolean>(
    () => initialResolvedNav.viewerExpandLevel >= 1
  );

  // Restaurer le niveau d'agrandissement avant la peinture (synchronisé atomiquement avec FoldersView/Sidebar/App via useSyncExternalStore)
  // et nettoyer uniquement au démontage réel du module
  useLayoutEffect(() => {
    if (initialResolvedNav.viewerExpandLevel >= 1) {
      setViewerExpandLevel(initialResolvedNav.viewerExpandLevel);
      setIsViewerMaximized(true);
    }
    hasRestoredExpandRef.current = true;
    return () => {
      resetViewerExpand();
    };
  }, []);

  // Touche Échap pour restaurer l'affichage normal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewerExpandLevel >= 1 || isViewerMaximized) {
          setIsViewerMaximized(false);
          resetViewerExpand();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerExpandLevel, isViewerMaximized]);

  // Années scolaires créées (isolées par user_id dans Cloudflare D1)
  const [schoolYears, setSchoolYears] = useState<SchoolYearItem[]>(() => {
    if (initialCloudCache?.schoolYears && initialCloudCache.schoolYears.length > 0) {
      return initialCloudCache.schoolYears;
    }
    return [];
  });

  const [selectedYearId, setSelectedYearId] = useState<string>(() => {
    return initialResolvedNav.selectedYearId || initialCloudCache?.schoolYears?.[0]?.id || '';
  });

  // Écoles créées attachées à chaque année scolaire (isolées par user_id dans D1 + logo R2)
  const [schools, setSchools] = useState<SchoolItem[]>(() => initialCloudCache?.schools || []);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(
    () => initialResolvedNav.selectedSchoolId
  );

  // École sélectionnée dans laquelle on est "rentré" à l'intérieur
  const [selectedSchoolInside, setSelectedSchoolInside] = useState<SchoolItem | null>(
    () => initialResolvedNav.selectedSchoolInside
  );

  // Classe dans laquelle on est "rentré" (Écran C : Trimestres fixes en haut + Matières en dessous)
  const [enteredClassId, setEnteredClassId] = useState<string | null>(
    () => initialResolvedNav.enteredClassId
  );

  // Niveaux d'étude créés attachés à chaque école (CP1, 6ème, 2nde, Terminale, Licence 1...)
  const [studyLevels, setStudyLevels] = useState<StudyLevelItem[]>(() => initialCloudCache?.studyLevels || []);

  // Niveau d'étude activement sélectionné dans l'école
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(
    () => initialResolvedNav.selectedLevelId
  );

  // Référence pour le défilement horizontal fluide des niveaux d'étude
  const levelsScrollRef = useRef<HTMLDivElement>(null);

  const scrollLevels = (direction: 'left' | 'right') => {
    if (levelsScrollRef.current) {
      const scrollAmount = 240;
      levelsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Classes créées attachées à chaque niveau d'étude & école (isolées par user_id dans D1)
  const [classes, setClasses] = useState<ClassItem[]>(() => initialCloudCache?.classes || []);

  // Classe activement sélectionnée parmi les classes du niveau d'étude actif
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    () => initialResolvedNav.selectedClassId
  );

  // Référence pour le défilement horizontal fluide des classes
  const classesScrollRef = useRef<HTMLDivElement>(null);

  const scrollClasses = (direction: 'left' | 'right') => {
    if (classesScrollRef.current) {
      const scrollAmount = 260;
      classesScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Matières créées attachées à chaque classe & trimestre (isolées par user_id dans D1)
  const [subjects, setSubjects] = useState<SubjectItem[]>(() => initialCloudCache?.subjects || []);

  // Trimestres des classes (Trimestre 1, 2, 3 créés automatiquement par classe)
  const [terms, setTerms] = useState<TermItem[]>(() => initialCloudCache?.terms || []);

  // Trimestre actif sélectionné
  const [selectedTermId, setSelectedTermId] = useState<string | null>(
    () => initialResolvedNav.selectedTermId
  );

  // Matière sélectionnée dans laquelle on est "rentré" à l'intérieur pour afficher le tableur de notes & moyennes
  const [selectedSubjectInside, setSelectedSubjectInside] = useState<SubjectItem | null>(
    () => initialResolvedNav.selectedSubjectInside
  );

  // Cartes de calcul de moyenne générale par classe (annuelle + 1 par trimestre, synchronisées en base)
  const [classAverages, setClassAverages] = useState<ClassAverageCardItem[]>(() => initialCloudCache?.classAverages || []);
  const [selectedAverageCardInside, setSelectedAverageCardInside] = useState<ClassAverageCardItem | null>(
    () => initialResolvedNav.selectedAverageCardInside
  );
  const classAveragesScrollRef = useRef<HTMLDivElement>(null);

  // Mémoriser les derniers IDs de navigation pour ne réinitialiser les sous-vues QUE sur vrai changement utilisateur
  // (jamais au montage initial ni lors d'un rafraîchissement des données serveur)
  const prevNavIdsRef = useRef<{
    schoolId: string | null;
    levelId: string | null;
    classId: string | null;
    termId: string | null;
  }>({
    schoolId: initialResolvedNav.selectedSchoolInside?.id || null,
    levelId: initialResolvedNav.selectedLevelId,
    classId: initialResolvedNav.selectedClassId,
    termId: initialResolvedNav.selectedTermId,
  });

  const scrollClassAverages = (direction: 'left' | 'right') => {
    if (classAveragesScrollRef.current) {
      const scrollAmount = 260;
      classAveragesScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Chargement complet & isolation stricte par compte depuis Cloudflare D1 (démarrage vierge à ZÉRO — aucune année pré-créée)
  const loadFromCloudD1 = useCallback(async () => {
    // Nettoyer définitivement toute ancienne donnée locale non scopée héritée du code précédent
    clearLegacyUnscopedTeacherData();

    if (!getTeacherAuthToken() || !authUserId) {
      pendingNavRestoreRef.current = null;
      setIsRestoringNav(false);
      setCloudStatus('ready');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      pendingNavRestoreRef.current = null;
      setIsRestoringNav(false);
      setIsOnline(false);
      setCloudStatus('error');
      setSaveUiState('offline');
      setSaveFeedbackMessage("Hors ligne — Impossible de charger ou d'enregistrer vos données. Vérifiez votre connexion.");
      return;
    }

    setCloudStatus('loading');
    setCloudError(null);
    try {
      const data = await TeacherGradebookAPI.bootstrap();

      setSchoolYears(data.schoolYears);
      setSchools(data.schools);
      setStudyLevels(data.studyLevels);
      setClasses(data.classes);
      setTerms(data.terms);
      setSubjects(data.subjects);
      setClassAverages(data.classAverages || []);
      setServerGradebookStats(data.gradebookStats || {});

      if (pendingNavRestoreRef.current) {
        const resolved = resolveTeacherNavSnapshot(pendingNavRestoreRef.current, {
          schoolYears: data.schoolYears || [],
          schools: data.schools || [],
          studyLevels: data.studyLevels || [],
          classes: data.classes || [],
          terms: data.terms || [],
          subjects: data.subjects || [],
          classAverages: data.classAverages || [],
        });
        prevNavIdsRef.current = {
          schoolId: resolved.selectedSchoolInside?.id || null,
          levelId: resolved.selectedLevelId,
          classId: resolved.selectedClassId,
          termId: resolved.selectedTermId,
        };
        setActiveNavTab(resolved.activeNavTab);
        setSelectedYearId(resolved.selectedYearId);
        setSchoolsPageByYear(resolved.schoolsPageByYear);
        setSelectedSchoolId(resolved.selectedSchoolId);
        setSelectedSchoolInside(resolved.selectedSchoolInside);
        setSelectedLevelId(resolved.selectedLevelId);
        setSelectedClassId(resolved.selectedClassId);
        setEnteredClassId(resolved.enteredClassId);
        setSelectedTermId(resolved.selectedTermId);
        setSelectedSubjectInside(resolved.selectedSubjectInside);
        setSelectedAverageCardInside(resolved.selectedAverageCardInside);
        setIsTransferViewOpen(resolved.isTransferViewOpen);
        if (resolved.viewerExpandLevel >= 1) {
          setViewerExpandLevel(resolved.viewerExpandLevel);
          setIsViewerMaximized(true);
        }
        pendingNavRestoreRef.current = null;
        setIsRestoringNav(false);
      } else {
        setSelectedYearId((prev) =>
          prev && data.schoolYears.some((y) => y.id === prev) ? prev : data.schoolYears[0]?.id || ''
        );
        setSelectedSchoolInside((prev) =>
          prev ? data.schools.find((s) => s.id === prev.id) || null : null
        );
        setSelectedSubjectInside((prev) =>
          prev ? data.subjects.find((s) => s.id === prev.id) || null : null
        );
        setSelectedAverageCardInside((prev) => {
          if (!prev) return null;
          const byId = (data.classAverages || []).find((ca) => ca.id === prev.id);
          if (byId) return byId;
          const byMatch = (data.classAverages || []).find(
            (ca) =>
              ca.kind === prev.kind &&
              ca.classId === prev.classId &&
              (prev.kind === 'annual' ? !ca.termId : ca.termId === prev.termId)
          );
          if (byMatch) return byMatch;
          return data.classes.some((c) => c.id === prev.classId) ? prev : null;
        });
      }

      writeUserBootstrapCache(authUserId, data);
      isCloudHydratedRef.current = true;
      setCloudStatus('ready');
    } catch (err: any) {
      pendingNavRestoreRef.current = null;
      setIsRestoringNav(false);
      if (isOfflineOrNetworkError(err)) {
        setIsOnline(false);
        setSaveUiState('offline');
        setSaveFeedbackMessage("Hors ligne — Impossible de charger vos données. Vérifiez votre connexion Internet.");
      } else {
        setCloudStatus('error');
        setCloudError(err?.message || 'Impossible de charger vos données pour le moment.');
      }
    }
  }, [authUserId]);

  // Bouton manuel "Enregistrer" : vérifie la connexion et synchronise / sauvegarde tout dans Cloudflare D1
  const handleManualSave = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsOnline(false);
      setSaveUiState('offline');
      setSaveFeedbackMessage("Hors ligne — Échec de l'enregistrement : aucune connexion Internet détectée.");
      return;
    }
    const synced = await runCloudMutation(
      () =>
        TeacherGradebookAPI.syncAll({
          schoolYears,
          schools,
          studyLevels,
          classes,
          terms,
          subjects,
        }),
      "Échec de l'enregistrement de vos données."
    );
    if (synced && authUserId) {
      setSchoolYears(synced.schoolYears);
      setSchools(synced.schools);
      setStudyLevels(synced.studyLevels);
      setClasses(synced.classes);
      setTerms(synced.terms);
      setSubjects(synced.subjects);
      setClassAverages(synced.classAverages || []);
      setServerGradebookStats(synced.gradebookStats || {});
      setSelectedYearId((prev) =>
        prev && synced.schoolYears.some((y) => y.id === prev) ? prev : synced.schoolYears[0]?.id || ''
      );
      setSelectedSchoolInside((prev) =>
        prev ? synced.schools.find((s) => s.id === prev.id) || null : null
      );
      writeUserBootstrapCache(authUserId, synced);
    }
  }, [authUserId, schoolYears, schools, studyLevels, classes, terms, subjects, runCloudMutation]);

  const prevAuthUserIdRef = useRef<string>(authUserId);
  useEffect(() => {
    // Si l'utilisateur change de compte sur le même appareil, réinitialiser immédiatement l'état mémoire et charger la navigation du nouveau compte
    if (prevAuthUserIdRef.current !== authUserId) {
      prevAuthUserIdRef.current = authUserId;
      const nextCache = authUserId ? readUserBootstrapCache(authUserId) : null;
      const nextNavSnap = authUserId ? readTeacherNavSnapshot(authUserId) : null;
      const nextResolved = resolveTeacherNavSnapshot(
        nextNavSnap,
        nextCache
          ? {
              schoolYears: nextCache.schoolYears || [],
              schools: nextCache.schools || [],
              studyLevels: nextCache.studyLevels || [],
              classes: nextCache.classes || [],
              terms: nextCache.terms || [],
              subjects: nextCache.subjects || [],
              classAverages: nextCache.classAverages || [],
            }
          : null
      );
      pendingNavRestoreRef.current = nextResolved.needsCloudHydration ? nextNavSnap : null;
      setIsRestoringNav(Boolean(nextResolved.needsCloudHydration && getTeacherAuthToken()));
      prevNavIdsRef.current = {
        schoolId: nextResolved.selectedSchoolInside?.id || null,
        levelId: nextResolved.selectedLevelId,
        classId: nextResolved.selectedClassId,
        termId: nextResolved.selectedTermId,
      };
      setSchoolYears(nextCache?.schoolYears || []);
      setSchools(nextCache?.schools || []);
      setStudyLevels(nextCache?.studyLevels || []);
      setClasses(nextCache?.classes || []);
      setTerms(nextCache?.terms || []);
      setSubjects(nextCache?.subjects || []);
      setClassAverages(nextCache?.classAverages || []);
      setServerGradebookStats(nextCache?.gradebookStats || {});
      setActiveNavTab(nextResolved.activeNavTab);
      setSelectedYearId(nextResolved.selectedYearId);
      setSchoolsPageByYear(nextResolved.schoolsPageByYear);
      setSelectedSchoolId(nextResolved.selectedSchoolId);
      setSelectedSchoolInside(nextResolved.selectedSchoolInside);
      setSelectedSubjectInside(nextResolved.selectedSubjectInside);
      setSelectedAverageCardInside(nextResolved.selectedAverageCardInside);
      setSelectedLevelId(nextResolved.selectedLevelId);
      setSelectedClassId(nextResolved.selectedClassId);
      setEnteredClassId(nextResolved.enteredClassId);
      setSelectedTermId(nextResolved.selectedTermId);
      setIsTransferViewOpen(nextResolved.isTransferViewOpen);
    }
    isCloudHydratedRef.current = false;
    loadFromCloudD1();
  }, [authUserId, loadFromCloudD1]);

  // Maintenir le cache isolé par user_id synchronisé (jamais de clés partagées entre comptes)
  useEffect(() => {
    if (!authUserId || !isCloudHydratedRef.current) return;
    writeUserBootstrapCache(authUserId, {
      success: true,
      userId: authUserId,
      isEmpty: schoolYears.length === 0 && schools.length === 0,
      schoolYears,
      schools,
      studyLevels,
      classes,
      terms,
      subjects,
      classAverages,
      gradebookStats: serverGradebookStats,
    });
  }, [authUserId, schoolYears, schools, studyLevels, classes, terms, subjects, classAverages, serverGradebookStats]);

  // Persistance en temps réel de l'emplacement exact dans localStorage + sessionStorage (résiste aux sorties du module, rechargements et mises à jour)
  const effectiveViewerExpandLevel =
    !hasRestoredExpandRef.current && initialResolvedNav.viewerExpandLevel >= 1
      ? initialResolvedNav.viewerExpandLevel
      : viewerExpandLevel;
  const activeSavedSchoolsPage = selectedYearId ? schoolsPageByYear[selectedYearId] || 0 : 0;

  const currentNavPayloadRef = useRef<Omit<TeacherNavSnapshot, 'version' | 'updatedAt'>>({
    activeNavTab,
    selectedYearId: selectedYearId || null,
    schoolsPageIndex: activeSavedSchoolsPage,
    schoolsPageByYear,
    selectedSchoolId,
    schoolInsideId: selectedSchoolInside?.id || null,
    selectedLevelId,
    selectedClassId,
    enteredClassId,
    selectedTermId,
    subjectInsideId: selectedSubjectInside?.id || null,
    averageCardInsideId: selectedAverageCardInside?.id || null,
    averageCardKind: selectedAverageCardInside?.kind || null,
    averageCardClassId: selectedAverageCardInside?.classId || null,
    averageCardTermId: selectedAverageCardInside?.termId || null,
    isTransferViewOpen,
    viewerExpandLevel: effectiveViewerExpandLevel,
  });

  useEffect(() => {
    const payload: Omit<TeacherNavSnapshot, 'version' | 'updatedAt'> = {
      activeNavTab,
      selectedYearId: selectedYearId || null,
      schoolsPageIndex: activeSavedSchoolsPage,
      schoolsPageByYear,
      selectedSchoolId,
      schoolInsideId: selectedSchoolInside?.id || null,
      selectedLevelId,
      selectedClassId,
      enteredClassId,
      selectedTermId,
      subjectInsideId: selectedSubjectInside?.id || null,
      averageCardInsideId: selectedAverageCardInside?.id || null,
      averageCardKind: selectedAverageCardInside?.kind || null,
      averageCardClassId: selectedAverageCardInside?.classId || null,
      averageCardTermId: selectedAverageCardInside?.termId || null,
      isTransferViewOpen,
      viewerExpandLevel: effectiveViewerExpandLevel,
    };
    currentNavPayloadRef.current = payload;
    if (!authUserId || pendingNavRestoreRef.current) return;
    writeTeacherNavSnapshot(authUserId, payload);
  }, [
    authUserId,
    activeNavTab,
    selectedYearId,
    activeSavedSchoolsPage,
    schoolsPageByYear,
    selectedSchoolId,
    selectedSchoolInside?.id,
    selectedLevelId,
    selectedClassId,
    enteredClassId,
    selectedTermId,
    selectedSubjectInside?.id,
    selectedAverageCardInside?.id,
    selectedAverageCardInside?.kind,
    selectedAverageCardInside?.classId,
    selectedAverageCardInside?.termId,
    isTransferViewOpen,
    effectiveViewerExpandLevel,
  ]);

  // Flush immédiat de l'emplacement lors d'une sortie du module, d'un changement d'onglet, d'un rechargement ou d'une mise à jour
  const flushNavSnapshotNow = useCallback(() => {
    if (!authUserId || pendingNavRestoreRef.current) return;
    writeTeacherNavSnapshot(authUserId, currentNavPayloadRef.current);
  }, [authUserId]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        flushNavSnapshotNow();
      }
    };
    window.addEventListener('beforeunload', flushNavSnapshotNow);
    window.addEventListener('pagehide', flushNavSnapshotNow);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      flushNavSnapshotNow();
      window.removeEventListener('beforeunload', flushNavSnapshotNow);
      window.removeEventListener('pagehide', flushNavSnapshotNow);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [flushNavSnapshotNow]);

  // Rafraîchir uniquement les stats de tableurs après fermeture/sauvegarde d'un tableur
  const refreshCloudStats = useCallback(async () => {
    if (!getTeacherAuthToken() || !authUserId) return;
    try {
      const data = await TeacherGradebookAPI.bootstrap();
      setServerGradebookStats(data.gradebookStats || {});
      if (data.classAverages) setClassAverages(data.classAverages);
      writeUserBootstrapCache(authUserId, data);
    } catch {}
  }, [authUserId]);

  // Réinitialiser les sous-vues UNIQUEMENT lorsque l'utilisateur change réellement d'école, niveau, classe ou trimestre
  // (jamais à la restauration initiale ni lors d'une mise à jour des données serveur)
  useEffect(() => {
    const curSchoolId = selectedSchoolInside?.id || null;
    const prev = prevNavIdsRef.current;
    const schoolChanged = prev.schoolId !== curSchoolId;
    const levelChanged = prev.levelId !== selectedLevelId;
    const classChanged = prev.classId !== selectedClassId;
    const termChanged = prev.termId !== selectedTermId;

    prevNavIdsRef.current = {
      schoolId: curSchoolId,
      levelId: selectedLevelId,
      classId: selectedClassId,
      termId: selectedTermId,
    };

    if (pendingNavRestoreRef.current) return;

    if (schoolChanged) {
      setEnteredClassId((cur) => {
        if (!cur || !curSchoolId) return null;
        return classes.some((c) => c.id === cur && c.schoolId === curSchoolId) ? cur : null;
      });
      setIsTransferViewOpen(false);
    }

    if (schoolChanged || levelChanged || classChanged || termChanged) {
      setSelectedSubjectInside((cur) => {
        if (!cur) return null;
        if (!curSchoolId || cur.schoolId !== curSchoolId) return null;
        if (selectedClassId && cur.classId !== selectedClassId) return null;
        if (selectedTermId && cur.termId && cur.termId !== selectedTermId) return null;
        return cur;
      });
    }

    if (schoolChanged || levelChanged || classChanged) {
      setSelectedAverageCardInside((cur) => {
        if (!cur) return null;
        if (!curSchoolId || cur.schoolId !== curSchoolId) return null;
        if (selectedClassId && cur.classId !== selectedClassId) return null;
        return cur;
      });
    }
  }, [selectedSchoolInside?.id, selectedLevelId, selectedClassId, selectedTermId, classes]);

  // Référence pour le défilement horizontal fluide des trimestres
  const termsScrollRef = useRef<HTMLDivElement>(null);

  const scrollTerms = (direction: 'left' | 'right') => {
    if (termsScrollRef.current) {
      const scrollAmount = 250;
      termsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // État du petit menu latéral d'ajout d'un trimestre (+ coefficient facultatif)
  const [isAddTermPopoverOpen, setIsAddTermPopoverOpen] = useState(false);
  const [newTermCoeffInput, setNewTermCoeffInput] = useState('');
  const addTermBtnRef = useRef<HTMLButtonElement | null>(null);

  // État du petit menu d'ajout / modification du coefficient d'un trimestre existant
  const [editingTermCoeff, setEditingTermCoeff] = useState<{
    term: TermItem;
    anchorEl: HTMLElement | null;
    fallbackRect: DOMRect | null;
  } | null>(null);
  const [editTermCoeffInput, setEditTermCoeffInput] = useState('');

  // État pour le bouton de copie rapide du nom dans la modale de suppression
  const [isCopiedDeleteName, setIsCopiedDeleteName] = useState(false);
  const handleCopyDeleteName = (name: string) => {
    try {
      navigator.clipboard.writeText(name);
    } catch { }
    setDeleteConfirmInput(name);
    setIsCopiedDeleteName(true);
    setTimeout(() => setIsCopiedDeleteName(false), 2000);
  };

  // --- ÉTATS POUR LES MENUS CONTEXTUELS "3 TRAITS", ÉDITION ET SUPPRESSION SÉCURISÉE ---
  type ManagedEntityType = 'year' | 'school' | 'level' | 'class' | 'term' | 'subject';

  interface ActiveMenuState {
    type: ManagedEntityType;
    id: string;
    item: any;
    anchorEl: HTMLElement;
    fallbackRect: DOMRect;
  }
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);
  const mainContainerRef = useRef<HTMLElement | null>(null);
  const createYearBtnRef = useRef<HTMLButtonElement | null>(null);

  // Cible de suppression sécurisée (nécessite la saisie / copie exacte du nom)
  interface DeleteTargetState {
    type: ManagedEntityType;
    id: string;
    name: string;
    displayName: string;
    warningMessage: string;
  }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // États des éléments en cours de modification
  const [editingYear, setEditingYear] = useState<SchoolYearItem | null>(null);
  const [editYearLabel, setEditYearLabel] = useState('');
  const [editYearColorObj, setEditYearColorObj] = useState(YEAR_COLOR_OPTIONS[0]);
  const [editYearColorStyle, setEditYearColorStyle] = useState<CardColorStyle>('full');
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [editingLevel, setEditingLevel] = useState<StudyLevelItem | null>(null);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);

  // Positionnement intelligent du menu 3 traits (portail document.body, évite les obstacles et la barre latérale)
  const handleOpenMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    type: ManagedEntityType,
    item: any
  ) => {
    e.stopPropagation();
    if (activeMenu?.type === type && activeMenu?.id === item.id) {
      setActiveMenu(null);
      return;
    }

    const triggerEl = e.currentTarget;
    setActiveMenu({
      type,
      id: item.id,
      item,
      anchorEl: triggerEl,
      fallbackRect: triggerEl.getBoundingClientRect(),
    });
  };

  const handleTriggerEdit = (type: ManagedEntityType, item: any) => {
    const prevAnchorEl = activeMenu?.anchorEl ?? null;
    const prevFallbackRect = activeMenu?.fallbackRect ?? null;
    setActiveMenu(null);
    if (type === 'year') {
      const yr = item as SchoolYearItem;
      setBatchError(null);
      setEditingYear(yr);
      setEditYearLabel(yr.label);
      setEditYearColorObj(
        YEAR_COLOR_OPTIONS.find(c => c.bg === yr.color) ||
        YEAR_COLOR_OPTIONS[0]
      );
      setEditYearColorStyle(yr.colorStyle === 'accent' ? 'accent' : 'full');
    } else if (type === 'school') {
      const school = item as SchoolItem;
      setBatchError(null);
      setSchoolCreationMode('single');
      setEditingSchool(school);
      setSchoolName(school.name);
      setSchoolLogo(school.logoUrl || null);
      setSelectedSchoolColor(
        SCHOOL_COLOR_OPTIONS.find(c => c.bg === school.color) ||
        SCHOOL_COLOR_OPTIONS[0]
      );
      setSchoolColorStyle(school.colorStyle === 'accent' ? 'accent' : 'full');
      setIsAddSchoolModalOpen(true);
    } else if (type === 'level') {
      const lvl = item as StudyLevelItem;
      setBatchError(null);
      setLevelCreationMode('single');
      setEditingLevel(lvl);
      setStudyLevelName(lvl.name);
      setSelectedStudyLevelColor(
        YEAR_COLOR_OPTIONS.find(c => c.bg === lvl.color) ||
        YEAR_COLOR_OPTIONS[0]
      );
      setLevelColorStyle(lvl.colorStyle === 'full' ? 'full' : 'accent');
      setIsAddLevelModalOpen(true);
    } else if (type === 'class') {
      const cls = item as ClassItem;
      setBatchError(null);
      setClassCreationMode('single');
      setEditingClass(cls);
      setClassName(cls.name?.trim() || cls.level);
      setClassSlogan(cls.slogan || '');
      setClassTeacherName(cls.teacherName);
      setSelectedClassColor(
        CLASS_COLOR_OPTIONS.find(c => c.bg === cls.color) ||
        CLASS_COLOR_OPTIONS[0]
      );
      setClassColorStyle(cls.colorStyle === 'full' ? 'full' : 'accent');
      setIsAddClassModalOpen(true);
    } else if (type === 'term') {
      const trm = item as TermItem;
      setBatchError(null);
      setIsAddTermPopoverOpen(false);
      setEditTermCoeffInput(trm.coefficient !== undefined && trm.coefficient !== null ? String(trm.coefficient) : '');
      setEditingTermCoeff({
        term: trm,
        anchorEl: prevAnchorEl,
        fallbackRect: prevFallbackRect,
      });
    } else if (type === 'subject') {
      const subj = item as SubjectItem;
      setBatchError(null);
      setSubjectCreationMode('single');
      setEditingSubject(subj);
      setSubjectName(subj.name);
      setSubjectCoefficient(subj.coefficient !== undefined ? String(subj.coefficient) : '');
      setSelectedSubjectColor(
        SUBJECT_COLOR_OPTIONS.find(c => c.bg === subj.color) ||
        SUBJECT_COLOR_OPTIONS[0]
      );
      setSubjectColorStyle(subj.colorStyle === 'full' ? 'full' : 'accent');
      setIsAddSubjectModalOpen(true);
    }
  };

  const handleSaveTermCoefficient = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingTermCoeff) return;
    const targetTerm = editingTermCoeff.term;
    const cleaned = editTermCoeffInput.trim().replace(',', '.');
    let parsedCoeff: number | null = null;
    if (cleaned !== '') {
      const n = Number(cleaned);
      if (!Number.isFinite(n) || n <= 0) return;
      parsedCoeff = Math.round(n * 100) / 100;
    }

    setTerms(prev =>
      prev.map(t =>
        t.id === targetTerm.id
          ? { ...t, coefficient: parsedCoeff !== null ? parsedCoeff : undefined }
          : t
      )
    );
    setEditingTermCoeff(null);
    setEditTermCoeffInput('');

    runCloudMutation(
      () =>
        TeacherGradebookAPI.updateTerm(targetTerm.id, {
          coefficient: parsedCoeff,
        }),
      'Erreur lors de la mise à jour du coefficient du trimestre.'
    );
  };

  const handleTriggerDelete = (type: ManagedEntityType, item: any) => {
    setActiveMenu(null);
    if (type === 'year') {
      const yr = item as SchoolYearItem;
      const linkedSchools = schools.filter(s => s.yearId === yr.id).length;
      const linkedLevels = studyLevels.filter(l => l.yearId === yr.id).length;
      const linkedClasses = classes.filter(c => c.yearId === yr.id).length;
      const linkedSubjects = subjects.filter(s => s.yearId === yr.id).length;
      setDeleteTarget({
        type: 'year',
        id: yr.id,
        name: yr.label,
        displayName: `la rentrée scolaire "${yr.label}"`,
        warningMessage: `Tout ce qui est lié à cette année (${linkedSchools} établissement(s), ${linkedLevels} niveau(x), ${linkedClasses} classe(s), ${linkedSubjects} matière(s), ainsi que tous les trimestres, élèves, photos de profil et notes) sera définitivement supprimé de votre compte.`
      });
    } else if (type === 'school') {
      const school = item as SchoolItem;
      const linkedLevels = studyLevels.filter(l => l.schoolId === school.id).length;
      const linkedClasses = classes.filter(c => c.schoolId === school.id).length;
      const linkedSubjects = subjects.filter(s => s.schoolId === school.id).length;
      setDeleteTarget({
        type: 'school',
        id: school.id,
        name: school.name,
        displayName: `l'établissement "${school.name}"`,
        warningMessage: `Tout ce qui est lié à cet établissement (${linkedLevels} niveau(x), ${linkedClasses} classe(s), ${linkedSubjects} matière(s), élèves, photos et notes) sera définitivement supprimé de votre compte.`
      });
    } else if (type === 'level') {
      const lvl = item as StudyLevelItem;
      const linkedClassIds = new Set(classes.filter(c => c.levelId === lvl.id).map(c => c.id));
      const linkedSubjects = subjects.filter(s => linkedClassIds.has(s.classId)).length;
      setDeleteTarget({
        type: 'level',
        id: lvl.id,
        name: lvl.name,
        displayName: `le niveau d'étude "${lvl.name}"`,
        warningMessage: `Tout ce qui est lié à ce niveau (${linkedClassIds.size} classe(s), ${linkedSubjects} matière(s), trimestres, élèves, photos et notes) sera définitivement supprimé de votre compte.`
      });
    } else if (type === 'class') {
      const cls = item as ClassItem;
      const fullName = getClassDisplayName(cls);
      const linkedSubjects = subjects.filter(s => s.classId === cls.id).length;
      setDeleteTarget({
        type: 'class',
        id: cls.id,
        name: fullName,
        displayName: `la classe "${fullName}"`,
        warningMessage: `Tout ce qui est lié à cette classe (${linkedSubjects} matière(s), trimestres, élèves enregistrés, photos et notes) sera définitivement supprimé de votre compte.`
      });
    } else if (type === 'term') {
      const trm = item as TermItem;
      const classTerms = terms.filter(t => t.classId === trm.classId).sort((a, b) => a.number - b.number);
      const linkedSubjects = subjects.filter(s => {
        if (s.classId !== trm.classId) return false;
        const effectiveTermId = s.termId || classTerms[0]?.id;
        return effectiveTermId === trm.id;
      }).length;
      setDeleteTarget({
        type: 'term',
        id: trm.id,
        name: trm.name,
        displayName: `le trimestre "${trm.name}"`,
        warningMessage: `Tout ce qui est lié à ce trimestre (${linkedSubjects} matière(s), ainsi que tous les élèves, photos de profil et notes) sera définitivement supprimé de votre compte.`
      });
    } else if (type === 'subject') {
      const subj = item as SubjectItem;
      setDeleteTarget({
        type: 'subject',
        id: subj.id,
        name: subj.name,
        displayName: `la matière "${subj.name}"`,
        warningMessage: "Toutes les évaluations, notes, photos d'élèves et coefficients associés à cette matière seront définitivement supprimés de votre compte."
      });
    }
    setDeleteConfirmInput('');
  };

  const handleConfirmDelete = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deleteTarget) return;
    if (deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) return;

    const targetType = deleteTarget.type;
    const id = deleteTarget.id;

    // Si hors ligne, bloquer proprement et afficher l'échec hors-ligne plutôt que de simuler une suppression non enregistrée
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setIsOnline(false);
      setSaveUiState('offline');
      setSaveFeedbackMessage("Hors ligne — Échec de la suppression : aucune connexion Internet détectée.");
      setDeleteTarget(null);
      setDeleteConfirmInput('');
      return;
    }

    setDeleteTarget(null);
    setDeleteConfirmInput('');

    if (targetType === 'year') {
      const deletedSubjectIds = subjects.filter(s => s.yearId === id).map(s => s.id);
      const ok = await runCloudMutation(
        () => TeacherGradebookAPI.deleteYear(id),
        "Erreur lors de la suppression de l'année scolaire."
      );
      if (ok) {
        setSchoolYears(prev => {
          const updated = prev.filter(y => y.id !== id);
          if (selectedYearId === id) {
            setSelectedYearId(updated[0]?.id || '');
          }
          return updated;
        });
        setSchools(prev => prev.filter(s => s.yearId !== id));
        setStudyLevels(prev => prev.filter(l => l.yearId !== id));
        setClasses(prev => prev.filter(c => c.yearId !== id));
        setTerms(prev => prev.filter(t => t.yearId !== id));
        setSubjects(prev => prev.filter(s => s.yearId !== id));
        setClassAverages(prev => prev.filter(ca => ca.yearId !== id));
        if (selectedSchoolInside?.yearId === id) setSelectedSchoolInside(null);
        if (selectedAverageCardInside?.yearId === id) setSelectedAverageCardInside(null);
        setEnteredClassId(null);
        setSelectedSchoolId(null);
        setSelectedLevelId(null);
        setSelectedClassId(null);
        setSelectedTermId(null);
        clearUserGradebookCaches(authUserId, deletedSubjectIds);
      }
    } else if (targetType === 'school') {
      const deletedSubjectIds = subjects.filter(s => s.schoolId === id).map(s => s.id);
      const ok = await runCloudMutation(
        () => TeacherGradebookAPI.deleteSchool(id),
        "Erreur lors de la suppression de l'établissement."
      );
      if (ok) {
        setSchools(prev => prev.filter(s => s.id !== id));
        setStudyLevels(prev => prev.filter(l => l.schoolId !== id));
        setClasses(prev => prev.filter(c => c.schoolId !== id));
        setSubjects(prev => prev.filter(s => s.schoolId !== id));
        setTerms(prev => prev.filter(t => t.schoolId !== id));
        setClassAverages(prev => prev.filter(ca => ca.schoolId !== id));
        if (selectedSchoolId === id) setSelectedSchoolId(null);
        if (selectedSchoolInside?.id === id) setSelectedSchoolInside(null);
        if (selectedAverageCardInside?.schoolId === id) setSelectedAverageCardInside(null);
        setEnteredClassId(null);
        setSelectedLevelId(null);
        setSelectedClassId(null);
        setSelectedTermId(null);
        clearUserGradebookCaches(authUserId, deletedSubjectIds);
      }
    } else if (targetType === 'level') {
      const deletedClassIds = new Set(classes.filter(c => c.levelId === id).map(c => c.id));
      const deletedSubjectIds = subjects.filter(s => deletedClassIds.has(s.classId)).map(s => s.id);
      const ok = await runCloudMutation(
        () => TeacherGradebookAPI.deleteLevel(id),
        'Erreur lors de la suppression du niveau.'
      );
      if (ok) {
        setStudyLevels(prev => prev.filter(l => l.id !== id));
        setClasses(prev => prev.filter(c => c.levelId !== id));
        setSubjects(prev => prev.filter(s => !deletedClassIds.has(s.classId)));
        setTerms(prev => prev.filter(t => !deletedClassIds.has(t.classId)));
        setClassAverages(prev => prev.filter(ca => !deletedClassIds.has(ca.classId)));
        if (selectedLevelId === id) setSelectedLevelId(null);
        if (selectedClassId && deletedClassIds.has(selectedClassId)) setSelectedClassId(null);
        if (enteredClassId && deletedClassIds.has(enteredClassId)) setEnteredClassId(null);
        if (selectedAverageCardInside && deletedClassIds.has(selectedAverageCardInside.classId)) setSelectedAverageCardInside(null);
        clearUserGradebookCaches(authUserId, deletedSubjectIds);
      }
    } else if (targetType === 'class') {
      const deletedSubjectIds = subjects.filter(s => s.classId === id).map(s => s.id);
      const ok = await runCloudMutation(
        () => TeacherGradebookAPI.deleteClass(id),
        'Erreur lors de la suppression de la classe.'
      );
      if (ok) {
        setClasses(prev => prev.filter(c => c.id !== id));
        setSubjects(prev => prev.filter(s => s.classId !== id));
        setTerms(prev => prev.filter(t => t.classId !== id));
        setClassAverages(prev => prev.filter(ca => ca.classId !== id));
        if (selectedClassId === id) setSelectedClassId(null);
        if (enteredClassId === id) setEnteredClassId(null);
        if (selectedAverageCardInside?.classId === id) setSelectedAverageCardInside(null);
        clearUserGradebookCaches(authUserId, deletedSubjectIds);
      }
    } else if (targetType === 'term') {
      const deletedTerm = terms.find(t => t.id === id);
      const deletedSubjectIds = subjects
        .filter(s => s.termId === id || (deletedTerm && s.classId === deletedTerm.classId && !s.termId))
        .map(s => s.id);
      const ok = await runCloudMutation(
        () => TeacherGradebookAPI.deleteTerm(id),
        'Erreur lors de la suppression du trimestre.'
      );
      if (ok) {
        setTerms(prev => prev.filter(t => t.id !== id));
        setSubjects(prev => prev.filter(s => !deletedSubjectIds.includes(s.id)));
        // Supprime uniquement la carte moyenne attachée à ce trimestre (la carte annuelle reste toujours présente)
        setClassAverages(prev => prev.filter(ca => ca.termId !== id));
        if (selectedTermId === id) setSelectedTermId(null);
        if (selectedSubjectInside && deletedSubjectIds.includes(selectedSubjectInside.id)) {
          setSelectedSubjectInside(null);
        }
        if (selectedAverageCardInside?.termId === id) {
          setSelectedAverageCardInside(null);
        }
        clearUserGradebookCaches(authUserId, deletedSubjectIds);
      }
    } else if (targetType === 'subject') {
      const ok = await runCloudMutation(
        () => TeacherGradebookAPI.deleteSubject(id),
        'Erreur lors de la suppression de la matière.'
      );
      if (ok) {
        setSubjects(prev => prev.filter(s => s.id !== id));
        if (selectedSubjectInside?.id === id) setSelectedSubjectInside(null);
        clearUserGradebookCaches(authUserId, [id]);
      }
    }
  };

  // État partagé de sauvegarde en lot (création multiple atomique connectée à la base)
  const [isBatchSaving, setIsBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  // État du modal "Créer / Modifier un niveau d'étude" (ex-menu de niveau CP1, Terminale, Licence...)
  const [isAddLevelModalOpen, setIsAddLevelModalOpen] = useState(false);
  const [studyLevelName, setStudyLevelName] = useState('');
  const [selectedStudyLevelColor, setSelectedStudyLevelColor] = useState(YEAR_COLOR_OPTIONS[0]);
  const [levelColorStyle, setLevelColorStyle] = useState<CardColorStyle>('accent');
  const [levelCreationMode, setLevelCreationMode] = useState<'single' | 'batch'>('single');
  const [batchLevelRows, setBatchLevelRows] = useState<Array<{ uid: string; name: string }>>(() => [
    { uid: makeBatchRowUid(), name: '' },
    { uid: makeBatchRowUid(), name: '' },
  ]);

  const resetLevelForm = () => {
    setStudyLevelName('');
    setSelectedStudyLevelColor(YEAR_COLOR_OPTIONS[0]);
    setLevelColorStyle('accent');
    setLevelCreationMode('single');
    setBatchLevelRows([
      { uid: makeBatchRowUid(), name: '' },
      { uid: makeBatchRowUid(), name: '' },
    ]);
    setBatchError(null);
    setEditingLevel(null);
  };

  const validBatchLevelNames = useMemo(
    () => batchLevelRows.map((r) => r.name.trim()).filter(Boolean),
    [batchLevelRows]
  );

  const handleToggleLevelBatchSuggestion = (sug: string) => {
    setBatchError(null);
    setBatchLevelRows((prev) => {
      const idx = prev.findIndex((r) => r.name.trim().toLowerCase() === sug.toLowerCase());
      if (idx >= 0) {
        const next = prev.filter((_, i) => i !== idx);
        return next.length > 0 ? next : [{ uid: makeBatchRowUid(), name: '' }];
      }
      const emptyIdx = prev.findIndex((r) => !r.name.trim());
      if (emptyIdx >= 0) {
        return prev.map((r, i) => (i === emptyIdx ? { ...r, name: sug } : r));
      }
      return [...prev, { uid: makeBatchRowUid(), name: sug }];
    });
  };

  const isLevelDirty = editingLevel
    ? (
        studyLevelName.trim() !== editingLevel.name ||
        selectedStudyLevelColor.bg !== (editingLevel.color || '#ffffff') ||
        levelColorStyle !== (editingLevel.colorStyle === 'full' ? 'full' : 'accent')
      )
    : levelCreationMode === 'batch'
    ? validBatchLevelNames.length > 0
    : studyLevelName.trim().length > 0;

  const handleCreateStudyLevel = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBatchSaving) return;

    if (!editingLevel && levelCreationMode === 'batch') {
      if (!selectedSchoolInside || validBatchLevelNames.length === 0) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setBatchError('Hors ligne — Vérifiez votre connexion Internet pour enregistrer.');
        return;
      }
      setIsBatchSaving(true);
      setBatchError(null);
      try {
        const res = await runCloudMutation(
          () =>
            TeacherGradebookAPI.batchCreateLevels(
              selectedSchoolInside.id,
              validBatchLevelNames.map((name) => ({
                id: generateTeacherEntityId('level'),
                name,
                color: selectedStudyLevelColor.bg,
                textColor: selectedStudyLevelColor.text,
                borderColor: selectedStudyLevelColor.border,
                colorStyle: levelColorStyle,
              }))
            ),
          'Erreur lors de la création des niveaux.'
        );
        if (res?.levels && res.levels.length > 0) {
          setStudyLevels((prev) => [...prev, ...res.levels]);
          setSelectedLevelId(res.levels[0].id);
          setIsAddLevelModalOpen(false);
          resetLevelForm();
        } else {
          setBatchError('Impossible d’enregistrer les niveaux. Veuillez réessayer.');
        }
      } finally {
        setIsBatchSaving(false);
      }
      return;
    }

    const cleanName = studyLevelName.trim();
    if (!cleanName) return;

    if (editingLevel) {
      if (!isLevelDirty) return;
      const updatedLevel: StudyLevelItem = {
        ...editingLevel,
        name: cleanName,
        color: selectedStudyLevelColor.bg,
        textColor: selectedStudyLevelColor.text,
        borderColor: selectedStudyLevelColor.border,
        colorStyle: levelColorStyle,
      };
      setStudyLevels(prev => prev.map(l => l.id === editingLevel.id ? updatedLevel : l));
      setClasses(prev => prev.map(c => c.levelId === editingLevel.id ? { ...c, level: cleanName } : c));
      setIsAddLevelModalOpen(false);
      resetLevelForm();
      runCloudMutation(
        () =>
          TeacherGradebookAPI.updateLevel(updatedLevel.id, {
            name: updatedLevel.name,
            color: updatedLevel.color,
            textColor: updatedLevel.textColor,
            borderColor: updatedLevel.borderColor,
            colorStyle: updatedLevel.colorStyle,
          }),
        'Erreur de mise à jour du niveau.'
      );
    } else {
      if (!selectedSchoolInside) return;
      const newLevel: StudyLevelItem = {
        id: generateTeacherEntityId('level'),
        schoolId: selectedSchoolInside.id,
        yearId: selectedSchoolInside.yearId,
        name: cleanName,
        color: selectedStudyLevelColor.bg,
        textColor: selectedStudyLevelColor.text,
        borderColor: selectedStudyLevelColor.border,
        colorStyle: levelColorStyle,
        createdAt: Date.now(),
      };
      setStudyLevels(prev => [...prev, newLevel]);
      setSelectedLevelId(newLevel.id);
      setIsAddLevelModalOpen(false);
      resetLevelForm();
      runCloudMutation(
        () =>
          TeacherGradebookAPI.createLevel({
            id: newLevel.id,
            schoolId: newLevel.schoolId,
            name: newLevel.name,
            color: newLevel.color,
            textColor: newLevel.textColor,
            borderColor: newLevel.borderColor,
            colorStyle: newLevel.colorStyle,
          }),
        'Erreur de création du niveau.'
      ).then((res) => {
        if (res?.level && res.level.id !== newLevel.id) {
          setStudyLevels(prev => prev.map(l => l.id === newLevel.id ? res.level : l));
          setSelectedLevelId(res.level.id);
        }
      });
    }
  };

  // État du modal "Ajouter / Modifier une classe" (à l'intérieur du niveau d'étude actif)
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [classSlogan, setClassSlogan] = useState('');
  const [classTeacherName, setClassTeacherName] = useState(user?.name || '');
  const [selectedClassColor, setSelectedClassColor] = useState(CLASS_COLOR_OPTIONS[0]); // Orange ambré style image
  const [classColorStyle, setClassColorStyle] = useState<CardColorStyle>('accent');
  const [classCreationMode, setClassCreationMode] = useState<'single' | 'batch'>('single');
  const [batchClassRows, setBatchClassRows] = useState<Array<{ uid: string; name: string; slogan: string }>>(() => [
    { uid: makeBatchRowUid(), name: '', slogan: '' },
    { uid: makeBatchRowUid(), name: '', slogan: '' },
  ]);

  const resetClassForm = () => {
    setClassName('');
    setClassSlogan('');
    setClassTeacherName(user?.name || 'Professeur');
    setSelectedClassColor(CLASS_COLOR_OPTIONS[0]);
    setClassColorStyle('accent');
    setClassCreationMode('single');
    setBatchClassRows([
      { uid: makeBatchRowUid(), name: '', slogan: '' },
      { uid: makeBatchRowUid(), name: '', slogan: '' },
    ]);
    setBatchError(null);
    setEditingClass(null);
  };

  const validBatchClassRows = useMemo(
    () => batchClassRows.filter((r) => r.name.trim().length > 0),
    [batchClassRows]
  );

  const handleToggleClassBatchSuggestion = (sug: string) => {
    setBatchError(null);
    setBatchClassRows((prev) => {
      const idx = prev.findIndex((r) => r.name.trim().toLowerCase() === sug.toLowerCase());
      if (idx >= 0) {
        const next = prev.filter((_, i) => i !== idx);
        return next.length > 0 ? next : [{ uid: makeBatchRowUid(), name: '', slogan: '' }];
      }
      const emptyIdx = prev.findIndex((r) => !r.name.trim());
      if (emptyIdx >= 0) {
        return prev.map((r, i) => (i === emptyIdx ? { ...r, name: sug } : r));
      }
      return [...prev, { uid: makeBatchRowUid(), name: sug, slogan: '' }];
    });
  };

  // Vérification de modification (Dirty) pour la classe
  const isClassDirty = editingClass
    ? (
        className.trim() !== (editingClass.name?.trim() || editingClass.level) ||
        classTeacherName.trim() !== editingClass.teacherName ||
        (classSlogan.trim() || '') !== (editingClass.slogan || '') ||
        selectedClassColor.bg !== editingClass.color ||
        classColorStyle !== (editingClass.colorStyle === 'full' ? 'full' : 'accent')
      )
    : classCreationMode === 'batch'
    ? (validBatchClassRows.length > 0 && classTeacherName.trim().length > 0)
    : (className.trim().length > 0 && classTeacherName.trim().length > 0);

  const handleCreateClass = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBatchSaving) return;

    if (!editingClass && classCreationMode === 'batch') {
      if (!selectedSchoolInside || !activeLevel || !classTeacherName.trim() || validBatchClassRows.length === 0) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setBatchError('Hors ligne — Vérifiez votre connexion Internet pour enregistrer.');
        return;
      }
      setIsBatchSaving(true);
      setBatchError(null);
      try {
        const res = await runCloudMutation(
          () =>
            TeacherGradebookAPI.batchCreateClasses(
              activeLevel.id,
              validBatchClassRows.map((row) => ({
                id: generateTeacherEntityId('class'),
                name: row.name.trim(),
                slogan: row.slogan.trim() || undefined,
                teacherName: classTeacherName.trim(),
                color: selectedClassColor.bg,
                textColor: selectedClassColor.text,
                borderColor: selectedClassColor.border,
                borderDarkColor: selectedClassColor.borderDark,
                colorStyle: classColorStyle,
                iconGradient: selectedClassColor.iconGradient,
              }))
            ),
          'Erreur lors de la création des classes.'
        );
        if (res?.classes && res.classes.length > 0) {
          setClasses((prev) => [...prev, ...res.classes]);
          if (Array.isArray(res.terms) && res.terms.length > 0) {
            setTerms((prev) => [...prev, ...res.terms]);
          }
          if (Array.isArray(res.classAverages) && res.classAverages.length > 0) {
            setClassAverages((prev) => [...prev, ...res.classAverages]);
          }
          setSelectedClassId(res.classes[0].id);
          const firstClassTerm = res.terms?.find((t) => t.classId === res.classes[0].id);
          if (firstClassTerm) setSelectedTermId(firstClassTerm.id);
          setIsAddClassModalOpen(false);
          resetClassForm();
        } else {
          setBatchError('Impossible d’enregistrer les classes. Veuillez réessayer.');
        }
      } finally {
        setIsBatchSaving(false);
      }
      return;
    }

    if (!className.trim() || !classTeacherName.trim()) return;

    if (editingClass) {
      if (!isClassDirty) return;
      const updated: ClassItem = {
        ...editingClass,
        name: className.trim(),
        slogan: classSlogan.trim() || undefined,
        teacherName: classTeacherName.trim(),
        color: selectedClassColor.bg,
        textColor: selectedClassColor.text,
        borderColor: selectedClassColor.border,
        borderDarkColor: selectedClassColor.borderDark,
        colorStyle: classColorStyle,
        iconGradient: selectedClassColor.iconGradient,
      };
      setClasses(prev => prev.map(c => c.id === editingClass.id ? updated : c));
      setIsAddClassModalOpen(false);
      resetClassForm();
      runCloudMutation(
        () =>
          TeacherGradebookAPI.updateClass(updated.id, {
            name: updated.name || '',
            slogan: updated.slogan,
            teacherName: updated.teacherName,
            color: updated.color,
            textColor: updated.textColor,
            borderColor: updated.borderColor,
            borderDarkColor: updated.borderDarkColor,
            colorStyle: updated.colorStyle,
            iconGradient: updated.iconGradient,
          }),
        'Erreur de mise à jour de la classe.'
      );
    } else {
      if (!selectedSchoolInside || !activeLevel) return;
      const newClassId = generateTeacherEntityId('class');
      const now = Date.now();
      const newClass: ClassItem = {
        id: newClassId,
        levelId: activeLevel.id,
        schoolId: selectedSchoolInside.id,
        yearId: selectedSchoolInside.yearId,
        level: activeLevel.name,
        name: className.trim(),
        slogan: classSlogan.trim() || undefined,
        teacherName: classTeacherName.trim(),
        color: selectedClassColor.bg,
        textColor: selectedClassColor.text,
        borderColor: selectedClassColor.border,
        borderDarkColor: selectedClassColor.borderDark,
        colorStyle: classColorStyle,
        iconGradient: selectedClassColor.iconGradient,
        createdAt: now
      };
      const defaultTerms: TermItem[] = [
        { id: generateTeacherEntityId('term1'), classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 1, name: 'Trimestre 1', createdAt: now },
        { id: generateTeacherEntityId('term2'), classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 2, name: 'Trimestre 2', createdAt: now + 1 },
        { id: generateTeacherEntityId('term3'), classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 3, name: 'Trimestre 3', createdAt: now + 2 }
      ];
      const optimisticClassAverages: ClassAverageCardItem[] = [
        {
          id: generateTeacherEntityId('cavg-annual'),
          classId: newClassId,
          schoolId: selectedSchoolInside.id,
          yearId: selectedSchoolInside.yearId,
          kind: 'annual',
          title: "Moyenne générale de l'année",
          sortOrder: 0,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: now,
        },
        ...defaultTerms.map((t) => ({
          id: generateTeacherEntityId(`cavg-t${t.number}`),
          classId: newClassId,
          termId: t.id,
          schoolId: selectedSchoolInside.id,
          yearId: selectedSchoolInside.yearId,
          kind: 'term' as const,
          title: `Moyenne générale · ${t.name}`,
          sortOrder: t.number,
          color: '#ffffff',
          textColor: '#0f172a',
          borderColor: '#e2e8f0',
          borderDarkColor: '#cbd5e1',
          createdAt: t.createdAt,
        })),
      ];
      setClasses(prev => [...prev, newClass]);
      setTerms(prev => [...prev, ...defaultTerms]);
      setClassAverages(prev => [...prev, ...optimisticClassAverages]);
      setSelectedClassId(newClass.id);
      setSelectedTermId(defaultTerms[0].id);
      setIsAddClassModalOpen(false);
      resetClassForm();
      runCloudMutation(
        () =>
          TeacherGradebookAPI.createClass({
            id: newClass.id,
            levelId: activeLevel.id,
            name: newClass.name || '',
            slogan: newClass.slogan,
            teacherName: newClass.teacherName,
            color: newClass.color,
            textColor: newClass.textColor,
            borderColor: newClass.borderColor,
            borderDarkColor: newClass.borderDarkColor,
            colorStyle: newClass.colorStyle,
            iconGradient: newClass.iconGradient,
            defaultTerms: defaultTerms.map(t => ({ id: t.id, number: t.number, name: t.name })),
          }),
        'Erreur de création de la classe.'
      ).then((res) => {
        if (res?.classItem) {
          if (res.classItem.id !== newClass.id) {
            setClasses(prev => prev.map(c => c.id === newClass.id ? res.classItem : c));
            setTerms(prev => [...prev.filter(t => t.classId !== newClass.id), ...res.terms]);
            setSelectedClassId(res.classItem.id);
            setSelectedTermId(res.terms[0]?.id || null);
          }
          if (Array.isArray(res.classAverages) && res.classAverages.length > 0) {
            setClassAverages(prev => [
              ...prev.filter(ca => ca.classId !== newClass.id && ca.classId !== res.classItem.id),
              ...res.classAverages!,
            ]);
          }
        }
      });
    }
  };

  // État du modal "Créer / Modifier une matière"
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCoefficient, setSubjectCoefficient] = useState<string>('');
  const [selectedSubjectColor, setSelectedSubjectColor] = useState(SUBJECT_COLOR_OPTIONS[0]); // Blanc par défaut
  const [subjectColorStyle, setSubjectColorStyle] = useState<CardColorStyle>('accent');
  const [subjectCreationMode, setSubjectCreationMode] = useState<'single' | 'batch'>('single');
  const [batchSubjectRows, setBatchSubjectRows] = useState<Array<{ uid: string; name: string; coeff: string }>>(() => [
    { uid: makeBatchRowUid(), name: '', coeff: '' },
    { uid: makeBatchRowUid(), name: '', coeff: '' },
  ]);

  const resetSubjectForm = () => {
    setSubjectName('');
    setSubjectCoefficient('');
    setSelectedSubjectColor(SUBJECT_COLOR_OPTIONS[0]);
    setSubjectColorStyle('accent');
    setSubjectCreationMode('single');
    setBatchSubjectRows([
      { uid: makeBatchRowUid(), name: '', coeff: '' },
      { uid: makeBatchRowUid(), name: '', coeff: '' },
    ]);
    setBatchError(null);
    setEditingSubject(null);
  };

  const validBatchSubjectRows = useMemo(
    () => batchSubjectRows.filter((r) => r.name.trim().length > 0),
    [batchSubjectRows]
  );

  const handleToggleSubjectBatchSuggestion = (sug: string) => {
    setBatchError(null);
    setBatchSubjectRows((prev) => {
      const idx = prev.findIndex((r) => r.name.trim().toLowerCase() === sug.toLowerCase());
      if (idx >= 0) {
        const next = prev.filter((_, i) => i !== idx);
        return next.length > 0 ? next : [{ uid: makeBatchRowUid(), name: '', coeff: '' }];
      }
      const emptyIdx = prev.findIndex((r) => !r.name.trim());
      if (emptyIdx >= 0) {
        return prev.map((r, i) => (i === emptyIdx ? { ...r, name: sug } : r));
      }
      return [...prev, { uid: makeBatchRowUid(), name: sug, coeff: '' }];
    });
  };

  // Vérification de modification (Dirty) pour la matière
  const origSubjectCoeff = (editingSubject?.coefficient !== undefined && editingSubject?.coefficient !== null)
    ? String(editingSubject.coefficient)
    : '';
  const isSubjectDirty = editingSubject
    ? (
        subjectName.trim() !== editingSubject.name ||
        subjectCoefficient.trim() !== origSubjectCoeff ||
        selectedSubjectColor.bg !== editingSubject.color ||
        subjectColorStyle !== (editingSubject.colorStyle === 'full' ? 'full' : 'accent')
      )
    : subjectCreationMode === 'batch'
    ? validBatchSubjectRows.length > 0
    : subjectName.trim().length > 0;

  const handleCreateSubject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBatchSaving) return;

    if (!editingSubject && subjectCreationMode === 'batch') {
      if (!activeClass || !selectedSchoolInside || validBatchSubjectRows.length === 0) return;
      const targetTermId = activeTerm?.id || currentClassTerms[0]?.id;
      if (!targetTermId) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setBatchError('Hors ligne — Vérifiez votre connexion Internet pour enregistrer.');
        return;
      }
      setIsBatchSaving(true);
      setBatchError(null);
      try {
        const payloadItems = validBatchSubjectRows.map((row) => {
          const cleaned = row.coeff.trim().replace(',', '.');
          const parsed = cleaned ? parseFloat(cleaned) : NaN;
          const coeff = Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null;
          return {
            id: generateTeacherEntityId('subject'),
            name: row.name.trim(),
            coefficient: coeff,
            color: selectedSubjectColor.bg,
            textColor: selectedSubjectColor.text,
            borderColor: selectedSubjectColor.border,
            borderDarkColor: selectedSubjectColor.borderDark,
            colorStyle: subjectColorStyle,
          };
        });
        const res = await runCloudMutation(
          () => TeacherGradebookAPI.batchCreateSubjects(activeClass.id, targetTermId, payloadItems),
          'Erreur lors de la création des matières.'
        );
        if (res?.subjects && res.subjects.length > 0) {
          setSubjects((prev) => [...prev, ...res.subjects]);
          setIsAddSubjectModalOpen(false);
          resetSubjectForm();
        } else {
          setBatchError('Impossible d’enregistrer les matières. Veuillez réessayer.');
        }
      } finally {
        setIsBatchSaving(false);
      }
      return;
    }

    if (!subjectName.trim()) return;

    const cleanedCoeff = subjectCoefficient.trim().replace(',', '.');
    const coeffNum = cleanedCoeff ? parseFloat(cleanedCoeff) : undefined;
    const parsedCoeff =
      coeffNum !== undefined && Number.isFinite(coeffNum) && coeffNum > 0
        ? Math.round(coeffNum * 100) / 100
        : undefined;

    if (editingSubject) {
      if (!isSubjectDirty) return;
      const updated: SubjectItem = {
        ...editingSubject,
        name: subjectName.trim(),
        coefficient: parsedCoeff,
        termId: editingSubject.termId || activeTerm?.id,
        color: selectedSubjectColor.bg,
        textColor: selectedSubjectColor.text,
        borderColor: selectedSubjectColor.border,
        borderDarkColor: selectedSubjectColor.borderDark,
        colorStyle: subjectColorStyle,
      };
      setSubjects(prev => prev.map(s => s.id === editingSubject.id ? updated : s));
      setIsAddSubjectModalOpen(false);
      resetSubjectForm();
      runCloudMutation(
        () =>
          TeacherGradebookAPI.updateSubject(updated.id, {
            name: updated.name,
            coefficient: parsedCoeff ?? null,
            color: updated.color,
            textColor: updated.textColor,
            borderColor: updated.borderColor,
            borderDarkColor: updated.borderDarkColor,
            colorStyle: updated.colorStyle,
          }),
        'Erreur de mise à jour de la matière.'
      );
    } else {
      if (!activeClass || !selectedSchoolInside) return;
      const targetTermId = activeTerm?.id || currentClassTerms[0]?.id;
      if (!targetTermId) return;
      const newSubject: SubjectItem = {
        id: generateTeacherEntityId('subject'),
        classId: activeClass.id,
        termId: targetTermId,
        schoolId: selectedSchoolInside.id,
        yearId: selectedSchoolInside.yearId,
        name: subjectName.trim(),
        coefficient: parsedCoeff,
        color: selectedSubjectColor.bg,
        textColor: selectedSubjectColor.text,
        borderColor: selectedSubjectColor.border,
        borderDarkColor: selectedSubjectColor.borderDark,
        colorStyle: subjectColorStyle,
        createdAt: Date.now()
      };
      setSubjects(prev => [...prev, newSubject]);
      const nextCount = currentClassSubjects.length + 1;
      const targetPage = Math.floor((nextCount - 1) / 17);
      if (targetPage !== subjectPageIndex) {
        setSubjectPageIndex(targetPage);
      }
      setIsAddSubjectModalOpen(false);
      resetSubjectForm();
      runCloudMutation(
        () =>
          TeacherGradebookAPI.createSubject({
            id: newSubject.id,
            classId: newSubject.classId,
            termId: targetTermId,
            name: newSubject.name,
            coefficient: parsedCoeff ?? null,
            color: newSubject.color,
            textColor: newSubject.textColor,
            borderColor: newSubject.borderColor,
            borderDarkColor: newSubject.borderDarkColor,
            colorStyle: newSubject.colorStyle,
          }),
        'Erreur de création de la matière.'
      ).then((res) => {
        if (res?.subject) {
          setSubjects(prev => prev.map(s => s.id === newSubject.id ? res.subject : s));
        }
      });
    }
  };

  // État du modal "Ajouter une école"
  const [isAddSchoolModalOpen, setIsAddSchoolModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolLogoOriginalSize, setSchoolLogoOriginalSize] = useState<number>(0);
  const [selectedSchoolColor, setSelectedSchoolColor] = useState(SCHOOL_COLOR_OPTIONS[0]); // Blanc par défaut
  const [schoolColorStyle, setSchoolColorStyle] = useState<CardColorStyle>('full');
  const [schoolCreationMode, setSchoolCreationMode] = useState<'single' | 'batch'>('single');
  const [batchSchoolRows, setBatchSchoolRows] = useState<Array<{ uid: string; name: string; logoDataUrl: string | null; logoOriginalSizeBytes?: number }>>(() => [
    { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
    { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
  ]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetSchoolForm = () => {
    setSchoolName('');
    setSchoolLogo(null);
    setSchoolLogoOriginalSize(0);
    setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
    setSchoolColorStyle('full');
    setSchoolCreationMode('single');
    setBatchSchoolRows([
      { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
      { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
    ]);
    setBatchError(null);
    setEditingSchool(null);
  };

  const validBatchSchoolRows = useMemo(
    () => batchSchoolRows.filter((r) => r.name.trim().length > 0),
    [batchSchoolRows]
  );

  // Compression & chargement du logo de l'école (format rond max 256x256 px pour préserver le stockage, tout en facturant la taille brute d'origine)
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const origBytes = Math.max(0, Number(file.size) || 0);
    const dataUrl = await compressLogoFileToDataUrl(file);
    if (dataUrl) {
      setSchoolLogo(dataUrl);
      setSchoolLogoOriginalSize(origBytes);
    }
  };

  const handleBatchSchoolLogoUpload = async (rowUid: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const origBytes = Math.max(0, Number(file.size) || 0);
    const dataUrl = await compressLogoFileToDataUrl(file);
    if (dataUrl) {
      setBatchSchoolRows((prev) =>
        prev.map((r) => (r.uid === rowUid ? { ...r, logoDataUrl: dataUrl, logoOriginalSizeBytes: origBytes } : r))
      );
    }
    e.target.value = '';
  };

  // Vérification de modification (Dirty) pour l'école
  const isSchoolDirty = editingSchool
    ? (
        schoolName.trim() !== editingSchool.name ||
        (schoolLogo || null) !== (editingSchool.logoUrl || null) ||
        selectedSchoolColor.bg !== editingSchool.color ||
        schoolColorStyle !== (editingSchool.colorStyle === 'accent' ? 'accent' : 'full')
      )
    : schoolCreationMode === 'batch'
    ? validBatchSchoolRows.length > 0
    : schoolName.trim().length > 0;

  // Création ou modification d'une école (D1 + logo privé R2)
  const handleCreateSchool = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBatchSaving) return;

    if (!editingSchool && schoolCreationMode === 'batch') {
      if (!selectedYearId || validBatchSchoolRows.length === 0) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setBatchError('Hors ligne — Vérifiez votre connexion Internet pour enregistrer.');
        return;
      }
      setIsBatchSaving(true);
      setBatchError(null);
      try {
        const res = await runCloudMutation(
          () =>
            TeacherGradebookAPI.batchCreateSchools(
              selectedYearId,
              validBatchSchoolRows.map((row) => ({
                id: generateTeacherEntityId('school'),
                name: row.name.trim(),
                logoDataUrl: row.logoDataUrl,
                logoOriginalSizeBytes: row.logoOriginalSizeBytes,
                color: selectedSchoolColor.bg,
                textColor: selectedSchoolColor.text,
                borderColor: selectedSchoolColor.border,
                borderDarkColor: selectedSchoolColor.borderDark,
                colorStyle: schoolColorStyle,
              }))
            ),
          'Erreur lors de la création des établissements.'
        );
        if (res?.schools && res.schools.length > 0) {
          const existingCountInYear = schools.filter((s) => s.yearId === selectedYearId).length;
          const targetPage = getTeacherSchoolPageForIndex(existingCountInYear);
          setSchools((prev) => [...prev, ...res.schools]);
          setSelectedSchoolId(res.schools[0].id);
          if (selectedYearId) {
            setSchoolsPageByYear((prev) => ({ ...prev, [selectedYearId]: targetPage }));
          }
          setIsAddSchoolModalOpen(false);
          resetSchoolForm();
        } else {
          setBatchError('Impossible d’enregistrer les établissements. Veuillez réessayer.');
        }
      } finally {
        setIsBatchSaving(false);
      }
      return;
    }

    const cleanName = schoolName.trim();
    if (!cleanName) return;

    if (editingSchool) {
      if (!isSchoolDirty) return;
      const pickedNewDataUrl = schoolLogo && schoolLogo.startsWith('data:image/') ? schoolLogo : null;
      const removedLogo = Boolean(editingSchool.logoUrl && !schoolLogo);
      const updated: SchoolItem = {
        ...editingSchool,
        name: cleanName,
        logoUrl: schoolLogo || undefined,
        logoR2Key: removedLogo ? undefined : editingSchool.logoR2Key,
        color: selectedSchoolColor.bg,
        textColor: selectedSchoolColor.text,
        borderColor: selectedSchoolColor.border,
        borderDarkColor: selectedSchoolColor.borderDark,
        colorStyle: schoolColorStyle,
      };
      setSchools(prev => prev.map(s => s.id === editingSchool.id ? updated : s));
      if (selectedSchoolInside?.id === editingSchool.id) {
        setSelectedSchoolInside(updated);
      }
      const targetId = editingSchool.id;
      setIsAddSchoolModalOpen(false);
      setEditingSchool(null);
      const pickedLogoSize = pickedNewDataUrl ? schoolLogoOriginalSize : 0;
      runCloudMutation(
        () =>
          TeacherGradebookAPI.updateSchool(targetId, {
            name: updated.name,
            logoDataUrl: pickedNewDataUrl,
            logoOriginalSizeBytes: pickedLogoSize,
            removeLogo: removedLogo,
            color: updated.color,
            textColor: updated.textColor,
            borderColor: updated.borderColor,
            borderDarkColor: updated.borderDarkColor,
            colorStyle: updated.colorStyle,
          }),
        "Erreur de mise à jour de l'établissement."
      ).then((res) => {
        if (res?.school) {
          setSchools(prev => prev.map(s => s.id === targetId ? res.school : s));
          setSelectedSchoolInside(prev => (prev?.id === targetId ? res.school : prev));
        }
      });
    } else {
      if (!selectedYearId) return;
      const pickedDataUrl = schoolLogo && schoolLogo.startsWith('data:image/') ? schoolLogo : null;
      const pickedLogoSize = pickedDataUrl ? schoolLogoOriginalSize : 0;
      const newSchool: SchoolItem = {
        id: generateTeacherEntityId('school'),
        yearId: selectedYearId,
        name: cleanName,
        logoUrl: schoolLogo || undefined,
        color: selectedSchoolColor.bg,
        textColor: selectedSchoolColor.text,
        borderColor: selectedSchoolColor.border,
        borderDarkColor: selectedSchoolColor.borderDark,
        colorStyle: schoolColorStyle,
        createdAt: Date.now(),
      };

      const existingCountInYear = schools.filter((s) => s.yearId === selectedYearId).length;
      const targetPage = getTeacherSchoolPageForIndex(existingCountInYear);
      setSchools(prev => [...prev, newSchool]);
      setSelectedSchoolId(newSchool.id);
      setSchoolsPageByYear((prev) => ({ ...prev, [selectedYearId]: targetPage }));
      setIsAddSchoolModalOpen(false);
      runCloudMutation(
        () =>
          TeacherGradebookAPI.createSchool({
            id: newSchool.id,
            yearId: newSchool.yearId,
            name: newSchool.name,
            logoDataUrl: pickedDataUrl,
            logoOriginalSizeBytes: pickedLogoSize,
            color: newSchool.color,
            textColor: newSchool.textColor,
            borderColor: newSchool.borderColor,
            borderDarkColor: newSchool.borderDarkColor,
            colorStyle: newSchool.colorStyle,
          }),
        "Erreur de création de l'établissement."
      ).then((res) => {
        if (res?.school) {
          setSchools(prev => prev.map(s => s.id === newSchool.id ? res.school : s));
          setSelectedSchoolId(res.school.id);
        }
      });
    }

    setSchoolName('');
    setSchoolLogo(null);
    setSchoolLogoOriginalSize(0);
    setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
    setSchoolColorStyle('full');
  };

  // État du menu déroulant "Créer une rentrée scolaire"
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [inputYearValue, setInputYearValue] = useState(`${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`);
  const [selectedColorObj, setSelectedColorObj] = useState(YEAR_COLOR_OPTIONS[0]); // Par défaut blanc / aucune couleur
  const [selectedYearColorStyle, setSelectedYearColorStyle] = useState<CardColorStyle>('full');
  const [yearCreationMode, setYearCreationMode] = useState<'single' | 'batch'>('single');
  const [batchYearRows, setBatchYearRows] = useState<Array<{ uid: string; label: string }>>(() => [
    { uid: makeBatchRowUid(), label: `${CURRENT_YEAR} - ${CURRENT_YEAR + 1}` },
    { uid: makeBatchRowUid(), label: `${CURRENT_YEAR + 1} - ${CURRENT_YEAR + 2}` },
  ]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const validBatchYearLabels = useMemo(() => {
    const existingSet = new Set(schoolYears.map((y) => y.label.trim().toLowerCase()));
    const seen = new Set<string>();
    const out: string[] = [];
    for (const row of batchYearRows) {
      const clean = row.label.trim();
      if (!clean) continue;
      const low = clean.toLowerCase();
      if (existingSet.has(low) || seen.has(low)) continue;
      seen.add(low);
      out.push(clean);
    }
    return out;
  }, [batchYearRows, schoolYears]);

  const handleToggleYearBatchSuggestion = (sug: string) => {
    setBatchError(null);
    setBatchYearRows((prev) => {
      const idx = prev.findIndex((r) => r.label.trim().toLowerCase() === sug.toLowerCase());
      if (idx >= 0) {
        const next = prev.filter((_, i) => i !== idx);
        return next.length > 0 ? next : [{ uid: makeBatchRowUid(), label: '' }];
      }
      const emptyIdx = prev.findIndex((r) => !r.label.trim());
      if (emptyIdx >= 0) {
        return prev.map((r, i) => (i === emptyIdx ? { ...r, label: sug } : r));
      }
      return [...prev, { uid: makeBatchRowUid(), label: sug }];
    });
  };

  // Gestion de la saisie manuelle : Uniquement chiffres et tiret/espace, max 12 caractères
  const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Seulement les chiffres, espaces et tirets sont autorisés, max 12 caractères
    const filtered = raw.replace(/[^0-9\s-]/g, '').slice(0, 12);
    setInputYearValue(filtered);
  };

  // Création / Application de l'année scolaire (D1)
  const handleApplyYear = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isBatchSaving) return;

    if (yearCreationMode === 'batch') {
      if (validBatchYearLabels.length === 0) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setBatchError('Hors ligne — Vérifiez votre connexion Internet pour enregistrer.');
        return;
      }
      setIsBatchSaving(true);
      setBatchError(null);
      try {
        const res = await runCloudMutation(
          () =>
            TeacherGradebookAPI.batchCreateYears(
              validBatchYearLabels.map((label) => ({
                id: generateTeacherEntityId('year'),
                label,
                color: selectedColorObj.bg,
                textColor: selectedColorObj.text,
                colorStyle: selectedYearColorStyle,
              }))
            ),
          'Erreur lors de la création des rentrées scolaires.'
        );
        if (res?.years && res.years.length > 0) {
          setSchoolYears((prev) => [...prev, ...res.years]);
          setSelectedYearId(res.years[0].id);
          setIsCreateMenuOpen(false);
          setYearCreationMode('single');
          setBatchError(null);
        } else {
          setBatchError('Aucune nouvelle rentrée créée (peut-être déjà existante).');
        }
      } finally {
        setIsBatchSaving(false);
      }
      return;
    }

    const cleanLabel = inputYearValue.trim();
    if (!cleanLabel) return;

    const existing = schoolYears.find(y => y.label.toLowerCase() === cleanLabel.toLowerCase());
    if (existing) {
      setSelectedYearId(existing.id);
      setIsCreateMenuOpen(false);
      return;
    }

    const newYearItem: SchoolYearItem = {
      id: generateTeacherEntityId('year'),
      label: cleanLabel,
      color: selectedColorObj.bg,
      textColor: selectedColorObj.text,
      colorStyle: selectedYearColorStyle,
      createdAt: Date.now()
    };

    setSchoolYears(prev => [...prev, newYearItem]);
    setSelectedYearId(newYearItem.id);
    setIsCreateMenuOpen(false);
    runCloudMutation(
      () =>
        TeacherGradebookAPI.createYear({
          id: newYearItem.id,
          label: newYearItem.label,
          color: newYearItem.color,
          textColor: newYearItem.textColor,
          colorStyle: newYearItem.colorStyle,
        }),
      "Erreur de création de l'année scolaire."
    ).then((res) => {
      if (res?.year && res.year.id !== newYearItem.id) {
        setSchoolYears(prev => prev.map(y => y.id === newYearItem.id ? res.year : y));
        setSelectedYearId(res.year.id);
      }
    });
  };

  // Modification d'une rentrée scolaire existante (via bouton 3 traits -> Modifier)
  const isEditYearDirty = editingYear
    ? (
        editYearLabel.trim() !== editingYear.label ||
        editYearColorObj.bg !== editingYear.color ||
        editYearColorStyle !== (editingYear.colorStyle === 'accent' ? 'accent' : 'full')
      )
    : false;

  const handleSaveEditYear = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingYear || !isEditYearDirty) return;
    const cleanLabel = editYearLabel.trim();
    if (!cleanLabel) return;

    const updatedYear: SchoolYearItem = {
      ...editingYear,
      label: cleanLabel,
      color: editYearColorObj.bg,
      textColor: editYearColorObj.text,
      colorStyle: editYearColorStyle,
    };
    const targetId = editingYear.id;
    setSchoolYears(prev => prev.map(y => y.id === targetId ? updatedYear : y));
    setEditingYear(null);
    runCloudMutation(
      () =>
        TeacherGradebookAPI.updateYear(targetId, {
          label: updatedYear.label,
          color: updatedYear.color,
          textColor: updatedYear.textColor,
          colorStyle: updatedYear.colorStyle,
        }),
      "Erreur de mise à jour de l'année scolaire."
    );
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trainees', label: 'Trainees', icon: Users },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
    { id: 'groups', label: 'Groups', icon: Users2 },
    { id: 'library', label: 'Library', icon: Layers },
  ] as const;

  const currentSelectedYear = schoolYears.find(y => y.id === selectedYearId) || schoolYears[0];
  const currentYearSchools = schools.filter(s => s.yearId === currentSelectedYear?.id);

  // Niveaux d'étude de l'école sélectionnée
  const currentSchoolLevels = useMemo(() => {
    if (!selectedSchoolInside) return [];
    return studyLevels.filter(l => l.schoolId === selectedSchoolInside.id);
  }, [studyLevels, selectedSchoolInside]);

  // Niveau d'étude actif (sélectionné via la barre horizontale mince)
  const activeLevel = (selectedLevelId && currentSchoolLevels.find(l => l.id === selectedLevelId))
    || currentSchoolLevels[0]
    || null;

  // Assurer que selectedLevelId pointe toujours vers un niveau valide si disponible
  useEffect(() => {
    if (pendingNavRestoreRef.current) return;
    if (currentSchoolLevels.length > 0) {
      if (!selectedLevelId || !currentSchoolLevels.some(l => l.id === selectedLevelId)) {
        setSelectedLevelId(currentSchoolLevels[0].id);
      }
    } else {
      setSelectedLevelId(null);
    }
  }, [currentSchoolLevels, selectedLevelId]);

  // Classes rattachées au niveau d'étude actif dans l'école sélectionnée
  const currentLevelClasses = useMemo(() => {
    if (!selectedSchoolInside || !activeLevel) return [];
    return classes.filter(c => c.schoolId === selectedSchoolInside.id && c.levelId === activeLevel.id);
  }, [classes, selectedSchoolInside, activeLevel]);

  // Classe active (sélectionnée via les cartes boutons horizontales 3D compactes)
  const activeClass = (selectedClassId && currentLevelClasses.find(c => c.id === selectedClassId))
    || currentLevelClasses[0]
    || null;

  // Assurer que selectedClassId pointe toujours vers une classe valide dans le niveau actif
  useEffect(() => {
    if (pendingNavRestoreRef.current) return;
    if (currentLevelClasses.length > 0) {
      if (!selectedClassId || !currentLevelClasses.some(c => c.id === selectedClassId)) {
        setSelectedClassId(currentLevelClasses[0].id);
      }
    } else {
      setSelectedClassId(null);
    }
  }, [currentLevelClasses, selectedClassId]);

  // Trimestres de la classe active (Trimestre 1, Trimestre 2, Trimestre 3...)
  const currentClassTerms = useMemo(() => {
    if (!activeClass) return [];
    return terms
      .filter(t => t.classId === activeClass.id)
      .sort((a, b) => a.number - b.number);
  }, [terms, activeClass]);

  // Trimestre actif
  const activeTerm = (selectedTermId && currentClassTerms.find(t => t.id === selectedTermId))
    || currentClassTerms[0]
    || null;

  // Assurer que selectedTermId pointe toujours vers un trimestre valide
  useEffect(() => {
    if (pendingNavRestoreRef.current) return;
    if (currentClassTerms.length > 0) {
      if (!selectedTermId || !currentClassTerms.some(t => t.id === selectedTermId)) {
        setSelectedTermId(currentClassTerms[0].id);
      }
    } else {
      setSelectedTermId(null);
    }
  }, [currentClassTerms, selectedTermId]);

  // Prochain numéro de trimestre pour l'ajout
  const nextTermNumber = useMemo(() => {
    if (currentClassTerms.length === 0) return 1;
    return Math.max(...currentClassTerms.map(t => t.number)) + 1;
  }, [currentClassTerms]);

  // Nombre de trimestres à créer d'un coup (1 par défaut, jusqu'à 4 d'un coup)
  const [termBatchCount, setTermBatchCount] = useState<number>(1);
  const [batchTermCoeffs, setBatchTermCoeffs] = useState<string[]>(['', '', '', '']);

  // Confirmation de l'ajout d'un ou plusieurs trimestres (+ coefficients facultatifs) pour la classe active
  const handleConfirmAddTerm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeClass || !selectedSchoolInside || isBatchSaving) return;

    if (termBatchCount > 1) {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setBatchError('Hors ligne — Vérifiez votre connexion Internet pour enregistrer.');
        return;
      }
      const itemsToCreate: Array<{ id: string; number: number; name: string; coefficient: number | null }> = [];
      for (let i = 0; i < termBatchCount; i++) {
        const num = nextTermNumber + i;
        const rawC = (batchTermCoeffs[i] || '').trim().replace(',', '.');
        let parsedC: number | null = null;
        if (rawC !== '') {
          const n = Number(rawC);
          if (!Number.isFinite(n) || n <= 0) {
            setBatchError(`Coefficient invalide pour Trimestre ${num}.`);
            return;
          }
          parsedC = Math.round(n * 100) / 100;
        }
        itemsToCreate.push({
          id: generateTeacherEntityId('term'),
          number: num,
          name: `Trimestre ${num}`,
          coefficient: parsedC,
        });
      }
      setIsBatchSaving(true);
      setBatchError(null);
      try {
        const res = await runCloudMutation(
          () => TeacherGradebookAPI.batchCreateTerms(activeClass.id, itemsToCreate),
          'Erreur lors de la création des trimestres.'
        );
        if (res?.terms && res.terms.length > 0) {
          setTerms((prev) => [...prev, ...res.terms]);
          if (Array.isArray(res.classAverages) && res.classAverages.length > 0) {
            setClassAverages((prev) => [...prev, ...res.classAverages]);
          }
          setSelectedTermId(res.terms[0].id);
          setIsAddTermPopoverOpen(false);
          setNewTermCoeffInput('');
          setTermBatchCount(1);
          setBatchTermCoeffs(['', '', '', '']);
        } else {
          setBatchError('Impossible d’enregistrer les trimestres.');
        }
      } finally {
        setIsBatchSaving(false);
      }
      return;
    }

    const cleanedCoeff = newTermCoeffInput.trim().replace(',', '.');
    let parsedCoeff: number | undefined = undefined;
    if (cleanedCoeff !== '') {
      const n = Number(cleanedCoeff);
      if (!Number.isFinite(n) || n <= 0) return;
      parsedCoeff = Math.round(n * 100) / 100;
    }

    const newTerm: TermItem = {
      id: generateTeacherEntityId('term'),
      classId: activeClass.id,
      schoolId: selectedSchoolInside.id,
      yearId: selectedSchoolInside.yearId,
      number: nextTermNumber,
      name: `Trimestre ${nextTermNumber}`,
      coefficient: parsedCoeff,
      createdAt: Date.now()
    };
    const optimisticTermAvg: ClassAverageCardItem = {
      id: generateTeacherEntityId('cavg'),
      classId: activeClass.id,
      termId: newTerm.id,
      schoolId: selectedSchoolInside.id,
      yearId: selectedSchoolInside.yearId,
      kind: 'term',
      title: `Moyenne générale · ${newTerm.name}`,
      sortOrder: newTerm.number,
      color: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      borderDarkColor: '#cbd5e1',
      createdAt: newTerm.createdAt,
    };
    setTerms(prev => [...prev, newTerm]);
    setClassAverages(prev => [...prev, optimisticTermAvg]);
    setSelectedTermId(newTerm.id);
    setIsAddTermPopoverOpen(false);
    setNewTermCoeffInput('');
    runCloudMutation(
      () =>
        TeacherGradebookAPI.createTerm({
          id: newTerm.id,
          classId: newTerm.classId,
          number: newTerm.number,
          name: newTerm.name,
          coefficient: parsedCoeff ?? null,
        }),
      'Erreur de création du trimestre.'
    ).then((res) => {
      if (res?.term) {
        setTerms(prev => prev.map(t => t.id === newTerm.id ? res.term : t));
        if (res.term.id !== newTerm.id) {
          setSelectedTermId(res.term.id);
        }
      }
      if (res?.classAverage) {
        setClassAverages(prev =>
          prev.map(ca => (ca.id === optimisticTermAvg.id ? res.classAverage! : ca))
        );
      }
    });
  };

  // Matières de la classe active DANS LE TRIMESTRE ACTIF SÉLECTIONNÉ
  const currentClassSubjects = useMemo(() => {
    if (!activeClass || !activeTerm) return [];
    return subjects.filter(s => {
      if (s.classId !== activeClass.id) return false;
      const effectiveTermId = s.termId || currentClassTerms[0]?.id;
      return effectiveTermId === activeTerm.id;
    });
  }, [subjects, activeClass, activeTerm, currentClassTerms]);

  // Réinitialiser les recherches locales lors des changements de contexte
  useEffect(() => {
    setSchoolSearchQuery('');
    setIsSchoolSearchOpen(false);
  }, [selectedYearId]);

  useEffect(() => {
    setLevelSearchQuery('');
    setIsLevelSearchOpen(false);
    setClassSearchQuery('');
    setIsClassSearchOpen(false);
    setSubjectSearchQuery('');
    setIsSubjectSearchOpen(false);
  }, [selectedSchoolInside?.id]);

  useEffect(() => {
    setClassSearchQuery('');
    setIsClassSearchOpen(false);
  }, [selectedLevelId]);

  useEffect(() => {
    setSubjectSearchQuery('');
    setIsSubjectSearchOpen(false);
  }, [selectedLevelId, selectedClassId, selectedTermId]);

  // Listes filtrées par les champs de recherche rapides de chaque section
  const filteredYearSchools = useMemo(() => {
    const q = normalizeSearchText(schoolSearchQuery);
    if (!q) return currentYearSchools;
    return currentYearSchools.filter(s => normalizeSearchText(s.name).includes(q));
  }, [currentYearSchools, schoolSearchQuery]);

  // --- PAGINATION HORIZONTALE DES ÉTABLISSEMENTS SCOLAIRES (3 LIGNES x 4 COLONNES = 12 CASES : 1 BOUTON "+" + 11 ÉCOLES / PAGE) ---
  const effectiveSchoolsYearId = currentSelectedYear?.id || selectedYearId;
  const isSchoolSearchActive = schoolSearchQuery.trim().length > 0;
  const schoolPages = useMemo(
    () => paginateTeacherSchools(filteredYearSchools),
    [filteredYearSchools]
  );
  const totalSchoolPages = schoolPages.length;
  const rawSchoolsPageIndex = isSchoolSearchActive
    ? searchSchoolsPageIndex
    : effectiveSchoolsYearId
    ? schoolsPageByYear[effectiveSchoolsYearId] || 0
    : 0;
  const safeSchoolsPageIndex = Math.max(
    0,
    Math.min(rawSchoolsPageIndex, Math.max(0, totalSchoolPages - 1))
  );

  const handleGoToSchoolsPage = useCallback(
    (targetPage: number) => {
      const clamped = Math.max(0, Math.min(targetPage, Math.max(0, totalSchoolPages - 1)));
      if (isSchoolSearchActive) {
        setSearchSchoolsPageIndex(clamped);
        return;
      }
      if (!effectiveSchoolsYearId) return;
      setSchoolsPageByYear((prev) => {
        if ((prev[effectiveSchoolsYearId] || 0) === clamped) return prev;
        const nextMap = { ...prev, [effectiveSchoolsYearId]: clamped };
        currentNavPayloadRef.current = {
          ...currentNavPayloadRef.current,
          schoolsPageIndex: clamped,
          schoolsPageByYear: nextMap,
        };
        if (authUserId && !pendingNavRestoreRef.current) {
          writeTeacherNavSnapshot(authUserId, currentNavPayloadRef.current);
        }
        return nextMap;
      });
    },
    [totalSchoolPages, isSchoolSearchActive, effectiveSchoolsYearId, authUserId]
  );

  // Réinitialiser la page de recherche uniquement quand la requête texte change
  useEffect(() => {
    setSearchSchoolsPageIndex(0);
  }, [schoolSearchQuery]);

  // Recaler la page sauvegardée si des écoles ont été supprimées (uniquement après hydratation cloud complète)
  useEffect(() => {
    if (isSchoolSearchActive || pendingNavRestoreRef.current || !isCloudHydratedRef.current) return;
    if (!effectiveSchoolsYearId) return;
    const saved = schoolsPageByYear[effectiveSchoolsYearId] || 0;
    const maxPage = Math.max(0, totalSchoolPages - 1);
    if (saved > maxPage) {
      setSchoolsPageByYear((prev) => ({ ...prev, [effectiveSchoolsYearId]: maxPage }));
    }
  }, [isSchoolSearchActive, effectiveSchoolsYearId, schoolsPageByYear, totalSchoolPages]);

  // Navigation clavier Gauche / Droite sur les pages d'établissements scolaires
  useEffect(() => {
    if (
      selectedSchoolInside ||
      isTransferViewOpen ||
      isAddSchoolModalOpen ||
      Boolean(editingSchool) ||
      Boolean(deleteTarget) ||
      isCreateMenuOpen ||
      totalSchoolPages <= 1
    ) {
      return;
    }
    const handleArrowNav = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft' && safeSchoolsPageIndex > 0) {
        e.preventDefault();
        handleGoToSchoolsPage(safeSchoolsPageIndex - 1);
      } else if (e.key === 'ArrowRight' && safeSchoolsPageIndex < totalSchoolPages - 1) {
        e.preventDefault();
        handleGoToSchoolsPage(safeSchoolsPageIndex + 1);
      }
    };
    window.addEventListener('keydown', handleArrowNav);
    return () => window.removeEventListener('keydown', handleArrowNav);
  }, [
    selectedSchoolInside,
    isTransferViewOpen,
    isAddSchoolModalOpen,
    editingSchool,
    deleteTarget,
    isCreateMenuOpen,
    totalSchoolPages,
    safeSchoolsPageIndex,
    handleGoToSchoolsPage,
  ]);

  const filteredSchoolLevels = useMemo(() => {
    const q = normalizeSearchText(levelSearchQuery);
    if (!q) return currentSchoolLevels;
    return currentSchoolLevels.filter(l => normalizeSearchText(l.name).includes(q));
  }, [currentSchoolLevels, levelSearchQuery]);

  const filteredLevelClasses = useMemo(() => {
    const q = normalizeSearchText(classSearchQuery);
    if (!q) return currentLevelClasses;
    return currentLevelClasses.filter(c => {
      const hay = normalizeSearchText(`${getClassDisplayName(c)} ${c.level} ${c.slogan || ''} ${c.teacherName}`);
      return hay.includes(q);
    });
  }, [currentLevelClasses, classSearchQuery]);

  const filteredClassSubjects = useMemo(() => {
    const q = normalizeSearchText(subjectSearchQuery);
    if (!q) return currentClassSubjects;
    return currentClassSubjects.filter(s => normalizeSearchText(s.name).includes(q));
  }, [currentClassSubjects, subjectSearchQuery]);

  // --- GESTION PAR ESPACE / PAGE DE 3 LIGNES (1 BOUTON FIXE "+ MATIÈRE" + 17 MATIÈRES = 18 EMPLACEMENTS) ---
  const SUBJECTS_PER_PAGE = 17; // 1 bouton fixe devant + 17 matières = 3 lignes de 6 colonnes
  const [subjectPageIndex, setSubjectPageIndex] = useState<number>(0);

  const totalSubjectPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredClassSubjects.length / SUBJECTS_PER_PAGE));
  }, [filteredClassSubjects.length]);

  // Réinitialiser la page quand on change de niveau, de classe, de trimestre ou de recherche
  useEffect(() => {
    setSubjectPageIndex(0);
  }, [selectedLevelId, selectedClassId, selectedTermId, subjectSearchQuery]);

  // S'assurer que subjectPageIndex ne dépasse pas totalSubjectPages
  useEffect(() => {
    if (subjectPageIndex >= totalSubjectPages) {
      setSubjectPageIndex(Math.max(0, totalSubjectPages - 1));
    }
  }, [totalSubjectPages, subjectPageIndex]);

  // Matières découpées pour l'espace actuellement affiché
  const pagedSubjects = useMemo(() => {
    const start = subjectPageIndex * SUBJECTS_PER_PAGE;
    return filteredClassSubjects.slice(start, start + SUBJECTS_PER_PAGE);
  }, [filteredClassSubjects, subjectPageIndex]);

  // Cartes de Moyenne Générale de la classe active (1ère = Annuelle toujours présente, puis 1 par trimestre existant)
  const currentClassAverageCards = useMemo<ClassAverageCardItem[]>(() => {
    if (!activeClass) return [];
    const forClass = classAverages.filter(ca => ca.classId === activeClass.id);
    const annualCard: ClassAverageCardItem =
      forClass.find(ca => ca.kind === 'annual' && !ca.termId) || {
        id: `cavg-annual-${activeClass.id}`,
        classId: activeClass.id,
        schoolId: activeClass.schoolId,
        yearId: activeClass.yearId,
        kind: 'annual',
        title: "Moyenne générale de l'année",
        sortOrder: 0,
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        createdAt: activeClass.createdAt,
      };

    const termCards: ClassAverageCardItem[] = currentClassTerms.map((term) => {
      const existing = forClass.find(ca => ca.kind === 'term' && ca.termId === term.id);
      if (existing) {
        return {
          ...existing,
          title: `Moyenne générale · ${term.name}`,
          sortOrder: term.number,
        };
      }
      return {
        id: `cavg-term-${term.id}`,
        classId: activeClass.id,
        termId: term.id,
        schoolId: activeClass.schoolId,
        yearId: activeClass.yearId,
        kind: 'term',
        title: `Moyenne générale · ${term.name}`,
        sortOrder: term.number,
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        createdAt: term.createdAt,
      };
    });

    return [annualCard, ...termCards];
  }, [activeClass, classAverages, currentClassTerms]);

  // Pendant la restauration sur cache froid (ex: juste après une mise à jour), afficher un écran de chargement sobre
  // au lieu de flasher le tableau de bord avant de rouvrir la page exacte
  if (isRestoringNav) {
    return (
      <div className="w-full h-full min-h-0 flex-1 flex flex-col items-center justify-center gap-3 bg-[#f3f5f8] dark:bg-[#0b1120] text-slate-700 dark:text-slate-200 select-none">
        <Loader2 className="w-7 h-7 animate-spin text-blue-600 dark:text-sky-400" />
        <p className="text-xs font-bold tracking-wide">Restauration de votre espace…</p>
      </div>
    );
  }

  // Si le professeur clique sur une carte "Moyenne générale" (annuelle ou trimestrielle) :
  if (selectedAverageCardInside && activeClass) {
    const linkedTerm = selectedAverageCardInside.termId
      ? currentClassTerms.find(t => t.id === selectedAverageCardInside.termId) || null
      : null;
    const linkedTermSubjects = selectedAverageCardInside.termId
      ? subjects.filter(
          s => s.classId === activeClass.id && s.termId === selectedAverageCardInside.termId
        )
      : [];
    return (
      <ClassAverageSheetView
        averageCard={selectedAverageCardInside}
        schoolClass={activeClass}
        schoolYear={currentSelectedYear}
        school={selectedSchoolInside}
        term={linkedTerm}
        userId={authUserId}
        initialSubjects={linkedTermSubjects}
        initialTerms={currentClassTerms}
        onOpenSubject={(subjectId) => {
          const targetSubject = subjects.find(s => s.id === subjectId);
          if (targetSubject) {
            if (selectedAverageCardInside.termId) {
              setSelectedTermId(selectedAverageCardInside.termId);
            }
            setSelectedClassId(targetSubject.classId);
            setEnteredClassId(targetSubject.classId);
            setSelectedAverageCardInside(null);
            setSelectedSubjectInside(targetSubject);
          }
        }}
        onSubjectCoefficientUpdated={(subjectId, coeff) => {
          setSubjects(prev =>
            prev.map(s =>
              s.id === subjectId
                ? { ...s, coefficient: coeff !== null ? coeff : undefined }
                : s
            )
          );
        }}
        onOpenTermAverageCard={(termId) => {
          const targetCard = currentClassAverageCards.find(
            ca => ca.kind === 'term' && ca.termId === termId
          );
          if (targetCard) {
            setSelectedTermId(termId);
            setSelectedAverageCardInside(targetCard);
          }
        }}
        onTermCoefficientUpdated={(termId, coeff) => {
          setTerms(prev =>
            prev.map(t =>
              t.id === termId
                ? { ...t, coefficient: coeff !== null ? coeff : undefined }
                : t
            )
          );
        }}
        onClassSettingsUpdated={(classId, settings) => {
          setClasses(prev =>
            prev.map(c =>
              c.id === classId
                ? {
                    ...c,
                    mentionRules: settings.mentionRules,
                    showMatricule: settings.showMatricule,
                    averageScale: settings.averageScale,
                    columnOrder: settings.columnOrder ?? null,
                  }
                : c
            )
          );
        }}
        onBack={() => setSelectedAverageCardInside(null)}
      />
    );
  }

  // Si le professeur clique et rentre à l'intérieur d'une matière créée :
  // Affichage du tableur de notes et moyennes plein écran (identique à WPS/Excel)
  if (selectedSubjectInside && activeClass) {
    return (
      <SubjectGradebookView
        subject={selectedSubjectInside}
        schoolClass={activeClass}
        schoolYear={currentSelectedYear}
        school={selectedSchoolInside}
        term={activeTerm}
        userId={authUserId}
        onGradebookSynced={refreshCloudStats}
        onClassSettingsUpdated={(classId, settings) => {
          setClasses(prev =>
            prev.map(c =>
              c.id === classId
                ? {
                    ...c,
                    mentionRules: settings.mentionRules,
                    showMatricule: settings.showMatricule,
                    averageScale: settings.averageScale,
                    columnOrder: settings.columnOrder ?? null,
                  }
                : c
            )
          );
        }}
        onBack={() => {
          setSelectedSubjectInside(null);
          refreshCloudStats();
        }}
      />
    );
  }

  const enteredClass = enteredClassId
    ? currentLevelClasses.find(c => c.id === enteredClassId) || null
    : null;

  return (
    <div 
      className={`w-full flex flex-col md:flex-row overflow-hidden font-sans select-none transition-all duration-300 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-[60] w-screen h-screen min-h-screen'
          : 'relative w-full h-full min-h-0 flex-1'
      } ${selectedSchoolInside ? 'bg-[#eef2f6] dark:bg-[#0b1120]' : 'bg-[#091226]'}`}
    >
      {selectedSchoolInside ? (
        <SchoolWorkspaceLayout
          school={selectedSchoolInside}
          schoolYear={currentSelectedYear}
          levels={currentSchoolLevels}
          activeLevel={activeLevel}
          allSchoolClasses={classes.filter(c => c.schoolId === selectedSchoolInside.id)}
          levelClasses={currentLevelClasses}
          enteredClass={enteredClass}
          allTerms={terms}
          classTerms={currentClassTerms}
          activeTerm={activeTerm}
          allSubjects={subjects}
          termSubjects={currentClassSubjects}
          classAverages={classAverages}
          currentClassAverageCards={currentClassAverageCards}
          serverGradebookStats={getTeacherAuthToken() ? serverGradebookStats : undefined}
          saveUiState={saveUiState}
          cloudStatus={cloudStatus}
          isOnline={isOnline}
          saveFeedbackMessage={saveFeedbackMessage}
          userName={user?.name || 'Professeur'}
          viewerExpandLevel={viewerExpandLevel}
          isViewerMaximized={isViewerMaximized}
          onExpandChange={(lvl) => {
            if (lvl >= 1) setIsViewerMaximized(true);
            else setIsViewerMaximized(false);
            setViewerExpandLevel(lvl);
          }}
          onToggleMaximize={() => {
            if (viewerExpandLevel >= 1 || isViewerMaximized) {
              setIsViewerMaximized(false);
              resetViewerExpand();
            } else {
              setIsViewerMaximized(true);
              setViewerExpandLevel(1);
            }
          }}
          isTransferViewOpen={isTransferViewOpen}
          renderTransferView={() => (
            <TeacherTransferView
              currentSchool={selectedSchoolInside}
              currentYear={currentSelectedYear}
              activeLevel={activeLevel}
              activeClass={activeClass}
              activeTerm={activeTerm}
              schoolYears={schoolYears}
              schools={schools}
              studyLevels={studyLevels}
              classes={classes}
              terms={terms}
              subjects={subjects}
              serverGradebookStats={getTeacherAuthToken() ? serverGradebookStats : undefined}
              onApplyTransfer={async (next) => {
                setStudyLevels(next.studyLevels);
                setClasses(next.classes);
                setTerms(next.terms);
                setSubjects(next.subjects);
                const res = await runCloudMutation(
                  () =>
                    TeacherGradebookAPI.executeTransfer({
                      createdLevels: next.createdLevels,
                      createdClasses: next.createdClasses,
                      createdTerms: next.createdTerms,
                      createdSubjects: next.createdSubjects,
                      updatedSubjects: next.updatedSubjects,
                      gradebookCopies: next.gradebookCopyOps,
                    }),
                  'Erreur lors du transfert de vos données.'
                );
                if (res?.gradebookStats) {
                  setServerGradebookStats(res.gradebookStats);
                }
                if (Array.isArray(res?.classAverages)) {
                  setClassAverages(res.classAverages);
                }
                return res?.serverSummary;
              }}
              onClose={() => setIsTransferViewOpen(false)}
            />
          )}
          onOpenTransfer={() => setIsTransferViewOpen(true)}
          onCloseTransfer={() => setIsTransferViewOpen(false)}
          onExitSchool={() => {
            setIsTransferViewOpen(false);
            setEnteredClassId(null);
            setSelectedSchoolInside(null);
          }}
          onSelectLevel={(levelId) => {
            setSelectedLevelId(levelId);
            setEnteredClassId(null);
          }}
          onEnterClass={(cls) => {
            setSelectedClassId(cls.id);
            setEnteredClassId(cls.id);
          }}
          onExitClass={() => setEnteredClassId(null)}
          onSelectTerm={(termId) => setSelectedTermId(termId)}
          onOpenSubject={(subject) => setSelectedSubjectInside(subject)}
          onOpenAverageCard={(card, cls) => {
            setSelectedClassId(cls.id);
            setSelectedAverageCardInside(card);
          }}
          onAddLevel={() => {
            resetLevelForm();
            setIsAddLevelModalOpen(true);
          }}
          onAddClass={() => {
            resetClassForm();
            setIsAddClassModalOpen(true);
          }}
          onAddSubject={() => {
            resetSubjectForm();
            setIsAddSubjectModalOpen(true);
          }}
          addTermBtnRef={addTermBtnRef}
          onToggleAddTermPopover={() => {
            setEditingTermCoeff(null);
            setActiveMenu(null);
            setNewTermCoeffInput('');
            setIsAddTermPopoverOpen(prev => !prev);
          }}
          nextTermNumber={nextTermNumber}
          onOpenMenu={handleOpenMenu}
          boundaryRef={mainContainerRef}
        />
      ) : (
        <>
      {/* ========================================================================= */}
      {/* 1. BARRE LATÉRALE BUREAU (Desktop >= md : Deep Teal / Pétrole Foncé) */}
      {/* ========================================================================= */}
      <aside 
        className="hidden md:flex w-24 lg:w-28 shrink-0 flex-col items-center py-4 justify-between z-30 transition-all border-r border-[#002830]/30 shadow-2xl h-full"
        style={{ backgroundColor: '#002f3a' }}
      >
        {/* Logo supérieur identique à StudyCloud (Logo ADN devant StudyCloud) */}
        <div
          className="notranslate flex items-center justify-center gap-1 px-1.5 cursor-pointer group hover:scale-105 transition-transform"
          translate="no"
          onClick={() => { setIsViewerMaximized(false); resetViewerExpand(); onBack(); }}
          title="Retour à l'accueil StudyCloud"
        >
          <DnaLogo
            className="w-5 h-5 lg:w-6 lg:h-6 shrink-0 drop-shadow-[0_0_2px_rgba(0,0,0,0.9)]"
            glow={true}
          />
          <div className="flex flex-col justify-center min-w-0">
            <span className="font-black tracking-tight text-[10.5px] lg:text-[12px] leading-none flex items-center select-none">
              <span className="font-black text-orange-500">Study</span>
              <span className="font-black text-sky-400">Cloud</span>
            </span>
            <span
              className="text-[5.5px] lg:text-[6.2px] font-black uppercase mt-0.5 leading-none truncate"
              style={{ letterSpacing: '0.09em', color: '#f59e0b' }}
            >
              DKD TECHNOLOGIES
            </span>
          </div>
        </div>

        {/* Éléments de navigation verticaux Desktop (Accueil actif sur Dashboard - Image 1) */}
        <nav className="flex flex-col items-center gap-4 my-auto w-full px-2">
          {navItems.map((item) => {
            const isActive = activeNavTab === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNavTab(item.id)}
                className={`group flex flex-col items-center justify-center w-full py-1.5 transition-all relative ${
                  isActive ? 'opacity-100' : 'opacity-65 hover:opacity-100'
                }`}
                title={item.label}
              >
                {isActive ? (
                  // Onglet Actif : Icône dans un conteneur blanc doux arrondi
                  <div className="w-10 h-10 rounded-2xl bg-white text-[#002f3a] shadow-lg shadow-black/20 flex items-center justify-center transition-transform scale-105">
                    <IconComponent className="w-5 h-5 stroke-[2.4]" />
                  </div>
                ) : (
                  // Onglet Inactif : Icône épurée
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-cyan-100/80 group-hover:bg-white/10 group-hover:text-white transition">
                    <IconComponent className="w-5 h-5 stroke-[1.8]" />
                  </div>
                )}
                
                {/* Libellé sous l'icône */}
                <span className={`text-[10px] mt-1 font-semibold tracking-wide transition-colors ${
                  isActive ? 'text-white font-bold' : 'text-cyan-100/70 group-hover:text-white'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* ========================================================================= */}
      {/* 2. ESPACE PRINCIPAL DE TRAVAIL AVEC FOND ANIMÉ DOUX ET CONTINU            */}
      {/* ========================================================================= */}
      <main ref={mainContainerRef} className="relative flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-[#051220]">
        {/* Fond animé continu, lent et cohérent (100 % vectoriel & Canvas 60 FPS) */}
        <TeacherAnimatedBackground />

        {/* Contenu au-dessus de l'animation continue : les éléments du haut restent fixes sur bureau, seules les écoles défilent horizontalement */}
        <div className="relative z-10 flex-1 flex flex-col h-full min-h-0 overflow-y-auto md:overflow-hidden overflow-x-hidden px-2.5 sm:px-6 lg:px-8 pt-1.5 sm:pt-2 pb-24 md:pb-4 space-y-1.5">
        
        {/* ----------------------------------------------------------------------- */}
        {/* EN-TÊTE COMPACT EN HAUT :                                               */}
        {/* Retour (gauche) | Titre bien centré (milieu) | Utilitaires & Agrandissement (droite) */}
        {/* ----------------------------------------------------------------------- */}
        <header className="relative shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap">
          {/* Groupe haut gauche : Bouton Retour + Statut de synchronisation cloud (le bouton manuel Enregistrer est réservé au tableur de notes) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-nowrap sm:flex-wrap z-10 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isTransferViewOpen) {
                  setIsTransferViewOpen(false);
                } else if (selectedSchoolInside) {
                  setSelectedSchoolInside(null);
                } else {
                  flushNavSnapshotNow();
                  setIsViewerMaximized(false);
                  resetViewerExpand();
                  onBack();
                }
              }}
              className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl bg-white/85 hover:bg-white text-slate-700 hover:text-[#00313d] border border-white/95 shadow-xs transition active:scale-95 font-bold text-[11px] sm:text-xs cursor-pointer shrink-0"
              title={
                isTransferViewOpen
                  ? "Retour à l'établissement"
                  : selectedSchoolInside
                  ? "Retour à la liste des écoles"
                  : "Retour à l'accueil"
              }
            >
              <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Retour</span>
            </button>

            {/* Statut de chargement et d'enregistrement automatique en direct */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-[11px] font-bold border transition-all select-none whitespace-nowrap ${
                saveUiState === 'saving' || cloudStatus === 'loading'
                  ? 'bg-amber-50/90 text-amber-800 border-amber-200/80'
                  : saveUiState === 'saved'
                  ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200/90'
                  : saveUiState === 'offline' || !isOnline
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : saveUiState === 'error' || cloudStatus === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-white/90 text-slate-700 border-white shadow-xs'
              }`}
              title={saveFeedbackMessage || 'Synchronisation automatique avec le cloud StudyCloud'}
            >
              {saveUiState === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700 shrink-0" />
                  <span className="sm:hidden">Synchro...</span>
                  <span className="hidden sm:inline">Enregistrement en cours...</span>
                </>
              ) : cloudStatus === 'loading' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700 shrink-0" />
                  <span className="sm:hidden">Chargement...</span>
                  <span className="hidden sm:inline">Chargement de vos données...</span>
                </>
              ) : saveUiState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                  <span className="sm:hidden">Enregistré</span>
                  <span className="hidden sm:inline">Enregistré avec succès</span>
                </>
              ) : saveUiState === 'offline' || !isOnline ? (
                <>
                  <WifiOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600 shrink-0" />
                  <span className="sm:hidden">Hors ligne</span>
                  <span className="hidden sm:inline">Hors ligne — Échec</span>
                </>
              ) : saveUiState === 'error' || cloudStatus === 'error' ? (
                <>
                  <CloudOff className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-red-600 shrink-0" />
                  <span className="sm:hidden">Erreur</span>
                  <span className="hidden sm:inline">Échec de l&apos;enregistrement</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600 shrink-0" />
                  <span className="sm:hidden">Synchronisé</span>
                  <span className="hidden sm:inline">Synchronisé au cloud</span>
                </>
              )}
            </div>
          </div>

          {/* Titre principal bien centré en haut (masqué sur très petit écran pour éviter la coupure "T...") */}
          <div className="hidden sm:flex items-center justify-center min-w-0 xl:absolute xl:left-1/2 xl:-translate-x-1/2 flex-1 xl:flex-initial">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight leading-none text-center truncate drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
              Tableau de bord
            </h1>
          </div>

          {/* Zone haute droite : Utilitaires + Profil puis Agrandissement dans le creux tout à droite */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-nowrap sm:flex-wrap justify-end z-10 min-w-0">
            {/* Profil Enseignant (nom tronqué en "..." si trop long, nom complet affiché à côté au survol) */}
            <div
              tabIndex={0}
              className="relative group flex items-center bg-white/55 dark:bg-slate-900/75 backdrop-blur-md p-0.5 sm:p-1 rounded-xl sm:rounded-2xl border border-white/80 dark:border-slate-600/80 shadow-2xs outline-none min-w-0"
            >
              <div className="flex items-center gap-1 sm:gap-1.5 pl-0.5 pr-1.5 sm:pr-2.5 py-0.5 bg-white/95 dark:bg-slate-800/95 rounded-lg sm:rounded-xl shadow-2xs border border-white dark:border-slate-700 cursor-default min-w-0">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-400 text-white font-bold text-[9.5px] sm:text-[10px] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    (user?.name ? user.name.charAt(0).toUpperCase() : 'DKD')
                  )}
                </div>
                <div className="flex flex-col text-left min-w-0 max-w-[74px] sm:max-w-[130px]">
                  <span className="block truncate text-[10.5px] sm:text-[11px] font-bold text-slate-800 dark:text-slate-100 leading-tight">
                    {user?.name || 'Professeur'}
                  </span>
                  <span className="hidden sm:block text-[8.5px] text-slate-400 dark:text-slate-400 font-medium leading-tight whitespace-nowrap">
                    Enseignant Pro
                  </span>
                </div>
              </div>

              {/* Bulle nom complet affichée à côté lorsque le curseur touche le profil */}
              <div
                role="tooltip"
                className="pointer-events-none opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all duration-150 absolute right-full top-1/2 -translate-y-1/2 mr-2.5 z-50 px-3 py-1.5 rounded-xl bg-slate-900/95 text-white border border-slate-500/80 shadow-xl backdrop-blur-md w-max max-w-[280px] sm:max-w-[380px]"
              >
                <div className="text-xs font-bold leading-snug break-words">
                  {user?.name || 'Professeur'}
                </div>
                <div className="text-[10px] text-slate-300 font-medium leading-tight">
                  Enseignant Pro
                </div>
                <span className="absolute left-full top-1/2 -translate-y-1/2 -ml-1 w-2 h-2 rotate-45 bg-slate-900/95 border-t border-r border-slate-500/80" />
              </div>
            </div>

            {/* Boutons Super Agrandissement & Plein écran déplacés dans le creux tout en haut à droite (Desktop) */}
            <div className="hidden md:flex items-center gap-1.5 shrink-0 pl-1 border-l border-cyan-900/15">
              <ViewerSuperExpandButton
                expandLevel={viewerExpandLevel}
                onExpandChange={(lvl) => {
                  if (lvl >= 1) {
                    setIsViewerMaximized(true);
                  } else {
                    setIsViewerMaximized(false);
                  }
                  setViewerExpandLevel(lvl);
                }}
              />

              <button
                type="button"
                onClick={() => {
                  if (viewerExpandLevel >= 1 || isViewerMaximized) {
                    setIsViewerMaximized(false);
                    resetViewerExpand();
                  } else {
                    setIsViewerMaximized(true);
                    setViewerExpandLevel(1);
                  }
                }}
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                  viewerExpandLevel >= 1 || isViewerMaximized
                    ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/40'
                    : 'bg-[#101827] hover:bg-[#1a2538] text-white border-white/20'
                }`}
                title={viewerExpandLevel >= 1 || isViewerMaximized ? 'Réduire la vue' : "Agrandir l'espace"}
              >
                {viewerExpandLevel >= 1 || isViewerMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* ----------------------------------------------------------------------- */}
        {/* RENTRÉES SCOLAIRES ENREGISTRÉES + BOUTON CRÉER UNE RENTRÉE SUR LA MÊME  */}
        {/* LIGNE POUR COMBLER L'ESPACE (MASQUÉ SI DANS UNE ÉCOLE)                  */}
        {/* ----------------------------------------------------------------------- */}
        {!selectedSchoolInside && (
          <section className="shrink-0 space-y-1 animate-fade-in">
            <div className="flex items-center justify-between gap-2 flex-nowrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10.5px] sm:text-[11px] font-extrabold uppercase tracking-wider text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] truncate">
                  <span className="sm:hidden">Rentrées</span>
                  <span className="hidden sm:inline">Rentrées scolaires enregistrées :</span>
                </span>
                <span className="text-[10.5px] sm:text-[11px] font-black text-cyan-200 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] shrink-0">
                  ({schoolYears.length})
                </span>
              </div>

              <div className="relative shrink-0" ref={dropdownRef}>
                <button
                  ref={createYearBtnRef}
                  type="button"
                  onClick={() => setIsCreateMenuOpen(prev => !prev)}
                  className="create-year-trigger flex items-center gap-1 sm:gap-2 px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-black text-white shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                  style={{ backgroundColor: '#00313d' }}
                  title="Créer une rentrée scolaire"
                >
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                  <span className="tracking-wide sm:hidden">Rentrée</span>
                  <span className="tracking-wide hidden sm:inline">
                    Créer une rentrée scolaire
                  </span>
                </button>

                {/* Menu déroulant flottant intelligent (portail au-dessus de tous les éléments) */}
                <SmartFloatingPopover
                  open={isCreateMenuOpen}
                  anchorEl={createYearBtnRef.current}
                  boundaryEl={mainContainerRef.current}
                  preferredSide="bottom"
                  preferredAlign="end"
                  gap={10}
                  onClose={() => setIsCreateMenuOpen(false)}
                  ignoreOutsideSelector=".create-year-trigger"
                  dataPopoverId="create-school-year-menu"
                  className="w-72 sm:w-80 rounded-2xl"
                >
                  <div className="p-4 text-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-[#00313d] flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-cyan-600" />
                        <span>
                          {yearCreationMode === 'batch'
                            ? 'Créer plusieurs rentrées'
                            : 'Nouvelle rentrée scolaire'}
                        </span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setIsCreateMenuOpen(false);
                          setBatchError(null);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <CreationModeToggle
                      mode={yearCreationMode}
                      onChange={(next) => {
                        setBatchError(null);
                        if (next === 'batch' && inputYearValue.trim()) {
                          setBatchYearRows((prev) => {
                            const hasAny = prev.some((r) => r.label.trim());
                            if (!hasAny) {
                              return [
                                { uid: makeBatchRowUid(), label: inputYearValue.trim() },
                                { uid: makeBatchRowUid(), label: '' },
                              ];
                            }
                            return prev;
                          });
                        }
                        setYearCreationMode(next);
                      }}
                      singleLabel="Une rentrée"
                      batchLabel="Créer plusieurs"
                      batchCount={validBatchYearLabels.length}
                    />

                    {yearCreationMode === 'single' ? (
                      <>
                        {/* 1. Champ en haut bien rectangle avec bouton Créer / Appliquer à côté */}
                        <form onSubmit={handleApplyYear} className="space-y-1.5">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Année scolaire (max 12 chiffres)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={inputYearValue}
                              onChange={handleYearInputChange}
                              maxLength={12}
                              placeholder="ex: 2026 - 2027"
                              className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                              autoFocus
                            />
                            <button
                              type="submit"
                              disabled={!inputYearValue.trim()}
                              className="px-3.5 py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                              style={{ backgroundColor: '#00313d' }}
                            >
                              Créer
                            </button>
                          </div>
                          <span className="text-[9px] text-slate-400 block">
                            {inputYearValue.length}/12 caractères &bull; Chiffres autorisés
                          </span>
                        </form>
                      </>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Liste des rentrées à créer
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setBatchYearRows((prev) => [
                                ...prev,
                                { uid: makeBatchRowUid(), label: '' },
                              ])
                            }
                            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-cyan-700 hover:text-cyan-900 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 stroke-[2.5]" />
                            <span>Ajouter ligne</span>
                          </button>
                        </div>

                        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
                          {batchYearRows.map((row, idx) => (
                            <div key={row.uid} className="flex items-center gap-1.5">
                              <span className="w-5 text-[10px] font-bold text-slate-400 text-center shrink-0">
                                {idx + 1}.
                              </span>
                              <input
                                type="text"
                                value={row.label}
                                maxLength={12}
                                onChange={(e) => {
                                  const filtered = e.target.value.replace(/[^0-9\s-]/g, '').slice(0, 12);
                                  setBatchError(null);
                                  setBatchYearRows((prev) =>
                                    prev.map((r) => (r.uid === row.uid ? { ...r, label: filtered } : r))
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setBatchYearRows((prev) => [
                                      ...prev,
                                      { uid: makeBatchRowUid(), label: '' },
                                    ]);
                                  }
                                }}
                                placeholder="ex: 2027 - 2028"
                                className="flex-1 h-8 px-2.5 rounded-lg border border-slate-300 bg-white font-mono font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                              <button
                                type="button"
                                disabled={batchYearRows.length <= 1}
                                onClick={() =>
                                  setBatchYearRows((prev) =>
                                    prev.length > 1 ? prev.filter((r) => r.uid !== row.uid) : prev
                                  )
                                }
                                className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 flex items-center justify-center cursor-pointer shrink-0"
                                title="Retirer cette ligne"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Palette de couleurs à appliquer */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Couleur {yearCreationMode === 'batch' ? 'des boutons' : "du bouton de l'année"}
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {YEAR_COLOR_OPTIONS.map((col) => {
                          const isSelected = selectedColorObj.id === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedColorObj(col)}
                              style={{ backgroundColor: col.bg, borderColor: col.border }}
                              className={`w-full h-7 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                              }`}
                              title={col.label}
                            >
                              {isSelected && (
                                <Check className={`w-3.5 h-3.5 ${col.id === 'white' ? 'text-slate-800' : 'text-white'} stroke-[3]`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2B. Style d'application de la couleur */}
                    <ColorStyleSelector
                      value={selectedYearColorStyle}
                      onChange={setSelectedYearColorStyle}
                      accentHex={selectedColorObj.bg}
                      isWhiteColor={selectedColorObj.id === 'white'}
                      compact
                    />

                    {/* 3. Propositions rapides */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        {yearCreationMode === 'batch'
                          ? 'Cliquez pour ajouter / retirer :'
                          : 'Propositions rapides'}
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_YEARS.map((sug) => {
                          const alreadyExists = schoolYears.some(
                            (y) => y.label.trim().toLowerCase() === sug.toLowerCase()
                          );
                          const isPicked =
                            yearCreationMode === 'batch'
                              ? batchYearRows.some((r) => r.label.trim().toLowerCase() === sug.toLowerCase())
                              : inputYearValue === sug;
                          return (
                            <button
                              key={sug}
                              type="button"
                              disabled={yearCreationMode === 'batch' && alreadyExists}
                              onClick={() =>
                                yearCreationMode === 'batch'
                                  ? handleToggleYearBatchSuggestion(sug)
                                  : setInputYearValue(sug)
                              }
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all cursor-pointer inline-flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed ${
                                isPicked
                                  ? 'bg-cyan-600 text-white shadow-sm'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {yearCreationMode === 'batch' && isPicked && (
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              )}
                              <span>{sug}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {batchError && yearCreationMode === 'batch' && (
                      <div className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                        {batchError}
                      </div>
                    )}

                    {/* Bouton Appliquer bas du menu */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                      <button
                        type="button"
                        disabled={
                          isBatchSaving ||
                          (yearCreationMode === 'batch'
                            ? validBatchYearLabels.length === 0
                            : !inputYearValue.trim())
                        }
                        onClick={() => handleApplyYear()}
                        className="w-full py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95 cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        style={{ backgroundColor: '#00313d' }}
                      >
                        {isBatchSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>
                          {yearCreationMode === 'batch'
                            ? validBatchYearLabels.length > 1
                              ? `Créer ${validBatchYearLabels.length} rentrées scolaires`
                              : validBatchYearLabels.length === 1
                              ? 'Créer 1 rentrée scolaire'
                              : 'Ajoutez au moins une nouvelle rentrée'
                            : 'Appliquer cette rentrée scolaire'}
                        </span>
                      </button>
                    </div>
                  </div>
                </SmartFloatingPopover>
              </div>
            </div>

            {/* Ligne des boutons d'années successifs avec sélection lumineuse (jamais noire) */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-nowrap sm:flex-wrap overflow-x-auto sm:overflow-visible scrollbar-none py-1 px-0.5">
              {schoolYears.map((year) => {
                const isSelected = selectedYearId === year.id;
                const isWhite = !year.color || year.color === '#ffffff' || year.color === 'white';
                const isAccentStyle = !isWhite && year.colorStyle === 'accent';
                const useLightSurface = isWhite || isAccentStyle;
                const glowTheme = getLuminousLevelTheme(year.color);

                return (
                  <div
                    key={year.id}
                    data-popover-avoid="true"
                    onClick={() => setSelectedYearId(year.id)}
                    style={
                      isSelected
                        ? {
                            background: glowTheme.bg,
                            color: glowTheme.text,
                            borderColor: glowTheme.border,
                            boxShadow: glowTheme.shadow,
                          }
                        : {
                            backgroundColor: useLightSurface ? '#ffffff' : year.color,
                            color: useLightSurface ? '#0f172a' : (year.textColor || '#ffffff'),
                            borderColor: useLightSurface ? '#cbd5e1' : year.color,
                          }
                    }
                    className={`group relative overflow-hidden shrink-0 flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl text-[11px] sm:text-xs font-extrabold tracking-wide cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'border-2 sm:scale-[1.03]'
                        : 'border shadow-xs hover:scale-102 hover:shadow'
                    }`}
                    title={`Sélectionner l'année scolaire ${year.label}`}
                  >
                    {!isSelected && isAccentStyle && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[4px]"
                        style={{ backgroundColor: year.color }}
                      />
                    )}
                    {isSelected && (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-45 blur-md"
                        style={{ background: glowTheme.aura }}
                      />
                    )}
                    <Calendar className={`relative z-10 w-3.5 h-3.5 opacity-85 ${!isSelected && isAccentStyle ? 'ml-0.5' : ''}`} />
                    <span className="relative z-10 font-mono">{year.label}</span>
                    {isSelected && (
                      <span
                        className="relative z-10 w-2 h-2 rounded-full ml-0.5"
                        style={{ backgroundColor: glowTheme.dot, boxShadow: glowTheme.dotShadow }}
                      />
                    )}

                    {/* Bouton 3 traits (≡) pour Modifier ou Supprimer la rentrée scolaire */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenMenu(e, 'year', year)}
                      className={`card-menu-trigger relative z-10 ml-1 w-6 h-6 rounded-lg flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'hover:bg-black/10 text-current opacity-85 hover:opacity-100'
                          : useLightSurface
                          ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                          : 'text-white/75 hover:text-white hover:bg-black/20'
                      }`}
                      title="Modifier ou supprimer cette rentrée scolaire"
                    >
                      <div className="w-3 h-2.5 flex flex-col justify-between items-center pointer-events-none">
                        <span className="w-full h-[1.6px] bg-current rounded-full"></span>
                        <span className="w-full h-[1.6px] bg-current rounded-full"></span>
                        <span className="w-full h-[1.6px] bg-current rounded-full"></span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Alerte compacte Hors-ligne / Échec de synchronisation */}
        {(saveUiState === 'offline' || saveUiState === 'error' || cloudStatus === 'error') && (
          <div className="mb-2 w-fit max-w-full px-3.5 py-2 rounded-xl bg-red-50/95 border border-red-200 flex items-center gap-3 text-xs text-red-800 shadow-sm">
            <div className="flex items-center gap-2 min-w-0">
              {saveUiState === 'offline' || !isOnline ? (
                <WifiOff className="w-4 h-4 shrink-0 text-red-600" />
              ) : (
                <CloudOff className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span className="font-semibold">
                {saveFeedbackMessage || cloudError || 'Hors ligne — Vérifiez votre connexion Internet.'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => (cloudStatus === 'error' && !isCloudHydratedRef.current ? loadFromCloudD1() : handleManualSave())}
              className="px-2.5 py-1 rounded-lg bg-white hover:bg-red-100 border border-red-300 text-[11px] font-bold text-red-700 shrink-0 transition cursor-pointer"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ESPACE DE TRAVAIL PRINCIPAL (ÉCOLES OU CLASSES SELON LA NAVIGATION)    */}
        {/* ----------------------------------------------------------------------- */}
        <section className="flex-1 min-h-0 flex flex-col justify-start">
          {currentSelectedYear ? (
              currentYearSchools.length === 0 ? (
                // 1. AUCUNE ÉCOLE : Bouton Plus au milieu avec pointillé autour formant un carré
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      resetSchoolForm();
                      setIsAddSchoolModalOpen(true);
                    }}
                    className="group relative w-60 h-56 sm:w-64 sm:h-60 border-2 border-dashed border-cyan-300/70 hover:border-cyan-200 bg-[#081329]/45 hover:bg-[#081329]/65 backdrop-blur-[4px] rounded-3xl flex flex-col items-center justify-center p-5 text-center cursor-pointer transition-all duration-300 shadow-[0_12px_36px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_42px_rgba(6,182,212,0.28)] hover:-translate-y-1 active:translate-y-0"
                    title="Ajouter une école"
                  >
                    {/* Icône Plus dans un conteneur carré stylisé */}
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-cyan-400 transition-all duration-300 mb-3 border border-cyan-200/50">
                      <Plus className="w-7 h-7 stroke-[3]" />
                    </div>

                    {/* Titre et incitation */}
                    <span className="text-base font-black text-white drop-shadow-sm transition-colors">
                      Ajouter une école
                    </span>
                    <p className="text-xs text-slate-200/95 max-w-[200px] mt-1.5 leading-relaxed">
                      Cliquez ici pour configurer un établissement scolaire pour la rentrée <span className="font-bold text-cyan-200">{currentSelectedYear.label}</span>
                    </p>

                    {/* Petit badge subtil */}
                    <div className="mt-3 px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-300/50 text-[10px] font-extrabold text-cyan-100">
                      Nouveau +
                    </div>
                  </button>
                </div>
              ) : (
                // 2. ÉCOLES CRÉÉES : Carrousel horizontal par pages de 3 lignes x 4 colonnes (12 cases : 1 bouton "+" + 11 écoles)
                <div className="flex-1 min-h-0 flex flex-col space-y-1.5 sm:space-y-2 pt-0.5 animate-fade-in">
                  {/* Barre fixe en haut des écoles : titre, rentrée, recherche + boutons Gauche / Droite */}
                  <div className="shrink-0 flex items-center justify-between gap-1.5 sm:gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                      <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
                        <span className="sm:hidden">Écoles ({currentYearSchools.length})</span>
                        <span className="hidden sm:inline">Établissements scolaires ({currentYearSchools.length})</span>
                      </span>
                      <span className="hidden sm:inline text-xs text-cyan-200/75 font-bold">&bull;</span>
                      <span className="text-[10px] sm:text-xs font-bold text-cyan-900 bg-white/95 px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-lg border border-cyan-200/60 shadow-2xs">
                        <span className="sm:hidden">{currentSelectedYear.label}</span>
                        <span className="hidden sm:inline">Rentrée {currentSelectedYear.label}</span>
                      </span>
                      <InlineSectionSearch
                        isOpen={isSchoolSearchOpen}
                        query={schoolSearchQuery}
                        placeholder="Chercher une école..."
                        onToggle={() => {
                          if (isSchoolSearchOpen) {
                            setIsSchoolSearchOpen(false);
                            setSchoolSearchQuery('');
                          } else {
                            setIsSchoolSearchOpen(true);
                          }
                        }}
                        onChange={setSchoolSearchQuery}
                        onClose={() => {
                          setIsSchoolSearchOpen(false);
                          setSchoolSearchQuery('');
                        }}
                      />
                    </div>

                    {/* Boutons Gauche / Droite fixes pour défiler horizontalement entre les pages d'écoles */}
                    <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 select-none">
                      <button
                        type="button"
                        disabled={safeSchoolsPageIndex <= 0}
                        onClick={() => handleGoToSchoolsPage(safeSchoolsPageIndex - 1)}
                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all ${
                          safeSchoolsPageIndex <= 0
                            ? 'bg-white/15 border-white/15 text-white/40 cursor-not-allowed'
                            : 'bg-white/95 hover:bg-cyan-50 border-cyan-200/80 text-[#00313d] shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                        }`}
                        title="Page précédente des écoles (←)"
                        aria-label="Page précédente des écoles"
                      >
                        <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.8]" />
                      </button>

                      <span
                        className="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg sm:rounded-xl bg-[#081b33]/85 border border-cyan-300/35 text-[10px] sm:text-[11px] font-extrabold text-white shadow-xs tabular-nums"
                        title={`12 cases par page (3 lignes × 4 colonnes : bouton + et jusqu'à ${TEACHER_SCHOOLS_PER_PAGE} écoles)`}
                      >
                        <span className="hidden sm:inline">Page </span>{safeSchoolsPageIndex + 1} / {totalSchoolPages}
                      </span>

                      <button
                        type="button"
                        disabled={safeSchoolsPageIndex >= totalSchoolPages - 1}
                        onClick={() => handleGoToSchoolsPage(safeSchoolsPageIndex + 1)}
                        className={`w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl border flex items-center justify-center transition-all ${
                          safeSchoolsPageIndex >= totalSchoolPages - 1
                            ? 'bg-white/15 border-white/15 text-white/40 cursor-not-allowed'
                            : 'bg-white/95 hover:bg-cyan-50 border-cyan-200/80 text-[#00313d] shadow-md hover:scale-105 active:scale-95 cursor-pointer'
                        }`}
                        title={
                          totalSchoolPages > 1
                            ? 'Page suivante des écoles (→)'
                            : `Page suivante disponible dès la ${TEACHER_SCHOOLS_PER_PAGE + 1}e école`
                        }
                        aria-label="Page suivante des écoles"
                      >
                        <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.8]" />
                      </button>
                    </div>
                  </div>

                  {/* Zone défilable UNIQUEMENT pour les cartes d'écoles (glissement horizontal fluide page par page) */}
                  <div
                    className="flex-1 min-h-0 overflow-x-hidden md:overflow-y-auto"
                    onTouchStart={(e) => {
                      const t = e.touches[0];
                      if (t) schoolsTouchStartRef.current = { x: t.clientX, y: t.clientY };
                    }}
                    onTouchEnd={(e) => {
                      const start = schoolsTouchStartRef.current;
                      schoolsTouchStartRef.current = null;
                      const t = e.changedTouches[0];
                      if (!start || !t || totalSchoolPages <= 1) return;
                      const dx = t.clientX - start.x;
                      const dy = t.clientY - start.y;
                      if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.25) {
                        if (dx < 0 && safeSchoolsPageIndex < totalSchoolPages - 1) {
                          handleGoToSchoolsPage(safeSchoolsPageIndex + 1);
                        } else if (dx > 0 && safeSchoolsPageIndex > 0) {
                          handleGoToSchoolsPage(safeSchoolsPageIndex - 1);
                        }
                      }
                    }}
                  >
                    <div
                      className="flex transition-transform duration-300 ease-out will-change-transform"
                      style={{ transform: `translate3d(-${safeSchoolsPageIndex * 100}%, 0, 0)` }}
                    >
                      {schoolPages.map((pageSchools, pageIdx) => (
                        <div
                          key={`schools-page-${effectiveSchoolsYearId}-${pageIdx}`}
                          className="w-full shrink-0 grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3.5 lg:gap-4 items-stretch content-start pt-1 sm:pt-1.5 pb-2 px-0.5 sm:px-1"
                        >
                          {/* Bouton carré pointillé fixe en position 1 sur CHAQUE page pour ajouter une autre école */}
                          <button
                            type="button"
                            onClick={() => {
                              resetSchoolForm();
                              setIsAddSchoolModalOpen(true);
                            }}
                            className="min-h-[112px] sm:min-h-[150px] border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-white/90 hover:bg-white backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group hover:-translate-y-1 shadow-md hover:shadow-lg"
                          >
                            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-[#00313d] text-white flex items-center justify-center group-hover:scale-105 shadow-sm transition mb-1.5 sm:mb-2">
                              <Plus className="w-4 h-4 sm:w-6 sm:h-6 stroke-[2.5]" />
                            </div>
                            <span className="text-[11px] sm:text-xs font-black text-slate-700 group-hover:text-[#00313d] transition-colors leading-tight">
                              <span className="sm:hidden">Ajouter une école</span>
                              <span className="hidden sm:inline">Ajouter une autre école</span>
                            </span>
                            <span className="text-[9.5px] sm:text-[10px] text-slate-400 mt-0.5">
                              Pour {currentSelectedYear.label}
                            </span>
                          </button>

                          {pageSchools.length === 0 && isSchoolSearchActive ? (
                            <div className="min-h-[112px] sm:min-h-[150px] rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur-md p-3 sm:p-4 flex items-center justify-center text-xs sm:text-sm font-bold text-slate-500 select-none">
                              Non trouvé
                            </div>
                          ) : (
                            pageSchools.map((school) => {
                              const isSelected = selectedSchoolId === school.id;
                              const isWhite = !school.color || school.color === '#ffffff' || school.color === 'white';
                              const isAccentStyle = !isWhite && school.colorStyle === 'accent';
                              const useLightSurface = isWhite || isAccentStyle;
                              const schoolLevelsCount = studyLevels.filter(l => l.schoolId === school.id).length;
                              const schoolClassesCount = classes.filter(c => c.schoolId === school.id).length;

                              return (
                                <div
                                  key={school.id}
                                  onClick={() => {
                                    setSelectedSchoolId(school.id);
                                    setSelectedSchoolInside(school); // Rentrer à l'intérieur de l'école !
                                  }}
                                  style={{
                                    backgroundColor: useLightSurface ? '#ffffff' : school.color,
                                    color: useLightSurface ? '#0f172a' : (school.textColor || '#ffffff'),
                                    borderColor: useLightSurface ? '#cbd5e1' : (school.borderColor || school.color),
                                    borderBottomColor: useLightSurface ? '#94a3b8' : (school.borderDarkColor || '#00141a'),
                                  }}
                                  className={`group relative overflow-hidden min-h-[112px] sm:min-h-[150px] rounded-xl sm:rounded-2xl border-2 border-b-[3px] sm:border-b-[5px] p-2.5 sm:p-3.5 lg:p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none ${
                                    useLightSurface
                                      ? 'shadow-[0_10px_25px_-5px_rgba(0,40,60,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] hover:border-b-cyan-600'
                                      : 'shadow-[0_12px_24px_-6px_rgba(0,0,0,0.3)]'
                                  } ${
                                    isSelected
                                      ? 'ring-2 ring-cyan-500 ring-offset-1 sm:ring-offset-2 sm:scale-[1.01]'
                                      : 'hover:-translate-y-1'
                                  } active:translate-y-0.5 active:border-b-2`}
                                >
                                  {isAccentStyle && (
                                    <span
                                      className="absolute left-0 top-0 bottom-0 w-[4px] sm:w-[5px]"
                                      style={{ backgroundColor: school.color }}
                                    />
                                  )}
                                  {/* Haut de la carte : Logo ROND à gauche & Badge année / Menu à droite */}
                                  <div className={`flex items-start justify-between gap-1.5 sm:gap-2 ${isAccentStyle ? 'pl-1.5' : ''}`}>
                                    {/* Logo de l'école (ROND) */}
                                    <div className="w-8 h-8 sm:w-12 sm:h-12 rounded-full overflow-hidden shadow-md border-2 border-white/90 shrink-0 flex items-center justify-center bg-white/20 backdrop-blur-xs">
                                      {school.logoUrl ? (
                                        <img
                                          src={school.logoUrl}
                                          alt={school.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div
                                          className="w-full h-full flex items-center justify-center font-black text-xs sm:text-base tracking-wider"
                                          style={{ color: useLightSurface ? '#00313d' : '#ffffff' }}
                                        >
                                          {school.name.slice(0, 2).toUpperCase()}
                                        </div>
                                      )}
                                    </div>

                                    {/* Badge année (bureau) et menu 3 traits */}
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className={`hidden sm:inline-block text-[9.5px] sm:text-[10px] font-bold px-1.5 sm:px-2 py-0.5 rounded-lg border whitespace-nowrap ${
                                        useLightSurface
                                          ? 'bg-slate-100 text-slate-700 border-slate-200'
                                          : 'bg-black/20 text-white/90 border-white/20'
                                      }`}>
                                        {currentSelectedYear.label}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={(e) => handleOpenMenu(e, 'school', school)}
                                        className={`card-menu-trigger w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center transition z-10 shrink-0 ${
                                          useLightSurface
                                            ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-800'
                                            : 'hover:bg-black/30 text-white/70 hover:text-white'
                                        }`}
                                        title="Options de l'établissement"
                                      >
                                        <div className="w-3 sm:w-3.5 h-2 sm:h-2.5 flex flex-col justify-between items-center pointer-events-none">
                                          <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                          <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                          <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                        </div>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Milieu de la carte : Nom de l'école & compteurs */}
                                  <div className={`mt-1.5 sm:mt-2.5 space-y-0.5 ${isAccentStyle ? 'pl-1.5' : ''}`}>
                                    <h3
                                      className="font-black text-xs sm:text-[15px] lg:text-base tracking-tight leading-snug line-clamp-1"
                                      title={school.name}
                                    >
                                      {school.name}
                                    </h3>
                                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
                                      <span className={`text-[9.5px] sm:text-[10px] font-bold ${
                                        useLightSurface ? 'text-slate-600' : 'text-white/85'
                                      }`}>
                                        {schoolLevelsCount} niv<span className="hidden sm:inline">eau{schoolLevelsCount > 1 ? 'x' : ''}</span><span className="sm:hidden">.</span>
                                      </span>
                                      <span className="text-[9.5px] sm:text-[10px] opacity-60">&bull;</span>
                                      <span className={`text-[9.5px] sm:text-[10px] font-bold ${
                                        useLightSurface ? 'text-cyan-800' : 'text-cyan-200'
                                      }`}>
                                        {schoolClassesCount} cl<span className="hidden sm:inline">asse{schoolClassesCount > 1 ? 's' : ''}</span><span className="sm:hidden">.</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* Bas de la carte : Bouton d'accès 3D intégré */}
                                  <div className={`mt-2 sm:mt-2.5 pt-1.5 sm:pt-2 border-t flex items-center justify-between text-[10px] sm:text-xs font-black ${
                                    isAccentStyle ? 'pl-1.5 ' : ''
                                  }${
                                    useLightSurface
                                      ? 'border-slate-100 text-[#00313d] group-hover:text-cyan-600'
                                      : 'border-white/20 text-white group-hover:text-cyan-200'
                                  } transition-colors`}>
                                    <span className="truncate sm:hidden">Classes</span>
                                    <span className="truncate hidden sm:inline">Accéder aux classes</span>
                                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 shrink-0 transform group-hover:translate-x-1 transition-transform" />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Indicateurs de pages cliquables en bas (fixes, affichés dès 2 pages) */}
                  {totalSchoolPages > 1 && (
                    <div className="shrink-0 flex items-center justify-center gap-2 pt-1 pb-0.5 select-none">
                      <button
                        type="button"
                        disabled={safeSchoolsPageIndex <= 0}
                        onClick={() => handleGoToSchoolsPage(safeSchoolsPageIndex - 1)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border transition ${
                          safeSchoolsPageIndex <= 0
                            ? 'bg-white/10 border-white/10 text-white/35 cursor-not-allowed'
                            : 'bg-[#081b33]/80 hover:bg-white/95 border-cyan-300/35 text-cyan-100 hover:text-[#00313d] cursor-pointer'
                        }`}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Précédent</span>
                      </button>

                      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#081b33]/75 border border-cyan-300/25">
                        {Array.from({ length: totalSchoolPages }).map((_, idx) => (
                          <button
                            key={`school-dot-${idx}`}
                            type="button"
                            onClick={() => handleGoToSchoolsPage(idx)}
                            aria-label={`Aller à la page ${idx + 1}`}
                            title={`Page ${idx + 1} / ${totalSchoolPages}`}
                            className={`transition-all duration-200 rounded-full cursor-pointer ${
                              safeSchoolsPageIndex === idx
                                ? 'w-6 h-2 bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.85)]'
                                : 'w-2 h-2 bg-white/35 hover:bg-white/70'
                            }`}
                          />
                        ))}
                      </div>

                      <button
                        type="button"
                        disabled={safeSchoolsPageIndex >= totalSchoolPages - 1}
                        onClick={() => handleGoToSchoolsPage(safeSchoolsPageIndex + 1)}
                        className={`px-2 py-1 rounded-lg text-[11px] font-bold inline-flex items-center gap-1 border transition ${
                          safeSchoolsPageIndex >= totalSchoolPages - 1
                            ? 'bg-white/10 border-white/10 text-white/35 cursor-not-allowed'
                            : 'bg-[#081b33]/80 hover:bg-white/95 border-cyan-300/35 text-cyan-100 hover:text-[#00313d] cursor-pointer'
                        }`}
                      >
                        <span className="hidden sm:inline">Suivant</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 animate-fade-in">
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(true)}
                  className="create-year-trigger group relative w-60 h-56 sm:w-64 sm:h-60 border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-[#081329]/42 hover:bg-[#081329]/62 backdrop-blur-[4px] rounded-3xl flex flex-col items-center justify-center p-5 text-center cursor-pointer transition-all duration-300 shadow-[0_12px_36px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_42px_rgba(6,182,212,0.3)] hover:-translate-y-1 active:translate-y-0"
                  title="Créer votre première rentrée scolaire"
                >
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-cyan-400 transition-all duration-300 mb-3 border border-cyan-200/50">
                    <Plus className="w-7 h-7 stroke-[3]" />
                  </div>
                  <span className="text-base font-black text-white drop-shadow-sm transition-colors">
                    Créer une rentrée scolaire
                  </span>
                  <p className="text-xs text-slate-200/95 max-w-[215px] mt-1.5 leading-relaxed">
                    Commencez à partir de zéro en créant votre première année scolaire (ex : 2026 - 2027), puis vos écoles, niveaux, classes et matières.
                  </p>
                  <div className="mt-3 px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-300/50 text-[10px] font-extrabold text-cyan-100">
                    Nouvelle rentrée +
                  </div>
                </button>
              </div>
          )}
        </section>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* 3. BARRE DE NAVIGATION INFÉRIEURE MOBILE (< md : Reste responsive)       */}
      {/* ========================================================================= */}
      <nav 
        className="md:hidden fixed bottom-0 inset-x-0 h-16 z-50 flex items-center justify-around px-2 border-t border-cyan-900/40 shadow-2xl backdrop-blur-md"
        style={{ backgroundColor: '#002f3a' }}
      >
        {navItems.map((item) => {
          const isActive = activeNavTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNavTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-all flex-1 ${
                isActive ? 'opacity-100 scale-105' : 'opacity-65'
              }`}
            >
              {isActive ? (
                <div className="w-8 h-8 rounded-xl bg-white text-[#002f3a] shadow-md flex items-center justify-center">
                  <IconComponent className="w-4 h-4 stroke-[2.4]" />
                </div>
              ) : (
                <div className="w-8 h-8 flex items-center justify-center text-cyan-100/80">
                  <IconComponent className="w-4 h-4 stroke-[1.8]" />
                </div>
              )}
              <span className={`text-[8.5px] mt-0.5 font-semibold tracking-tight ${
                isActive ? 'text-white font-bold' : 'text-cyan-100/70'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
        </>
      )}

        {/* ========================================================================= */}
        {/* PORTAILS MODALES (RENDUS DANS document.body AU-DESSUS DE TOUS LES CALQUES) */}
        {/* ========================================================================= */}
        {typeof document !== 'undefined' && createPortal(
          <div className="teacher-dark-scope contents">
        {/* ========================================================================= */}
        {/* MODAL DE MODIFICATION D'UNE RENTRÉE SCOLAIRE (MENU 3 TRAITS -> MODIFIER) */}
        {/* ========================================================================= */}
        {editingYear && (
          <div className="fixed inset-0 z-[99990] bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-150"
              style={{ boxShadow: '0 25px 50px -12px rgba(0, 49, 61, 0.35)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    <Pencil className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-[#00313d] leading-none">
                      Modifier la rentrée scolaire
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      {editingYear.label}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingYear(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEditYear} className="p-5 sm:p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Année scolaire (max 12 caractères) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={editYearLabel}
                    onChange={(e) => setEditYearLabel(e.target.value.replace(/[^0-9\s-]/g, '').slice(0, 12))}
                    maxLength={12}
                    placeholder="ex: 2026 - 2027"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {SUGGESTED_YEARS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setEditYearLabel(sug)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold font-mono transition cursor-pointer ${
                          editYearLabel === sug
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-2">
                    Couleur du bouton de l&apos;année
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {YEAR_COLOR_OPTIONS.map((col) => {
                      const isSelected = editYearColorObj.id === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setEditYearColorObj(col)}
                          style={{ backgroundColor: col.bg, borderColor: col.border }}
                          className={`w-full h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                            isSelected ? 'scale-105 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                          }`}
                          title={col.label}
                        >
                          {isSelected && (
                            <Check className={`w-3.5 h-3.5 ${col.id === 'white' ? 'text-slate-800' : 'text-white'} stroke-[3]`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Style d'affichage + aperçu en direct du bouton rentrée */}
                <div className="space-y-3">
                  <ColorStyleSelector
                    value={editYearColorStyle}
                    onChange={setEditYearColorStyle}
                    accentHex={editYearColorObj.bg}
                    isWhiteColor={editYearColorObj.id === 'white'}
                  />
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">
                      Aperçu :
                    </span>
                    {(() => {
                      const isWhite = editYearColorObj.id === 'white';
                      const isAccent = !isWhite && editYearColorStyle === 'accent';
                      const useLight = isWhite || isAccent;
                      return (
                        <div
                          style={{
                            backgroundColor: useLight ? '#ffffff' : editYearColorObj.bg,
                            color: useLight ? '#0f172a' : editYearColorObj.text,
                            borderColor: useLight ? '#cbd5e1' : editYearColorObj.border,
                          }}
                          className="relative overflow-hidden inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold shadow-xs select-none"
                        >
                          {isAccent && (
                            <span
                              className="absolute left-0 top-0 bottom-0 w-[4px]"
                              style={{ backgroundColor: editYearColorObj.bg }}
                            />
                          )}
                          <Calendar className={`w-3.5 h-3.5 opacity-85 ${isAccent ? 'ml-0.5' : ''}`} />
                          <span className="font-mono">{editYearLabel.trim() || '2026 - 2027'}</span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setEditingYear(null)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={!editYearLabel.trim() || !isEditYearDirty}
                    style={{ backgroundColor: editYearLabel.trim() && isEditYearDirty ? '#00313d' : undefined }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition shadow-md flex items-center justify-center gap-2 ${
                      editYearLabel.trim() && isEditYearDirty
                        ? 'text-white hover:bg-[#00242e] cursor-pointer active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Enregistrer</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR AJOUTER / MODIFIER UNE ÉCOLE                      */}
        {/* ========================================================================= */}
        {isAddSchoolModalOpen && (
          <div className="fixed inset-0 z-[99990] bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête bien carré et professionnel */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    {editingSchool ? <Pencil className="w-5 h-5" /> : <School className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingSchool ? "Modifier l'établissement" : "Ajouter une école"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      Rentrée scolaire {currentSelectedYear?.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddSchoolModalOpen(false);
                    setEditingSchool(null);
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulaire intérieur */}
              <form onSubmit={handleCreateSchool} className="p-6 space-y-5 max-h-[78vh] overflow-y-auto">
                {!editingSchool && (
                  <CreationModeToggle
                    mode={schoolCreationMode}
                    onChange={(next) => {
                      setBatchError(null);
                      if (next === 'batch' && schoolName.trim()) {
                        setBatchSchoolRows((prev) => {
                          const hasAny = prev.some((r) => r.name.trim());
                          if (!hasAny) {
                            return [
                              { uid: makeBatchRowUid(), name: schoolName.trim(), logoDataUrl: schoolLogo },
                              { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
                            ];
                          }
                          return prev;
                        });
                      }
                      setSchoolCreationMode(next);
                    }}
                    singleLabel="Une école"
                    batchLabel="Créer plusieurs écoles"
                    batchCount={validBatchSchoolRows.length}
                  />
                )}

                {!editingSchool && schoolCreationMode === 'batch' ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Liste des établissements à créer <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setBatchSchoolRows((prev) => [
                            ...prev,
                            { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
                          ])
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-[11px] font-bold text-cyan-900 transition cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Ajouter une école</span>
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                      {batchSchoolRows.map((row, idx) => (
                        <div
                          key={row.uid}
                          className="flex items-center gap-2 p-2 rounded-xl border border-slate-200 bg-slate-50/70"
                        >
                          <span className="w-5 text-[11px] font-bold text-slate-400 text-center shrink-0">
                            {idx + 1}.
                          </span>
                          <label
                            className="w-9 h-9 rounded-full overflow-hidden border border-slate-300 bg-white hover:border-cyan-500 flex items-center justify-center cursor-pointer shrink-0 transition"
                            title="Importer un logo (facultatif)"
                          >
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleBatchSchoolLogoUpload(row.uid, e)}
                            />
                            {row.logoDataUrl ? (
                              <img src={row.logoDataUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Upload className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </label>
                          <input
                            type="text"
                            value={row.name}
                            autoFocus={idx === 0}
                            onChange={(e) => {
                              setBatchError(null);
                              const val = e.target.value;
                              setBatchSchoolRows((prev) =>
                                prev.map((r) => (r.uid === row.uid ? { ...r, name: val } : r))
                              );
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setBatchSchoolRows((prev) => [
                                  ...prev,
                                  { uid: makeBatchRowUid(), name: '', logoDataUrl: null },
                                ]);
                              }
                            }}
                            placeholder={`Nom de l'école ${idx + 1} (ex: Lycée Moderne...)`}
                            className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white font-semibold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                          />
                          <button
                            type="button"
                            disabled={batchSchoolRows.length <= 1}
                            onClick={() =>
                              setBatchSchoolRows((prev) =>
                                prev.length > 1 ? prev.filter((r) => r.uid !== row.uid) : prev
                              )
                            }
                            className="w-8 h-8 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 flex items-center justify-center cursor-pointer shrink-0"
                            title="Retirer cette ligne"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Astuce : appuyez sur Entrée pour ajouter une nouvelle ligne rapidement. La couleur et le style ci-dessous s&apos;appliquent à toutes les écoles créées.
                    </span>
                  </div>
                ) : (
                  <>
                {/* 1. Nom de l'école (Requis) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Nom de l'établissement / École <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ex : Lycée Moderne d'Excellence, Collège Saint-Joseph..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Ce nom apparaîtra sur la carte de l'école et dans vos classes.
                  </span>
                </div>

                {/* 2. Logo de l'école (Facultatif) avec aperçu ROND */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Logo de l'école <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                  </label>
                  
                  <div className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    {/* Aperçu rond du logo */}
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-600 bg-white shadow-md shrink-0 flex items-center justify-center">
                      {schoolLogo ? (
                        <img src={schoolLogo} alt="Logo aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[#00313d] font-black text-sm">
                          {schoolName.trim() ? schoolName.trim().slice(0, 2).toUpperCase() : <School className="w-6 h-6 text-slate-400" />}
                        </div>
                      )}
                    </div>

                    {/* Actions logo */}
                    <div className="flex-1 space-y-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="school-logo-input"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                        >
                          {schoolLogo ? 'Changer de logo' : 'Importer une image'}
                        </button>
                        {schoolLogo && (
                          <button
                            type="button"
                            onClick={() => setSchoolLogo(null)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Format conseillé (PNG, JPG). S'affiche en rond sur la carte de l'école.
                      </span>
                    </div>
                  </div>
                </div>
                  </>
                )}

                {/* 3. Choisir une couleur (Blanc par défaut si non choisi) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Couleur de la carte <span className="text-[10px] font-normal text-slate-400 lowercase">(blanc par défaut)</span>
                    </label>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedSchoolColor.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SCHOOL_COLOR_OPTIONS.map((col) => {
                      const isSelected = selectedSchoolColor.id === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setSelectedSchoolColor(col)}
                          style={{ backgroundColor: col.bg, borderColor: col.border }}
                          className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                          }`}
                          title={col.label}
                        >
                          {isSelected && (
                            <Check className={`w-4 h-4 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aperçu en direct + choix du style d'affichage de la couleur */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start pt-1">
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Aperçu en direct :
                    </span>
                    {(() => {
                      const isWhite = selectedSchoolColor.id === 'white';
                      const isAccent = !isWhite && schoolColorStyle === 'accent';
                      const useLight = isWhite || isAccent;
                      return (
                        <div 
                          style={{
                            backgroundColor: useLight ? '#ffffff' : selectedSchoolColor.bg,
                            color: useLight ? '#0f172a' : selectedSchoolColor.text,
                            borderColor: useLight ? '#cbd5e1' : selectedSchoolColor.border,
                            borderBottomColor: useLight ? '#94a3b8' : selectedSchoolColor.borderDark,
                          }}
                          className="relative overflow-hidden rounded-xl border-2 border-b-[5px] p-3 flex items-center gap-3 shadow-md transition-all"
                        >
                          {isAccent && (
                            <span
                              className="absolute left-0 top-0 bottom-0 w-[4.5px]"
                              style={{ backgroundColor: selectedSchoolColor.bg }}
                            />
                          )}
                          <div className={`w-11 h-11 rounded-full overflow-hidden border-2 border-white/90 shadow-md shrink-0 flex items-center justify-center bg-white/20 ${isAccent ? 'ml-1' : ''}`}>
                            {schoolLogo ? (
                              <img src={schoolLogo} alt="Aperçu" className="w-full h-full object-cover" />
                            ) : (
                              <span className="font-black text-sm" style={{ color: useLight ? '#00313d' : '#ffffff' }}>
                                {schoolName.trim() ? schoolName.trim().slice(0, 2).toUpperCase() : 'EC'}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="font-black text-sm block truncate">
                              {(!editingSchool && schoolCreationMode === 'batch'
                                ? validBatchSchoolRows[0]?.name
                                : schoolName.trim()) || "Nom de l'école"}
                            </span>
                            <span className="text-[10px] font-semibold opacity-75 block truncate">
                              Établissement &bull; {currentSelectedYear?.label}
                            </span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <ColorStyleSelector
                    value={schoolColorStyle}
                    onChange={setSchoolColorStyle}
                    accentHex={selectedSchoolColor.bg}
                    isWhiteColor={selectedSchoolColor.id === 'white'}
                  />
                </div>

                {batchError && !editingSchool && schoolCreationMode === 'batch' && (
                  <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    {batchError}
                  </div>
                )}

                {/* 4. Bouton Créer / Enregistrer accessible */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isBatchSaving}
                    onClick={() => {
                      setIsAddSchoolModalOpen(false);
                      resetSchoolForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  {(() => {
                    const canSubmitSchool = !isBatchSaving && (editingSchool
                      ? (schoolName.trim().length > 0 && isSchoolDirty)
                      : schoolCreationMode === 'batch'
                      ? validBatchSchoolRows.length > 0
                      : schoolName.trim().length > 0);
                    return (
                      <button
                        type="submit"
                        disabled={!canSubmitSchool}
                        style={{ backgroundColor: canSubmitSchool ? '#00313d' : undefined }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                          canSubmitSchool
                            ? 'text-white hover:bg-[#00242e] cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isBatchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>
                          {editingSchool
                            ? 'Enregistrer'
                            : schoolCreationMode === 'batch'
                            ? validBatchSchoolRows.length > 1
                              ? `Créer ${validBatchSchoolRows.length} écoles`
                              : 'Créer 1 école'
                            : "Créer l'école"}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 1 : CRÉER / MODIFIER UN NIVEAU D'ÉTUDE (Ancien menu de niveaux      */}
        {/* CP1, CE1, 6ème, 2nde, Terminale, Licence...)                              */}
        {/* ========================================================================= */}
        {isAddLevelModalOpen && selectedSchoolInside && (
          <div className="fixed inset-0 z-[99990] bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto max-h-[88vh] flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête professionnel */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    {editingLevel ? <Pencil className="w-5 h-5" /> : <GraduationCap className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingLevel ? "Modifier le niveau d'étude" : "Créer un niveau d'étude"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      {selectedSchoolInside.name} &bull; {currentSelectedYear?.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddLevelModalOpen(false);
                    resetLevelForm();
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateStudyLevel} className="flex flex-col flex-1 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 overflow-y-auto flex-1">
                  {/* COLONNE GAUCHE : Saisie du niveau d'étude + Suggestions rapides */}
                  <div className="space-y-3">
                    {!editingLevel && (
                      <CreationModeToggle
                        mode={levelCreationMode}
                        onChange={(next) => {
                          setBatchError(null);
                          if (next === 'batch' && studyLevelName.trim()) {
                            setBatchLevelRows((prev) => {
                              const hasAny = prev.some((r) => r.name.trim());
                              if (!hasAny) {
                                return [
                                  { uid: makeBatchRowUid(), name: studyLevelName.trim() },
                                  { uid: makeBatchRowUid(), name: '' },
                                ];
                              }
                              return prev;
                            });
                          }
                          setLevelCreationMode(next);
                        }}
                        singleLabel="Un niveau"
                        batchLabel="Créer plusieurs"
                        batchCount={validBatchLevelNames.length}
                      />
                    )}

                    {!editingLevel && levelCreationMode === 'batch' ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                            Niveaux à créer ({validBatchLevelNames.length})
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setBatchLevelRows((prev) => [
                                ...prev,
                                { uid: makeBatchRowUid(), name: '' },
                              ])
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-800 hover:text-cyan-950 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Ajouter ligne</span>
                          </button>
                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                          {batchLevelRows.map((row, idx) => (
                            <div key={row.uid} className="flex items-center gap-1.5">
                              <span className="w-5 text-[10px] font-bold text-slate-400 text-center shrink-0">
                                {idx + 1}.
                              </span>
                              <input
                                type="text"
                                value={row.name}
                                autoFocus={idx === 0}
                                onChange={(e) => {
                                  setBatchError(null);
                                  const val = e.target.value;
                                  setBatchLevelRows((prev) =>
                                    prev.map((r) => (r.uid === row.uid ? { ...r, name: val } : r))
                                  );
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    setBatchLevelRows((prev) => [
                                      ...prev,
                                      { uid: makeBatchRowUid(), name: '' },
                                    ]);
                                  }
                                }}
                                placeholder={`Niveau ${idx + 1} (ex: 6ème, 5ème, BTS 2...)`}
                                className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                              />
                              <button
                                type="button"
                                disabled={batchLevelRows.length <= 1}
                                onClick={() =>
                                  setBatchLevelRows((prev) =>
                                    prev.length > 1 ? prev.filter((r) => r.uid !== row.uid) : prev
                                  )
                                }
                                className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 flex items-center justify-center cursor-pointer shrink-0"
                                title="Retirer cette ligne"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Niveau d'étude <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={studyLevelName}
                          onChange={(e) => setStudyLevelName(e.target.value)}
                          placeholder="Ex: CP1, CE1, 6ème, 2nde, Terminale, Licence 1..."
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                          autoFocus
                        />
                        <span className="text-[10px] text-slate-400 block">
                          Choisissez une proposition rapide ou saisissez votre propre niveau d'étude. Vous créerez ensuite vos classes à l'intérieur.
                        </span>
                      </div>
                    )}

                    {/* Suggestions rapides de niveaux */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {!editingLevel && levelCreationMode === 'batch'
                          ? 'Cliquez pour sélectionner plusieurs niveaux :'
                          : 'Niveaux suggérés :'}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {CLASS_LEVEL_SUGGESTIONS.map((sug) => {
                          const isPicked =
                            !editingLevel && levelCreationMode === 'batch'
                              ? batchLevelRows.some((r) => r.name.trim().toLowerCase() === sug.toLowerCase())
                              : studyLevelName === sug;
                          return (
                            <button
                              key={sug}
                              type="button"
                              onClick={() =>
                                !editingLevel && levelCreationMode === 'batch'
                                  ? handleToggleLevelBatchSuggestion(sug)
                                  : setStudyLevelName(sug)
                              }
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                isPicked
                                  ? 'bg-[#00313d] text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {!editingLevel && levelCreationMode === 'batch' && isPicked && (
                                <Check className="w-3 h-3 stroke-[3]" />
                              )}
                              <span>{sug}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {batchError && !editingLevel && levelCreationMode === 'batch' && (
                      <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {batchError}
                      </div>
                    )}
                  </div>

                  {/* COLONNE DROITE : Couleur d'accent + Aperçu du bouton mince rectangulaire (NON 3D) */}
                  <div className="space-y-4 flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Couleur du niveau
                        </label>
                        <span className="text-xs font-bold text-slate-500">
                          {selectedStudyLevelColor.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {YEAR_COLOR_OPTIONS.map((col) => {
                          const isSelected = selectedStudyLevelColor.id === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedStudyLevelColor(col)}
                              style={{ backgroundColor: col.bg, borderColor: col.border }}
                              className={`h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                              }`}
                              title={col.label}
                            >
                              {isSelected && (
                                <Check className={`w-3.5 h-3.5 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Choix du style d'application de la couleur */}
                    <ColorStyleSelector
                      value={levelColorStyle}
                      onChange={setLevelColorStyle}
                      accentHex={selectedStudyLevelColor.bg}
                      isWhiteColor={selectedStudyLevelColor.id === 'white'}
                    />

                    {/* Aperçu du niveau dans la barre latérale */}
                    <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 dark:bg-[#0f172a] border border-slate-200/80 dark:border-slate-700">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aperçu dans le menu des niveaux :
                      </span>
                      <div className="py-1 max-w-[230px]">
                        {(() => {
                          const isWhite = selectedStudyLevelColor.id === 'white';
                          const isFull = !isWhite && levelColorStyle === 'full';
                          return (
                            <div
                              style={
                                isFull
                                  ? {
                                      backgroundColor: selectedStudyLevelColor.bg,
                                      color: selectedStudyLevelColor.text,
                                      borderColor: selectedStudyLevelColor.border,
                                    }
                                  : undefined
                              }
                              className={`relative overflow-hidden h-8 px-2.5 rounded-md border text-xs font-semibold flex items-center justify-between gap-2 select-none transition-all ${
                                isFull
                                  ? ''
                                  : 'bg-white dark:bg-[#161f33] border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100'
                              }`}
                            >
                              {!isFull && (
                                <span
                                  className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                                  style={{
                                    backgroundColor: isWhite ? '#0051c3' : selectedStudyLevelColor.bg,
                                  }}
                                />
                              )}
                              <div className={`flex items-center gap-2 min-w-0 ${!isFull ? 'pl-1' : ''}`}>
                                <Layers className={`w-3.5 h-3.5 shrink-0 ${isFull ? 'text-white/90' : 'text-slate-500 dark:text-slate-400'}`} />
                                <span className="truncate">
                                  {(!editingLevel && levelCreationMode === 'batch'
                                    ? validBatchLevelNames[0]
                                    : studyLevelName.trim()) || 'Ex: Terminale'}
                                </span>
                              </div>
                              <span
                                className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold shrink-0 ${
                                  isFull
                                    ? 'bg-black/20 border-white/25 text-white'
                                    : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                0
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pied de modale */}
                <div className="p-4 px-6 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    disabled={isBatchSaving}
                    onClick={() => {
                      setIsAddLevelModalOpen(false);
                      resetLevelForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  {(() => {
                    const canSubmitLevel = !isBatchSaving && (editingLevel
                      ? (studyLevelName.trim().length > 0 && isLevelDirty)
                      : levelCreationMode === 'batch'
                      ? validBatchLevelNames.length > 0
                      : studyLevelName.trim().length > 0);
                    return (
                      <button
                        type="submit"
                        disabled={!canSubmitLevel}
                        style={{ backgroundColor: canSubmitLevel ? '#00313d' : undefined }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                          canSubmitLevel
                            ? 'text-white hover:bg-[#00242e] cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isBatchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>
                          {editingLevel
                            ? 'Enregistrer'
                            : levelCreationMode === 'batch'
                            ? validBatchLevelNames.length > 1
                              ? `Créer ${validBatchLevelNames.length} niveaux`
                              : 'Créer 1 niveau'
                            : 'Créer le niveau'}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL 2 (NOUVEAU) : CRÉER / MODIFIER UNE CLASSE DANS LE NIVEAU ACTIF      */}
        {/* L'utilisateur saisit lui-même le nom de la classe (ex: 2nde C1, Groupe A) */}
        {/* ========================================================================= */}
        {isAddClassModalOpen && selectedSchoolInside && (activeLevel || editingClass) && (
          <div className="fixed inset-0 z-[99990] bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto max-h-[88vh] flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête inspiré des autres modales */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    {editingClass ? <Pencil className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingClass ? "Modifier la classe" : "Créer une classe"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-flex items-center gap-1.5">
                      <span>Niveau :</span>
                      <span className="font-black text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200/70">
                        {editingClass ? editingClass.level : activeLevel?.name}
                      </span>
                      <span>&bull;</span>
                      <span>{selectedSchoolInside.name}</span>
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddClassModalOpen(false);
                    resetClassForm();
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateClass} className="flex flex-col flex-1 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 overflow-y-auto flex-1">
                  
                  {/* COLONNE GAUCHE : Nom libre de la classe, Slogan et Professeur */}
                  <div className="space-y-4">
                    {!editingClass && (
                      <CreationModeToggle
                        mode={classCreationMode}
                        onChange={(next) => {
                          setBatchError(null);
                          if (next === 'batch' && className.trim()) {
                            setBatchClassRows((prev) => {
                              const hasAny = prev.some((r) => r.name.trim());
                              if (!hasAny) {
                                return [
                                  { uid: makeBatchRowUid(), name: className.trim(), slogan: classSlogan.trim() },
                                  { uid: makeBatchRowUid(), name: '', slogan: '' },
                                ];
                              }
                              return prev;
                            });
                          }
                          setClassCreationMode(next);
                        }}
                        singleLabel="Une classe"
                        batchLabel="Créer plusieurs"
                        batchCount={validBatchClassRows.length}
                      />
                    )}

                    {!editingClass && classCreationMode === 'batch' ? (
                      <>
                        {/* Raccourcis intelligents basés sur le niveau actif */}
                        <div className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Ajout rapide (cliquez pour ajouter / retirer) :
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              `${activeLevel?.name || 'Classe'} A`,
                              `${activeLevel?.name || 'Classe'} B`,
                              `${activeLevel?.name || 'Classe'} C`,
                              `${activeLevel?.name || 'Classe'} D`,
                              'Groupe 1',
                              'Groupe 2',
                              'Groupe 3',
                            ].map((sug) => {
                              const isPicked = batchClassRows.some(
                                (r) => r.name.trim().toLowerCase() === sug.toLowerCase()
                              );
                              return (
                                <button
                                  key={sug}
                                  type="button"
                                  onClick={() => handleToggleClassBatchSuggestion(sug)}
                                  className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer inline-flex items-center gap-1 ${
                                    isPicked
                                      ? 'bg-[#00313d] text-white shadow-2xs'
                                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {isPicked && <Check className="w-3 h-3 stroke-[3]" />}
                                  <span>{sug}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Liste éditable des classes à créer */}
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                              Classes à créer ({validBatchClassRows.length})
                            </label>
                            <button
                              type="button"
                              onClick={() =>
                                setBatchClassRows((prev) => [
                                  ...prev,
                                  { uid: makeBatchRowUid(), name: '', slogan: '' },
                                ])
                              }
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-800 hover:text-cyan-950 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>Ajouter ligne</span>
                            </button>
                          </div>

                          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                            {batchClassRows.map((row, idx) => (
                              <div key={row.uid} className="flex items-center gap-1.5">
                                <span className="w-5 text-[10px] font-bold text-slate-400 text-center shrink-0">
                                  {idx + 1}.
                                </span>
                                <input
                                  type="text"
                                  value={row.name}
                                  autoFocus={idx === 0}
                                  onChange={(e) => {
                                    setBatchError(null);
                                    const val = e.target.value;
                                    setBatchClassRows((prev) =>
                                      prev.map((r) => (r.uid === row.uid ? { ...r, name: val } : r))
                                    );
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      setBatchClassRows((prev) => [
                                        ...prev,
                                        { uid: makeBatchRowUid(), name: '', slogan: '' },
                                      ]);
                                    }
                                  }}
                                  placeholder={`Ex: ${activeLevel?.name || 'Classe'} ${String.fromCharCode(65 + (idx % 26))}`}
                                  className="flex-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                                <input
                                  type="text"
                                  value={row.slogan}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setBatchClassRows((prev) =>
                                      prev.map((r) => (r.uid === row.uid ? { ...r, slogan: val } : r))
                                    );
                                  }}
                                  placeholder="Slogan (opt.)"
                                  className="w-28 h-9 px-2 rounded-lg border border-slate-300 bg-white text-[11px] font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                                />
                                <button
                                  type="button"
                                  disabled={batchClassRows.length <= 1}
                                  onClick={() =>
                                    setBatchClassRows((prev) =>
                                      prev.length > 1 ? prev.filter((r) => r.uid !== row.uid) : prev
                                    )
                                  }
                                  className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 flex items-center justify-center cursor-pointer shrink-0"
                                  title="Retirer cette ligne"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Nom du professeur commun pour toutes les classes créées */}
                        <div className="space-y-1">
                          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                            Nom du Professeur / Maître <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={classTeacherName}
                            onChange={(e) => setClassTeacherName(e.target.value)}
                            placeholder="Ex: M. Delmas Kouassi, Mme Koffi..."
                            className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                          />
                        </div>

                        {batchError && (
                          <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                            {batchError}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                    {/* 1. Nom de la classe donné librement par l'utilisateur (Requis) */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Nom de la classe <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={className}
                        onChange={(e) => setClassName(e.target.value)}
                        placeholder={`Ex: ${editingClass ? editingClass.level : activeLevel?.name} A, ${editingClass ? editingClass.level : activeLevel?.name} C1, Groupe 1...`}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                        autoFocus
                      />
                      <span className="text-[10px] text-slate-400 block">
                        Saisissez librement le nom de cette classe rattachée au niveau <span className="font-bold text-slate-600">{editingClass ? editingClass.level : activeLevel?.name}</span>.
                      </span>
                    </div>

                    {/* 2. Slogan / Sous-titre de la classe (Facultatif) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Slogan / Description <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                      </label>
                      <input
                        type="text"
                        value={classSlogan}
                        onChange={(e) => setClassSlogan(e.target.value)}
                        placeholder="Ex: Discipline et Réussite, Série Scientifique..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                    </div>

                    {/* 3. Nom du professeur ou maître (Requis) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Nom du Professeur / Maître <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={classTeacherName}
                        onChange={(e) => setClassTeacherName(e.target.value)}
                        placeholder="Ex: M. Delmas Kouassi, Mme Koffi..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                    </div>
                      </>
                    )}
                  </div>

                  {/* COLONNE DROITE : Couleur de la classe & Aperçu 3D compact */}
                  <div className="space-y-4 flex flex-col justify-between">
                    {/* Choix de la couleur */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Couleur de la classe
                        </label>
                        <span className="text-xs font-bold text-slate-500">
                          {selectedClassColor.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {CLASS_COLOR_OPTIONS.map((col) => {
                          const isSelected = selectedClassColor.id === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedClassColor(col)}
                              style={{ backgroundColor: col.bg, borderColor: col.border }}
                              className={`h-8 rounded-lg border flex items-center justify-center transition-all cursor-pointer ${
                                isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                              }`}
                              title={col.label}
                            >
                              {isSelected && (
                                <Check className={`w-3.5 h-3.5 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Choix du style d'application de la couleur */}
                    <ColorStyleSelector
                      value={classColorStyle}
                      onChange={setClassColorStyle}
                      accentHex={selectedClassColor.bg}
                      isWhiteColor={selectedClassColor.id === 'white'}
                    />

                    {/* Aperçu en direct de la carte classe */}
                    <div className="space-y-1.5 pt-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aperçu de la carte classe :
                      </span>
                      {(() => {
                        const isWhite = selectedClassColor.id === 'white';
                        const isFull = !isWhite && classColorStyle === 'full';
                        return (
                          <div
                            style={
                              isFull
                                ? {
                                    backgroundColor: selectedClassColor.bg,
                                    color: selectedClassColor.text,
                                    borderColor: selectedClassColor.borderDark || selectedClassColor.border,
                                  }
                                : undefined
                            }
                            className={`relative overflow-hidden w-56 rounded-xl border px-3 py-2.5 flex flex-col justify-between shadow-xs transition-all select-none ${
                              isFull
                                ? ''
                                : 'bg-white dark:bg-[#131c2e] border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                            }`}
                          >
                            {!isFull && (
                              <span
                                className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                                style={{
                                  backgroundColor: isWhite ? '#64748b' : selectedClassColor.bg,
                                }}
                              />
                            )}
                            <div className={!isFull ? 'pl-1.5' : ''}>
                              <span className={`text-[9.5px] font-semibold uppercase tracking-wide block truncate ${
                                isFull ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                {classSlogan.trim() || (editingClass ? editingClass.level : activeLevel?.name) || 'Niveau'}
                              </span>
                              <h4 className="text-xs font-bold leading-snug truncate mt-0.5">
                                {(!editingClass && classCreationMode === 'batch'
                                  ? validBatchClassRows[0]?.name
                                  : className.trim()) || 'Nom de la classe'}
                              </h4>
                              <span className={`text-[10px] block truncate mt-0.5 ${
                                isFull ? 'text-white/85' : 'text-slate-600 dark:text-slate-400'
                              }`}>
                                {classTeacherName.trim() || 'Nom du professeur'}
                              </span>
                            </div>

                            <div className={`mt-2.5 pt-1.5 border-t flex items-center justify-between text-[10px] ${
                              !isFull ? 'pl-1.5 ' : ''
                            }${
                              isFull
                                ? 'border-white/25 text-white/90'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}>
                              <span>3 trim. • 0 mat.</span>
                              <span className="font-semibold">Ouvrir →</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                {/* Boutons Créer / Enregistrer */}
                <div className="p-4 px-6 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    disabled={isBatchSaving}
                    onClick={() => {
                      setIsAddClassModalOpen(false);
                      resetClassForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  {(() => {
                    const canSubmitClass = !isBatchSaving && (editingClass
                      ? (className.trim().length > 0 && classTeacherName.trim().length > 0 && isClassDirty)
                      : classCreationMode === 'batch'
                      ? (validBatchClassRows.length > 0 && classTeacherName.trim().length > 0)
                      : (className.trim().length > 0 && classTeacherName.trim().length > 0));
                    return (
                      <button
                        type="submit"
                        disabled={!canSubmitClass}
                        style={{ backgroundColor: canSubmitClass ? '#00313d' : undefined }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                          canSubmitClass
                            ? 'text-white hover:bg-[#00242e] cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isBatchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>
                          {editingClass
                            ? 'Enregistrer'
                            : classCreationMode === 'batch'
                            ? validBatchClassRows.length > 1
                              ? `Créer ${validBatchClassRows.length} classes`
                              : 'Créer 1 classe'
                            : 'Créer la classe'}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR CRÉER UNE MATIÈRE (DANS LA CLASSE SÉLECTIONNÉE)   */}
        {/* ========================================================================= */}
        {isAddSubjectModalOpen && activeClass && (
          <div className="fixed inset-0 z-[99990] bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto max-h-[88vh] flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête bien carré et professionnel */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 text-white flex items-center justify-center shadow-md">
                    {editingSubject ? <Pencil className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingSubject ? "Modifier la matière" : "Créer une matière"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      Classe : {getClassFullLabel(activeClass)} &bull; {activeTerm?.name || 'Trimestre 1'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddSubjectModalOpen(false);
                    resetSubjectForm();
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulaire intérieur */}
              <form onSubmit={handleCreateSubject} className="p-6 space-y-4 overflow-y-auto flex-1">
                {!editingSubject && (
                  <CreationModeToggle
                    mode={subjectCreationMode}
                    onChange={(next) => {
                      setBatchError(null);
                      if (next === 'batch' && subjectName.trim()) {
                        setBatchSubjectRows((prev) => {
                          const hasAny = prev.some((r) => r.name.trim());
                          if (!hasAny) {
                            return [
                              { uid: makeBatchRowUid(), name: subjectName.trim(), coeff: subjectCoefficient.trim() },
                              { uid: makeBatchRowUid(), name: '', coeff: '' },
                            ];
                          }
                          return prev;
                        });
                      }
                      setSubjectCreationMode(next);
                    }}
                    singleLabel="Une matière"
                    batchLabel="Créer plusieurs matières"
                    batchCount={validBatchSubjectRows.length}
                  />
                )}

                {!editingSubject && subjectCreationMode === 'batch' ? (
                  <div className="space-y-3">
                    {/* Suggestions rapides cliquables pour cocher plusieurs matières en 2 secondes */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Cliquez pour ajouter / retirer rapidement :
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {CLASS_SUBJECT_SUGGESTIONS.map((sug) => {
                          const isPicked = batchSubjectRows.some(
                            (r) => r.name.trim().toLowerCase() === sug.toLowerCase()
                          );
                          return (
                            <button
                              key={sug}
                              type="button"
                              onClick={() => handleToggleSubjectBatchSuggestion(sug)}
                              className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer inline-flex items-center gap-1 ${
                                isPicked
                                  ? 'bg-red-600 text-white shadow-2xs'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              }`}
                            >
                              {isPicked && <Check className="w-3 h-3 stroke-[3]" />}
                              <span>{sug}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Liste éditable : Nom de la matière + Coefficient facultatif par ligne */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Matières à créer ({validBatchSubjectRows.length})
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setBatchSubjectRows((prev) => [
                              ...prev,
                              { uid: makeBatchRowUid(), name: '', coeff: '' },
                            ])
                          }
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[11px] font-bold text-red-700 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Ajouter une ligne</span>
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {batchSubjectRows.map((row, idx) => (
                          <div key={row.uid} className="flex items-center gap-1.5">
                            <span className="w-5 text-[10px] font-bold text-slate-400 text-center shrink-0">
                              {idx + 1}.
                            </span>
                            <input
                              type="text"
                              value={row.name}
                              autoFocus={idx === 0}
                              onChange={(e) => {
                                setBatchError(null);
                                const val = e.target.value;
                                setBatchSubjectRows((prev) =>
                                  prev.map((r) => (r.uid === row.uid ? { ...r, name: val } : r))
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  setBatchSubjectRows((prev) => [
                                    ...prev,
                                    { uid: makeBatchRowUid(), name: '', coeff: '' },
                                  ]);
                                }
                              }}
                              placeholder={`Matière ${idx + 1} (ex: Mathématiques)`}
                              className="flex-1 h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            />
                            <input
                              type="number"
                              step="0.5"
                              min="0.5"
                              max="100"
                              value={row.coeff}
                              onChange={(e) => {
                                const val = e.target.value;
                                setBatchSubjectRows((prev) =>
                                  prev.map((r) => (r.uid === row.uid ? { ...r, coeff: val } : r))
                                );
                              }}
                              placeholder="Coeff"
                              title="Coefficient facultatif pour cette matière"
                              className="w-20 h-9 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shrink-0"
                            />
                            <button
                              type="button"
                              disabled={batchSubjectRows.length <= 1}
                              onClick={() =>
                                setBatchSubjectRows((prev) =>
                                  prev.length > 1 ? prev.filter((r) => r.uid !== row.uid) : prev
                                )
                              }
                              className="w-7 h-7 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 disabled:opacity-30 flex items-center justify-center cursor-pointer shrink-0"
                              title="Retirer cette ligne"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Le coefficient est facultatif et peut être personnalisé pour chaque matière. Toutes les matières sont enregistrées d&apos;un coup sur votre compte.
                      </span>
                    </div>

                    {batchError && (
                      <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                        {batchError}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {/* 1. Nom de la matière (Requis) + Suggestions rapides */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Nom de la matière <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Ex: Mathématiques, Français, SVT..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    autoFocus
                  />
                  {/* Suggestions rapides */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {CLASS_SUBJECT_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setSubjectName(sug)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all ${
                          subjectName === sug
                            ? 'bg-red-500 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Coefficient de la matière (facultatif — enregistré en base lié au compte et à la matière) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Coefficient de la matière <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    value={subjectCoefficient}
                    onChange={(e) => setSubjectCoefficient(e.target.value)}
                    placeholder="Ex : 1, 2, 3, 4..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                    {['', '1', '2', '3', '4', '5'].map((val) => {
                      const isSelected = subjectCoefficient.trim() === val;
                      return (
                        <button
                          key={val || 'none'}
                          type="button"
                          onClick={() => setSubjectCoefficient(val)}
                          className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition cursor-pointer border ${
                            isSelected
                              ? 'bg-[#00313d] text-white border-[#00313d] shadow-2xs'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {val === '' ? 'Aucun' : `Coeff ${val}`}
                        </button>
                      );
                    })}
                  </div>
                  <span className="text-[10px] text-slate-400 block">
                    Enregistré sur votre compte et utilisé pour le calcul de la moyenne générale.
                  </span>
                </div>
                  </>
                )}

                {/* 3. Couleur de la carte de matière (Blanc par défaut) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Couleur de la carte <span className="text-[10px] font-normal text-slate-400 lowercase">(blanc par défaut)</span>
                    </label>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedSubjectColor.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SUBJECT_COLOR_OPTIONS.map((col) => {
                      const isSelected = selectedSubjectColor.id === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setSelectedSubjectColor(col)}
                          style={{ backgroundColor: col.bg, borderColor: col.border }}
                          className={`h-8 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                          }`}
                          title={col.label}
                        >
                          {isSelected && (
                            <Check className={`w-3.5 h-3.5 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aperçu en direct + choix du style d'affichage de la couleur (placé côte à côte) */}
                <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4 items-center pt-1">
                  <div className="space-y-1.5">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Aperçu de la carte matière :
                    </span>
                    {(() => {
                      const isWhite = selectedSubjectColor.id === 'white';
                      const isFull = !isWhite && subjectColorStyle === 'full';
                      return (
                        <div
                          style={
                            isFull
                              ? {
                                  backgroundColor: selectedSubjectColor.bg,
                                  color: selectedSubjectColor.text,
                                  borderColor: selectedSubjectColor.borderDark || selectedSubjectColor.border,
                                }
                              : undefined
                          }
                          className={`relative overflow-hidden w-44 sm:w-48 rounded-xl border px-3 py-2.5 min-h-[76px] flex flex-col justify-between shadow-xs transition-all select-none ${
                            isFull
                              ? ''
                              : 'bg-white dark:bg-[#131c2e] border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white'
                          }`}
                        >
                          {!isFull && (
                            <span
                              className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                              style={{
                                backgroundColor: isWhite ? '#64748b' : selectedSubjectColor.bg,
                              }}
                            />
                          )}
                          <div className={!isFull ? 'pl-1.5' : ''}>
                            <div className="font-bold text-xs leading-snug line-clamp-2 break-words">
                              {(!editingSubject && subjectCreationMode === 'batch'
                                ? validBatchSubjectRows[0]?.name
                                : subjectName.trim()) || 'Nom matière'}
                            </div>
                            <div className="mt-1">
                              {((!editingSubject && subjectCreationMode === 'batch'
                                ? validBatchSubjectRows[0]?.coeff?.trim()
                                : subjectCoefficient.trim())) ? (
                                <span
                                  className={`inline-block text-[9.5px] font-semibold px-1.5 py-0.2 rounded border ${
                                    isFull
                                      ? 'bg-black/25 text-white border-white/25'
                                      : 'bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                                  }`}
                                >
                                  Coeff{' '}
                                  {!editingSubject && subjectCreationMode === 'batch'
                                    ? validBatchSubjectRows[0]?.coeff?.trim()
                                    : subjectCoefficient.trim()}
                                </span>
                              ) : (
                                <span
                                  className={`text-[9.5px] font-medium ${
                                    isFull ? 'text-white/80' : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  Sans coefficient
                                </span>
                              )}
                            </div>
                          </div>
                          <div
                            className={`mt-2 pt-1.5 border-t flex items-center justify-between text-[10px] ${
                              !isFull ? 'pl-1.5 ' : ''
                            }${
                              isFull
                                ? 'border-white/25 text-white/90'
                                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            <span>Tableur</span>
                            <span className="font-semibold">Notes →</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <ColorStyleSelector
                    value={subjectColorStyle}
                    onChange={setSubjectColorStyle}
                    accentHex={selectedSubjectColor.bg}
                    isWhiteColor={selectedSubjectColor.id === 'white'}
                  />
                </div>

                {/* Boutons actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isBatchSaving}
                    onClick={() => {
                      setIsAddSubjectModalOpen(false);
                      resetSubjectForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  {(() => {
                    const canSubmitSubject = !isBatchSaving && (editingSubject
                      ? (subjectName.trim().length > 0 && isSubjectDirty)
                      : subjectCreationMode === 'batch'
                      ? validBatchSubjectRows.length > 0
                      : subjectName.trim().length > 0);
                    return (
                      <button
                        type="submit"
                        disabled={!canSubmitSubject}
                        style={{ backgroundColor: canSubmitSubject ? '#dc2626' : undefined }}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                          canSubmitSubject
                            ? 'text-white hover:bg-red-700 cursor-pointer'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        }`}
                      >
                        {isBatchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                        <span>
                          {editingSubject
                            ? 'Enregistrer'
                            : subjectCreationMode === 'batch'
                            ? validBatchSubjectRows.length > 1
                              ? `Créer ${validBatchSubjectRows.length} matières`
                              : 'Créer 1 matière'
                            : 'Créer la matière'}
                        </span>
                      </button>
                    );
                  })()}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MENU CONTEXTUEL FLOTTANT "3 TRAITS" INTELLIGENT (PORTAIL + ANTI-OBSTACLE) */}
        {/* ========================================================================= */}
        <SmartFloatingPopover
          open={Boolean(activeMenu)}
          anchorEl={activeMenu?.anchorEl ?? null}
          fallbackRect={activeMenu?.fallbackRect ?? null}
          boundaryEl={mainContainerRef.current}
          preferredSide="bottom"
          preferredAlign="start"
          gap={8}
          onClose={() => setActiveMenu(null)}
          ignoreOutsideSelector=".card-menu-trigger"
          dataPopoverId="teacher-entity-context-menu"
          className="card-dropdown-menu w-56"
        >
          {activeMenu && (
            <div className="py-1.5">
              <div className="px-3.5 py-1.5 mb-1 bg-slate-50/90 border-b border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
                  {activeMenu.type === 'year'
                    ? `Rentrée · ${activeMenu.item.label}`
                    : activeMenu.type === 'school'
                    ? `École · ${activeMenu.item.name}`
                    : activeMenu.type === 'level'
                    ? `Niveau · ${activeMenu.item.name}`
                    : activeMenu.type === 'class'
                    ? `Classe · ${getClassFullLabel(activeMenu.item)}`
                    : activeMenu.type === 'term'
                    ? `${activeMenu.item.name}${activeMenu.item.coefficient !== undefined && activeMenu.item.coefficient !== null ? ` · Coeff ${activeMenu.item.coefficient}` : ''}`
                    : `Matière · ${activeMenu.item.name}`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleTriggerEdit(activeMenu.type, activeMenu.item)}
                className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Pencil className="w-3.5 h-3.5 text-cyan-700 stroke-[2.2] shrink-0" />
                <span>
                  {activeMenu.type === 'term'
                    ? activeMenu.item.coefficient !== undefined && activeMenu.item.coefficient !== null
                      ? 'Modifier le coefficient'
                      : 'Ajouter un coefficient'
                    : 'Modifier les informations'}
                </span>
              </button>
              <div className="my-1 border-t border-slate-100" />
              <button
                type="button"
                onClick={() => handleTriggerDelete(activeMenu.type, activeMenu.item)}
                className="w-full px-3.5 py-2 text-left text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-500 stroke-[2.2] shrink-0" />
                <span>Supprimer</span>
              </button>
            </div>
          )}
        </SmartFloatingPopover>

        {/* ========================================================================= */}
        {/* MODAL DE SUPPRESSION SÉCURISÉE AVEC SAISIE EXACTE DU NOM REQUIS          */}
        {/* ========================================================================= */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[99995] bg-[#001820]/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div 
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-150"
              style={{
                boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.35)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête alerte rouge */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-red-950 leading-tight">
                      Confirmation de suppression
                    </h3>
                    <span className="text-[11px] font-semibold text-red-600/90 mt-0.5 inline-block">
                      Action irréversible
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteConfirmInput('');
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white/80 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenu et avertissement */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="p-3.5 bg-red-50 rounded-xl border border-red-200/80 text-xs text-red-900 leading-relaxed font-medium">
                  {deleteTarget.warningMessage}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    Pour confirmer la suppression définitive de <span className="font-extrabold text-slate-900">{deleteTarget.displayName}</span>, veuillez recopier son nom ci-dessous :
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-800 font-mono tracking-wide truncate select-all">
                      {deleteTarget.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyDeleteName(deleteTarget.name)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 border ${
                        isCopiedDeleteName
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                      title="Copier et insérer directement le nom"
                    >
                      {isCopiedDeleteName ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          <span>Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Recopiez le nom exact ici..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmDelete();
                      }
                    }}
                  />
                  
                  {deleteConfirmInput.trim().length > 0 && 
                   deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase() && (
                    <span className="text-[11px] font-bold text-red-600 block">
                      &bull; Le nom saisi ne correspond pas exactement.
                    </span>
                  )}
                </div>

                {/* Boutons d'action */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteConfirmInput('');
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      deleteConfirmInput.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase()
                        ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer définitivement</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PETIT MENU FLOTTANT SUR LE CÔTÉ : AJOUTER UN OU PLUSIEURS TRIMESTRES      */}
        {/* ========================================================================= */}
        <SmartFloatingPopover
          open={Boolean(isAddTermPopoverOpen && activeClass)}
          anchorEl={addTermBtnRef.current}
          boundaryEl={mainContainerRef.current}
          preferredSide="right"
          preferredAlign="start"
          gap={10}
          onClose={() => {
            setIsAddTermPopoverOpen(false);
            setNewTermCoeffInput('');
            setTermBatchCount(1);
            setBatchTermCoeffs(['', '', '', '']);
            setBatchError(null);
          }}
          ignoreOutsideSelector=".add-term-trigger"
          dataPopoverId="add-term-side-popover"
          className="w-68 sm:w-76 rounded-2xl"
        >
          {activeClass && (
            <form onSubmit={handleConfirmAddTerm} className="p-3.5 space-y-3 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-[#00313d] leading-tight truncate">
                    {termBatchCount > 1
                      ? `Trimestres ${nextTermNumber} à ${nextTermNumber + termBatchCount - 1}`
                      : `Trimestre ${nextTermNumber}`}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400 block truncate">
                    {getClassFullLabel(activeClass)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddTermPopoverOpen(false);
                    setNewTermCoeffInput('');
                    setTermBatchCount(1);
                    setBatchTermCoeffs(['', '', '', '']);
                    setBatchError(null);
                  }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Nombre de trimestres à créer d'un coup */}
              <div className="space-y-1">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  Nombre à créer
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[1, 2, 3, 4].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => {
                        setTermBatchCount(cnt);
                        setBatchError(null);
                      }}
                      className={`py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer ${
                        termBatchCount === cnt
                          ? 'bg-[#00313d] text-white border-[#00313d]'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {cnt === 1 ? '1' : `${cnt} d'un coup`}
                    </button>
                  ))}
                </div>
              </div>

              {termBatchCount === 1 ? (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    Coefficient <span className="font-semibold text-slate-400 normal-case">(facultatif)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    max="100"
                    value={newTermCoeffInput}
                    onChange={(e) => setNewTermCoeffInput(e.target.value)}
                    placeholder="Ex : 1, 2, 3..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    autoFocus
                  />
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    {['', '1', '2', '3'].map((val) => {
                      const isSelected = newTermCoeffInput.trim() === val;
                      return (
                        <button
                          key={val || 'none'}
                          type="button"
                          onClick={() => setNewTermCoeffInput(val)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                            isSelected
                              ? 'bg-[#00313d] text-white border-[#00313d]'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {val === '' ? 'Aucun' : `Coeff ${val}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                    Coefficients <span className="font-semibold text-slate-400 normal-case">(facultatif)</span>
                  </label>
                  <div className="space-y-1.5">
                    {Array.from({ length: termBatchCount }).map((_, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          Trimestre {nextTermNumber + idx}
                        </span>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="100"
                          value={batchTermCoeffs[idx] ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchError(null);
                            setBatchTermCoeffs((prev) => prev.map((c, i) => (i === idx ? val : c)));
                          }}
                          placeholder="Coeff"
                          className="w-20 h-8 px-2 text-center rounded-lg border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {batchError && termBatchCount > 1 && (
                <div className="text-[11px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-2.5 py-1.5">
                  {batchError}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isBatchSaving}
                  className="w-full py-2 rounded-xl bg-[#00313d] hover:bg-[#00242e] disabled:opacity-50 text-white text-xs font-black shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isBatchSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  )}
                  <span>
                    {termBatchCount > 1 ? `Créer ${termBatchCount} trimestres` : 'Créer'}
                  </span>
                </button>
              </div>
            </form>
          )}
        </SmartFloatingPopover>

        {/* ========================================================================= */}
        {/* PETIT MENU FLOTTANT : AJOUTER / MODIFIER LE COEFFICIENT D'UN TRIMESTRE    */}
        {/* ========================================================================= */}
        <SmartFloatingPopover
          open={Boolean(editingTermCoeff)}
          anchorEl={editingTermCoeff?.anchorEl ?? null}
          fallbackRect={editingTermCoeff?.fallbackRect ?? null}
          boundaryEl={mainContainerRef.current}
          preferredSide="bottom"
          preferredAlign="start"
          gap={8}
          onClose={() => {
            setEditingTermCoeff(null);
            setEditTermCoeffInput('');
          }}
          dataPopoverId="edit-term-coeff-popover"
          className="w-64 sm:w-72 rounded-2xl"
        >
          {editingTermCoeff && (
            <form onSubmit={handleSaveTermCoefficient} className="p-3.5 space-y-3 text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="min-w-0">
                  <h3 className="text-xs font-black text-[#00313d] leading-tight truncate">
                    Coefficient · {editingTermCoeff.term.name}
                  </h3>
                  <span className="text-[10px] font-semibold text-slate-400 block truncate">
                    Laissez vide pour retirer le coefficient
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTermCoeff(null);
                    setEditTermCoeffInput('');
                  }}
                  className="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                  Coefficient <span className="font-semibold text-slate-400 normal-case">(facultatif)</span>
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="100"
                  value={editTermCoeffInput}
                  onChange={(e) => setEditTermCoeffInput(e.target.value)}
                  placeholder="Ex : 1, 2, 3..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                  autoFocus
                />
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {['', '1', '2', '3'].map((val) => {
                    const isSelected = editTermCoeffInput.trim() === val;
                    return (
                      <button
                        key={val || 'none'}
                        type="button"
                        onClick={() => setEditTermCoeffInput(val)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold transition cursor-pointer border ${
                          isSelected
                            ? 'bg-[#00313d] text-white border-[#00313d]'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {val === '' ? 'Aucun' : `Coeff ${val}`}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingTermCoeff(null);
                    setEditTermCoeffInput('');
                  }}
                  className="flex-1 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-[#00313d] hover:bg-[#00242e] text-white text-xs font-black shadow-sm transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Enregistrer</span>
                </button>
              </div>
            </form>
          )}
        </SmartFloatingPopover>
          </div>,
          document.body
        )}
    </div>
  );
};
