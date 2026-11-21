import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Bell,
  Settings,
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
  Save,
  WifiOff,
  CheckCircle2
} from 'lucide-react';
import { ViewerSuperExpandButton } from '../ViewerSuperExpandButton';
import { DnaLogo } from '../DnaLogo';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../../utils/viewerExpandManager';
import { SubjectGradebookView } from './SubjectGradebookView';
import { TeacherTransferView } from './TeacherTransferView';
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

export interface SchoolYearItem {
  id: string;
  label: string; // ex: "2026 - 2027"
  color: string; // hex ou 'white'
  textColor?: string;
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
  iconGradient: string;
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
  const authUserId = authUser?.id || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') || '' : '');
  const initialCloudCache = useMemo(
    () => (authUserId ? readUserBootstrapCache(authUserId) : null),
    [authUserId]
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
      setSaveFeedbackMessage('Session non connectée. Veuillez vous reconnecter pour enregistrer dans la base de données.');
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
        setSaveFeedbackMessage("Hors ligne — Échec de l'enregistrement : impossible de joindre Cloudflare D1.");
      } else {
        setSaveUiState('error');
        setSaveFeedbackMessage(err?.message || errorFallback);
        setCloudStatus('error');
        setCloudError(err?.message || errorFallback);
      }
      return null;
    }
  }, []);

  // 1. Accueil par défaut de cette application : le bouton "Tableau de bord" (comme entouré sur l'image 1)
  const [activeNavTab, setActiveNavTab] = useState<'dashboard' | 'trainees' | 'classes' | 'discussions' | 'groups' | 'library'>('dashboard');

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
  const [isTransferViewOpen, setIsTransferViewOpen] = useState(false);

  // Vidéo d'animation continue plein écran en arrière-plan (accélérée pour un mouvement dynamique bien visible)
  const bgVideoRef = useRef<HTMLVideoElement>(null);
  const BG_VIDEO_PLAYBACK_RATE = 2.15;

  const ensureBackgroundVideoPlaying = useCallback(() => {
    const vid = bgVideoRef.current;
    if (!vid) return;
    vid.muted = true;
    vid.defaultPlaybackRate = BG_VIDEO_PLAYBACK_RATE;
    if (vid.playbackRate !== BG_VIDEO_PLAYBACK_RATE) {
      vid.playbackRate = BG_VIDEO_PLAYBACK_RATE;
    }
    if (vid.paused) {
      vid.play().catch(() => {});
    }
  }, []);

  // Agrandissement progressif et plein écran (Image 2 & 3 - Desktop uniquement)
  const viewerExpandLevel = useViewerExpandLevel();
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // Nettoyage complet de l'agrandissement au démontage du composant
  useEffect(() => {
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
    return initialCloudCache?.schoolYears?.[0]?.id || '';
  });

  // Écoles créées attachées à chaque année scolaire (isolées par user_id dans D1 + logo R2)
  const [schools, setSchools] = useState<SchoolItem[]>(() => initialCloudCache?.schools || []);

  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  // École sélectionnée dans laquelle on est "rentré" à l'intérieur
  const [selectedSchoolInside, setSelectedSchoolInside] = useState<SchoolItem | null>(null);

  // Niveaux d'étude créés attachés à chaque école (CP1, 6ème, 2nde, Terminale, Licence 1...)
  const [studyLevels, setStudyLevels] = useState<StudyLevelItem[]>(() => initialCloudCache?.studyLevels || []);

  // Niveau d'étude activement sélectionné dans l'école
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);

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
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

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
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // Matière sélectionnée dans laquelle on est "rentré" à l'intérieur pour afficher le tableur de notes & moyennes
  const [selectedSubjectInside, setSelectedSubjectInside] = useState<SubjectItem | null>(null);

  // Relancer automatiquement la vidéo de fond accélérée au retour d'une matière ou d'un autre onglet
  useEffect(() => {
    ensureBackgroundVideoPlaying();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        ensureBackgroundVideoPlaying();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [ensureBackgroundVideoPlaying, selectedSubjectInside]);

  // Chargement complet & isolation stricte par compte depuis Cloudflare D1 (démarrage vierge à ZÉRO — aucune année pré-créée)
  const loadFromCloudD1 = useCallback(async () => {
    // Nettoyer définitivement toute ancienne donnée locale non scopée héritée du code précédent
    clearLegacyUnscopedTeacherData();

    if (!getTeacherAuthToken() || !authUserId) {
      setCloudStatus('ready');
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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
      setServerGradebookStats(data.gradebookStats || {});
      setSelectedYearId((prev) =>
        prev && data.schoolYears.some((y) => y.id === prev) ? prev : data.schoolYears[0]?.id || ''
      );
      setSelectedSchoolInside((prev) =>
        prev ? data.schools.find((s) => s.id === prev.id) || null : null
      );

      writeUserBootstrapCache(authUserId, data);
      isCloudHydratedRef.current = true;
      setCloudStatus('ready');
    } catch (err: any) {
      if (isOfflineOrNetworkError(err)) {
        setIsOnline(false);
        setSaveUiState('offline');
        setSaveFeedbackMessage("Hors ligne — Impossible de joindre Cloudflare D1.");
      } else {
        setCloudStatus('error');
        setCloudError(err?.message || 'Impossible de charger vos données depuis Cloudflare D1.');
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
      "Échec de l'enregistrement manuel dans la base de données."
    );
    if (synced && authUserId) {
      setSchoolYears(synced.schoolYears);
      setSchools(synced.schools);
      setStudyLevels(synced.studyLevels);
      setClasses(synced.classes);
      setTerms(synced.terms);
      setSubjects(synced.subjects);
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

  useEffect(() => {
    isCloudHydratedRef.current = false;
    loadFromCloudD1();
  }, [loadFromCloudD1]);

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
      gradebookStats: serverGradebookStats,
    });
  }, [authUserId, schoolYears, schools, studyLevels, classes, terms, subjects, serverGradebookStats]);

  // Rafraîchir uniquement les stats de tableurs après fermeture/sauvegarde d'un tableur
  const refreshCloudStats = useCallback(async () => {
    if (!getTeacherAuthToken() || !authUserId) return;
    try {
      const data = await TeacherGradebookAPI.bootstrap();
      setServerGradebookStats(data.gradebookStats || {});
      writeUserBootstrapCache(authUserId, data);
    } catch {}
  }, [authUserId]);

  // Réinitialiser la matière affichée si l'on change de niveau, de classe, d'école ou de trimestre
  useEffect(() => {
    setSelectedSubjectInside(null);
  }, [selectedLevelId, selectedClassId, selectedSchoolInside, selectedTermId]);

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

  // État du modal d'ajout d'un nouveau trimestre
  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);

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

  // Les 3 trimestres par défaut sont créés atomiquement avec chaque classe dans D1.
  // Filet de sécurité si une classe importée ancienne n'avait pas encore de trimestre.
  useEffect(() => {
    if (!isCloudHydratedRef.current || classes.length === 0) return;
    const missingClasses = classes.filter(c => !terms.some(t => t.classId === c.id));
    if (missingClasses.length === 0) return;
    missingClasses.forEach((c) => {
      [1, 2, 3].forEach((num) => {
        const newTerm: TermItem = {
          id: generateTeacherEntityId(`term-${num}`),
          classId: c.id,
          schoolId: c.schoolId,
          yearId: c.yearId,
          number: num,
          name: `Trimestre ${num}`,
          createdAt: Date.now() + num,
        };
        setTerms(prev => (prev.some(t => t.classId === c.id && t.number === num) ? prev : [...prev, newTerm]));
        if (getTeacherAuthToken()) {
          TeacherGradebookAPI.createTerm({ id: newTerm.id, classId: c.id, number: num, name: newTerm.name }).catch(() => {});
        }
      });
    });
  }, [classes, terms]);

  // --- ÉTATS POUR LES MENUS CONTEXTUELS "3 TRAITS", ÉDITION ET SUPPRESSION SÉCURISÉE ---
  type ManagedEntityType = 'year' | 'school' | 'level' | 'class' | 'subject';

  interface ActiveMenuState {
    type: ManagedEntityType;
    id: string;
    item: any;
    position: { top: number; left: number };
  }
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);

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
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [editingLevel, setEditingLevel] = useState<StudyLevelItem | null>(null);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);

  // Fermer le menu contextuel lors d'un clic extérieur ou du défilement
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.card-dropdown-menu') && !target.closest('.card-menu-trigger')) {
        setActiveMenu(null);
      }
    };
    const handleScroll = () => {
      setActiveMenu(null);
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeMenu]);

  // Positionnement intelligent du menu 3 traits (ne se coupe jamais dans le creux, ne déborde pas)
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

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 195;
    const menuHeight = 90;

    let left = rect.right - menuWidth;
    if (left < 10) {
      left = rect.left;
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 4;
    }

    setActiveMenu({
      type,
      id: item.id,
      item,
      position: { top, left }
    });
  };

  const handleTriggerEdit = (type: ManagedEntityType, item: any) => {
    setActiveMenu(null);
    if (type === 'year') {
      const yr = item as SchoolYearItem;
      setEditingYear(yr);
      setEditYearLabel(yr.label);
      setEditYearColorObj(
        YEAR_COLOR_OPTIONS.find(c => c.bg === yr.color) ||
        YEAR_COLOR_OPTIONS[0]
      );
    } else if (type === 'school') {
      const school = item as SchoolItem;
      setEditingSchool(school);
      setSchoolName(school.name);
      setSchoolLogo(school.logoUrl || null);
      setSelectedSchoolColor(
        SCHOOL_COLOR_OPTIONS.find(c => c.bg === school.color) ||
        SCHOOL_COLOR_OPTIONS[0]
      );
      setIsAddSchoolModalOpen(true);
    } else if (type === 'level') {
      const lvl = item as StudyLevelItem;
      setEditingLevel(lvl);
      setStudyLevelName(lvl.name);
      setSelectedStudyLevelColor(
        YEAR_COLOR_OPTIONS.find(c => c.bg === lvl.color) ||
        YEAR_COLOR_OPTIONS[0]
      );
      setIsAddLevelModalOpen(true);
    } else if (type === 'class') {
      const cls = item as ClassItem;
      setEditingClass(cls);
      setClassName(cls.name?.trim() || cls.level);
      setClassSlogan(cls.slogan || '');
      setClassTeacherName(cls.teacherName);
      setSelectedClassColor(
        CLASS_COLOR_OPTIONS.find(c => c.bg === cls.color) ||
        CLASS_COLOR_OPTIONS[0]
      );
      setIsAddClassModalOpen(true);
    } else if (type === 'subject') {
      const subj = item as SubjectItem;
      setEditingSubject(subj);
      setSubjectName(subj.name);
      setSubjectCoefficient(subj.coefficient !== undefined ? String(subj.coefficient) : '');
      setSelectedSubjectColor(
        SUBJECT_COLOR_OPTIONS.find(c => c.bg === subj.color) ||
        SUBJECT_COLOR_OPTIONS[0]
      );
      setIsAddSubjectModalOpen(true);
    }
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
        warningMessage: `Tout ce qui est lié à cette année (${linkedSchools} établissement(s), ${linkedLevels} niveau(x), ${linkedClasses} classe(s), ${linkedSubjects} matière(s), ainsi que tous les trimestres, élèves, photos de profil et notes) sera définitivement supprimé de la base de données.`
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
        warningMessage: `Tout ce qui est lié à cet établissement (${linkedLevels} niveau(x), ${linkedClasses} classe(s), ${linkedSubjects} matière(s), élèves, photos et notes) sera définitivement supprimé de la base de données.`
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
        warningMessage: `Tout ce qui est lié à ce niveau (${linkedClassIds.size} classe(s), ${linkedSubjects} matière(s), trimestres, élèves, photos et notes) sera définitivement supprimé de la base de données.`
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
        warningMessage: `Tout ce qui est lié à cette classe (${linkedSubjects} matière(s), trimestres, élèves enregistrés, photos et notes) sera définitivement supprimé de la base de données.`
      });
    } else if (type === 'subject') {
      const subj = item as SubjectItem;
      setDeleteTarget({
        type: 'subject',
        id: subj.id,
        name: subj.name,
        displayName: `la matière "${subj.name}"`,
        warningMessage: "Toutes les évaluations, notes, photos d'élèves et coefficients associés à cette matière seront définitivement supprimés de la base de données."
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
        if (selectedSchoolInside?.yearId === id) setSelectedSchoolInside(null);
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
        if (selectedSchoolId === id) setSelectedSchoolId(null);
        if (selectedSchoolInside?.id === id) setSelectedSchoolInside(null);
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
        if (selectedLevelId === id) setSelectedLevelId(null);
        if (selectedClassId && deletedClassIds.has(selectedClassId)) setSelectedClassId(null);
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
        if (selectedClassId === id) setSelectedClassId(null);
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

  // État du modal "Créer / Modifier un niveau d'étude" (ex-menu de niveau CP1, Terminale, Licence...)
  const [isAddLevelModalOpen, setIsAddLevelModalOpen] = useState(false);
  const [studyLevelName, setStudyLevelName] = useState('');
  const [selectedStudyLevelColor, setSelectedStudyLevelColor] = useState(YEAR_COLOR_OPTIONS[0]);

  const resetLevelForm = () => {
    setStudyLevelName('');
    setSelectedStudyLevelColor(YEAR_COLOR_OPTIONS[0]);
    setEditingLevel(null);
  };

  const isLevelDirty = editingLevel
    ? (
        studyLevelName.trim() !== editingLevel.name ||
        selectedStudyLevelColor.bg !== (editingLevel.color || '#ffffff')
      )
    : studyLevelName.trim().length > 0;

  const handleCreateStudyLevel = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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

  const resetClassForm = () => {
    setClassName('');
    setClassSlogan('');
    setClassTeacherName(user?.name || 'Professeur');
    setSelectedClassColor(CLASS_COLOR_OPTIONS[0]);
    setEditingClass(null);
  };

  // Vérification de modification (Dirty) pour la classe
  const isClassDirty = editingClass
    ? (
        className.trim() !== (editingClass.name?.trim() || editingClass.level) ||
        classTeacherName.trim() !== editingClass.teacherName ||
        (classSlogan.trim() || '') !== (editingClass.slogan || '') ||
        selectedClassColor.bg !== editingClass.color
      )
    : (className.trim().length > 0 && classTeacherName.trim().length > 0);

  const handleCreateClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        iconGradient: selectedClassColor.iconGradient,
        createdAt: now
      };
      const defaultTerms: TermItem[] = [
        { id: generateTeacherEntityId('term1'), classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 1, name: 'Trimestre 1', createdAt: now },
        { id: generateTeacherEntityId('term2'), classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 2, name: 'Trimestre 2', createdAt: now + 1 },
        { id: generateTeacherEntityId('term3'), classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 3, name: 'Trimestre 3', createdAt: now + 2 }
      ];
      setClasses(prev => [...prev, newClass]);
      setTerms(prev => [...prev, ...defaultTerms]);
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
            iconGradient: newClass.iconGradient,
            defaultTerms: defaultTerms.map(t => ({ id: t.id, number: t.number, name: t.name })),
          }),
        'Erreur de création de la classe.'
      ).then((res) => {
        if (res?.classItem && res.classItem.id !== newClass.id) {
          setClasses(prev => prev.map(c => c.id === newClass.id ? res.classItem : c));
          setTerms(prev => [...prev.filter(t => t.classId !== newClass.id), ...res.terms]);
          setSelectedClassId(res.classItem.id);
          setSelectedTermId(res.terms[0]?.id || null);
        }
      });
    }
  };

  // État du modal "Créer / Modifier une matière"
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCoefficient, setSubjectCoefficient] = useState<string>('');
  const [selectedSubjectColor, setSelectedSubjectColor] = useState(SUBJECT_COLOR_OPTIONS[0]); // Blanc par défaut

  const resetSubjectForm = () => {
    setSubjectName('');
    setSubjectCoefficient('');
    setSelectedSubjectColor(SUBJECT_COLOR_OPTIONS[0]);
    setEditingSubject(null);
  };

  // Vérification de modification (Dirty) pour la matière
  const origSubjectCoeff = (editingSubject?.coefficient !== undefined && editingSubject?.coefficient !== null)
    ? String(editingSubject.coefficient)
    : '';
  const isSubjectDirty = editingSubject
    ? (
        subjectName.trim() !== editingSubject.name ||
        subjectCoefficient.trim() !== origSubjectCoeff ||
        selectedSubjectColor.bg !== editingSubject.color
      )
    : subjectName.trim().length > 0;

  const handleCreateSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subjectName.trim()) return;

    const coeffNum = subjectCoefficient.trim() ? parseFloat(subjectCoefficient.trim()) : undefined;
    const parsedCoeff = (coeffNum !== undefined && !isNaN(coeffNum)) ? coeffNum : undefined;

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
            coefficient: parsedCoeff,
            color: newSubject.color,
            textColor: newSubject.textColor,
            borderColor: newSubject.borderColor,
            borderDarkColor: newSubject.borderDarkColor,
          }),
        'Erreur de création de la matière.'
      ).then((res) => {
        if (res?.subject && res.subject.id !== newSubject.id) {
          setSubjects(prev => prev.map(s => s.id === newSubject.id ? res.subject : s));
        }
      });
    }
  };

  // État du modal "Ajouter une école"
  const [isAddSchoolModalOpen, setIsAddSchoolModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [selectedSchoolColor, setSelectedSchoolColor] = useState(SCHOOL_COLOR_OPTIONS[0]); // Blanc par défaut
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compression & chargement du logo de l'école (format rond max 256x256 px pour préserver le stockage)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
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
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png', 0.85);
          setSchoolLogo(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Vérification de modification (Dirty) pour l'école
  const isSchoolDirty = editingSchool
    ? (
        schoolName.trim() !== editingSchool.name ||
        (schoolLogo || null) !== (editingSchool.logoUrl || null) ||
        selectedSchoolColor.bg !== editingSchool.color
      )
    : schoolName.trim().length > 0;

  // Création ou modification d'une école (D1 + logo privé R2)
  const handleCreateSchool = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
      };
      setSchools(prev => prev.map(s => s.id === editingSchool.id ? updated : s));
      if (selectedSchoolInside?.id === editingSchool.id) {
        setSelectedSchoolInside(updated);
      }
      const targetId = editingSchool.id;
      setIsAddSchoolModalOpen(false);
      setEditingSchool(null);
      runCloudMutation(
        () =>
          TeacherGradebookAPI.updateSchool(targetId, {
            name: updated.name,
            logoDataUrl: pickedNewDataUrl,
            removeLogo: removedLogo,
            color: updated.color,
            textColor: updated.textColor,
            borderColor: updated.borderColor,
            borderDarkColor: updated.borderDarkColor,
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
      const newSchool: SchoolItem = {
        id: generateTeacherEntityId('school'),
        yearId: selectedYearId,
        name: cleanName,
        logoUrl: schoolLogo || undefined,
        color: selectedSchoolColor.bg,
        textColor: selectedSchoolColor.text,
        borderColor: selectedSchoolColor.border,
        borderDarkColor: selectedSchoolColor.borderDark,
        createdAt: Date.now(),
      };

      setSchools(prev => [...prev, newSchool]);
      setSelectedSchoolId(newSchool.id);
      setIsAddSchoolModalOpen(false);
      runCloudMutation(
        () =>
          TeacherGradebookAPI.createSchool({
            id: newSchool.id,
            yearId: newSchool.yearId,
            name: newSchool.name,
            logoDataUrl: pickedDataUrl,
            color: newSchool.color,
            textColor: newSchool.textColor,
            borderColor: newSchool.borderColor,
            borderDarkColor: newSchool.borderDarkColor,
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
    setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
  };

  // État du menu déroulant "Créer une rentrée scolaire"
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [inputYearValue, setInputYearValue] = useState(`${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`);
  const [selectedColorObj, setSelectedColorObj] = useState(YEAR_COLOR_OPTIONS[0]); // Par défaut blanc / aucune couleur
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le menu déroulant lors d'un clic en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    if (isCreateMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isCreateMenuOpen]);

  // Gestion de la saisie manuelle : Uniquement chiffres et tiret/espace, max 12 caractères
  const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Seulement les chiffres, espaces et tirets sont autorisés, max 12 caractères
    const filtered = raw.replace(/[^0-9\s-]/g, '').slice(0, 12);
    setInputYearValue(filtered);
  };

  // Création / Application de l'année scolaire (D1)
  const handleApplyYear = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        editYearColorObj.bg !== editingYear.color
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

  // Confirmation de l'ajout d'un nouveau trimestre pour la classe active (D1)
  const handleConfirmAddTerm = () => {
    if (!activeClass || !selectedSchoolInside) return;
    const newTerm: TermItem = {
      id: generateTeacherEntityId('term'),
      classId: activeClass.id,
      schoolId: selectedSchoolInside.id,
      yearId: selectedSchoolInside.yearId,
      number: nextTermNumber,
      name: `Trimestre ${nextTermNumber}`,
      createdAt: Date.now()
    };
    setTerms(prev => [...prev, newTerm]);
    setSelectedTermId(newTerm.id);
    setIsAddTermModalOpen(false);
    runCloudMutation(
      () =>
        TeacherGradebookAPI.createTerm({
          id: newTerm.id,
          classId: newTerm.classId,
          number: newTerm.number,
          name: newTerm.name,
        }),
      'Erreur de création du trimestre.'
    ).then((res) => {
      if (res?.term && res.term.id !== newTerm.id) {
        setTerms(prev => prev.map(t => t.id === newTerm.id ? res.term : t));
        setSelectedTermId(res.term.id);
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
    setIsTransferViewOpen(false);
  }, [selectedSchoolInside]);

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
        onBack={() => {
          setSelectedSubjectInside(null);
          refreshCloudStats();
        }}
      />
    );
  }

  return (
    <div 
      className={`w-full flex flex-col md:flex-row overflow-hidden font-sans select-none transition-all duration-300 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : 'relative w-full h-full min-h-dvh'
      }`}
      style={{
        backgroundColor: '#091226'
      }}
    >
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
      {/* 2. ESPACE PRINCIPAL DE TRAVAIL AVEC VIDÉO ANIMÉE CONTINUE PLEIN ÉCRAN     */}
      {/* ========================================================================= */}
      <main className="relative flex-1 flex flex-col h-full min-h-dvh overflow-hidden bg-[#091226]">
        {/* Vidéo animée continue plein écran en fond (toujours présente, nette et rapide) */}
        <video
          ref={bgVideoRef}
          src="/assets/teacher-bg-animation.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          onLoadedMetadata={ensureBackgroundVideoPlaying}
          onCanPlay={ensureBackgroundVideoPlaying}
          onPlay={ensureBackgroundVideoPlaying}
          className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none select-none z-0"
          style={{ filter: 'brightness(1.14) contrast(1.06) saturate(1.12)' }}
        />

        {/* Voile ultra-léger uniquement sur les bords haut/bas pour garder la scène centrale 100 % nette */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-[1] bg-gradient-to-b from-[#070f20]/45 via-transparent to-[#070f20]/30"
        />

        {/* Contenu défilable au-dessus de l'animation continue */}
        <div className="relative z-10 flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden px-3.5 sm:px-6 lg:px-8 pt-1.5 sm:pt-2 pb-24 md:pb-8 space-y-1.5">
        
        {/* ----------------------------------------------------------------------- */}
        {/* EN-TÊTE COMPACT EN HAUT :                                               */}
        {/* Retour (gauche) | Titre bien centré (milieu) | Utilitaires & Agrandissement (droite) */}
        {/* ----------------------------------------------------------------------- */}
        <header className="relative flex items-center justify-between gap-2 flex-wrap">
          {/* Groupe haut gauche : Bouton Retour + Bouton manuel Enregistrer + Statut d'enregistrement automatique */}
          <div className="flex items-center gap-2 flex-wrap z-10 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (isTransferViewOpen) {
                  setIsTransferViewOpen(false);
                } else if (selectedSchoolInside) {
                  setSelectedSchoolInside(null);
                } else {
                  setIsViewerMaximized(false);
                  resetViewerExpand();
                  onBack();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/85 hover:bg-white text-slate-700 hover:text-[#00313d] border border-white/95 shadow-xs transition active:scale-95 font-bold text-xs cursor-pointer shrink-0"
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

            {/* Bouton Enregistrer manuel (zone entourée en vert) */}
            <button
              type="button"
              onClick={() => handleManualSave()}
              disabled={saveUiState === 'saving'}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold border shadow-xs transition active:scale-95 shrink-0 cursor-pointer ${
                saveUiState === 'offline' || saveUiState === 'error'
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  : saveUiState === 'saving'
                  ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-wait'
                  : 'bg-white/90 hover:bg-white text-[#00313d] border-white/95'
              }`}
              title="Enregistrer manuellement et vérifier la synchronisation avec la base de données"
            >
              {saveUiState === 'saving' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
              ) : (
                <Save className="w-3.5 h-3.5 stroke-[2.2]" />
              )}
              <span>Enregistrer</span>
            </button>

            {/* Statut d'enregistrement automatique en direct juste à côté du bouton manuel */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all select-none ${
                saveUiState === 'saving'
                  ? 'bg-amber-50/90 text-amber-800 border-amber-200/80'
                  : saveUiState === 'saved'
                  ? 'bg-emerald-50/95 text-emerald-700 border-emerald-200/90'
                  : saveUiState === 'offline' || !isOnline
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : saveUiState === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-white/90 text-slate-700 border-white shadow-xs'
              }`}
              title={saveFeedbackMessage || 'Synchronisation automatique avec la base de données Cloudflare D1'}
            >
              {saveUiState === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700 shrink-0" />
                  <span>Enregistrement en cours...</span>
                </>
              ) : saveUiState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>Enregistré avec succès</span>
                </>
              ) : saveUiState === 'offline' || !isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Hors ligne — Échec</span>
                </>
              ) : saveUiState === 'error' ? (
                <>
                  <CloudOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span>Échec de l&apos;enregistrement</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
                  <span>Base connectée</span>
                </>
              )}
            </div>
          </div>

          {/* Titre principal bien centré en haut (Tableau de bord OU Nom de l'école active) */}
          <div className="flex items-center justify-center min-w-0 xl:absolute xl:left-1/2 xl:-translate-x-1/2 flex-1 xl:flex-initial">
            {selectedSchoolInside ? (
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full overflow-hidden border-2 border-white shadow-md shrink-0 flex items-center justify-center bg-white/90">
                  {selectedSchoolInside.logoUrl ? (
                    <img src={selectedSchoolInside.logoUrl} alt={selectedSchoolInside.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-black text-[11px] text-[#00313d]">
                      {selectedSchoolInside.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight leading-none truncate drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                  {selectedSchoolInside.name}
                </h1>
                <span className="text-[10px] font-extrabold text-cyan-100 bg-cyan-950/65 backdrop-blur-sm px-2 py-0.5 rounded-lg border border-cyan-300/40 hidden sm:inline-block shrink-0">
                  {currentSelectedYear?.label}
                </span>
              </div>
            ) : (
              <h1 className="text-lg sm:text-xl lg:text-2xl font-black text-white tracking-tight leading-none text-center truncate drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
                Tableau de bord
              </h1>
            )}
          </div>

          {/* Zone haute droite : Utilitaires + Profil puis Agrandissement dans le creux tout à droite */}
          <div className="flex items-center gap-2 ml-auto flex-wrap justify-end z-10">
            {/* Groupe utilitaires + profil enseignant (bouton recherche déplacé dans chaque section) */}
            <div className="flex items-center gap-1.5 bg-white/55 backdrop-blur-md px-1.5 py-1 rounded-2xl border border-white/80 shadow-2xs">
              {/* Notification Bell */}
              <button
                type="button"
                className="relative w-7 h-7 rounded-xl bg-white/90 hover:bg-white text-slate-600 hover:text-[#00313d] flex items-center justify-center shadow-2xs border border-white transition cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500 ring-2 ring-white"></span>
              </button>

              {/* Settings Gear */}
              <button
                type="button"
                className="w-7 h-7 rounded-xl bg-white/90 hover:bg-white text-slate-600 hover:text-[#00313d] flex items-center justify-center shadow-2xs border border-white transition cursor-pointer"
                title="Paramètres"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>

              {/* Séparateur discret */}
              <div className="w-px h-5 bg-slate-300/60 mx-0.5 hidden sm:block" />

              {/* Profil Enseignant */}
              <div className="flex items-center gap-1.5 pl-0.5 pr-2.5 py-0.5 bg-white/90 rounded-xl shadow-2xs border border-white">
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-400 text-white font-bold text-[10px] flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    (user?.name ? user.name.charAt(0).toUpperCase() : 'DKD')
                  )}
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[11px] font-bold text-slate-800 leading-none">
                    {user?.name || 'Professeur'}
                  </span>
                  <span className="text-[8.5px] text-slate-400 font-medium leading-tight">
                    Enseignant Pro
                  </span>
                </div>
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
          <section className="space-y-1 animate-fade-in">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-white/95 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
                  Rentrées scolaires enregistrées :
                </span>
                <span className="text-[11px] font-black text-cyan-200 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
                  ({schoolYears.length})
                </span>
              </div>

              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-1.5 rounded-xl text-xs font-black text-white shadow-md transition-all active:scale-95 shrink-0 cursor-pointer"
                  style={{ backgroundColor: '#00313d' }}
                  title="Créer une rentrée scolaire"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span className="tracking-wide text-[11px] sm:text-xs">
                    Créer une rentrée scolaire
                  </span>
                </button>

                {/* Petit menu déroulant bien rectangle qui descend vers le bas */}
                {isCreateMenuOpen && (
                  <div 
                    className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl border border-white/90 z-50 text-slate-800 space-y-3 animate-fade-in"
                    style={{
                      boxShadow: '0 20px 40px -10px rgba(0, 49, 61, 0.25)'
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-[#00313d] flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-cyan-600" />
                        <span>Nouvelle rentrée scolaire</span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setIsCreateMenuOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

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
                          className="px-3.5 py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          style={{ backgroundColor: '#00313d' }}
                        >
                          Créer
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-400 block">
                        {inputYearValue.length}/12 caractères &bull; Chiffres autorisés
                      </span>
                    </form>

                    {/* 2. Palette de couleurs à appliquer */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Couleur du bouton de l'année
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
                              className={`w-full h-7 rounded-lg border flex items-center justify-center transition-all ${
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

                    {/* 3. Propositions d'années qui commencent cette année (2026 - 2027...) */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Propositions rapides
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_YEARS.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setInputYearValue(sug)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                              inputYearValue === sug
                                ? 'bg-cyan-500 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bouton Appliquer bas du menu */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleApplyYear()}
                        className="w-full py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95"
                        style={{ backgroundColor: '#00313d' }}
                      >
                        Appliquer cette rentrée scolaire
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ligne des boutons d'années successifs avec sélection lumineuse (jamais noire) */}
            <div className="flex items-center gap-2.5 flex-wrap py-1">
              {schoolYears.map((year) => {
                const isSelected = selectedYearId === year.id;
                const isWhite = !year.color || year.color === '#ffffff' || year.color === 'white';
                const glowTheme = getLuminousLevelTheme(year.color);

                return (
                  <div
                    key={year.id}
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
                            backgroundColor: isWhite ? '#ffffff' : year.color,
                            color: year.textColor || (isWhite ? '#0f172a' : '#ffffff'),
                            borderColor: isWhite ? '#cbd5e1' : year.color,
                          }
                    }
                    className={`group relative overflow-hidden flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-extrabold tracking-wide cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'border-2 scale-[1.03]'
                        : 'border shadow-xs hover:scale-102 hover:shadow'
                    }`}
                    title={`Sélectionner l'année scolaire ${year.label}`}
                  >
                    {isSelected && (
                      <div
                        className="absolute inset-0 pointer-events-none opacity-45 blur-md"
                        style={{ background: glowTheme.aura }}
                      />
                    )}
                    <Calendar className="relative z-10 w-3.5 h-3.5 opacity-85" />
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
                          : isWhite
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

        {/* Bannière d'alerte Hors-ligne / Échec de synchronisation Cloudflare D1 */}
        {(saveUiState === 'offline' || saveUiState === 'error' || cloudStatus === 'error') && (
          <div className="mb-2.5 px-3.5 py-2.5 rounded-xl bg-red-50 border border-red-200 flex items-center justify-between gap-2 text-xs text-red-800 shadow-2xs">
            <div className="flex items-center gap-2 min-w-0">
              {saveUiState === 'offline' || !isOnline ? (
                <WifiOff className="w-4 h-4 shrink-0 text-red-600" />
              ) : (
                <CloudOff className="w-4 h-4 shrink-0 text-red-600" />
              )}
              <span className="font-semibold">
                {saveFeedbackMessage || cloudError || 'Hors ligne — Échec de la connexion à la base de données.'}
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

        {cloudStatus === 'loading' && schoolYears.length === 0 && (
          <div className="mb-2.5 px-3 py-2 rounded-xl bg-white/80 border border-slate-200 flex items-center gap-2 text-xs text-slate-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-500" />
            <span className="font-medium">Chargement sécurisé de votre espace depuis Cloudflare D1...</span>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ESPACE DE TRAVAIL PRINCIPAL (ÉCOLES OU CLASSES SELON LA NAVIGATION)    */}
        {/* ----------------------------------------------------------------------- */}
        <section className="flex-1 flex flex-col justify-start">
          {selectedSchoolInside ? (
            // =====================================================================
            // CAS 1 : ON EST "À L'INTÉRIEUR" D'UNE ÉCOLE
            // =====================================================================
            isTransferViewOpen ? (
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
                    'Erreur lors du transfert sur Cloudflare D1.'
                  );
                  if (res?.gradebookStats) {
                    setServerGradebookStats(res.gradebookStats);
                  }
                  return res?.serverSummary;
                }}
                onClose={() => setIsTransferViewOpen(false)}
              />
            ) : currentSchoolLevels.length === 0 ? (
              // AUCUN NIVEAU D'ÉTUDE : L'utilisateur commence d'abord par créer un niveau d'étude (CP1, Terminale, Licence...)
              <div className="flex-1 flex flex-col">
                <div className="flex items-center justify-end mb-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetLevelForm();
                      setIsAddLevelModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black text-white shadow-md transition-all active:scale-95 shrink-0 hover:bg-[#00252e] cursor-pointer"
                    style={{ backgroundColor: '#00313d' }}
                    title="Créer un niveau d'étude"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" />
                    <span className="tracking-wide text-[11px] sm:text-xs">
                      Créer un niveau
                    </span>
                  </button>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      resetLevelForm();
                      setIsAddLevelModalOpen(true);
                    }}
                    className="group relative w-60 h-56 sm:w-64 sm:h-60 border-2 border-dashed border-cyan-300/70 hover:border-cyan-200 bg-[#081329]/45 hover:bg-[#081329]/65 backdrop-blur-[4px] rounded-3xl flex flex-col items-center justify-center p-5 text-center cursor-pointer transition-all duration-300 shadow-[0_12px_36px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_42px_rgba(6,182,212,0.28)] hover:-translate-y-1 active:translate-y-0"
                    title="Créer un niveau d'étude"
                  >
                    <div className="w-14 h-14 rounded-2xl bg-cyan-500/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-cyan-400 transition-all duration-300 mb-3 border border-cyan-200/50">
                      <Plus className="w-7 h-7 stroke-[3]" />
                    </div>
                    <span className="text-base font-black text-white drop-shadow-sm transition-colors">
                      Créer un niveau d'étude
                    </span>
                    <p className="text-xs text-slate-200/95 max-w-[225px] mt-1.5 leading-relaxed">
                      Commencez par créer un niveau (CP1, 6ème, 2nde, Terminale, Licence...) dans <span className="font-bold text-cyan-200">{selectedSchoolInside.name}</span>
                    </p>
                    <div className="mt-3 px-3 py-1 rounded-full bg-cyan-400/20 border border-cyan-300/50 text-[10px] font-extrabold text-cyan-100">
                      Nouveau niveau +
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              // NIVEAUX D'ÉTUDE CRÉÉS : Barre mince rectangulaire des niveaux + Classes 3D compactes + Trimestres + Matières compactes
              <div className="space-y-3 animate-fade-in">
                
                {/* ------------------------------------------------------------- */}
                {/* ZONE NIVEAUX D'ÉTUDE + CLASSES : STICKY TOP AU DÉFILEMENT     */}
                {/* ------------------------------------------------------------- */}
                <div className="sticky top-0 z-20 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-1 pb-2 backdrop-blur-md bg-[#081226]/55 border-b border-white/15 space-y-2">
                  
                  {/* 1. BANDEAU DES NIVEAUX D'ÉTUDE (Boutons minces rectangulaires plats NON 3D, bouton + devant, Créer un niveau + flèches < > à droite) */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow-sm shrink-0">
                          Niveaux d'étude ({currentSchoolLevels.length})
                        </span>
                        <span className="text-xs text-cyan-200/70 font-bold">&bull;</span>
                        <span className="text-[11px] font-bold text-cyan-900 bg-white/95 px-2 py-0.5 rounded-md border border-cyan-200/60 shadow-2xs truncate">
                          {selectedSchoolInside.name}
                        </span>
                        <span className="text-[10px] text-slate-200/85 hidden lg:inline-block font-medium truncate">
                          (Sélectionnez un niveau pour afficher et créer ses classes)
                        </span>
                        <InlineSectionSearch
                          isOpen={isLevelSearchOpen}
                          query={levelSearchQuery}
                          placeholder="Chercher un niveau..."
                          onToggle={() => {
                            if (isLevelSearchOpen) {
                              setIsLevelSearchOpen(false);
                              setLevelSearchQuery('');
                            } else {
                              setIsLevelSearchOpen(true);
                            }
                          }}
                          onChange={setLevelSearchQuery}
                          onClose={() => {
                            setIsLevelSearchOpen(false);
                            setLevelSearchQuery('');
                          }}
                        />
                      </div>

                      {/* Bouton sobre Transférer (à gauche de Créer un niveau) + Bouton Créer un niveau + Flèches < > */}
                      <div className="flex items-center gap-2 shrink-0 ml-auto">
                        <button
                          type="button"
                          onClick={() => setIsTransferViewOpen(true)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 shadow-2xs transition active:scale-95 shrink-0 cursor-pointer"
                          title="Transférer ou dupliquer des niveaux, classes, trimestres, matières ou listes d'élèves"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.2] text-slate-600" />
                          <span className="tracking-wide">Transférer</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            resetLevelForm();
                            setIsAddLevelModalOpen(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black text-white shadow-sm transition-all active:scale-95 shrink-0 hover:bg-[#00252e] cursor-pointer"
                          style={{ backgroundColor: '#00313d' }}
                          title="Créer un niveau d'étude"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                          <span className="tracking-wide">Créer un niveau</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => scrollLevels('left')}
                            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-700 hover:text-[#00313d] border border-slate-200 shadow-2xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                            title="Défiler les niveaux vers la gauche"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => scrollLevels('right')}
                            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-700 hover:text-[#00313d] border border-slate-200 shadow-2xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                            title="Défiler les niveaux vers la droite"
                          >
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Ligne des boutons minces rectangulaires : bouton (+) devant + niveaux successifs défilables */}
                    <div className="flex items-center gap-1.5">
                      {/* Bouton Plus (+) devant pour ajouter d'autres niveaux d'étude */}
                      <button
                        type="button"
                        onClick={() => {
                          resetLevelForm();
                          setIsAddLevelModalOpen(true);
                        }}
                        className="h-8 px-2.5 rounded-lg border border-dashed border-cyan-800/50 hover:border-cyan-500 bg-white/85 hover:bg-cyan-50 text-[#00313d] hover:text-cyan-800 flex items-center gap-1 text-[11px] font-black transition-colors shrink-0 cursor-pointer"
                        title="Ajouter un nouveau niveau d'étude (CP1, 6ème, 2nde, Terminale, Licence...)"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        <span className="hidden sm:inline">Niveau</span>
                      </button>

                      {/* Liste horizontale des niveaux en boutons minces rectangulaires plats avec halo lumineux éclatant à la sélection */}
                      <div
                        ref={levelsScrollRef}
                        className="flex items-center gap-2 overflow-x-auto flex-nowrap scrollbar-none scroll-smooth py-2 px-1.5 -my-1 flex-1 min-w-0"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                      >
                        {filteredSchoolLevels.length === 0 && levelSearchQuery.trim() ? (
                          <div className="h-8 px-3 rounded-lg border border-slate-200/80 bg-white/75 text-slate-500 text-xs font-bold flex items-center gap-1.5 shrink-0 select-none">
                            <span>Non trouvé</span>
                          </div>
                        ) : (
                        filteredSchoolLevels.map((lvl) => {
                          const isSelected = activeLevel?.id === lvl.id;
                          const levelClassesCount = classes.filter(
                            c => c.schoolId === selectedSchoolInside.id && c.levelId === lvl.id
                          ).length;
                          const hasCustomColor = Boolean(lvl.color && lvl.color !== '#ffffff' && lvl.color !== 'white');
                          const glowTheme = getLuminousLevelTheme(lvl.color);

                          return (
                            <div
                              key={lvl.id}
                              onClick={() => setSelectedLevelId(lvl.id)}
                              style={
                                isSelected
                                  ? {
                                      background: glowTheme.bg,
                                      color: glowTheme.text,
                                      borderColor: glowTheme.border,
                                      boxShadow: glowTheme.shadow,
                                    }
                                  : {
                                      backgroundColor: '#ffffff',
                                      color: '#1e293b',
                                      borderColor: '#cbd5e1',
                                    }
                              }
                              className={`group relative overflow-hidden h-8 px-3 rounded-lg text-xs font-extrabold flex items-center gap-1.5 shrink-0 cursor-pointer transition-all duration-200 select-none ${
                                isSelected
                                  ? 'border-2 scale-[1.03]'
                                  : 'border hover:border-cyan-400 hover:bg-cyan-50/40'
                              }`}
                              title={`Niveau ${lvl.name} (${levelClassesCount} classe${levelClassesCount > 1 ? 's' : ''})`}
                            >
                              {/* Halo lumineux d'ambiance à l'intérieur quand sélectionné */}
                              {isSelected && (
                                <div
                                  className="absolute inset-0 pointer-events-none opacity-45 blur-md"
                                  style={{ background: glowTheme.aura }}
                                />
                              )}
                              <span
                                className="relative z-10 w-2 h-2 rounded-full shrink-0 transition-transform"
                                style={{
                                  backgroundColor: isSelected
                                    ? glowTheme.dot
                                    : (hasCustomColor ? lvl.color : '#0891b2'),
                                  boxShadow: isSelected ? glowTheme.dotShadow : undefined,
                                }}
                              />
                              <span className="relative z-10 tracking-tight whitespace-nowrap text-[11.5px] font-black">
                                {lvl.name}
                              </span>
                              <span
                                className="relative z-10 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border"
                                style={
                                  isSelected
                                    ? {
                                        backgroundColor: glowTheme.badgeBg,
                                        color: glowTheme.badgeText,
                                        borderColor: glowTheme.badgeBorder,
                                      }
                                    : {
                                        backgroundColor: '#f1f5f9',
                                        color: '#64748b',
                                        borderColor: '#e2e8f0',
                                      }
                                }
                              >
                                {levelClassesCount} cl.
                              </span>
                              <button
                                type="button"
                                onClick={(e) => handleOpenMenu(e, 'level', lvl)}
                                className={`relative z-10 card-menu-trigger w-4 h-4 rounded flex items-center justify-center transition shrink-0 ${
                                  isSelected
                                    ? 'opacity-75 hover:opacity-100 hover:bg-black/10'
                                    : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                                }`}
                                title={`Options du niveau ${lvl.name}`}
                              >
                                <div className="w-2.5 h-2 flex flex-col justify-between items-center pointer-events-none">
                                  <span className="w-full h-[1.4px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.4px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.4px] bg-current rounded-full"></span>
                                </div>
                              </button>
                            </div>
                          );
                        })
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. BANDEAU DES CLASSES DU NIVEAU ACTIF (Cartes 3D de taille réduite + halo lumineux à la sélection) */}
                  {activeLevel && (
                    <div className="pt-1 border-t border-white/15">
                      <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow-sm shrink-0">
                            Classes ({currentLevelClasses.length})
                          </span>
                          <span className="text-xs text-cyan-200/70 font-bold">&bull;</span>
                          <span
                            className="text-[11px] font-black px-2 py-0.5 rounded-md border shrink-0"
                            style={{
                              background: getLuminousLevelTheme(activeLevel.color).bg,
                              color: getLuminousLevelTheme(activeLevel.color).text,
                              borderColor: getLuminousLevelTheme(activeLevel.color).border,
                              boxShadow: '0 0 10px rgba(6, 182, 212, 0.35)',
                            }}
                          >
                            {activeLevel.name}
                          </span>
                          <span className="text-[10px] text-slate-200/85 hidden sm:inline-block font-medium truncate">
                            (Sélectionnez une classe pour afficher et créer ses matières)
                          </span>
                          <InlineSectionSearch
                            isOpen={isClassSearchOpen}
                            query={classSearchQuery}
                            placeholder="Chercher une classe..."
                            onToggle={() => {
                              if (isClassSearchOpen) {
                                setIsClassSearchOpen(false);
                                setClassSearchQuery('');
                              } else {
                                setIsClassSearchOpen(true);
                              }
                            }}
                            onChange={setClassSearchQuery}
                            onClose={() => {
                              setIsClassSearchOpen(false);
                              setClassSearchQuery('');
                            }}
                          />
                        </div>

                        {/* Flèches de défilement horizontal gauche et droite */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => scrollClasses('left')}
                            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-2xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                            title="Défiler les classes vers la gauche"
                          >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => scrollClasses('right')}
                            className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-2xs flex items-center justify-center transition active:scale-95 cursor-pointer"
                            title="Défiler les classes vers la droite"
                          >
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>

                      {currentLevelClasses.length === 0 ? (
                        <div className="py-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              resetClassForm();
                              setIsAddClassModalOpen(true);
                            }}
                            className="w-full sm:w-auto px-5 py-3 border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-white/90 hover:bg-white rounded-xl flex items-center justify-center sm:justify-start gap-3 transition-all cursor-pointer group shadow-md"
                            title={`Créer la première classe dans ${activeLevel.name}`}
                          >
                            <div className="w-8 h-8 rounded-lg bg-[#00313d] text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition shrink-0">
                              <Plus className="w-4 h-4 stroke-[3]" />
                            </div>
                            <div className="text-left">
                              <span className="text-xs font-black text-slate-800 group-hover:text-[#00313d] block leading-tight">
                                + Créer une classe dans {activeLevel.name}
                              </span>
                              <span className="text-[10px] text-slate-500 block mt-0.5">
                                Donnez le nom de votre classe (ex : {activeLevel.name} A, {activeLevel.name} C1, Groupe 1...)
                              </span>
                            </div>
                          </button>
                        </div>
                      ) : (
                        /* Bouton "+ Classe" fixe devant + Rangée horizontale défilable de cartes 3D compactes */
                        <div className="flex items-stretch gap-2.5">
                          {/* Bouton fixe devant pour ajouter une classe (ne se déplace jamais) */}
                          <div className="pt-3.5 pb-2.5 flex items-stretch shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                resetClassForm();
                                setIsAddClassModalOpen(true);
                              }}
                              className="w-28 sm:w-32 shrink-0 border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-white/90 hover:bg-white backdrop-blur-md rounded-xl px-2.5 py-2 flex flex-col items-center justify-center gap-1 text-center cursor-pointer transition-all duration-200 group hover:-translate-y-0.5 shadow-sm"
                              title={`Ajouter une classe dans ${activeLevel.name}`}
                            >
                              <div className="w-6 h-6 rounded-md bg-[#00313d] text-white flex items-center justify-center group-hover:scale-105 shadow-2xs transition shrink-0">
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                              </div>
                              <span className="text-[11px] font-black text-slate-700 group-hover:text-[#00313d] transition-colors leading-tight">
                                + Classe
                              </span>
                            </button>
                          </div>

                          <div 
                            ref={classesScrollRef}
                            className="flex items-stretch gap-3 overflow-x-auto pt-3.5 pb-2.5 px-2 scrollbar-none scroll-smooth flex-nowrap flex-1 min-w-0"
                            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                            {filteredLevelClasses.length === 0 && classSearchQuery.trim() ? (
                              <div className="px-4 py-2 rounded-xl border border-slate-200/80 bg-white/75 text-slate-500 text-xs font-bold flex items-center justify-center shrink-0 select-none">
                                Non trouvé
                              </div>
                            ) : (
                            filteredLevelClasses.map((cls) => {
                              const isSelected = activeClass?.id === cls.id;
                              const classSubjCount = subjects.filter(s => s.classId === cls.id).length;
                              const displayClassName = getClassDisplayName(cls);

                              return (
                                <div
                                  key={cls.id}
                                  onClick={() => setSelectedClassId(cls.id)}
                                  style={
                                    isSelected
                                      ? {
                                          background: 'linear-gradient(180deg, #ffffff 0%, #ecfeff 100%)',
                                          borderColor: '#06b6d4',
                                          borderBottomColor: '#0284c7',
                                          boxShadow: '0 0 0 2.5px rgba(34, 211, 238, 0.7), 0 0 22px 4px rgba(6, 182, 212, 0.65), 0 0 38px 0px rgba(56, 189, 248, 0.5), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
                                        }
                                      : {
                                          backgroundColor: '#ffffff',
                                          borderColor: cls.borderColor || '#ea580c',
                                          borderBottomColor: cls.borderDarkColor || '#9a3412',
                                        }
                                  }
                                  className={`group relative w-44 sm:w-48 shrink-0 rounded-xl border-2 border-b-[4px] px-2.5 py-2 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none ${
                                    isSelected
                                      ? 'scale-[1.02]'
                                      : 'shadow-xs hover:shadow-md hover:-translate-y-0.5'
                                  } active:translate-y-0.5 active:border-b-2`}
                                >
                                  {/* Badge lumineux "Classe active" (jamais noir) */}
                                  {isSelected && (
                                    <div
                                      className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 text-white text-[8px] font-black tracking-wider uppercase border border-white whitespace-nowrap z-20"
                                      style={{ boxShadow: '0 0 14px 2px rgba(6, 182, 212, 0.85)' }}
                                    >
                                      ★ Classe active
                                    </div>
                                  )}

                                  {/* Ligne Supérieure : Petite icône + Nom de la classe + Menu */}
                                  <div className="flex items-start justify-between gap-1.5">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      <div 
                                        className="w-6 h-6 rounded-md flex items-center justify-center shadow-2xs shrink-0"
                                        style={{ background: cls.iconGradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
                                      >
                                        <BookOpen className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                                      </div>

                                      <div className="min-w-0 flex-1">
                                        <span className="text-[8.5px] font-bold uppercase tracking-wide text-slate-400 block truncate leading-none">
                                          {cls.slogan || activeLevel.name}
                                        </span>
                                        <h4 className="text-xs font-black text-slate-900 tracking-tight leading-snug truncate mt-0.5" title={displayClassName}>
                                          {displayClassName}
                                        </h4>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-0.5 shrink-0">
                                      <span 
                                        className="w-2 h-2 rounded-full ring-1 ring-white shadow-2xs"
                                        style={{ backgroundColor: cls.color || '#ea580c' }}
                                      />
                                      <button
                                        type="button"
                                        onClick={(e) => handleOpenMenu(e, 'class', cls)}
                                        className="card-menu-trigger w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition z-10"
                                        title="Options de la classe"
                                      >
                                        <div className="w-3 h-2 flex flex-col justify-between items-center pointer-events-none">
                                          <span className="w-full h-[1.5px] bg-current rounded-full"></span>
                                          <span className="w-full h-[1.5px] bg-current rounded-full"></span>
                                          <span className="w-full h-[1.5px] bg-current rounded-full"></span>
                                        </div>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Ligne Inférieure compacte : Professeur & Matières */}
                                  <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between gap-1.5">
                                    <span className="text-[9.5px] font-bold text-slate-600 truncate" title={`Professeur : ${cls.teacherName}`}>
                                      {cls.teacherName}
                                    </span>
                                    <span className="text-[8.5px] font-black text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200/50 shrink-0">
                                      {classSubjCount} mat.
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ------------------------------------------------------------- */}
                {/* ZONE DES TRIMESTRES : HORIZONTALE AVEC HALO LUMINEUX          */}
                {/* ------------------------------------------------------------- */}
                {activeClass && (
                  <div className="space-y-1 animate-fade-in">
                    {/* En-tête de la section trimestres avec flèches */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
                          Trimestres ({currentClassTerms.length})
                        </span>
                        <span className="text-xs text-cyan-200/75 font-bold">&bull;</span>
                        <span className="text-[11px] font-bold text-cyan-900 bg-white/95 px-2 py-0.5 rounded-md border border-cyan-300/80 shadow-2xs">
                          {getClassFullLabel(activeClass)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => scrollTerms('left')}
                          className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-700 hover:text-[#00313d] border border-slate-200/80 shadow-2xs flex items-center justify-center transition active:scale-90 cursor-pointer"
                          title="Défiler les trimestres à gauche"
                        >
                          <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollTerms('right')}
                          className="w-6 h-6 rounded-md bg-white/90 hover:bg-white text-slate-700 hover:text-[#00313d] border border-slate-200/80 shadow-2xs flex items-center justify-center transition active:scale-90 cursor-pointer"
                          title="Défiler les trimestres à droite"
                        >
                          <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Rangée horizontale des trimestres avec sélection lumineuse émeraude (jamais noire) */}
                    <div 
                      ref={termsScrollRef}
                      className="flex items-center gap-2.5 overflow-x-auto py-2 px-1.5 -mx-1.5 scrollbar-none scroll-smooth select-none"
                    >
                      {currentClassTerms.map((term) => {
                        const isSelected = activeTerm?.id === term.id;
                        const termSubjCount = subjects.filter(s => {
                          if (s.classId !== activeClass.id) return false;
                          const effectiveTermId = s.termId || currentClassTerms[0]?.id;
                          return effectiveTermId === term.id;
                        }).length;

                        return (
                          <button
                            key={term.id}
                            type="button"
                            onClick={() => setSelectedTermId(term.id)}
                            style={
                              isSelected
                                ? {
                                    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 55%, #ccfbf1 100%)',
                                    borderColor: '#10b981',
                                    borderBottomColor: '#059669',
                                    boxShadow: '0 0 0 2px rgba(52, 211, 153, 0.65), 0 0 20px 4px rgba(16, 185, 129, 0.62), 0 0 34px 0px rgba(52, 211, 153, 0.48), inset 0 1px 2px rgba(255, 255, 255, 0.95)',
                                  }
                                : undefined
                            }
                            className={`group relative overflow-hidden shrink-0 px-3 py-1.5 rounded-lg border-2 transition-all duration-200 flex items-center gap-2 cursor-pointer ${
                              isSelected
                                ? 'text-emerald-950 border-b-[3px] scale-[1.03]'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-emerald-300 border-b-[2px] shadow-2xs hover:-translate-y-0.5'
                            } active:translate-y-0.5`}
                          >
                            {isSelected && (
                              <div
                                className="absolute inset-0 pointer-events-none opacity-45 blur-md"
                                style={{ background: 'radial-gradient(circle, rgba(52, 211, 153, 0.72) 0%, transparent 72%)' }}
                              />
                            )}
                            <div
                              className={`relative z-10 w-2 h-2 rounded-full transition-all ${
                                isSelected ? 'bg-emerald-400' : 'bg-slate-300 group-hover:bg-emerald-400'
                              }`}
                              style={isSelected ? { boxShadow: '0 0 10px 2px rgba(16, 185, 129, 0.95)' } : undefined}
                            />
                            <span className="relative z-10 text-xs font-black tracking-tight">
                              {term.name}
                            </span>
                            <span
                              className={`relative z-10 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border ${
                                isSelected
                                  ? 'bg-emerald-500/15 text-emerald-800 border-emerald-400/80'
                                  : 'bg-slate-100 text-slate-500 border-slate-200'
                              }`}
                            >
                              {termSubjCount} mat.
                            </span>
                          </button>
                        );
                      })}

                      {/* Bouton Plus derrière le dernier trimestre pour ajouter un nouveau trimestre */}
                      <button
                        type="button"
                        onClick={() => setIsAddTermModalOpen(true)}
                        className="shrink-0 px-3 py-1.5 rounded-lg border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-white/90 hover:bg-white text-slate-800 hover:text-[#00313d] flex items-center gap-1.5 transition-all duration-200 shadow-sm group hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        title={`Ajouter le Trimestre ${nextTermNumber}`}
                      >
                        <div className="w-4 h-4 rounded bg-[#00313d] text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </div>
                        <span className="text-[11px] font-black">
                          + Trimestre {nextTermNumber}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------------------- */}
                {/* ZONE DES MATIÈRES : CARTES COMPACTES (3 LIGNES x 6 COLONNES = 18/ESPACE) */}
                {/* ------------------------------------------------------------------------- */}
                {activeClass && (
                  <div className="space-y-2 pt-0.5 animate-fade-in">
                    {/* En-tête de la section matières avec navigation par espace */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-black uppercase tracking-wider text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
                          Matières ({currentClassSubjects.length})
                        </span>
                        <span className="text-xs text-cyan-200/75 font-bold">&bull;</span>
                        <span className="text-[11px] font-bold text-cyan-900 bg-white/95 px-2 py-0.5 rounded-md border border-cyan-300/80 shadow-2xs">
                          {getClassFullLabel(activeClass)}
                        </span>
                        {activeTerm && (
                          <>
                            <span className="text-xs text-cyan-200/75 font-bold">&bull;</span>
                            <span
                              className="text-[11px] font-black text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-400"
                              style={{ boxShadow: '0 0 10px rgba(16, 185, 129, 0.35)' }}
                            >
                              {activeTerm.name}
                            </span>
                          </>
                        )}
                        <span className="text-[10px] font-black text-slate-800 bg-white/90 px-2 py-0.5 rounded-md border border-white shadow-2xs">
                          Espace {subjectPageIndex + 1} / {totalSubjectPages}
                        </span>
                        <InlineSectionSearch
                          isOpen={isSubjectSearchOpen}
                          query={subjectSearchQuery}
                          placeholder="Chercher une matière..."
                          onToggle={() => {
                            if (isSubjectSearchOpen) {
                              setIsSubjectSearchOpen(false);
                              setSubjectSearchQuery('');
                            } else {
                              setIsSubjectSearchOpen(true);
                            }
                          }}
                          onChange={setSubjectSearchQuery}
                          onClose={() => {
                            setIsSubjectSearchOpen(false);
                            setSubjectSearchQuery('');
                          }}
                        />
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold text-slate-200/90 drop-shadow-sm hidden sm:inline-block">
                          {pagedSubjects.length}/{SUBJECTS_PER_PAGE} dans cet espace &bull; 3 lignes max
                        </span>

                        <div className="flex items-center gap-1">
                          {/* Flèche gauche : Espace précédent */}
                          <button
                            type="button"
                            onClick={() => setSubjectPageIndex(prev => Math.max(0, prev - 1))}
                            disabled={subjectPageIndex === 0}
                            className={`w-6 h-6 rounded-md border shadow-2xs flex items-center justify-center transition-all ${
                              subjectPageIndex === 0
                                ? 'bg-slate-100/60 text-slate-300 border-slate-200/50 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-[#00313d] border-slate-200 active:scale-90 cursor-pointer'
                            }`}
                            title={subjectPageIndex === 0 ? "Premier espace atteint" : "Espace précédent"}
                          >
                            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>

                          {/* Flèche droite : Espace suivant */}
                          <button
                            type="button"
                            onClick={() => setSubjectPageIndex(prev => Math.min(totalSubjectPages - 1, prev + 1))}
                            disabled={subjectPageIndex >= totalSubjectPages - 1}
                            className={`w-6 h-6 rounded-md border shadow-2xs flex items-center justify-center transition-all ${
                              subjectPageIndex >= totalSubjectPages - 1
                                ? 'bg-slate-100/60 text-slate-300 border-slate-200/50 cursor-not-allowed'
                                : 'bg-[#00313d] hover:bg-[#00242e] text-white border-[#00242e] shadow-xs active:scale-90 cursor-pointer'
                            }`}
                            title={
                              subjectPageIndex >= totalSubjectPages - 1
                                ? `Remplissez les 3 lignes (${SUBJECTS_PER_PAGE} matières) pour ouvrir le prochain espace`
                                : "Espace suivant"
                            }
                          >
                            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Grille compacte : Bouton fixe "+ Matière" toujours devant (case 1) + matières (ne se déplace jamais) */}
                    <div 
                      key={subjectPageIndex}
                      className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-2.5 items-stretch animate-in fade-in duration-200"
                    >
                      {/* 1. BOUTON FIXE « + MATIÈRE » : toujours en première position, ne se déplace jamais */}
                      <button
                        type="button"
                        onClick={() => {
                          resetSubjectForm();
                          setIsAddSubjectModalOpen(true);
                        }}
                        className="rounded-lg border-2 border-dashed border-red-400/90 hover:border-red-500 bg-white/92 hover:bg-white backdrop-blur-md px-2 py-1.5 min-h-[50px] sm:min-h-[54px] flex items-center justify-center gap-1.5 text-center cursor-pointer transition-all duration-200 group hover:-translate-y-0.5 shadow-sm hover:shadow-md active:translate-y-0"
                        title="Créer une nouvelle matière pour cette classe"
                      >
                        <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-red-600 to-orange-500 text-white flex items-center justify-center group-hover:scale-110 shadow-2xs transition-transform shrink-0">
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <div className="flex flex-col text-left min-w-0">
                          <span className="text-[11px] font-black text-slate-800 group-hover:text-red-600 transition-colors leading-tight truncate">
                            + Matière
                          </span>
                          <span className="text-[8.5px] text-slate-400 leading-tight truncate">
                            {getClassDisplayName(activeClass)} &bull; {activeTerm?.name || 'T1'}
                          </span>
                        </div>
                      </button>

                      {/* 2. Matières de cet espace (format réduit) ou "Non trouvé" si recherche sans résultat */}
                      {pagedSubjects.length === 0 && subjectSearchQuery.trim() ? (
                        <div className="rounded-lg border border-slate-200/80 bg-white/75 px-3 py-2 min-h-[50px] sm:min-h-[54px] flex items-center justify-center text-xs font-bold text-slate-500 select-none">
                          Non trouvé
                        </div>
                      ) : (
                      pagedSubjects.map((subj) => {
                        const isWhite = !subj.color || subj.color === '#ffffff' || subj.color === 'white';

                        return (
                          <div
                            key={subj.id}
                            onClick={() => setSelectedSubjectInside(subj)}
                            style={{
                              backgroundColor: subj.color || '#ffffff',
                              color: subj.textColor || (isWhite ? '#0f172a' : '#ffffff'),
                              borderColor: isWhite ? '#e2e8f0' : (subj.borderColor || subj.color),
                              borderBottomColor: isWhite ? '#cbd5e1' : (subj.borderDarkColor || '#94a3b8'),
                            }}
                            className="group relative rounded-lg border-2 border-b-[3px] px-2 py-1.5 min-h-[50px] sm:min-h-[54px] flex flex-col justify-between cursor-pointer transition-all duration-200 select-none shadow-2xs hover:shadow-sm hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
                            title={`Ouvrir le tableur de notes et moyennes pour ${subj.name}`}
                          >
                            {/* Ligne haute : Badge Coeff & Menu 3 traits */}
                            <div className="flex items-center justify-between w-full">
                              {subj.coefficient ? (
                                <span className={`text-[8px] font-black px-1 py-0 rounded border ${
                                  isWhite
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-black/25 text-white/95 border-white/20'
                                }`}>
                                  Coeff {subj.coefficient}
                                </span>
                              ) : (
                                <span className={`text-[7.5px] font-bold opacity-60 ${isWhite ? 'text-slate-400' : 'text-white/70'}`}>
                                  Matière
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenMenu(e, 'subject', subj);
                                }}
                                className={`card-menu-trigger w-4 h-4 rounded flex items-center justify-center transition ${
                                  isWhite ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-white/70 hover:text-white hover:bg-black/20'
                                }`}
                                title="Options de la matière"
                              >
                                <div className="w-2.5 h-2 flex flex-col justify-between items-center pointer-events-none">
                                  <span className="w-full h-[1.4px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.4px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.4px] bg-current rounded-full"></span>
                                </div>
                              </button>
                            </div>

                            {/* Centre : Nom de la matière centré, format compact */}
                            <div className="flex-1 flex items-center justify-center my-auto px-0.5 pt-0.5">
                              <h5 
                                className="text-center font-black text-[11px] sm:text-xs leading-tight line-clamp-2 break-words"
                                title={subj.name}
                              >
                                {subj.name}
                              </h5>
                            </div>
                          </div>
                        );
                      })
                      )}

                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            // =====================================================================
            // CAS 2 : ON EST SUR LA LISTE DES ÉCOLES DE L'ANNÉE SCOLAIRE
            // =====================================================================
            currentSelectedYear ? (
              currentYearSchools.length === 0 ? (
                // 1. AUCUNE ÉCOLE : Bouton Plus au milieu avec pointillé autour formant un carré
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSchool(null);
                      setSchoolName('');
                      setSchoolLogo(null);
                      setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
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
                // 2. ÉCOLES CRÉÉES : Cartes en 3D sous forme de bouton avec logo rond
                <div className="space-y-2.5 pt-1 animate-fade-in">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wider text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)]">
                        Établissements scolaires ({currentYearSchools.length})
                      </span>
                      <span className="text-xs text-cyan-200/75 font-bold">&bull;</span>
                      <span className="text-xs font-bold text-cyan-900 bg-white/95 px-2 py-0.5 rounded-lg border border-cyan-200/60 shadow-2xs">
                        Rentrée {currentSelectedYear.label}
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
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
                    {/* Bouton carré pointillé fixe devant (position 1) pour ajouter une autre école */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchool(null);
                        setSchoolName('');
                        setSchoolLogo(null);
                        setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
                        setIsAddSchoolModalOpen(true);
                      }}
                      className="min-h-[170px] border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-white/90 hover:bg-white backdrop-blur-md rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group hover:-translate-y-1 shadow-md hover:shadow-lg"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#00313d] text-white flex items-center justify-center group-hover:scale-105 shadow-sm transition mb-2.5">
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <span className="text-xs font-black text-slate-700 group-hover:text-[#00313d] transition-colors">
                        Ajouter une autre école
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Pour {currentSelectedYear.label}
                      </span>
                    </button>

                    {filteredYearSchools.length === 0 && schoolSearchQuery.trim() ? (
                      <div className="min-h-[170px] rounded-2xl border border-slate-200/90 bg-white/75 backdrop-blur-md p-5 flex items-center justify-center text-sm font-bold text-slate-500 select-none">
                        Non trouvé
                      </div>
                    ) : (
                    filteredYearSchools.map((school) => {
                      const isSelected = selectedSchoolId === school.id;
                      const isWhite = !school.color || school.color === '#ffffff' || school.color === 'white';
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
                            backgroundColor: school.color || '#ffffff',
                            color: school.textColor || (isWhite ? '#0f172a' : '#ffffff'),
                            borderColor: isWhite ? '#e2e8f0' : (school.borderColor || school.color),
                            borderBottomColor: isWhite ? '#94a3b8' : (school.borderDarkColor || '#00141a'),
                          }}
                          className={`group relative rounded-2xl border-2 border-b-[6px] p-4 sm:p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none ${
                            isWhite 
                              ? 'shadow-[0_10px_25px_-5px_rgba(0,40,60,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] hover:border-b-cyan-600' 
                              : 'shadow-[0_12px_24px_-6px_rgba(0,0,0,0.3)]'
                          } ${
                            isSelected 
                              ? 'ring-2 ring-cyan-500 ring-offset-2 scale-[1.02]' 
                              : 'hover:-translate-y-1'
                          } active:translate-y-1 active:border-b-2`}
                        >
                          {/* Haut de la carte : Logo ROND à gauche & Badge année / Menu à droite */}
                          <div className="flex items-start justify-between gap-3">
                            {/* Logo de l'école (ROND comme demandé explicitement) */}
                            <div className="w-14 h-14 rounded-full overflow-hidden shadow-md border-2 border-white/90 shrink-0 flex items-center justify-center bg-white/20 backdrop-blur-xs">
                              {school.logoUrl ? (
                                <img 
                                  src={school.logoUrl} 
                                  alt={school.name} 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <div 
                                  className="w-full h-full flex items-center justify-center font-black text-lg tracking-wider"
                                  style={{ color: isWhite ? '#00313d' : '#ffffff' }}
                                >
                                  {school.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            {/* Badge année et menu 3 traits */}
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                isWhite 
                                   ? 'bg-slate-100 text-slate-700 border-slate-200' 
                                   : 'bg-black/20 text-white/90 border-white/20'
                              }`}>
                                {currentSelectedYear.label}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => handleOpenMenu(e, 'school', school)}
                                className={`card-menu-trigger w-7 h-7 rounded-lg flex items-center justify-center transition z-10 ${
                                  isWhite 
                                    ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-800' 
                                    : 'hover:bg-black/30 text-white/70 hover:text-white'
                                }`}
                                title="Options de l'établissement"
                              >
                                <div className="w-3.5 h-2.5 flex flex-col justify-between items-center pointer-events-none">
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* Milieu de la carte : Nom de l'école & Type */}
                          <div className="mt-3.5 space-y-0.5">
                            <h3 className="font-black text-base sm:text-lg tracking-tight leading-snug line-clamp-2">
                              {school.name}
                            </h3>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[10px] font-bold ${
                                isWhite ? 'text-slate-600' : 'text-white/85'
                              }`}>
                                {schoolLevelsCount} niveau{schoolLevelsCount > 1 ? 'x' : ''}
                              </span>
                              <span className="text-[10px] opacity-60">&bull;</span>
                              <span className={`text-[10px] font-bold ${
                                isWhite ? 'text-cyan-800' : 'text-cyan-200'
                              }`}>
                                {schoolClassesCount} classe{schoolClassesCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          {/* Bas de la carte : Bouton d'accès 3D intégré */}
                          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-black ${
                            isWhite 
                              ? 'border-slate-100 text-[#00313d] group-hover:text-cyan-600' 
                              : 'border-white/20 text-white group-hover:text-cyan-200'
                          } transition-colors`}>
                            <span>Accéder aux classes</span>
                            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      );
                    })
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center py-8 px-4 animate-fade-in">
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(true)}
                  className="group relative w-60 h-56 sm:w-64 sm:h-60 border-2 border-dashed border-cyan-300/75 hover:border-cyan-200 bg-[#081329]/42 hover:bg-[#081329]/62 backdrop-blur-[4px] rounded-3xl flex flex-col items-center justify-center p-5 text-center cursor-pointer transition-all duration-300 shadow-[0_12px_36px_rgba(0,0,0,0.45)] hover:shadow-[0_16px_42px_rgba(6,182,212,0.3)] hover:-translate-y-1 active:translate-y-0"
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
            )
          )}
        </section>

        {/* ========================================================================= */}
        {/* MODAL DE MODIFICATION D'UNE RENTRÉE SCOLAIRE (MENU 3 TRAITS -> MODIFIER) */}
        {/* ========================================================================= */}
        {editingYear && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
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
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
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
              <form onSubmit={handleCreateSchool} className="p-6 space-y-5">
                
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

                {/* Aperçu en direct de la carte 3D */}
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aperçu en direct :
                  </span>
                  <div 
                    style={{
                      backgroundColor: selectedSchoolColor.bg,
                      color: selectedSchoolColor.text,
                      borderColor: selectedSchoolColor.id === 'white' ? '#e2e8f0' : selectedSchoolColor.border,
                      borderBottomColor: selectedSchoolColor.id === 'white' ? '#94a3b8' : selectedSchoolColor.borderDark,
                    }}
                    className="rounded-xl border-2 border-b-[5px] p-3.5 flex items-center gap-3 shadow-md max-w-sm transition-all"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/90 shadow-md shrink-0 flex items-center justify-center bg-white/20">
                      {schoolLogo ? (
                        <img src={schoolLogo} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-sm" style={{ color: selectedSchoolColor.id === 'white' ? '#00313d' : '#ffffff' }}>
                          {schoolName.trim() ? schoolName.trim().slice(0, 2).toUpperCase() : 'EC'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-sm block truncate">
                        {schoolName.trim() || "Nom de l'école"}
                      </span>
                      <span className="text-[10px] font-semibold opacity-75 block">
                        Établissement &bull; {currentSelectedYear?.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Bouton Créer / Enregistrer accessible */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSchoolModalOpen(false);
                      setEditingSchool(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingSchool ? (!schoolName.trim() || !isSchoolDirty) : !schoolName.trim()}
                    style={{ 
                      backgroundColor: (editingSchool ? (schoolName.trim() && isSchoolDirty) : schoolName.trim()) 
                        ? '#00313d' 
                        : undefined 
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingSchool ? (schoolName.trim() && isSchoolDirty) : schoolName.trim())
                        ? 'text-white hover:bg-[#00242e] cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingSchool ? 'Enregistrer' : "Créer l'école"}</span>
                  </button>
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
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
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

                    {/* Suggestions rapides de niveaux */}
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Niveaux suggérés :
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {CLASS_LEVEL_SUGGESTIONS.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setStudyLevelName(sug)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              studyLevelName === sug
                                ? 'bg-[#00313d] text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>
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

                    {/* Aperçu du bouton mince rectangulaire plat */}
                    <div className="space-y-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aperçu dans la barre des niveaux :
                      </span>
                      <div className="flex items-center gap-2 flex-wrap py-1">
                        {(() => {
                          const previewGlow = getLuminousLevelTheme(selectedStudyLevelColor.bg);
                          return (
                            <div
                              style={{
                                background: previewGlow.bg,
                                color: previewGlow.text,
                                borderColor: previewGlow.border,
                                boxShadow: previewGlow.shadow,
                              }}
                              className="relative overflow-hidden h-8 px-3 rounded-lg border-2 text-xs font-black flex items-center gap-1.5 select-none"
                            >
                              <div
                                className="absolute inset-0 pointer-events-none opacity-45 blur-md"
                                style={{ background: previewGlow.aura }}
                              />
                              <span
                                className="relative z-10 w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: previewGlow.dot, boxShadow: previewGlow.dotShadow }}
                              />
                              <span className="relative z-10">{studyLevelName.trim() || 'Ex: Terminale'}</span>
                              <span
                                className="relative z-10 text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border"
                                style={{
                                  backgroundColor: previewGlow.badgeBg,
                                  color: previewGlow.badgeText,
                                  borderColor: previewGlow.badgeBorder,
                                }}
                              >
                                0 cl.
                              </span>
                            </div>
                          );
                        })()}
                        <span className="text-[10px] text-slate-400 font-medium">
                          (Sélection lumineuse)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pied de modale */}
                <div className="p-4 px-6 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddLevelModalOpen(false);
                      resetLevelForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingLevel ? (!studyLevelName.trim() || !isLevelDirty) : !studyLevelName.trim()}
                    style={{
                      backgroundColor: (editingLevel ? (studyLevelName.trim() && isLevelDirty) : studyLevelName.trim())
                        ? '#00313d'
                        : undefined
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingLevel ? (studyLevelName.trim() && isLevelDirty) : studyLevelName.trim())
                        ? 'text-white hover:bg-[#00242e] cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingLevel ? 'Enregistrer' : "Créer le niveau"}</span>
                  </button>
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
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
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

                    {/* Aperçu en direct de la carte 3D compacte */}
                    <div className="space-y-1.5 pt-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aperçu de la carte 3D (format compact) :
                      </span>
                      <div 
                        style={{
                          borderColor: selectedClassColor.border,
                          borderBottomColor: selectedClassColor.borderDark,
                        }}
                        className="w-52 rounded-xl border-2 border-b-[4px] bg-white px-2.5 py-2 flex flex-col justify-between shadow-sm transition-all select-none"
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div 
                              className="w-6 h-6 rounded-md flex items-center justify-center shadow-2xs shrink-0"
                              style={{ background: selectedClassColor.iconGradient }}
                            >
                              <BookOpen className="w-3.5 h-3.5 text-white stroke-[2.2]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[8.5px] font-bold uppercase tracking-wide text-slate-400 block truncate leading-none">
                                {classSlogan.trim() || (editingClass ? editingClass.level : activeLevel?.name) || 'Niveau'}
                              </span>
                              <h4 className="text-xs font-black text-slate-900 tracking-tight leading-snug truncate mt-0.5">
                                {className.trim() || 'Nom de la classe'}
                              </h4>
                            </div>
                          </div>
                          <span className="w-2 h-2 rounded-full shadow-2xs shrink-0 mt-0.5" style={{ backgroundColor: selectedClassColor.bg }} />
                        </div>

                        <div className="mt-1.5 pt-1 border-t border-slate-100 flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-600 truncate text-[9.5px]">
                            {classTeacherName.trim() || 'Nom du maître'}
                          </span>
                          <span className="text-[8.5px] font-black text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200/50 shrink-0">
                            0 mat.
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Boutons Créer / Enregistrer */}
                <div className="p-4 px-6 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddClassModalOpen(false);
                      resetClassForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingClass ? (!className.trim() || !classTeacherName.trim() || !isClassDirty) : (!className.trim() || !classTeacherName.trim())}
                    style={{ 
                      backgroundColor: (editingClass ? (className.trim() && classTeacherName.trim() && isClassDirty) : (className.trim() && classTeacherName.trim())) 
                        ? '#00313d' 
                        : undefined 
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingClass ? (className.trim() && classTeacherName.trim() && isClassDirty) : (className.trim() && classTeacherName.trim()))
                        ? 'text-white hover:bg-[#00242e] cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingClass ? 'Enregistrer' : "Créer la classe"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR CRÉER UNE MATIÈRE (DANS LA CLASSE SÉLECTIONNÉE)   */}
        {/* ========================================================================= */}
        {isAddSubjectModalOpen && activeClass && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
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

                {/* 2. Coefficient (facultatif) */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Coefficient <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={subjectCoefficient}
                    onChange={(e) => setSubjectCoefficient(e.target.value)}
                    placeholder="Ex: 1, 2, 3, 4..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Utilisé pour le calcul de la moyenne générale de l'élève.
                  </span>
                </div>

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

                {/* Aperçu en direct de la carte matière 3D rectangulaire */}
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aperçu de la carte matière (format rectangle compact) :
                  </span>
                  <div 
                    style={{
                      backgroundColor: selectedSubjectColor.bg,
                      color: selectedSubjectColor.text,
                      borderColor: selectedSubjectColor.id === 'white' ? '#e2e8f0' : selectedSubjectColor.border,
                      borderBottomColor: selectedSubjectColor.id === 'white' ? '#cbd5e1' : selectedSubjectColor.borderDark,
                    }}
                    className="w-40 sm:w-44 rounded-lg border-2 border-b-[3px] px-2 py-1.5 min-h-[52px] flex flex-col justify-between shadow-sm transition-all select-none"
                  >
                    <div className="flex items-center justify-between w-full">
                      {subjectCoefficient.trim() ? (
                        <span className={`text-[8px] font-black px-1 py-0 rounded border ${
                          selectedSubjectColor.id === 'white'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-black/25 text-white/95 border-white/20'
                        }`}>
                          Coeff {subjectCoefficient.trim()}
                        </span>
                      ) : (
                        <span className="text-[7.5px] font-bold opacity-60">Matière</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-center my-auto px-0.5 pt-0.5">
                      <span className="text-center font-black text-[11px] sm:text-xs leading-tight line-clamp-2 break-words">
                        {subjectName.trim() || 'Nom matière'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boutons actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSubjectModalOpen(false);
                      resetSubjectForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingSubject ? (!subjectName.trim() || !isSubjectDirty) : !subjectName.trim()}
                    style={{ 
                      backgroundColor: (editingSubject ? (subjectName.trim() && isSubjectDirty) : subjectName.trim()) 
                        ? '#dc2626' 
                        : undefined 
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingSubject ? (subjectName.trim() && isSubjectDirty) : subjectName.trim())
                        ? 'text-white hover:bg-red-700 cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingSubject ? 'Enregistrer' : "Créer la matière"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MENU CONTEXTUEL FLOTTANT "3 TRAITS" INTELLIGENT (NE SE COUPE JAMAIS)      */}
        {/* ========================================================================= */}
        {activeMenu && (
          <div
            className="card-dropdown-menu fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200/90 py-1.5 w-48 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-none"
            style={{
              top: `${activeMenu.position.top}px`,
              left: `${activeMenu.position.left}px`,
              boxShadow: '0 16px 36px -6px rgba(0, 31, 39, 0.28), 0 4px 12px -2px rgba(0, 0, 0, 0.08)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleTriggerEdit(activeMenu.type, activeMenu.item)}
              className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-cyan-700 stroke-[2.2]" />
              <span>Modifier les informations</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => handleTriggerDelete(activeMenu.type, activeMenu.item)}
              className="w-full px-3.5 py-2 text-left text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500 stroke-[2.2]" />
              <span>Supprimer</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DE SUPPRESSION SÉCURISÉE AVEC SAISIE EXACTE DU NOM REQUIS          */}
        {/* ========================================================================= */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[10000] bg-[#001820]/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
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
        {/* MODAL DE CONFIRMATION D'AJOUT D'UN TRIMESTRE                             */}
        {/* ========================================================================= */}
        {isAddTermModalOpen && activeClass && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div 
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-150"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 49, 61, 0.35)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#00313d] leading-tight">
                      Ajouter un trimestre
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400 mt-0.5 inline-block">
                      Classe : {getClassFullLabel(activeClass)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddTermModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="p-4 rounded-xl bg-cyan-50/70 border border-cyan-200/80 text-xs sm:text-sm text-cyan-950 leading-relaxed font-semibold">
                  Voulez-vous ajouter le <span className="font-black text-[#00313d]">Trimestre {nextTermNumber}</span> pour la classe <span className="font-black">{getClassFullLabel(activeClass)}</span> ?
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ce nouveau trimestre vous permettra d'enregistrer et de gérer des matières, notes et évaluations indépendantes des autres trimestres.
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddTermModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddTerm}
                    className="flex-1 py-2.5 rounded-xl bg-[#00313d] hover:bg-[#00242e] text-white text-xs font-black shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Oui, ajouter Trimestre {nextTermNumber}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
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
    </div>
  );
};
