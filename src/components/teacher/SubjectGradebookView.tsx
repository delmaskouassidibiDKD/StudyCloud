import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Copy,
  Pen,
  Search,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Paintbrush,
  Clipboard,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Grid3X3,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  Plus,
  Minus,
  Download,
  ChevronDown,
  Camera,
  Trash2,
  MoreVertical,
  Edit2,
  Eraser,
  Palette,
  Check,
  X,
  AlertCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Cloud,
  CloudOff,
  Loader2,
  Save,
  WifiOff,
  CheckCircle2,
  User,
  Link2
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SubjectItem, ClassItem, SchoolItem, SchoolYearItem, TermItem } from './TeacherClassesView';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import {
  MentionAndMatriculeControls,
  type BulkNoteMaxUpdateInput,
  type NoteColumnOption,
  type SheetSettingScope,
} from './MentionAndMatriculeControls';
import {
  TeacherDelmasAssistantRibbonButton,
  TeacherDelmasAssistantDrawer,
} from './TeacherDelmasAssistantDrawer';
import { useTablePinchZoom } from '../../hooks/useTablePinchZoom';
import { GradebookDownloadMenu } from './GradebookDownloadMenu';
import {
  exportGradebookToPdf,
  exportGradebookToWord,
  copyGradebookToClipboard,
  type GradebookExportDataset,
} from '../../utils/gradebookExportUtils';
import {
  hasRealExplicitMatriculeBatch,
  type TeacherDelmasAction,
  type TeacherDelmasActiveContext,
  type TeacherDelmasSheetBridge,
} from '../../utils/teacherDelmasActionEngine';
import type { TeacherDelmasWorkspaceSnapshot } from '../../services/teacherGradebookApi';
import { ViewerSuperExpandButton } from '../ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../../utils/viewerExpandManager';
import {
  calculateSubjectAverage,
  calculateClassRanks,
  DEFAULT_AVERAGE_SCALE,
  formatAverageDisplay,
  formatScaleValue,
  DEFAULT_CUSTOM_MENTION_RULES,
  resolveMentionWithRules,
  sanitizeAverageScale,
  sortGradebookRows,
  type CustomMentionRule,
  type EvaluationInput,
  type GradebookSortMode
} from '../../utils/gradebookCalculations';
import {
  getVisibleColumnOrder,
  isDefaultColumnOrder,
  resolveColumnOrderFromDelmasAction,
  resolveEffectiveColumnOrder,
  sanitizeGradebookColumnOrder,
  type GradebookColumnOrder,
  type GradebookPeripheralColumnKey,
} from '../../utils/gradebookColumnLayout';
import {
  normalizeStudentNameKey,
  canonicalWordBagKey,
} from '../../utils/termGeneralAverage';
import {
  TeacherGradebookAPI,
  compressImageToUpload,
  generateTeacherEntityId,
  getTeacherAuthToken,
  readUserGradebookCache,
  writeUserGradebookCache,
  isOfflineOrNetworkError,
  type ClassSheetSettings,
  type TeacherGradebookPayload,
  type TeacherClassRosterStudent,
} from '../../services/teacherGradebookApi';

interface SubjectGradebookViewProps {
  subject: SubjectItem;
  schoolClass: ClassItem;
  schoolYear?: SchoolYearItem | null;
  school?: SchoolItem | null;
  term?: TermItem | null;
  userId?: string;
  onGradebookSynced?: () => void;
  onClassSettingsUpdated?: (classId: string, settings: ClassSheetSettings) => void;
  onBack: () => void;
  /** Mode maquette / non connecté à la base de données (ex: aperçu Moyenne générale en cours d'adaptation) */
  disableCloudPersistence?: boolean;
  /** Libellé personnalisé pour la feuille active en bas (ex: "Moyenne générale de l'année") */
  customSheetLabel?: string;
  /** Badge période personnalisé en haut (ex: "Annuelle" ou "Trimestre 1") */
  customPeriodBadge?: string;
}

// Métadonnées d'une colonne de notes (intitulé, barème max, coefficient d'évaluation, couleurs)
export interface GradebookColumnMeta {
  title?: string;        // Intitulé personnalisable (ex: "NOTE", "DEVOIR", "INTERRO", "TP")
  maxScore: number;      // Barème maximal par défaut (ex: 20, 10, 40)
  coeffEval?: number;    // Coefficient propre à l'évaluation (défaut 1)
  headerBgColor?: string;// Couleur de fond de l'en-tête seul
  columnBgColor?: string;// Couleur de fond de toute la colonne
}

// Structure d'un élève dans le tableau moderne de notes
export interface StudentGradeRow {
  id: string;
  studentUid?: string;
  name: string;
  matricule?: string;
  photoUrl?: string;
  photoR2Key?: string;
  photoSizeBytes?: number;
  notes: string[]; // Notes dynamiques stockées sous forme "score/max" ou "score"
}

// Analyse d'une note d'élève stockée ("score/max" ou "score")
export interface ParsedNote {
  scoreStr: string;
  maxScoreStr: string;
  maxScore: number;
  scoreNum: number | null;
  isInvalid: boolean;     // true si scoreNum > maxScore ou si maxScore <= 0 avec une note saisie
  hasInvalidMax: boolean; // true si le barème saisi derrière / est vide ou <= 0
}

const sanitizeDecimalInput = (raw: string): string => {
  const normalized = (raw || '').replace(/,/g, '.').replace(/[^0-9.]/g, '');
  const parts = normalized.split('.');
  if (parts.length <= 1) return normalized;
  return `${parts[0]}.${parts.slice(1).join('')}`;
};

export const parseStudentNote = (rawVal: string, defaultMax = 20): ParsedNote => {
  const safe = (rawVal || '').trim();
  const fallbackMax = defaultMax > 0 ? defaultMax : 20;
  let scoreStr = '';
  let maxScoreStr = String(fallbackMax);
  let maxScore = fallbackMax;
  let hasInvalidMax = false;

  if (safe.includes('/')) {
    const parts = safe.split('/');
    scoreStr = sanitizeDecimalInput(parts[0] || '');
    maxScoreStr = sanitizeDecimalInput(parts[1] || '');
    const parsedMax = maxScoreStr !== '' ? parseFloat(maxScoreStr) : NaN;
    if (!isNaN(parsedMax) && parsedMax > 0) {
      maxScore = parsedMax;
    } else {
      maxScore = 0;
      hasInvalidMax = true;
    }
  } else {
    scoreStr = sanitizeDecimalInput(safe);
  }

  const parsedScore = scoreStr !== '' ? parseFloat(scoreStr) : null;
  const scoreNum = parsedScore !== null && !isNaN(parsedScore) ? parsedScore : null;
  const isInvalid = scoreNum !== null && (hasInvalidMax || scoreNum > maxScore);

  return {
    scoreStr,
    maxScoreStr,
    maxScore,
    scoreNum,
    isInvalid,
    hasInvalidMax
  };
};

export const formatStudentNote = (scoreStr: string, maxScore: number | string): string => {
  const cleanScore = sanitizeDecimalInput(scoreStr);
  if (typeof maxScore === 'string') {
    const cleanMax = sanitizeDecimalInput(maxScore);
    return `${cleanScore}/${cleanMax}`;
  }
  return `${cleanScore}/${maxScore > 0 ? maxScore : 20}`;
};

// Palette de couleurs pastel pour la coloration (16 teintes riches, nettes et bien contrastées)
// Polices de caractères disponibles (avec aperçu réel dans le menu déroulant)
export const AVAILABLE_FONT_FAMILIES = [
  'Calibri',
  'Arial',
  'Arial Black',
  'Alef',
  'Amiri',
  'Bahnschrift',
  'Cambria',
  'Candara',
  'Comic Sans MS',
  'Consolas',
  'Constantia',
  'Corbel',
  'Courier New',
  'Franklin Gothic Medium',
  'Gabriola',
  'Georgia',
  'Impact',
  'Lucida Console',
  'Lucida Sans Unicode',
  'Microsoft Sans Serif',
  'Palatino Linotype',
  'Segoe UI',
  'Tahoma',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana'
];

// Tailles de police prédéfinies style Excel
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 48];

// Nuancier de couleurs pour le texte (Bouton Stylo)
export const TEXT_PALETTE_COLORS = [
  { name: 'Automatique (Noir)', color: '#0f172a' },
  { name: 'Bleu nuit', color: '#1e3a8a' },
  { name: 'Bleu roi', color: '#2563eb' },
  { name: 'Cyan océan', color: '#0891b2' },
  { name: 'Vert émeraude', color: '#059669' },
  { name: 'Vert forêt', color: '#15803d' },
  { name: 'Ambre foncé', color: '#b45309' },
  { name: 'Orange vif', color: '#ea580c' },
  { name: 'Rouge brique', color: '#dc2626' },
  { name: 'Rose fuchsia', color: '#db2777' },
  { name: 'Violet impérial', color: '#7c3aed' },
  { name: 'Pourpre', color: '#9333ea' },
  { name: 'Gris ardoise', color: '#475569' },
  { name: 'Gris moyen', color: '#64748b' }
];

// Nuancier de couleurs pour le fond de cellule (Bouton Remplissage)
export const FILL_PALETTE_COLORS = [
  { name: 'Aucun remplissage', color: '' },
  { name: 'Jaune canari', color: '#fef08a' },
  { name: 'Ambre doux', color: '#fed7aa' },
  { name: 'Pêche corail', color: '#ffedd5' },
  { name: 'Rose poudré', color: '#fbcfe8' },
  { name: 'Rouge clair doux', color: '#fee2e2' },
  { name: 'Violet lilas', color: '#e9d5ff' },
  { name: 'Lavande indigo', color: '#c7d2fe' },
  { name: 'Bleu ciel', color: '#bae6fd' },
  { name: 'Bleu azur', color: '#bfdbfe' },
  { name: 'Cyan lagon', color: '#a5f3fc' },
  { name: 'Vert menthe', color: '#a7f3d0' },
  { name: 'Vert prairie', color: '#bbf7d0' },
  { name: 'Vert lime', color: '#d9f99d' },
  { name: 'Sable doré', color: '#fef3c7' },
  { name: 'Gris perle', color: '#f1f5f9' }
];

export interface CellCustomStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  bgColor?: string;
  fontSize?: number;
  fontFamily?: string;
  textAlign?: 'left' | 'center' | 'right';
}

export const PASTEL_PALETTE = [
  { name: 'Aucune couleur (Défaut)', bg: '', headerBg: '', label: 'Défaut' },
  { name: 'Jaune canari', bg: '#fef08a', headerBg: '#fde047', label: 'Jaune' },
  { name: 'Ambre doux', bg: '#fed7aa', headerBg: '#fb923c', label: 'Ambre' },
  { name: 'Pêche corail', bg: '#ffedd5', headerBg: '#fdba74', label: 'Pêche' },
  { name: 'Rose poudré', bg: '#fbcfe8', headerBg: '#f472b6', label: 'Rose' },
  { name: 'Rose framboise', bg: '#fecdd3', headerBg: '#fb7185', label: 'Framboise' },
  { name: 'Rouge clair doux', bg: '#fee2e2', headerBg: '#f87171', label: 'Rouge' },
  { name: 'Violet lilas', bg: '#e9d5ff', headerBg: '#c084fc', label: 'Lilas' },
  { name: 'Lavande indigo', bg: '#c7d2fe', headerBg: '#818cf8', label: 'Lavande' },
  { name: 'Bleu ciel', bg: '#bae6fd', headerBg: '#38bdf8', label: 'Bleu ciel' },
  { name: 'Bleu azur', bg: '#bfdbfe', headerBg: '#60a5fa', label: 'Azur' },
  { name: 'Cyan lagon', bg: '#a5f3fc', headerBg: '#22d3ee', label: 'Cyan' },
  { name: 'Vert menthe', bg: '#a7f3d0', headerBg: '#34d399', label: 'Menthe' },
  { name: 'Vert prairie', bg: '#bbf7d0', headerBg: '#4ade80', label: 'Vert' },
  { name: 'Vert lime', bg: '#d9f99d', headerBg: '#a3e635', label: 'Lime' },
  { name: 'Sable doré', bg: '#fef3c7', headerBg: '#fcd34d', label: 'Sable' },
];

// Nombre de colonnes de cases vides supplémentaires à droite du tableau (dépasse toujours les notes)
const RIGHT_EXTRA_COLS = 32;

// Générateur de libellé de colonne Excel :
// De A (0) jusqu'à AV (47). Arrivé à AV, reprend à zéro (A, B, C...) si le tableau continue !
const getExcelColumnLabel = (index: number): string => {
  const cycleIndex = index % 48;
  let label = '';
  let i = cycleIndex;
  while (i >= 0) {
    label = String.fromCharCode((i % 26) + 65) + label;
    i = Math.floor(i / 26) - 1;
  }
  return label;
};

// Mesure de la largeur minimale nécessaire pour le mot le plus long (empêche les pointillés / textes coupés)
const getMinNameColWidth = (studentsList: StudentGradeRow[]): number => {
  let maxWordPx = 150; // Largeur minimale de base
  for (const s of studentsList) {
    if (!s.name) continue;
    const words = s.name.trim().split(/\s+/);
    for (const w of words) {
      const wPx = Math.round(w.length * 10 + 44);
      if (wPx > maxWordPx) maxWordPx = wPx;
    }
  }
  return Math.min(360, maxWordPx);
};

export const SubjectGradebookView: React.FC<SubjectGradebookViewProps> = ({
  subject,
  schoolClass,
  schoolYear,
  school,
  term,
  userId,
  onGradebookSynced,
  onClassSettingsUpdated,
  onBack,
  disableCloudPersistence = false,
  customSheetLabel,
  customPeriodBadge,
}) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  const effectiveTermId = term?.id || subject.termId || 't1';
  const effectiveUserId = userId || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') || '' : '');
  const initialCachedSheet = useMemo(
    () => (!disableCloudPersistence && effectiveUserId ? readUserGradebookCache(effectiveUserId, subject.id, effectiveTermId) : null),
    [disableCloudPersistence, effectiveUserId, subject.id, effectiveTermId]
  );

  // Référence du conteneur de défilement
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Nombre de colonnes de notes dynamique (infini, minimum 1, 7 par défaut)
  const [noteColumnCount, setNoteColumnCount] = useState<number>(() => {
    if (initialCachedSheet?.noteColumnCount && initialCachedSheet.noteColumnCount >= 1) {
      return initialCachedSheet.noteColumnCount;
    }
    return 7;
  });

  // Métadonnées de chaque colonne de note (titre, barème max, couleur de fond)
  const [columnMetas, setColumnMetas] = useState<{ [colIndex: number]: GradebookColumnMeta }>(() => {
    return initialCachedSheet?.columnMetas || {};
  });

  const [cellColors, setCellColors] = useState<{ [key: string]: string }>(() => {
    return initialCachedSheet?.styles?.cellColors || {};
  });

  const [rowColors, setRowColors] = useState<{ [rowId: string]: string }>(() => {
    return initialCachedSheet?.styles?.rowColors || {};
  });

  // Menu contextuel 3 points de colonne
  const [activeMenuCol, setActiveMenuCol] = useState<number | null>(null);

  // Menus contextuels 3 points additionnels
  const [activeMenuCell, setActiveMenuCell] = useState<{ studentId: string; colIndex: number } | null>(null);
  const [activeMenuRow, setActiveMenuRow] = useState<string | null>(null);
  const [activeMenuNameCol, setActiveMenuNameCol] = useState<boolean>(false);
  const [activeMenuPhoto, setActiveMenuPhoto] = useState<string | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const gradebookContainerRef = useRef<HTMLDivElement | null>(null);

  // Prévisualisation centrée de photo d'élève (nom, photo, moyenne)
  const [previewPhotoStudent, setPreviewPhotoStudent] = useState<StudentGradeRow | null>(null);

  // Message rouge d'alerte ciblé sur la case où l'utilisateur tente d'écrire une note sans nom d'élève
  const [blockedNoteTarget, setBlockedNoteTarget] = useState<{ studentId: string; colIndex: number } | null>(null);

  // État pour les styles personnalisés des cellules (gras, couleur texte, fond, police, taille)
  const [cellCustomStyles, setCellCustomStyles] = useState<{ [cellKey: string]: CellCustomStyle }>(() => {
    return initialCachedSheet?.styles?.cellCustomStyles || {};
  });

  // États pour les menus déroulants interactifs du Ruban Excel
  const [isFontFamilyMenuOpen, setIsFontFamilyMenuOpen] = useState<boolean>(false);
  const [isFontSizeMenuOpen, setIsFontSizeMenuOpen] = useState<boolean>(false);
  const [isTextColorMenuOpen, setIsTextColorMenuOpen] = useState<boolean>(false);
  const [isBgColorMenuOpen, setIsBgColorMenuOpen] = useState<boolean>(false);
  const [isGradeAdjustMenuOpen, setIsGradeAdjustMenuOpen] = useState<boolean>(false);
  const [isSortMenuOpen, setIsSortMenuOpen] = useState<boolean>(false);
  const [closeMentionMatriculeSignal, setCloseMentionMatriculeSignal] = useState<number>(0);
  const [sortMode, setSortMode] = useState<GradebookSortMode>(() => {
    const saved = initialCachedSheet?.layout?.sortMode;
    return saved === 'merit' || saved === 'alpha' || saved === 'order' ? saved : 'order';
  });
  // Paramètres de classe (mentions personnalisées + colonne Matricule + moyenne max + disposition) et éventuelles surcharges propres à ce tableau
  const [classSettings, setClassSettings] = useState<ClassSheetSettings>(() => ({
    mentionRules: schoolClass.mentionRules ?? null,
    showMatricule: Boolean(schoolClass.showMatricule),
    averageScale: sanitizeAverageScale(schoolClass.averageScale) ?? DEFAULT_AVERAGE_SCALE,
    columnOrder: (schoolClass.columnOrder as GradebookColumnOrder | null | undefined) ?? null,
  }));
  const [sheetMentionRules, setSheetMentionRules] = useState<CustomMentionRule[] | null | undefined>(
    () => initialCachedSheet?.layout?.mentionRules
  );
  const [sheetShowMatricule, setSheetShowMatricule] = useState<boolean | undefined>(
    () => initialCachedSheet?.layout?.showMatricule
  );
  const [sheetAverageScale, setSheetAverageScale] = useState<number | undefined>(() => {
    const s = sanitizeAverageScale(initialCachedSheet?.layout?.averageScale);
    return s !== null ? s : undefined;
  });
  const [sheetColumnOrder, setSheetColumnOrder] = useState<GradebookColumnOrder | null | undefined>(
    () => initialCachedSheet?.layout?.columnOrder
  );

  const effectiveMentionRules = useMemo<readonly CustomMentionRule[]>(() => {
    if (sheetMentionRules === null) return DEFAULT_CUSTOM_MENTION_RULES;
    if (sheetMentionRules && sheetMentionRules.length > 0) return sheetMentionRules;
    if (classSettings.mentionRules && classSettings.mentionRules.length > 0) return classSettings.mentionRules;
    return DEFAULT_CUSTOM_MENTION_RULES;
  }, [sheetMentionRules, classSettings.mentionRules]);

  const hasCustomMentionRules = Boolean(
    sheetMentionRules !== null &&
      ((sheetMentionRules && sheetMentionRules.length > 0) ||
        (classSettings.mentionRules && classSettings.mentionRules.length > 0))
  );
  const effectiveShowMatricule =
    typeof sheetShowMatricule === 'boolean'
      ? sheetShowMatricule
      : Boolean(classSettings.showMatricule);
  const effectiveAverageScale =
    sanitizeAverageScale(sheetAverageScale) ??
    sanitizeAverageScale(classSettings.averageScale) ??
    DEFAULT_AVERAGE_SCALE;
  const effectiveScaleLabel = formatScaleValue(effectiveAverageScale);
  const effectiveColumnOrder = useMemo(
    () =>
      resolveEffectiveColumnOrder(sheetColumnOrder, classSettings.columnOrder, {
        includeTotal: false,
      }),
    [sheetColumnOrder, classSettings.columnOrder]
  );
  const hasCustomColumnOrder = useMemo(
    () => !isDefaultColumnOrder(effectiveColumnOrder, { includeTotal: false }),
    [effectiveColumnOrder]
  );
  const visibleColumnOrder = useMemo(
    () =>
      getVisibleColumnOrder(effectiveColumnOrder, {
        showMatricule: effectiveShowMatricule,
        includeTotal: false,
      }),
    [effectiveColumnOrder, effectiveShowMatricule]
  );

  // Verrouillage temporaire de l'ordre visuel pendant la frappe dans une cellule (évite que la ligne saute sous le curseur)
  const [lockedOrderIds, setLockedOrderIds] = useState<string[] | null>(null);
  const [gradeAdjustMode, setGradeAdjustMode] = useState<'all' | 'specific'>('all');
  const [gradeAdjustSign, setGradeAdjustSign] = useState<'add' | 'sub'>('add');
  const [gradeAdjustAmountStr, setGradeAdjustAmountStr] = useState<string>('1');
  const [gradeAdjustColIndex, setGradeAdjustColIndex] = useState<number>(0);
  const [gradeAdjustFeedback, setGradeAdjustFeedback] = useState<string | null>(null);
  const [fontSearchQuery, setFontSearchQuery] = useState<string>('');
  const [copiedTableSuccess, setCopiedTableSuccess] = useState<boolean>(false);

  // Fermeture des autres menus du ruban/tableau sans fermer Mentions/Matricule en cours d'ouverture
  const closeOtherMenus = () => {
    setActiveMenuCol(null);
    setActiveMenuRow(null);
    setActiveMenuCell(null);
    setActiveMenuPhoto(null);
    setActiveMenuNameCol(false);
    setActiveColorPicker(null);
    setIsFontFamilyMenuOpen(false);
    setIsFontSizeMenuOpen(false);
    setIsTextColorMenuOpen(false);
    setIsBgColorMenuOpen(false);
    setIsGradeAdjustMenuOpen(false);
    setIsSortMenuOpen(false);
    setMenuAnchorEl(null);
  };

  // Fermeture universelle et propre de tous les menus et palettes sans figer l'application
  const closeAllMenus = () => {
    closeOtherMenus();
    setCloseMentionMatriculeSignal((n) => n + 1);
  };

  // Un seul petit menu peut être ouvert à la fois
  const isAnyMenuOpen = activeMenuCol !== null || activeMenuRow !== null || activeMenuCell !== null || activeMenuNameCol || activeMenuPhoto !== null || isFontFamilyMenuOpen || isFontSizeMenuOpen || isTextColorMenuOpen || isBgColorMenuOpen || isGradeAdjustMenuOpen || isSortMenuOpen;

  // Palette de couleur active
  const [activeColorPicker, setActiveColorPicker] = useState<{
    mode: 'cell' | 'column' | 'singleCell' | 'row';
    colIndex?: number;
    studentId?: string;
    targetId?: string | number;
  } | null>(null);

  // Modale de modification d'intitulé, barème et coefficient d'évaluation de la colonne
  const [editingColModal, setEditingColModal] = useState<{
    colIndex: number;
    title: string;
    maxScore: number;
    coeffEval: number;
  } | null>(null);

  // Mode déplacement actif pour une colonne (flèches bleues affichées)
  const [movingColIndex, setMovingColIndex] = useState<number | null>(null);

  // Largeurs personnalisables et modelables des colonnes
  const [colWidthRank, setColWidthRank] = useState<number>(() => {
    const n = initialCachedSheet?.layout?.colWidthRank;
    return typeof n === 'number' && n >= 55 ? n : 68;
  });

  const [colWidthPhoto, setColWidthPhoto] = useState<number>(() => {
    const n = initialCachedSheet?.layout?.colWidthPhoto;
    return typeof n === 'number' && n >= 60 ? n : 76;
  });

  const [colWidthMatricule, setColWidthMatricule] = useState<number>(() => {
    const n = initialCachedSheet?.layout?.colWidthMatricule;
    return typeof n === 'number' && n >= 90 ? n : 124;
  });

  const [colWidthName, setColWidthName] = useState<number>(() => {
    const n = initialCachedSheet?.layout?.colWidthName;
    return typeof n === 'number' && n >= 150 ? n : 280;
  });

  const [noteColWidth, setNoteColWidth] = useState<number>(() => {
    const w = initialCachedSheet?.layout?.noteColWidth;
    return typeof w === 'number' && w >= 96 && w <= 240 ? w : 96;
  });

  // Largeurs individuelles pour chaque colonne de note
  const [customNoteWidths, setCustomNoteWidths] = useState<{ [index: number]: number }>(() => {
    const raw = initialCachedSheet?.layout?.customNoteWidths;
    if (raw && typeof raw === 'object') {
      const clamped: { [index: number]: number } = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'number') clamped[Number(k)] = Math.max(96, v);
      }
      return clamped;
    }
    return {};
  });

  const [colWidthAverage, setColWidthAverage] = useState<number>(() => {
    const n = initialCachedSheet?.layout?.colWidthAverage;
    return typeof n === 'number' && n >= 75 ? n : 104;
  });

  const [colWidthMention, setColWidthMention] = useState<number>(() => {
    const n = initialCachedSheet?.layout?.colWidthMention;
    return typeof n === 'number' && n >= 80 ? n : 108;
  });

  // Hauteurs personnalisées de chaque ligne d'élève
  const [customRowHeights, setCustomRowHeights] = useState<{ [index: number]: number }>(() => {
    return initialCachedSheet?.layout?.customRowHeights || {};
  });

  // ÉTAT DE SÉLECTION STRICT : Une seule ligne sélectionnée à la fois (exclusive)
  // Double-clic requis pour sélectionner. Le simple survol ne sélectionne PAS !
  const [selectedLine, setSelectedLine] = useState<{ type: 'col' | 'row'; id: string } | null>(null);
  const [resizingLine, setResizingLine] = useState<{ type: 'col' | 'row'; id: string } | null>(null);

  // Liste des élèves avec leurs notes (Infini, synchronisé avec Cloudflare D1 + photos dans R2)
  const [students, setStudents] = useState<StudentGradeRow[]>(() => {
    if (Array.isArray(initialCachedSheet?.students) && initialCachedSheet.students.length > 0) {
      const maxNotes = Math.max(
        initialCachedSheet.noteColumnCount || 7,
        ...initialCachedSheet.students.map((p) => p.notes?.length || 0)
      );
      return initialCachedSheet.students.map((s) => ({
        id: s.id || generateTeacherEntityId('std'),
        studentUid: s.studentUid || s.id,
        name: s.name || '',
        matricule: s.matricule || '',
        photoUrl: s.photoUrl,
        photoR2Key: s.photoR2Key,
        notes: Array.from({ length: maxNotes }, (_, i) => s.notes?.[i] || ''),
      }));
    }

    return Array.from({ length: 8 }, () => ({
      id: generateTeacherEntityId('std'),
      name: '',
      matricule: '',
      photoUrl: undefined,
      photoR2Key: undefined,
      notes: Array(7).fill(''),
    }));
  });

  // Cellule active pour la barre de formule (aucune sélection tant que l'utilisateur n'a pas cliqué)
  const [activeCellInfo, setActiveCellInfo] = useState<{
    id: string;
    type: 'rank' | 'photo' | 'matricule' | 'name' | 'note' | 'average' | 'column' | 'mention' | 'none';
    rowIndex?: number;
    noteColIndex?: number;
    coordDisplay: string;
    value: string;
  }>({
    id: '',
    type: 'none',
    rowIndex: undefined,
    coordDisplay: '',
    value: ''
  });

  // Élément réellement surligné ("souligné") par l'utilisateur (texte sélectionné dans une case ou cellule lue)
  // Tant que rien n'est surligné, les boutons B / I / U / S / Taille / Couleurs restent normaux et n'agissent pas.
  const [highlightedTarget, setHighlightedTarget] = useState<{
    cellKey: string;
    cellType: 'matricule' | 'name' | 'note' | 'rank' | 'average' | 'mention';
    elementId?: string;
    start?: number;
    end?: number;
    isDomSelection?: boolean;
  } | null>(null);

  const isFontFamilyMenuOpenRef = useRef<boolean>(false);
  useEffect(() => {
    isFontFamilyMenuOpenRef.current = isFontFamilyMenuOpen;
  }, [isFontFamilyMenuOpen]);

  // Zoom synchronisé avec Cloudflare D1 (70% par défaut)
  const [zoomPercent, setZoomPercent] = useState<number>(() => {
    const z = initialCachedSheet?.layout?.zoomPercent;
    return typeof z === 'number' && z >= 30 && z <= 200 ? Math.round(z) : 70;
  });

  // Nom de la feuille active (1 tableur complet par matière & trimestre)
  const activeSheetLabel = customSheetLabel || `${term?.name || 'Trimestre 1'} · ${subject.name}`;

  // État de sauvegarde cloud D1 + R2 (automatique + bouton manuel "Enregistrer")
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [cloudSaveStatus, setCloudSaveStatus] = useState<'loading' | 'saved' | 'saving' | 'offline' | 'error'>(() =>
    disableCloudPersistence
      ? 'saved'
      : typeof navigator !== 'undefined' && navigator.onLine === false
      ? 'offline'
      : getTeacherAuthToken()
      ? 'loading'
      : 'saved'
  );
  const [cloudSaveError, setCloudSaveError] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState<boolean>(false);
  const [hasSavedAtLeastOnce, setHasSavedAtLeastOnce] = useState<boolean>(false);

  // Refs pour auto-sauvegarde sérialisée (anti-conflit, zéro perte de frappe)
  const hasHydratedRef = useRef<boolean>(false);
  const skipNextAutoSaveRef = useRef<boolean>(true);
  const hasPendingCloudChangesRef = useRef<boolean>(false);
  const isCloudSavingRef = useRef<boolean>(false);
  const needsFollowupSaveRef = useRef<boolean>(false);
  const debounceTimerRef = useRef<number | null>(null);
  const latestPayloadRef = useRef<TeacherGradebookPayload | null>(null);

  // Référence upload photo
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);

  // Poignées externes (Astérisque et coin bas-droite)
  const [isDraggingCorner, setIsDraggingCorner] = useState(false);
  const [isDelmasAssistantOpen, setIsDelmasAssistantOpen] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [dragPreviewRows, setDragPreviewRows] = useState(0);

  // Construction du snapshot courant (toujours à jour pour l'auto-save)
  const currentPayload = useMemo<TeacherGradebookPayload>(() => ({
    noteColumnCount,
    columnMetas,
    layout: {
      noteColWidth,
      colWidthRank,
      colWidthPhoto,
      colWidthMatricule,
      colWidthName,
      colWidthAverage,
      colWidthMention,
      customNoteWidths,
      customRowHeights,
      zoomPercent,
      sortMode,
      ...(sheetMentionRules !== undefined ? { mentionRules: sheetMentionRules } : {}),
      ...(typeof sheetShowMatricule === 'boolean' ? { showMatricule: sheetShowMatricule } : {}),
      ...(typeof sheetAverageScale === 'number' ? { averageScale: sheetAverageScale } : {}),
      ...(sheetColumnOrder !== undefined ? { columnOrder: sheetColumnOrder } : {}),
    },
    styles: {
      cellColors,
      rowColors,
      cellCustomStyles,
    },
    students,
  }), [
    noteColumnCount,
    columnMetas,
    noteColWidth,
    colWidthRank,
    colWidthPhoto,
    colWidthMatricule,
    colWidthName,
    colWidthAverage,
    colWidthMention,
    customNoteWidths,
    customRowHeights,
    zoomPercent,
    sortMode,
    sheetMentionRules,
    sheetShowMatricule,
    sheetAverageScale,
    sheetColumnOrder,
    cellColors,
    rowColors,
    cellCustomStyles,
    students,
  ]);

  latestPayloadRef.current = currentPayload;

  // Moteur d'envoi cloud D1 sérialisé (file d'attente anti-course + support enregistrement manuel forcé)
  const flushCloudSave = useCallback(async (opts?: { keepalive?: boolean; force?: boolean }) => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (disableCloudPersistence) {
      hasPendingCloudChangesRef.current = false;
      setIsSaved(true);
      setCloudSaveStatus('saved');
      return;
    }
    if (!latestPayloadRef.current) return;
    if (!opts?.force && !hasPendingCloudChangesRef.current) return;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      hasPendingCloudChangesRef.current = true;
      setIsSaved(false);
      setCloudSaveStatus('offline');
      setCloudSaveError("Hors ligne — Échec de l'enregistrement : aucune connexion Internet détectée.");
      return;
    }
    if (!getTeacherAuthToken()) {
      hasPendingCloudChangesRef.current = false;
      setIsSaved(false);
      setCloudSaveStatus('error');
      setCloudSaveError('Session non connectée. Veuillez vous reconnecter.');
      return;
    }
    if (isCloudSavingRef.current || isUploadingPhotoRef.current) {
      needsFollowupSaveRef.current = true;
      return;
    }

    isCloudSavingRef.current = true;
    hasPendingCloudChangesRef.current = false;
    setCloudSaveStatus('saving');
    setCloudSaveError(null);

    try {
      const saveRes = await TeacherGradebookAPI.saveGradebook(
        subject.id,
        effectiveTermId,
        latestPayloadRef.current,
        { keepalive: opts?.keepalive }
      );
      if (saveRes?.remappedStudentIds && Object.keys(saveRes.remappedStudentIds).length > 0) {
        const remap = saveRes.remappedStudentIds;
        skipNextAutoSaveRef.current = true;
        setStudents((prev) =>
          prev.map((row) => {
            const nextId = remap[row.id];
            if (!nextId) return row;
            return {
              ...row,
              id: nextId,
              studentUid: row.studentUid || row.id,
            };
          })
        );
      }
      if (needsFollowupSaveRef.current) {
        needsFollowupSaveRef.current = false;
        hasPendingCloudChangesRef.current = true;
        isCloudSavingRef.current = false;
        await flushCloudSave(opts);
        return;
      }
      setIsSaved(true);
      setHasSavedAtLeastOnce(true);
      setCloudSaveStatus('saved');
      onGradebookSynced?.();
    } catch (err: any) {
      if (err?.isStorageLimitExceeded) {
        // Quota saturé : stopper les réessais automatiques en boucle, la modale d'augmentation s'affiche
        hasPendingCloudChangesRef.current = false;
        setIsSaved(false);
        setCloudSaveStatus('error');
        setCloudSaveError(err?.message || "Espace de stockage plein. Veuillez augmenter votre stockage.");
      } else {
        hasPendingCloudChangesRef.current = true;
        setIsSaved(false);
        if (isOfflineOrNetworkError(err)) {
          setCloudSaveStatus('offline');
          setCloudSaveError("Hors ligne — Échec de l'enregistrement. Vérifiez votre connexion Internet.");
        } else {
          setCloudSaveStatus('error');
          setCloudSaveError(err?.message || "Échec de l'enregistrement de vos données.");
        }
      }
    } finally {
      isCloudSavingRef.current = false;
    }
  }, [subject.id, effectiveTermId, onGradebookSynced]);

  const handleManualSaveGradebook = useCallback(() => {
    flushCloudSave({ force: true });
  }, [flushCloudSave]);

  // Surveillance temps réel de la connexion Internet dans le tableur
  useEffect(() => {
    const onOffline = () => {
      setCloudSaveStatus('offline');
      setCloudSaveError("Hors ligne — Échec de l'enregistrement : aucune connexion Internet détectée.");
    };
    const onOnline = () => {
      if (hasPendingCloudChangesRef.current) {
        flushCloudSave();
      } else {
        setCloudSaveStatus((prev) => (prev === 'offline' ? 'saved' : prev));
        setCloudSaveError(null);
      }
    };
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [flushCloudSave]);

  // 1. Chargement initial depuis Cloudflare D1 (source de vérité du compte utilisateur)
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    hasHydratedRef.current = false;
    skipNextAutoSaveRef.current = true;

    const loadFromCloud = async () => {
      if (disableCloudPersistence || !getTeacherAuthToken()) {
        hasHydratedRef.current = true;
        setCloudSaveStatus('saved');
        return;
      }
      setCloudSaveStatus('loading');
      setCloudSaveError(null);
      try {
        const res = await TeacherGradebookAPI.getGradebook(subject.id, effectiveTermId, controller.signal);
        if (cancelled) return;
        if (res?.classSettings) {
          setClassSettings({
            mentionRules: res.classSettings.mentionRules ?? null,
            showMatricule: Boolean(res.classSettings.showMatricule),
            averageScale:
              sanitizeAverageScale(res.classSettings.averageScale) ?? DEFAULT_AVERAGE_SCALE,
            columnOrder: res.classSettings.columnOrder ?? null,
          });
        }
        if (res && res.exists) {
          skipNextAutoSaveRef.current = true;
          const cols = Math.max(1, Number(res.noteColumnCount) || 7);
          const hydratedStudents: StudentGradeRow[] = Array.isArray(res.students) && res.students.length > 0
            ? res.students.map((s) => ({
                id: s.id || generateTeacherEntityId('std'),
                studentUid: s.studentUid || s.id,
                name: s.name || '',
                matricule: s.matricule || '',
                photoUrl: s.photoUrl,
                photoR2Key: s.photoR2Key,
                photoSizeBytes: s.photoSizeBytes,
                notes: Array.from({ length: cols }, (_, i) => s.notes?.[i] || ''),
              }))
            : Array.from({ length: 8 }, () => ({
                id: generateTeacherEntityId('std'),
                name: '',
                matricule: '',
                photoUrl: undefined,
                photoR2Key: undefined,
                notes: Array(cols).fill(''),
              }));

          while (hydratedStudents.length < 8) {
            hydratedStudents.push({
              id: generateTeacherEntityId('std'),
              name: '',
              matricule: '',
              photoUrl: undefined,
              photoR2Key: undefined,
              notes: Array(cols).fill(''),
            });
          }

          setNoteColumnCount(cols);
          setColumnMetas(res.columnMetas || {});
          if (typeof res.layout?.noteColWidth === 'number') setNoteColWidth(Math.max(96, Math.min(240, res.layout.noteColWidth)));
          if (typeof res.layout?.colWidthRank === 'number') setColWidthRank(Math.max(55, res.layout.colWidthRank));
          if (typeof res.layout?.colWidthPhoto === 'number') setColWidthPhoto(Math.max(60, res.layout.colWidthPhoto));
          if (typeof res.layout?.colWidthMatricule === 'number') setColWidthMatricule(Math.max(90, res.layout.colWidthMatricule));
          if (typeof res.layout?.colWidthName === 'number') setColWidthName(Math.max(150, res.layout.colWidthName));
          if (typeof res.layout?.colWidthAverage === 'number') setColWidthAverage(Math.max(75, res.layout.colWidthAverage));
          if (typeof res.layout?.colWidthMention === 'number') setColWidthMention(Math.max(80, res.layout.colWidthMention));
          if (res.layout?.customNoteWidths) setCustomNoteWidths(res.layout.customNoteWidths);
          if (res.layout?.customRowHeights) setCustomRowHeights(res.layout.customRowHeights);
          if (typeof res.layout?.zoomPercent === 'number' && res.layout.zoomPercent >= 30 && res.layout.zoomPercent <= 200) {
            setZoomPercent(Math.round(res.layout.zoomPercent));
          }
          if (res.layout?.sortMode === 'merit' || res.layout?.sortMode === 'alpha' || res.layout?.sortMode === 'order') {
            setSortMode(res.layout.sortMode);
          }
          setSheetMentionRules(res.layout?.mentionRules);
          setSheetShowMatricule(
            typeof res.layout?.showMatricule === 'boolean' ? res.layout.showMatricule : undefined
          );
          const loadedAvgScale = sanitizeAverageScale(res.layout?.averageScale);
          setSheetAverageScale(loadedAvgScale !== null ? loadedAvgScale : undefined);
          setSheetColumnOrder(res.layout?.columnOrder);
          setCellColors(res.styles?.cellColors || {});
          setRowColors(res.styles?.rowColors || {});
          setCellCustomStyles(res.styles?.cellCustomStyles || {});
          setStudents(hydratedStudents);

          if (effectiveUserId) {
            writeUserGradebookCache(effectiveUserId, subject.id, effectiveTermId, {
              noteColumnCount: cols,
              columnMetas: res.columnMetas || {},
              layout: {
                noteColWidth: res.layout?.noteColWidth ?? 96,
                colWidthRank: res.layout?.colWidthRank ?? 68,
                colWidthPhoto: res.layout?.colWidthPhoto ?? 76,
                colWidthMatricule: res.layout?.colWidthMatricule ?? 124,
                colWidthName: res.layout?.colWidthName ?? 280,
                colWidthAverage: res.layout?.colWidthAverage ?? 104,
                colWidthMention: res.layout?.colWidthMention ?? 108,
                customNoteWidths: res.layout?.customNoteWidths || {},
                customRowHeights: res.layout?.customRowHeights || {},
                zoomPercent:
                  typeof res.layout?.zoomPercent === 'number' && res.layout.zoomPercent >= 30 && res.layout.zoomPercent <= 200
                    ? Math.round(res.layout.zoomPercent)
                    : 70,
                sortMode:
                  res.layout?.sortMode === 'merit' || res.layout?.sortMode === 'alpha' || res.layout?.sortMode === 'order'
                    ? res.layout.sortMode
                    : 'order',
                ...(res.layout?.mentionRules !== undefined ? { mentionRules: res.layout.mentionRules } : {}),
                ...(typeof res.layout?.showMatricule === 'boolean' ? { showMatricule: res.layout.showMatricule } : {}),
                ...(loadedAvgScale !== null ? { averageScale: loadedAvgScale } : {}),
                ...(res.layout?.columnOrder !== undefined ? { columnOrder: res.layout.columnOrder } : {}),
              },
              styles: {
                cellColors: res.styles?.cellColors || {},
                rowColors: res.styles?.rowColors || {},
                cellCustomStyles: res.styles?.cellCustomStyles || {},
              },
              students: hydratedStudents,
            });
          }
        }
        hasHydratedRef.current = true;
        setIsSaved(true);
        setCloudSaveStatus('saved');
      } catch (err: any) {
        if (cancelled || err?.name === 'AbortError') return;
        hasHydratedRef.current = true;
        setCloudSaveStatus('error');
        setCloudSaveError(err?.message || 'Impossible de charger le tableur depuis le cloud');
      }
    };

    loadFromCloud();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [subject.id, effectiveTermId, effectiveUserId]);

  // 2. Auto-sauvegarde fluide (cache isolé par userId immédiat + envoi D1 groupé 650 ms)
  useEffect(() => {
    if (disableCloudPersistence) return;
    if (effectiveUserId) {
      writeUserGradebookCache(effectiveUserId, subject.id, effectiveTermId, currentPayload);
    }

    if (!hasHydratedRef.current) return;
    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    hasPendingCloudChangesRef.current = true;
    setIsSaved(false);
    setCloudSaveStatus('saving');

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      flushCloudSave();
    }, 650);
  }, [currentPayload, effectiveUserId, subject.id, effectiveTermId, flushCloudSave]);

  // 3. Flush automatique lors d'un changement d'onglet ou fermeture de page (zéro perte)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && hasPendingCloudChangesRef.current) {
        flushCloudSave({ keepalive: true });
      }
    };
    const handlePageHide = () => {
      if (hasPendingCloudChangesRef.current) {
        flushCloudSave({ keepalive: true });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
      if (hasPendingCloudChangesRef.current) {
        flushCloudSave({ keepalive: true });
      }
    };
  }, [flushCloudSave]);

  const handleSafeBack = async () => {
    if (hasPendingCloudChangesRef.current) {
      await flushCloudSave();
    }
    onBack();
  };

  // =========================================================================
  // HISTORIQUE COMPLET ANNULER / RÉTABLIR (UNDO / REDO) POUR TOUTE MODIFICATION
  // =========================================================================
  interface GradebookHistorySnapshot {
    students: StudentGradeRow[];
    noteColumnCount: number;
    columnMetas: { [idx: number]: GradebookColumnMeta };
    cellCustomStyles: { [cellKey: string]: CellCustomStyle };
    rowColors: { [studentId: string]: string };
    cellColors: { [cellKey: string]: string };
    colWidthRank: number;
    colWidthPhoto: number;
    colWidthMatricule: number;
    colWidthName: number;
    colWidthAverage: number;
    colWidthMention: number;
    noteColWidth: number;
    customNoteWidths: { [idx: number]: number };
    customRowHeights: { [rowIdx: number]: number };
  }

  const MAX_HISTORY_STEPS = 100;
  const historyRef = useRef<{
    past: GradebookHistorySnapshot[];
    present: GradebookHistorySnapshot | null;
    presentKey: string;
    future: GradebookHistorySnapshot[];
  }>({
    past: [],
    present: null,
    presentKey: '',
    future: []
  });
  const isApplyingHistoryRef = useRef<boolean>(false);
  const [historyFlags, setHistoryFlags] = useState<{ canUndo: boolean; canRedo: boolean }>({
    canUndo: false,
    canRedo: false
  });

  const applyHistorySnapshot = (snap: GradebookHistorySnapshot) => {
    isApplyingHistoryRef.current = true;
    const cloned: GradebookHistorySnapshot = JSON.parse(JSON.stringify(snap));
    setStudents(cloned.students);
    setNoteColumnCount(cloned.noteColumnCount);
    setColumnMetas(cloned.columnMetas);
    setCellCustomStyles(cloned.cellCustomStyles);
    setRowColors(cloned.rowColors);
    setCellColors(cloned.cellColors);
    setColWidthRank(cloned.colWidthRank);
    setColWidthPhoto(cloned.colWidthPhoto);
    if (typeof cloned.colWidthMatricule === 'number') {
      setColWidthMatricule(cloned.colWidthMatricule);
    }
    setColWidthName(cloned.colWidthName);
    setColWidthAverage(cloned.colWidthAverage);
    setColWidthMention(cloned.colWidthMention);
    setNoteColWidth(cloned.noteColWidth);
    setCustomNoteWidths(cloned.customNoteWidths);
    setCustomRowHeights(cloned.customRowHeights);
    setIsSaved(false);
  };

  const handleUndo = () => {
    const h = historyRef.current;
    if (h.past.length === 0 || !h.present) return;
    const previous = h.past.pop()!;
    h.future.push(h.present);
    h.present = previous;
    h.presentKey = JSON.stringify(previous);
    setHistoryFlags({
      canUndo: h.past.length > 0,
      canRedo: h.future.length > 0
    });
    applyHistorySnapshot(previous);
  };

  const handleRedo = () => {
    const h = historyRef.current;
    if (h.future.length === 0 || !h.present) return;
    const next = h.future.pop()!;
    h.past.push(h.present);
    h.present = next;
    h.presentKey = JSON.stringify(next);
    setHistoryFlags({
      canUndo: h.past.length > 0,
      canRedo: h.future.length > 0
    });
    applyHistorySnapshot(next);
  };

  // Enregistrement automatique d'un instantané à chaque modification (notes, noms, styles, couleurs, photos, colonnes, lignes, tailles)
  useEffect(() => {
    // Attendre la fin du glissement d'un trait pour n'enregistrer qu'une seule étape propre
    if (resizingLine !== null || isDraggingRight || isDraggingCorner) {
      return;
    }

    const currentSnap: GradebookHistorySnapshot = {
      students,
      noteColumnCount,
      columnMetas,
      cellCustomStyles,
      rowColors,
      cellColors,
      colWidthRank,
      colWidthPhoto,
      colWidthMatricule,
      colWidthName,
      colWidthAverage,
      colWidthMention,
      noteColWidth,
      customNoteWidths,
      customRowHeights
    };
    const currentKey = JSON.stringify(currentSnap);
    const h = historyRef.current;

    if (h.present === null) {
      h.present = JSON.parse(currentKey);
      h.presentKey = currentKey;
      return;
    }

    if (isApplyingHistoryRef.current) {
      isApplyingHistoryRef.current = false;
      h.present = JSON.parse(currentKey);
      h.presentKey = currentKey;
      return;
    }

    if (currentKey === h.presentKey) {
      return;
    }

    h.past.push(h.present);
    if (h.past.length > MAX_HISTORY_STEPS) {
      h.past.shift();
    }
    h.present = JSON.parse(currentKey);
    h.presentKey = currentKey;
    h.future = [];

    setHistoryFlags({
      canUndo: h.past.length > 0,
      canRedo: false
    });
  }, [
    students,
    noteColumnCount,
    columnMetas,
    cellCustomStyles,
    rowColors,
    cellColors,
    colWidthRank,
    colWidthPhoto,
    colWidthMatricule,
    colWidthName,
    colWidthAverage,
    colWidthMention,
    noteColWidth,
    customNoteWidths,
    customRowHeights,
    resizingLine,
    isDraggingRight,
    isDraggingCorner
  ]);

  // Synchroniser la taille du tableau de notes de chaque élève avec noteColumnCount
  useEffect(() => {
    setStudents(prev => prev.map(s => {
      if (s.notes.length === noteColumnCount) return s;
      if (s.notes.length < noteColumnCount) {
        return {
          ...s,
          notes: [...s.notes, ...Array(noteColumnCount - s.notes.length).fill('')]
        };
      }
      return {
        ...s,
        notes: s.notes.slice(0, noteColumnCount)
      };
    }));
  }, [noteColumnCount]);

  // Raccourcis clavier (Échap, Ctrl+Z Annuler, Ctrl+Y / Ctrl+Shift+Z Rétablir)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
          return;
        }
        if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          handleRedo();
          return;
        }
      }
      if (e.key === 'Escape') {
        setSelectedLine(null);
        setActiveMenuCol(null);
        setActiveMenuCell(null);
        setActiveMenuRow(null);
        setActiveMenuNameCol(false);
        setActiveMenuPhoto(null);
        setActiveColorPicker(null);
        setPreviewPhotoStudent(null);
        setBlockedNoteTarget(null);
        setIsFontFamilyMenuOpen(false);
        setIsFontSizeMenuOpen(false);
        setIsTextColorMenuOpen(false);
        setIsBgColorMenuOpen(false);
        setIsGradeAdjustMenuOpen(false);
        setHighlightedTarget(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ajuster le montant de bonus/malus via les petits boutons + et -
  const handleStepGradeAdjustAmount = (stepDelta: number) => {
    const parsed = parseFloat((gradeAdjustAmountStr || '0').replace(',', '.'));
    const currentVal = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
    const nextVal = Math.max(0, Math.round((currentVal + stepDelta + Number.EPSILON) * 100) / 100);
    setGradeAdjustAmountStr(String(nextVal));
  };

  // Appliquer un + ou - sur toutes les notes saisies OU sur une colonne de note spécifique
  const handleApplyGradeAdjustment = () => {
    const rawNum = parseFloat((gradeAdjustAmountStr || '').replace(',', '.'));
    if (!Number.isFinite(rawNum) || rawNum === 0) return;

    const delta = gradeAdjustSign === 'sub' ? -Math.abs(rawNum) : Math.abs(rawNum);
    const targetCol = Math.min(Math.max(0, gradeAdjustColIndex), Math.max(0, noteColumnCount - 1));
    let modifiedCount = 0;

    setStudents(prev => prev.map(std => {
      if (!(std.name || '').trim()) return std;
      let changed = false;
      const updatedNotes = std.notes.map((rawNote, cIdx) => {
        if (gradeAdjustMode === 'specific' && cIdx !== targetCol) {
          return rawNote;
        }
        const colDefaultMax = columnMetas[cIdx]?.maxScore || 20;
        const parsed = parseStudentNote(rawNote, colDefaultMax);
        // Ne jamais modifier les cases vides
        if (parsed.scoreNum === null || parsed.hasInvalidMax || parsed.maxScore <= 0) {
          return rawNote;
        }
        const rawUpdated = parsed.scoreNum + delta;
        const clamped = Math.min(parsed.maxScore, Math.max(0, rawUpdated));
        const rounded = Math.round((clamped + Number.EPSILON) * 100) / 100;
        changed = true;
        modifiedCount += 1;
        return formatStudentNote(String(rounded), parsed.maxScoreStr || parsed.maxScore);
      });
      return changed ? { ...std, notes: updatedNotes } : std;
    }));

    setIsSaved(false);
    const signLabel = delta > 0 ? `+${Math.abs(delta)}` : `-${Math.abs(delta)}`;
    const scopeLabel = gradeAdjustMode === 'all'
      ? 'toutes les notes'
      : `${columnMetas[targetCol]?.title || 'NOTE'} ${targetCol + 1}`;
    setGradeAdjustFeedback(
      modifiedCount > 0
        ? `${signLabel} appliqué sur ${scopeLabel} (${modifiedCount} note${modifiedCount > 1 ? 's' : ''})`
        : `Aucune note saisie à ajuster (${scopeLabel})`
    );
    setTimeout(() => setGradeAdjustFeedback(null), 3000);
  };

  // Lecture directe et fiable à 100% du surlignement réel dans le DOM (aucune désynchronisation possible)
  const readLiveHighlightedTarget = (): {
    cellKey: string;
    cellType: 'matricule' | 'name' | 'note' | 'rank' | 'average' | 'mention';
    elementId?: string;
    start?: number;
    end?: number;
    isDomSelection?: boolean;
  } | null => {
    const activeEl = document.activeElement as HTMLElement | null;

    // Cas 1 : Sélection à l'intérieur d'un champ <input> éditable (Matricule, Nom, Note, Barème, Barre fx)
    if (activeEl && activeEl.tagName === 'INPUT') {
      const inputEl = activeEl as HTMLInputElement;
      const cellKey = inputEl.getAttribute('data-cell-key');
      const cellType = inputEl.getAttribute('data-cell-type') as 'matricule' | 'name' | 'note' | 'rank' | 'average' | 'mention' | null;
      if (cellKey && (cellType === 'matricule' || cellType === 'name' || cellType === 'note')) {
        const start = inputEl.selectionStart ?? 0;
        const end = inputEl.selectionEnd ?? 0;
        if (end > start && inputEl.value.slice(start, end).length > 0) {
          return {
            cellKey,
            cellType,
            elementId: inputEl.id || undefined,
            start,
            end
          };
        }
      }
      return null;
    }

    // Cas 2 : Sélection sur une cellule texte autorisée (RANG uniquement ; MOYENNE et MENTION sont bloquées)
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) {
      const anchorNode = sel.anchorNode;
      const anchorEl = anchorNode?.nodeType === Node.TEXT_NODE
        ? anchorNode.parentElement
        : (anchorNode as HTMLElement | null);
      const cellEl = anchorEl?.closest?.('[data-cell-key]') as HTMLElement | null;
      if (cellEl) {
        const cellKey = cellEl.getAttribute('data-cell-key');
        const cellType = cellEl.getAttribute('data-cell-type') as 'matricule' | 'name' | 'note' | 'rank' | 'average' | 'mention' | null;
        if (cellKey && cellType && cellType !== 'average' && cellType !== 'mention') {
          return {
            cellKey,
            cellType,
            isDomSelection: true
          };
        }
      }
    }

    return null;
  };

  // Suivi ultra-fiable en temps réel du texte réellement surligné (selectionchange + mouseup/pointerup/keyup globaux)
  useEffect(() => {
    let rafId: number | null = null;

    const syncFromDom = () => {
      const activeEl = document.activeElement as HTMLElement | null;
      // Ne pas effacer le surlignement mémorisé si l'utilisateur tape dans la barre de recherche des polices
      if (activeEl?.getAttribute('data-font-search') === 'true') {
        return;
      }

      const live = readLiveHighlightedTarget();
      if (live) {
        setHighlightedTarget(prev => {
          if (
            prev &&
            prev.cellKey === live.cellKey &&
            prev.elementId === live.elementId &&
            prev.start === live.start &&
            prev.end === live.end &&
            prev.isDomSelection === live.isDomSelection
          ) {
            return prev;
          }
          return live;
        });
      } else if (!isFontFamilyMenuOpenRef.current) {
        setHighlightedTarget(prev => (prev === null ? prev : null));
      }
    };

    const scheduleSync = () => {
      syncFromDom();
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        syncFromDom();
      });
    };

    document.addEventListener('selectionchange', syncFromDom);
    window.addEventListener('mouseup', scheduleSync, true);
    window.addEventListener('pointerup', scheduleSync, true);
    window.addEventListener('keyup', scheduleSync, true);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('selectionchange', syncFromDom);
      window.removeEventListener('mouseup', scheduleSync, true);
      window.removeEventListener('pointerup', scheduleSync, true);
      window.removeEventListener('keyup', scheduleSync, true);
    };
  }, []);

  // Protection contre tout zoom accidentel au touchpad (Ctrl + molette / pincement) :
  // Le zoom du tableur se règle uniquement via les boutons dédiés (-, %, +) et le curseur en bas.
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Calcul automatique de la mention pédagogique selon les intervalles personnalisés (ou barème par défaut)
  const getStudentMention = (average: number | null): { label: string; badgeClass: string } => {
    const resolved = resolveMentionWithRules(average, effectiveMentionRules, effectiveAverageScale);
    if (average === null || resolved.label === '—') {
      return { label: '—', badgeClass: 'text-slate-400 font-semibold' };
    }
    if (resolved.tone === 'emerald') {
      return { label: resolved.label, badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-black' };
    }
    if (resolved.tone === 'teal') {
      return { label: resolved.label, badgeClass: 'bg-teal-100 text-teal-950 border-teal-300 font-extrabold' };
    }
    if (resolved.tone === 'sky') {
      return { label: resolved.label, badgeClass: 'bg-sky-100 text-sky-950 border-sky-300 font-extrabold' };
    }
    if (resolved.tone === 'amber') {
      return { label: resolved.label, badgeClass: 'bg-amber-100 text-amber-950 border-amber-300 font-bold' };
    }
    return { label: resolved.label, badgeClass: 'bg-rose-100 text-rose-950 border-rose-300 font-bold' };
  };

  // Calcul dynamique des moyennes (/20 pondérées par coeffEval), mentions et rangs (avec ex æquo 1e-6)
  // Si un élève a une note > noteMaximale, sa moyenne n'est pas calculée (grisée avec '...') et rang '—'
  const studentsWithStats = useMemo(() => {
    const withAverage = students.map((std, idx) => {
      const studentNotes = std.notes.slice(0, noteColumnCount);

      const parsedNotes = studentNotes.map((rawNote, cIdx) => {
        const colDefaultMax = columnMetas[cIdx]?.maxScore || 20;
        return parseStudentNote(rawNote, colDefaultMax);
      });

      const hasInvalidNote = parsedNotes.some(p => p.isInvalid);

      if (hasInvalidNote) {
        return {
          ...std,
          originalIndex: idx,
          rowNumber: idx + 1,
          average: null,
          averageFormatted: '...',
          mention: '—',
          mentionClass: 'text-slate-400 font-semibold',
          hasInvalidNote: true,
          rank: '—'
        };
      }

      // Étapes A1 & A2 via le moteur pur (ignore les notes vides, conserve 0 explicite, vérifie max > 0, pondère par coeffEval)
      const evaluations: EvaluationInput[] = parsedNotes.map((p, cIdx) => ({
        valeur: p.scoreNum,
        max: p.maxScore,
        coeffEval: columnMetas[cIdx]?.coeffEval ?? 1
      }));

      const subjectResult = calculateSubjectAverage(evaluations, {
        rejectExceedingMax: true,
        targetScale: effectiveAverageScale,
      });
      const avg = subjectResult.moyenneMatiere;
      const mentionInfo = getStudentMention(avg);

      return {
        ...std,
        originalIndex: idx,
        rowNumber: idx + 1,
        average: avg,
        averageFormatted: avg !== null ? formatAverageDisplay(avg) : '',
        mention: mentionInfo.label,
        mentionClass: mentionInfo.badgeClass,
        hasInvalidNote: false,
        rank: '—'
      };
    });

    // Calcul des rangs avec gestion rigoureuse des ex æquo (tolérance 1e-6)
    const rankMap = calculateClassRanks(
      withAverage.map(s => ({
        id: s.id,
        moyenne: s.hasInvalidNote ? null : s.average
      })),
      { tolerance: 1e-6 }
    );

    const ranked = withAverage.map(s => {
      if (s.hasInvalidNote) {
        return { ...s, rank: '—' };
      }
      const rankEntry = rankMap.get(s.id);
      return {
        ...s,
        rank: rankEntry && rankEntry.rankNumber !== null ? rankEntry.rankLabel : (s.name.trim() ? '—' : '')
      };
    });

    return sortGradebookRows(ranked, sortMode, lockedOrderIds).map((s, displayIdx) => ({
      ...s,
      rowNumber: displayIdx + 1,
    }));
  }, [students, noteColumnCount, columnMetas, sortMode, lockedOrderIds, effectiveMentionRules, effectiveAverageScale]);

  // Répertoire partagé des élèves de la classe (auto-complétion inter-matières + liaison studentUid sûre)
  const [classRoster, setClassRoster] = useState<TeacherClassRosterStudent[]>([]);
  const [rosterSuggestState, setRosterSuggestState] = useState<{
    studentId: string;
    anchorEl: HTMLElement | null;
    highlightIdx: number;
  } | null>(null);

  useEffect(() => {
    if (disableCloudPersistence || !schoolClass?.id || !getTeacherAuthToken()) return;
    let cancelled = false;
    const ctrl = new AbortController();
    TeacherGradebookAPI.getClassRoster(schoolClass.id, ctrl.signal)
      .then((res) => {
        if (!cancelled && Array.isArray(res?.students)) {
          setClassRoster(res.students);
        }
      })
      .catch(() => {
        // Silencieux si hors ligne ou annulé
      });
    return () => {
      cancelled = true;
      ctrl.abort();
    };
  }, [disableCloudPersistence, schoolClass?.id, subject.id]);

  const activeRosterSuggestions = useMemo(() => {
    if (!rosterSuggestState || classRoster.length === 0) return [];
    const targetRow = students.find((s) => s.id === rosterSuggestState.studentId);
    if (!targetRow) return [];

    const queryNorm = normalizeStudentNameKey(targetRow.name);
    const queryTokens = queryNorm ? queryNorm.split(' ').filter(Boolean) : [];
    const usedUids = new Set(
      students
        .filter((s) => s.id !== targetRow.id && (s.name || '').trim().length > 0)
        .map((s) => s.studentUid || s.id)
    );

    const matches = classRoster.filter((item) => {
      if (usedUids.has(item.studentUid)) return false;
      // Ne pas reproposer exactement l'élève déjà lié à cette même ligne si le nom est déjà identique
      if (
        targetRow.studentUid === item.studentUid &&
        normalizeStudentNameKey(item.name) === queryNorm &&
        queryNorm.length > 0
      ) {
        return false;
      }
      if (!queryNorm) {
        // Sur case vide, proposer les élèves des autres matières non encore dans cette matière
        return !item.subjectIds.includes(subject.id);
      }
      const itemNorm = normalizeStudentNameKey(item.name);
      if (itemNorm.includes(queryNorm)) return true;
      // Correspondance par mots quelle que soit l'inversion Nom/Prénom ("Jean KOU" -> "KOUASSI Jean")
      return queryTokens.length > 0 && queryTokens.every((t) => itemNorm.includes(t));
    });

    return matches.slice(0, 6);
  }, [rosterSuggestState, classRoster, students, subject.id]);

  const handleApplyRosterSuggestion = useCallback(
    (studentId: string, rosterItem: TeacherClassRosterStudent) => {
      setStudents((prev) =>
        prev.map((s) =>
          s.id === studentId
            ? {
                ...s,
                name: rosterItem.name,
                matricule: (s.matricule || '').trim() ? s.matricule : (rosterItem.matricule || ''),
                studentUid: rosterItem.studentUid,
                photoUrl: s.photoUrl || rosterItem.photoUrl,
                photoR2Key: s.photoR2Key || rosterItem.photoR2Key,
              }
            : s
        )
      );
      setActiveCellInfo((prev) =>
        prev.type === 'name' ? { ...prev, value: rosterItem.name } : prev
      );
      if (blockedNoteTarget?.studentId === studentId) {
        setBlockedNoteTarget(null);
      }
      setRosterSuggestState(null);
      setIsSaved(false);
    },
    [blockedNoteTarget]
  );

  // Mise à jour du matricule d'un élève
  const handleMatriculeChange = (studentId: string, newMatricule: string) => {
    const clean = newMatricule.slice(0, 48);
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, matricule: clean } : s))
    );
    setIsSaved(false);
  };

  // Enregistrer les intervalles de mentions (ce tableau uniquement ou toute la classe)
  const handleSaveMentionRules = useCallback(
    async (rules: CustomMentionRule[] | null, scope: SheetSettingScope) => {
      if (scope === 'class') {
        if (!disableCloudPersistence && getTeacherAuthToken()) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            mentionRules: rules,
          });
          setClassSettings(res.classSettings);
          setSheetMentionRules(undefined);
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
        } else {
          const nextSettings: ClassSheetSettings = {
            ...classSettings,
            mentionRules: rules,
          };
          setClassSettings(nextSettings);
          setSheetMentionRules(undefined);
          onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        }
        return;
      }
      setSheetMentionRules(rules);
      if (latestPayloadRef.current) {
        latestPayloadRef.current = {
          ...latestPayloadRef.current,
          layout: {
            ...latestPayloadRef.current.layout,
            mentionRules: rules,
          },
        };
      }
      hasPendingCloudChangesRef.current = true;
      setIsSaved(false);
      await flushCloudSave({ force: true });
    },
    [disableCloudPersistence, schoolClass.id, classSettings, onClassSettingsUpdated, flushCloudSave]
  );

  // Enregistrer l'affichage de la colonne Matricule (ce tableau uniquement ou toute la classe)
  const handleSaveShowMatricule = useCallback(
    async (show: boolean, scope: SheetSettingScope) => {
      if (scope === 'class') {
        if (!disableCloudPersistence && getTeacherAuthToken()) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            showMatricule: show,
          });
          setClassSettings(res.classSettings);
          setSheetShowMatricule(undefined);
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
        } else {
          const nextSettings: ClassSheetSettings = {
            ...classSettings,
            showMatricule: show,
          };
          setClassSettings(nextSettings);
          setSheetShowMatricule(undefined);
          onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        }
        return;
      }
      setSheetShowMatricule(show);
      if (latestPayloadRef.current) {
        latestPayloadRef.current = {
          ...latestPayloadRef.current,
          layout: {
            ...latestPayloadRef.current.layout,
            showMatricule: show,
          },
        };
      }
      hasPendingCloudChangesRef.current = true;
      setIsSaved(false);
      await flushCloudSave({ force: true });
    },
    [disableCloudPersistence, schoolClass.id, classSettings, onClassSettingsUpdated, flushCloudSave]
  );

  // Liste des colonnes de notes pour le sélecteur "Max des notes"
  const noteColumnOptions = useMemo<NoteColumnOption[]>(
    () =>
      Array.from({ length: noteColumnCount }, (_, i) => {
        const meta = columnMetas[i];
        const title = (meta?.title || 'NOTE').trim().toUpperCase();
        const maxScore = meta?.maxScore && meta.maxScore > 0 ? meta.maxScore : 20;
        return {
          index: i,
          label: `${title} ${i + 1}`,
          maxScore,
        };
      }),
    [noteColumnCount, columnMetas]
  );

  // Enregistrer la moyenne maximale (ce tableau uniquement ou toute la classe)
  const handleSaveAverageScale = useCallback(
    async (scale: number, scope: SheetSettingScope) => {
      const cleanScale = sanitizeAverageScale(scale);
      if (cleanScale === null) return;
      if (scope === 'class') {
        if (!disableCloudPersistence && getTeacherAuthToken()) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            averageScale: cleanScale,
          });
          setClassSettings(res.classSettings);
          setSheetAverageScale(undefined);
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
        } else {
          const nextSettings: ClassSheetSettings = {
            ...classSettings,
            averageScale: cleanScale,
          };
          setClassSettings(nextSettings);
          setSheetAverageScale(undefined);
          onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        }
        return;
      }
      setSheetAverageScale(cleanScale);
      if (latestPayloadRef.current) {
        latestPayloadRef.current = {
          ...latestPayloadRef.current,
          layout: {
            ...latestPayloadRef.current.layout,
            averageScale: cleanScale,
          },
        };
      }
      hasPendingCloudChangesRef.current = true;
      setIsSaved(false);
      await flushCloudSave({ force: true });
    },
    [disableCloudPersistence, schoolClass.id, classSettings, onClassSettingsUpdated, flushCloudSave]
  );

  // Enregistrer la disposition des colonnes (ce tableau uniquement ou toute la classe)
  const handleSaveColumnOrder = useCallback(
    async (order: GradebookColumnOrder | null, scope: SheetSettingScope) => {
      const normalized =
        order === null
          ? null
          : sanitizeGradebookColumnOrder(order, { includeTotal: false });
      if (scope === 'class') {
        if (!disableCloudPersistence && getTeacherAuthToken()) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            columnOrder: normalized,
          });
          setClassSettings(res.classSettings);
          setSheetColumnOrder(undefined);
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
        } else {
          const nextSettings: ClassSheetSettings = {
            ...classSettings,
            columnOrder: normalized,
          };
          setClassSettings(nextSettings);
          setSheetColumnOrder(undefined);
          onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        }
        return;
      }
      setSheetColumnOrder(normalized);
      if (latestPayloadRef.current) {
        latestPayloadRef.current = {
          ...latestPayloadRef.current,
          layout: {
            ...latestPayloadRef.current.layout,
            columnOrder: normalized,
          },
        };
      }
      hasPendingCloudChangesRef.current = true;
      setIsSaved(false);
      await flushCloudSave({ force: true });
    },
    [disableCloudPersistence, schoolClass.id, classSettings, onClassSettingsUpdated, flushCloudSave]
  );

  // Modifier en un coup le barème maximal de toutes les notes ou d'une note spécifique
  const handleBulkUpdateNoteMax = useCallback(
    async (input: BulkNoteMaxUpdateInput) => {
      const cleanMax = sanitizeAverageScale(input.maxScore);
      if (cleanMax === null) return;

      const targetIndices =
        input.mode === 'all'
          ? Array.from({ length: noteColumnCount }, (_, i) => i)
          : typeof input.colIndex === 'number' &&
            input.colIndex >= 0 &&
            input.colIndex < noteColumnCount
          ? [input.colIndex]
          : [];
      if (targetIndices.length === 0) return;

      const nextMetas: { [idx: number]: GradebookColumnMeta } = { ...columnMetas };
      for (const idx of targetIndices) {
        const existing = nextMetas[idx] || { maxScore: 20 };
        nextMetas[idx] = {
          ...existing,
          maxScore: cleanMax,
        };
      }

      const nextStudents: StudentGradeRow[] = students.map((s) => {
        const copyNotes = Array.from({ length: noteColumnCount }, (_, i) => s.notes[i] || '');
        for (const idx of targetIndices) {
          const prevDefaultMax = columnMetas[idx]?.maxScore || 20;
          const parsed = parseStudentNote(copyNotes[idx], prevDefaultMax);
          if (!parsed.scoreStr) {
            // Case vide : rester vide pour hériter automatiquement du nouveau max de la colonne (-/40)
            copyNotes[idx] = '';
          } else if (
            input.convertExistingScores &&
            parsed.scoreNum !== null &&
            parsed.maxScore > 0
          ) {
            const converted = Math.round(((parsed.scoreNum / parsed.maxScore) * cleanMax) * 100) / 100;
            copyNotes[idx] = formatStudentNote(String(converted), cleanMax);
          } else {
            copyNotes[idx] = formatStudentNote(parsed.scoreStr, cleanMax);
          }
        }
        return { ...s, notes: copyNotes };
      });

      setColumnMetas(nextMetas);
      setStudents(nextStudents);

      if (latestPayloadRef.current) {
        latestPayloadRef.current = {
          ...latestPayloadRef.current,
          columnMetas: nextMetas,
          students: nextStudents,
        };
      }
      hasPendingCloudChangesRef.current = true;
      setIsSaved(false);
      await flushCloudSave({ force: true });
    },
    [noteColumnCount, columnMetas, students, flushCloudSave]
  );

  // Liaison silencieuse ultra-sûre au blur UNIQUEMENT s'il existe un unique élève correspondant sans homonyme
  const handleAutoLinkUniqueRosterStudentOnBlur = useCallback(
    (studentId: string, typedName: string) => {
      const norm = normalizeStudentNameKey(typedName);
      if (!norm || classRoster.length === 0) return;
      const bag = canonicalWordBagKey(norm);

      const usedUids = new Set(
        students
          .filter((s) => s.id !== studentId && (s.name || '').trim().length > 0)
          .map((s) => s.studentUid || s.id)
      );

      const exactMatches = classRoster.filter((item) => {
        const itemNorm = normalizeStudentNameKey(item.name);
        if (itemNorm === norm) return true;
        if (bag && canonicalWordBagKey(itemNorm) === bag) return true;
        return false;
      });

      // Règle de sécurité : uniquement si 1 seul élève correspond (jamais en cas d'homonymes !)
      if (exactMatches.length !== 1) return;
      const matched = exactMatches[0];
      if (usedUids.has(matched.studentUid)) return;

      setStudents((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (s.id !== studentId) return s;
          if (
            s.studentUid === matched.studentUid &&
            (s.photoUrl || !matched.photoUrl) &&
            ((s.matricule || '').trim() || !(matched.matricule || '').trim())
          ) {
            return s;
          }
          changed = true;
          return {
            ...s,
            studentUid: matched.studentUid,
            matricule: (s.matricule || '').trim() ? s.matricule : (matched.matricule || ''),
            photoUrl: s.photoUrl || matched.photoUrl,
            photoR2Key: s.photoR2Key || matched.photoR2Key,
          };
        });
        if (changed) setIsSaved(false);
        return changed ? next : prev;
      });
    },
    [classRoster, students]
  );

  // Modification du nom d'un élève
  const handleNameChange = (studentId: string, newName: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, name: newName } : s));
    setIsSaved(false);
  };

  // Modification brute d'une note (format "score/max")
  const handleRawNoteChange = (studentId: string, noteIndex: number, newRawVal: string) => {
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const copyNotes = [...s.notes];
      copyNotes[noteIndex] = newRawVal;
      return { ...s, notes: copyNotes };
    }));
    setIsSaved(false);
  };

  // Permutation de deux colonnes avec les flèches bleues
  const handleSwapColumns = (fromIdx: number, toIdx: number) => {
    if (fromIdx < 0 || fromIdx >= noteColumnCount || toIdx < 0 || toIdx >= noteColumnCount) return;

    // Permutation des notes de tous les élèves
    setStudents(prev => prev.map(s => {
      const copy = [...s.notes];
      const temp = copy[fromIdx];
      copy[fromIdx] = copy[toIdx];
      copy[toIdx] = temp;
      return { ...s, notes: copy };
    }));

    // Permutation des métadonnées de colonnes
    setColumnMetas(prev => {
      const copy = { ...prev };
      const metaFrom = copy[fromIdx];
      const metaTo = copy[toIdx];
      if (metaFrom !== undefined) copy[toIdx] = metaFrom;
      else delete copy[toIdx];
      if (metaTo !== undefined) copy[fromIdx] = metaTo;
      else delete copy[fromIdx];
      return copy;
    });

    // Permutation des largeurs de colonnes
    setCustomNoteWidths(prev => {
      const copy = { ...prev };
      const widthFrom = copy[fromIdx];
      const widthTo = copy[toIdx];
      if (widthFrom !== undefined) copy[toIdx] = widthFrom;
      else delete copy[toIdx];
      if (widthTo !== undefined) copy[fromIdx] = widthTo;
      else delete copy[fromIdx];
      return copy;
    });

    // Le focus de déplacement suit la colonne sur sa nouvelle place
    setMovingColIndex(toIdx);
    setIsSaved(false);
  };

  // Vider toute une colonne (efface les notes saisies chez tous les élèves en conservant le barème max)
  const handleClearColumnNotes = (colIndex: number) => {
    setStudents(prev => prev.map(s => {
      const copyNotes = [...s.notes];
      const meta = columnMetas[colIndex];
      const parsed = parseStudentNote(copyNotes[colIndex], meta?.maxScore || 20);
      copyNotes[colIndex] = formatStudentNote('', parsed.maxScore);
      return { ...s, notes: copyNotes };
    }));
    setIsSaved(false);
  };

  // Ajout d'une ligne d'élève
  const handleAddStudentRow = () => {
    const newStudent: StudentGradeRow = {
      id: generateTeacherEntityId('std'),
      name: '',
      photoUrl: undefined,
      photoR2Key: undefined,
      notes: Array(noteColumnCount).fill('')
    };
    setStudents(prev => [...prev, newStudent]);
    setIsSaved(false);
  };

  // Ajout de plusieurs lignes d'élèves
  const handleAddMultipleStudentRows = (count: number) => {
    if (count <= 0) return;
    setStudents(prev => {
      const newRows: StudentGradeRow[] = Array.from({ length: count }, () => ({
        id: generateTeacherEntityId('std'),
        name: '',
        photoUrl: undefined,
        photoR2Key: undefined,
        notes: Array(noteColumnCount).fill('')
      }));
      return [...prev, ...newRows];
    });
    setIsSaved(false);
  };

  // Ajout d'une colonne de note
  const handleAddNoteColumn = () => {
    setNoteColumnCount(prev => {
      const next = prev + 1;
      setStudents(prevStudents => prevStudents.map(s => ({
        ...s,
        notes: [...s.notes, '']
      })));
      setIsSaved(false);
      return next;
    });
  };

  // Suppression d'une colonne de note avec réajustement des métadonnées
  const handleDeleteNoteColumn = (colIndex: number) => {
    if (noteColumnCount <= 1) return;
    setNoteColumnCount(prev => prev - 1);
    setStudents(prevStudents => prevStudents.map(s => {
      const updated = [...s.notes];
      updated.splice(colIndex, 1);
      return { ...s, notes: updated };
    }));

    // Réajustement des clés de columnMetas
    setColumnMetas(prev => {
      const next: { [idx: number]: GradebookColumnMeta } = {};
      Object.keys(prev).forEach(k => {
        const idx = parseInt(k, 10);
        if (idx < colIndex) {
          next[idx] = prev[idx];
        } else if (idx > colIndex) {
          next[idx - 1] = prev[idx];
        }
      });
      return next;
    });

    // Réajustement des clés de customNoteWidths
    setCustomNoteWidths(prev => {
      const next: { [idx: number]: number } = {};
      Object.keys(prev).forEach(k => {
        const idx = parseInt(k, 10);
        if (idx < colIndex) {
          next[idx] = prev[idx];
        } else if (idx > colIndex) {
          next[idx - 1] = prev[idx];
        }
      });
      return next;
    });

    if (movingColIndex === colIndex) {
      setMovingColIndex(null);
    } else if (movingColIndex !== null && movingColIndex > colIndex) {
      setMovingColIndex(movingColIndex - 1);
    }

    setActiveMenuCol(null);
    setIsSaved(false);
  };

  // Suppression d'un élève
  const handleDeleteStudentRow = (studentId: string) => {
    if (students.length <= 1) {
      setStudents([{
        id: generateTeacherEntityId('std'),
        name: '',
        photoUrl: undefined,
        photoR2Key: undefined,
        notes: Array(noteColumnCount).fill('')
      }]);
      return;
    }
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setIsSaved(false);
  };

  // Upload photo vers le dossier R2 dédié des photos de profil élèves
  const isUploadingPhotoRef = useRef<boolean>(false);
  const handleTriggerPhotoUpload = (studentId: string) => {
    setUploadingStudentId(studentId);
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetStudentId = uploadingStudentId;
    e.target.value = '';
    if (!file || !targetStudentId) return;

    // Suspendre tout auto-save pendant l'envoi R2 pour éviter toute course entre POST /photos/student et PUT /gradebook
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    isUploadingPhotoRef.current = true;
    setIsUploadingPhoto(true);
    const originalFileBytes = Math.max(0, Number(file.size) || 0);
    let prevPhotoUrl: string | undefined;
    let prevPhotoR2Key: string | undefined;
    let prevPhotoSizeBytes: number | undefined;
    try {
      const { blob, dataUrl } = await compressImageToUpload(file, 256, 0.84);

      // Mémoriser l'état précédent pour rollback immédiat si le serveur rejette l'upload (ex: quota 413)
      const existingStudent = students.find(s => s.id === targetStudentId);
      prevPhotoUrl = existingStudent?.photoUrl;
      prevPhotoR2Key = existingStudent?.photoR2Key;
      prevPhotoSizeBytes = existingStudent?.photoSizeBytes;

      // Agrandissement automatique de la case photo
      setStudents(prev => {
        const studentIndex = prev.findIndex(s => s.id === targetStudentId);
        if (studentIndex >= 0) {
          setCustomRowHeights(rowPrev => ({
            ...rowPrev,
            [studentIndex]: Math.max(rowPrev[studentIndex] || 44, 80)
          }));
        }
        return prev;
      });
      setColWidthPhoto(prev => Math.max(prev, 80));

      // Envoi binaire compressé vers Cloudflare R2 + vraie taille brute d'origine (file.size) pour facturation stockage
      if (!disableCloudPersistence && getTeacherAuthToken()) {
        const uploaded = await TeacherGradebookAPI.uploadStudentPhoto({
          subjectId: subject.id,
          termId: effectiveTermId,
          studentId: targetStudentId,
          blob,
          originalSizeBytes: originalFileBytes,
        });
        isUploadingPhotoRef.current = false;
        setStudents(prev =>
          prev.map(s =>
            s.id === targetStudentId
              ? {
                  ...s,
                  photoR2Key: uploaded.photoR2Key,
                  photoUrl: uploaded.photoUrl,
                  photoSizeBytes: uploaded.photoSizeBytes || originalFileBytes,
                }
              : s
          )
        );
      } else {
        isUploadingPhotoRef.current = false;
        setStudents(prev =>
          prev.map(s =>
            s.id === targetStudentId
              ? { ...s, photoUrl: dataUrl, photoSizeBytes: originalFileBytes }
              : s
          )
        );
      }
    } catch (err: any) {
      isUploadingPhotoRef.current = false;
      // Rollback immédiat de l'aperçu photo si l'upload R2 est refusé (ex: quota saturé 413)
      setStudents(prev =>
        prev.map(s =>
          s.id === targetStudentId
            ? { ...s, photoUrl: prevPhotoUrl, photoR2Key: prevPhotoR2Key, photoSizeBytes: prevPhotoSizeBytes }
            : s
        )
      );
      setCloudSaveStatus('error');
      setCloudSaveError(err?.message || "Échec de l'envoi de la photo élève.");
    } finally {
      isUploadingPhotoRef.current = false;
      setIsUploadingPhoto(false);
    }
  };

  // Application d'une couleur pour l'en-tête ou toute la colonne
  const handleApplyColor = (colIndex: number, mode: 'cell' | 'column', color?: string) => {
    setColumnMetas(prev => {
      const existing = prev[colIndex] || { maxScore: 20 };
      return {
        ...prev,
        [colIndex]: {
          ...existing,
          headerBgColor: mode === 'cell' ? color : existing.headerBgColor,
          columnBgColor: mode === 'column' ? color : existing.columnBgColor
        }
      };
    });
    // Retirer tout bgColor figé (ex. appliqué par Assistant Delmas) pour que le choix manuel prenne immédiatement le dessus
    setCellCustomStyles(prev => {
      let changed = false;
      const next = { ...prev };
      const stripBg = (k: string) => {
        if (next[k]?.bgColor !== undefined) {
          const { bgColor: _removed, ...rest } = next[k];
          if (Object.keys(rest).length === 0) delete next[k];
          else next[k] = rest;
          changed = true;
        }
      };
      if (mode === 'cell') {
        stripBg(`header_note_${colIndex}`);
      } else {
        stripBg(`header_note_${colIndex}`);
        for (const s of students) {
          stripBg(`${s.id}_${colIndex}`);
        }
      }
      return changed ? next : prev;
    });
    if (mode === 'column') {
      setCellColors(prev => {
        let changed = false;
        const next = { ...prev };
        for (const s of students) {
          const k = `${s.id}_${colIndex}`;
          if (next[k] !== undefined) {
            delete next[k];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }
    setIsSaved(false);
  };

  // Application d'une couleur pour une case individuelle unique
  const handleApplySingleCellColor = (studentId: string, colIndex: number, color?: string) => {
    const key = colIndex === -1 ? `${studentId}_name` : `${studentId}_${colIndex}`;
    setCellColors(prev => {
      const next = { ...prev };
      if (!color) delete next[key];
      else next[key] = color;
      return next;
    });
    // Toujours nettoyer/synchroniser cellCustomStyles[key].bgColor pour que le remplacement manuel prenne immédiatement effet
    setCellCustomStyles(prev => {
      const existing = prev[key];
      if (!existing || existing.bgColor === undefined) return prev;
      const { bgColor: _removed, ...rest } = existing;
      const next = { ...prev };
      if (Object.keys(rest).length === 0) delete next[key];
      else next[key] = rest;
      return next;
    });
    setIsSaved(false);
  };

  // Application d'une couleur pour une ligne d'élève complète
  const handleApplyRowColor = (studentId: string, color?: string) => {
    setRowColors(prev => {
      const next = { ...prev };
      if (!color) delete next[studentId];
      else next[studentId] = color;
      return next;
    });
    const rowPrefix = `${studentId}_`;
    // Retirer les couleurs de cellules individuelles (manuelles ou IA) sur cette ligne pour que la couleur de ligne choisie s'applique partout
    setCellColors(prev => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(rowPrefix)) {
          delete next[k];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setCellCustomStyles(prev => {
      let changed = false;
      const next = { ...prev };
      for (const k of Object.keys(next)) {
        if (k.startsWith(rowPrefix) && next[k]?.bgColor !== undefined) {
          const { bgColor: _removed, ...rest } = next[k];
          if (Object.keys(rest).length === 0) delete next[k];
          else next[k] = rest;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setIsSaved(false);
  };

  // Sélection d'une couleur depuis la palette unifiée
  const handleSelectPaletteColor = (colorHex: string) => {
    if (!activeColorPicker) return;
    const { mode, colIndex, studentId } = activeColorPicker;
    if (mode === 'cell' && typeof colIndex === 'number') {
      handleApplyColor(colIndex, 'cell', colorHex);
    } else if (mode === 'column' && typeof colIndex === 'number') {
      handleApplyColor(colIndex, 'column', colorHex);
    } else if (mode === 'singleCell' && studentId && typeof colIndex === 'number') {
      handleApplySingleCellColor(studentId, colIndex, colorHex);
    } else if (mode === 'row' && studentId) {
      handleApplyRowColor(studentId, colorHex);
    }
    setActiveColorPicker(null);
    setActiveMenuCol(null);
    setActiveMenuRow(null);
    setActiveMenuCell(null);
  };

  // Rendu de la grille de palette de couleurs (16 nuances nettes et bien contrastées)
  const renderPaletteGrid = (title: string) => (
    <div className="mt-1 p-2 bg-slate-50 border-t border-slate-200 rounded-b-lg">
      <div className="text-[10px] text-slate-700 font-bold mb-1.5 flex items-center justify-between">
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {PASTEL_PALETTE.map((color, idx) => (
          <button
            key={color.name || idx}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectPaletteColor(color.bg);
            }}
            style={{ backgroundColor: color.bg || '#ffffff' }}
            className="h-7 rounded-md border-2 border-slate-300 hover:border-slate-800 hover:scale-105 active:scale-95 transition flex items-center justify-center text-[10px] font-black text-slate-800 shadow-xs cursor-pointer"
            title={color.name}
          >
            {!color.bg ? (
              <span className="text-red-500 font-black text-xs">✕</span>
            ) : (
              <span className="sr-only">{color.name}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // Vider toutes les notes d'un élève
  const handleClearStudentNotes = (studentId: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, notes: Array(noteColumnCount).fill('') } : s));
    setIsSaved(false);
  };

  // Trier les élèves par ordre alphabétique
  const handleSortStudents = (direction: 'asc' | 'desc') => {
    setStudents(prev => {
      return [...prev].sort((a, b) => {
        const nameA = (a.name || '').trim().toLowerCase();
        const nameB = (b.name || '').trim().toLowerCase();
        if (!nameA) return 1;
        if (!nameB) return -1;
        return direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      });
    });
    setIsSaved(false);
  };

  // Déplacer une ligne d'élève vers le haut ou vers le bas
  const handleMoveStudentRow = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= students.length || toIndex < 0 || toIndex >= students.length) return;
    setStudents(prev => {
      const copy = [...prev];
      const [moved] = copy.splice(fromIndex, 1);
      copy.splice(toIndex, 0, moved);
      return copy;
    });
    setIsSaved(false);
  };

  // Recopier une note vers le bas pour tous les élèves suivants (dans l'ordre affiché)
  const handleFillDown = (colIndex: number, fromRowIndex: number) => {
    const sourceStudent = studentsWithStats[fromRowIndex];
    if (!sourceStudent) return;
    const sourceNote = sourceStudent.notes[colIndex] || '';
    const targetIds = new Set(studentsWithStats.slice(fromRowIndex + 1).map(s => s.id));

    setStudents(prev => prev.map((s) => {
      if (!targetIds.has(s.id)) return s;
      const copyNotes = [...s.notes];
      copyNotes[colIndex] = sourceNote;
      return { ...s, notes: copyNotes };
    }));
    setIsSaved(false);
  };

  // =========================================================================
  // GESTION DU RUBAN EXCEL : MISE EN FORME STRICTEMENT SUR ÉLÉMENT SURLIGNÉ
  // =========================================================================
  const syncInputHighlight = (
    el: HTMLInputElement | null,
    cellKey: string,
    cellType: 'matricule' | 'name' | 'note' | 'rank' | 'average' | 'mention'
  ) => {
    if (!el) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const selectedText = el.value.slice(start, end);
    if (end > start && selectedText.length > 0) {
      setHighlightedTarget({
        cellKey,
        cellType,
        elementId: el.id || undefined,
        start,
        end
      });
    } else {
      setHighlightedTarget(prev => (prev?.elementId === el.id ? null : prev));
    }
  };

  const restoreInputHighlightIfNeeded = (targetOverride?: typeof highlightedTarget) => {
    const tgt = targetOverride || highlightedTarget;
    if (tgt?.elementId && tgt.start !== undefined && tgt.end !== undefined) {
      const targetEl = document.getElementById(tgt.elementId) as HTMLInputElement | null;
      if (targetEl) {
        const start = tgt.start;
        const end = tgt.end;
        requestAnimationFrame(() => {
          targetEl.focus({ preventScroll: true });
          try {
            targetEl.setSelectionRange(start, end);
          } catch {
            // Certains types d'inputs peuvent refuser setSelectionRange
          }
        });
      }
    }
  };

  // Ne cible UNIQUEMENT que l'élément réellement surligné par l'utilisateur (jamais un trait redimensionné)
  const getTargetKeysForFormatting = (): string[] => {
    if (highlightedTarget?.cellKey) {
      return [highlightedTarget.cellKey];
    }
    return [];
  };

  // Vérification en direct dans le DOM au moment exact du clic sur un bouton du ruban
  const getLiveTargetForAction = () => {
    const live = readLiveHighlightedTarget();
    if (live) {
      setHighlightedTarget(live);
      return live;
    }
    // Exception unique : pendant que le menu déroulant des polices est ouvert avec recherche active
    if (isFontFamilyMenuOpenRef.current && highlightedTarget) {
      return highlightedTarget;
    }
    setHighlightedTarget(null);
    return null;
  };

  const updateCellStyleByKey = (cellKey: string, updates: Partial<CellCustomStyle>) => {
    setCellCustomStyles(prev => ({
      ...prev,
      [cellKey]: { ...prev[cellKey], ...updates }
    }));
    setIsSaved(false);
  };

  const getResolvedCellStyle = (key: string, fallbackAlign: 'left' | 'center' | 'right' = 'center'): React.CSSProperties => {
    const custom = cellCustomStyles[key] || {};
    const currentBold = Boolean(custom.bold);
    const currentItalic = Boolean(custom.italic);
    const currentUnderline = Boolean(custom.underline);
    const currentStrikethrough = Boolean(custom.strikethrough);
    const currentFamily = custom.fontFamily || 'Calibri';
    const currentSize = custom.fontSize || 12;
    const currentColor = custom.color || undefined;
    const currentBg = custom.bgColor || undefined;
    const currentAlign = custom.textAlign || fallbackAlign;

    let textDecoration = 'none';
    if (currentUnderline && currentStrikethrough) textDecoration = 'underline line-through';
    else if (currentUnderline) textDecoration = 'underline';
    else if (currentStrikethrough) textDecoration = 'line-through';

    return {
      fontWeight: currentBold ? '900' : '400',
      fontStyle: currentItalic ? 'italic' : 'normal',
      textDecoration,
      fontFamily: currentFamily,
      fontSize: `${currentSize}px`,
      color: currentColor,
      backgroundColor: currentBg,
      textAlign: currentAlign
    };
  };

  const getHeaderVisualStyles = (headerKey: string, defaultBg?: string) => {
    const custom = cellCustomStyles[headerKey];
    const resolved = custom ? getResolvedCellStyle(headerKey, 'center') : null;
    const containerBg = custom?.bgColor || defaultBg || undefined;
    const textStyle: React.CSSProperties | undefined = custom
      ? {
          fontWeight: custom.bold !== undefined ? (custom.bold ? '900' : '400') : undefined,
          fontStyle: custom.italic ? 'italic' : undefined,
          textDecoration:
            resolved && resolved.textDecoration && resolved.textDecoration !== 'none'
              ? resolved.textDecoration
              : undefined,
          fontFamily: custom.fontFamily || undefined,
          fontSize: custom.fontSize ? `${custom.fontSize}px` : undefined,
          color: custom.color || undefined,
          textAlign: custom.textAlign || undefined,
        }
      : undefined;
    return { containerBg, textStyle, custom };
  };

  const activeFormatKeys = getTargetKeysForFormatting();
  const hasActiveFormatTarget = activeFormatKeys.length > 0;
  const activeFormatKey = activeFormatKeys[0] || '';
  const activeCustomFormat = activeFormatKey ? cellCustomStyles[activeFormatKey] : undefined;

  // Les boutons ne s'allument en noir QUE si un élément est surligné ET que cet effet est actif sur cet élément !
  const activeIsBold = hasActiveFormatTarget ? Boolean(activeCustomFormat?.bold) : false;
  const activeIsItalic = hasActiveFormatTarget ? Boolean(activeCustomFormat?.italic) : false;
  const activeIsUnderline = hasActiveFormatTarget ? Boolean(activeCustomFormat?.underline) : false;
  const activeIsStrikethrough = hasActiveFormatTarget ? Boolean(activeCustomFormat?.strikethrough) : false;
  const activeFontFamily = hasActiveFormatTarget ? (activeCustomFormat?.fontFamily || 'Calibri') : 'Calibri';
  const activeFontSize = hasActiveFormatTarget ? (activeCustomFormat?.fontSize || 12) : 12;
  const activeTextColor = hasActiveFormatTarget ? (activeCustomFormat?.color || '#0f172a') : '#0f172a';
  const activeBgColor = hasActiveFormatTarget ? (activeCustomFormat?.bgColor || '') : '';
  // Aucun bouton d'alignement ne s'allume tout seul tant que l'utilisateur ne l'a pas choisi sur cet élément
  const activeTextAlign = hasActiveFormatTarget ? activeCustomFormat?.textAlign : undefined;

  const filteredFonts = useMemo(() => {
    if (!fontSearchQuery.trim()) return AVAILABLE_FONT_FAMILIES;
    const q = fontSearchQuery.toLowerCase().trim();
    return AVAILABLE_FONT_FAMILIES.filter(f => f.toLowerCase().includes(q));
  }, [fontSearchQuery]);

  const toggleBold = () => {
    const target = getLiveTargetForAction();
    if (!target) return;
    const current = Boolean(cellCustomStyles[target.cellKey]?.bold);
    updateCellStyleByKey(target.cellKey, { bold: !current });
  };

  const toggleItalic = () => {
    const target = getLiveTargetForAction();
    if (!target) return;
    const current = Boolean(cellCustomStyles[target.cellKey]?.italic);
    updateCellStyleByKey(target.cellKey, { italic: !current });
  };

  const toggleUnderline = () => {
    const target = getLiveTargetForAction();
    if (!target) return;
    const current = Boolean(cellCustomStyles[target.cellKey]?.underline);
    updateCellStyleByKey(target.cellKey, { underline: !current });
  };

  const toggleStrikethrough = () => {
    const target = getLiveTargetForAction();
    if (!target) return;
    const current = Boolean(cellCustomStyles[target.cellKey]?.strikethrough);
    updateCellStyleByKey(target.cellKey, { strikethrough: !current });
  };

  const applyFontSize = (size: number) => {
    const target = getLiveTargetForAction();
    if (!target) return;
    updateCellStyleByKey(target.cellKey, { fontSize: size });
  };

  const increaseFontSize = () => {
    const target = getLiveTargetForAction();
    if (!target) return;
    const currentSize = cellCustomStyles[target.cellKey]?.fontSize || 12;
    const nextSize = Math.min(48, currentSize + 1);
    updateCellStyleByKey(target.cellKey, { fontSize: nextSize });
  };

  const decreaseFontSize = () => {
    const target = getLiveTargetForAction();
    if (!target) return;
    const currentSize = cellCustomStyles[target.cellKey]?.fontSize || 12;
    const prevSize = Math.max(8, currentSize - 1);
    updateCellStyleByKey(target.cellKey, { fontSize: prevSize });
  };

  const applyFontFamily = (family: string) => {
    const target = getLiveTargetForAction();
    if (!target) return;
    updateCellStyleByKey(target.cellKey, { fontFamily: family });
    restoreInputHighlightIfNeeded(target);
  };

  const applyTextColor = (color: string) => {
    const target = getLiveTargetForAction();
    if (!target) return;
    updateCellStyleByKey(target.cellKey, { color });
  };

  const applyBgColor = (color: string) => {
    const target = getLiveTargetForAction();
    if (!target) return;
    if (!color) {
      setCellColors(prev => {
        if (prev[target.cellKey] === undefined) return prev;
        const next = { ...prev };
        delete next[target.cellKey];
        return next;
      });
      setCellCustomStyles(prev => {
        const existing = prev[target.cellKey];
        if (!existing || existing.bgColor === undefined) return prev;
        const { bgColor: _removed, ...rest } = existing;
        const next = { ...prev };
        if (Object.keys(rest).length === 0) delete next[target.cellKey];
        else next[target.cellKey] = rest;
        return next;
      });
      setIsSaved(false);
      return;
    }
    updateCellStyleByKey(target.cellKey, { bgColor: color });
  };

  const applyTextAlign = (align: 'left' | 'center' | 'right') => {
    const target = getLiveTargetForAction();
    if (!target) return;
    updateCellStyleByKey(target.cellKey, { textAlign: align });
  };

  const handleCopyEntireTable = async () => {
    try {
      const exportLeftCols = visibleColumnOrder.left.filter((k) => k !== 'photo');
      const exportRightCols = visibleColumnOrder.right.filter((k) => k !== 'photo');
      const peripheralHeader = (k: GradebookPeripheralColumnKey): string => {
        switch (k) {
          case 'rank':
            return 'RANG';
          case 'matricule':
            return 'MATRICULE';
          case 'name':
            return 'NOM & PRÉNOM';
          case 'average':
            return `MOYENNE (/${effectiveScaleLabel})`;
          case 'mention':
            return 'MENTION';
          default:
            return '';
        }
      };
      const peripheralValue = (
        k: GradebookPeripheralColumnKey,
        s: (typeof studentsWithStats)[number]
      ): string => {
        switch (k) {
          case 'rank':
            return s.rank || '-';
          case 'matricule':
            return s.matricule || '-';
          case 'name':
            return s.name || 'Élève sans nom';
          case 'average':
            return s.averageFormatted ? `${s.averageFormatted}/${effectiveScaleLabel}` : '-';
          case 'mention':
            return s.mention || '-';
          default:
            return '';
        }
      };

      const headers = [
        ...exportLeftCols.map(peripheralHeader),
        ...Array.from({ length: noteColumnCount }, (_, i) => {
          const meta = columnMetas[i] || { title: 'NOTE', maxScore: 20 };
          return `${meta.title || 'NOTE'} ${i + 1} (/${meta.maxScore})`;
        }),
        ...exportRightCols.map(peripheralHeader),
      ];

      const rows = studentsWithStats.map((s) => {
        const studentNotes = Array.from({ length: noteColumnCount }, (_, i) => {
          const noteVal = s.notes[i] || '';
          const meta = columnMetas[i] || { maxScore: 20 };
          const parsed = parseStudentNote(noteVal, meta.maxScore);
          return parsed.scoreStr ? `${parsed.scoreStr}/${parsed.maxScore}` : '-';
        });
        return [
          ...exportLeftCols.map((k) => peripheralValue(k, s)),
          ...studentNotes,
          ...exportRightCols.map((k) => peripheralValue(k, s)),
        ];
      });

      const tsvContent = [
        headers.join('\t'),
        ...rows.map((r) => r.join('\t')),
      ].join('\n');

      await navigator.clipboard.writeText(tsvContent);
      setCopiedTableSuccess(true);
      setTimeout(() => setCopiedTableSuccess(false), 2500);
    } catch (err) {
      console.error('Erreur lors de la copie du tableau :', err);
    }
  };

  const handlePasteGradebook = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;

      const lines = text.trim().split(/\r?\n/).map(line => line.split('\t'));
      if (lines.length === 0) return;

      const displayedIds = studentsWithStats.map(s => s.id);
      setStudents(prevStudents => {
        const next = [...prevStudents];
        lines.forEach((lineCells, rowOffset) => {
          const targetRowIdx = (activeCellInfo.rowIndex ?? 0) + rowOffset;
          const targetId = displayedIds[targetRowIdx];
          let actualIdx = targetId ? next.findIndex(s => s.id === targetId) : -1;
          if (actualIdx === -1) {
            actualIdx = next.length;
            next.push({
              id: generateTeacherEntityId('std'),
              name: '',
              photoUrl: undefined,
              photoR2Key: undefined,
              notes: Array(noteColumnCount).fill('')
            });
          }
          const row = { ...next[actualIdx], notes: [...next[actualIdx].notes] };

          if (activeCellInfo.type === 'matricule') {
            if (lineCells[0] !== undefined) row.matricule = lineCells[0].trim().slice(0, 48);
            if (lineCells[1] !== undefined) row.name = lineCells[1].trim();
            lineCells.slice(2).forEach((val, cIdx) => {
              if (cIdx < noteColumnCount) row.notes[cIdx] = val.trim();
            });
          } else if (activeCellInfo.type === 'name') {
            if (lineCells[0] !== undefined) row.name = lineCells[0].trim();
            lineCells.slice(1).forEach((val, cIdx) => {
              if (cIdx < noteColumnCount) row.notes[cIdx] = val.trim();
            });
          } else if (activeCellInfo.type === 'note' && activeCellInfo.noteColIndex !== undefined) {
            lineCells.forEach((val, cOffset) => {
              const tCol = (activeCellInfo.noteColIndex ?? 0) + cOffset;
              if (tCol < noteColumnCount) row.notes[tCol] = val.trim();
            });
          } else {
            if (lineCells[0] !== undefined && /[a-zA-ZÀ-ÿ]/.test(lineCells[0])) {
              row.name = lineCells[0].trim();
            }
          }

          next[actualIdx] = row;
        });
        return next;
      });
      setIsSaved(false);
    } catch (err) {
      console.warn('Impossible de coller depuis le presse-papiers :', err);
    }
  };


  // =========================================================================
  // GESTION INDIVIDUELLE DES COLONNES & ADAPTATION AUTOMATIQUE À LA TAILLE DU TEXTE
  // Chaque séparateur a son ID unique. Quand la taille de police grandit (A+),
  // la hauteur de la ligne et la largeur de la colonne s'adaptent automatiquement.
  // =========================================================================
  const justFinishedLineDragRef = useRef<boolean>(false);

  const getRowMinHeightForContent = (std: StudentGradeRow | undefined): number => {
    if (!std) return 44;
    const hasPhoto = Boolean(std.photoUrl);
    let maxFs = 12;
    const checkKey = (key: string, hasText: boolean) => {
      if (!hasText) return;
      const fs = cellCustomStyles[key]?.fontSize;
      if (fs && fs > maxFs) maxFs = fs;
    };
    checkKey(`${std.id}_matricule`, Boolean(std.matricule));
    checkKey(`${std.id}_name`, Boolean(std.name));
    checkKey(`${std.id}_rank`, true);
    checkKey(`${std.id}_avg`, true);
    checkKey(`${std.id}_mention`, true);
    for (let c = 0; c < noteColumnCount; c++) {
      checkKey(`${std.id}_${c}`, true);
    }
    const textNeededHeight = maxFs > 12 ? Math.ceil(maxFs * 1.65) + 18 : 44;
    return Math.max(hasPhoto ? 76 : 44, textNeededHeight);
  };

  const getNeededColWidthForFontSize = (colId: string): number => {
    if (colId === 'col-matricule') {
      let maxNeeded = 0;
      students.forEach(s => {
        if (!s.matricule) return;
        const fs = cellCustomStyles[`${s.id}_matricule`]?.fontSize || 12;
        if (fs > 12) {
          const len = Math.max(4, s.matricule.trim().length);
          const needed = Math.min(340, Math.ceil(len * fs * 0.68) + 32);
          if (needed > maxNeeded) maxNeeded = needed;
        }
      });
      return maxNeeded;
    }
    if (colId === 'col-name') {
      let maxNeeded = 0;
      students.forEach(s => {
        if (!s.name) return;
        const fs = cellCustomStyles[`${s.id}_name`]?.fontSize || 12;
        if (fs > 12) {
          const len = Math.max(4, s.name.trim().length);
          const needed = Math.min(720, Math.ceil(len * fs * 0.68) + 52);
          if (needed > maxNeeded) maxNeeded = needed;
        }
      });
      return maxNeeded;
    }
    if (colId.startsWith('col-note-')) {
      const idx = parseInt(colId.replace('col-note-', ''), 10);
      let maxNeeded = 0;
      students.forEach(s => {
        const fs = cellCustomStyles[`${s.id}_${idx}`]?.fontSize || 12;
        if (fs > 12) {
          const colMeta = columnMetas[idx] || { maxScore: 20 };
          const parsed = parseStudentNote(s.notes[idx] || '', colMeta.maxScore);
          const charLen = Math.max(5, (parsed.scoreStr || '-').length + 1 + String(parsed.maxScore).length);
          const needed = Math.min(360, Math.ceil(charLen * fs * 0.72) + 36);
          if (needed > maxNeeded) maxNeeded = needed;
        }
      });
      return maxNeeded;
    }
    if (colId === 'col-rank') {
      let maxNeeded = 0;
      students.forEach(s => {
        const fs = cellCustomStyles[`${s.id}_rank`]?.fontSize || 12;
        if (fs > 12) {
          const needed = Math.min(220, Math.ceil(4 * fs * 0.72) + 32);
          if (needed > maxNeeded) maxNeeded = needed;
        }
      });
      return maxNeeded;
    }
    if (colId === 'col-moyenne') {
      let maxNeeded = 0;
      students.forEach(s => {
        const fs = cellCustomStyles[`${s.id}_avg`]?.fontSize || 12;
        if (fs > 12) {
          const needed = Math.min(340, Math.ceil(9 * fs * 0.65) + 36);
          if (needed > maxNeeded) maxNeeded = needed;
        }
      });
      return maxNeeded;
    }
    if (colId === 'col-mention') {
      let maxNeeded = 0;
      students.forEach(s => {
        const fs = cellCustomStyles[`${s.id}_mention`]?.fontSize || 12;
        if (fs > 12) {
          const needed = Math.min(360, Math.ceil(11 * fs * 0.65) + 36);
          if (needed > maxNeeded) maxNeeded = needed;
        }
      });
      return maxNeeded;
    }
    return 0;
  };

  const getColWidth = (colId: string): number => {
    const fontMin = getNeededColWidthForFontSize(colId);
    if (colId === 'col-rank') return Math.max(colWidthRank, fontMin);
    if (colId === 'col-photo') return colWidthPhoto;
    if (colId === 'col-matricule') return Math.max(colWidthMatricule, 90, fontMin);
    if (colId === 'col-name') return Math.max(colWidthName, fontMin);
    if (colId.startsWith('col-note-')) {
      const idx = parseInt(colId.replace('col-note-', ''), 10);
      return Math.max(96, customNoteWidths[idx] || noteColWidth, fontMin);
    }
    if (colId === 'col-moyenne') return Math.max(colWidthAverage, fontMin);
    if (colId === 'col-mention') return Math.max(colWidthMention, fontMin);
    return 72;
  };

  const effectiveColWidthRank = getColWidth('col-rank');
  const effectiveColWidthMatricule = getColWidth('col-matricule');
  const effectiveColWidthName = getColWidth('col-name');
  const effectiveColWidthAverage = getColWidth('col-moyenne');
  const effectiveColWidthMention = getColWidth('col-mention');

  const getColMinWidth = (colId: string): number => {
    const fontMin = getNeededColWidthForFontSize(colId);
    if (colId === 'col-rank') return Math.max(60, fontMin);
    if (colId === 'col-photo') {
      const hasAnyPhoto = students.some(s => Boolean(s.photoUrl));
      return hasAnyPhoto ? 76 : 60;
    }
    if (colId === 'col-matricule') return 90;
    if (colId === 'col-name') return Math.max(getMinNameColWidth(students), fontMin);
    if (colId.startsWith('col-note-')) return Math.max(96, fontMin);
    if (colId === 'col-moyenne') return Math.max(88, fontMin);
    if (colId === 'col-mention') return Math.max(88, fontMin);
    return 60;
  };

  const setColWidth = (colId: string, w: number) => {
    if (colId === 'col-rank') setColWidthRank(w);
    else if (colId === 'col-photo') {
      const hasAnyPhoto = students.some(s => Boolean(s.photoUrl));
      const minW = hasAnyPhoto ? 76 : 60;
      setColWidthPhoto(Math.max(minW, w));
    }
    else if (colId === 'col-matricule') setColWidthMatricule(Math.max(90, w));
    else if (colId === 'col-name') setColWidthName(w);
    else if (colId.startsWith('col-note-')) {
      const idx = parseInt(colId.replace('col-note-', ''), 10);
      setCustomNoteWidths(prev => ({ ...prev, [idx]: Math.max(96, w) }));
    }
    else if (colId === 'col-moyenne') setColWidthAverage(Math.max(88, w));
    else if (colId === 'col-mention') setColWidthMention(Math.max(88, w));
  };

  // Références pour le mode tactile des traits (appui long ~1,5 s pour sélectionner sans gêner le défilement)
  const lastTouchHandleTsRef = useRef<number>(0);
  const touchHoldTimerRef = useRef<number | null>(null);
  const selectedLineRef = useRef<{ type: 'col' | 'row'; id: string } | null>(null);
  selectedLineRef.current = selectedLine;
  const zoomPercentRef = useRef<number>(zoomPercent);
  zoomPercentRef.current = zoomPercent;

  const cancelPendingTouchLineHold = () => {
    if (touchHoldTimerRef.current !== null) {
      window.clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => cancelPendingTouchLineHold();
  }, []);

  // Zoom tactile fluide à deux doigts (pinch-to-zoom) sur tout le tableur
  useTablePinchZoom(gridContainerRef, zoomPercent, setZoomPercent, {
    min: 30,
    max: 200,
    onPinchStart: cancelPendingTouchLineHold,
  });

  // Vérification stricte si un séparateur vertical est sélectionné ou en cours de glissement
  // LE SIMPLE SURVOL NE SÉLECTIONNE PLUS LA LIGNE !
  const isColActive = (colId: string): boolean => {
    if (resizingLine?.type === 'col' && resizingLine.id === colId) return true;
    if (selectedLine?.type === 'col' && selectedLine.id === colId) return true;
    return false;
  };

  // Vérification stricte si un séparateur horizontal est sélectionné ou en cours de glissement
  const isRowActive = (rowIndex: number): boolean => {
    const rowKey = `row-${rowIndex}`;
    if (resizingLine?.type === 'row' && resizingLine.id === rowKey) return true;
    if (selectedLine?.type === 'row' && selectedLine.id === rowKey) return true;
    return false;
  };

  // Lancement du redimensionnement SOURIS (ordinateur) d'une colonne verticale spécifique
  const handleStartColResize = (e: React.MouseEvent, colId: string) => {
    e.stopPropagation();

    const startX = e.clientX;
    const initialWidth = getColWidth(colId);
    const minWidth = getColMinWidth(colId);
    const zoomScale = Math.max(0.3, zoomPercentRef.current / 100);
    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoomScale;
      if (Math.abs(deltaX) > 2) {
        if (!hasMoved) {
          hasMoved = true;
          setSelectedLine({ type: 'col', id: colId });
          setResizingLine({ type: 'col', id: colId });
        }
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const newWidth = Math.max(minWidth, Math.round(initialWidth + deltaX));
        setColWidth(colId, newWidth);
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.stopPropagation();
      if (hasMoved) {
        justFinishedLineDragRef.current = true;
        // Sur ordinateur, dès qu'on relâche la ligne après avoir agrandi/réduit, la couleur bleue disparaît immédiatement
        setSelectedLine(null);
        setTimeout(() => {
          justFinishedLineDragRef.current = false;
        }, 60);
      }
      setResizingLine(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Lancement du redimensionnement SOURIS (ordinateur) d'une ligne d'élève horizontale spécifique
  const handleStartRowResize = (e: React.MouseEvent, rowIndex: number) => {
    e.stopPropagation();
    const rowKey = `row-${rowIndex}`;

    const startY = e.clientY;
    const minHeight = getRowMinHeightForContent(studentsWithStats[rowIndex]);
    const initialHeight = Math.max(customRowHeights[rowIndex] || 44, minHeight);
    const zoomScale = Math.max(0.3, zoomPercentRef.current / 100);
    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = (moveEvent.clientY - startY) / zoomScale;
      if (Math.abs(deltaY) > 2) {
        if (!hasMoved) {
          hasMoved = true;
          setSelectedLine({ type: 'row', id: rowKey });
          setResizingLine({ type: 'row', id: rowKey });
        }
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        const newHeight = Math.max(minHeight, Math.round(initialHeight + deltaY));
        setCustomRowHeights(prev => ({
          ...prev,
          [rowIndex]: newHeight
        }));
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      upEvent.stopPropagation();
      if (hasMoved) {
        justFinishedLineDragRef.current = true;
        // Sur ordinateur, dès qu'on relâche la ligne après avoir agrandi/réduit, la couleur bleue disparaît immédiatement
        setSelectedLine(null);
        setTimeout(() => {
          justFinishedLineDragRef.current = false;
        }, 60);
      }
      setResizingLine(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Mode TACTILE (téléphone / tablette) pour sélectionner & déplacer une ligne :
  // - Toucher/glisser normal = défilement normal du tableau (aucun redimensionnement involontaire)
  // - Maintenir la ligne ~1,5 s = sélectionne la ligne (change de couleur, reste sélectionnée même main levée)
  // - Une fois sélectionnée : glisser déplace la ligne ; taper dessus ou ailleurs désélectionne ; maintenir une autre ligne bascule dessus
  const handleTouchLineInteraction = (
    e: React.TouchEvent,
    lineType: 'col' | 'row',
    lineId: string,
    rowIndex?: number
  ) => {
    lastTouchHandleTsRef.current = Date.now();
    if (e.touches.length !== 1) {
      cancelPendingTouchLineHold();
      return;
    }

    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    const touchStartTs = Date.now();
    const zoomScale = Math.max(0.3, zoomPercentRef.current / 100);
    const alreadySelected =
      selectedLineRef.current?.type === lineType && selectedLineRef.current.id === lineId;
    const hadOtherSelection =
      Boolean(selectedLineRef.current) && !alreadySelected;

    let isArmed = alreadySelected;
    let activatedDuringThisTouch = false;
    let hasDragged = false;
    let dragOriginX = startX;
    let dragOriginY = startY;

    const initialColWidth = lineType === 'col' ? getColWidth(lineId) : 0;
    const minColWidth = lineType === 'col' ? getColMinWidth(lineId) : 0;
    const minRowHeight =
      lineType === 'row' && rowIndex !== undefined
        ? getRowMinHeightForContent(studentsWithStats[rowIndex])
        : 44;
    const initialRowHeight =
      lineType === 'row' && rowIndex !== undefined
        ? Math.max(customRowHeights[rowIndex] || 44, minRowHeight)
        : 44;

    if (alreadySelected) {
      e.stopPropagation();
    } else {
      cancelPendingTouchLineHold();
      touchHoldTimerRef.current = window.setTimeout(() => {
        touchHoldTimerRef.current = null;
        isArmed = true;
        activatedDuringThisTouch = true;
        dragOriginX = startX;
        dragOriginY = startY;
        setSelectedLine({ type: lineType, id: lineId });
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          try {
            navigator.vibrate(35);
          } catch {
            // Ignore vibration restriction
          }
        }
      }, 1500);
    }

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) {
        cancelPendingTouchLineHold();
        cleanup();
        return;
      }
      const cur = moveEvent.touches[0];
      const dxFromStart = cur.clientX - startX;
      const dyFromStart = cur.clientY - startY;

      if (!isArmed) {
        // Si l'utilisateur fait défiler le tableau avant les 1,5 s : annuler immédiatement l'appui long
        if (Math.hypot(dxFromStart, dyFromStart) > 10) {
          cancelPendingTouchLineHold();
          cleanup();
        }
        return;
      }

      const axisDelta =
        lineType === 'col' ? cur.clientX - dragOriginX : cur.clientY - dragOriginY;
      if (!hasDragged && Math.abs(axisDelta) > 4) {
        hasDragged = true;
        setResizingLine({ type: lineType, id: lineId });
      }
      if (hasDragged) {
        moveEvent.preventDefault();
        moveEvent.stopPropagation();
        if (lineType === 'col') {
          const nextW = Math.max(minColWidth, Math.round(initialColWidth + axisDelta / zoomScale));
          setColWidth(lineId, nextW);
        } else if (rowIndex !== undefined) {
          const nextH = Math.max(minRowHeight, Math.round(initialRowHeight + axisDelta / zoomScale));
          setCustomRowHeights((prev) => ({
            ...prev,
            [rowIndex]: nextH,
          }));
        }
      }
    };

    const cleanup = () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
    };

    const handleTouchEnd = () => {
      cancelPendingTouchLineHold();
      lastTouchHandleTsRef.current = Date.now();
      const elapsed = Date.now() - touchStartTs;

      if (hasDragged) {
        // Après avoir déplacé la ligne, elle RESTE sélectionnée sur téléphone jusqu'à ce qu'on tape ailleurs ou dessus
        setResizingLine(null);
      } else if (alreadySelected && !activatedDuringThisTouch && elapsed < 450) {
        // Taper sur la ligne déjà sélectionnée la désélectionne
        setSelectedLine(null);
      } else if (!isArmed && hadOtherSelection && elapsed < 350) {
        // Taper brièvement ailleurs (même sur un autre trait) désélectionne la ligne précédente
        setSelectedLine(null);
      }

      cleanup();
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);
  };

  // Poignée interactive discrète superposée sur la bordure droite de chaque colonne
  // AUCUNE COULEUR N'APPARAÎT AU SIMPLE SURVOL OU TOUCHER TANT QUE CE N'EST PAS SÉLECTIONNÉ !
  const renderColHandle = (colId: string) => {
    const active = isColActive(colId);
    return (
      <div
        data-interactive="true"
        data-resize-handle="true"
        onClick={(e) => {
          e.stopPropagation();
          if (Date.now() - lastTouchHandleTsRef.current < 650) return;
          if (justFinishedLineDragRef.current) return;
          setSelectedLine(prev => (prev?.type === 'col' && prev.id === colId) ? null : { type: 'col', id: colId });
        }}
        onMouseDown={(e) => {
          if (Date.now() - lastTouchHandleTsRef.current < 650) return;
          handleStartColResize(e, colId);
        }}
        onTouchStart={(e) => handleTouchLineInteraction(e, 'col', colId)}
        className={`absolute top-0 h-full cursor-col-resize z-30 select-none flex items-center justify-center bg-transparent ${
          active ? '-right-3 w-6 sm:-right-1.5 sm:w-3 touch-none' : '-right-1.5 w-3'
        } ${
          isAnyMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        title={isAnyMenuOpen ? undefined : "Glisser pour agrandir/réduire (sur téléphone : maintenir 1,5 s pour sélectionner)"}
      >
        {active && (
          <>
            <div className="w-[2.5px] sm:w-[1.5px] h-full bg-blue-500 sm:bg-sky-400 shadow-[0_0_8px_rgba(37,99,235,0.85)] sm:shadow-none pointer-events-none" />
            <div className="sm:hidden absolute top-1/2 -translate-y-1/2 w-3 h-7 rounded-full bg-blue-600 border border-white shadow-md pointer-events-none" />
          </>
        )}
      </div>
    );
  };

  // Poignée interactive discrète superposée sur la bordure inférieure de chaque ligne d'élève
  // AUCUNE COULEUR N'APPARAÎT AU SIMPLE TOUCHER TANT QUE CE N'EST PAS SÉLECTIONNÉ !
  const renderRowHandle = (rowIndex: number) => {
    const rowKey = `row-${rowIndex}`;
    const active = isRowActive(rowIndex);
    return (
      <div
        data-interactive="true"
        data-resize-handle="true"
        onClick={(e) => {
          e.stopPropagation();
          if (Date.now() - lastTouchHandleTsRef.current < 650) return;
          if (justFinishedLineDragRef.current) return;
          setSelectedLine(prev => (prev?.type === 'row' && prev.id === rowKey) ? null : { type: 'row', id: rowKey });
        }}
        onMouseDown={(e) => {
          if (Date.now() - lastTouchHandleTsRef.current < 650) return;
          handleStartRowResize(e, rowIndex);
        }}
        onTouchStart={(e) => handleTouchLineInteraction(e, 'row', rowKey, rowIndex)}
        className={`absolute left-0 w-full cursor-row-resize z-30 select-none flex items-center justify-center bg-transparent ${
          active ? '-bottom-3 h-6 sm:-bottom-1.5 sm:h-3 touch-none' : '-bottom-1.5 h-3'
        } ${
          isAnyMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        title={isAnyMenuOpen ? undefined : "Glisser pour agrandir/réduire (sur téléphone : maintenir 1,5 s pour sélectionner)"}
      >
        {active && (
          <>
            <div className="h-[2.5px] sm:h-[1.5px] w-full bg-blue-500 sm:bg-sky-400 shadow-[0_0_8px_rgba(37,99,235,0.85)] sm:shadow-none pointer-events-none" />
            <div className="sm:hidden absolute left-1/2 -translate-x-1/2 h-3 w-8 rounded-full bg-blue-600 border border-white shadow-md pointer-events-none" />
          </>
        )}
      </div>
    );
  };

  const handleStartRightResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = noteColWidth;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = (curX - clientX) * 0.42;
      const newWidth = Math.max(96, Math.min(240, Math.round(startWidth + deltaX)));
      setNoteColWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingRight(false);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
  };

  // Poignée coin inférieur droit (◢)
  const handleStartCornerResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCorner(true);
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    let rowsToAdd = 0;
    let colsToAdd = 0;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaY = curY - startY;
      const deltaX = curX - startX;

      rowsToAdd = Math.max(0, Math.floor(deltaY / 42));
      colsToAdd = Math.max(0, Math.floor(deltaX / 68));
      setDragPreviewRows(rowsToAdd);
    };

    const handleMouseUp = () => {
      setIsDraggingCorner(false);
      setDragPreviewRows(0);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);

      if (rowsToAdd > 0) {
        handleAddMultipleStudentRows(rowsToAdd);
      } else if (colsToAdd > 0) {
        for (let i = 0; i < colsToAdd; i++) {
          handleAddNoteColumn();
        }
      } else {
        handleAddStudentRow();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);
  };

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const exportLeftCols = visibleColumnOrder.left.filter((k) => k !== 'photo');
      const exportRightCols = visibleColumnOrder.right.filter((k) => k !== 'photo');
      const peripheralHeader = (k: GradebookPeripheralColumnKey): string => {
        switch (k) {
          case 'rank':
            return 'Rang';
          case 'matricule':
            return 'Matricule';
          case 'name':
            return 'Nom & Prénom';
          case 'average':
            return `Moyenne (/${effectiveScaleLabel})`;
          case 'mention':
            return 'Mention';
          default:
            return '';
        }
      };
      const peripheralValue = (
        k: GradebookPeripheralColumnKey,
        s: (typeof studentsWithStats)[number]
      ): string => {
        switch (k) {
          case 'rank':
            return s.rank;
          case 'matricule':
            return s.matricule || '';
          case 'name':
            return s.name;
          case 'average':
            return s.hasInvalidNote ? '...' : s.averageFormatted;
          case 'mention':
            return s.mention || '-';
          default:
            return '';
        }
      };

      const noteHeaders = Array.from({ length: noteColumnCount }, (_, i) => {
        const meta = columnMetas[i];
        const title = meta?.title || 'NOTE';
        const max = meta?.maxScore || 20;
        return `${title} ${i + 1} (/${max})`;
      });
      const headers = [
        ...exportLeftCols.map(peripheralHeader),
        ...noteHeaders,
        ...exportRightCols.map(peripheralHeader),
      ];
      const dataRows = studentsWithStats.map((s) => {
        const notesFormatted = s.notes.slice(0, noteColumnCount).map((n, i) => {
          const meta = columnMetas[i];
          const parsed = parseStudentNote(n, meta?.maxScore || 20);
          return parsed.scoreStr ? `${parsed.scoreStr}/${parsed.maxScore}` : '';
        });
        return [
          ...exportLeftCols.map((k) => peripheralValue(k, s)),
          ...notesFormatted,
          ...exportRightCols.map((k) => peripheralValue(k, s)),
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      const excelSheetName = activeSheetLabel.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Releve';
      XLSX.utils.book_append_sheet(wb, ws, excelSheetName);

      const classLabel = schoolClass.name?.trim()
        ? (schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase()) ? schoolClass.name.trim() : `${schoolClass.level}_${schoolClass.name.trim()}`)
        : schoolClass.level;
      const safeName = `Releve_Notes_${subject.name}_${classLabel}_${term?.name || 'T1'}.xlsx`.replace(/[^\w\d-_.]/g, '_');
      XLSX.writeFile(wb, safeName);
    } catch (err) {
      console.error('Erreur export Excel:', err);
    }
  };

  // Jeu de données structuré pour le menu Télécharger (PDF / Word / Copier)
  const buildSubjectExportDataset = (): GradebookExportDataset => {
    const exportLeftCols = visibleColumnOrder.left.filter((k) => k !== 'photo');
    const exportRightCols = visibleColumnOrder.right.filter((k) => k !== 'photo');
    const peripheralHeader = (k: GradebookPeripheralColumnKey): string => {
      switch (k) {
        case 'rank':
          return 'Rang';
        case 'matricule':
          return 'Matricule';
        case 'name':
          return 'Nom & Prénom';
        case 'average':
          return `Moyenne (/${effectiveScaleLabel})`;
        case 'mention':
          return 'Mention';
        default:
          return '';
      }
    };
    const peripheralValue = (
      k: GradebookPeripheralColumnKey,
      s: (typeof studentsWithStats)[number]
    ): string => {
      switch (k) {
        case 'rank':
          return s.rank || '-';
        case 'matricule':
          return s.matricule || '-';
        case 'name':
          return s.name || 'Élève sans nom';
        case 'average':
          return s.hasInvalidNote ? '...' : s.averageFormatted || '-';
        case 'mention':
          return s.mention || '-';
        default:
          return '';
      }
    };

    const noteHeaders = Array.from({ length: noteColumnCount }, (_, i) => {
      const meta = columnMetas[i];
      const title = meta?.title || 'NOTE';
      const max = meta?.maxScore || 20;
      return `${title} ${i + 1} (/${max})`;
    });
    const headers = [
      ...exportLeftCols.map(peripheralHeader),
      ...noteHeaders,
      ...exportRightCols.map(peripheralHeader),
    ];
    const nonEmptyRows = studentsWithStats.filter(
      (s) =>
        s.name.trim().length > 0 ||
        (s.matricule && s.matricule.trim().length > 0) ||
        s.notes.some((n) => String(n || '').trim().length > 0)
    );
    const sourceRows = nonEmptyRows.length > 0 ? nonEmptyRows : studentsWithStats;

    const rows = sourceRows.map((s) => {
      const notesFormatted = s.notes.slice(0, noteColumnCount).map((n, i) => {
        const meta = columnMetas[i];
        const parsed = parseStudentNote(n, meta?.maxScore || 20);
        return parsed.scoreStr ? `${parsed.scoreStr}/${parsed.maxScore}` : '-';
      });
      return [
        ...exportLeftCols.map((k) => peripheralValue(k, s)),
        ...notesFormatted,
        ...exportRightCols.map((k) => peripheralValue(k, s)),
      ];
    });

    const gradedStudents = sourceRows.filter((s) => s.average !== null && !s.hasInvalidNote);
    const classAvg =
      gradedStudents.length > 0
        ? gradedStudents.reduce((acc, s) => acc + (s.average ?? 0), 0) / gradedStudents.length
        : null;
    const passCount = gradedStudents.filter((s) => (s.average ?? 0) >= effectiveAverageScale / 2).length;
    const passRate = gradedStudents.length > 0 ? Math.round((passCount / gradedStudents.length) * 100) : null;

    const peripheralFooter = (k: GradebookPeripheralColumnKey): string => {
      switch (k) {
        case 'name':
          return 'MOYENNE DE LA CLASSE';
        case 'average':
          return classAvg !== null ? `${classAvg.toFixed(2)}/${effectiveScaleLabel}` : '';
        case 'mention':
          return passRate !== null ? `Réussite : ${passRate} %` : '';
        default:
          return '';
      }
    };

    const footerRow =
      classAvg !== null
        ? [
            ...exportLeftCols.map(peripheralFooter),
            ...Array(noteColumnCount).fill(''),
            ...exportRightCols.map(peripheralFooter),
          ]
        : undefined;

    const leftNameIdx = exportLeftCols.indexOf('name');
    const rightNameIdx = exportRightCols.indexOf('name');
    const dynamicNameColIndex =
      leftNameIdx >= 0
        ? leftNameIdx
        : rightNameIdx >= 0
        ? exportLeftCols.length + noteColumnCount + rightNameIdx
        : 0;

    const classLabel = schoolClass.name?.trim()
      ? schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
        ? schoolClass.name.trim()
        : `${schoolClass.level}_${schoolClass.name.trim()}`
      : schoolClass.level;

    const metaBadges: string[] = [];
    if (subject.coefficient !== undefined && subject.coefficient !== null) {
      metaBadges.push(`Coeff ${subject.coefficient}`);
    }
    metaBadges.push(`Barème /${effectiveScaleLabel}`);
    metaBadges.push(`${sourceRows.length} élève${sourceRows.length > 1 ? 's' : ''}`);
    if (passRate !== null) {
      metaBadges.push(`Taux de réussite : ${passRate} %`);
    }

    return {
      fileBaseName: `Releve_Notes_${subject.name}_${classLabel}_${term?.name || 'T1'}`,
      title: `RELEVÉ DE NOTES — ${subject.name.toUpperCase()}`,
      subtitle: [classFullDisplayName, term?.name || 'Trimestre 1', schoolYear?.label]
        .filter(Boolean)
        .join(' • '),
      schoolName: school?.name || undefined,
      metaBadges,
      headers,
      rows,
      footerRow,
      summaryNote:
        classAvg !== null
          ? `Moyenne de la classe : ${classAvg.toFixed(2)}/${effectiveScaleLabel} • ${passCount}/${gradedStudents.length} élèves au-dessus de la moyenne`
          : undefined,
      nameColumnIndex: dynamicNameColIndex,
    };
  };

  // Nombre total de colonnes et lignes d'arrière-plan
  const backgroundColCount = Math.max(68, noteColumnCount + RIGHT_EXTRA_COLS + 16);
  const backgroundRowCount = Math.max(65, students.length + 35);

  const classFullDisplayName = schoolClass.name?.trim()
    ? schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
      ? schoolClass.name.trim()
      : `${schoolClass.level} • ${schoolClass.name.trim()}`
    : schoolClass.level;

  // Pont d'action en direct pour l'Assistant Delmas (strictement ciblé sur CE tableau ouvert)
  const delmasSheetBridge: TeacherDelmasSheetBridge = {
    getContext: (): TeacherDelmasActiveContext => ({
      sheetKind: 'subject',
      yearId: schoolYear?.id,
      yearLabel: schoolYear?.label,
      schoolId: school?.id,
      schoolName: school?.name,
      classId: schoolClass.id,
      className: classFullDisplayName,
      levelName: schoolClass.level,
      termId: term?.id || effectiveTermId,
      termName: term?.name || 'Trimestre 1',
      termCoefficient: term?.coefficient ?? null,
      subjectId: subject.id,
      subjectName: subject.name,
      subjectCoefficient: subject.coefficient ?? null,
      sortMode,
      showMatricule: effectiveShowMatricule,
      averageScale: effectiveAverageScale,
      mentionRules: effectiveMentionRules,
      zoomPercent,
      activeCellCoord: activeCellInfo.coordDisplay || undefined,
      activeCellValue: activeCellInfo.value || undefined,
      noteColumns: Array.from({ length: noteColumnCount }, (_, i) => {
        const meta = columnMetas[i] || { title: 'NOTE', maxScore: 20, coeffEval: 1 };
        const title = meta.title || 'NOTE';
        return {
          index: i,
          colNumber: i + 1,
          title,
          label: `${title} ${i + 1}`,
          maxScore: meta.maxScore || 20,
          coeffEval: meta.coeffEval ?? 1,
        };
      }),
      students: studentsWithStats.map((s, idx) => ({
        rowIndex: idx + 1,
        id: s.id,
        name: s.name || '',
        matricule: s.matricule || '',
        notes: Array.from({ length: noteColumnCount }, (_, c) => {
          const meta = columnMetas[c] || { maxScore: 20 };
          const parsed = parseStudentNote(s.notes[c] || '', meta.maxScore);
          return parsed.scoreStr ? `${parsed.scoreStr}/${parsed.maxScore}` : '';
        }),
        averageFormatted: s.averageFormatted || '',
        averageNumber: s.average,
        rank: s.rank || '',
        mention: s.mention || '',
      })),
    }),

    executeActions: async (
      actions: TeacherDelmasAction[],
      workspaceSnapshot?: TeacherDelmasWorkspaceSnapshot | null
    ): Promise<string[]> => {
      const summaries: string[] = [];
      if (!Array.isArray(actions) || actions.length === 0) return summaries;

      let workingStudents = [...students.map((s) => ({ ...s, notes: [...s.notes] }))];
      let workingColCount = noteColumnCount;
      let workingColMetas: { [idx: number]: GradebookColumnMeta } = { ...columnMetas };
      let workingCellStyles: { [key: string]: CellCustomStyle } = { ...cellCustomStyles };
      let workingCellColors: { [key: string]: string } = { ...cellColors };
      let workingRowColors: { [rowId: string]: string } = { ...rowColors };
      let workingColWidthRank = colWidthRank;
      let workingColWidthPhoto = colWidthPhoto;
      let workingColWidthMatricule = colWidthMatricule;
      let workingColWidthName = colWidthName;
      let workingNoteColWidth = noteColWidth;
      let workingCustomNoteWidths: { [index: number]: number } = { ...customNoteWidths };
      let workingColWidthAverage = colWidthAverage;
      let workingColWidthMention = colWidthMention;
      let workingCustomRowHeights: { [index: number]: number } = { ...customRowHeights };
      let studentsMutated = false;
      let colsMutated = false;
      let stylesMutated = false;
      let cellColorsMutated = false;
      let rowColorsMutated = false;
      let layoutMutated = false;

      const swapWorkingNoteColumns = (idxA: number, idxB: number) => {
        if (
          idxA < 0 ||
          idxA >= workingColCount ||
          idxB < 0 ||
          idxB >= workingColCount ||
          idxA === idxB
        ) {
          return;
        }
        workingStudents = workingStudents.map((s) => {
          const copyNotes = [...s.notes];
          while (copyNotes.length < workingColCount) copyNotes.push('');
          const tmp = copyNotes[idxA];
          copyNotes[idxA] = copyNotes[idxB];
          copyNotes[idxB] = tmp;
          return { ...s, notes: copyNotes };
        });
        const metaA = workingColMetas[idxA];
        const metaB = workingColMetas[idxB];
        if (metaB !== undefined) workingColMetas[idxA] = metaB;
        else delete workingColMetas[idxA];
        if (metaA !== undefined) workingColMetas[idxB] = metaA;
        else delete workingColMetas[idxB];

        const wA = workingCustomNoteWidths[idxA];
        const wB = workingCustomNoteWidths[idxB];
        if (wB !== undefined) workingCustomNoteWidths[idxA] = wB;
        else delete workingCustomNoteWidths[idxA];
        if (wA !== undefined) workingCustomNoteWidths[idxB] = wA;
        else delete workingCustomNoteWidths[idxB];

        const hdrKeyA = `header_note_${idxA}`;
        const hdrKeyB = `header_note_${idxB}`;
        const hdrStA = workingCellStyles[hdrKeyA];
        const hdrStB = workingCellStyles[hdrKeyB];
        if (hdrStB !== undefined) workingCellStyles[hdrKeyA] = hdrStB;
        else delete workingCellStyles[hdrKeyA];
        if (hdrStA !== undefined) workingCellStyles[hdrKeyB] = hdrStA;
        else delete workingCellStyles[hdrKeyB];

        for (const s of workingStudents) {
          const kA = `${s.id}_${idxA}`;
          const kB = `${s.id}_${idxB}`;
          const stA = workingCellStyles[kA];
          const stB = workingCellStyles[kB];
          if (stB !== undefined) workingCellStyles[kA] = stB;
          else delete workingCellStyles[kA];
          if (stA !== undefined) workingCellStyles[kB] = stA;
          else delete workingCellStyles[kB];

          const cA = workingCellColors[kA];
          const cB = workingCellColors[kB];
          if (cB !== undefined) workingCellColors[kA] = cB;
          else delete workingCellColors[kA];
          if (cA !== undefined) workingCellColors[kB] = cA;
          else delete workingCellColors[kB];
        }
        studentsMutated = true;
        colsMutated = true;
        stylesMutated = true;
        cellColorsMutated = true;
        layoutMutated = true;
      };

      const isRowEmpty = (r: StudentGradeRow) =>
        !(r.name || '').trim() &&
        !(r.matricule || '').trim() &&
        !r.notes.some((n) => parseStudentNote(n, 20).scoreStr.length > 0);

      const normalizeIncomingNotes = (
        rawNotes: any,
        baseNotes: string[]
      ): string[] => {
        const out = Array.from({ length: workingColCount }, (_, i) => baseNotes[i] || '');
        if (Array.isArray(rawNotes)) {
          rawNotes.forEach((val, idx) => {
            if (idx >= workingColCount) {
              workingColCount = idx + 1;
              colsMutated = true;
            }
            if (val !== undefined && val !== null && String(val).trim() !== '' && String(val).trim() !== '-') {
              const maxS = workingColMetas[idx]?.maxScore || 20;
              const rawStr = String(val).trim();
              if (rawStr.includes('/')) {
                const [sc, mx] = rawStr.split('/');
                const cleanSc = sanitizeDecimalInput(sc);
                const cleanMx = Number(mx) > 0 ? Number(mx) : maxS;
                out[idx] = formatStudentNote(cleanSc, cleanMx);
              } else {
                out[idx] = formatStudentNote(sanitizeDecimalInput(rawStr), maxS);
              }
            }
          });
        } else if (rawNotes && typeof rawNotes === 'object') {
          for (const [k, val] of Object.entries(rawNotes)) {
            const numMatch = String(k).match(/(\d+)/);
            const colIdx = numMatch ? Math.max(0, parseInt(numMatch[1], 10) - 1) : -1;
            if (colIdx >= 0 && colIdx < 30) {
              if (colIdx >= workingColCount) {
                workingColCount = colIdx + 1;
                colsMutated = true;
              }
              const maxS = workingColMetas[colIdx]?.maxScore || 20;
              const rawStr = val !== undefined && val !== null ? String(val).trim() : '';
              if (!rawStr || rawStr === '-') {
                out[colIdx] = '';
              } else if (rawStr.includes('/')) {
                const [sc, mx] = rawStr.split('/');
                out[colIdx] = formatStudentNote(
                  sanitizeDecimalInput(sc),
                  Number(mx) > 0 ? Number(mx) : maxS
                );
              } else {
                out[colIdx] = formatStudentNote(sanitizeDecimalInput(rawStr), maxS);
              }
            }
          }
        }
        while (out.length < workingColCount) out.push('');
        return out;
      };

      let pendingAutoShowMatricule = false;
      let explicitMatriculeToggleSeen = false;

      for (const action of actions) {
        if (!action || typeof action !== 'object') continue;

        switch (action.type) {
          case 'add_students': {
            const incoming = Array.isArray(action.students) ? action.students : [];
            if (incoming.length === 0) break;
            let added = 0;
            const collectedMats: string[] = [];
            for (const item of incoming) {
              if (!item || typeof item !== 'object') continue;
              const cleanName = String(item.name || '').trim();
              const cleanMat = String(item.matricule || '').trim().slice(0, 48);
              const normalizedNotes = normalizeIncomingNotes(
                item.notes,
                Array(workingColCount).fill('')
              );
              const hasAnyNote = normalizedNotes.some((n) => n.trim().length > 0);
              if (!cleanName && !cleanMat && !hasAnyNote) continue;
              if (cleanMat) collectedMats.push(cleanMat);
              const emptyIdx = workingStudents.findIndex(isRowEmpty);
              if (emptyIdx >= 0) {
                const target = workingStudents[emptyIdx];
                workingStudents[emptyIdx] = {
                  ...target,
                  name: cleanName,
                  matricule: cleanMat || target.matricule || '',
                  notes: normalizeIncomingNotes(item.notes, target.notes),
                };
              } else {
                workingStudents.push({
                  id: generateTeacherEntityId('std'),
                  name: cleanName,
                  matricule: cleanMat,
                  notes: normalizedNotes,
                });
              }
              added++;
            }
            if (added > 0) {
              studentsMutated = true;
              if (hasRealExplicitMatriculeBatch(collectedMats) && !effectiveShowMatricule) {
                pendingAutoShowMatricule = true;
              }
              summaries.push(`✓ ${added} élève(s) ajouté(s) dans ${subject.name}`);
            }
            break;
          }

          case 'update_students': {
            const updates = Array.isArray(action.updates)
              ? action.updates
              : Array.isArray(action.students)
              ? action.students
              : [action];
            let updatedCount = 0;
            const collectedMats: string[] = [];
            const displayedOrderIds = studentsWithStats.map((s) => s.id);

            for (const u of updates) {
              if (!u || typeof u !== 'object') continue;
              let targetIdx = -1;

              // 1. Correspondance exacte par ID
              if (u.studentId) {
                targetIdx = workingStudents.findIndex((s) => s.id === String(u.studentId));
              }
              // 2. Correspondance par nom (prioritaire sur rowIndex pour éviter tout décalage)
              const searchName = String(u.matchName || u.name || '').trim();
              if (targetIdx === -1 && searchName) {
                const normSearch = normalizeStudentNameKey(searchName);
                const bagSearch = canonicalWordBagKey(normSearch);
                targetIdx = workingStudents.findIndex((s) => {
                  const sn = normalizeStudentNameKey(s.name || '');
                  return Boolean(sn) && (sn === normSearch || (bagSearch && canonicalWordBagKey(sn) === bagSearch));
                });
                if (targetIdx === -1) {
                  targetIdx = workingStudents.findIndex((s) => {
                    const sn = normalizeStudentNameKey(s.name || '');
                    return Boolean(sn) && (sn.includes(normSearch) || normSearch.includes(sn));
                  });
                }
              }
              // 3. Repli par numéro de ligne uniquement si aucun nom n'a été fourni ou trouvé
              if (targetIdx === -1 && !searchName && typeof u.rowIndex === 'number' && u.rowIndex >= 1) {
                const dispId = displayedOrderIds[u.rowIndex - 1];
                if (dispId) {
                  targetIdx = workingStudents.findIndex((s) => s.id === dispId);
                } else if (u.rowIndex - 1 < workingStudents.length) {
                  targetIdx = u.rowIndex - 1;
                }
              }

              if (targetIdx === -1 && (u.newName || searchName)) {
                const emptyIdx = workingStudents.findIndex(isRowEmpty);
                const cleanMat = String(u.matricule || '').trim().slice(0, 48);
                if (cleanMat) collectedMats.push(cleanMat);
                if (emptyIdx >= 0) {
                  workingStudents[emptyIdx] = {
                    ...workingStudents[emptyIdx],
                    name: String(u.newName || searchName).trim(),
                    matricule: cleanMat || workingStudents[emptyIdx].matricule || '',
                    notes: normalizeIncomingNotes(u.notes, workingStudents[emptyIdx].notes),
                  };
                } else {
                  workingStudents.push({
                    id: generateTeacherEntityId('std'),
                    name: String(u.newName || searchName).trim(),
                    matricule: cleanMat,
                    notes: normalizeIncomingNotes(u.notes, Array(workingColCount).fill('')),
                  });
                }
                updatedCount++;
                continue;
              }

              if (targetIdx >= 0) {
                const cur = workingStudents[targetIdx];
                const cleanMat =
                  u.matricule !== undefined
                    ? String(u.matricule).trim().slice(0, 48)
                    : cur.matricule || '';
                if (typeof u.matricule === 'string' && u.matricule.trim()) {
                  collectedMats.push(u.matricule.trim());
                }
                workingStudents[targetIdx] = {
                  ...cur,
                  name:
                    typeof u.newName === 'string' && u.newName.trim()
                      ? u.newName.trim()
                      : cur.name,
                  matricule: cleanMat,
                  notes:
                    u.notes !== undefined
                      ? normalizeIncomingNotes(u.notes, cur.notes)
                      : cur.notes,
                };
                updatedCount++;
              }
            }

            if (updatedCount > 0) {
              studentsMutated = true;
              if (hasRealExplicitMatriculeBatch(collectedMats) && !effectiveShowMatricule) {
                pendingAutoShowMatricule = true;
              }
              summaries.push(`✓ ${updatedCount} élève(s) mis à jour dans ${subject.name}`);
            }
            break;
          }

          case 'set_students': {
            const list = Array.isArray(action.students) ? action.students : [];
            if (list.length === 0) break;
            const collectedMats: string[] = [];
            workingStudents = list.map((item: any) => {
              const cleanMat = String(item?.matricule || '').trim().slice(0, 48);
              if (cleanMat) collectedMats.push(cleanMat);
              return {
                id: generateTeacherEntityId('std'),
                name: String(item?.name || '').trim(),
                matricule: cleanMat,
                notes: normalizeIncomingNotes(
                  item?.notes,
                  Array(workingColCount).fill('')
                ),
              };
            });
            studentsMutated = true;
            if (hasRealExplicitMatriculeBatch(collectedMats) && !effectiveShowMatricule) {
              pendingAutoShowMatricule = true;
            }
            summaries.push(
              `✓ Liste de ${workingStudents.length} élève(s) appliquée dans ${subject.name}`
            );
            break;
          }

          case 'remove_students': {
            const namesToRemove = Array.isArray(action.names)
              ? action.names.map((n: any) => normalizeStudentNameKey(String(n)))
              : [];
            const rowsToRemove = new Set<number>(
              Array.isArray(action.rowIndices)
                ? action.rowIndices.map((r: any) => Number(r))
                : []
            );
            const displayedIds = studentsWithStats.map((s) => s.id);
            const idsFromRowIndices = new Set<string>();
            rowsToRemove.forEach((rNum) => {
              if (rNum >= 1 && displayedIds[rNum - 1]) {
                idsFromRowIndices.add(displayedIds[rNum - 1]);
              }
            });

            const beforeLen = workingStudents.length;
            workingStudents = workingStudents.filter((s) => {
              if (action.removeEmpty && isRowEmpty(s)) return false;
              if (idsFromRowIndices.has(s.id)) return false;
              if (namesToRemove.length > 0) {
                const sn = normalizeStudentNameKey(s.name || '');
                if (sn && namesToRemove.some((target: string) => target && (sn === target || sn.includes(target)))) {
                  return false;
                }
              }
              return true;
            });

            if (workingStudents.length === 0) {
              workingStudents = [
                {
                  id: generateTeacherEntityId('std'),
                  name: '',
                  matricule: '',
                  notes: Array(workingColCount).fill(''),
                },
              ];
            }
            if (workingStudents.length !== beforeLen) {
              studentsMutated = true;
              summaries.push(
                `✓ ${Math.max(1, beforeLen - workingStudents.length)} ligne(s) supprimée(s)`
              );
            }
            break;
          }

          case 'clear_all': {
            if (!disableCloudPersistence && getTeacherAuthToken()) {
              for (const s of workingStudents) {
                if (s.photoR2Key) {
                  TeacherGradebookAPI.deleteStudentPhoto({
                    subjectId: subject.id,
                    termId: effectiveTermId,
                    studentId: s.id,
                    photoR2Key: s.photoR2Key,
                  }).catch(() => {});
                }
              }
            }
            const blankRowCount = Math.max(8, Math.min(workingStudents.length, 12));
            workingStudents = Array.from({ length: blankRowCount }, () => ({
              id: generateTeacherEntityId('std'),
              name: '',
              matricule: '',
              photoUrl: undefined,
              photoR2Key: undefined,
              photoSizeBytes: undefined,
              notes: Array(workingColCount).fill(''),
            }));
            workingCellStyles = {};
            workingCellColors = {};
            workingRowColors = {};
            Object.keys(workingColMetas).forEach((k) => {
              const idx = parseInt(k, 10);
              const meta = workingColMetas[idx];
              if (meta && (meta.headerBgColor || meta.columnBgColor)) {
                const { headerBgColor: _h, columnBgColor: _c, ...rest } = meta;
                workingColMetas[idx] = rest;
                colsMutated = true;
              }
            });
            studentsMutated = true;
            stylesMutated = true;
            cellColorsMutated = true;
            rowColorsMutated = true;
            summaries.push(`✓ Tableau ${subject.name} entièrement vidé`);
            break;
          }

          case 'clear_names':
          case 'clear_matricules':
          case 'clear_photos': {
            const hasTargetedStudent = Boolean(
              (typeof action.studentName === 'string' && action.studentName.trim()) ||
                (Array.isArray(action.studentNames) && action.studentNames.length > 0) ||
                action.rowIndex !== undefined ||
                (Array.isArray(action.rowIndices) && action.rowIndices.length > 0)
            );
            const displayList = studentsMutated ? workingStudents : studentsWithStats;
            const targetIds = new Set<string>();
            if (hasTargetedStudent) {
              const nameTargets: string[] = [];
              if (typeof action.studentName === 'string' && action.studentName.trim()) {
                nameTargets.push(
                  normalizeStudentNameKey(action.studentName.replace(/\([^)]*\)/g, ' ').trim())
                );
              }
              if (Array.isArray(action.studentNames)) {
                action.studentNames.forEach((n: unknown) => {
                  const clean = normalizeStudentNameKey(String(n || '').replace(/\([^)]*\)/g, ' ').trim());
                  if (clean) nameTargets.push(clean);
                });
              }
              const rowTargets = new Set<number>();
              if (typeof action.rowIndex === 'number' && action.rowIndex >= 1) {
                rowTargets.add(Math.round(action.rowIndex) - 1);
              }
              if (Array.isArray(action.rowIndices)) {
                action.rowIndices.forEach((r: unknown) => {
                  if (Number(r) >= 1) rowTargets.add(Math.round(Number(r)) - 1);
                });
              }
              displayList.forEach((s, idx) => {
                const sn = normalizeStudentNameKey(s.name || '');
                const matchName =
                  nameTargets.length > 0 &&
                  Boolean(sn) &&
                  nameTargets.some(
                    (t) =>
                      sn === t ||
                      sn.includes(t) ||
                      t.includes(sn) ||
                      (/^(?:le\s+|la\s+)?(?:1er|1ere|premier|premiere|major)$/.test(t) && idx === 0)
                  );
                if (matchName || rowTargets.has(idx)) {
                  targetIds.add(s.id);
                }
              });
            }

            let touched = 0;
            workingStudents = workingStudents.map((s) => {
              if (hasTargetedStudent && !targetIds.has(s.id)) return s;
              if (action.type === 'clear_names') {
                if ((s.name || '').trim().length > 0) touched++;
                return { ...s, name: '' };
              }
              if (action.type === 'clear_matricules') {
                if ((s.matricule || '').trim().length > 0) touched++;
                return { ...s, matricule: '' };
              }
              // clear_photos
              if (s.photoUrl || s.photoR2Key) {
                touched++;
                if (s.photoR2Key && !disableCloudPersistence && getTeacherAuthToken()) {
                  TeacherGradebookAPI.deleteStudentPhoto({
                    subjectId: subject.id,
                    termId: effectiveTermId,
                    studentId: s.id,
                    photoR2Key: s.photoR2Key,
                  }).catch(() => {});
                }
              }
              return {
                ...s,
                photoUrl: undefined,
                photoR2Key: undefined,
                photoSizeBytes: undefined,
              };
            });

            studentsMutated = true;
            if (action.type === 'clear_names') {
              summaries.push(
                hasTargetedStudent
                  ? `✓ Nom effacé (${touched || 1} ligne)`
                  : `✓ Tous les noms de ${subject.name} ont été effacés`
              );
            } else if (action.type === 'clear_matricules') {
              summaries.push(
                hasTargetedStudent
                  ? `✓ Matricule effacé (${touched || 1} ligne)`
                  : `✓ Tous les matricules de ${subject.name} ont été effacés`
              );
            } else {
              summaries.push(
                hasTargetedStudent
                  ? `✓ Photo de profil effacée (${touched || 1} ligne)`
                  : `✓ Toutes les photos de profil de ${subject.name} ont été effacées`
              );
            }
            break;
          }

          case 'clear_notes': {
            const isSpec =
              action.mode === 'specific' &&
              (action.colNumber !== undefined || action.colIndex !== undefined);
            const specIdx =
              action.colNumber !== undefined
                ? Number(action.colNumber) - 1
                : Number(action.colIndex);

            const hasTargetedStudent = Boolean(
              (typeof action.studentName === 'string' && action.studentName.trim()) ||
                (Array.isArray(action.studentNames) && action.studentNames.length > 0) ||
                action.rowIndex !== undefined ||
                (Array.isArray(action.rowIndices) && action.rowIndices.length > 0)
            );
            const targetIds = new Set<string>();
            if (hasTargetedStudent) {
              const displayList = studentsMutated ? workingStudents : studentsWithStats;
              const nameTargets: string[] = [];
              if (typeof action.studentName === 'string' && action.studentName.trim()) {
                nameTargets.push(
                  normalizeStudentNameKey(action.studentName.replace(/\([^)]*\)/g, ' ').trim())
                );
              }
              if (Array.isArray(action.studentNames)) {
                action.studentNames.forEach((n: unknown) => {
                  const clean = normalizeStudentNameKey(String(n || '').replace(/\([^)]*\)/g, ' ').trim());
                  if (clean) nameTargets.push(clean);
                });
              }
              const rowTargets = new Set<number>();
              if (typeof action.rowIndex === 'number' && action.rowIndex >= 1) {
                rowTargets.add(Math.round(action.rowIndex) - 1);
              }
              if (Array.isArray(action.rowIndices)) {
                action.rowIndices.forEach((r: unknown) => {
                  if (Number(r) >= 1) rowTargets.add(Math.round(Number(r)) - 1);
                });
              }
              displayList.forEach((s, idx) => {
                const sn = normalizeStudentNameKey(s.name || '');
                const matchName =
                  nameTargets.length > 0 &&
                  Boolean(sn) &&
                  nameTargets.some(
                    (t) =>
                      sn === t ||
                      sn.includes(t) ||
                      t.includes(sn) ||
                      (/^(?:le\s+|la\s+)?(?:1er|1ere|premier|premiere|major)$/.test(t) && idx === 0)
                  );
                if (matchName || rowTargets.has(idx)) {
                  targetIds.add(s.id);
                }
              });
            }

            workingStudents = workingStudents.map((s) => {
              if (hasTargetedStudent && !targetIds.has(s.id)) return s;
              const copyNotes = [...s.notes];
              if (isSpec && specIdx >= 0 && specIdx < workingColCount) {
                copyNotes[specIdx] = '';
              } else {
                for (let i = 0; i < workingColCount; i++) copyNotes[i] = '';
              }
              return { ...s, notes: copyNotes };
            });
            studentsMutated = true;
            summaries.push(
              isSpec
                ? hasTargetedStudent
                  ? `✓ Note ${specIdx + 1} effacée pour la sélection`
                  : `✓ Notes de la colonne ${specIdx + 1} effacées`
                : hasTargetedStudent
                ? `✓ Notes et moyenne effacées pour la sélection`
                : `✓ Toutes les notes et moyennes de ${subject.name} ont été effacées`
            );
            break;
          }

          case 'add_note_column': {
            const count = Math.min(15, Math.max(1, Number(action.count) || 1));
            const title = String(action.title || 'NOTE').trim().toUpperCase().slice(0, 24) || 'NOTE';
            const maxScore = sanitizeAverageScale(action.maxScore) || 20;
            const coeffEval =
              Number(action.coeffEval) > 0 ? Math.round(Number(action.coeffEval) * 100) / 100 : 1;

            for (let c = 0; c < count; c++) {
              const newIdx = workingColCount;
              workingColCount += 1;
              workingColMetas[newIdx] = { title, maxScore, coeffEval };
              workingStudents = workingStudents.map((s) => ({
                ...s,
                notes: [...s.notes, ''],
              }));
            }
            colsMutated = true;
            studentsMutated = true;
            summaries.push(
              `✓ ${count} colonne(s) « ${title} » (/${maxScore}) ajoutée(s)`
            );
            break;
          }

          case 'update_note_column': {
            const colIdx =
              action.colNumber !== undefined
                ? Number(action.colNumber) - 1
                : Number(action.colIndex) || 0;
            if (colIdx >= 0 && colIdx < workingColCount) {
              const prevMeta = workingColMetas[colIdx] || {
                title: 'NOTE',
                maxScore: 20,
                coeffEval: 1,
              };
              const nextTitle =
                typeof action.title === 'string' && action.title.trim()
                  ? action.title.trim().toUpperCase().slice(0, 24)
                  : prevMeta.title || 'NOTE';
              const nextMax =
                sanitizeAverageScale(action.maxScore) || prevMeta.maxScore || 20;
              const nextCoeff =
                action.coeffEval !== undefined && Number(action.coeffEval) > 0
                  ? Math.round(Number(action.coeffEval) * 100) / 100
                  : prevMeta.coeffEval ?? 1;

              workingColMetas[colIdx] = {
                ...prevMeta,
                title: nextTitle,
                maxScore: nextMax,
                coeffEval: nextCoeff,
              };
              workingStudents = workingStudents.map((s) => {
                const copyNotes = [...s.notes];
                const parsed = parseStudentNote(
                  copyNotes[colIdx] || '',
                  prevMeta.maxScore || 20
                );
                if (parsed.scoreStr) {
                  copyNotes[colIdx] = formatStudentNote(parsed.scoreStr, nextMax);
                }
                return { ...s, notes: copyNotes };
              });
              colsMutated = true;
              studentsMutated = true;
              summaries.push(
                `✓ Colonne ${nextTitle} ${colIdx + 1} configurée (/${nextMax}, coeff ${nextCoeff})`
              );
            }
            break;
          }

          case 'delete_note_column': {
            const colIdx =
              action.colNumber !== undefined
                ? Number(action.colNumber) - 1
                : Number(action.colIndex) || 0;
            if (workingColCount > 1 && colIdx >= 0 && colIdx < workingColCount) {
              workingColCount -= 1;
              workingStudents = workingStudents.map((s) => {
                const copy = [...s.notes];
                copy.splice(colIdx, 1);
                return { ...s, notes: copy };
              });
              const nextMetas: { [idx: number]: GradebookColumnMeta } = {};
              Object.keys(workingColMetas).forEach((k) => {
                const idx = parseInt(k, 10);
                if (idx < colIdx) nextMetas[idx] = workingColMetas[idx];
                else if (idx > colIdx) nextMetas[idx - 1] = workingColMetas[idx];
              });
              workingColMetas = nextMetas;
              colsMutated = true;
              studentsMutated = true;
              summaries.push(`✓ Colonne de note ${colIdx + 1} supprimée`);
            }
            break;
          }

          case 'swap_note_columns': {
            const idx1 =
              action.colNumber1 !== undefined
                ? Number(action.colNumber1) - 1
                : Number(action.colIndex1) || 0;
            const idx2 =
              action.colNumber2 !== undefined
                ? Number(action.colNumber2) - 1
                : Number(action.colIndex2) || 0;
            if (
              idx1 >= 0 &&
              idx1 < workingColCount &&
              idx2 >= 0 &&
              idx2 < workingColCount &&
              idx1 !== idx2
            ) {
              swapWorkingNoteColumns(idx1, idx2);
              summaries.push(`✓ Colonnes ${idx1 + 1} et ${idx2 + 1} permutées`);
            }
            break;
          }

          case 'move_note_column': {
            const fromIdx =
              action.fromColNumber !== undefined
                ? Number(action.fromColNumber) - 1
                : action.colNumber !== undefined
                ? Number(action.colNumber) - 1
                : -1;
            if (fromIdx >= 0 && fromIdx < workingColCount) {
              let toIdx = fromIdx;
              if (action.toColNumber !== undefined) {
                toIdx = Math.max(0, Math.min(workingColCount - 1, Number(action.toColNumber) - 1));
              } else if (action.direction === 'left') {
                const steps = Math.max(1, Math.round(Number(action.steps) || 1));
                toIdx = Math.max(0, fromIdx - steps);
              } else if (action.direction === 'right') {
                const steps = Math.max(1, Math.round(Number(action.steps) || 1));
                toIdx = Math.min(workingColCount - 1, fromIdx + steps);
              }
              if (toIdx !== fromIdx) {
                if (fromIdx < toIdx) {
                  for (let cur = fromIdx; cur < toIdx; cur++) {
                    swapWorkingNoteColumns(cur, cur + 1);
                  }
                } else {
                  for (let cur = fromIdx; cur > toIdx; cur--) {
                    swapWorkingNoteColumns(cur, cur - 1);
                  }
                }
                summaries.push(`✓ Colonne ${fromIdx + 1} déplacée en position ${toIdx + 1}`);
              }
            }
            break;
          }

          case 'fill_note_column': {
            const colIdx =
              action.colNumber !== undefined
                ? Number(action.colNumber) - 1
                : action.colIndex !== undefined
                ? Number(action.colIndex)
                : 0;
            if (colIdx >= 0 && colIdx < workingColCount) {
              const rawVal = String(action.value ?? '').trim();
              const onlyEmpty = Boolean(action.onlyEmpty);
              const maxS = workingColMetas[colIdx]?.maxScore || 20;
              let formatted = '';
              if (rawVal && rawVal !== '-') {
                if (rawVal.includes('/')) {
                  const [sc, mx] = rawVal.split('/');
                  formatted = formatStudentNote(
                    sanitizeDecimalInput(sc),
                    Number(mx) > 0 ? Number(mx) : maxS
                  );
                } else {
                  formatted = formatStudentNote(sanitizeDecimalInput(rawVal), maxS);
                }
              }
              let filledCount = 0;
              workingStudents = workingStudents.map((s) => {
                if (!(s.name || '').trim()) return s;
                const copyNotes = [...s.notes];
                while (copyNotes.length < workingColCount) copyNotes.push('');
                if (onlyEmpty && parseStudentNote(copyNotes[colIdx] || '', maxS).scoreStr.length > 0) {
                  return s;
                }
                copyNotes[colIdx] = formatted;
                filledCount++;
                return { ...s, notes: copyNotes };
              });
              if (filledCount > 0) {
                studentsMutated = true;
                summaries.push(
                  `✓ Colonne ${colIdx + 1} remplie (${formatted || 'vidée'}) pour ${filledCount} élève(s)`
                );
              }
            }
            break;
          }

          case 'move_student': {
            const displayedIds = studentsWithStats.map((s) => s.id);
            let srcIdx = -1;
            const searchName = String(action.studentName || action.name || '').trim();
            if (searchName) {
              const normSearch = normalizeStudentNameKey(searchName);
              const bagSearch = canonicalWordBagKey(normSearch);
              srcIdx = workingStudents.findIndex((s) => {
                const sn = normalizeStudentNameKey(s.name || '');
                return Boolean(sn) && (sn === normSearch || (bagSearch && canonicalWordBagKey(sn) === bagSearch));
              });
              if (srcIdx === -1) {
                srcIdx = workingStudents.findIndex((s) => {
                  const sn = normalizeStudentNameKey(s.name || '');
                  return Boolean(sn) && (sn.includes(normSearch) || normSearch.includes(sn));
                });
              }
            }
            if (srcIdx === -1 && typeof action.rowIndex === 'number' && action.rowIndex >= 1) {
              const dispId = displayedIds[action.rowIndex - 1];
              if (dispId) srcIdx = workingStudents.findIndex((s) => s.id === dispId);
              else if (action.rowIndex - 1 < workingStudents.length) srcIdx = action.rowIndex - 1;
            }
            if (srcIdx >= 0 && srcIdx < workingStudents.length) {
              let destIdx = srcIdx;
              if (typeof action.toRowIndex === 'number' && action.toRowIndex >= 1) {
                destIdx = Math.max(0, Math.min(workingStudents.length - 1, Math.round(action.toRowIndex) - 1));
              } else if (action.direction === 'up') {
                const steps = Math.max(1, Math.round(Number(action.steps) || 1));
                destIdx = Math.max(0, srcIdx - steps);
              } else if (action.direction === 'down') {
                const steps = Math.max(1, Math.round(Number(action.steps) || 1));
                destIdx = Math.min(workingStudents.length - 1, srcIdx + steps);
              }
              if (destIdx !== srcIdx) {
                const [moved] = workingStudents.splice(srcIdx, 1);
                workingStudents.splice(destIdx, 0, moved);
                setLockedOrderIds(null);
                setSortMode('order');
                studentsMutated = true;
                summaries.push(
                  `✓ Élève « ${moved.name || `#${srcIdx + 1}`} » déplacé à la ligne ${destIdx + 1}`
                );
              }
            }
            break;
          }

          case 'adjust_grades': {
            const rawDelta =
              action.delta !== undefined
                ? Number(action.delta)
                : action.sign === 'sub'
                ? -Math.abs(Number(action.amount) || 0)
                : Math.abs(Number(action.amount) || 0);
            if (!Number.isFinite(rawDelta) || rawDelta === 0) break;

            const isSpec =
              action.mode === 'specific' &&
              (action.colNumber !== undefined || action.colIndex !== undefined);
            const specIdx =
              action.colNumber !== undefined
                ? Number(action.colNumber) - 1
                : Number(action.colIndex) || 0;

            const targetCols = isSpec
              ? [specIdx]
              : Array.from({ length: workingColCount }, (_, i) => i);

            let touchedCells = 0;
            workingStudents = workingStudents.map((s) => {
              const copyNotes = [...s.notes];
              for (const cIdx of targetCols) {
                if (cIdx < 0 || cIdx >= workingColCount) continue;
                const colMeta = workingColMetas[cIdx] || { maxScore: 20 };
                const parsed = parseStudentNote(copyNotes[cIdx] || '', colMeta.maxScore);
                if (parsed.scoreNum === null || parsed.scoreStr === '') continue;
                const nextVal = Math.max(
                  0,
                  Math.min(
                    parsed.maxScore,
                    Math.round((parsed.scoreNum + rawDelta) * 100) / 100
                  )
                );
                copyNotes[cIdx] = formatStudentNote(String(nextVal), parsed.maxScore);
                touchedCells++;
              }
              return { ...s, notes: copyNotes };
            });

            if (touchedCells > 0) {
              studentsMutated = true;
              const signStr = rawDelta > 0 ? `+${rawDelta}` : `${rawDelta}`;
              summaries.push(
                `✓ Ajustement ${signStr} pt appliqué sur ${touchedCells} note(s)`
              );
            }
            break;
          }

          case 'set_sort_mode': {
            const rawMode = String(action.sortMode || action.mode || 'order');
            if (rawMode === 'alpha_desc') {
              workingStudents = [...workingStudents].sort((a, b) => {
                const an = (a.name || '').trim();
                const bn = (b.name || '').trim();
                if (!an && !bn) return 0;
                if (!an) return 1;
                if (!bn) return -1;
                return bn.localeCompare(an, 'fr', { sensitivity: 'base' });
              });
              studentsMutated = true;
              setLockedOrderIds(null);
              setSortMode('order');
              setIsSaved(false);
              summaries.push(`✓ Classement : Ordre alphabétique inversé (Z → A)`);
              break;
            }
            const mode: GradebookSortMode =
              rawMode === 'merit'
                ? 'merit'
                : rawMode === 'alpha'
                ? 'alpha'
                : 'order';
            setLockedOrderIds(null);
            setSortMode(mode);
            setIsSaved(false);
            summaries.push(
              `✓ Classement : ${
                mode === 'merit'
                  ? 'Ordre de mérite (1er → dernier)'
                  : mode === 'alpha'
                  ? 'Ordre alphabétique (A → Z)'
                  : 'Ordre initial'
              }`
            );
            break;
          }

          case 'set_show_matricule': {
            const show = action.show !== undefined ? Boolean(action.show) : true;
            const scope: SheetSettingScope =
              action.scope === 'class' ? 'class' : 'sheet';
            explicitMatriculeToggleSeen = true;
            await handleSaveShowMatricule(show, scope);
            summaries.push(
              `✓ Colonne Matricule ${show ? 'affichée' : 'masquée'} (${
                scope === 'class' ? 'toute la classe' : 'ce tableau'
              })`
            );
            break;
          }

          case 'set_average_scale': {
            const cleanScale = sanitizeAverageScale(action.scale);
            if (cleanScale !== null) {
              const scope: SheetSettingScope =
                action.scope === 'class' ? 'class' : 'sheet';
              await handleSaveAverageScale(cleanScale, scope);
              summaries.push(
                `✓ Moyenne ramenée sur /${cleanScale} (${
                  scope === 'class' ? 'toute la classe' : 'ce tableau'
                })`
              );
            }
            break;
          }

          case 'set_column_order': {
            const resolvedOrder = resolveColumnOrderFromDelmasAction(
              action,
              effectiveColumnOrder,
              { includeTotal: false }
            );
            if (resolvedOrder !== undefined) {
              const scope: SheetSettingScope =
                action.scope === 'class' ? 'class' : 'sheet';
              await handleSaveColumnOrder(resolvedOrder, scope);
              summaries.push(
                resolvedOrder === null
                  ? `✓ Disposition des colonnes réinitialisée par défaut (${
                      scope === 'class' ? 'toute la classe' : 'ce tableau'
                    })`
                  : `✓ Disposition des colonnes mise à jour (${
                      scope === 'class' ? 'toute la classe' : 'ce tableau'
                    })`
              );
            }
            break;
          }

          case 'bulk_update_note_max': {
            const cleanMax = sanitizeAverageScale(action.maxScore);
            if (cleanMax !== null) {
              const isSpec = action.mode === 'specific';
              const colIdx =
                action.colNumber !== undefined
                  ? Number(action.colNumber) - 1
                  : Number(action.colIndex) || 0;
              const targetIndices = isSpec
                ? [colIdx]
                : Array.from({ length: workingColCount }, (_, i) => i);

              for (const idx of targetIndices) {
                if (idx < 0 || idx >= workingColCount) continue;
                const prevMeta = workingColMetas[idx] || { maxScore: 20 };
                workingColMetas[idx] = { ...prevMeta, maxScore: cleanMax };
              }

              workingStudents = workingStudents.map((s) => {
                const copyNotes = Array.from(
                  { length: workingColCount },
                  (_, i) => s.notes[i] || ''
                );
                for (const idx of targetIndices) {
                  if (idx < 0 || idx >= workingColCount) continue;
                  const prevDefaultMax = columnMetas[idx]?.maxScore || 20;
                  const parsed = parseStudentNote(copyNotes[idx], prevDefaultMax);
                  if (!parsed.scoreStr) {
                    copyNotes[idx] = '';
                  } else if (
                    action.convertExisting &&
                    parsed.scoreNum !== null &&
                    parsed.maxScore > 0
                  ) {
                    const converted =
                      Math.round(((parsed.scoreNum / parsed.maxScore) * cleanMax) * 100) /
                      100;
                    copyNotes[idx] = formatStudentNote(String(converted), cleanMax);
                  } else {
                    copyNotes[idx] = formatStudentNote(parsed.scoreStr, cleanMax);
                  }
                }
                return { ...s, notes: copyNotes };
              });
              colsMutated = true;
              studentsMutated = true;
              summaries.push(
                isSpec
                  ? `✓ Barème de la Note ${colIdx + 1} mis sur /${cleanMax}`
                  : `✓ Barème de toutes les notes mis sur /${cleanMax}`
              );
            }
            break;
          }

          case 'set_mention_rules': {
            const rawRules = Array.isArray(action.rules) ? action.rules : [];
            if (rawRules.length > 0) {
              const cleanRules: CustomMentionRule[] = rawRules
                .map((r: any) => ({
                  min: Math.max(0, Number(r.min) || 0),
                  label: String(r.label || '').trim().slice(0, 48),
                  scale: effectiveAverageScale,
                }))
                .filter((r: CustomMentionRule) => r.label.length > 0);
              if (cleanRules.length > 0) {
                const scope: SheetSettingScope =
                  action.scope === 'class' ? 'class' : 'sheet';
                await handleSaveMentionRules(cleanRules, scope);
                summaries.push(
                  `✓ Intervalles de mentions personnalisés appliqués (${
                    scope === 'class' ? 'toute la classe' : 'ce tableau'
                  })`
                );
              }
            }
            break;
          }

          case 'format_cells': {
            const st = action.style || {};
            const stylePatch: Partial<CellCustomStyle> = {};
            if (typeof st.bold === 'boolean') stylePatch.bold = st.bold;
            if (typeof st.italic === 'boolean') stylePatch.italic = st.italic;
            if (typeof st.underline === 'boolean') stylePatch.underline = st.underline;
            if (typeof st.strikethrough === 'boolean')
              stylePatch.strikethrough = st.strikethrough;
            if (st.textColor !== undefined || st.color !== undefined) {
              const rawC = String(st.textColor ?? st.color ?? '');
              stylePatch.color = rawC;
            }
            if (st.bgColor !== undefined) stylePatch.bgColor = String(st.bgColor);
            if (st.fontFamily) stylePatch.fontFamily = String(st.fontFamily);
            if (Number(st.fontSize) >= 8)
              stylePatch.fontSize = Math.min(48, Math.round(Number(st.fontSize)));
            if (
              st.textAlign === 'left' ||
              st.textAlign === 'center' ||
              st.textAlign === 'right'
            ) {
              stylePatch.textAlign = st.textAlign;
            }
            const fontSizeDelta =
              typeof st.fontSizeDelta === 'number' &&
              Number.isFinite(st.fontSizeDelta) &&
              st.fontSizeDelta !== 0
                ? Math.max(-24, Math.min(24, Math.round(st.fontSizeDelta)))
                : 0;

            let touchedCells = 0;

            const applyStylePatchToKey = (
              k: string,
              defaultFs = 12,
              singleCellParentStdId?: string
            ) => {
              const prev = workingCellStyles[k] || {};
              const next: CellCustomStyle = { ...prev, ...stylePatch };
              if (fontSizeDelta !== 0 && stylePatch.fontSize === undefined) {
                const baseFs = typeof prev.fontSize === 'number' ? prev.fontSize : defaultFs;
                next.fontSize = Math.min(48, Math.max(8, baseFs + fontSizeDelta));
              }
              if (stylePatch.color === '') {
                delete next.color;
              }
              if (stylePatch.bgColor === '') {
                if (singleCellParentStdId && workingRowColors[singleCellParentStdId]) {
                  // La ligne entière a une couleur : forcer blanc sur cette cellule précise pour qu'elle perde réellement la couleur !
                  next.bgColor = '#ffffff';
                } else {
                  delete next.bgColor;
                }
                if (workingCellColors[k] !== undefined) {
                  delete workingCellColors[k];
                  cellColorsMutated = true;
                }
              }
              workingCellStyles[k] = next;
              touchedCells++;
            };

            const resolvedNoteIndices: number[] = [];
            if (Array.isArray(action.colNumbers) && action.colNumbers.length > 0) {
              for (const n of action.colNumbers) {
                const idx = Number(n) - 1;
                if (idx >= 0 && idx < workingColCount && !resolvedNoteIndices.includes(idx)) {
                  resolvedNoteIndices.push(idx);
                }
              }
            } else if (action.colNumber !== undefined) {
              const idx = Number(action.colNumber) - 1;
              if (idx >= 0 && idx < workingColCount) resolvedNoteIndices.push(idx);
            } else if (action.colIndex !== undefined) {
              const idx = Number(action.colIndex);
              if (idx >= 0 && idx < workingColCount) resolvedNoteIndices.push(idx);
            }

            const applyToHeaders = (onlyCol?: string) => {
              const headerKeys: string[] = [];
              if (!onlyCol || onlyCol === 'all') {
                headerKeys.push(
                  'header_rank',
                  'header_photo',
                  'header_matricule',
                  'header_name',
                  'header_avg',
                  'header_mention'
                );
                for (let c = 0; c < workingColCount; c++) headerKeys.push(`header_note_${c}`);
              } else if (onlyCol === 'rank') headerKeys.push('header_rank');
              else if (onlyCol === 'photo') headerKeys.push('header_photo');
              else if (onlyCol === 'matricule') headerKeys.push('header_matricule');
              else if (onlyCol === 'name') headerKeys.push('header_name');
              else if (onlyCol === 'average') headerKeys.push('header_avg');
              else if (onlyCol === 'mention') headerKeys.push('header_mention');
              else if (onlyCol === 'all_notes') {
                for (let c = 0; c < workingColCount; c++) headerKeys.push(`header_note_${c}`);
              } else if (onlyCol === 'note') {
                const cols =
                  resolvedNoteIndices.length > 0
                    ? resolvedNoteIndices
                    : Array.from({ length: workingColCount }, (_, c) => c);
                cols.forEach((c) => headerKeys.push(`header_note_${c}`));
              }

              for (const hk of headerKeys) {
                applyStylePatchToKey(hk, 13);
                if (hk.startsWith('header_note_') && stylePatch.bgColor !== undefined) {
                  const cIdx = parseInt(hk.replace('header_note_', ''), 10);
                  if (!Number.isNaN(cIdx) && cIdx >= 0 && cIdx < workingColCount) {
                    const prevMeta = workingColMetas[cIdx] || { maxScore: 20 };
                    workingColMetas[cIdx] = {
                      ...prevMeta,
                      headerBgColor: stylePatch.bgColor || undefined,
                    };
                    colsMutated = true;
                  }
                }
              }
            };

            const applyToStudentRow = (stdId: string, onlyCol?: string) => {
              const isFullRow = !onlyCol || onlyCol === 'all';
              const keys: string[] = [];
              if (isFullRow) {
                keys.push(
                  `${stdId}_rank`,
                  `${stdId}_photo`,
                  `${stdId}_matricule`,
                  `${stdId}_name`,
                  `${stdId}_avg`,
                  `${stdId}_mention`
                );
                for (let c = 0; c < workingColCount; c++) keys.push(`${stdId}_${c}`);
                if (stylePatch.bgColor !== undefined) {
                  if (stylePatch.bgColor === '') {
                    if (workingRowColors[stdId] !== undefined) {
                      delete workingRowColors[stdId];
                      rowColorsMutated = true;
                    }
                  } else {
                    workingRowColors[stdId] = stylePatch.bgColor;
                    rowColorsMutated = true;
                  }
                }
              } else if (onlyCol === 'name') keys.push(`${stdId}_name`);
              else if (onlyCol === 'matricule') keys.push(`${stdId}_matricule`);
              else if (onlyCol === 'average') keys.push(`${stdId}_avg`);
              else if (onlyCol === 'mention') keys.push(`${stdId}_mention`);
              else if (onlyCol === 'rank') keys.push(`${stdId}_rank`);
              else if (onlyCol === 'photo') keys.push(`${stdId}_photo`);
              else if (onlyCol === 'all_notes') {
                for (let c = 0; c < workingColCount; c++) keys.push(`${stdId}_${c}`);
              } else if (onlyCol === 'note') {
                const cols =
                  resolvedNoteIndices.length > 0
                    ? resolvedNoteIndices
                    : Array.from({ length: workingColCount }, (_, c) => c);
                cols.forEach((c) => keys.push(`${stdId}_${c}`));
              }

              for (const k of keys) {
                applyStylePatchToKey(k, 12, isFullRow ? undefined : stdId);
              }
            };

            const evaluatedRows =
              studentsMutated || colsMutated
                ? workingStudents.map((s) => {
                    const parsedScores: (number | null)[] = [];
                    const evals: EvaluationInput[] = Array.from(
                      { length: workingColCount },
                      (_, c) => {
                        const meta = workingColMetas[c] || { maxScore: 20, coeffEval: 1 };
                        const parsed = parseStudentNote(s.notes[c] || '', meta.maxScore);
                        parsedScores.push(parsed.scoreNum);
                        return {
                          valeur: parsed.scoreNum,
                          max: parsed.maxScore || meta.maxScore || 20,
                          coeffEval: meta.coeffEval ?? 1,
                        };
                      }
                    );
                    const res = calculateSubjectAverage(evals, {
                      targetScale: effectiveAverageScale,
                    });
                    return {
                      id: s.id,
                      name: s.name || '',
                      average: res.moyenneMatiere,
                      mention: getStudentMention(res.moyenneMatiere).label,
                      parsedScores,
                    };
                  })
                : studentsWithStats.map((s) => ({
                    id: s.id,
                    name: s.name || '',
                    average: s.average,
                    mention: s.mention || '',
                    parsedScores: Array.from({ length: workingColCount }, (_, c) => {
                      const meta = workingColMetas[c] || { maxScore: 20 };
                      return parseStudentNote(s.notes[c] || '', meta.maxScore).scoreNum;
                    }),
                  }));

            const rankedByAverage = [...evaluatedRows]
              .filter((r) => r.average !== null)
              .sort((a, b) => (b.average ?? -Infinity) - (a.average ?? -Infinity));

            const resolveStudentIdsFromAction = (actObj: any): Set<string> => {
              const matched = new Set<string>();
              const rawNames: string[] = [];
              if (typeof actObj.studentName === 'string' && actObj.studentName.trim()) {
                rawNames.push(actObj.studentName.trim());
              }
              if (Array.isArray(actObj.studentNames)) {
                for (const n of actObj.studentNames) {
                  if (String(n || '').trim()) rawNames.push(String(n).trim());
                }
              }
              const cleanedTargets = rawNames
                .map((rawN) =>
                  normalizeStudentNameKey(rawN.replace(/\([^)]*\)/g, ' ').trim())
                )
                .filter(Boolean);

              const rowTargets = new Set<number>();
              if (typeof actObj.rowIndex === 'number' && actObj.rowIndex >= 1) {
                rowTargets.add(Math.round(actObj.rowIndex) - 1);
              }
              if (Array.isArray(actObj.rowIndices)) {
                for (const r of actObj.rowIndices) {
                  if (Number(r) >= 1) rowTargets.add(Math.round(Number(r)) - 1);
                }
              }

              // Support des désignations ordinales ("premier", "1er", "2e", "dernier")
              for (const t of cleanedTargets) {
                if (/^(?:le\s+|la\s+)?(?:1er|1ere|premier|premiere|major)$/.test(t)) {
                  if (rankedByAverage[0]) matched.add(rankedByAverage[0].id);
                  else if (evaluatedRows[0]) matched.add(evaluatedRows[0].id);
                } else if (/^(?:le\s+|la\s+)?(?:2e|2eme|deuxieme|second|seconde)$/.test(t)) {
                  if (rankedByAverage[1]) matched.add(rankedByAverage[1].id);
                  else if (evaluatedRows[1]) matched.add(evaluatedRows[1].id);
                } else if (/^(?:le\s+|la\s+)?(?:3e|3eme|troisieme)$/.test(t)) {
                  if (rankedByAverage[2]) matched.add(rankedByAverage[2].id);
                  else if (evaluatedRows[2]) matched.add(evaluatedRows[2].id);
                } else if (/^(?:le\s+|la\s+)?(?:dernier|derniere)$/.test(t)) {
                  const last = rankedByAverage[rankedByAverage.length - 1];
                  if (last) matched.add(last.id);
                }
              }

              evaluatedRows.forEach((s, i) => {
                const sn = normalizeStudentNameKey(s.name);
                const matchesName =
                  cleanedTargets.length > 0 &&
                  Boolean(sn) &&
                  cleanedTargets.some(
                    (t) =>
                      sn === t ||
                      sn.includes(t) ||
                      t.includes(sn) ||
                      (canonicalWordBagKey(t) && canonicalWordBagKey(sn) === canonicalWordBagKey(t))
                  );
                if (matchesName || rowTargets.has(i)) {
                  matched.add(s.id);
                }
              });
              return matched;
            };

            if (action.target === 'header') {
              applyToHeaders(action.column);
            } else if (action.target === 'student') {
              const targetIds = resolveStudentIdsFromAction(action);
              targetIds.forEach((id) => applyToStudentRow(id, action.column));
            } else if (action.target === 'column') {
              evaluatedRows.forEach((s) =>
                applyToStudentRow(s.id, action.column || 'all')
              );
              if (stylePatch.bgColor === '' && (action.column === 'note' || action.column === 'all_notes' || !action.column || action.column === 'all')) {
                const clearCols =
                  action.column === 'note' && resolvedNoteIndices.length > 0
                    ? resolvedNoteIndices
                    : Array.from({ length: workingColCount }, (_, c) => c);
                for (const cIdx of clearCols) {
                  if (workingColMetas[cIdx]?.columnBgColor) {
                    workingColMetas[cIdx] = { ...workingColMetas[cIdx], columnBgColor: undefined };
                    colsMutated = true;
                  }
                }
              }
              if (action.includeHeader) {
                applyToHeaders(action.column || 'all');
              }
            } else if (action.target === 'condition') {
              const thresh =
                action.threshold !== undefined
                  ? Number(action.threshold)
                  : effectiveAverageScale / 2;
              const minT =
                action.minThreshold !== undefined ? Number(action.minThreshold) : 0;
              const maxT =
                action.maxThreshold !== undefined
                  ? Number(action.maxThreshold)
                  : effectiveAverageScale;

              const topCount = Math.max(1, Number(action.threshold) || 3);
              const topIds = new Set(rankedByAverage.slice(0, topCount).map((r) => r.id));
              const bottomIds = new Set(rankedByAverage.slice(-topCount).map((r) => r.id));
              const targetMentionNorm = normalizeStudentNameKey(String(action.mentionLabel || ''));

              evaluatedRows.forEach((s, idx) => {
                if (action.condition === 'average_below' && s.average !== null && s.average < thresh) {
                  applyToStudentRow(s.id, action.column);
                } else if (
                  action.condition === 'average_above' &&
                  s.average !== null &&
                  s.average >= thresh
                ) {
                  applyToStudentRow(s.id, action.column);
                } else if (
                  action.condition === 'average_between' &&
                  s.average !== null &&
                  s.average >= minT &&
                  s.average <= maxT
                ) {
                  applyToStudentRow(s.id, action.column);
                } else if (action.condition === 'rank_top' && topIds.has(s.id)) {
                  applyToStudentRow(s.id, action.column);
                } else if (action.condition === 'rank_bottom' && bottomIds.has(s.id)) {
                  applyToStudentRow(s.id, action.column);
                } else if (
                  action.condition === 'mention_equals' &&
                  targetMentionNorm &&
                  normalizeStudentNameKey(s.mention).includes(targetMentionNorm)
                ) {
                  applyToStudentRow(s.id, action.column);
                } else if (action.condition === 'alternating_rows' && idx % 2 === 1) {
                  applyToStudentRow(s.id, action.column);
                } else if (
                  action.condition === 'note_below' ||
                  action.condition === 'note_above'
                ) {
                  const targetCols =
                    resolvedNoteIndices.length > 0
                      ? resolvedNoteIndices
                      : Array.from({ length: workingColCount }, (_, c) => c);
                  const matchingCols = targetCols.filter((c) => {
                    const sc = s.parsedScores[c];
                    if (sc === null) return false;
                    return action.condition === 'note_below' ? sc < thresh : sc >= thresh;
                  });
                  if (matchingCols.length > 0) {
                    if (action.column && action.column !== 'note' && action.column !== 'all_notes') {
                      applyToStudentRow(s.id, action.column);
                    } else {
                      matchingCols.forEach((c) => applyStylePatchToKey(`${s.id}_${c}`, 12, s.id));
                    }
                  }
                }
              });
            } else {
              evaluatedRows.forEach((s) =>
                applyToStudentRow(s.id, action.column)
              );
              if (action.includeHeader) {
                applyToHeaders(action.column);
              }
            }
            if (touchedCells > 0) {
              stylesMutated = true;
              summaries.push(
                stylePatch.bgColor === '' && Object.keys(stylePatch).length === 1
                  ? `✓ Couleur retirée dans ${subject.name}`
                  : `✓ Mise en forme appliquée dans ${subject.name}`
              );
            }
            break;
          }

          case 'clear_formatting': {
            const hasTargetedStudent = Boolean(
              (typeof action.studentName === 'string' && action.studentName.trim()) ||
                (Array.isArray(action.studentNames) && action.studentNames.length > 0) ||
                action.rowIndex !== undefined ||
                (Array.isArray(action.rowIndices) && action.rowIndices.length > 0)
            );
            const hasTargetedColumn = Boolean(
              typeof action.column === 'string' &&
                action.column.trim() &&
                action.column !== 'all'
            );

            if (hasTargetedStudent || hasTargetedColumn) {
              const displayList = studentsMutated ? workingStudents : studentsWithStats;
              const nameTargets: string[] = [];
              if (typeof action.studentName === 'string' && action.studentName.trim()) {
                nameTargets.push(
                  normalizeStudentNameKey(action.studentName.replace(/\([^)]*\)/g, ' ').trim())
                );
              }
              if (Array.isArray(action.studentNames)) {
                action.studentNames.forEach((n: unknown) => {
                  const clean = normalizeStudentNameKey(String(n || '').replace(/\([^)]*\)/g, ' ').trim());
                  if (clean) nameTargets.push(clean);
                });
              }
              const rowTargets = new Set<number>();
              if (typeof action.rowIndex === 'number' && action.rowIndex >= 1) {
                rowTargets.add(Math.round(action.rowIndex) - 1);
              }
              if (Array.isArray(action.rowIndices)) {
                action.rowIndices.forEach((r: unknown) => {
                  if (Number(r) >= 1) rowTargets.add(Math.round(Number(r)) - 1);
                });
              }
              const targetedStudents = hasTargetedStudent
                ? displayList.filter((s, idx) => {
                    const sn = normalizeStudentNameKey(s.name || '');
                    const matchName =
                      nameTargets.length > 0 &&
                      Boolean(sn) &&
                      nameTargets.some(
                        (t) =>
                          sn === t ||
                          sn.includes(t) ||
                          t.includes(sn) ||
                          (/^(?:le\s+|la\s+)?(?:1er|1ere|premier|premiere|major)$/.test(t) && idx === 0)
                      );
                    return matchName || rowTargets.has(idx);
                  })
                : displayList;

              const colTarget = String(action.column || 'all');
              for (const s of targetedStudents) {
                const keysToReset: string[] = [];
                if (colTarget === 'all') {
                  keysToReset.push(
                    `${s.id}_rank`,
                    `${s.id}_photo`,
                    `${s.id}_matricule`,
                    `${s.id}_name`,
                    `${s.id}_avg`,
                    `${s.id}_mention`
                  );
                  for (let c = 0; c < workingColCount; c++) keysToReset.push(`${s.id}_${c}`);
                  if (workingRowColors[s.id] !== undefined) {
                    delete workingRowColors[s.id];
                    rowColorsMutated = true;
                  }
                } else if (colTarget === 'name') keysToReset.push(`${s.id}_name`);
                else if (colTarget === 'matricule') keysToReset.push(`${s.id}_matricule`);
                else if (colTarget === 'average') keysToReset.push(`${s.id}_avg`);
                else if (colTarget === 'mention') keysToReset.push(`${s.id}_mention`);
                else if (colTarget === 'rank') keysToReset.push(`${s.id}_rank`);
                else if (colTarget === 'photo') keysToReset.push(`${s.id}_photo`);
                else if (colTarget === 'note' && action.colNumber !== undefined) {
                  keysToReset.push(`${s.id}_${Math.max(0, Number(action.colNumber) - 1)}`);
                } else if (colTarget === 'all_notes' || colTarget === 'note') {
                  for (let c = 0; c < workingColCount; c++) keysToReset.push(`${s.id}_${c}`);
                }

                for (const k of keysToReset) {
                  delete workingCellStyles[k];
                  if (workingCellColors[k] !== undefined) {
                    delete workingCellColors[k];
                    cellColorsMutated = true;
                  }
                  if (colTarget !== 'all' && workingRowColors[s.id]) {
                    workingCellStyles[k] = { bgColor: '#ffffff' };
                  }
                }
              }
              stylesMutated = true;
              summaries.push(`✓ Mise en forme retirée sur la sélection`);
            } else {
              workingCellStyles = {};
              workingCellColors = {};
              workingRowColors = {};
              Object.keys(workingColMetas).forEach((k) => {
                const idx = parseInt(k, 10);
                const meta = workingColMetas[idx];
                if (meta && (meta.headerBgColor || meta.columnBgColor)) {
                  const { headerBgColor: _h, columnBgColor: _c, ...rest } = meta;
                  workingColMetas[idx] = rest;
                  colsMutated = true;
                }
              });
              stylesMutated = true;
              cellColorsMutated = true;
              rowColorsMutated = true;
              summaries.push(`✓ Mise en forme réinitialisée`);
            }
            break;
          }

          case 'resize_columns': {
            const targetCol = String(action.column || 'all').toLowerCase();
            const computeNextWidth = (current: number, minW: number, maxW = 600): number => {
              if (typeof action.widthPx === 'number' && Number.isFinite(action.widthPx)) {
                return Math.round(Math.max(minW, Math.min(maxW, action.widthPx)));
              }
              if (typeof action.scaleFactor === 'number' && Number.isFinite(action.scaleFactor)) {
                return Math.round(Math.max(minW, Math.min(maxW, current * action.scaleFactor)));
              }
              if (typeof action.deltaPx === 'number' && Number.isFinite(action.deltaPx)) {
                return Math.round(Math.max(minW, Math.min(maxW, current + action.deltaPx)));
              }
              return current;
            };

            const resolvedNoteCols: number[] = [];
            if (Array.isArray(action.colNumbers) && action.colNumbers.length > 0) {
              for (const n of action.colNumbers) {
                const idx = Number(n) - 1;
                if (idx >= 0 && idx < workingColCount && !resolvedNoteCols.includes(idx)) {
                  resolvedNoteCols.push(idx);
                }
              }
            } else if (action.colNumber !== undefined) {
              const idx = Number(action.colNumber) - 1;
              if (idx >= 0 && idx < workingColCount) resolvedNoteCols.push(idx);
            } else if (action.colIndex !== undefined) {
              const idx = Number(action.colIndex);
              if (idx >= 0 && idx < workingColCount) resolvedNoteCols.push(idx);
            }

            if (targetCol === 'all' || targetCol === 'rank') {
              workingColWidthRank = computeNextWidth(workingColWidthRank, 55);
            }
            if (targetCol === 'all' || targetCol === 'photo') {
              workingColWidthPhoto = computeNextWidth(workingColWidthPhoto, 60);
            }
            if (targetCol === 'all' || targetCol === 'matricule') {
              workingColWidthMatricule = computeNextWidth(workingColWidthMatricule, 90);
            }
            if (targetCol === 'all' || targetCol === 'name') {
              workingColWidthName = computeNextWidth(workingColWidthName, 150);
            }
            if (targetCol === 'all' || targetCol === 'average') {
              workingColWidthAverage = computeNextWidth(workingColWidthAverage, 80);
            }
            if (targetCol === 'all' || targetCol === 'mention') {
              workingColWidthMention = computeNextWidth(workingColWidthMention, 80);
            }
            if (targetCol === 'all' || targetCol === 'all_notes' || targetCol === 'note') {
              const colsToResize =
                targetCol === 'note' && resolvedNoteCols.length > 0
                  ? resolvedNoteCols
                  : Array.from({ length: workingColCount }, (_, i) => i);
              for (const idx of colsToResize) {
                const curW = workingCustomNoteWidths[idx] || workingNoteColWidth;
                workingCustomNoteWidths[idx] = computeNextWidth(curW, 96, 420);
              }
              if (targetCol === 'all' || targetCol === 'all_notes' || resolvedNoteCols.length === 0) {
                workingNoteColWidth = computeNextWidth(workingNoteColWidth, 96, 240);
              }
            }
            layoutMutated = true;
            summaries.push(`✓ Largeur des colonnes ajustée dans ${subject.name}`);
            break;
          }

          case 'resize_rows': {
            const target = String(action.target || 'all');
            const displayList = studentsMutated ? workingStudents : studentsWithStats;
            const targetRowIndices: number[] = [];

            if (target === 'all') {
              for (let i = 0; i < displayList.length; i++) targetRowIndices.push(i);
            } else {
              const nameTargets: string[] = [];
              if (typeof action.studentName === 'string' && action.studentName.trim()) {
                nameTargets.push(normalizeStudentNameKey(action.studentName));
              }
              if (Array.isArray(action.studentNames)) {
                for (const n of action.studentNames) {
                  const norm = normalizeStudentNameKey(String(n || ''));
                  if (norm) nameTargets.push(norm);
                }
              }
              const rowTargets = new Set<number>();
              if (typeof action.rowIndex === 'number' && action.rowIndex >= 1) {
                rowTargets.add(Math.round(action.rowIndex) - 1);
              }
              if (Array.isArray(action.rowIndices)) {
                for (const r of action.rowIndices) {
                  if (Number(r) >= 1) rowTargets.add(Math.round(Number(r)) - 1);
                }
              }

              displayList.forEach((s, idx) => {
                const sn = normalizeStudentNameKey(s.name || '');
                const matchesName =
                  nameTargets.length > 0 &&
                  Boolean(sn) &&
                  nameTargets.some((t) => sn === t || sn.includes(t) || t.includes(sn));
                if (matchesName || rowTargets.has(idx)) {
                  targetRowIndices.push(idx);
                }
              });
            }

            for (const rIdx of targetRowIndices) {
              const curH = workingCustomRowHeights[rIdx] || 44;
              let nextH = curH;
              if (typeof action.heightPx === 'number' && Number.isFinite(action.heightPx)) {
                nextH = Math.round(Math.max(28, Math.min(180, action.heightPx)));
              } else if (typeof action.deltaPx === 'number' && Number.isFinite(action.deltaPx)) {
                nextH = Math.round(Math.max(28, Math.min(180, curH + action.deltaPx)));
              }
              workingCustomRowHeights[rIdx] = nextH;
            }
            if (targetRowIndices.length > 0) {
              layoutMutated = true;
              summaries.push(`✓ Hauteur de ${targetRowIndices.length} ligne(s) ajustée`);
            }
            break;
          }

          case 'copy_students_from_subject': {
            if (!workspaceSnapshot) break;
            const searchSubjName = normalizeStudentNameKey(
              String(action.sourceSubjectName || '')
            );
            const sourceSubj =
              workspaceSnapshot.subjects.find(
                (s) => action.sourceSubjectId && s.id === action.sourceSubjectId
              ) ||
              workspaceSnapshot.subjects.find(
                (s) =>
                  s.classId === schoolClass.id &&
                  s.termId === effectiveTermId &&
                  searchSubjName.length > 0 &&
                  normalizeStudentNameKey(s.name).includes(searchSubjName)
              ) ||
              workspaceSnapshot.subjects.find(
                (s) =>
                  s.classId === schoolClass.id &&
                  searchSubjName.length > 0 &&
                  normalizeStudentNameKey(s.name).includes(searchSubjName)
              ) ||
              workspaceSnapshot.subjects.find(
                (s) =>
                  searchSubjName.length > 0 &&
                  normalizeStudentNameKey(s.name).includes(searchSubjName)
              );

            if (sourceSubj) {
              const sourceGb =
                workspaceSnapshot.gradebooks.find(
                  (g) => g.subjectId === sourceSubj.id && g.termId === effectiveTermId
                ) ||
                workspaceSnapshot.gradebooks.find(
                  (g) => g.subjectId === sourceSubj.id
                );
              if (sourceGb && sourceGb.students.length > 0) {
                const includeNotes = Boolean(action.includeNotes);
                const sourceHasRealMatricules = hasRealExplicitMatriculeBatch(
                  sourceGb.students.map((st) => st.matricule || '')
                );
                workingStudents = sourceGb.students.map((st) => {
                  const cleanMat = sourceHasRealMatricules
                    ? String(st.matricule || '').trim().slice(0, 48)
                    : effectiveShowMatricule
                    ? String(st.matricule || '').trim().slice(0, 48)
                    : '';
                  return {
                    // Toujours générer un nouvel `id` unique pour cette matière (évite toute collision PK D1),
                    // tout en conservant `studentUid` pour relier l'élève entre matières dans Moyenne Générale.
                    id: generateTeacherEntityId('std'),
                    studentUid: st.id || generateTeacherEntityId('std'),
                    name: st.name,
                    matricule: cleanMat,
                    notes: includeNotes
                      ? normalizeIncomingNotes(
                          st.notes,
                          Array(workingColCount).fill('')
                        )
                      : Array(workingColCount).fill(''),
                  };
                });
                studentsMutated = true;
                if (sourceHasRealMatricules && !effectiveShowMatricule) {
                  pendingAutoShowMatricule = true;
                }
                summaries.push(
                  `✓ ${sourceGb.students.length} élève(s) copié(s) depuis « ${sourceSubj.name} »`
                );
              }
            }
            break;
          }

          case 'set_zoom': {
            const z = Math.min(200, Math.max(30, Math.round(Number(action.zoomPercent) || 70)));
            setZoomPercent(z);
            setIsSaved(false);
            summaries.push(`✓ Zoom réglé à ${z}%`);
            break;
          }

          case 'reset_column_widths': {
            workingColWidthRank = 68;
            workingColWidthPhoto = 76;
            workingColWidthMatricule = 124;
            workingColWidthName = 280;
            workingNoteColWidth = 96;
            workingCustomNoteWidths = {};
            workingColWidthAverage = 104;
            workingColWidthMention = 108;
            workingCustomRowHeights = {};
            layoutMutated = true;
            summaries.push(`✓ Largeurs des colonnes et hauteurs de lignes réinitialisées`);
            break;
          }

          case 'set_expand_level': {
            const lvl: 0 | 1 | 2 =
              Number(action.level) === 2 ? 2 : Number(action.level) === 1 ? 1 : 0;
            setViewerExpandLevel(lvl);
            setIsViewerMaximized(lvl >= 1);
            summaries.push(
              lvl === 2
                ? `✓ Plein écran total activé`
                : lvl === 1
                ? `✓ Affichage agrandi activé`
                : `✓ Affichage normal rétabli`
            );
            break;
          }

          case 'undo': {
            handleUndo();
            summaries.push(`✓ Dernière modification annulée`);
            break;
          }

          case 'redo': {
            handleRedo();
            summaries.push(`✓ Modification rétablie`);
            break;
          }

          case 'export_excel': {
            handleExportExcel();
            summaries.push(`✓ Export Excel (.xlsx) téléchargé`);
            break;
          }

          case 'export_pdf': {
            await exportGradebookToPdf(buildSubjectExportDataset());
            summaries.push(`✓ Export PDF téléchargé`);
            break;
          }

          case 'export_word': {
            await exportGradebookToWord(buildSubjectExportDataset());
            summaries.push(`✓ Export Word (.docx) téléchargé`);
            break;
          }

          case 'copy_table': {
            await copyGradebookToClipboard(buildSubjectExportDataset());
            setCopiedTableSuccess(true);
            setTimeout(() => setCopiedTableSuccess(false), 2500);
            summaries.push(`✓ Tableau copié dans le presse-papiers`);
            break;
          }

          case 'save_gradebook': {
            summaries.push(`✓ Tableau enregistré dans le cloud`);
            break;
          }
        }
      }

      const explicitSaveRequested = actions.some((a) => a?.type === 'save_gradebook');

      if (colsMutated) {
        setNoteColumnCount(workingColCount);
        setColumnMetas(workingColMetas);
      }
      if (studentsMutated) {
        setStudents(workingStudents);
      }
      if (stylesMutated) {
        setCellCustomStyles(workingCellStyles);
      }
      if (cellColorsMutated) {
        setCellColors(workingCellColors);
      }
      if (rowColorsMutated) {
        setRowColors(workingRowColors);
      }
      if (layoutMutated) {
        setColWidthRank(workingColWidthRank);
        setColWidthPhoto(workingColWidthPhoto);
        setColWidthMatricule(workingColWidthMatricule);
        setColWidthName(workingColWidthName);
        setNoteColWidth(workingNoteColWidth);
        setCustomNoteWidths(workingCustomNoteWidths);
        setColWidthAverage(workingColWidthAverage);
        setColWidthMention(workingColWidthMention);
        setCustomRowHeights(workingCustomRowHeights);
      }
      if (pendingAutoShowMatricule && !explicitMatriculeToggleSeen) {
        setSheetShowMatricule(true);
      }
      if (
        colsMutated ||
        studentsMutated ||
        stylesMutated ||
        cellColorsMutated ||
        rowColorsMutated ||
        layoutMutated ||
        (pendingAutoShowMatricule && !explicitMatriculeToggleSeen)
      ) {
        setIsSaved(false);
        setTimeout(() => {
          flushCloudSave({ force: true });
        }, 220);
      } else if (explicitSaveRequested) {
        flushCloudSave({ force: true });
      }

      return summaries;
    },
  };

  return (
    <div 
      ref={gradebookContainerRef}
      className={`gradebook-gray-selection w-full flex flex-col bg-[#eef2f6] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 font-sans select-none overflow-hidden transition-colors duration-200 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-[60] w-screen h-screen min-h-screen'
          : 'relative w-full h-full min-h-0 flex-1'
      }`}
    >
      <style>{`
        .gradebook-gray-selection ::selection,
        .gradebook-gray-selection input::selection {
          background-color: #c6cacf;
          color: inherit;
        }
        .gradebook-gray-selection ::-moz-selection,
        .gradebook-gray-selection input::-moz-selection {
          background-color: #c6cacf;
          color: inherit;
        }
        .dark .gradebook-gray-selection > header,
        .dark .gradebook-gray-selection > section,
        .dark .gradebook-gray-selection > footer {
          background-color: #111827 !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }
        .dark .gradebook-gray-selection > header button,
        .dark .gradebook-gray-selection > section button,
        .dark .gradebook-gray-selection > section select {
          border-color: #475569 !important;
        }
        .dark .gradebook-gray-selection > div.flex-1.overflow-auto {
          background-color: #0b1120 !important;
        }
        .dark .gradebook-gray-selection .gb-excel-hdr,
        .dark .gradebook-gray-selection .gb-excel-gutter {
          background-color: #111827 !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .dark .gradebook-gray-selection .gb-excel-margin {
          background-color: #0f172a !important;
          border-color: #1e293b !important;
        }
      `}</style>
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* 1. EN-TÊTE ÉPURÉ AVEC BOUTON RETOUR & BOUTONS ZOOM (+) (-) EN HAUT        */}
      {/* ========================================================================= */}
      <header className="h-10 sm:h-12 bg-white border-b border-slate-300 px-1.5 sm:px-4 flex items-center justify-between gap-1 sm:gap-2 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={handleSafeBack}
            className="flex items-center justify-center gap-1 sm:gap-1.5 w-7 h-7 sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300/90 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            title="Retour à la liste des matières"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5] text-slate-700" />
            <span className="leading-none hidden sm:inline">Retour</span>
          </button>

          {/* Bouton Enregistrer manuel + Statut d'enregistrement automatique */}
          <button
            type="button"
            onClick={handleManualSaveGradebook}
            disabled={cloudSaveStatus === 'saving' || isUploadingPhoto}
            className={`flex items-center justify-center gap-1.5 w-7 h-7 sm:w-auto sm:h-auto sm:px-2.5 sm:py-1 rounded-lg text-xs font-bold border shadow-2xs transition active:scale-95 shrink-0 cursor-pointer ${
              cloudSaveStatus === 'offline' || cloudSaveStatus === 'error'
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'
                : cloudSaveStatus === 'saving'
                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-wait'
                : 'bg-white hover:bg-slate-50 text-[#00313d] border-slate-300'
            }`}
            title="Enregistrer manuellement le tableur"
          >
            {cloudSaveStatus === 'saving' || isUploadingPhoto ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
            ) : (
              <Save className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
            <span className="hidden sm:inline">Enregistrer</span>
          </button>

          <div
            className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border shrink-0 select-none ${
              cloudSaveStatus === 'offline' || cloudSaveStatus === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : cloudSaveStatus === 'loading' || cloudSaveStatus === 'saving' || isUploadingPhoto || !isSaved
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
            title={cloudSaveError || 'Enregistrement automatique dans le cloud StudyCloud'}
          >
            {cloudSaveStatus === 'offline' ? (
              <>
                <WifiOff className="w-3 h-3 text-red-600 shrink-0" />
                <span>Hors ligne — Échec</span>
              </>
            ) : cloudSaveStatus === 'error' ? (
              <>
                <CloudOff className="w-3 h-3 text-red-600 shrink-0" />
                <span>Échec enregistrement</span>
              </>
            ) : cloudSaveStatus === 'loading' || cloudSaveStatus === 'saving' || isUploadingPhoto || !isSaved ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-700 shrink-0" />
                <span>
                  {cloudSaveStatus === 'loading'
                    ? 'Chargement de vos données...'
                    : isUploadingPhoto
                    ? 'Envoi photo...'
                    : 'Enregistrement en cours...'}
                </span>
              </>
            ) : hasSavedAtLeastOnce ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Enregistré avec succès</span>
              </>
            ) : (
              <>
                <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Synchronisé au cloud</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <div 
              className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-sm border shrink-0"
              style={{
                backgroundColor: subject.color || '#2563eb',
                borderColor: subject.borderColor || '#1d4ed8'
              }}
            />
            <div className="flex items-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs font-black text-slate-800 truncate">
              <span className="truncate">{subject.name}</span>
              {subject.coefficient !== undefined && subject.coefficient !== null && (
                <span className="text-slate-700 font-extrabold bg-slate-100 px-1 sm:px-1.5 py-0.5 rounded text-[9.5px] sm:text-[10px] border border-slate-300/80 shrink-0">
                  <span className="sm:hidden">C</span>
                  <span className="hidden sm:inline">Coeff </span>
                  {subject.coefficient}
                </span>
              )}
              <span className="text-slate-400 font-normal hidden sm:inline">•</span>
              <span className="text-slate-600 font-semibold truncate hidden sm:inline">
                {schoolClass.name?.trim()
                  ? (schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
                      ? schoolClass.name.trim()
                      : `${schoolClass.level} • ${schoolClass.name.trim()}`)
                  : schoolClass.level}
              </span>
              <span className="text-slate-400 font-normal hidden md:inline">•</span>
              <span className="text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded text-[10px] border border-cyan-200/80 hidden md:inline-block shrink-0">
                {customPeriodBadge || (
                  <>
                    {term?.name || 'Trimestre 1'}
                    {term?.coefficient !== undefined && term?.coefficient !== null ? ` · Coeff ${term.coefficient}` : ''}
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* BOUTONS ZOOM HAUT DROIT */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div 
            className="flex items-center bg-slate-100 hover:bg-slate-200/90 border border-slate-300 rounded-lg p-0.5 shadow-2xs transition"
            title="Contrôle du zoom d'affichage"
          >
            <button
              type="button"
              onClick={() => setZoomPercent(prev => Math.max(30, prev - 10))}
              className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 transition active:scale-90 cursor-pointer"
              title="Zoom arrière (-10%)"
            >
              <Minus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            </button>
            <span 
              onClick={() => setZoomPercent(70)}
              className="text-[10px] sm:text-[11px] font-mono font-black text-slate-800 px-0.5 sm:px-1.5 min-w-[28px] sm:min-w-[36px] text-center cursor-pointer hover:text-blue-600 transition select-none"
              title="Cliquer pour réinitialiser le zoom à 70%"
            >
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => setZoomPercent(prev => Math.min(200, prev + 10))}
              className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 transition active:scale-90 cursor-pointer"
              title="Zoom avant (+10%)"
            >
              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <GradebookDownloadMenu
            getDataset={buildSubjectExportDataset}
            onExportExcel={handleExportExcel}
          />

          {(cloudSaveStatus === 'error' || cloudSaveStatus === 'offline') && (
            <button
              type="button"
              onClick={handleManualSaveGradebook}
              className="flex md:hidden items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-50 hover:bg-red-100 border border-red-200 text-[10px] font-semibold text-red-700 transition cursor-pointer"
              title={cloudSaveError || 'Cliquer pour relancer la synchronisation cloud'}
            >
              {cloudSaveStatus === 'offline' ? <WifiOff className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
              <span className="hidden xs:inline">{cloudSaveStatus === 'offline' ? 'Hors ligne' : 'Réessayer'}</span>
            </button>
          )}

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <div className="hidden md:flex items-center">
              <ViewerSuperExpandButton
                expandLevel={viewerExpandLevel}
                onExpandChange={(lvl) => {
                  if (lvl >= 1) setIsViewerMaximized(true);
                  else setIsViewerMaximized(false);
                  setViewerExpandLevel(lvl);
                }}
              />
            </div>

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
              className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
                viewerExpandLevel >= 1 || isViewerMaximized
                  ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/40'
                  : 'bg-[#101827] hover:bg-[#1a2538] text-white border-white/20'
              }`}
              title={viewerExpandLevel >= 1 || isViewerMaximized ? 'Réduire la vue' : "Agrandir l'espace"}
            >
              {viewerExpandLevel >= 1 || isViewerMaximized ? (
                <Minimize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.2]" />
              ) : (
                <Maximize2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 stroke-[2.2]" />
              )}
            </button>
          </div>
        </div>
      </header>

      {(cloudSaveStatus === 'offline' || cloudSaveStatus === 'error') && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-red-800 shrink-0 z-20">
          <div className="flex items-center gap-2 min-w-0">
            {cloudSaveStatus === 'offline' ? (
              <WifiOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
            ) : (
              <CloudOff className="w-3.5 h-3.5 text-red-600 shrink-0" />
            )}
            <span className="font-semibold truncate">
              {cloudSaveError || "Hors ligne — Échec de l'enregistrement. Vérifiez votre connexion Internet puis appuyez sur Enregistrer."}
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualSaveGradebook}
            className="px-2.5 py-0.5 rounded bg-white hover:bg-red-100 border border-red-300 text-[11px] font-bold text-red-700 shrink-0 cursor-pointer transition"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. RUBAN D'OUTILS STYLE WPS OFFICE / EXCEL (INTERACTIF & COMPLET) */}
      {/* ========================================================================= */}
      <section 
        onClick={(e) => e.stopPropagation()}
        className="bg-[#f3f4f6] border-b border-slate-300 px-1.5 sm:px-2 py-1 flex items-stretch gap-1 sm:gap-2 text-slate-700 shrink-0 select-none relative z-50 overflow-x-auto overflow-y-hidden md:overflow-visible scrollbar-none"
      >
        {/* GROUPE 1 : PRESSE-PAPIERS (COPIER TOUT LE TABLEAU & COLLER) */}
        <div className="flex flex-col items-center justify-center sm:justify-between px-1 sm:px-1.5 border-r border-slate-300/80 sm:min-w-[76px] shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1 sm:mt-0.5">
            {/* Bouton COPIER (Copie tout le tableau en format TSV pour Excel / Word) */}
            <div className="relative">
              <button 
                type="button" 
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyEntireTable();
                }}
                className={`p-1.5 rounded transition flex items-center justify-center cursor-pointer active:scale-95 outline-none focus:outline-none ${
                  copiedTableSuccess ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-slate-200 text-slate-800'
                }`}
                title="Copier tout le tableau (format Excel / TSV)"
              >
                {copiedTableSuccess ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-blue-600 stroke-[2.2]" />
                )}
              </button>
              {copiedTableSuccess && (
                <div className="fixed sm:absolute top-12 sm:top-full left-1/2 -translate-x-1/2 sm:mt-1 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded shadow-lg whitespace-nowrap z-[200] animate-in fade-in zoom-in-95 pointer-events-none">
                  Tableau copié !
                </div>
              )}
            </div>

            {/* Bouton COLLER */}
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handlePasteGradebook();
              }}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-800 transition flex items-center justify-center cursor-pointer active:scale-95 outline-none focus:outline-none" 
              title="Coller des données dans le tableau"
            >
              <Clipboard className="w-3.5 h-3.5 text-amber-600 stroke-[2.2]" />
            </button>
          </div>
          <span className="hidden sm:block text-[9px] text-slate-500 font-medium leading-none mb-0.5">Presse-papiers</span>
        </div>

        {/* GROUPE 2 : POLICE, TAILLE, GRAS, STYLO COULEUR & REMPLISSAGE */}
        <div className="flex flex-col items-center justify-between px-1 sm:px-1.5 border-r border-slate-300/80 relative shrink-0">
          <div className="flex items-center gap-1">
            {/* SÉLECTEUR DE POLICE AVEC RECHERCHE STYLE EXCEL */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isFontFamilyMenuOpen;
                  closeAllMenus();
                  if (next) {
                    setMenuAnchorEl(e.currentTarget);
                    setIsFontFamilyMenuOpen(true);
                  }
                }}
                className="gb-menu-trigger flex items-center justify-between h-6 px-1.5 min-w-[74px] sm:min-w-[90px] max-w-[100px] sm:max-w-[120px] bg-white border border-slate-300 rounded text-[10.5px] sm:text-[11px] font-medium text-slate-800 hover:border-blue-500 cursor-pointer shadow-2xs outline-none focus:outline-none"
                title="Changer la police"
              >
                <span className="truncate" style={{ fontFamily: activeFontFamily }}>{activeFontFamily}</span>
                <ChevronDown className="w-3 h-3 ml-1 text-slate-500 shrink-0" />
              </button>

              <SmartFloatingPopover
                open={isFontFamilyMenuOpen}
                anchorEl={menuAnchorEl}
                boundaryEl={gradebookContainerRef.current}
                preferredSide="bottom"
                preferredAlign="start"
                gap={6}
                onClose={closeAllMenus}
                ignoreOutsideSelector=".gb-menu-trigger"
                dataPopoverId="gb-font-family-menu"
                className="w-64 rounded-lg"
              >
                <div className="flex flex-col text-xs select-none max-h-72">
                  {/* Champ de recherche de police (sans autoFocus pour ne pas effacer le surlignement dans le tableau) */}
                  <div className="p-2 border-b border-slate-200 bg-slate-50 flex items-center gap-1.5 sticky top-0 z-10">
                    <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      data-font-search="true"
                      value={fontSearchQuery}
                      onChange={(e) => setFontSearchQuery(e.target.value)}
                      placeholder="Entrez pour rechercher..."
                      className="w-full text-xs bg-transparent outline-none text-slate-800 placeholder:text-slate-400 font-normal"
                    />
                    {fontSearchQuery && (
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setFontSearchQuery('');
                        }} 
                        className="p-0.5 text-slate-400 hover:text-slate-600 outline-none focus:outline-none"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Liste scrollable des polices rendues dans leur propre style */}
                  <div className="overflow-y-auto max-h-56 divide-y divide-slate-100 py-1">
                    {filteredFonts.length === 0 ? (
                      <div className="p-3 text-center text-slate-400 text-xs italic">
                        Aucune police trouvée
                      </div>
                    ) : (
                      filteredFonts.map((font) => (
                        <button
                          key={font}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={(e) => {
                            e.stopPropagation();
                            applyFontFamily(font);
                            setIsFontFamilyMenuOpen(false);
                          }}
                          className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-blue-50 transition cursor-pointer outline-none focus:outline-none ${
                            hasActiveFormatTarget && activeFontFamily === font ? 'bg-blue-50/70 text-blue-700 font-bold' : 'text-slate-800'
                          }`}
                        >
                          <span className="text-xs truncate" style={{ fontFamily: font }}>{font}</span>
                          {hasActiveFormatTarget && activeFontFamily === font && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 ml-1" />}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </SmartFloatingPopover>
            </div>

            {/* SÉLECTEUR DE TAILLE DE POLICE (MENU DÉROULANT VERTICAL) */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isFontSizeMenuOpen;
                  closeAllMenus();
                  if (next) {
                    setMenuAnchorEl(e.currentTarget);
                    setIsFontSizeMenuOpen(true);
                  }
                }}
                className="gb-menu-trigger flex items-center justify-between h-6 px-1.5 w-12 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800 hover:border-blue-500 cursor-pointer shadow-2xs outline-none focus:outline-none"
                title="Taille de police"
              >
                <span>{activeFontSize}</span>
                <ChevronDown className="w-3 h-3 text-slate-500 shrink-0" />
              </button>

              <SmartFloatingPopover
                open={isFontSizeMenuOpen}
                anchorEl={menuAnchorEl}
                boundaryEl={gradebookContainerRef.current}
                preferredSide="bottom"
                preferredAlign="start"
                gap={6}
                onClose={closeAllMenus}
                ignoreOutsideSelector=".gb-menu-trigger"
                dataPopoverId="gb-font-size-menu"
                className="w-20 rounded-lg"
              >
                <div className="max-h-60 overflow-y-auto py-1 text-xs select-none">
                  {FONT_SIZES.map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyFontSize(sz);
                        setIsFontSizeMenuOpen(false);
                      }}
                      className={`w-full px-3 py-1 flex items-center justify-between text-left hover:bg-blue-50 transition cursor-pointer outline-none focus:outline-none ${
                        hasActiveFormatTarget && activeFontSize === sz ? 'bg-blue-50/70 text-blue-700 font-bold' : 'text-slate-800'
                      }`}
                    >
                      <span>{sz}</span>
                      {hasActiveFormatTarget && activeFontSize === sz && <Check className="w-3 h-3 text-blue-600" />}
                    </button>
                  ))}
                </div>
              </SmartFloatingPopover>
            </div>

            {/* BOUTONS A⁺ ET A⁻ (AGRANDIR / DIMINUER LA TAILLE) */}
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                increaseFontSize();
              }} 
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-800 font-bold text-xs transition active:scale-95 cursor-pointer outline-none focus:outline-none" 
              title="Agrandir la taille de police"
            >
              A<sup>+</sup>
            </button>
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                decreaseFontSize();
              }} 
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-800 font-bold text-xs transition active:scale-95 cursor-pointer outline-none focus:outline-none" 
              title="Diminuer la taille de police"
            >
              A<sup>-</sup>
            </button>
          </div>

          {/* LIGNE DE STYLE : B (GRAS), I (ITALIQUE), U (SOULIGNÉ), S (BARRÉ), STYLO (COULEUR TEXTE), POT DE PEINTURE (FOND) */}
          <div className="flex items-center gap-0.5 mt-1 relative">
            {/* BOUTON B (GRAS EXCEL : REND LE TEXTE PUR / NOIR ÉPAIS OU NORMAL) */}
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                toggleBold();
              }} 
              className={`w-5 h-5 flex items-center justify-center rounded transition active:scale-90 cursor-pointer outline-none focus:outline-none ${
                activeIsBold 
                  ? 'bg-slate-900 text-white font-black shadow-xs' 
                  : 'hover:bg-slate-200 text-slate-700 font-normal'
              }`}
              title="Gras (B)"
            >
              <Bold className="w-3 h-3 stroke-[3]" />
            </button>

            {/* BOUTON I (ITALIQUE) */}
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                toggleItalic();
              }} 
              className={`w-5 h-5 flex items-center justify-center rounded transition active:scale-90 cursor-pointer outline-none focus:outline-none ${
                activeIsItalic 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Italique (I)"
            >
              <Italic className="w-3 h-3 stroke-[2.5]" />
            </button>

            {/* BOUTON U (SOULIGNÉ) */}
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                toggleUnderline();
              }} 
              className={`w-5 h-5 flex items-center justify-center rounded transition active:scale-90 cursor-pointer outline-none focus:outline-none ${
                activeIsUnderline 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Souligné (U)"
            >
              <Underline className="w-3 h-3 stroke-[2.5]" />
            </button>

            {/* BOUTON S (BARRÉ) */}
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                toggleStrikethrough();
              }} 
              className={`w-5 h-5 flex items-center justify-center rounded transition active:scale-90 cursor-pointer outline-none focus:outline-none ${
                activeIsStrikethrough 
                  ? 'bg-slate-900 text-white shadow-xs' 
                  : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Barré (S)"
            >
              <Strikethrough className="w-3 h-3 stroke-[2.5]" />
            </button>

            {/* BOUTON STYLO : COULEUR DU TEXTE / CHIFFRES AVEC PALETTE DÉROULANTE */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isTextColorMenuOpen;
                  closeAllMenus();
                  if (next) {
                    setMenuAnchorEl(e.currentTarget);
                    setIsTextColorMenuOpen(true);
                  }
                }}
                className={`gb-menu-trigger p-1 rounded transition flex items-center gap-0.5 cursor-pointer active:scale-95 outline-none focus:outline-none ${
                  isTextColorMenuOpen ? 'bg-slate-300' : 'hover:bg-slate-200'
                }`}
                title="Couleur de police (Stylo)"
              >
                <div className="flex flex-col items-center">
                  <Pen className="w-3 h-3 text-slate-800 stroke-[2.5]" />
                  <div 
                    className="w-3.5 h-0.5 mt-0.5 rounded-full" 
                    style={{ backgroundColor: activeTextColor || '#0f172a' }} 
                  />
                </div>
                <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
              </button>

              <SmartFloatingPopover
                open={isTextColorMenuOpen}
                anchorEl={menuAnchorEl}
                boundaryEl={gradebookContainerRef.current}
                preferredSide="bottom"
                preferredAlign="start"
                gap={6}
                onClose={closeAllMenus}
                ignoreOutsideSelector=".gb-menu-trigger"
                dataPopoverId="gb-text-color-menu"
                className="w-52 rounded-lg"
              >
                <div className="p-2 text-xs select-none">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
                    Couleur de police
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {TEXT_PALETTE_COLORS.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyTextColor(item.color);
                          setIsTextColorMenuOpen(false);
                        }}
                        style={{ backgroundColor: item.color }}
                        className="w-5 h-5 rounded border border-slate-300 hover:scale-115 transition shadow-2xs cursor-pointer flex items-center justify-center outline-none focus:outline-none"
                        title={item.name}
                      >
                        {hasActiveFormatTarget && activeTextColor === item.color && (
                          <Check className={`w-3 h-3 ${item.color === '#0f172a' || item.color === '#1e3a8a' ? 'text-white' : 'text-slate-900'} stroke-[3]`} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </SmartFloatingPopover>
            </div>

            {/* BOUTON REMPLISSAGE (POT DE PEINTURE : ENTOURE / REMPLIT LA CASE DE COULEUR) */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={(e) => {
                  e.stopPropagation();
                  const next = !isBgColorMenuOpen;
                  closeAllMenus();
                  if (next) {
                    setMenuAnchorEl(e.currentTarget);
                    setIsBgColorMenuOpen(true);
                  }
                }}
                className={`gb-menu-trigger p-1 rounded transition flex items-center gap-0.5 cursor-pointer active:scale-95 outline-none focus:outline-none ${
                  isBgColorMenuOpen ? 'bg-slate-300' : 'hover:bg-slate-200'
                }`}
                title="Couleur de remplissage (Fond de case)"
              >
                <div className="flex flex-col items-center">
                  <PaintBucket className="w-3 h-3 text-amber-600 stroke-[2.2]" />
                  <div 
                    className="w-3.5 h-0.5 mt-0.5 rounded-full" 
                    style={{ backgroundColor: activeBgColor || '#f59e0b' }} 
                  />
                </div>
                <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
              </button>

              <SmartFloatingPopover
                open={isBgColorMenuOpen}
                anchorEl={menuAnchorEl}
                boundaryEl={gradebookContainerRef.current}
                preferredSide="bottom"
                preferredAlign="start"
                gap={6}
                onClose={closeAllMenus}
                ignoreOutsideSelector=".gb-menu-trigger"
                dataPopoverId="gb-bg-color-menu"
                className="w-52 rounded-lg"
              >
                <div className="p-2 text-xs select-none">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
                    Couleur de fond
                  </div>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      applyBgColor('');
                      setIsBgColorMenuOpen(false);
                    }}
                    className="w-full mb-1.5 py-1 px-2 text-[10.5px] font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-between cursor-pointer outline-none focus:outline-none"
                  >
                    <span>Aucun remplissage</span>
                    {hasActiveFormatTarget && !activeBgColor && <Check className="w-3 h-3 text-blue-600" />}
                  </button>
                  <div className="grid grid-cols-8 gap-1">
                    {FILL_PALETTE_COLORS.filter(c => Boolean(c.color)).map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          applyBgColor(item.color);
                          setIsBgColorMenuOpen(false);
                        }}
                        style={{ backgroundColor: item.color }}
                        className="w-5 h-5 rounded border border-slate-300 hover:scale-115 transition shadow-2xs cursor-pointer flex items-center justify-center outline-none focus:outline-none"
                        title={item.name}
                      >
                        {hasActiveFormatTarget && activeBgColor === item.color && (
                          <Check className="w-3 h-3 text-slate-900 stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </SmartFloatingPopover>
            </div>
          </div>
        </div>

        {/* GROUPE 3 : ALIGNEMENT */}
        <div className="flex flex-col items-center justify-center sm:justify-between px-1 sm:px-1.5 border-r border-slate-300/80 shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1 sm:mt-0.5">
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                applyTextAlign('left');
              }} 
              className={`p-1 rounded transition cursor-pointer outline-none focus:outline-none ${hasActiveFormatTarget && activeTextAlign === 'left' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Aligner à gauche"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                applyTextAlign('center');
              }} 
              className={`p-1 rounded transition cursor-pointer outline-none focus:outline-none ${hasActiveFormatTarget && activeTextAlign === 'center' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Centrer"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button 
              type="button" 
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                applyTextAlign('right');
              }} 
              className={`p-1 rounded transition cursor-pointer outline-none focus:outline-none ${hasActiveFormatTarget && activeTextAlign === 'right' ? 'bg-slate-900 text-white shadow-xs' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Aligner à droite"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="hidden sm:block text-[9px] text-slate-500 font-medium leading-none mb-0.5">Alignement</span>
        </div>

        {/* GROUPE 4 : HISTORIQUE (RETOUR ARRIÈRE / AVANT - UNDO / REDO) */}
        <div className="flex flex-col items-center justify-center sm:justify-between px-1 sm:px-1.5 border-r border-slate-300/80 shrink-0">
          <div className="flex items-center gap-0.5 sm:gap-1 sm:mt-0.5">
            <button
              type="button"
              disabled={!historyFlags.canUndo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleUndo();
              }}
              className={`p-1 sm:p-1.5 rounded transition flex items-center justify-center outline-none focus:outline-none ${
                historyFlags.canUndo
                  ? 'hover:bg-slate-200 text-slate-800 cursor-pointer active:scale-95'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Annuler la dernière modification (Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4]" />
            </button>

            <button
              type="button"
              disabled={!historyFlags.canRedo}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                handleRedo();
              }}
              className={`p-1 sm:p-1.5 rounded transition flex items-center justify-center outline-none focus:outline-none ${
                historyFlags.canRedo
                  ? 'hover:bg-slate-200 text-slate-800 cursor-pointer active:scale-95'
                  : 'text-slate-300 cursor-not-allowed'
              }`}
              title="Rétablir la modification annulée (Ctrl+Y)"
            >
              <Redo2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.4]" />
            </button>
          </div>
          <span className="hidden sm:block text-[9px] text-slate-500 font-medium leading-none mb-0.5">Historique</span>
        </div>

        {/* GROUPE 5 : AJUSTEMENT DES NOTES (± SUR TOUTES LES NOTES OU UNE NOTE SPÉCIFIQUE) */}
        <div className="flex flex-col items-center justify-center sm:justify-between px-1 sm:px-1.5 relative shrink-0">
          <div className="relative sm:mt-0.5">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                const next = !isGradeAdjustMenuOpen;
                closeAllMenus();
                if (next) {
                  setMenuAnchorEl(e.currentTarget);
                  setIsGradeAdjustMenuOpen(true);
                }
                if (gradeAdjustColIndex >= noteColumnCount) {
                  setGradeAdjustColIndex(0);
                }
              }}
              className={`gb-menu-trigger w-8 sm:w-9 h-6 sm:h-7 rounded-md border flex items-center justify-center gap-0.5 transition cursor-pointer shadow-2xs active:scale-95 outline-none focus:outline-none ${
                isGradeAdjustMenuOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-slate-50'
              }`}
              title="Ajouter ou retirer des points (+ / -) sur toutes les notes ou sur une note spécifique"
            >
              <span className="text-sm font-black leading-none">±</span>
              <ChevronDown className={`w-2.5 h-2.5 ${isGradeAdjustMenuOpen ? 'text-white' : 'text-slate-500'}`} />
            </button>

            {gradeAdjustFeedback && !isGradeAdjustMenuOpen && (
              <div className="fixed sm:absolute top-12 sm:top-full left-1/2 -translate-x-1/2 sm:mt-1 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-md shadow-lg whitespace-nowrap z-[200] animate-in fade-in zoom-in-95 pointer-events-none">
                {gradeAdjustFeedback}
              </div>
            )}

            <SmartFloatingPopover
              open={isGradeAdjustMenuOpen}
              anchorEl={menuAnchorEl}
              boundaryEl={gradebookContainerRef.current}
              preferredSide="bottom"
              preferredAlign="end"
              gap={8}
              onClose={closeAllMenus}
              ignoreOutsideSelector=".gb-menu-trigger"
              dataPopoverId="gb-grade-adjust-menu"
              className="w-72 rounded-xl"
            >
              <div className="p-3 text-xs select-none space-y-3">
                {/* Titre du menu */}
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <span className="text-[11px] font-black text-slate-800 uppercase tracking-wide">
                    Ajuster les notes (±)
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsGradeAdjustMenuOpen(false)}
                    className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 2 BOUTONS DE MODE : TOUTES LES NOTES vs UNE NOTE SPÉCIFIQUE */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGradeAdjustMode('all')}
                    className={`px-2 py-2 rounded-lg text-[11px] font-bold border transition cursor-pointer text-center leading-tight ${
                      gradeAdjustMode === 'all'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Toutes les notes
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradeAdjustMode('specific')}
                    className={`px-2 py-2 rounded-lg text-[11px] font-bold border transition cursor-pointer text-center leading-tight ${
                      gradeAdjustMode === 'specific'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Note spécifique
                  </button>
                </div>

                {/* LISTE DES NOTES CRÉÉES SI MODE "NOTE SPÉCIFIQUE" */}
                {gradeAdjustMode === 'specific' && (
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Choisir la note concernée :
                    </div>
                    <div className="max-h-32 overflow-y-auto grid grid-cols-2 gap-1.5 p-1 bg-slate-50 rounded-lg border border-slate-200">
                      {Array.from({ length: noteColumnCount }).map((_, idx) => {
                        const meta = columnMetas[idx] || { title: 'NOTE', maxScore: 20 };
                        const label = `${meta.title || 'NOTE'} ${idx + 1}`;
                        const isSelected = gradeAdjustColIndex === idx;
                        return (
                          <button
                            key={`adjust-col-${idx}`}
                            type="button"
                            onClick={() => setGradeAdjustColIndex(idx)}
                            className={`px-2 py-1.5 rounded-md text-[11px] font-bold border transition cursor-pointer flex items-center justify-between gap-1 ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                            }`}
                          >
                            <span className="truncate">{label}</span>
                            <span className={`text-[9.5px] shrink-0 ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>
                              /{meta.maxScore}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* CHOIX + (AJOUTER) OU - (RETIRER) */}
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setGradeAdjustSign('add')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold border transition cursor-pointer flex items-center justify-center gap-1 ${
                      gradeAdjustSign === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-emerald-50/60 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Ajouter (+)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGradeAdjustSign('sub')}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-extrabold border transition cursor-pointer flex items-center justify-center gap-1 ${
                      gradeAdjustSign === 'sub'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'bg-rose-50/60 text-rose-800 border-rose-200 hover:bg-rose-100'
                    }`}
                  >
                    <Minus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Retirer (−)</span>
                  </button>
                </div>

                {/* CHAMP POUR ÉCRIRE LE NOMBRE + PETITS BOUTONS - ET + POUR RÉDUIRE / AUGMENTER */}
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Points à {gradeAdjustSign === 'add' ? 'ajouter' : 'retirer'} :
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleStepGradeAdjustAmount(-0.5)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
                      title="Réduire de 0,5"
                    >
                      <Minus className="w-3.5 h-3.5 stroke-[2.8]" />
                    </button>

                    <input
                      type="text"
                      data-grade-adjust-input="true"
                      value={gradeAdjustAmountStr}
                      onChange={(e) => {
                        const cleaned = sanitizeDecimalInput(e.target.value);
                        setGradeAdjustAmountStr(cleaned);
                      }}
                      placeholder="Ex: 1 ou 0.5"
                      className="flex-1 min-w-0 w-full h-8 px-2.5 text-center font-black text-sm text-slate-900 bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    <button
                      type="button"
                      onClick={() => handleStepGradeAdjustAmount(0.5)}
                      className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
                      title="Augmenter de 0,5"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.8]" />
                    </button>
                  </div>
                </div>

                {/* RÉSUMÉ + BOUTON APPLIQUER */}
                <div className="pt-1 space-y-2 border-t border-slate-100">
                  <p className="text-[10px] text-slate-500 leading-snug">
                    {gradeAdjustMode === 'all' ? (
                      <>
                        Applique{' '}
                        <strong className={gradeAdjustSign === 'add' ? 'text-emerald-700' : 'text-rose-700'}>
                          {gradeAdjustSign === 'add' ? '+' : '−'}{gradeAdjustAmountStr || '0'}
                        </strong>{' '}
                        sur <strong>toutes les notes saisies</strong> (les cases vides restent vides).
                      </>
                    ) : (
                      <>
                        Applique{' '}
                        <strong className={gradeAdjustSign === 'add' ? 'text-emerald-700' : 'text-rose-700'}>
                          {gradeAdjustSign === 'add' ? '+' : '−'}{gradeAdjustAmountStr || '0'}
                        </strong>{' '}
                        uniquement sur{' '}
                        <strong>
                          {columnMetas[gradeAdjustColIndex]?.title || 'NOTE'} {gradeAdjustColIndex + 1}
                        </strong>.
                      </>
                    )}
                  </p>

                  {gradeAdjustFeedback && (
                    <div className="px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10.5px] font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[3]" />
                      <span>{gradeAdjustFeedback}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleApplyGradeAdjustment}
                    className={`w-full py-2 rounded-lg text-xs font-extrabold text-white shadow-sm transition active:scale-[0.98] cursor-pointer ${
                      gradeAdjustSign === 'add'
                        ? 'bg-emerald-600 hover:bg-emerald-700'
                        : 'bg-rose-600 hover:bg-rose-700'
                    }`}
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </SmartFloatingPopover>
          </div>
          <span className="hidden sm:block text-[9px] text-slate-500 font-medium leading-none mb-0.5">Ajuster</span>
        </div>

        {/* Groupe Classement (Ordre de mérite / Alphabétique / Ordre initial) */}
        <div className="flex flex-col items-center justify-center sm:justify-between pl-2 sm:pl-2.5 border-l border-slate-300 shrink-0">
          <div className="flex items-center gap-1 sm:pt-1 relative">
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                const next = !isSortMenuOpen;
                closeAllMenus();
                if (next) {
                  setMenuAnchorEl(e.currentTarget);
                  setIsSortMenuOpen(true);
                }
              }}
              className={`gb-menu-trigger h-6 sm:h-7 px-2 sm:px-2.5 rounded-md border flex items-center gap-1 sm:gap-1.5 text-[10.5px] sm:text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95 outline-none focus:outline-none whitespace-nowrap ${
                isSortMenuOpen
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-slate-50'
              }`}
              title="Trier les élèves (Ordre de mérite, Alphabétique, Ordre initial)"
            >
              <ArrowUpDown className={`w-3.5 h-3.5 shrink-0 ${isSortMenuOpen ? 'text-sky-300' : 'text-blue-600'}`} />
              <span>
                {sortMode === 'merit'
                  ? 'Ordre de mérite'
                  : sortMode === 'alpha'
                  ? 'Alphabétique (A→Z)'
                  : 'Ordre initial'}
              </span>
              <ChevronDown className={`w-3 h-3 shrink-0 ${isSortMenuOpen ? 'text-white' : 'text-slate-400'}`} />
            </button>

            <SmartFloatingPopover
              open={isSortMenuOpen}
              anchorEl={menuAnchorEl}
              boundaryEl={gradebookContainerRef.current}
              preferredSide="bottom"
              preferredAlign="start"
              gap={8}
              onClose={closeAllMenus}
              ignoreOutsideSelector=".gb-menu-trigger"
              dataPopoverId="gb-sort-mode-menu"
              className="w-64 rounded-xl"
            >
              <div className="p-1.5 text-xs select-none">
                {(
                  [
                    {
                      id: 'merit' as GradebookSortMode,
                      label: 'Ordre de mérite (1er → dernier)',
                      desc: 'Classement par moyenne décroissante',
                    },
                    {
                      id: 'alpha' as GradebookSortMode,
                      label: 'Ordre alphabétique (A → Z)',
                      desc: 'Tri par nom et prénom',
                    },
                    {
                      id: 'order' as GradebookSortMode,
                      label: 'Ordre initial',
                      desc: 'Ordre de saisie dans le tableau',
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setLockedOrderIds(null);
                      setSortMode(opt.id);
                      setIsSaved(false);
                      setIsSortMenuOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded-lg transition cursor-pointer flex items-center justify-between gap-2 ${
                      sortMode === opt.id
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    <div>
                      <div className="text-[11.5px] font-extrabold leading-tight">
                        {opt.label}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                    {sortMode === opt.id && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-sky-400 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </SmartFloatingPopover>
          </div>
          <span className="hidden sm:block text-[9px] text-slate-500 font-medium leading-none mb-0.5">Classement</span>
        </div>

        {/* Groupes Mentions personnalisées, Colonne Matricule & Barème (ce tableau ou toute la classe) */}
        <MentionAndMatriculeControls
          effectiveMentionRules={effectiveMentionRules}
          hasCustomMentionRules={hasCustomMentionRules}
          showMatricule={effectiveShowMatricule}
          averageScale={effectiveAverageScale}
          noteColumns={noteColumnOptions}
          studentsCount={students.length}
          classLabel={
            schoolClass.name?.trim()
              ? schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
                ? schoolClass.name.trim()
                : `${schoolClass.level} • ${schoolClass.name.trim()}`
              : schoolClass.level
          }
          boundaryEl={gradebookContainerRef.current}
          onWillOpen={closeOtherMenus}
          closeSignal={closeMentionMatriculeSignal}
          onSaveMentionRules={handleSaveMentionRules}
          onSaveShowMatricule={handleSaveShowMatricule}
          onSaveAverageScale={handleSaveAverageScale}
          onBulkUpdateNoteMax={handleBulkUpdateNoteMax}
          effectiveColumnOrder={effectiveColumnOrder}
          hasCustomColumnOrder={hasCustomColumnOrder}
          includeTotalColumn={false}
          centerBlockLabel="NOTES 1…N"
          onSaveColumnOrder={handleSaveColumnOrder}
        />

        {/* Bouton Assistant Delmas (Robot bleu animé + "Assistant Delmas" écrit en bas, placé tout à droite du ruban) */}
        <TeacherDelmasAssistantRibbonButton
          isOpen={isDelmasAssistantOpen}
          onToggle={() => setIsDelmasAssistantOpen((prev) => !prev)}
        />
      </section>

      {/* ========================================================================= */}
      {/* 3. BARRE DE FORMULE EXCEL (Coordonnée active | fx | Champ de saisie) */}
      {/* ========================================================================= */}
      <section className="h-7 sm:h-8 bg-white border-b border-slate-300 px-1.5 sm:px-2 flex items-center gap-1.5 sm:gap-2 text-xs shrink-0 select-none relative z-20">
        <div className="flex items-center justify-between w-14 sm:w-22 h-5 sm:h-6 px-1 sm:px-1.5 bg-[#f9fafb] border border-slate-300 rounded text-slate-700 font-mono font-bold text-[10px] sm:text-[11px] shrink-0">
          <span className="truncate">{activeCellInfo.coordDisplay}</span>
          <ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-slate-400 shrink-0" />
        </div>
        <div className="w-[1px] h-4 bg-slate-300 shrink-0" />
        <div className="flex items-center justify-center w-4 sm:w-5 h-5 text-slate-500 font-serif italic font-bold text-[11px] sm:text-xs select-none shrink-0">
          fx
        </div>
        {(() => {
          const activeFormulaStd = activeCellInfo.rowIndex !== undefined ? studentsWithStats[activeCellInfo.rowIndex] : undefined;
          const activeFormulaKey = activeFormulaStd
            ? activeCellInfo.type === 'matricule'
              ? `${activeFormulaStd.id}_matricule`
              : activeCellInfo.type === 'name'
              ? `${activeFormulaStd.id}_name`
              : activeCellInfo.type === 'note' && activeCellInfo.noteColIndex !== undefined
              ? `${activeFormulaStd.id}_${activeCellInfo.noteColIndex}`
              : activeCellInfo.type === 'rank'
              ? `${activeFormulaStd.id}_rank`
              : activeCellInfo.type === 'average'
              ? `${activeFormulaStd.id}_avg`
              : activeCellInfo.type === 'mention'
              ? `${activeFormulaStd.id}_mention`
              : ''
            : '';
          const activeFormulaCellType =
            activeCellInfo.type === 'matricule' ||
            activeCellInfo.type === 'name' ||
            activeCellInfo.type === 'note' ||
            activeCellInfo.type === 'rank' ||
            activeCellInfo.type === 'average' ||
            activeCellInfo.type === 'mention'
              ? activeCellInfo.type
              : undefined;
          return (
            <input
              id="input-formula-bar"
              type="text"
              data-cell-key={activeFormulaKey || undefined}
              data-cell-type={activeFormulaCellType}
              value={activeCellInfo.value}
              readOnly={activeCellInfo.type === 'rank' || activeCellInfo.type === 'average' || activeCellInfo.type === 'photo' || activeCellInfo.type === 'column' || activeCellInfo.type === 'mention'}
              onChange={(e) => {
                const val = e.target.value;
                setActiveCellInfo(prev => ({ ...prev, value: val }));
                if (activeCellInfo.type === 'matricule' && activeCellInfo.rowIndex !== undefined) {
                  const std = studentsWithStats[activeCellInfo.rowIndex];
                  if (std) handleMatriculeChange(std.id, val);
                } else if (activeCellInfo.type === 'name' && activeCellInfo.rowIndex !== undefined) {
                  const std = studentsWithStats[activeCellInfo.rowIndex];
                  if (std) handleNameChange(std.id, val);
                } else if (activeCellInfo.type === 'note' && activeCellInfo.rowIndex !== undefined && activeCellInfo.noteColIndex !== undefined) {
                  const std = studentsWithStats[activeCellInfo.rowIndex];
                  if (std) handleRawNoteChange(std.id, activeCellInfo.noteColIndex, val);
                }
              }}
              onSelect={(e) => {
                if (activeFormulaKey && activeFormulaCellType) {
                  syncInputHighlight(e.currentTarget, activeFormulaKey, activeFormulaCellType);
                }
              }}
              onMouseUp={(e) => {
                if (activeFormulaKey && activeFormulaCellType) {
                  syncInputHighlight(e.currentTarget, activeFormulaKey, activeFormulaCellType);
                }
              }}
              onKeyUp={(e) => {
                if (activeFormulaKey && activeFormulaCellType) {
                  syncInputHighlight(e.currentTarget, activeFormulaKey, activeFormulaCellType);
                }
              }}
              onClick={(e) => {
                if (activeFormulaKey && activeFormulaCellType) {
                  syncInputHighlight(e.currentTarget, activeFormulaKey, activeFormulaCellType);
                }
              }}
              onBlur={() => {
                if (!isFontFamilyMenuOpenRef.current) {
                  setHighlightedTarget(prev => prev?.elementId === 'input-formula-bar' ? null : prev);
                }
              }}
              placeholder="Modifier la case sélectionnée..."
              className="flex-1 min-w-0 h-5 sm:h-6 px-1.5 sm:px-2 bg-transparent text-slate-800 font-medium text-[11px] sm:text-xs outline-none focus:bg-blue-50/40 rounded transition"
            />
          );
        })()}
      </section>

      {/* ========================================================================= */}
      {/* 4. GRILLE DE TABLEUR EXCEL / WPS : TABLEAU ENRICHI AVEC LIGNES INTÉRIEURES */}
      {/* SÉLECTIONNABLES PAR DOUBLE-CLIC, GLISSABLES POUR AGRANDIR/RÉDUIRE,         */}
      {/* TEXTES PARFAITEMENT CENTRÉS ET RETOUR À LA LIGNE AUTOMATIQUE SANS COUPURE */}
      {/* ========================================================================= */}
      <div 
        ref={gridContainerRef}
        onTouchStart={(e) => {
          if (
            selectedLine &&
            e.touches.length === 1 &&
            !(e.target as HTMLElement)?.closest('[data-resize-handle="true"]')
          ) {
            setSelectedLine(null);
          }
        }}
        onClick={(e) => {
          const targetEl = e.target as HTMLElement;
          if (selectedLine && !targetEl?.closest('[data-resize-handle="true"]')) {
            setSelectedLine(null);
          }
          if (targetEl?.closest('button, input, select, textarea, [data-interactive="true"], [data-cell-key]')) {
            return;
          }
          closeAllMenus();
          setSelectedLine(null);
          setHighlightedTarget(null);
          if (blockedNoteTarget) setBlockedNoteTarget(null);
        }}
        className="flex-1 overflow-auto bg-[#fafbfc] relative p-0 touch-pan-x touch-pan-y"
      >
        {selectedLine && (
          <div className="sm:hidden sticky top-1.5 left-1/2 -translate-x-1/2 w-fit mx-auto z-50 px-2.5 py-1 rounded-full bg-blue-600/95 text-white text-[10px] font-bold shadow-lg flex items-center gap-1.5 pointer-events-auto">
            <span>Ligne sélectionnée · glissez pour ajuster</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedLine(null);
              }}
              className="px-1.5 py-0.2 rounded-full bg-white/20 text-[9.5px] font-extrabold"
            >
              OK
            </button>
          </div>
        )}
        <div
          className="inline-block min-w-full pb-24 sm:pb-20 pr-12 sm:pr-20"
          style={{ zoom: `${zoomPercent}%` }}
        >
          {/* Ligne d'en-tête de colonnes Excel (A, B, C, ... AV) — toujours strictement au-dessus de la grille */}
          <div className="gb-excel-hdr flex items-center mb-0 sticky top-0 z-30 select-none bg-[#f8fafc] border-b border-slate-300 shadow-2xs">
            <div className="gb-excel-hdr w-9 h-6 bg-[#f1f5f9] border-r border-b border-slate-300 text-[10px] flex items-center justify-center font-mono text-slate-500 shrink-0 sticky left-0 z-40">
              ◢
            </div>
            {Array.from({ length: backgroundColCount }).map((_, c) => (
              <div 
                key={`excel-col-letter-${c}`} 
                className="gb-excel-hdr w-16 h-6 border-r border-b border-slate-300 bg-[#f8fafc] text-slate-500 font-mono text-[10.5px] font-semibold flex items-center justify-center shrink-0"
              >
                {getExcelColumnLabel(c)}
              </div>
            ))}
          </div>

          <div className="flex items-stretch">
            {/* Colonne de numéros de lignes Excel à gauche (1, 2, 3...) — toujours strictement au-dessus du tableau */}
            <div className="gb-excel-gutter flex flex-col shrink-0 self-stretch select-none sticky left-0 z-20 bg-[#f8fafc] border-r border-slate-300 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.18)]">
              {Array.from({ length: backgroundRowCount }).map((_, r) => (
                <div 
                  key={`excel-row-num-${r}`} 
                  className="gb-excel-hdr w-9 h-11 border-b border-slate-300 bg-[#f8fafc] text-slate-500 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0"
                >
                  {r + 1}
                </div>
              ))}
            </div>

            {/* Zone principale isolée à z-0 pour qu'aucun élément du tableau ne passe au-dessus de 1, 2, 3... ou A, B, C... */}
            <div className="relative shrink-0 z-0 isolate">
              {/* Petites cases de fond au-dessus du tableau (Ligne 1) */}
              <div className="flex">
                {Array.from({ length: backgroundColCount }).map((_, c) => (
                  <div 
                    key={`top-grid-${c}`} 
                    className="gb-excel-margin w-16 h-6 border-r border-b border-slate-300 bg-white"
                  />
                ))}
              </div>

              <div className="flex items-start">
                {/* Petites cases de fond à gauche du tableau */}
                <div className="flex flex-col shrink-0">
                  {Array.from({ length: studentsWithStats.length + 3 }).map((_, r) => (
                    <div 
                      key={`left-grid-${r}`} 
                      className="gb-excel-margin w-16 h-11 border-b border-r border-slate-300 bg-white"
                    />
                  ))}
                </div>

                {/* =================================================================== */}
                {/* =================================================================== */}
                {/* =================================================================== */}
                {/* LE TABLEAU MODERNE PROFESSIONNEL (Bordures bien visibles et carrées) */}
                {/* RANG | PROFIL | NOM & PRÉNOM | NOTE 1... NOTE N | [+] | MOYENNE     */}
                {/* =================================================================== */}
                <div className="relative shrink-0 border-2 border-slate-900 bg-white shadow-xl w-fit">
                  {/* EN-TÊTE DU TABLEAU : MOTS EN GRAND CARACTÈRE, BIEN CENTRÉS */}
                  {(() => {
                    const hdrRank = getHeaderVisualStyles('header_rank');
                    const hdrPhoto = getHeaderVisualStyles('header_photo');
                    const hdrMatricule = getHeaderVisualStyles('header_matricule');
                    const hdrName = getHeaderVisualStyles('header_name');
                    const hdrAvg = getHeaderVisualStyles('header_avg');
                    const hdrMention = getHeaderVisualStyles('header_mention');
                    const peripheralHeaderCells: Partial<
                      Record<GradebookPeripheralColumnKey, React.ReactNode>
                    > = {
                      rank: (
                    <div 
                      style={{ width: `${effectiveColWidthRank}px`, minWidth: `${effectiveColWidthRank}px`, maxWidth: `${effectiveColWidthRank}px`, backgroundColor: hdrRank.containerBg }}
                      onClick={() => {
                        setActiveCellInfo({
                          id: 'header-rank',
                          type: 'column',
                          coordDisplay: 'RANG',
                          value: 'RANG'
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-rank') ? null : { type: 'col', id: 'col-rank' });
                      }}
                      className={`min-h-12 border-r ${isColActive('col-rank') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} flex items-center justify-center p-1 text-center ${hdrRank.containerBg ? '' : 'bg-[#f1f5f9]'} shrink-0 relative cursor-pointer`}
                      title="Rang de l'élève (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span style={hdrRank.textStyle} className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        RANG
                      </span>
                      {renderColHandle('col-rank')}
                    </div>
                      ),
                      photo: (
                    <div 
                      style={{ width: `${colWidthPhoto}px`, minWidth: `${colWidthPhoto}px`, maxWidth: `${colWidthPhoto}px`, backgroundColor: hdrPhoto.containerBg }}
                      onClick={() => {
                        setActiveCellInfo({
                          id: 'header-photo',
                          type: 'column',
                          coordDisplay: 'PROFIL',
                          value: 'PROFIL'
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-photo') ? null : { type: 'col', id: 'col-photo' });
                      }}
                      className={`min-h-12 border-r ${isColActive('col-photo') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} flex items-center justify-center p-1 text-center ${hdrPhoto.containerBg ? '' : 'bg-[#f1f5f9]'} shrink-0 relative cursor-pointer`}
                      title="Profil / Photo (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span style={hdrPhoto.textStyle} className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        PROFIL
                      </span>
                      {renderColHandle('col-photo')}
                    </div>
                      ),
                      matricule: effectiveShowMatricule ? (
                      <div
                        style={{
                          width: `${effectiveColWidthMatricule}px`,
                          minWidth: `${effectiveColWidthMatricule}px`,
                          maxWidth: `${effectiveColWidthMatricule}px`,
                          backgroundColor: hdrMatricule.containerBg,
                        }}
                        onClick={() => {
                          setActiveCellInfo({
                            id: 'header-matricule',
                            type: 'column',
                            coordDisplay: 'MATRICULE',
                            value: 'MATRICULE',
                          });
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-matricule') ? null : { type: 'col', id: 'col-matricule' });
                        }}
                        className={`min-h-12 border-r ${isColActive('col-matricule') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} flex items-center justify-center p-1 text-center ${hdrMatricule.containerBg ? '' : 'bg-[#f1f5f9]'} shrink-0 relative cursor-pointer`}
                        title="Matricule de l'étudiant (Double-cliquer pour sélectionner le trait vertical)"
                      >
                        <span style={hdrMatricule.textStyle} className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                          MATRICULE
                        </span>
                        {renderColHandle('col-matricule')}
                      </div>
                      ) : null,
                      name: (
                    <div 
                      style={{ width: `${effectiveColWidthName}px`, minWidth: `${effectiveColWidthName}px`, maxWidth: `${effectiveColWidthName}px`, backgroundColor: hdrName.containerBg }}
                      onClick={() => {
                        setActiveCellInfo({
                          id: 'header-name',
                          type: 'column',
                          coordDisplay: 'NOM & PRÉNOM',
                          value: 'NOM & PRÉNOM'
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-name') ? null : { type: 'col', id: 'col-name' });
                      }}
                      className={`min-h-12 border-r ${isColActive('col-name') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} flex items-center justify-center p-1 text-center ${hdrName.containerBg ? '' : 'bg-[#f1f5f9]'} shrink-0 relative group cursor-pointer`}
                      title="Nom et Prénom (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span style={hdrName.textStyle} className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        NOM & PRÉNOM
                      </span>

                      {/* BOUTON 3 POINTS ⋮ POUR LA COLONNE NOM & PRÉNOM */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = !activeMenuNameCol;
                          closeAllMenus();
                          if (next) {
                            setMenuAnchorEl(e.currentTarget);
                            setActiveMenuNameCol(true);
                          }
                        }}
                        className={`gb-menu-trigger absolute top-1 right-1 p-0.5 rounded transition cursor-pointer z-10 border-0 shadow-none ${
                          activeMenuNameCol
                            ? 'text-sky-600 bg-sky-100/70'
                            : 'text-slate-800 hover:text-black hover:bg-slate-200/60'
                        }`}
                        title="Options de la colonne NOM & PRÉNOM (Tri alphabétique, ajout d'élèves, etc.)"
                      >
                        <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      {/* MENU CONTEXTUEL POUR NOM & PRÉNOM (PORTAIL ANTI-OBSTACLE) */}
                      <SmartFloatingPopover
                        open={activeMenuNameCol}
                        anchorEl={menuAnchorEl}
                        boundaryEl={gradebookContainerRef.current}
                        preferredSide="bottom"
                        preferredAlign="start"
                        gap={6}
                        onClose={closeAllMenus}
                        ignoreOutsideSelector=".gb-menu-trigger"
                        dataPopoverId="gb-name-col-menu"
                        className="w-56 rounded-lg"
                      >
                        <div className="py-1.5 text-left text-xs select-none">
                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Tri alphabétique
                          </div>

                          {/* 1. Trier A à Z */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuNameCol(false);
                              handleSortStudents('asc');
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5 text-blue-600" />
                            <span>Trier de A à Z</span>
                          </button>

                          {/* 2. Trier Z à A */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuNameCol(false);
                              handleSortStudents('desc');
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                          >
                            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600 rotate-180" />
                            <span>Trier de Z à A (Inversé)</span>
                          </button>

                          <div className="my-1 border-t border-slate-100" />

                          <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Gestion des élèves
                          </div>

                          {/* 3. Ajouter un élève */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuNameCol(false);
                              handleAddStudentRow();
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition"
                          >
                            <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Ajouter un élève (+1)</span>
                          </button>

                          {/* 4. Ajouter 5 élèves */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuNameCol(false);
                              handleAddMultipleStudentRows(5);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 transition"
                          >
                            <Plus className="w-3.5 h-3.5 text-teal-600" />
                            <span>Ajouter 5 élèves (+5)</span>
                          </button>

                          <div className="my-1 border-t border-slate-100" />

                          {/* 5. Vider tous les noms */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuNameCol(false);
                              if (window.confirm("Voulez-vous vraiment effacer tous les noms d'élèves de cette classe ?")) {
                                setStudents(prev => prev.map(s => ({ ...s, name: '' })));
                                setIsSaved(false);
                              }
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-700 transition"
                          >
                            <Eraser className="w-3.5 h-3.5 text-amber-600" />
                            <span>Effacer tous les noms</span>
                          </button>

                          {/* 6. Réinitialiser la largeur */}
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuNameCol(false);
                              setColWidthName(190);
                            }}
                            className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-slate-50 text-slate-600 transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                            <span>Largeur par défaut (190px)</span>
                          </button>
                        </div>
                      </SmartFloatingPopover>

                      {renderColHandle('col-name')}
                    </div>
                      ),
                      average: (
                    <div 
                      style={{ width: `${effectiveColWidthAverage}px`, minWidth: `${effectiveColWidthAverage}px`, maxWidth: `${effectiveColWidthAverage}px`, backgroundColor: hdrAvg.containerBg }}
                      onClick={() => {
                        setActiveCellInfo({
                          id: 'header-average',
                          type: 'column',
                          coordDisplay: 'MOYENNE',
                          value: 'MOYENNE'
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-moyenne') ? null : { type: 'col', id: 'col-moyenne' });
                      }}
                      className={`min-h-12 border-r ${
                        isColActive('col-moyenne') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'
                      } flex flex-col items-center justify-center p-1 text-center ${hdrAvg.containerBg ? '' : 'bg-blue-100/70'} shrink-0 relative cursor-pointer`}
                      title={`Moyenne ramenée sur /${effectiveScaleLabel} (Double-cliquer pour sélectionner le trait vertical)`}
                    >
                      <span style={hdrAvg.textStyle} className="font-black text-xs sm:text-sm text-blue-950 tracking-wider uppercase leading-none">
                        MOYENNE
                      </span>
                      <span
                        style={hdrAvg.custom?.color ? { color: hdrAvg.custom.color, opacity: 0.85 } : undefined}
                        className="text-[9.5px] font-extrabold text-blue-700 leading-none mt-0.5"
                      >
                        /{effectiveScaleLabel}
                      </span>
                      {renderColHandle('col-moyenne')}
                    </div>
                      ),
                      mention: (
                    <div 
                      style={{ width: `${effectiveColWidthMention}px`, minWidth: `${effectiveColWidthMention}px`, maxWidth: `${effectiveColWidthMention}px`, backgroundColor: hdrMention.containerBg }}
                      onClick={() => {
                        setActiveCellInfo({
                          id: 'header-mention',
                          type: 'column',
                          coordDisplay: 'MENTION',
                          value: 'MENTION'
                        });
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-mention') ? null : { type: 'col', id: 'col-mention' });
                      }}
                      className={`min-h-12 border-r ${
                        isColActive('col-mention') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'
                      } flex items-center justify-center p-1 text-center ${hdrMention.containerBg ? '' : 'bg-emerald-100/70'} shrink-0 relative cursor-pointer`}
                      title="Mention pédagogique (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span style={hdrMention.textStyle} className="font-black text-xs sm:text-sm text-emerald-950 tracking-wider uppercase">
                        MENTION
                      </span>
                      {renderColHandle('col-mention')}
                    </div>
                      ),
                    };

                    return (
                  <div className="flex bg-[#f1f5f9] border-b-2 border-slate-900 select-none items-stretch text-slate-900 w-fit">
                    {visibleColumnOrder.left.map((colKey) => (
                      <React.Fragment key={`hdr-l-${colKey}`}>
                        {peripheralHeaderCells[colKey]}
                      </React.Fragment>
                    ))}

                    {/* 4. COLONNES DE NOTES DYNAMIQUES */}
                    {Array.from({ length: noteColumnCount }).map((_, i) => {
                      const colMeta = columnMetas[i] || { maxScore: 20 };
                      const colTitle = colMeta.title || 'NOTE';
                      const hdrNote = getHeaderVisualStyles(
                        `header_note_${i}`,
                        colMeta.headerBgColor || colMeta.columnBgColor || '#f1f5f9'
                      );
                      const headerBg = hdrNote.containerBg || '#f1f5f9';
                      const isMovingThis = movingColIndex === i;
                      const isMenuOpen = activeMenuCol === i;
                      const thisColWidth = getColWidth(`col-note-${i}`);

                      return (
                        <div 
                          key={`header-note-${i}`}
                          style={{ 
                            width: `${thisColWidth}px`,
                            minWidth: `${thisColWidth}px`,
                            maxWidth: `${thisColWidth}px`,
                            backgroundColor: headerBg 
                          }}
                          onClick={() => {
                            setActiveCellInfo({
                              id: `header-note-${i}`,
                              type: 'column',
                              noteColIndex: i,
                              coordDisplay: `${colTitle} ${i + 1}`,
                              value: `${colTitle} ${i + 1} (Barème: ${colMeta.maxScore})`
                            });
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setSelectedLine(prev => (prev?.type === 'col' && prev.id === `col-note-${i}`) ? null : { type: 'col', id: `col-note-${i}` });
                          }}
                          className={`min-h-12 border-r ${isColActive(`col-note-${i}`) ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} flex flex-col items-center justify-center p-1 text-center relative group shrink-0 transition-colors cursor-pointer ${
                            isMovingThis ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                          }`}
                          title={`${colTitle} ${i + 1} (Double-cliquer pour sélectionner le trait vertical)`}
                        >
                          {/* BANDEAU FLÈCHES BLEUES DE DÉPLACEMENT AU SOMMET DE LA COLONNE */}
                          {isMovingThis && (
                            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-blue-600 text-white rounded-full px-1.5 py-0.5 shadow-lg z-30 animate-in fade-in select-none">
                              <button
                                type="button"
                                disabled={i === 0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSwapColumns(i, i - 1);
                                }}
                                className={`w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-700 transition active:scale-90 ${
                                  i === 0 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                title="Déplacer cette colonne vers la gauche (←)"
                              >
                                <ArrowLeft className="w-3 h-3 stroke-[3]" />
                              </button>
                              <span className="text-[9px] font-bold px-0.5 whitespace-nowrap">
                                Déplacer
                              </span>
                              <button
                                type="button"
                                disabled={i >= noteColumnCount - 1}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSwapColumns(i, i + 1);
                                }}
                                className={`w-5 h-5 flex items-center justify-center rounded-full hover:bg-blue-700 transition active:scale-90 ${
                                  i >= noteColumnCount - 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                title="Déplacer cette colonne vers la droite (→)"
                              >
                                <ArrowRight className="w-3 h-3 stroke-[3]" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMovingColIndex(null);
                                }}
                                className="w-4 h-4 ml-0.5 flex items-center justify-center rounded-full hover:bg-red-500 text-white transition cursor-pointer"
                                title="Fermer le mode déplacement"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}

                          {/* TITRE ET NUMÉRO AUTOMATIQUE CENTRÉS SANS CHEVAUCHEMENT */}
                          <div className="w-full flex flex-col items-center justify-center px-4 select-none">
                            <span style={hdrNote.textStyle} className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase truncate text-center w-full leading-tight">
                              {colTitle} {i + 1}
                            </span>
                            <span
                              style={hdrNote.custom?.color ? { color: hdrNote.custom.color, opacity: 0.85 } : undefined}
                              className="text-[9.5px] font-bold text-slate-500 text-center w-full leading-tight mt-0.5"
                            >
                              /{colMeta.maxScore}{colMeta.coeffEval && colMeta.coeffEval !== 1 ? ` · c.${colMeta.coeffEval}` : ''}
                            </span>
                          </div>

                          {/* BOUTON 3 POINTS ⋮ SUR L'EN-TÊTE EN HAUT DANS L'ANGLE SANS GÊNER L'ÉCRITURE */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = activeMenuCol === i ? null : i;
                              closeAllMenus();
                              if (next !== null) {
                                setMenuAnchorEl(e.currentTarget);
                                setActiveMenuCol(next);
                              }
                            }}
                            className={`gb-menu-trigger absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-20 border-0 shadow-none ${
                              isMenuOpen
                                ? 'text-sky-600 bg-sky-100/70'
                                : 'text-slate-900 hover:text-black hover:bg-slate-200/60'
                            }`}
                            title={`Options de la colonne ${colTitle} ${i + 1}`}
                          >
                            <MoreVertical className="w-3 h-3 text-slate-900 stroke-[2.5]" />
                          </button>

                          {/* MENU CONTEXTUEL RECTANGULAIRE SOIGNÉ (PORTAIL ANTI-OBSTACLE) */}
                          <SmartFloatingPopover
                            open={isMenuOpen}
                            anchorEl={menuAnchorEl}
                            boundaryEl={gradebookContainerRef.current}
                            preferredSide="bottom"
                            preferredAlign="start"
                            gap={6}
                            onClose={closeAllMenus}
                            ignoreOutsideSelector=".gb-menu-trigger"
                            dataPopoverId={`gb-note-col-menu-${i}`}
                            className="w-56 rounded-lg"
                          >
                            <div className="py-1.5 text-left text-xs select-none">
                              {/* 1. Modifier */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuCol(null);
                                  setEditingColModal({
                                    colIndex: i,
                                    title: colMeta.title || 'NOTE',
                                    maxScore: colMeta.maxScore || 20,
                                    coeffEval: colMeta.coeffEval ?? 1
                                  });
                                }}
                                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Modifier intitulé, barème & coef</span>
                              </button>

                              {/* 2. Déplacer la colonne */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuCol(null);
                                  setMovingColIndex(i);
                                }}
                                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                              >
                                <svg className="w-3.5 h-3.5 text-indigo-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="5 9 2 12 5 15" />
                                  <polyline points="9 5 12 2 15 5" />
                                  <polyline points="15 19 12 22 9 19" />
                                  <polyline points="19 9 22 12 19 15" />
                                  <line x1="2" y1="12" x2="22" y2="12" />
                                  <line x1="12" y1="2" x2="12" y2="22" />
                                </svg>
                                <span>Déplacer la colonne</span>
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              {/* 3. Vider toute la colonne */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuCol(null);
                                  handleClearColumnNotes(i);
                                }}
                                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-700 transition"
                              >
                                <Eraser className="w-3.5 h-3.5 text-amber-600" />
                                <span>Vider toute la colonne</span>
                              </button>

                              {/* 4. Supprimer toute la colonne */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuCol(null);
                                  handleDeleteNoteColumn(i);
                                }}
                                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-50 text-red-600 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                <span>Supprimer toute la colonne</span>
                              </button>

                              <div className="my-1 border-t border-slate-100" />

                              {/* 5. Colorer la case (en-tête) */}
                              <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Couleurs
                              </div>

                              <button
                                type="button"
                                onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'cell' && activeColorPicker?.colIndex === i ? null : { mode: 'cell', colIndex: i })}
                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                              >
                                <div className="flex items-center gap-2">
                                  <Palette className="w-3.5 h-3.5 text-teal-600" />
                                  <span>Colorer la case</span>
                                </div>
                                <span className="text-[10px] text-slate-400">▸</span>
                              </button>

                              {/* 6. Colorer toute la colonne */}
                              <button
                                type="button"
                                onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'column' && activeColorPicker?.colIndex === i ? null : { mode: 'column', colIndex: i })}
                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                              >
                                <div className="flex items-center gap-2">
                                  <Palette className="w-3.5 h-3.5 text-violet-600" />
                                  <span>Colorer toute la colonne</span>
                                </div>
                                <span className="text-[10px] text-slate-400">▸</span>
                              </button>

                              {/* 7. Colorer toute la ligne */}
                              <button
                                type="button"
                                onClick={() => {
                                  const targetStudentId = activeCellInfo.rowIndex >= 0 ? studentsWithStats[activeCellInfo.rowIndex]?.id : studentsWithStats[0]?.id;
                                  if (targetStudentId) {
                                    setActiveColorPicker(activeColorPicker?.mode === 'row' && activeColorPicker?.targetId === `header-${i}` ? null : { mode: 'row', studentId: targetStudentId, targetId: `header-${i}` });
                                  }
                                }}
                                className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                              >
                                <div className="flex items-center gap-2">
                                  <Palette className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Colorer toute la ligne {activeCellInfo.rowIndex >= 0 ? `(${activeCellInfo.rowIndex + 1})` : ''}</span>
                                </div>
                                <span className="text-[10px] text-slate-400">▸</span>
                              </button>

                              {/* Palette popup */}
                              {activeColorPicker && (
                                (activeColorPicker.colIndex === i && (activeColorPicker.mode === 'cell' || activeColorPicker.mode === 'column')) ||
                                (activeColorPicker.mode === 'row' && activeColorPicker.targetId === `header-${i}`)
                              ) && (
                                renderPaletteGrid(
                                  activeColorPicker.mode === 'cell'
                                    ? 'Couleur de la case (En-tête) :'
                                    : activeColorPicker.mode === 'column'
                                    ? 'Couleur de toute la colonne :'
                                    : `Couleur de toute la ligne ${activeCellInfo.rowIndex >= 0 ? `${activeCellInfo.rowIndex + 1}` : ''} :`
                                )
                              )}
                            </div>
                          </SmartFloatingPopover>

                          {/* Poignée interactive de sélection & redimensionnement de colonne */}
                          {renderColHandle(`col-note-${i}`)}
                        </div>
                      );
                    })}

                    {/* 5. BOUTON [+] AJOUTER UNE NOUVELLE NOTE */}
                    <div 
                      style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                      className="min-h-12 border-r border-slate-700 flex items-center justify-center bg-slate-200/70 hover:bg-blue-100 transition cursor-pointer shrink-0 relative"
                      onClick={handleAddNoteColumn}
                      title="Ajouter une colonne de note (Note suivante)"
                    >
                      <button
                        type="button"
                        className="w-7 h-7 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center shadow-xs transition active:scale-95 cursor-pointer"
                      >
                        <Plus className="w-4 h-4 stroke-[3]" />
                      </button>
                    </div>

                    {visibleColumnOrder.right.map((colKey) => (
                      <React.Fragment key={`hdr-r-${colKey}`}>
                        {peripheralHeaderCells[colKey]}
                      </React.Fragment>
                    ))}
                  </div>
                    );
                  })()}

                  {/* ================================================================= */}
                  {/* CORPS DU TABLEAU : LIGNES D'ÉLÈVES BIEN TRACÉES                   */}
                  {/* ================================================================= */}
                  <div className="bg-white">
                    {studentsWithStats.map((std, rIdx) => {
                      const isRowSelected = activeCellInfo.rowIndex === rIdx;
                      const rowHeight = Math.max(customRowHeights[rIdx] || 44, getRowMinHeightForContent(std));
                      const isRowLineActive = isRowActive(rIdx);
                      const rowBg = rowColors[std.id];
                      const matriculeCellStyle = getResolvedCellStyle(`${std.id}_matricule`, 'center');
                      const matriculeCellBg = matriculeCellStyle.backgroundColor || cellColors[`${std.id}_matricule`] || rowBg || undefined;
                      const nameCellStyle = getResolvedCellStyle(`${std.id}_name`, 'center');
                      const nameCellBg = nameCellStyle.backgroundColor || cellColors[`${std.id}_name`] || rowBg || undefined;
                      const rankCustom = cellCustomStyles[`${std.id}_rank`];
                      const rankCellStyle = getResolvedCellStyle(`${std.id}_rank`, 'center');
                      const rankCellBg = rankCellStyle.backgroundColor || cellColors[`${std.id}_rank`] || rowBg || undefined;
                      const photoCellBg = cellCustomStyles[`${std.id}_photo`]?.bgColor || cellColors[`${std.id}_photo`] || rowBg || undefined;
                      const avgCustom = cellCustomStyles[`${std.id}_avg`];
                      const avgCellStyle = getResolvedCellStyle(`${std.id}_avg`, 'center');
                      const avgCellBg = avgCustom?.bgColor || cellColors[`${std.id}_avg`] || rowBg || undefined;
                      const mentionCustom = cellCustomStyles[`${std.id}_mention`];
                      const mentionCellStyle = getResolvedCellStyle(`${std.id}_mention`, 'center');
                      const mentionCellBg = mentionCustom?.bgColor || cellColors[`${std.id}_mention`] || rowBg || undefined;
                      const isRowMenuOpen = activeMenuRow === std.id || activeMenuPhoto === std.id || activeMenuCell?.studentId === std.id;

                      const peripheralBodyCells: Partial<
                        Record<GradebookPeripheralColumnKey, React.ReactNode>
                      > = {
                        rank: (
                          <div 
                            style={{ 
                              width: `${effectiveColWidthRank}px`, 
                              minWidth: `${effectiveColWidthRank}px`,
                              maxWidth: `${effectiveColWidthRank}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: rankCellBg
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              const rowKey = `row-${rIdx}`;
                              setSelectedLine(prev => (prev?.type === 'row' && prev.id === rowKey) ? null : { type: 'row', id: rowKey });
                            }}
                            onClick={() => {
                              setActiveCellInfo({
                                id: `cell-rank-${rIdx}`,
                                type: 'rank',
                                rowIndex: rIdx,
                                coordDisplay: `RANG${rIdx + 1}`,
                                value: std.rank ? `=RANG(M${rIdx + 1})` : ''
                              });
                            }}
                            className={`border-r ${isColActive('col-rank') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'} flex items-center justify-center p-1 cursor-pointer relative shrink-0 ${
                              activeCellInfo.id === `cell-rank-${rIdx}` ? `outline-2 outline-[#107c41] -outline-offset-2 z-10 ${rankCellBg ? '' : 'bg-emerald-50/40'}` : ''
                            }`}
                            title="Cliquer pour sélectionner, double-cliquer pour sélectionner la ligne"
                          >
                            {std.rank && std.rank !== '-' && std.rank !== '—' ? (
                              <span
                                data-cell-key={`${std.id}_rank`}
                                data-cell-type="rank"
                                style={rankCustom ? {
                                  fontWeight: rankCustom.bold !== undefined ? (rankCustom.bold ? '900' : '400') : undefined,
                                  fontStyle: rankCustom.italic ? 'italic' : undefined,
                                  textDecoration: rankCellStyle.textDecoration !== 'none' ? rankCellStyle.textDecoration : undefined,
                                  fontFamily: rankCustom.fontFamily || undefined,
                                  fontSize: rankCustom.fontSize ? `${rankCustom.fontSize}px` : undefined,
                                  color: rankCustom.color || undefined
                                } : undefined}
                                className={`select-text cursor-text px-2.5 py-1 rounded-md text-sm sm:text-base font-black shadow-xs tracking-tight ${
                                  std.rank.startsWith('1er')
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border border-amber-400 ring-2 ring-amber-300/60'
                                    : std.rank.startsWith('2e')
                                    ? 'bg-slate-200 text-slate-900 border border-slate-300'
                                    : std.rank.startsWith('3e')
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : 'bg-slate-100 text-slate-800 border border-slate-200'
                                }`}
                              >
                                {std.rank}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-sm font-bold">—</span>
                            )}
                            {renderColHandle('col-rank')}
                          </div>
                        ),
                        photo: (
                          <div 
                            style={{ 
                              width: `${colWidthPhoto}px`, 
                              minWidth: `${colWidthPhoto}px`,
                              maxWidth: `${colWidthPhoto}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: photoCellBg
                            }}
                            className={`border-r ${isColActive('col-photo') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'} flex items-center justify-center p-0 relative group shrink-0 ${
                              activeCellInfo.id === `cell-photo-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' : ''
                            }`}
                            title={std.photoUrl ? "Cliquer pour voir la photo de l'élève" : "Cliquer pour ajouter une photo"}
                          >
                            {std.photoUrl ? (
                              <div className="w-full h-full relative group/photo">
                                {/* Conteneur avec overflow-hidden strictement pour l'image */}
                                <div className="w-full h-full overflow-hidden">
                                  <img 
                                    src={std.photoUrl} 
                                    alt={std.name || 'Élève'} 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewPhotoStudent(std);
                                    }}
                                    onError={() => {
                                      setStudents(prev =>
                                        prev.map(s =>
                                          s.id === std.id
                                            ? { ...s, photoUrl: undefined, photoR2Key: undefined, photoSizeBytes: undefined }
                                            : s
                                        )
                                      );
                                    }}
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition duration-200" 
                                  />
                                </div>

                                {/* BOUTON 3 POINTS ⋮ POUR LA PHOTO */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = activeMenuPhoto === std.id ? null : std.id;
                                    closeAllMenus();
                                    if (next !== null) {
                                      setMenuAnchorEl(e.currentTarget);
                                      setActiveMenuPhoto(next);
                                    }
                                  }}
                                  className={`gb-menu-trigger absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-30 border-0 shadow-none ${
                                    activeMenuPhoto === std.id
                                      ? 'text-white bg-black/70'
                                      : 'text-slate-900 hover:text-black bg-white/70 hover:bg-white/90 drop-shadow-xs'
                                  }`}
                                  title="Options de la photo (Remplacer / Supprimer)"
                                >
                                  <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>

                                {/* MENU CONTEXTUEL PHOTO (PORTAIL ANTI-OBSTACLE) */}
                                <SmartFloatingPopover
                                  open={activeMenuPhoto === std.id}
                                  anchorEl={menuAnchorEl}
                                  boundaryEl={gradebookContainerRef.current}
                                  preferredSide="bottom"
                                  preferredAlign="start"
                                  gap={6}
                                  onClose={closeAllMenus}
                                  ignoreOutsideSelector=".gb-menu-trigger"
                                  dataPopoverId={`gb-photo-menu-${std.id}`}
                                  className="w-48 rounded-lg"
                                >
                                  <div className="py-1.5 text-left text-xs select-none">
                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate border-b border-slate-100 pb-1 mb-1">
                                      Photo : {std.name || `Élève ${rIdx + 1}`}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuPhoto(null);
                                        handleTriggerPhotoUpload(std.id);
                                      }}
                                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-sky-50 text-slate-700 hover:text-sky-700 transition"
                                    >
                                      <Camera className="w-4 h-4 text-sky-600" />
                                      <span className="font-semibold">Remplacer la photo</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuPhoto(null);
                                        const oldKey = std.photoR2Key;
                                        setStudents(prev => prev.map(s => s.id === std.id ? { ...s, photoUrl: undefined, photoR2Key: undefined, photoSizeBytes: undefined } : s));
                                        setIsSaved(false);
                                        if (!disableCloudPersistence && getTeacherAuthToken()) {
                                          TeacherGradebookAPI.deleteStudentPhoto({
                                            subjectId: subject.id,
                                            termId: effectiveTermId,
                                            studentId: std.id,
                                            photoR2Key: oldKey,
                                          }).catch(() => {});
                                        }
                                      }}
                                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-red-50 text-red-600 transition"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                      <span className="font-semibold">Supprimer la photo</span>
                                    </button>
                                  </div>
                                </SmartFloatingPopover>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTriggerPhotoUpload(std.id)}
                                className={`w-full h-full flex flex-col items-center justify-center ${photoCellBg ? 'bg-transparent' : 'bg-slate-50'} hover:bg-blue-50/70 text-slate-400 hover:text-blue-600 transition cursor-pointer p-0.5`}
                                title="Cliquer pour importer une photo carrée"
                              >
                                <div className="w-7 h-7 rounded-md bg-white border border-slate-300 flex items-center justify-center shadow-xs">
                                  <Camera className="w-4 h-4 text-slate-500 stroke-[2]" />
                                </div>
                                <span className="text-[8.5px] font-bold mt-0.5 text-slate-500 leading-none">+ Photo</span>
                              </button>
                            )}
                            {renderColHandle('col-photo')}
                          </div>
                        ),
                        matricule: effectiveShowMatricule ? (
                            <div
                              style={{
                                width: `${effectiveColWidthMatricule}px`,
                                minWidth: `${effectiveColWidthMatricule}px`,
                                maxWidth: `${effectiveColWidthMatricule}px`,
                                height: `${rowHeight}px`,
                                backgroundColor: matriculeCellBg,
                              }}
                              onClick={() => {
                                setActiveCellInfo({
                                  id: `cell-matricule-${rIdx}`,
                                  type: 'matricule',
                                  rowIndex: rIdx,
                                  coordDisplay: `MAT${rIdx + 1}`,
                                  value: std.matricule || '',
                                });
                              }}
                              className={`border-r ${isColActive('col-matricule') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'} flex items-center p-1.5 relative group shrink-0 ${
                                activeCellInfo.id === `cell-matricule-${rIdx}` ? `outline-2 outline-[#107c41] -outline-offset-2 z-10 ${matriculeCellBg ? '' : 'bg-blue-50/30'}` : ''
                              }`}
                            >
                              <input
                                id={`input-matricule-${std.id}`}
                                type="text"
                                data-cell-key={`${std.id}_matricule`}
                                data-cell-type="matricule"
                                value={std.matricule || ''}
                                maxLength={48}
                                onChange={(e) => {
                                  const nextVal = e.target.value;
                                  handleMatriculeChange(std.id, nextVal);
                                  setActiveCellInfo((prev) =>
                                    prev.id === `cell-matricule-${rIdx}` ? { ...prev, value: nextVal } : prev
                                  );
                                }}
                                onFocus={(e) => {
                                  if (sortMode !== 'order' && !lockedOrderIds) {
                                    setLockedOrderIds(studentsWithStats.map((s) => s.id));
                                  }
                                  setActiveCellInfo({
                                    id: `cell-matricule-${rIdx}`,
                                    type: 'matricule',
                                    rowIndex: rIdx,
                                    coordDisplay: `MAT${rIdx + 1}`,
                                    value: std.matricule || '',
                                  });
                                  syncInputHighlight(e.currentTarget, `${std.id}_matricule`, 'matricule');
                                }}
                                onBlur={() => {
                                  window.setTimeout(() => {
                                    const activeTag = document.activeElement?.tagName;
                                    if (activeTag !== 'INPUT') {
                                      setLockedOrderIds(null);
                                    }
                                  }, 80);
                                }}
                                onSelect={(e) => syncInputHighlight(e.currentTarget, `${std.id}_matricule`, 'matricule')}
                                onMouseUp={(e) => syncInputHighlight(e.currentTarget, `${std.id}_matricule`, 'matricule')}
                                onKeyUp={(e) => syncInputHighlight(e.currentTarget, `${std.id}_matricule`, 'matricule')}
                                placeholder="Matricule..."
                                style={{
                                  fontFamily: matriculeCellStyle.fontFamily,
                                  fontSize: matriculeCellStyle.fontSize,
                                  fontWeight: matriculeCellStyle.fontWeight,
                                  fontStyle: matriculeCellStyle.fontStyle,
                                  textDecoration: matriculeCellStyle.textDecoration,
                                  color: matriculeCellStyle.color,
                                  textAlign: matriculeCellStyle.textAlign,
                                }}
                                className="w-full h-full bg-transparent outline-none px-1 font-mono text-slate-800 placeholder:text-slate-400/80 placeholder:font-sans placeholder:text-[11px]"
                              />
                              {renderColHandle('col-matricule')}
                            </div>
                        ) : null,
                        name: (
                          <div 
                            style={{ 
                              width: `${effectiveColWidthName}px`, 
                              minWidth: `${effectiveColWidthName}px`,
                              maxWidth: `${effectiveColWidthName}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: nameCellBg
                            }}
                            onClick={() => {
                              setActiveCellInfo({
                                id: `cell-name-${rIdx}`,
                                type: 'name',
                                rowIndex: rIdx,
                                coordDisplay: `NOM${rIdx + 1}`,
                                value: std.name
                              });
                            }}
                            className={`border-r ${isColActive('col-name') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'} flex items-center p-1.5 relative group shrink-0 ${
                              blockedNoteTarget?.studentId === std.id && !(std.name || '').trim() ? 'ring-2 ring-red-500 bg-red-50/60' : ''
                            } ${
                              activeCellInfo.id === `cell-name-${rIdx}` ? `outline-2 outline-[#107c41] -outline-offset-2 z-10 ${nameCellBg ? '' : 'bg-blue-50/30'}` : ''
                            }`}
                          >
                            <input
                              id={`input-name-${std.id}`}
                              type="text"
                              data-cell-key={`${std.id}_name`}
                              data-cell-type="name"
                              value={std.name}
                              onChange={(e) => {
                                handleNameChange(std.id, e.target.value);
                                if (blockedNoteTarget?.studentId === std.id && e.target.value.trim()) {
                                  setBlockedNoteTarget(null);
                                }
                                if (!disableCloudPersistence && classRoster.length > 0) {
                                  setRosterSuggestState({
                                    studentId: std.id,
                                    anchorEl: e.currentTarget,
                                    highlightIdx: 0,
                                  });
                                }
                              }}
                              onFocus={(e) => {
                                if (sortMode !== 'order' && !lockedOrderIds) {
                                  setLockedOrderIds(studentsWithStats.map((s) => s.id));
                                }
                                setActiveCellInfo({
                                  id: `cell-name-${rIdx}`,
                                  type: 'name',
                                  rowIndex: rIdx,
                                  coordDisplay: `NOM${rIdx + 1}`,
                                  value: std.name
                                });
                                syncInputHighlight(e.currentTarget, `${std.id}_name`, 'name');
                                if (!disableCloudPersistence && classRoster.length > 0) {
                                  setRosterSuggestState({
                                    studentId: std.id,
                                    anchorEl: e.currentTarget,
                                    highlightIdx: 0,
                                  });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (
                                  rosterSuggestState?.studentId === std.id &&
                                  activeRosterSuggestions.length > 0
                                ) {
                                  if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setRosterSuggestState((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            highlightIdx:
                                              (prev.highlightIdx + 1) %
                                              activeRosterSuggestions.length,
                                          }
                                        : null
                                    );
                                  } else if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setRosterSuggestState((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            highlightIdx:
                                              (prev.highlightIdx -
                                                1 +
                                                activeRosterSuggestions.length) %
                                              activeRosterSuggestions.length,
                                          }
                                        : null
                                    );
                                  } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    const picked =
                                      activeRosterSuggestions[
                                        rosterSuggestState.highlightIdx
                                      ] || activeRosterSuggestions[0];
                                    if (picked) {
                                      handleApplyRosterSuggestion(std.id, picked);
                                    }
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    setRosterSuggestState(null);
                                  }
                                }
                              }}
                              onSelect={(e) => syncInputHighlight(e.currentTarget, `${std.id}_name`, 'name')}
                              onMouseUp={(e) => syncInputHighlight(e.currentTarget, `${std.id}_name`, 'name')}
                              onKeyUp={(e) => syncInputHighlight(e.currentTarget, `${std.id}_name`, 'name')}
                              onClick={(e) => syncInputHighlight(e.currentTarget, `${std.id}_name`, 'name')}
                              onBlur={(e) => {
                                setLockedOrderIds(null);
                                if (!isFontFamilyMenuOpenRef.current) {
                                  setHighlightedTarget(prev => prev?.elementId === `input-name-${std.id}` ? null : prev);
                                }
                                handleAutoLinkUniqueRosterStudentOnBlur(std.id, e.currentTarget.value);
                                window.setTimeout(() => {
                                  setRosterSuggestState((prev) =>
                                    prev?.studentId === std.id ? null : prev
                                  );
                                }, 140);
                              }}
                              placeholder={`Nom et prénom élève ${rIdx + 1}...`}
                              className={`w-full h-full text-center px-2 text-xs sm:text-sm text-slate-950 placeholder:text-slate-400 placeholder:font-medium placeholder:not-italic placeholder:no-underline bg-transparent outline-none border border-transparent focus:border-blue-500 ${nameCellBg ? 'focus:bg-transparent' : 'focus:bg-white/70'} rounded transition pr-5`}
                              style={Boolean(std.name) ? {
                                ...nameCellStyle,
                                backgroundColor: 'transparent'
                              } : {
                                backgroundColor: 'transparent',
                                textAlign: nameCellStyle.textAlign
                              }}
                            />

                            {/* BOUTON 3 POINTS ⋮ POUR CETTE CASE NOM & PRÉNOM */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const next = activeMenuRow === std.id ? null : std.id;
                                closeAllMenus();
                                if (next !== null) {
                                  setMenuAnchorEl(e.currentTarget);
                                  setActiveMenuRow(next);
                                }
                              }}
                              className={`gb-menu-trigger absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-10 border-0 shadow-none ${
                                activeMenuRow === std.id
                                  ? 'text-sky-600 bg-sky-100/70'
                                  : 'text-slate-700 hover:text-black hover:bg-slate-200/50'
                              }`}
                              title={`Options pour l'élève ${std.name || `n°${rIdx + 1}`}`}
                            >
                              <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* MENU CONTEXTUEL POUR LA CASE NOM (PORTAIL ANTI-OBSTACLE) */}
                            <SmartFloatingPopover
                              open={activeMenuRow === std.id}
                              anchorEl={menuAnchorEl}
                              boundaryEl={gradebookContainerRef.current}
                              preferredSide="bottom"
                              preferredAlign="start"
                              gap={6}
                              onClose={closeAllMenus}
                              ignoreOutsideSelector=".gb-menu-trigger"
                              dataPopoverId={`gb-row-menu-${std.id}`}
                              className="w-56 rounded-lg"
                            >
                              <div className="py-1.5 text-left text-xs select-none">
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate border-b border-slate-100 pb-1 mb-1">
                                  {std.name || `Élève ${rIdx + 1}`}
                                </div>

                                {/* Section COULEURS */}
                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Couleurs
                                </div>

                                {/* 1. Colorer la case */}
                                <button
                                  type="button"
                                  onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'singleCell' && activeColorPicker?.studentId === std.id && activeColorPicker?.colIndex === -1 ? null : { mode: 'singleCell', studentId: std.id, colIndex: -1 })}
                                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                                >
                                  <div className="flex items-center gap-2">
                                    <Palette className="w-3.5 h-3.5 text-teal-600" />
                                    <span>Colorer la case</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">▸</span>
                                </button>

                                {/* 2. Colorer toute la ligne */}
                                <button
                                  type="button"
                                  onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'row' && activeColorPicker?.studentId === std.id ? null : { mode: 'row', studentId: std.id })}
                                  className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                                >
                                  <div className="flex items-center gap-2">
                                    <Palette className="w-3.5 h-3.5 text-amber-600" />
                                    <span>Colorer toute la ligne</span>
                                  </div>
                                  <span className="text-[10px] text-slate-400">▸</span>
                                </button>

                                {/* Palette popup */}
                                {activeColorPicker && (
                                  (activeColorPicker.mode === 'singleCell' && activeColorPicker.studentId === std.id && activeColorPicker.colIndex === -1) ||
                                  (activeColorPicker.mode === 'row' && activeColorPicker.studentId === std.id)
                                ) && (
                                  renderPaletteGrid(
                                    activeColorPicker.mode === 'singleCell'
                                      ? 'Couleur de cette case (Nom) :'
                                      : 'Couleur de toute la ligne :'
                                  )
                                )}

                                <div className="my-1 border-t border-slate-100" />

                                <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                  Actions
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuRow(null);
                                    handleNameChange(std.id, '');
                                  }}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-700 transition"
                                >
                                  <Eraser className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Effacer ce nom</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuRow(null);
                                    handleClearStudentNotes(std.id);
                                  }}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-700 transition"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Vider les notes de cet élève</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveMenuRow(null);
                                    handleDeleteStudentRow(std.id);
                                  }}
                                  className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-red-50 text-red-600 transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                  <span>Supprimer cet élève</span>
                                </button>
                              </div>
                            </SmartFloatingPopover>
                            {renderColHandle('col-name')}
                          </div>
                        ),
                        average: (
                          <div 
                            style={{ 
                              width: `${effectiveColWidthAverage}px`, 
                              minWidth: `${effectiveColWidthAverage}px`,
                              maxWidth: `${effectiveColWidthAverage}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: std.hasInvalidNote ? '#f1f5f9' : avgCellBg
                            }}
                            onMouseDown={(e) => {
                              // Empêcher toute sélection de texte ou de case dans la colonne Moyenne
                              if (!(e.target as HTMLElement)?.closest('button, [data-interactive="true"]')) {
                                e.preventDefault();
                              }
                            }}
                            className={`border-r ${isColActive('col-moyenne') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${
                              isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'
                            } flex items-center justify-between px-2 select-none cursor-default relative shrink-0 transition-colors ${
                              std.hasInvalidNote
                                ? 'bg-slate-200 text-slate-400 border border-slate-300'
                                : avgCellBg ? '' : 'bg-blue-50/40'
                            }`}
                            title={
                              std.hasInvalidNote
                                ? 'Moyenne non calculée : une note dépasse le barème maximal'
                                : 'Moyenne générale calculée automatiquement (case bloquée)'
                            }
                          >
                            <span
                              style={avgCustom ? {
                                fontWeight: avgCustom.bold !== undefined ? (avgCustom.bold ? '900' : '400') : undefined,
                                fontStyle: avgCustom.italic ? 'italic' : undefined,
                                textDecoration: avgCellStyle.textDecoration !== 'none' ? avgCellStyle.textDecoration : undefined,
                                fontFamily: avgCustom.fontFamily || undefined,
                                fontSize: avgCustom.fontSize ? `${avgCustom.fontSize}px` : undefined,
                                color: avgCustom.color || undefined,
                                textAlign: avgCustom.textAlign || undefined,
                              } : undefined}
                              className={`w-full text-xs font-black tracking-tight flex items-center gap-1 select-none pointer-events-none ${
                                avgCustom?.textAlign === 'left'
                                  ? 'justify-start text-left'
                                  : avgCustom?.textAlign === 'right'
                                  ? 'justify-end text-right'
                                  : 'justify-center text-center'
                              } ${
                                std.hasInvalidNote
                                  ? 'text-slate-400 font-mono text-sm tracking-widest'
                                  : std.average === null
                                  ? 'text-slate-300'
                                  : std.average >= effectiveAverageScale * 0.6
                                  ? 'text-emerald-700 bg-emerald-50/90 py-0.5 px-1.5 rounded border border-emerald-300'
                                  : std.average >= effectiveAverageScale * 0.5
                                  ? 'text-blue-700 bg-blue-50/90 py-0.5 px-1.5 rounded border border-blue-300'
                                  : 'text-rose-700 bg-rose-50/90 py-0.5 px-1.5 rounded border border-rose-300'
                              }`}
                            >
                              {std.hasInvalidNote ? (
                                '...'
                              ) : std.average !== null ? (
                                <>
                                  <span>{std.averageFormatted}</span>
                                  <span className="text-[10px] sm:text-[11px] opacity-75">
                                    / {effectiveScaleLabel}
                                  </span>
                                </>
                              ) : (
                                <span className="text-slate-300 font-semibold">—</span>
                              )}
                            </span>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteStudentRow(std.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 hover:text-red-600 p-0.5 rounded text-slate-300 hover:bg-red-50 transition"
                              title="Supprimer cette ligne d'élève"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {renderColHandle('col-moyenne')}
                          </div>
                        ),
                        mention: (
                          <div 
                            style={{ 
                              width: `${effectiveColWidthMention}px`, 
                              minWidth: `${effectiveColWidthMention}px`,
                              maxWidth: `${effectiveColWidthMention}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: std.hasInvalidNote ? '#f1f5f9' : mentionCellBg
                            }}
                            onMouseDown={(e) => {
                              // Empêcher toute sélection de texte ou de case dans la colonne Mention
                              if (!(e.target as HTMLElement)?.closest('button, [data-interactive="true"]')) {
                                e.preventDefault();
                              }
                            }}
                            className={`border-r ${isColActive('col-mention') ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${
                              isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'
                            } flex items-center ${
                              mentionCustom?.textAlign === 'left'
                                ? 'justify-start'
                                : mentionCustom?.textAlign === 'right'
                                ? 'justify-end'
                                : 'justify-center'
                            } px-2 select-none cursor-default relative shrink-0 transition-colors ${
                              std.hasInvalidNote
                                ? 'bg-slate-200 text-slate-400 border border-slate-300'
                                : mentionCellBg ? '' : 'bg-emerald-50/20'
                            }`}
                            title="Mention pédagogique calculée automatiquement (case bloquée)"
                          >
                            {std.mention && std.mention !== '-' && std.mention !== '—' ? (
                              <span
                                style={mentionCustom ? {
                                  fontWeight: mentionCustom.bold !== undefined ? (mentionCustom.bold ? '900' : '400') : undefined,
                                  fontStyle: mentionCustom.italic ? 'italic' : undefined,
                                  textDecoration: mentionCellStyle.textDecoration !== 'none' ? mentionCellStyle.textDecoration : undefined,
                                  fontFamily: mentionCustom.fontFamily || undefined,
                                  fontSize: mentionCustom.fontSize ? `${mentionCustom.fontSize}px` : undefined,
                                  color: mentionCustom.color || undefined,
                                  textAlign: mentionCustom.textAlign || undefined,
                                } : undefined}
                                className={`select-none pointer-events-none px-2 py-0.5 rounded-md text-[11px] sm:text-xs border shadow-2xs whitespace-nowrap tracking-tight ${std.mentionClass}`}
                              >
                                {std.mention}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs font-semibold select-none pointer-events-none">—</span>
                            )}
                            {renderColHandle('col-mention')}
                          </div>
                        ),
                      };

                      return (
                        <div 
                          key={std.id}
                          style={{ height: `${rowHeight}px` }}
                          className={`flex items-stretch transition-colors relative w-fit ${isRowMenuOpen ? 'z-50' : 'z-0'} ${
                            isRowSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {visibleColumnOrder.left.map((colKey) => (
                            <React.Fragment key={`cell-l-${std.id}-${colKey}`}>
                              {peripheralBodyCells[colKey]}
                            </React.Fragment>
                          ))}

                          {/* NOTES DYNAMIQUES */}
                          {Array.from({ length: noteColumnCount }).map((_, cIdx) => {
                            const noteVal = std.notes[cIdx] || '';
                            const colMeta = columnMetas[cIdx] || { maxScore: 20 };
                            const parsed = parseStudentNote(noteVal, colMeta.maxScore);
                            const isSelectedNote = activeCellInfo.id === `cell-note-${rIdx}-${cIdx}`;
                            const isInvalid = parsed.isInvalid;
                            const colBg = colMeta.columnBgColor;
                            const singleCellBg = cellColors[`${std.id}_${cIdx}`];
                            const noteCellKey = `${std.id}_${cIdx}`;
                            const noteCellStyle = getResolvedCellStyle(noteCellKey, 'center');
                            const noteCellBg = isInvalid ? '#fef2f2' : (noteCellStyle.backgroundColor || singleCellBg || rowBg || colBg || undefined);
                            const thisNoteWidth = getColWidth(`col-note-${cIdx}`);
                            const isThisColActive = isColActive(`col-note-${cIdx}`);
                            const isNoteCellMenuOpen = activeMenuCell?.studentId === std.id && activeMenuCell?.colIndex === cIdx;
                            const hasStudentName = Boolean((std.name || '').trim());
                            const hasNoteScoreText = hasStudentName && Boolean(parsed.scoreStr);
                            const isBlockedForName = blockedNoteTarget?.studentId === std.id && blockedNoteTarget?.colIndex === cIdx && !hasStudentName;
                            const noteAlignClass = noteCellStyle.textAlign === 'left'
                              ? 'justify-start'
                              : noteCellStyle.textAlign === 'right'
                              ? 'justify-end'
                              : 'justify-center';

                            return (
                              <div 
                                key={`note-cell-${std.id}-${cIdx}`}
                                style={{ 
                                  width: `${thisNoteWidth}px`,
                                  minWidth: `${thisNoteWidth}px`,
                                  maxWidth: `${thisNoteWidth}px`,
                                  height: `${rowHeight}px`,
                                  backgroundColor: noteCellBg
                                }}
                                onClick={() => {
                                  setActiveCellInfo({
                                    id: `cell-note-${rIdx}-${cIdx}`,
                                    type: 'note',
                                    rowIndex: rIdx,
                                    noteColIndex: cIdx,
                                    coordDisplay: `N${cIdx + 1}_${rIdx + 1}`,
                                    value: noteVal || `.../${parsed.maxScore}`
                                  });
                                }}
                                className={`border-r ${isThisColActive ? 'border-r-sky-400 z-10' : 'border-r-slate-700'} border-b ${isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'} flex items-center justify-center px-1 relative shrink-0 transition-colors group cursor-text ${
                                  isInvalid 
                                    ? 'bg-red-50 ring-2 ring-red-500 z-10' 
                                    : isSelectedNote 
                                    ? `outline-2 outline-[#107c41] -outline-offset-2 z-10 ${noteCellBg ? '' : 'bg-blue-50/30'}` 
                                    : ''
                                }`}
                              >
                                {/* BOUTON 3 POINTS ⋮ POUR CETTE CASE DE NOTE */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const next = (activeMenuCell?.studentId === std.id && activeMenuCell?.colIndex === cIdx)
                                      ? null
                                      : { studentId: std.id, colIndex: cIdx };
                                    closeAllMenus();
                                    if (next !== null) {
                                      setMenuAnchorEl(e.currentTarget);
                                      setActiveMenuCell(next);
                                    }
                                  }}
                                  className={`gb-menu-trigger absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-20 border-0 shadow-none ${
                                    isNoteCellMenuOpen
                                      ? 'text-sky-600 bg-sky-100/70'
                                      : 'text-slate-900 hover:text-black hover:bg-slate-200/50'
                                  }`}
                                  title={`Options de la note ${cIdx + 1}`}
                                >
                                  <MoreVertical className="w-3 h-3 text-slate-900 stroke-[2.5]" />
                                </button>

                                {/* MENU CONTEXTUEL POUR LA CASE DE NOTE (PORTAIL ANTI-OBSTACLE) */}
                                <SmartFloatingPopover
                                  open={isNoteCellMenuOpen}
                                  anchorEl={menuAnchorEl}
                                  boundaryEl={gradebookContainerRef.current}
                                  preferredSide="bottom"
                                  preferredAlign="start"
                                  gap={6}
                                  onClose={closeAllMenus}
                                  ignoreOutsideSelector=".gb-menu-trigger"
                                  dataPopoverId={`gb-cell-menu-${std.id}-${cIdx}`}
                                  className="w-56 rounded-lg"
                                >
                                  <div className="py-1.5 text-left text-xs select-none">
                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-1 mb-1">
                                      <span className="truncate">{std.name || `Élève ${rIdx + 1}`}</span>
                                      <span className="text-blue-600 font-extrabold shrink-0">Note {cIdx + 1}</span>
                                    </div>

                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Couleurs
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'singleCell' && activeColorPicker?.studentId === std.id && activeColorPicker?.colIndex === cIdx ? null : { mode: 'singleCell', studentId: std.id, colIndex: cIdx })}
                                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Palette className="w-3.5 h-3.5 text-teal-600" />
                                        <span>Colorer la case</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">▸</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'row' && activeColorPicker?.studentId === std.id ? null : { mode: 'row', studentId: std.id })}
                                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Palette className="w-3.5 h-3.5 text-amber-600" />
                                        <span>Colorer toute la ligne</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">▸</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setActiveColorPicker(activeColorPicker?.mode === 'column' && activeColorPicker?.colIndex === cIdx ? null : { mode: 'column', colIndex: cIdx })}
                                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 text-slate-700 transition"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Palette className="w-3.5 h-3.5 text-violet-600" />
                                        <span>Colorer toute la colonne</span>
                                      </div>
                                      <span className="text-[10px] text-slate-400">▸</span>
                                    </button>

                                    {activeColorPicker && (
                                      (activeColorPicker.mode === 'singleCell' && activeColorPicker.studentId === std.id && activeColorPicker.colIndex === cIdx) ||
                                      (activeColorPicker.mode === 'row' && activeColorPicker.studentId === std.id) ||
                                      (activeColorPicker.mode === 'column' && activeColorPicker.colIndex === cIdx)
                                    ) && renderPaletteGrid(
                                      activeColorPicker.mode === 'singleCell'
                                        ? 'Couleur de cette case :'
                                        : activeColorPicker.mode === 'row'
                                        ? 'Couleur de toute la ligne :'
                                        : 'Couleur de toute la colonne :'
                                    )}

                                    <div className="my-1 border-t border-slate-100" />

                                    <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Actions
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleFillDown(cIdx, rIdx);
                                        setActiveMenuCell(null);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                                      <span>Recopier vers le bas</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        handleRawNoteChange(std.id, cIdx, formatStudentNote('', parsed.maxScore));
                                        setActiveMenuCell(null);
                                      }}
                                      className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-amber-50 text-amber-700 transition"
                                    >
                                      <Eraser className="w-3.5 h-3.5 text-amber-600" />
                                      <span>Vider cette note</span>
                                    </button>
                                  </div>
                                </SmartFloatingPopover>

                                {/* INFOBULLE FLOTTANTE SANS BLOQUER LA VUE SI NOTE > MAX OU BARÈME INVALIDE */}
                                {isInvalid && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                                    <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                                    <span>
                                      {parsed.hasInvalidMax
                                        ? '⚠️ Le barème maximal doit être supérieur à 0'
                                        : `⚠️ La note ne peut pas être supérieure à la note maximale (${parsed.maxScore})`}
                                    </span>
                                  </div>
                                )}

                                {/* MESSAGE ROUGE FLOTTANT UNIQUE SI TENTATIVE DE SAISIE SANS NOM D'ÉLÈVE */}
                                {isBlockedForName && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-red-600 text-white text-[11px] font-black rounded-lg shadow-2xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-1.5 animate-in fade-in zoom-in-95 ring-2 ring-white">
                                    <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                                    <span>⚠️ Écrivez le nom de l'élève d'abord !</span>
                                  </div>
                                )}

                                {/* SAISIE HAUTE VISIBILITÉ AVEC SÉPARATEUR ET BARÈME ULTRA LISIBLES ET NETS */}
                                <div className={`flex items-center ${noteAlignClass} w-full h-full pt-1.5 pr-2.5`}>
                                  {/* Note de l'élève (modifiable, rouge et soulignée si > max) */}
                                  <input
                                    id={`input-note-score-${std.id}-${cIdx}`}
                                    type="text"
                                    data-cell-key={noteCellKey}
                                    data-cell-type="note"
                                    value={hasStudentName ? parsed.scoreStr : ''}
                                    onKeyDown={(e) => {
                                      if (!hasStudentName && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
                                        e.preventDefault();
                                        setBlockedNoteTarget({ studentId: std.id, colIndex: cIdx });
                                        document.getElementById(`input-name-${std.id}`)?.focus();
                                        setTimeout(() => {
                                          setBlockedNoteTarget(prev => (prev?.studentId === std.id && prev?.colIndex === cIdx) ? null : prev);
                                        }, 3500);
                                      }
                                    }}
                                    onChange={(e) => {
                                      if (!hasStudentName) {
                                        setBlockedNoteTarget({ studentId: std.id, colIndex: cIdx });
                                        document.getElementById(`input-name-${std.id}`)?.focus();
                                        setTimeout(() => {
                                          setBlockedNoteTarget(prev => (prev?.studentId === std.id && prev?.colIndex === cIdx) ? null : prev);
                                        }, 3500);
                                        return;
                                      }
                                      const sanitized = sanitizeDecimalInput(e.target.value);
                                      const newRaw = formatStudentNote(sanitized, parsed.maxScoreStr !== '' ? parsed.maxScoreStr : (colMeta.maxScore || 20));
                                      handleRawNoteChange(std.id, cIdx, newRaw);
                                    }}
                                    onFocus={(e) => {
                                      if (sortMode !== 'order' && !lockedOrderIds) {
                                        setLockedOrderIds(studentsWithStats.map((s) => s.id));
                                      }
                                      setActiveCellInfo({
                                        id: `cell-note-${rIdx}-${cIdx}`,
                                        type: 'note',
                                        rowIndex: rIdx,
                                        noteColIndex: cIdx,
                                        coordDisplay: `N${cIdx + 1}_${rIdx + 1}`,
                                        value: noteVal || `.../${parsed.maxScoreStr || colMeta.maxScore || 20}`
                                      });
                                      syncInputHighlight(e.currentTarget, noteCellKey, 'note');
                                    }}
                                    onSelect={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onMouseUp={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onKeyUp={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onClick={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onBlur={() => {
                                      setLockedOrderIds(null);
                                      if (!isFontFamilyMenuOpenRef.current) {
                                        setHighlightedTarget(prev => prev?.elementId === `input-note-score-${std.id}-${cIdx}` ? null : prev);
                                      }
                                    }}
                                    placeholder="-"
                                    maxLength={6}
                                    style={hasNoteScoreText ? {
                                      fontWeight: noteCellStyle.fontWeight,
                                      fontStyle: noteCellStyle.fontStyle,
                                      textDecoration: isInvalid ? 'underline' : noteCellStyle.textDecoration,
                                      fontFamily: noteCellStyle.fontFamily,
                                      fontSize: noteCellStyle.fontSize,
                                      color: isInvalid ? '#dc2626' : (noteCellStyle.color || '#020617'),
                                      backgroundColor: 'transparent',
                                      textAlign: 'right'
                                    } : {
                                      backgroundColor: 'transparent',
                                      textAlign: 'right'
                                    }}
                                    className={`w-[48%] min-w-0 text-right text-xs sm:text-sm transition outline-none bg-transparent cursor-text placeholder:not-italic placeholder:no-underline placeholder:font-normal placeholder:text-slate-400 ${
                                      isInvalid
                                        ? 'underline font-black decoration-red-600 decoration-2'
                                        : noteCellStyle.color
                                        ? ''
                                        : 'focus:text-blue-700'
                                    }`}
                                  />

                                  {/* SÉPARATEUR FIXE NON MODIFIABLE ULTRA VISIBLE */}
                                  <span
                                    style={{
                                      fontWeight: noteCellStyle.fontWeight,
                                      fontStyle: noteCellStyle.fontStyle,
                                      textDecoration: noteCellStyle.textDecoration,
                                      fontFamily: noteCellStyle.fontFamily,
                                      fontSize: noteCellStyle.fontSize,
                                      color: isInvalid ? '#dc2626' : (noteCellStyle.color || '#020617')
                                    }}
                                    className={`px-0.5 text-xs sm:text-sm select-none pointer-events-none ${
                                      isInvalid ? 'text-red-600 font-black' : 'text-slate-900'
                                    }`}
                                  >
                                    /
                                  </span>

                                  {/* Barème maximal (défaut 20, entièrement modifiable librement) ULTRA VISIBLE */}
                                  <input
                                    id={`input-note-max-${std.id}-${cIdx}`}
                                    type="text"
                                    data-cell-key={noteCellKey}
                                    data-cell-type="note"
                                    value={parsed.maxScoreStr}
                                    onChange={(e) => {
                                      const sanitizedMax = sanitizeDecimalInput(e.target.value);
                                      const newRaw = formatStudentNote(parsed.scoreStr, sanitizedMax);
                                      handleRawNoteChange(std.id, cIdx, newRaw);
                                    }}
                                    onFocus={(e) => {
                                      if (sortMode !== 'order' && !lockedOrderIds) {
                                        setLockedOrderIds(studentsWithStats.map((s) => s.id));
                                      }
                                      setActiveCellInfo({
                                        id: `cell-note-${rIdx}-${cIdx}`,
                                        type: 'note',
                                        rowIndex: rIdx,
                                        noteColIndex: cIdx,
                                        coordDisplay: `N${cIdx + 1}_${rIdx + 1}`,
                                        value: noteVal || `.../${parsed.maxScoreStr || colMeta.maxScore || 20}`
                                      });
                                      syncInputHighlight(e.currentTarget, noteCellKey, 'note');
                                    }}
                                    onSelect={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onMouseUp={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onKeyUp={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onClick={(e) => syncInputHighlight(e.currentTarget, noteCellKey, 'note')}
                                    onBlur={() => {
                                      setLockedOrderIds(null);
                                      if (!isFontFamilyMenuOpenRef.current) {
                                        setHighlightedTarget(prev => prev?.elementId === `input-note-max-${std.id}-${cIdx}` ? null : prev);
                                      }
                                      // Si laissé vide ou <= 0 en quittant la case, rétablir le barème par défaut de la colonne
                                      if (parsed.hasInvalidMax || parsed.maxScore <= 0) {
                                        const fallbackMax = colMeta.maxScore > 0 ? colMeta.maxScore : 20;
                                        handleRawNoteChange(std.id, cIdx, formatStudentNote(parsed.scoreStr, fallbackMax));
                                      }
                                    }}
                                    placeholder={String(colMeta.maxScore || 20)}
                                    maxLength={6}
                                    style={{
                                      fontWeight: noteCellStyle.fontWeight,
                                      fontStyle: noteCellStyle.fontStyle,
                                      textDecoration: noteCellStyle.textDecoration,
                                      fontFamily: noteCellStyle.fontFamily,
                                      fontSize: noteCellStyle.fontSize,
                                      color: isInvalid ? '#dc2626' : (noteCellStyle.color || '#020617'),
                                      backgroundColor: 'transparent',
                                      textAlign: 'left'
                                    }}
                                    className={`w-[44%] min-w-0 text-left text-xs sm:text-sm transition outline-none bg-transparent cursor-text placeholder:text-slate-300 ${
                                      noteCellStyle.color ? '' : 'text-slate-900 hover:text-blue-700 focus:text-blue-700'
                                    }`}
                                    title="Barème maximal modifiable librement (ex: 10, 20, 30, 40, 100...)"
                                  />
                                </div>

                                {isSelectedNote && !isInvalid && (
                                  <div 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleFillDown(cIdx, rIdx);
                                    }}
                                    className="absolute -bottom-[3px] -right-[3px] w-2.5 h-2.5 bg-[#107c41] hover:scale-150 border border-white cursor-pointer z-20 transition-transform shadow-xs"
                                    title="Cliquer pour recopier cette note vers le bas (remplir toutes les lignes suivantes)"
                                  />
                                )}
                                {renderColHandle(`col-note-${cIdx}`)}
                              </div>
                            );
                          })}

                          {/* Case vide sous le bouton [+] */}
                          <div 
                            style={{ 
                              width: '48px', 
                              minWidth: '48px',
                              maxWidth: '48px',
                              height: `${rowHeight}px`,
                              backgroundColor: rowBg || undefined
                            }}
                            className={`border-r border-r-slate-700 border-b ${isRowLineActive ? 'border-b-sky-400 z-10' : 'border-b-slate-600'} bg-slate-50/60 flex items-center justify-center shrink-0 relative`}
                          >
                            <span className="text-slate-200 text-xs">•</span>
                          </div>

                          {visibleColumnOrder.right.map((colKey) => (
                            <React.Fragment key={`cell-r-${std.id}-${colKey}`}>
                              {peripheralBodyCells[colKey]}
                            </React.Fragment>
                          ))}

                          {/* POIGNÉE DE SÉLECTION & REDIMENSIONNEMENT DE LA LIGNE HORIZONTALE */}
                          {renderRowHandle(rIdx)}
                        </div>
                      );
                    })}
                  </div>

                  {/* PIED DU TABLEAU : BOUTON AJOUTER UN ÉLÈVE & COMPTEUR */}
                  <div className="p-2 bg-[#f8fafc] border-t-2 border-slate-900 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleAddStudentRow}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />
                      <span>+ Ajouter un élève</span>
                    </button>

                    <div className="text-[11px] font-semibold text-slate-600">
                      Total : <span className="font-bold text-slate-900">{students.length}</span> élèves
                    </div>
                  </div>

                  {/* ================================================================= */}
                  {/* POIGNÉE DE REDIMENSIONNEMENT DROITE (*) : EXTÉRIEURE              */}
                  {/* ================================================================= */}
                  <div
                    onMouseDown={handleStartRightResize}
                    onTouchStart={handleStartRightResize}
                    style={{ right: '-34px' }}
                    className={`absolute top-1/2 -translate-y-1/2 w-7 h-14 bg-white hover:bg-blue-600 text-slate-700 hover:text-white border-2 border-slate-800 hover:border-blue-700 rounded-md shadow-lg flex flex-col items-center justify-center cursor-ew-resize z-30 group transition-all select-none ${
                      isDraggingRight ? 'bg-blue-600 text-white ring-4 ring-blue-400/50 scale-105' : 'hover:scale-105'
                    }`}
                    title="Tirer vers la droite pour allonger le tableau"
                  >
                    <span className="text-sm font-black text-red-600 group-hover:text-white leading-none">*</span>
                    <div className="flex gap-0.5 mt-1">
                      <span className="w-0.5 h-3 bg-current rounded-full" />
                      <span className="w-0.5 h-3 bg-current rounded-full" />
                    </div>
                  </div>

                  {/* ================================================================= */}
                  {/* POIGNÉE D'ANGLE EXCEL (◢) : COIN INFÉRIEUR DROIT                  */}
                  {/* ================================================================= */}
                  <div
                    onMouseDown={handleStartCornerResize}
                    onTouchStart={handleStartCornerResize}
                    className={`absolute -bottom-3.5 -right-3.5 w-8 h-8 bg-blue-600 hover:bg-blue-700 text-white border-2 border-white rounded shadow-xl flex items-center justify-center cursor-nwse-resize z-40 transition-transform active:scale-125 select-none ${
                      isDraggingCorner ? 'scale-125 ring-4 ring-blue-400/50 bg-blue-700' : 'hover:scale-110'
                    }`}
                    title="Tirer pour ajouter des élèves"
                  >
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 16 16">
                      <path d="M14 14H9V12H12V9H14V14ZM14 7H12V5H14V7ZM7 14H5V12H7V14ZM14 3H12V1H14V3ZM3 14H1V12H3V14Z" opacity="0.95" />
                    </svg>

                    {isDraggingCorner && dragPreviewRows > 0 && (
                      <div className="absolute top-9 right-0 bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-lg whitespace-nowrap z-50 pointer-events-none">
                        + {dragPreviewRows} ligne{dragPreviewRows > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Cases de fond à droite */}
                <div className="flex shrink-0">
                  {Array.from({ length: RIGHT_EXTRA_COLS }).map((_, c) => (
                    <div key={`right-grid-col-${c}`} className="flex flex-col">
                      {Array.from({ length: studentsWithStats.length + 3 }).map((_, r) => (
                        <div 
                          key={`right-grid-cell-${c}-${r}`}
                          className="w-16 h-11 border-r border-b border-slate-300 bg-white"
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Cases de fond en bas */}
              <div className="flex flex-col">
                {Array.from({ length: backgroundRowCount }).map((_, r) => (
                  <div key={`bottom-grid-row-${r}`} className="flex">
                    {Array.from({ length: backgroundColCount }).map((_, c) => (
                      <div 
                        key={`bottom-grid-cell-${r}-${c}`}
                        className="w-16 h-6 border-r border-b border-slate-300 bg-white"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BARRE INFÉRIEURE : FEUILLE ACTIVE & CURSEUR ZOOM                       */}
      {/* ========================================================================= */}
      <footer className="h-6 sm:h-7 bg-[#f3f4f6] border-t border-slate-300 px-2 sm:px-3 flex items-center justify-between text-xs text-slate-600 shrink-0 select-none">
        <div className="flex items-center gap-1 min-w-0">
          <div
            className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px] font-bold rounded-t border-t border-x bg-white text-emerald-800 border-slate-300 border-b-white -mb-[1px] shadow-2xs truncate max-w-[200px] sm:max-w-[340px]"
            title={`Feuille de notes active : ${activeSheetLabel}`}
          >
            {activeSheetLabel}
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-3 text-[10.5px] text-slate-500 font-medium">
          <span>Double-clic sur un trait pour <strong className="text-blue-600">sélectionner & glisser</strong></span>
          <span>•</span>
          <span>Sélection individuelle stricte sans mélange</span>
          <span>•</span>
          <span>Zoom à deux doigts ou en haut <strong className="text-slate-800">[-] [+]</strong></span>
        </div>

        <div className="hidden sm:flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoomPercent(prev => Math.max(30, prev - 10))}
            className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            title="Zoom arrière (-10%)"
          >
            <Minus className="w-3 h-3" />
          </button>

          <input
            type="range"
            min="30"
            max="200"
            step="5"
            value={zoomPercent}
            onChange={(e) => setZoomPercent(Number(e.target.value))}
            className="w-16 sm:w-24 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-700"
          />

          <button
            type="button"
            onClick={() => setZoomPercent(prev => Math.min(200, prev + 10))}
            className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            title="Zoom avant (+10%)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <span className="text-[11px] font-mono font-bold text-slate-700 min-w-[36px] text-right">
            {zoomPercent}%
          </span>
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* 6. MODALES EN PORTAIL (AU-DESSUS DE TOUS LES CALQUES & BARRES LATÉRALES)   */}
      {/* ========================================================================= */}
      {typeof document !== 'undefined' && createPortal(
        <>
      {editingColModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-[99990] p-4 animate-in fade-in"
          onClick={() => setEditingColModal(null)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-sm overflow-hidden animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-blue-600" />
                <h3 className="font-bold text-slate-800 text-sm">
                  Modifier la colonne {editingColModal.colIndex + 1}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingColModal(null)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Intitulé de la colonne (numéro automatique {editingColModal.colIndex + 1} conservé)
                </label>
                <input
                  type="text"
                  value={editingColModal.title}
                  onChange={(e) => setEditingColModal(prev => prev ? { ...prev, title: e.target.value } : null)}
                  placeholder="Ex: NOTE, DEVOIR, INTERRO, TP, EXAMEN..."
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 uppercase"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Aperçu : <strong className="text-slate-700">{editingColModal.title.trim().toUpperCase() || 'NOTE'} {editingColModal.colIndex + 1}</strong>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Barème maximal par défaut (sur combien)
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={editingColModal.maxScore}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEditingColModal(prev => prev ? { ...prev, maxScore: isNaN(val) ? 20 : val } : null);
                  }}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Exemple : 20 pour une note sur 20, 40 pour une note sur 40.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Coefficient de l'évaluation (défaut : 1)
                </label>
                <input
                  type="number"
                  min={0.5}
                  max={20}
                  step={0.5}
                  value={editingColModal.coeffEval}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEditingColModal(prev => prev ? { ...prev, coeffEval: isNaN(val) ? 1 : val } : null);
                  }}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Exemple : 1 pour une interrogation, 2 ou 3 pour un devoir surveillé.
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingColModal(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  const idx = editingColModal.colIndex;
                  const cleanTitle = editingColModal.title.trim().toUpperCase() || 'NOTE';
                  const cleanMax = editingColModal.maxScore > 0 ? editingColModal.maxScore : 20;
                  const cleanCoeff = editingColModal.coeffEval > 0 ? editingColModal.coeffEval : 1;

                  setColumnMetas(prev => ({
                    ...prev,
                    [idx]: {
                      ...prev[idx],
                      title: cleanTitle,
                      maxScore: cleanMax,
                      coeffEval: cleanCoeff
                    }
                  }));

                  // Mettre à jour le barème max chez les élèves
                  setStudents(prev => prev.map(s => {
                    const currentNote = s.notes[idx] || '';
                    const parsed = parseStudentNote(currentNote, cleanMax);
                    const copyNotes = [...s.notes];
                    copyNotes[idx] = formatStudentNote(parsed.scoreStr, cleanMax);
                    return { ...s, notes: copyNotes };
                  }));

                  setEditingColModal(null);
                  setIsSaved(false);
                }}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPOVER AUTO-COMPLÉTION INTER-MATIÈRES (ÉLÈVES DÉJÀ CONNUS DANS LA CLASSE) */}
      <SmartFloatingPopover
        open={Boolean(rosterSuggestState && activeRosterSuggestions.length > 0)}
        anchorEl={rosterSuggestState?.anchorEl || null}
        boundaryEl={gradebookContainerRef.current}
        preferredSide="bottom"
        preferredAlign="start"
        gap={4}
        onClose={() => setRosterSuggestState(null)}
        dataPopoverId="gb-roster-autocomplete"
        className="w-72 rounded-xl"
      >
        <div className="bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden select-none">
          <div className="px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
              <Link2 className="w-3 h-3 text-blue-600" />
              Élèves déjà dans cette classe
            </span>
            <span className="text-[9.5px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">
              Liaison auto
            </span>
          </div>
          <div className="py-1 max-h-60 overflow-y-auto">
            {activeRosterSuggestions.map((item, idx) => {
              const isHi = (rosterSuggestState?.highlightIdx ?? 0) === idx;
              return (
                <button
                  key={`${item.studentUid}-${idx}`}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    if (rosterSuggestState) {
                      handleApplyRosterSuggestion(rosterSuggestState.studentId, item);
                    }
                  }}
                  onMouseEnter={() =>
                    setRosterSuggestState((prev) =>
                      prev ? { ...prev, highlightIdx: idx } : null
                    )
                  }
                  className={`w-full px-2.5 py-1.5 flex items-center gap-2.5 text-left transition cursor-pointer ${
                    isHi ? 'bg-blue-50 text-blue-950' : 'hover:bg-slate-50 text-slate-800'
                  }`}
                >
                  <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                    {item.photoUrl ? (
                      <img
                        src={item.photoUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-xs font-extrabold truncate">
                        {item.name}
                      </span>
                      {item.matricule && (
                        <span className="text-[9.5px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                          {item.matricule}
                        </span>
                      )}
                    </div>
                    {item.subjectNames.length > 0 && (
                      <div className="text-[10px] text-slate-500 truncate">
                        Déjà en : {item.subjectNames.slice(0, 3).join(', ')}
                        {item.subjectNames.length > 3 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </SmartFloatingPopover>

      {/* MODALE POPUP CARTE AU MILIEU : APERÇU PHOTO, NOM & MOYENNE */}
      {previewPhotoStudent && (
        <div 
          className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
          onClick={() => setPreviewPhotoStudent(null)}
        >
          {(() => {
            const previewStats = studentsWithStats.find(s => s.id === previewPhotoStudent.id);
            return (
              <div 
                onClick={(e) => e.stopPropagation()}
                className="w-72 sm:w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden p-5 flex flex-col items-center relative animate-in fade-in zoom-in-95 duration-200"
              >
                {/* Bouton fermer ✕ */}
                <button
                  type="button"
                  onClick={() => setPreviewPhotoStudent(null)}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition active:scale-95 cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>

                {/* Image carrée de l'élève */}
                <div className="w-48 h-48 rounded-xl overflow-hidden border-2 border-slate-200 shadow-md bg-slate-100 shrink-0 mt-2">
                  {previewPhotoStudent.photoUrl ? (
                    <img 
                      src={previewPhotoStudent.photoUrl} 
                      alt={previewPhotoStudent.name || 'Élève'} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <Camera className="w-12 h-12 stroke-[1.5]" />
                    </div>
                  )}
                </div>

                {/* Nom & prénom en bas de la photo */}
                <h3 className="mt-4 font-black text-slate-900 text-base text-center px-2 truncate w-full">
                  {previewPhotoStudent.name || 'Nom non renseigné'}
                </h3>
                {previewPhotoStudent.matricule && (
                  <div className="mt-1 text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                    Matricule : {previewPhotoStudent.matricule}
                  </div>
                )}

                {/* Moyenne générale de l'élève */}
                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                  <span>Moyenne générale :</span>
                  <span className={`font-black text-sm ${
                    !previewStats || previewStats.average === null
                      ? 'text-slate-400'
                      : previewStats.average >= effectiveAverageScale * 0.6
                      ? 'text-emerald-700'
                      : previewStats.average >= effectiveAverageScale * 0.5
                      ? 'text-blue-700'
                      : 'text-rose-700'
                  }`}>
                    {previewStats?.averageFormatted ? `${previewStats.averageFormatted} / ${effectiveScaleLabel}` : '-'}
                  </span>
                </div>

                {/* Actions rapides */}
                <div className="mt-5 flex items-center gap-2 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      const sId = previewPhotoStudent.id;
                      setPreviewPhotoStudent(null);
                      handleTriggerPhotoUpload(sId);
                    }}
                    className="flex-1 py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Remplacer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewPhotoStudent(null)}
                    className="py-2 px-5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition active:scale-95 cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
        </>,
        document.body
      )}

      {/* Menu latéral droit coulissant fluide : Assistant Delmas */}
      <TeacherDelmasAssistantDrawer
        isOpen={isDelmasAssistantOpen}
        onClose={() => setIsDelmasAssistantOpen(false)}
        sheetBridge={delmasSheetBridge}
      />
    </div>
  );
};
