import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  Save,
  Cloud,
  CloudOff,
  WifiOff,
  Loader2,
  CheckCircle2,
  Download,
  Copy,
  Check,
  Plus,
  Minus,
  Maximize2,
  Minimize2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  PaintBucket,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Undo2,
  Redo2,
  ArrowUpDown,
  RefreshCw,
  ExternalLink,
  Trash2,
  X,
  User,
  Palette,
  RotateCcw,
  ChevronDown,
  Award,
  AlertTriangle,
  Link2,
  Unlink,
  Users,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import type {
  ClassAverageCardItem,
  ClassItem,
  SchoolItem,
  SchoolYearItem,
  SubjectItem,
  TermItem,
} from './TeacherClassesView';
import type { CellCustomStyle } from './SubjectGradebookView';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import {
  MentionAndMatriculeControls,
  type SheetSettingScope,
} from './MentionAndMatriculeControls';
import {
  TeacherDelmasAssistantRibbonButton,
  TeacherDelmasAssistantDrawer,
} from './TeacherDelmasAssistantDrawer';
import { GradebookDownloadMenu } from './GradebookDownloadMenu';
import {
  exportGradebookToPdf,
  exportGradebookToWord,
  copyGradebookToClipboard,
  type GradebookExportDataset,
} from '../../utils/gradebookExportUtils';
import type {
  TeacherDelmasAction,
  TeacherDelmasActiveContext,
  TeacherDelmasSheetBridge,
} from '../../utils/teacherDelmasActionEngine';
import { ViewerSuperExpandButton } from '../ViewerSuperExpandButton';
import {
  useViewerExpandLevel,
  setViewerExpandLevel,
  resetViewerExpand,
} from '../../utils/viewerExpandManager';
import {
  TeacherGradebookAPI,
  getTeacherAuthToken,
  isOfflineOrNetworkError,
  readUserClassAverageCache,
  writeUserClassAverageCache,
  type ClassAverageSheetResponse,
  type ClassAverageSheetSavePayload,
  type ClassSheetSettings,
} from '../../services/teacherGradebookApi';
import {
  DEFAULT_AVERAGE_SCALE,
  DEFAULT_CUSTOM_MENTION_RULES,
  formatScaleValue,
  resolveMentionWithRules,
  sanitizeAverageScale,
  type CustomMentionRule,
} from '../../utils/gradebookCalculations';
import {
  computeTermGeneralAverageTable,
  formatCoeffDisplay,
  formatFrenchNumber,
  makeSortedPairKey,
  parseManualAverageInput,
  type ComputedTermAverageStudent,
  type GradebookStudentSnapshot,
  type TermAverageLayoutState,
  type TermAverageOverrides,
  type TermAverageSortMode,
  type TermAverageStylesState,
  type TermAverageSubject,
} from '../../utils/termGeneralAverage';

export interface TermGeneralAverageViewProps {
  averageCard: ClassAverageCardItem;
  schoolClass: ClassItem;
  schoolYear?: SchoolYearItem | null;
  school?: SchoolItem | null;
  term?: TermItem | null;
  userId?: string;
  /** Sujets connus localement pour affichage immédiat avant/pendant chargement serveur */
  initialSubjects?: SubjectItem[];
  /** Permet de sauter directement vers le tableur d'une matière en cliquant sur son en-tête */
  onOpenSubject?: (subjectId: string) => void;
  /** Notifie la vue parente dès qu'un coefficient de matière est enregistré depuis ce tableau */
  onSubjectCoefficientUpdated?: (subjectId: string, coefficient: number | null) => void;
  /** Notifie la vue parente si les paramètres globaux de classe (mentions / matricule) sont modifiés */
  onClassSettingsUpdated?: (classId: string, settings: ClassSheetSettings) => void;
  onBack: () => void;
}

const FONT_FAMILIES = [
  'Calibri',
  'Arial',
  'Inter',
  'Segoe UI',
  'Verdana',
  'Times New Roman',
  'Georgia',
  'Courier New',
];

const BG_COLOR_SWATCHES = [
  { label: 'Aucun', value: '' },
  { label: 'Bleu clair', value: '#eff6ff' },
  { label: 'Vert menthe', value: '#ecfdf5' },
  { label: 'Jaune pâle', value: '#fefce8' },
  { label: 'Ambre doux', value: '#fffbeb' },
  { label: 'Rose clair', value: '#fff1f2' },
  { label: 'Violet doux', value: '#f5f3ff' },
  { label: 'Cyan pâle', value: '#ecfeff' },
  { label: 'Gris clair', value: '#f1f5f9' },
  { label: 'Bleu vif', value: '#dbeafe' },
  { label: 'Vert vif', value: '#d1fae5' },
  { label: 'Rouge doux', value: '#fee2e2' },
];

const TEXT_COLOR_SWATCHES = [
  { label: 'Défaut', value: '' },
  { label: 'Noir ardoise', value: '#0f172a' },
  { label: 'Bleu', value: '#1d4ed8' },
  { label: 'Émeraude', value: '#047857' },
  { label: 'Rouge', value: '#b91c1c' },
  { label: 'Ambre', value: '#b45309' },
  { label: 'Violet', value: '#6d28d9' },
  { label: 'Cyan', value: '#0e7490' },
  { label: 'Gris', value: '#475569' },
];

const getExcelColumnLabel = (index: number): string => {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
};

const getMentionBadgeStyle = (
  average: number | null,
  rules: readonly CustomMentionRule[],
  averageScale = DEFAULT_AVERAGE_SCALE
): string => {
  if (average === null || !Number.isFinite(average)) {
    return 'bg-slate-50 text-slate-400 border-slate-200';
  }
  const { tone } = resolveMentionWithRules(average, rules, averageScale);
  switch (tone) {
    case 'emerald':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'teal':
      return 'bg-teal-50 text-teal-800 border-teal-200';
    case 'sky':
      return 'bg-blue-50 text-blue-800 border-blue-200';
    case 'amber':
      return 'bg-amber-50 text-amber-800 border-amber-200';
    case 'rose':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-50 text-slate-400 border-slate-200';
  }
};

interface ActiveCellState {
  cellKey: string;
  rowKey?: string;
  coordDisplay: string;
  formulaText: string;
  isEditable?: boolean;
}

interface UndoSnapshot {
  overrides: TermAverageOverrides;
  styles: TermAverageStylesState;
  sortMode: TermAverageSortMode;
}

export const TermGeneralAverageView: React.FC<TermGeneralAverageViewProps> = ({
  averageCard,
  schoolClass,
  schoolYear,
  school,
  term,
  userId,
  initialSubjects = [],
  onOpenSubject,
  onSubjectCoefficientUpdated,
  onClassSettingsUpdated,
  onBack,
}) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Hydratation synchrone immédiate depuis le cache local isolé au compte (évite tout saut visuel / zoom brusque à l'ouverture)
  const initialCachedSheet = useMemo(
    () => (userId ? readUserClassAverageCache(userId, averageCard.id) : null),
    [userId, averageCard.id]
  );

  // Données serveur (matières + notes des tableurs du trimestre)
  const [subjects, setSubjects] = useState<TermAverageSubject[]>(() => {
    if (initialCachedSheet?.subjects && initialCachedSheet.subjects.length > 0) {
      return initialCachedSheet.subjects;
    }
    return initialSubjects.map((s) => ({
      id: s.id,
      name: s.name,
      coefficient: s.coefficient ?? null,
      effectiveCoeff:
        s.coefficient !== undefined && s.coefficient !== null && s.coefficient > 0
          ? s.coefficient
          : 1,
      color: s.color,
      textColor: s.textColor,
      borderColor: s.borderColor,
      borderDarkColor: s.borderDarkColor,
    }));
  });
  const [subjectGradebooks, setSubjectGradebooks] = useState<
    Record<string, GradebookStudentSnapshot[]>
  >(() => initialCachedSheet?.subjectGradebooks || {});
  const [liveTerm, setLiveTerm] = useState<TermItem | null>(
    () => initialCachedSheet?.term || term || null
  );

  // États persistés dans D1 (teacher_class_averages)
  const [layout, setLayout] = useState<TermAverageLayoutState>(
    () => initialCachedSheet?.card?.layout || {}
  );
  const [styles, setStyles] = useState<TermAverageStylesState>(() => ({
    cellColors: initialCachedSheet?.card?.styles?.cellColors || {},
    rowColors: initialCachedSheet?.card?.styles?.rowColors || {},
    cellCustomStyles: initialCachedSheet?.card?.styles?.cellCustomStyles || {},
  }));
  const [overrides, setOverrides] = useState<TermAverageOverrides>(() => ({
    manualStudents: initialCachedSheet?.card?.overrides?.manualStudents || [],
    subjectOverrides: initialCachedSheet?.card?.overrides?.subjectOverrides || {},
    matriculeOverrides: initialCachedSheet?.card?.overrides?.matriculeOverrides || {},
    mergedLinks: initialCachedSheet?.card?.overrides?.mergedLinks || [],
    distinctPairs: initialCachedSheet?.card?.overrides?.distinctPairs || [],
  }));
  // Paramètres globaux de classe (mentions personnalisées + colonne Matricule + moyenne max)
  const [classSettings, setClassSettings] = useState<ClassSheetSettings>(() => ({
    mentionRules:
      initialCachedSheet?.classSettings?.mentionRules ??
      schoolClass.mentionRules ??
      null,
    showMatricule:
      initialCachedSheet?.classSettings?.showMatricule ??
      Boolean(schoolClass.showMatricule),
    averageScale:
      sanitizeAverageScale(initialCachedSheet?.classSettings?.averageScale) ??
      sanitizeAverageScale(schoolClass.averageScale) ??
      DEFAULT_AVERAGE_SCALE,
  }));
  const [closeMentionMatriculeSignal, setCloseMentionMatriculeSignal] = useState(0);
  const [editingMatriculeCell, setEditingMatriculeCell] = useState<{
    studentKey: string;
    draft: string;
  } | null>(null);
  const [isDuplicatesModalOpen, setIsDuplicatesModalOpen] = useState(false);
  const [manualMergePrimaryKey, setManualMergePrimaryKey] = useState('');
  const [manualMergeSecondaryKey, setManualMergeSecondaryKey] = useState('');
  const [sortMode, setSortMode] = useState<TermAverageSortMode>(
    () => initialCachedSheet?.card?.sortMode || 'merit'
  );
  const [zoomPercent, setZoomPercent] = useState<number>(() => {
    const z = initialCachedSheet?.card?.layout?.zoomPercent;
    return typeof z === 'number' && z >= 40 && z <= 180 ? Math.round(z) : 80;
  });

  // Statut de synchronisation cloud
  const [cloudStatus, setCloudStatus] = useState<
    'loading' | 'idle' | 'saving' | 'saved' | 'offline' | 'error'
  >('loading');
  const [cloudError, setCloudError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [hasSavedAtLeastOnce, setHasSavedAtLeastOnce] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hydratedRef = useRef(false);

  // État interactif du tableur
  const [activeCell, setActiveCell] = useState<ActiveCellState>({
    cellKey: '',
    coordDisplay: 'A1',
    formulaText: '',
  });
  const [editingManualCell, setEditingManualCell] = useState<{
    studentKey: string;
    subjectId: string;
    draft: string;
    invalid?: boolean;
  } | null>(null);
  const [copiedTableSuccess, setCopiedTableSuccess] = useState(false);
  const [previewStudent, setPreviewStudent] = useState<ComputedTermAverageStudent | null>(null);

  // Historique Annuler / Rétablir
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<UndoSnapshot[]>([]);

  // Popovers intelligents (SmartFloatingPopover)
  const [openMenu, setOpenMenu] = useState<'bg' | 'text' | 'row' | 'sort' | null>(null);
  const bgBtnRef = useRef<HTMLButtonElement>(null);
  const textBtnRef = useRef<HTMLButtonElement>(null);
  const rowBtnRef = useRef<HTMLButtonElement>(null);
  const sortBtnRef = useRef<HTMLButtonElement>(null);
  const bulkCoeffBtnRef = useRef<HTMLButtonElement>(null);

  // Petit menu flottant d'ajout / modification rapide de coefficient de matière
  const [coeffPopover, setCoeffPopover] = useState<
    | {
        mode: 'single';
        subjectId: string;
        subjectName: string;
        anchorEl: HTMLElement;
        draft: string;
        error: string | null;
      }
    | {
        mode: 'bulk';
        anchorEl: HTMLElement;
        drafts: Record<string, string>;
        error: string | null;
      }
    | null
  >(null);
  const [isSavingCoeff, setIsSavingCoeff] = useState(false);

  // Règles de mention et visibilité Matricule effectives (priorité surcharge tableau, sinon classe, sinon défaut)
  const effectiveMentionRules = useMemo<readonly CustomMentionRule[]>(() => {
    if (layout.mentionRules === null) return DEFAULT_CUSTOM_MENTION_RULES;
    if (layout.mentionRules && layout.mentionRules.length > 0) return layout.mentionRules;
    if (classSettings.mentionRules && classSettings.mentionRules.length > 0) {
      return classSettings.mentionRules;
    }
    return DEFAULT_CUSTOM_MENTION_RULES;
  }, [layout.mentionRules, classSettings.mentionRules]);

  const hasCustomMentionRules = Boolean(
    layout.mentionRules !== null &&
      ((layout.mentionRules && layout.mentionRules.length > 0) ||
        (classSettings.mentionRules && classSettings.mentionRules.length > 0))
  );

  const effectiveShowMatricule =
    typeof layout.showMatricule === 'boolean'
      ? layout.showMatricule
      : Boolean(classSettings.showMatricule);

  const effectiveAverageScale =
    sanitizeAverageScale(layout.averageScale) ??
    sanitizeAverageScale(classSettings.averageScale) ??
    DEFAULT_AVERAGE_SCALE;
  const effectiveScaleLabel = formatScaleValue(effectiveAverageScale);
  const passThreshold = effectiveAverageScale / 2;

  // Largeurs effectives des colonnes (avec valeurs par défaut harmonieuses)
  const colWidthRank = layout.colWidthRank ?? 68;
  const colWidthPhoto = layout.colWidthPhoto ?? 64;
  const colWidthMatricule = layout.colWidthMatricule ?? 124;
  const colWidthName = layout.colWidthName ?? 220;
  const defaultSubjMoyW = layout.colWidthSubjectMoy ?? 78;
  const defaultSubjWeightedW = layout.colWidthSubjectWeighted ?? 86;
  const colWidthTotalGeneral = layout.colWidthTotalGeneral ?? 116;
  const colWidthGeneralAvg = layout.colWidthGeneralAvg ?? 114;
  const colWidthMention = layout.colWidthMention ?? 116;

  const getSubjMoyWidth = (subjectId: string) =>
    layout.customSubjectMoyWidths?.[subjectId] ?? defaultSubjMoyW;
  const getSubjWeightedWidth = (subjectId: string) =>
    layout.customSubjectWeightedWidths?.[subjectId] ?? defaultSubjWeightedW;

  // Refs pour flush sécurisé à la fermeture / changement
  const latestPayloadRef = useRef<ClassAverageSheetSavePayload>({
    layout,
    styles,
    overrides,
    sortMode,
  });
  useEffect(() => {
    latestPayloadRef.current = {
      layout: { ...layout, zoomPercent },
      styles,
      overrides,
      sortMode,
    };
  }, [layout, styles, overrides, sortMode, zoomPercent]);

  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  // Chargement live depuis le serveur (strictement isolé au compte)
  const loadFromCloud = useCallback(
    async (opts: { showSpinner?: boolean } = {}) => {
      if (opts.showSpinner) setIsRefreshing(true);
      else setCloudStatus('loading');
      setCloudError(null);

      const applyResponse = (res: ClassAverageSheetResponse) => {
        setSubjects(res.subjects || []);
        setSubjectGradebooks(res.subjectGradebooks || {});
        if (res.term) setLiveTerm(res.term);
        if (res.classSettings) {
          setClassSettings(res.classSettings);
        }
        if (!opts.showSpinner || !isDirtyRef.current) {
          const loadedLayout = res.card?.layout || {};
          setLayout(loadedLayout);
          if (
            typeof loadedLayout.zoomPercent === 'number' &&
            loadedLayout.zoomPercent >= 40 &&
            loadedLayout.zoomPercent <= 180
          ) {
            setZoomPercent(Math.round(loadedLayout.zoomPercent));
          }
          setStyles({
            cellColors: res.card?.styles?.cellColors || {},
            rowColors: res.card?.styles?.rowColors || {},
            cellCustomStyles: res.card?.styles?.cellCustomStyles || {},
          });
          setOverrides({
            manualStudents: res.card?.overrides?.manualStudents || [],
            subjectOverrides: res.card?.overrides?.subjectOverrides || {},
            matriculeOverrides: res.card?.overrides?.matriculeOverrides || {},
            mergedLinks: res.card?.overrides?.mergedLinks || [],
            distinctPairs: res.card?.overrides?.distinctPairs || [],
          });
          setSortMode(res.card?.sortMode || 'merit');
          setIsDirty(false);
        }
      };

      const token = getTeacherAuthToken();
      if (!token) {
        if (userId) {
          const cached = readUserClassAverageCache(userId, averageCard.id);
          if (cached) applyResponse(cached);
        }
        hydratedRef.current = true;
        setCloudStatus('offline');
        setCloudError('Session non connectée.');
        setIsRefreshing(false);
        return;
      }

      try {
        const res = await TeacherGradebookAPI.getClassAverageSheet(averageCard.id);
        applyResponse(res);
        if (userId) {
          writeUserClassAverageCache(userId, averageCard.id, res);
        }
        hydratedRef.current = true;
        setCloudStatus('idle');
      } catch (err: any) {
        if (userId) {
          const cached = readUserClassAverageCache(userId, averageCard.id);
          if (cached) applyResponse(cached);
        }
        hydratedRef.current = true;
        if (isOfflineOrNetworkError(err)) {
          setCloudStatus('offline');
          setCloudError('Hors ligne — Impossible de charger les dernières notes.');
        } else {
          setCloudStatus('error');
          setCloudError(err?.message || 'Erreur lors du chargement du tableau.');
        }
      } finally {
        setIsRefreshing(false);
      }
    },
    [averageCard.id, userId]
  );

  useEffect(() => {
    hydratedRef.current = false;
    loadFromCloud();
  }, [loadFromCloud]);

  // Sauvegarde vers le serveur (D1)
  const saveToCloud = useCallback(
    async (opts: { keepalive?: boolean; force?: boolean } = {}) => {
      if (!hydratedRef.current && !opts.force) return;
      const token = getTeacherAuthToken();
      if (!token) return;

      const payload = latestPayloadRef.current;
      if (!opts.keepalive) {
        setCloudStatus('saving');
        setCloudError(null);
      }

      try {
        await TeacherGradebookAPI.saveClassAverageSheet(averageCard.id, payload, {
          keepalive: opts.keepalive,
        });
        setIsDirty(false);
        setHasSavedAtLeastOnce(true);
        setCloudStatus('saved');
      } catch (err: any) {
        if (isOfflineOrNetworkError(err)) {
          setCloudStatus('offline');
          setCloudError("Hors ligne — Échec de l'enregistrement.");
        } else {
          setCloudStatus('error');
          setCloudError(err?.message || "Échec de l'enregistrement.");
        }
      }
    },
    [averageCard.id]
  );

  // Auto-save debounced (850 ms)
  useEffect(() => {
    if (!hydratedRef.current || !isDirty) return;
    const timer = window.setTimeout(() => {
      saveToCloud();
    }, 850);
    return () => window.clearTimeout(timer);
  }, [isDirty, layout, styles, overrides, sortMode, zoomPercent, saveToCloud]);

  // Flush sécurisé à la fermeture de l'onglet
  useEffect(() => {
    const onBeforeUnload = () => {
      if (isDirtyRef.current && hydratedRef.current) {
        saveToCloud({ keepalive: true });
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveToCloud]);

  const handleSafeBack = async () => {
    if (isDirtyRef.current && hydratedRef.current) {
      await saveToCloud();
    }
    onBack();
  };

  // Enregistrer les intervalles de mentions (ce tableau ou toute la classe)
  const handleSaveMentionRules = useCallback(
    async (rules: CustomMentionRule[] | null, scope: SheetSettingScope) => {
      const token = getTeacherAuthToken();
      if (scope === 'class') {
        if (token) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            mentionRules: rules,
          });
          setClassSettings(res.classSettings);
          setLayout((prev) => {
            if (!('mentionRules' in prev)) return prev;
            const next = { ...prev };
            delete next.mentionRules;
            return next;
          });
          if (userId) {
            const cached = readUserClassAverageCache(userId, averageCard.id);
            if (cached) {
              const nextCardLayout = { ...(cached.card?.layout || {}) };
              delete nextCardLayout.mentionRules;
              writeUserClassAverageCache(userId, averageCard.id, {
                ...cached,
                classSettings: res.classSettings,
                card: { ...cached.card, layout: nextCardLayout },
              });
            }
          }
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
          setHasSavedAtLeastOnce(true);
          setCloudStatus('saved');
          return;
        }
        const nextSettings: ClassSheetSettings = { ...classSettings, mentionRules: rules };
        setClassSettings(nextSettings);
        setLayout((prev) => {
          const next = { ...prev };
          delete next.mentionRules;
          return next;
        });
        onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        return;
      }

      const nextLayout: TermAverageLayoutState = {
        ...layout,
        zoomPercent,
        mentionRules: rules,
      };
      setLayout(nextLayout);
      const nextPayload: ClassAverageSheetSavePayload = {
        layout: nextLayout,
        styles,
        overrides,
        sortMode,
      };
      latestPayloadRef.current = nextPayload;
      if (token) {
        await TeacherGradebookAPI.saveClassAverageSheet(averageCard.id, nextPayload);
        setIsDirty(false);
        setHasSavedAtLeastOnce(true);
        setCloudStatus('saved');
      } else {
        setIsDirty(true);
      }
    },
    [
      schoolClass.id,
      classSettings,
      userId,
      averageCard.id,
      onClassSettingsUpdated,
      layout,
      zoomPercent,
      styles,
      overrides,
      sortMode,
    ]
  );

  // Enregistrer l'affichage de la colonne Matricule (ce tableau ou toute la classe)
  const handleSaveShowMatricule = useCallback(
    async (show: boolean, scope: SheetSettingScope) => {
      const token = getTeacherAuthToken();
      if (scope === 'class') {
        if (token) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            showMatricule: show,
          });
          setClassSettings(res.classSettings);
          setLayout((prev) => {
            if (!('showMatricule' in prev)) return prev;
            const next = { ...prev };
            delete next.showMatricule;
            return next;
          });
          if (userId) {
            const cached = readUserClassAverageCache(userId, averageCard.id);
            if (cached) {
              const nextCardLayout = { ...(cached.card?.layout || {}) };
              delete nextCardLayout.showMatricule;
              writeUserClassAverageCache(userId, averageCard.id, {
                ...cached,
                classSettings: res.classSettings,
                card: { ...cached.card, layout: nextCardLayout },
              });
            }
          }
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
          setHasSavedAtLeastOnce(true);
          setCloudStatus('saved');
          return;
        }
        const nextSettings: ClassSheetSettings = { ...classSettings, showMatricule: show };
        setClassSettings(nextSettings);
        setLayout((prev) => {
          const next = { ...prev };
          delete next.showMatricule;
          return next;
        });
        onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        return;
      }

      const nextLayout: TermAverageLayoutState = {
        ...layout,
        zoomPercent,
        showMatricule: show,
      };
      setLayout(nextLayout);
      const nextPayload: ClassAverageSheetSavePayload = {
        layout: nextLayout,
        styles,
        overrides,
        sortMode,
      };
      latestPayloadRef.current = nextPayload;
      if (token) {
        await TeacherGradebookAPI.saveClassAverageSheet(averageCard.id, nextPayload);
        setIsDirty(false);
        setHasSavedAtLeastOnce(true);
        setCloudStatus('saved');
      } else {
        setIsDirty(true);
      }
    },
    [
      schoolClass.id,
      classSettings,
      userId,
      averageCard.id,
      onClassSettingsUpdated,
      layout,
      zoomPercent,
      styles,
      overrides,
      sortMode,
    ]
  );

  // Enregistrer la moyenne maximale (ce tableau ou toute la classe)
  const handleSaveAverageScale = useCallback(
    async (scale: number, scope: SheetSettingScope) => {
      const cleanScale = sanitizeAverageScale(scale);
      if (cleanScale === null) return;
      const token = getTeacherAuthToken();
      if (scope === 'class') {
        if (token) {
          const res = await TeacherGradebookAPI.updateClassSheetSettings(schoolClass.id, {
            averageScale: cleanScale,
          });
          setClassSettings(res.classSettings);
          setLayout((prev) => {
            if (!('averageScale' in prev)) return prev;
            const next = { ...prev };
            delete next.averageScale;
            return next;
          });
          if (userId) {
            const cached = readUserClassAverageCache(userId, averageCard.id);
            if (cached) {
              const nextCardLayout = { ...(cached.card?.layout || {}) };
              delete nextCardLayout.averageScale;
              writeUserClassAverageCache(userId, averageCard.id, {
                ...cached,
                classSettings: res.classSettings,
                card: { ...cached.card, layout: nextCardLayout },
              });
            }
          }
          onClassSettingsUpdated?.(schoolClass.id, res.classSettings);
          setHasSavedAtLeastOnce(true);
          setCloudStatus('saved');
          return;
        }
        const nextSettings: ClassSheetSettings = {
          ...classSettings,
          averageScale: cleanScale,
        };
        setClassSettings(nextSettings);
        setLayout((prev) => {
          const next = { ...prev };
          delete next.averageScale;
          return next;
        });
        onClassSettingsUpdated?.(schoolClass.id, nextSettings);
        return;
      }

      const nextLayout: TermAverageLayoutState = {
        ...layout,
        zoomPercent,
        averageScale: cleanScale,
      };
      setLayout(nextLayout);
      const nextPayload: ClassAverageSheetSavePayload = {
        layout: nextLayout,
        styles,
        overrides,
        sortMode,
      };
      latestPayloadRef.current = nextPayload;
      if (token) {
        await TeacherGradebookAPI.saveClassAverageSheet(averageCard.id, nextPayload);
        setIsDirty(false);
        setHasSavedAtLeastOnce(true);
        setCloudStatus('saved');
      } else {
        setIsDirty(true);
      }
    },
    [
      schoolClass.id,
      classSettings,
      userId,
      averageCard.id,
      onClassSettingsUpdated,
      layout,
      zoomPercent,
      styles,
      overrides,
      sortMode,
    ]
  );

  // Calcul réactif temps réel du tableau complet
  const computed = useMemo(
    () =>
      computeTermGeneralAverageTable({
        subjects,
        subjectGradebooks,
        overrides,
        sortMode,
        mentionRules: effectiveMentionRules,
        averageScale: effectiveAverageScale,
      }),
    [subjects, subjectGradebooks, overrides, sortMode, effectiveMentionRules, effectiveAverageScale]
  );

  // Matières dont le coefficient n'a pas encore été enregistré en base
  const subjectsWithoutCoeff = useMemo(
    () =>
      computed.subjects.filter(
        (s) => s.coefficient === null || s.coefficient === undefined || s.coefficient <= 0
      ),
    [computed.subjects]
  );

  const parseSubjectCoeffInput = (
    raw: string
  ): { valid: boolean; value: number | null; error?: string } => {
    const trimmed = raw.trim().replace(',', '.');
    if (!trimmed) {
      return { valid: false, value: null, error: 'Veuillez saisir un coefficient (ex: 2).' };
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100) {
      return {
        valid: false,
        value: null,
        error: 'Entrez un nombre positif compris entre 0,25 et 100.',
      };
    }
    return { valid: true, value: Math.round(parsed * 100) / 100 };
  };

  const applySavedCoefficientsLocally = useCallback(
    (updates: Array<{ subjectId: string; coefficient: number }>) => {
      if (updates.length === 0) return;
      const map = new Map(updates.map((u) => [u.subjectId, u.coefficient]));
      setSubjects((prev) =>
        prev.map((s) => {
          const nextCoeff = map.get(s.id);
          if (nextCoeff === undefined) return s;
          return {
            ...s,
            coefficient: nextCoeff,
            effectiveCoeff: nextCoeff,
          };
        })
      );
      if (userId) {
        const cached = readUserClassAverageCache(userId, averageCard.id);
        if (cached && Array.isArray(cached.subjects)) {
          writeUserClassAverageCache(userId, averageCard.id, {
            ...cached,
            subjects: cached.subjects.map((s) => {
              const nextCoeff = map.get(s.id);
              if (nextCoeff === undefined) return s;
              return { ...s, coefficient: nextCoeff, effectiveCoeff: nextCoeff };
            }),
          });
        }
      }
      for (const u of updates) {
        onSubjectCoefficientUpdated?.(u.subjectId, u.coefficient);
      }
    },
    [averageCard.id, onSubjectCoefficientUpdated, userId]
  );

  const openSingleCoeffPopover = (
    subject: TermAverageSubject,
    anchorEl: HTMLElement
  ) => {
    setOpenMenu(null);
    setCoeffPopover({
      mode: 'single',
      subjectId: subject.id,
      subjectName: subject.name,
      anchorEl,
      draft:
        subject.coefficient !== null && subject.coefficient !== undefined && subject.coefficient > 0
          ? String(subject.coefficient).replace('.', ',')
          : '',
      error: null,
    });
  };

  const openBulkCoeffPopover = (anchorEl: HTMLElement) => {
    setOpenMenu(null);
    const initialDrafts: Record<string, string> = {};
    for (const s of subjectsWithoutCoeff) {
      initialDrafts[s.id] = '';
    }
    setCoeffPopover({
      mode: 'bulk',
      anchorEl,
      drafts: initialDrafts,
      error: null,
    });
  };

  const handleApplySingleCoeff = async () => {
    if (!coeffPopover || coeffPopover.mode !== 'single' || isSavingCoeff) return;
    const parsed = parseSubjectCoeffInput(coeffPopover.draft);
    if (!parsed.valid || parsed.value === null) {
      setCoeffPopover((prev) =>
        prev && prev.mode === 'single'
          ? { ...prev, error: parsed.error || 'Coefficient invalide.' }
          : prev
      );
      return;
    }

    const token = getTeacherAuthToken();
    if (!token) {
      setCoeffPopover((prev) =>
        prev && prev.mode === 'single'
          ? { ...prev, error: 'Session non connectée. Impossible d’enregistrer.' }
          : prev
      );
      return;
    }

    setIsSavingCoeff(true);
    try {
      await TeacherGradebookAPI.updateSubject(coeffPopover.subjectId, {
        coefficient: parsed.value,
      });
      applySavedCoefficientsLocally([
        { subjectId: coeffPopover.subjectId, coefficient: parsed.value },
      ]);
      setCoeffPopover(null);
      setCloudStatus('saved');
    } catch (err: any) {
      setCoeffPopover((prev) =>
        prev && prev.mode === 'single'
          ? {
              ...prev,
              error: isOfflineOrNetworkError(err)
                ? 'Hors ligne — Impossible d’enregistrer le coefficient.'
                : err?.message || 'Erreur lors de l’enregistrement.',
            }
          : prev
      );
    } finally {
      setIsSavingCoeff(false);
    }
  };

  const handleApplyBulkCoeffs = async () => {
    if (!coeffPopover || coeffPopover.mode !== 'bulk' || isSavingCoeff) return;
    const toSave: Array<{ subjectId: string; coefficient: number }> = [];
    for (const subj of subjectsWithoutCoeff) {
      const raw = (coeffPopover.drafts[subj.id] || '').trim();
      if (!raw) continue;
      const parsed = parseSubjectCoeffInput(raw);
      if (!parsed.valid || parsed.value === null) {
        setCoeffPopover((prev) =>
          prev && prev.mode === 'bulk'
            ? {
                ...prev,
                error: `Coefficient invalide pour ${subj.name} : entrez un nombre entre 0,25 et 100.`,
              }
            : prev
        );
        return;
      }
      toSave.push({ subjectId: subj.id, coefficient: parsed.value });
    }

    if (toSave.length === 0) {
      setCoeffPopover((prev) =>
        prev && prev.mode === 'bulk'
          ? { ...prev, error: 'Saisissez au moins un coefficient avant d’appliquer.' }
          : prev
      );
      return;
    }

    const token = getTeacherAuthToken();
    if (!token) {
      setCoeffPopover((prev) =>
        prev && prev.mode === 'bulk'
          ? { ...prev, error: 'Session non connectée. Impossible d’enregistrer.' }
          : prev
      );
      return;
    }

    setIsSavingCoeff(true);
    try {
      await Promise.all(
        toSave.map((item) =>
          TeacherGradebookAPI.updateSubject(item.subjectId, {
            coefficient: item.coefficient,
          })
        )
      );
      applySavedCoefficientsLocally(toSave);
      setCoeffPopover(null);
      setCloudStatus('saved');
    } catch (err: any) {
      setCoeffPopover((prev) =>
        prev && prev.mode === 'bulk'
          ? {
              ...prev,
              error: isOfflineOrNetworkError(err)
                ? 'Hors ligne — Impossible d’enregistrer les coefficients.'
                : err?.message || 'Erreur lors de l’enregistrement.',
            }
          : prev
      );
    } finally {
      setIsSavingCoeff(false);
    }
  };

  // Utilitaires Historique (Annuler / Rétablir)
  const pushUndoState = useCallback(() => {
    setUndoStack((prev) => [
      ...prev.slice(-29),
      { overrides, styles, sortMode },
    ]);
    setRedoStack([]);
  }, [overrides, styles, sortMode]);

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, { overrides, styles, sortMode }]);
    setUndoStack((prev) => prev.slice(0, -1));
    setOverrides(last.overrides);
    setStyles(last.styles);
    setSortMode(last.sortMode);
    setIsDirty(true);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, { overrides, styles, sortMode }]);
    setRedoStack((prev) => prev.slice(0, -1));
    setOverrides(next.overrides);
    setStyles(next.styles);
    setSortMode(next.sortMode);
    setIsDirty(true);
  };

  // Édition de styles par case / ligne
  const currentCellStyle: CellCustomStyle = activeCell.cellKey
    ? styles.cellCustomStyles?.[activeCell.cellKey] || {}
    : {};

  const updateActiveCellStyle = (patch: Partial<CellCustomStyle>) => {
    if (!activeCell.cellKey) return;
    pushUndoState();
    setStyles((prev) => {
      const curr = prev.cellCustomStyles?.[activeCell.cellKey] || {};
      return {
        ...prev,
        cellCustomStyles: {
          ...(prev.cellCustomStyles || {}),
          [activeCell.cellKey]: { ...curr, ...patch },
        },
      };
    });
    setIsDirty(true);
  };

  const applyRowColor = (color: string) => {
    if (!activeCell.rowKey) return;
    pushUndoState();
    setStyles((prev) => {
      const nextRows = { ...(prev.rowColors || {}) };
      if (!color) delete nextRows[activeCell.rowKey!];
      else nextRows[activeCell.rowKey!] = color;
      return { ...prev, rowColors: nextRows };
    });
    setIsDirty(true);
  };

  const getCellInlineStyle = (
    cellKey: string,
    rowKey?: string,
    rowHeightPx?: number
  ): React.CSSProperties => {
    const custom: CellCustomStyle = styles.cellCustomStyles?.[cellKey] || {};
    const rowBg = rowKey ? styles.rowColors?.[rowKey] : undefined;
    const cellBg = custom.bgColor || styles.cellColors?.[cellKey] || rowBg;
    return {
      backgroundColor: cellBg || undefined,
      color: custom.color || undefined,
      fontFamily: custom.fontFamily || undefined,
      fontSize: custom.fontSize ? `${custom.fontSize}px` : undefined,
      fontWeight: custom.bold !== undefined ? (custom.bold ? 700 : 400) : undefined,
      fontStyle: custom.italic ? 'italic' : undefined,
      textDecoration:
        [
          custom.underline ? 'underline' : '',
          custom.strikethrough ? 'line-through' : '',
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      textAlign: custom.textAlign || undefined,
      height: rowHeightPx ? `${rowHeightPx}px` : undefined,
    };
  };

  const getHeaderInlineStyle = (
    headerKey: string,
    extra?: React.CSSProperties
  ): React.CSSProperties => ({
    ...extra,
    ...getCellInlineStyle(headerKey),
  });

  const getCellTextOverrideStyle = (cellKey: string): React.CSSProperties | undefined => {
    const custom: CellCustomStyle | undefined = styles.cellCustomStyles?.[cellKey];
    if (!custom) return undefined;
    const dec = [
      custom.underline ? 'underline' : '',
      custom.strikethrough ? 'line-through' : '',
    ]
      .filter(Boolean)
      .join(' ');
    return {
      color: custom.color || undefined,
      fontFamily: custom.fontFamily || undefined,
      fontSize: custom.fontSize ? `${custom.fontSize}px` : undefined,
      fontWeight: custom.bold !== undefined ? (custom.bold ? 800 : 400) : undefined,
      fontStyle: custom.italic ? 'italic' : undefined,
      textDecoration: dec || undefined,
      textAlign: custom.textAlign || undefined,
    };
  };

  // Gestion d'éventuels anciens élèves manuels existants (ajout manuel désactivé dans ce tableau)
  const handleRenameManualStudent = (studentKey: string, newName: string) => {
    setOverrides((prev) => ({
      ...prev,
      manualStudents: (prev.manualStudents || []).map((ms) =>
        ms.key === studentKey ? { ...ms, name: newName } : ms
      ),
    }));
    setIsDirty(true);
  };

  const handleDeleteManualStudent = (studentKey: string) => {
    pushUndoState();
    setOverrides((prev) => {
      const nextSubj = { ...(prev.subjectOverrides || {}) };
      delete nextSubj[studentKey];
      return {
        ...prev,
        manualStudents: (prev.manualStudents || []).filter(
          (ms) => ms.key !== studentKey
        ),
        subjectOverrides: nextSubj,
      };
    });
    setIsDirty(true);
  };

  // Couche 3 : Fusionner deux lignes confirmées comme étant le même élève
  const handleMergeStudents = (primaryKey: string, secondaryKey: string) => {
    if (!primaryKey || !secondaryKey || primaryKey === secondaryKey) return;
    pushUndoState();
    setOverrides((prev) => {
      const prevLinks = Array.isArray(prev.mergedLinks) ? prev.mergedLinks : [];
      // Récupérer les éventuelles clés déjà fusionnées sous secondaryKey afin de tout regrouper sous primaryKey
      const secondaryOwnLink = prevLinks.find((l) => l.primaryKey === secondaryKey);
      const keysToAbsorb = [
        secondaryKey,
        ...(secondaryOwnLink ? secondaryOwnLink.mergedKeys : []),
      ];

      const filteredLinks = prevLinks
        .filter((l) => l.primaryKey !== secondaryKey)
        .map((l) =>
          l.primaryKey === primaryKey
            ? {
                primaryKey,
                mergedKeys: Array.from(new Set([...l.mergedKeys, ...keysToAbsorb])).filter(
                  (k) => k !== primaryKey
                ),
              }
            : l
        );

      const hasPrimary = filteredLinks.some((l) => l.primaryKey === primaryKey);
      const nextLinks = hasPrimary
        ? filteredLinks
        : [
            ...filteredLinks,
            {
              primaryKey,
              mergedKeys: Array.from(new Set(keysToAbsorb)).filter(
                (k) => k !== primaryKey
              ),
            },
          ];

      // Retirer la paire de distinctPairs si elle y était auparavant
      const targetPair = makeSortedPairKey(primaryKey, secondaryKey);
      const nextDistinct = (prev.distinctPairs || []).filter(
        (p) => makeSortedPairKey(p[0], p[1]) !== targetPair
      );

      return {
        ...prev,
        mergedLinks: nextLinks,
        distinctPairs: nextDistinct,
      };
    });
    setManualMergePrimaryKey('');
    setManualMergeSecondaryKey('');
    setIsDirty(true);
  };

  // Couche 3 : Confirmer que deux noms proches sont bien 2 élèves différents
  const handleMarkDistinctStudents = (keyA: string, keyB: string) => {
    if (!keyA || !keyB || keyA === keyB) return;
    pushUndoState();
    setOverrides((prev) => {
      const targetPair = makeSortedPairKey(keyA, keyB);
      const existing = prev.distinctPairs || [];
      if (existing.some((p) => makeSortedPairKey(p[0], p[1]) === targetPair)) {
        return prev;
      }
      return {
        ...prev,
        distinctPairs: [...existing, [keyA, keyB]],
      };
    });
    setIsDirty(true);
  };

  // Couche 3 : Séparer (annuler) une fusion confirmée par erreur
  const handleUnmergeStudent = (primaryKey: string, mergedKey: string) => {
    pushUndoState();
    setOverrides((prev) => {
      const nextLinks = (prev.mergedLinks || [])
        .map((l) =>
          l.primaryKey === primaryKey
            ? {
                ...l,
                mergedKeys: l.mergedKeys.filter((k) => k !== mergedKey),
              }
            : l
        )
        .filter((l) => l.mergedKeys.length > 0);
      return {
        ...prev,
        mergedLinks: nextLinks,
      };
    });
    setIsDirty(true);
  };

  const commitManualAverage = (
    studentKey: string,
    subjectId: string,
    rawDraft: string
  ) => {
    const parsed = parseManualAverageInput(rawDraft, effectiveAverageScale);
    if (!parsed.valid) {
      setEditingManualCell((prev) => (prev ? { ...prev, invalid: true } : null));
      return;
    }
    pushUndoState();
    setOverrides((prev) => {
      const nextOverrides = { ...(prev.subjectOverrides || {}) };
      const studentMap = { ...(nextOverrides[studentKey] || {}) };
      if (parsed.value === null) {
        delete studentMap[subjectId];
      } else {
        // Stocker normalisé sur /20 pour rester 100 % exact lors des changements de barème
        studentMap[subjectId] = (parsed.value / effectiveAverageScale) * 20;
      }
      if (Object.keys(studentMap).length === 0) {
        delete nextOverrides[studentKey];
      } else {
        nextOverrides[studentKey] = studentMap;
      }
      return {
        ...prev,
        subjectOverrides: nextOverrides,
      };
    });
    setEditingManualCell(null);
    setIsDirty(true);
  };

  const commitManualMatricule = (studentKey: string, rawDraft: string) => {
    const clean = rawDraft.trim().slice(0, 48);
    pushUndoState();
    setOverrides((prev) => {
      const nextMap = { ...(prev.matriculeOverrides || {}) };
      if (!clean) {
        delete nextMap[studentKey];
      } else {
        nextMap[studentKey] = clean;
      }
      return {
        ...prev,
        matriculeOverrides: nextMap,
      };
    });
    setEditingMatriculeCell(null);
    setIsDirty(true);
  };

  // Redimensionnement par glisser-déposer des colonnes
  const startColumnResize = (
    e: React.MouseEvent,
    currentWidth: number,
    minWidth: number,
    onUpdateWidth: (nextW: number) => void
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const scale = zoomPercent / 100;

    const onMove = (moveEv: MouseEvent) => {
      const delta = (moveEv.clientX - startX) / scale;
      const next = Math.max(minWidth, Math.min(460, Math.round(currentWidth + delta)));
      onUpdateWidth(next);
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setIsDirty(true);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Copier tout le tableau (TSV compatible Excel / WPS)
  const handleCopyEntireTable = async () => {
    try {
      const row1 = [
        'RANG',
        ...(effectiveShowMatricule ? ['MATRICULE'] : []),
        'NOM & PRÉNOM',
        ...computed.subjects.flatMap((s) => [
          `${s.name} (Coeff ${formatCoeffDisplay(s.effectiveCoeff)}) - Moy. /${effectiveScaleLabel}`,
          `${s.name} - Moy. × Coeff`,
        ]),
        `TOTAL GÉNÉRAL (Total Coeff : ${formatCoeffDisplay(computed.classSummary.totalClassCoeff)})`,
        `MOYENNE GÉNÉRALE (/${effectiveScaleLabel})`,
        'MENTION',
      ];

      const bodyRows = computed.students.map((st) => [
        st.rankLabel,
        ...(effectiveShowMatricule ? [st.matricule || ''] : []),
        st.name || 'Élève sans nom',
        ...computed.subjects.flatMap((s) => {
          const cell = st.cellsBySubject[s.id];
          return [
            formatFrenchNumber(cell?.effectiveAverage),
            formatFrenchNumber(cell?.weightedValue),
          ];
        }),
        formatFrenchNumber(st.totalGeneral),
        formatFrenchNumber(st.generalAverage),
        st.mention,
      ]);

      const footerRow = [
        '—',
        ...(effectiveShowMatricule ? [''] : []),
        'MOYENNE DE LA CLASSE',
        ...computed.subjects.flatMap((s) => {
          const stat = computed.classSummary.bySubject[s.id];
          return [
            formatFrenchNumber(stat?.classAverage20),
            formatFrenchNumber(stat?.classWeightedAverage),
          ];
        }),
        formatFrenchNumber(computed.classSummary.classTotalGeneralAvg),
        formatFrenchNumber(computed.classSummary.classGeneralAverage),
        computed.classSummary.passRatePercent !== null
          ? `Réussite : ${Math.round(computed.classSummary.passRatePercent)} %`
          : '—',
      ];

      const tsv = [row1, ...bodyRows, footerRow]
        .map((r) => r.join('\t'))
        .join('\n');
      await navigator.clipboard.writeText(tsv);
      setCopiedTableSuccess(true);
      setTimeout(() => setCopiedTableSuccess(false), 2500);
    } catch {
      // Ignorer erreur presse-papiers
    }
  };

  // Export Excel (.xlsx) avec en-têtes fusionnés par matière (Moy. /20 | Moy. × Coeff)
  const handleExportExcel = () => {
    const classLabel = schoolClass.name?.trim()
      ? schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
        ? schoolClass.name.trim()
        : `${schoolClass.level} - ${schoolClass.name.trim()}`
      : schoolClass.level;

    const termLabel = liveTerm?.name || term?.name || 'Trimestre';

    // Ligne 1 : En-têtes groupés
    const headerRow1: any[] = effectiveShowMatricule
      ? ['RANG', 'MATRICULE', 'NOM & PRÉNOM']
      : ['RANG', 'NOM & PRÉNOM'];
    const headerRow2: any[] = effectiveShowMatricule ? ['', '', ''] : ['', ''];
    const merges: XLSX.Range[] = effectiveShowMatricule
      ? [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // RANG
          { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // MATRICULE
          { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } }, // NOM & PRÉNOM
        ]
      : [
          { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } }, // RANG
          { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } }, // NOM & PRÉNOM
        ];

    let colCursor = effectiveShowMatricule ? 3 : 2;
    for (const subj of computed.subjects) {
      headerRow1.push(
        `${subj.name.toUpperCase()} (Coeff ${formatCoeffDisplay(subj.effectiveCoeff)})`,
        ''
      );
      headerRow2.push(`Moy. /${effectiveScaleLabel}`, 'Moy. × Coeff');
      merges.push({
        s: { r: 0, c: colCursor },
        e: { r: 0, c: colCursor + 1 },
      });
      colCursor += 2;
    }

    headerRow1.push(
      `TOTAL GÉNÉRAL (Coeff ${formatCoeffDisplay(computed.classSummary.totalClassCoeff)})`,
      `MOYENNE GÉNÉRALE (/${effectiveScaleLabel})`,
      'MENTION'
    );
    headerRow2.push('', '', '');
    merges.push(
      { s: { r: 0, c: colCursor }, e: { r: 1, c: colCursor } },
      { s: { r: 0, c: colCursor + 1 }, e: { r: 1, c: colCursor + 1 } },
      { s: { r: 0, c: colCursor + 2 }, e: { r: 1, c: colCursor + 2 } }
    );

    const studentRows = computed.students.map((st) => [
      st.rankLabel,
      ...(effectiveShowMatricule ? [st.matricule || ''] : []),
      st.name || 'Élève sans nom',
      ...computed.subjects.flatMap((s) => {
        const cell = st.cellsBySubject[s.id];
        return [
          cell?.effectiveAverage !== null && cell?.effectiveAverage !== undefined
            ? Number(cell.effectiveAverage.toFixed(2))
            : '',
          cell?.weightedValue !== null && cell?.weightedValue !== undefined
            ? Number(cell.weightedValue.toFixed(2))
            : '',
        ];
      }),
      st.totalGeneral !== null ? Number(st.totalGeneral.toFixed(2)) : '',
      st.generalAverage !== null ? Number(st.generalAverage.toFixed(2)) : '',
      st.mention,
    ]);

    const footerRow = [
      '',
      ...(effectiveShowMatricule ? [''] : []),
      'MOYENNE DE LA CLASSE',
      ...computed.subjects.flatMap((s) => {
        const stat = computed.classSummary.bySubject[s.id];
        return [
          stat?.classAverage20 !== null && stat?.classAverage20 !== undefined
            ? Number(stat.classAverage20.toFixed(2))
            : '',
          stat?.classWeightedAverage !== null &&
          stat?.classWeightedAverage !== undefined
            ? Number(stat.classWeightedAverage.toFixed(2))
            : '',
        ];
      }),
      computed.classSummary.classTotalGeneralAvg !== null
        ? Number(computed.classSummary.classTotalGeneralAvg.toFixed(2))
        : '',
      computed.classSummary.classGeneralAverage !== null
        ? Number(computed.classSummary.classGeneralAverage.toFixed(2))
        : '',
      computed.classSummary.passRatePercent !== null
        ? `Réussite : ${Math.round(computed.classSummary.passRatePercent)} %`
        : '',
    ];

    const ws = XLSX.utils.aoa_to_sheet([
      headerRow1,
      headerRow2,
      ...studentRows,
      footerRow,
    ]);
    ws['!merges'] = merges;

    const wb = XLSX.utils.book_new();
    const safeSheetName = `Moy_${termLabel}`.replace(/[\\/*?:[\]]/g, '').slice(0, 31) || 'Moyenne_Generale';
    XLSX.utils.book_append_sheet(wb, ws, safeSheetName);

    const fileName = `Moyenne_Generale_${classLabel}_${termLabel}.xlsx`.replace(
      /[^\w\d-_.]/g,
      '_'
    );
    XLSX.writeFile(wb, fileName);
  };

  // Jeu de données structuré pour le menu Télécharger (PDF / Word / Copier)
  const buildTermExportDataset = (): GradebookExportDataset => {
    const termLabel = liveTerm?.name || term?.name || 'Trimestre';
    const classLabel = schoolClass.name?.trim()
      ? schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
        ? schoolClass.name.trim()
        : `${schoolClass.level}_${schoolClass.name.trim()}`
      : schoolClass.level;

    const headers: string[] = [
      'Rang',
      ...(effectiveShowMatricule ? ['Matricule'] : []),
      'Nom & Prénom',
      ...computed.subjects.map(
        (s) => `${s.name} (c${formatCoeffDisplay(s.effectiveCoeff)})`
      ),
      `Total`,
      `Moy. /${effectiveScaleLabel}`,
      'Mention',
    ];

    const rows: string[][] = computed.students.map((st) => [
      st.rankLabel || '-',
      ...(effectiveShowMatricule ? [st.matricule || '-'] : []),
      st.name || 'Élève sans nom',
      ...computed.subjects.map((s) => {
        const cell = st.cellsBySubject[s.id];
        return cell?.effectiveAverage !== null && cell?.effectiveAverage !== undefined
          ? cell.effectiveAverage.toFixed(2)
          : '-';
      }),
      st.totalGeneral !== null ? st.totalGeneral.toFixed(2) : '-',
      st.generalAverage !== null ? st.generalAverage.toFixed(2) : '-',
      st.mention || '-',
    ]);

    const footerRow: string[] = [
      '',
      ...(effectiveShowMatricule ? [''] : []),
      'MOYENNE DE LA CLASSE',
      ...computed.subjects.map((s) => {
        const stat = computed.classSummary.bySubject[s.id];
        return stat?.classAverage20 !== null && stat?.classAverage20 !== undefined
          ? stat.classAverage20.toFixed(2)
          : '-';
      }),
      computed.classSummary.classTotalGeneralAvg !== null
        ? computed.classSummary.classTotalGeneralAvg.toFixed(2)
        : '-',
      computed.classSummary.classGeneralAverage !== null
        ? computed.classSummary.classGeneralAverage.toFixed(2)
        : '-',
      computed.classSummary.passRatePercent !== null
        ? `Réussite : ${Math.round(computed.classSummary.passRatePercent)} %`
        : '',
    ];

    const metaBadges: string[] = [
      `Total Coeff ${formatCoeffDisplay(computed.classSummary.totalClassCoeff)}`,
      `Barème /${effectiveScaleLabel}`,
      `${computed.students.length} élève${computed.students.length > 1 ? 's' : ''}`,
    ];
    if (computed.classSummary.passRatePercent !== null) {
      metaBadges.push(`Réussite : ${Math.round(computed.classSummary.passRatePercent)} %`);
    }

    return {
      fileBaseName: `Moyenne_Generale_${classLabel}_${termLabel}`,
      title: `MOYENNE GÉNÉRALE — ${termLabel.toUpperCase()}`,
      subtitle: [classDisplayName, schoolYear?.label].filter(Boolean).join(' • '),
      schoolName: school?.name || undefined,
      metaBadges,
      headers,
      rows,
      footerRow,
      summaryNote:
        computed.classSummary.classGeneralAverage !== null
          ? `Moyenne générale de classe : ${computed.classSummary.classGeneralAverage.toFixed(2)}/${effectiveScaleLabel}`
          : undefined,
      nameColumnIndex: effectiveShowMatricule ? 2 : 1,
    };
  };

  // Libellé de la classe pour l'en-tête
  const classDisplayName = schoolClass.name?.trim()
    ? schoolClass.name.toLowerCase().includes(schoolClass.level.toLowerCase())
      ? schoolClass.name.trim()
      : `${schoolClass.level} • ${schoolClass.name.trim()}`
    : schoolClass.level;

  const periodBadgeLabel = `${liveTerm?.name || term?.name || 'Trimestre'}${
    liveTerm?.coefficient !== undefined && liveTerm?.coefficient !== null
      ? ` · Coeff ${formatCoeffDisplay(liveTerm.coefficient)}`
      : ''
  }`;

  const totalTableWidth =
    colWidthRank +
    colWidthPhoto +
    (effectiveShowMatricule ? colWidthMatricule : 0) +
    colWidthName +
    computed.subjects.reduce(
      (acc, s) => acc + getSubjMoyWidth(s.id) + getSubjWeightedWidth(s.id),
      0
    ) +
    colWidthTotalGeneral +
    colWidthGeneralAvg +
    colWidthMention;

  const backgroundColCount = Math.max(
    36,
    Math.ceil((totalTableWidth + 320) / 64)
  );
  const backgroundRowCount = Math.max(22, computed.students.length + 10);

  const sortLabelMap: Record<TermAverageSortMode, string> = {
    merit: 'Ordre de mérite',
    alpha: 'Alphabétique (A→Z)',
    order: 'Ordre initial',
  };

  const [isDelmasAssistantOpen, setIsDelmasAssistantOpen] = useState(false);

  const delmasSheetBridge: TeacherDelmasSheetBridge = {
    getContext: (): TeacherDelmasActiveContext => ({
      sheetKind: 'term_average',
      yearId: schoolYear?.id,
      yearLabel: schoolYear?.label,
      schoolId: school?.id,
      schoolName: school?.name,
      classId: schoolClass.id,
      className: classDisplayName,
      levelName: schoolClass.level,
      termId: liveTerm?.id || term?.id,
      termName: liveTerm?.name || term?.name || 'Trimestre',
      termCoefficient: liveTerm?.coefficient ?? term?.coefficient ?? null,
      averageCardId: averageCard.id,
      averageCardTitle: averageCard.title,
      sortMode,
      showMatricule: effectiveShowMatricule,
      averageScale: effectiveAverageScale,
      mentionRules: effectiveMentionRules,
      zoomPercent,
      activeCellCoord: activeCell.coordDisplay || undefined,
      activeCellValue: activeCell.formulaText || undefined,
      students: computed.students.map((st, idx) => ({
        rowIndex: idx + 1,
        id: st.key,
        name: st.name || '',
        matricule: st.matricule || '',
        averageFormatted:
          st.generalAverage !== null ? st.generalAverage.toFixed(2) : '',
        averageNumber: st.generalAverage,
        rank: st.rankLabel || '',
        mention: st.mention || '',
      })),
      generalAverageMeta: {
        totalClassCoeff: computed.classSummary.totalClassCoeff,
        classGeneralAverage: computed.classSummary.classGeneralAverage,
        passRatePercent: computed.classSummary.passRatePercent,
        subjects: computed.subjects.map((s) => ({
          id: s.id,
          name: s.name,
          coefficient: s.coefficient ?? null,
        })),
      },
    }),

    executeActions: async (actions: TeacherDelmasAction[]): Promise<string[]> => {
      const summaries: string[] = [];
      if (!Array.isArray(actions) || actions.length === 0) return summaries;

      const normKey = (v: unknown) =>
        String(v || '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/\s+/g, ' ')
          .trim();

      const workingStyles: TermAverageStylesState = {
        cellColors: { ...(styles.cellColors || {}) },
        rowColors: { ...(styles.rowColors || {}) },
        cellCustomStyles: { ...(styles.cellCustomStyles || {}) },
      };
      const workingLayout: TermAverageLayoutState = {
        ...layout,
        customSubjectMoyWidths: { ...(layout.customSubjectMoyWidths || {}) },
        customSubjectWeightedWidths: { ...(layout.customSubjectWeightedWidths || {}) },
        customRowHeights: { ...(layout.customRowHeights || {}) },
      };
      let workingZoom = zoomPercent;
      let stylesMutated = false;
      let layoutMutated = false;
      let zoomMutated = false;
      let undoPushed = false;
      const ensureUndoSnapshot = () => {
        if (!undoPushed) {
          pushUndoState();
          undoPushed = true;
        }
      };

      const findMatchingSubjectIds = (rawName?: unknown): string[] => {
        const search = normKey(rawName);
        if (!search) return computed.subjects.map((s) => s.id);
        const exact = computed.subjects.filter((s) => normKey(s.name) === search);
        if (exact.length > 0) return exact.map((s) => s.id);
        const partial = computed.subjects.filter((s) => {
          const sn = normKey(s.name);
          return sn.includes(search) || search.includes(sn);
        });
        return partial.map((s) => s.id);
      };

      for (const action of actions) {
        if (!action || typeof action !== 'object') continue;
        switch (action.type) {
          case 'set_subject_coefficient': {
            const coeffNum = Number(String(action.coefficient ?? '').replace(',', '.'));
            const searchName = normKey(action.subjectName);
            if (Number.isFinite(coeffNum) && coeffNum >= 0.25 && coeffNum <= 100) {
              const targetSubj =
                computed.subjects.find((s) => s.id === action.subjectId) ||
                computed.subjects.find(
                  (s) =>
                    searchName &&
                    (normKey(s.name) === searchName ||
                      normKey(s.name).includes(searchName))
                );
              if (targetSubj && getTeacherAuthToken()) {
                await TeacherGradebookAPI.updateSubject(targetSubj.id, {
                  coefficient: coeffNum,
                });
                applySavedCoefficientsLocally([
                  { subjectId: targetSubj.id, coefficient: coeffNum },
                ]);
                setCloudStatus('saved');
                summaries.push(`✓ Coefficient de ${targetSubj.name} passé à ${coeffNum}`);
              }
            }
            break;
          }
          case 'set_sort_mode': {
            const mode: TermAverageSortMode =
              action.sortMode === 'merit' || action.mode === 'merit'
                ? 'merit'
                : action.sortMode === 'alpha' || action.mode === 'alpha'
                ? 'alpha'
                : 'order';
            handleSortChange(mode);
            summaries.push(`✓ Classement : ${sortLabelMap[mode]}`);
            break;
          }
          case 'set_show_matricule': {
            const show = action.show !== undefined ? Boolean(action.show) : true;
            const scope: SheetSettingScope =
              action.scope === 'class' ? 'class' : 'sheet';
            await handleSaveShowMatricule(show, scope);
            summaries.push(`✓ Colonne Matricule ${show ? 'affichée' : 'masquée'}`);
            break;
          }
          case 'set_average_scale': {
            const scale = Number(action.scale) || 20;
            const scope: SheetSettingScope =
              action.scope === 'class' ? 'class' : 'sheet';
            await handleSaveAverageScale(scale, scope);
            summaries.push(`✓ Barème de la moyenne passé sur /${scale}`);
            break;
          }
          case 'set_mention_rules': {
            if (Array.isArray(action.rules) && action.rules.length > 0) {
              const scope: SheetSettingScope =
                action.scope === 'class' ? 'class' : 'sheet';
              await handleSaveMentionRules(action.rules, scope);
              summaries.push(`✓ Intervalles de mentions mis à jour`);
            }
            break;
          }
          case 'format_cells': {
            ensureUndoSnapshot();
            const st = action.style || {};
            const stylePatch: Partial<CellCustomStyle> = {};
            if (typeof st.bold === 'boolean') stylePatch.bold = st.bold;
            if (typeof st.italic === 'boolean') stylePatch.italic = st.italic;
            if (typeof st.underline === 'boolean') stylePatch.underline = st.underline;
            if (typeof st.strikethrough === 'boolean') stylePatch.strikethrough = st.strikethrough;
            if (st.textColor !== undefined || st.color !== undefined) {
              stylePatch.color = String(st.textColor ?? st.color ?? '');
            }
            if (st.bgColor !== undefined) stylePatch.bgColor = String(st.bgColor);
            if (st.fontFamily) stylePatch.fontFamily = String(st.fontFamily);
            if (Number(st.fontSize) >= 8) {
              stylePatch.fontSize = Math.min(48, Math.round(Number(st.fontSize)));
            }
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

            const applyPatchToKey = (
              k: string,
              defaultFs = 12,
              singleCellParentRowKey?: string
            ) => {
              const prev = (workingStyles.cellCustomStyles?.[k] || {}) as CellCustomStyle;
              const next: CellCustomStyle = { ...prev, ...stylePatch };
              if (fontSizeDelta !== 0 && stylePatch.fontSize === undefined) {
                const baseFs = typeof prev.fontSize === 'number' ? prev.fontSize : defaultFs;
                next.fontSize = Math.min(48, Math.max(8, baseFs + fontSizeDelta));
              }
              if (stylePatch.color === '') delete next.color;
              if (stylePatch.bgColor === '') {
                if (singleCellParentRowKey && workingStyles.rowColors?.[singleCellParentRowKey]) {
                  next.bgColor = '#ffffff';
                } else {
                  delete next.bgColor;
                }
                if (workingStyles.cellColors && workingStyles.cellColors[k] !== undefined) {
                  delete workingStyles.cellColors[k];
                }
              }
              workingStyles.cellCustomStyles![k] = next;
              touchedCells++;
            };

            const matchedSubjIds = findMatchingSubjectIds(action.subjectName);

            const applyToHeaders = (onlyCol?: string) => {
              const hKeys: string[] = [];
              if (!onlyCol || onlyCol === 'all') {
                hKeys.push(
                  'header_rank',
                  'header_photo',
                  'header_matricule',
                  'header_name',
                  'header_total',
                  'header_avg',
                  'header_mention'
                );
                for (const s of computed.subjects) {
                  hKeys.push(`header_item_${s.id}`, `header_moy_${s.id}`, `header_tot_${s.id}`);
                }
              } else if (onlyCol === 'rank') hKeys.push('header_rank');
              else if (onlyCol === 'photo') hKeys.push('header_photo');
              else if (onlyCol === 'matricule') hKeys.push('header_matricule');
              else if (onlyCol === 'name') hKeys.push('header_name');
              else if (onlyCol === 'total') hKeys.push('header_total');
              else if (onlyCol === 'average') hKeys.push('header_avg');
              else if (onlyCol === 'mention') hKeys.push('header_mention');
              else if (onlyCol === 'subject' || onlyCol === 'note' || onlyCol === 'all_notes') {
                for (const sid of matchedSubjIds) {
                  hKeys.push(`header_item_${sid}`, `header_moy_${sid}`, `header_tot_${sid}`);
                }
              }
              hKeys.forEach((hk) => applyPatchToKey(hk, 11));
            };

            const applyToRow = (rowKey: string, onlyCol?: string) => {
              const isFullRow = !onlyCol || onlyCol === 'all';
              const keys: string[] = [];
              if (isFullRow) {
                keys.push(
                  `${rowKey}_rank`,
                  `${rowKey}_photo`,
                  `${rowKey}_matricule`,
                  `${rowKey}_name`,
                  `${rowKey}_total`,
                  `${rowKey}_avg`,
                  `${rowKey}_mention`
                );
                for (const s of computed.subjects) {
                  keys.push(`${rowKey}_moy_${s.id}`, `${rowKey}_tot_${s.id}`);
                }
                if (stylePatch.bgColor !== undefined) {
                  if (stylePatch.bgColor === '') {
                    delete workingStyles.rowColors![rowKey];
                  } else {
                    workingStyles.rowColors![rowKey] = stylePatch.bgColor;
                  }
                }
              } else if (onlyCol === 'rank') keys.push(`${rowKey}_rank`);
              else if (onlyCol === 'photo') keys.push(`${rowKey}_photo`);
              else if (onlyCol === 'matricule') keys.push(`${rowKey}_matricule`);
              else if (onlyCol === 'name') keys.push(`${rowKey}_name`);
              else if (onlyCol === 'total') keys.push(`${rowKey}_total`);
              else if (onlyCol === 'average') keys.push(`${rowKey}_avg`);
              else if (onlyCol === 'mention') keys.push(`${rowKey}_mention`);
              else if (onlyCol === 'subject' || onlyCol === 'note' || onlyCol === 'all_notes') {
                for (const sid of matchedSubjIds) {
                  keys.push(`${rowKey}_moy_${sid}`, `${rowKey}_tot_${sid}`);
                }
              }
              keys.forEach((k) => applyPatchToKey(k, 12, isFullRow ? undefined : rowKey));
            };

            const rankedByAvg = [...computed.students]
              .filter((s) => s.generalAverage !== null)
              .sort((a, b) => (b.generalAverage ?? -Infinity) - (a.generalAverage ?? -Infinity));

            if (action.target === 'header') {
              applyToHeaders(action.column);
            } else if (action.target === 'student') {
              const nameTargets: string[] = [];
              if (typeof action.studentName === 'string' && action.studentName.trim()) {
                nameTargets.push(normKey(action.studentName.replace(/\([^)]*\)/g, ' ')));
              }
              if (Array.isArray(action.studentNames)) {
                action.studentNames.forEach((n: unknown) => {
                  const nk = normKey(String(n || '').replace(/\([^)]*\)/g, ' '));
                  if (nk) nameTargets.push(nk);
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
              const matchedKeys = new Set<string>();
              for (const t of nameTargets) {
                if (/^(?:le\s+|la\s+)?(?:1er|1ere|premier|premiere|major)$/.test(t) && rankedByAvg[0]) {
                  matchedKeys.add(rankedByAvg[0].key);
                } else if (/^(?:le\s+|la\s+)?(?:2e|2eme|deuxieme)$/.test(t) && rankedByAvg[1]) {
                  matchedKeys.add(rankedByAvg[1].key);
                } else if (/^(?:le\s+|la\s+)?(?:dernier|derniere)$/.test(t) && rankedByAvg.length > 0) {
                  matchedKeys.add(rankedByAvg[rankedByAvg.length - 1].key);
                }
              }
              computed.students.forEach((st, idx) => {
                const sn = normKey(st.name);
                const matchesName =
                  nameTargets.length > 0 &&
                  Boolean(sn) &&
                  nameTargets.some((t) => sn === t || sn.includes(t) || t.includes(sn));
                if (matchesName || rowTargets.has(idx) || matchedKeys.has(st.key)) {
                  applyToRow(st.key, action.column);
                }
              });
            } else if (action.target === 'column') {
              computed.students.forEach((st) => applyToRow(st.key, action.column || 'all'));
              if (action.includeHeader) applyToHeaders(action.column || 'all');
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
              const topKeys = new Set(rankedByAvg.slice(0, topCount).map((s) => s.key));
              const bottomKeys = new Set(rankedByAvg.slice(-topCount).map((s) => s.key));
              const mentionTarget = normKey(action.mentionLabel);

              computed.students.forEach((st, idx) => {
                if (
                  action.condition === 'average_below' &&
                  st.generalAverage !== null &&
                  st.generalAverage < thresh
                ) {
                  applyToRow(st.key, action.column);
                } else if (
                  action.condition === 'average_above' &&
                  st.generalAverage !== null &&
                  st.generalAverage >= thresh
                ) {
                  applyToRow(st.key, action.column);
                } else if (
                  action.condition === 'average_between' &&
                  st.generalAverage !== null &&
                  st.generalAverage >= minT &&
                  st.generalAverage <= maxT
                ) {
                  applyToRow(st.key, action.column);
                } else if (action.condition === 'rank_top' && topKeys.has(st.key)) {
                  applyToRow(st.key, action.column);
                } else if (action.condition === 'rank_bottom' && bottomKeys.has(st.key)) {
                  applyToRow(st.key, action.column);
                } else if (
                  action.condition === 'mention_equals' &&
                  mentionTarget &&
                  normKey(st.mention).includes(mentionTarget)
                ) {
                  applyToRow(st.key, action.column);
                } else if (action.condition === 'alternating_rows' && idx % 2 === 1) {
                  applyToRow(st.key, action.column);
                }
              });
            } else {
              computed.students.forEach((st) => applyToRow(st.key, action.column));
              if (action.includeHeader) applyToHeaders(action.column);
            }
            if (touchedCells > 0) {
              stylesMutated = true;
              summaries.push(
                stylePatch.bgColor === '' && Object.keys(stylePatch).length === 1
                  ? `✓ Couleur retirée dans Moyenne Générale`
                  : `✓ Mise en forme appliquée dans Moyenne Générale`
              );
            }
            break;
          }
          case 'clear_formatting': {
            ensureUndoSnapshot();
            workingStyles.cellColors = {};
            workingStyles.rowColors = {};
            workingStyles.cellCustomStyles = {};
            stylesMutated = true;
            summaries.push(`✓ Mise en forme réinitialisée`);
            break;
          }
          case 'resize_columns': {
            const targetCol = String(action.column || 'all').toLowerCase();
            const computeNext = (current: number, minW: number, maxW = 520): number => {
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
            if (targetCol === 'all' || targetCol === 'rank') {
              workingLayout.colWidthRank = computeNext(workingLayout.colWidthRank ?? 68, 52);
            }
            if (targetCol === 'all' || targetCol === 'photo') {
              workingLayout.colWidthPhoto = computeNext(workingLayout.colWidthPhoto ?? 64, 52);
            }
            if (targetCol === 'all' || targetCol === 'matricule') {
              workingLayout.colWidthMatricule = computeNext(workingLayout.colWidthMatricule ?? 124, 90);
            }
            if (targetCol === 'all' || targetCol === 'name') {
              workingLayout.colWidthName = computeNext(workingLayout.colWidthName ?? 220, 140);
            }
            if (targetCol === 'all' || targetCol === 'total') {
              workingLayout.colWidthTotalGeneral = computeNext(workingLayout.colWidthTotalGeneral ?? 116, 88);
            }
            if (targetCol === 'all' || targetCol === 'average') {
              workingLayout.colWidthGeneralAvg = computeNext(workingLayout.colWidthGeneralAvg ?? 114, 88);
            }
            if (targetCol === 'all' || targetCol === 'mention') {
              workingLayout.colWidthMention = computeNext(workingLayout.colWidthMention ?? 116, 86);
            }
            if (
              targetCol === 'all' ||
              targetCol === 'subject' ||
              targetCol === 'note' ||
              targetCol === 'all_notes'
            ) {
              const targetIds = findMatchingSubjectIds(action.subjectName);
              for (const sid of targetIds) {
                const curM =
                  workingLayout.customSubjectMoyWidths?.[sid] ??
                  workingLayout.colWidthSubjectMoy ??
                  78;
                const curW =
                  workingLayout.customSubjectWeightedWidths?.[sid] ??
                  workingLayout.colWidthSubjectWeighted ??
                  86;
                workingLayout.customSubjectMoyWidths![sid] = computeNext(curM, 60, 320);
                workingLayout.customSubjectWeightedWidths![sid] = computeNext(curW, 68, 320);
              }
            }
            layoutMutated = true;
            summaries.push(`✓ Largeur des colonnes ajustée`);
            break;
          }
          case 'resize_rows': {
            const target = String(action.target || 'all');
            const matchedStudents: typeof computed.students = [];
            if (target === 'all') {
              matchedStudents.push(...computed.students);
            } else {
              const nameTargets: string[] = [];
              if (typeof action.studentName === 'string' && action.studentName.trim()) {
                nameTargets.push(normKey(action.studentName));
              }
              if (Array.isArray(action.studentNames)) {
                action.studentNames.forEach((n: unknown) => {
                  const nk = normKey(n);
                  if (nk) nameTargets.push(nk);
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
              computed.students.forEach((st, idx) => {
                const sn = normKey(st.name);
                const matchesName =
                  nameTargets.length > 0 &&
                  Boolean(sn) &&
                  nameTargets.some((t) => sn === t || sn.includes(t) || t.includes(sn));
                if (matchesName || rowTargets.has(idx)) {
                  matchedStudents.push(st);
                }
              });
            }
            for (const st of matchedStudents) {
              const curH = workingLayout.customRowHeights?.[st.key] ?? 44;
              let nextH = curH;
              if (typeof action.heightPx === 'number' && Number.isFinite(action.heightPx)) {
                nextH = Math.round(Math.max(28, Math.min(180, action.heightPx)));
              } else if (typeof action.deltaPx === 'number' && Number.isFinite(action.deltaPx)) {
                nextH = Math.round(Math.max(28, Math.min(180, curH + action.deltaPx)));
              }
              workingLayout.customRowHeights![st.key] = nextH;
            }
            if (matchedStudents.length > 0) {
              layoutMutated = true;
              summaries.push(`✓ Hauteur de ${matchedStudents.length} ligne(s) ajustée`);
            }
            break;
          }
          case 'reset_column_widths': {
            delete workingLayout.colWidthRank;
            delete workingLayout.colWidthPhoto;
            delete workingLayout.colWidthMatricule;
            delete workingLayout.colWidthName;
            delete workingLayout.colWidthSubjectMoy;
            delete workingLayout.colWidthSubjectWeighted;
            delete workingLayout.colWidthTotalGeneral;
            delete workingLayout.colWidthGeneralAvg;
            delete workingLayout.colWidthMention;
            workingLayout.customSubjectMoyWidths = {};
            workingLayout.customSubjectWeightedWidths = {};
            workingLayout.customRowHeights = {};
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
          case 'set_zoom': {
            const z = Math.min(180, Math.max(40, Math.round(Number(action.zoomPercent) || 80)));
            workingZoom = z;
            workingLayout.zoomPercent = z;
            zoomMutated = true;
            layoutMutated = true;
            summaries.push(`✓ Zoom réglé à ${z}%`);
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
            await exportGradebookToPdf(buildTermExportDataset());
            summaries.push(`✓ Export PDF téléchargé`);
            break;
          }
          case 'export_word': {
            await exportGradebookToWord(buildTermExportDataset());
            summaries.push(`✓ Export Word (.docx) téléchargé`);
            break;
          }
          case 'copy_table': {
            await copyGradebookToClipboard(buildTermExportDataset());
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
      if (stylesMutated) setStyles(workingStyles);
      if (layoutMutated) setLayout(workingLayout);
      if (zoomMutated) setZoomPercent(workingZoom);

      if (stylesMutated || layoutMutated || zoomMutated) {
        latestPayloadRef.current = {
          layout: { ...workingLayout, zoomPercent: workingZoom },
          styles: workingStyles,
          overrides,
          sortMode,
        };
        setIsDirty(true);
        setTimeout(() => {
          saveToCloud({ force: true });
        }, 220);
      } else if (explicitSaveRequested) {
        await saveToCloud({ force: true });
      }
      return summaries;
    },
  };

  return (
    <div
      ref={containerRef}
      className={`term-avg-sheet flex flex-col bg-[#f3f5f8] dark:bg-[#0b1120] text-slate-800 dark:text-slate-100 select-none overflow-hidden transition-colors duration-200 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-[60] w-screen h-screen'
          : 'relative w-full h-full min-h-0 flex-1'
      }`}
    >
      <style>{`
        .term-avg-sheet tr[data-custom-height="1"] > td {
          height: inherit !important;
        }
        .dark .term-avg-sheet > header,
        .dark .term-avg-sheet > section,
        .dark .term-avg-sheet > footer {
          background-color: #111827 !important;
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }
        .dark .term-avg-sheet > header button:not(.delmas-ribbon-trigger),
        .dark .term-avg-sheet > section button:not(.delmas-ribbon-trigger),
        .dark .term-avg-sheet > section select {
          background-color: #1e293b !important;
          border-color: #475569 !important;
          color: #e2e8f0 !important;
        }
        .dark .term-avg-sheet > header button:not(.delmas-ribbon-trigger):hover,
        .dark .term-avg-sheet > section button:not(.delmas-ribbon-trigger):hover {
          background-color: #334155 !important;
        }
        .dark .term-avg-sheet .term-avg-grid-canvas {
          background-color: #0b1120 !important;
        }
        .dark .term-avg-sheet .term-avg-excel-hdr,
        .dark .term-avg-sheet .term-avg-excel-gutter {
          background-color: #111827 !important;
          border-color: #334155 !important;
          color: #94a3b8 !important;
        }
        .dark .term-avg-sheet .term-avg-excel-margin {
          background-color: #0f172a !important;
          border-color: #1e293b !important;
        }
        .dark .term-avg-sheet .term-avg-table-card {
          background-color: #111827 !important;
          border-color: #64748b !important;
          color: #f1f5f9 !important;
        }
        .dark .term-avg-sheet .term-avg-table-card th {
          background-color: #1e293b !important;
          border-color: #475569 !important;
          color: #f1f5f9 !important;
        }
        .dark .term-avg-sheet .term-avg-table-card td {
          border-color: #334155 !important;
          color: #e2e8f0 !important;
        }
        .dark .term-avg-sheet .term-avg-table-card tbody tr {
          background-color: #111827 !important;
        }
        .dark .term-avg-sheet .term-avg-table-card tbody tr:hover {
          background-color: #1e293b !important;
        }
        .dark .term-avg-sheet .term-avg-table-card td[data-default-tint="true"] {
          background-color: #162033 !important;
        }
        .dark .term-avg-sheet .term-avg-table-card tr.term-avg-footer-row td {
          background-color: #1e293b !important;
          color: #f8fafc !important;
          border-color: #475569 !important;
        }
        .dark .term-avg-sheet .term-avg-bottom-bar {
          background-color: #0f172a !important;
          border-color: #334155 !important;
          color: #cbd5e1 !important;
        }
        .dark .term-avg-sheet .term-avg-bottom-bar button {
          background-color: #1e293b !important;
          border-color: #475569 !important;
          color: #f1f5f9 !important;
        }
      `}</style>
      {/* ========================================================================= */}
      {/* 1. EN-TÊTE PRINCIPAL (RETOUR, ENREGISTRER, STATUT, TITRE, ZOOM, EXPORT)   */}
      {/* ========================================================================= */}
      <header className="h-11 sm:h-12 bg-white border-b border-slate-300 px-2 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={handleSafeBack}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300/90 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            title="Retour à la classe"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5] text-slate-700" />
            <span className="leading-none hidden xs:inline">Retour</span>
          </button>

          <button
            type="button"
            onClick={() => saveToCloud({ force: true })}
            disabled={cloudStatus === 'saving'}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border shadow-2xs transition active:scale-95 shrink-0 cursor-pointer ${
              cloudStatus === 'offline' || cloudStatus === 'error'
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-300'
                : cloudStatus === 'saving'
                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-wait'
                : 'bg-white hover:bg-slate-50 text-[#00313d] border-slate-300'
            }`}
            title="Enregistrer les préférences et saisies de ce tableau"
          >
            {cloudStatus === 'saving' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-600" />
            ) : (
              <Save className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
            <span className="hidden sm:inline">Enregistrer</span>
          </button>

          {/* Pastille statut (zéro jargon technique) */}
          <div
            className={`hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border shrink-0 select-none ${
              cloudStatus === 'offline' || cloudStatus === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : cloudStatus === 'loading' || cloudStatus === 'saving' || isDirty
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}
            title={cloudError || 'Enregistrement automatique lié à votre compte'}
          >
            {cloudStatus === 'offline' ? (
              <>
                <WifiOff className="w-3 h-3 text-red-600 shrink-0" />
                <span>Hors ligne</span>
              </>
            ) : cloudStatus === 'error' ? (
              <>
                <CloudOff className="w-3 h-3 text-red-600 shrink-0" />
                <span>Échec enregistrement</span>
              </>
            ) : cloudStatus === 'loading' ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-700 shrink-0" />
                <span>Chargement de vos données...</span>
              </>
            ) : cloudStatus === 'saving' || isDirty ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin text-amber-700 shrink-0" />
                <span>Enregistrement en cours...</span>
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

          <div className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-sm border border-slate-400 bg-white shrink-0 shadow-2xs" />
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 truncate">
              <span className="truncate">{averageCard.title}</span>
              <span className="text-slate-400 font-normal hidden sm:inline">•</span>
              <span className="text-slate-600 font-semibold truncate hidden sm:inline">
                {classDisplayName}
              </span>
              <span className="text-slate-400 font-normal hidden lg:inline">•</span>
              <span className="text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded text-[10px] border border-cyan-200/80 hidden lg:inline-block shrink-0">
                {periodBadgeLabel}
              </span>
              {computed.subjects.length > 0 && (
                <span className="text-slate-700 font-extrabold bg-slate-100 px-1.5 py-0.5 rounded text-[10px] border border-slate-300/80 hidden xl:inline-block shrink-0">
                  Total Coeff : {formatCoeffDisplay(computed.classSummary.totalClassCoeff)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Contrôles droite : Actualiser, Zoom, Export .xlsx, SuperExpand */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={() => loadFromCloud({ showSpinner: true })}
            disabled={isRefreshing}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition active:scale-95 cursor-pointer"
            title="Actualiser les moyennes depuis les tableaux des matières"
          >
            <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden lg:inline">Actualiser</span>
          </button>

          <div
            className="flex items-center bg-slate-100 hover:bg-slate-200/90 border border-slate-300 rounded-lg p-0.5 shadow-2xs transition"
            title="Zoom d'affichage"
          >
            <button
              type="button"
              onClick={() => {
                setZoomPercent((prev) => Math.max(40, prev - 10));
                setIsDirty(true);
              }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 transition active:scale-90 cursor-pointer"
              title="Zoom arrière (-10%)"
            >
              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <span
              onClick={() => {
                setZoomPercent(80);
                setIsDirty(true);
              }}
              className="text-[11px] font-mono font-black text-slate-800 px-1.5 min-w-[36px] text-center cursor-pointer hover:text-blue-600 transition select-none"
              title="Réinitialiser le zoom à 80%"
            >
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => {
                setZoomPercent((prev) => Math.min(180, prev + 10));
                setIsDirty(true);
              }}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 transition active:scale-90 cursor-pointer"
              title="Zoom avant (+10%)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <GradebookDownloadMenu
            getDataset={buildTermExportDataset}
            onExportExcel={handleExportExcel}
          />

          <div className="flex items-center gap-1.5 shrink-0 ml-0.5">
            <ViewerSuperExpandButton
              expandLevel={viewerExpandLevel}
              onExpandChange={(lvl) => {
                setIsViewerMaximized(lvl >= 1);
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
              title={
                viewerExpandLevel >= 1 || isViewerMaximized
                  ? 'Réduire la vue'
                  : "Agrandir l'espace"
              }
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

      {/* ========================================================================= */}
      {/* 2. RUBAN D'OUTILS EXCEL (COPIER, POLICE, COULEURS, ALIGNEMENT, TRI)       */}
      {/* ========================================================================= */}
      <section className="bg-[#f8fafc] border-b border-slate-300 px-2 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-3 overflow-x-auto shrink-0 z-20">
        {/* Presse-papiers */}
        <div className="flex flex-col items-center pr-2.5 border-r border-slate-300/80 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCopyEntireTable}
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-bold border transition cursor-pointer ${
                copiedTableSuccess
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Copier l'ensemble du tableau pour coller dans Excel"
            >
              {copiedTableSuccess ? (
                <Check className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copiedTableSuccess ? 'Copié' : 'Copier'}</span>
            </button>
          </div>
          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
            Presse-papiers
          </span>
        </div>

        {/* Police & Styles de case */}
        <div className="flex flex-col items-center pr-2.5 border-r border-slate-300/80 shrink-0">
          <div className="flex items-center gap-1">
            <select
              value={currentCellStyle.fontFamily || 'Calibri'}
              onChange={(e) =>
                updateActiveCellStyle({ fontFamily: e.target.value })
              }
              disabled={!activeCell.cellKey}
              className="h-6 px-1.5 text-[11px] font-semibold bg-white border border-slate-300 rounded text-slate-700 outline-none disabled:opacity-50 cursor-pointer"
              title="Police de la case sélectionnée"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>

            <select
              value={currentCellStyle.fontSize || 12}
              onChange={(e) =>
                updateActiveCellStyle({ fontSize: Number(e.target.value) })
              }
              disabled={!activeCell.cellKey}
              className="h-6 w-12 px-1 text-[11px] font-semibold bg-white border border-slate-300 rounded text-slate-700 outline-none disabled:opacity-50 cursor-pointer"
              title="Taille de police"
            >
              {[9, 10, 11, 12, 13, 14, 16, 18, 20].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() =>
                updateActiveCellStyle({ bold: !currentCellStyle.bold })
              }
              disabled={!activeCell.cellKey}
              className={`w-6 h-6 flex items-center justify-center rounded border text-xs transition cursor-pointer disabled:opacity-40 ${
                currentCellStyle.bold
                  ? 'bg-blue-100 border-blue-400 text-blue-800'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Gras"
            >
              <Bold className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() =>
                updateActiveCellStyle({ italic: !currentCellStyle.italic })
              }
              disabled={!activeCell.cellKey}
              className={`w-6 h-6 flex items-center justify-center rounded border text-xs transition cursor-pointer disabled:opacity-40 ${
                currentCellStyle.italic
                  ? 'bg-blue-100 border-blue-400 text-blue-800'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Italique"
            >
              <Italic className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() =>
                updateActiveCellStyle({ underline: !currentCellStyle.underline })
              }
              disabled={!activeCell.cellKey}
              className={`w-6 h-6 flex items-center justify-center rounded border text-xs transition cursor-pointer disabled:opacity-40 ${
                currentCellStyle.underline
                  ? 'bg-blue-100 border-blue-400 text-blue-800'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Souligné"
            >
              <Underline className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() =>
                updateActiveCellStyle({
                  strikethrough: !currentCellStyle.strikethrough,
                })
              }
              disabled={!activeCell.cellKey}
              className={`w-6 h-6 flex items-center justify-center rounded border text-xs transition cursor-pointer disabled:opacity-40 ${
                currentCellStyle.strikethrough
                  ? 'bg-blue-100 border-blue-400 text-blue-800'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Barré"
            >
              <Strikethrough className="w-3 h-3" />
            </button>

            {/* Couleur de remplissage case */}
            <button
              ref={bgBtnRef}
              type="button"
              disabled={!activeCell.cellKey}
              onClick={() => setOpenMenu((m) => (m === 'bg' ? null : 'bg'))}
              className="h-6 px-1.5 flex items-center gap-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 transition cursor-pointer disabled:opacity-40"
              title="Couleur de fond de la case"
            >
              <PaintBucket className="w-3 h-3" />
              <span
                className="w-2.5 h-2.5 rounded-xs border border-slate-300"
                style={{
                  backgroundColor: currentCellStyle.bgColor || '#ffffff',
                }}
              />
            </button>

            {/* Couleur de texte */}
            <button
              ref={textBtnRef}
              type="button"
              disabled={!activeCell.cellKey}
              onClick={() => setOpenMenu((m) => (m === 'text' ? null : 'text'))}
              className="h-6 px-1.5 flex items-center gap-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-black text-[11px] transition cursor-pointer disabled:opacity-40"
              title="Couleur du texte"
            >
              <span
                style={{ color: currentCellStyle.color || '#0f172a' }}
                className="underline decoration-2"
              >
                A
              </span>
            </button>

            {/* Couleur de ligne complète */}
            <button
              ref={rowBtnRef}
              type="button"
              disabled={!activeCell.rowKey}
              onClick={() => setOpenMenu((m) => (m === 'row' ? null : 'row'))}
              className="h-6 px-1.5 flex items-center gap-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-[10px] font-bold transition cursor-pointer disabled:opacity-40"
              title="Couleur de la ligne élève sélectionnée"
            >
              <Palette className="w-3 h-3" />
              <span className="hidden xl:inline">Ligne</span>
            </button>
          </div>
          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
            Police & Couleurs
          </span>
        </div>

        {/* Alignement */}
        <div className="flex flex-col items-center pr-2.5 border-r border-slate-300/80 shrink-0">
          <div className="flex items-center gap-1">
            {(['left', 'center', 'right'] as const).map((al) => {
              const Icon =
                al === 'left'
                  ? AlignLeft
                  : al === 'center'
                  ? AlignCenter
                  : AlignRight;
              return (
                <button
                  key={al}
                  type="button"
                  disabled={!activeCell.cellKey}
                  onClick={() => updateActiveCellStyle({ textAlign: al })}
                  className={`w-6 h-6 flex items-center justify-center rounded border transition cursor-pointer disabled:opacity-40 ${
                    currentCellStyle.textAlign === al
                      ? 'bg-blue-100 border-blue-400 text-blue-800'
                      : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                  }`}
                  title={
                    al === 'left'
                      ? 'Aligner à gauche'
                      : al === 'center'
                      ? 'Centrer'
                      : 'Aligner à droite'
                  }
                >
                  <Icon className="w-3 h-3" />
                </button>
              );
            })}
          </div>
          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
            Alignement
          </span>
        </div>

        {/* Historique */}
        <div className="flex flex-col items-center pr-2.5 border-r border-slate-300/80 shrink-0">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 disabled:opacity-40 cursor-pointer"
              title="Annuler"
            >
              <Undo2 className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="w-6 h-6 flex items-center justify-center rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 disabled:opacity-40 cursor-pointer"
              title="Rétablir"
            >
              <Redo2 className="w-3 h-3" />
            </button>
          </div>
          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
            Historique
          </span>
        </div>

        {/* Tri & Réinitialisation */}
        <div className="flex flex-col items-center shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              ref={sortBtnRef}
              type="button"
              onClick={() => setOpenMenu((m) => (m === 'sort' ? null : 'sort'))}
              className="h-6 px-2 flex items-center gap-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-700 transition cursor-pointer"
              title="Choisir l'ordre d'affichage des élèves"
            >
              <ArrowUpDown className="w-3 h-3 text-blue-600" />
              <span>{sortLabelMap[sortMode]}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            <button
              type="button"
              onClick={() => {
                setLayout((prev) => ({
                  zoomPercent,
                  ...(prev.mentionRules !== undefined
                    ? { mentionRules: prev.mentionRules }
                    : {}),
                  ...(typeof prev.showMatricule === 'boolean'
                    ? { showMatricule: prev.showMatricule }
                    : {}),
                  ...(typeof prev.averageScale === 'number'
                    ? { averageScale: prev.averageScale }
                    : {}),
                }));
                setIsDirty(true);
              }}
              className="h-6 px-2 flex items-center gap-1 rounded bg-white hover:bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-600 transition cursor-pointer"
              title="Réinitialiser les largeurs des colonnes"
            >
              <RotateCcw className="w-3 h-3" />
              <span className="hidden lg:inline">Largeurs</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDuplicatesModalOpen(true)}
              className={`h-6 px-2 flex items-center gap-1.5 rounded border text-[11px] font-extrabold transition cursor-pointer ${
                computed.potentialDuplicates.length > 0
                  ? 'bg-amber-50 hover:bg-amber-100 border-amber-400 text-amber-900 shadow-2xs'
                  : 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
              }`}
              title="Vérifier les noms proches entre matières, fusionner ou séparer des élèves"
            >
              {computed.potentialDuplicates.length > 0 ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {computed.potentialDuplicates.length} rapprochement
                    {computed.potentialDuplicates.length > 1 ? 's' : ''} à vérifier
                  </span>
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Rapprochements</span>
                  {(overrides.mergedLinks?.length || 0) > 0 && (
                    <span className="px-1 rounded bg-blue-100 text-blue-800 text-[9.5px] font-black">
                      {overrides.mergedLinks?.length}
                    </span>
                  )}
                </>
              )}
            </button>
          </div>
          <span className="text-[9px] text-slate-400 font-semibold mt-0.5">
            Classement & Rapprochements
          </span>
        </div>

        {/* Groupes Mentions personnalisées, Colonne Matricule & Barème (ce tableau ou toute la classe) */}
        <MentionAndMatriculeControls
          effectiveMentionRules={effectiveMentionRules}
          hasCustomMentionRules={hasCustomMentionRules}
          showMatricule={effectiveShowMatricule}
          averageScale={effectiveAverageScale}
          classLabel={classDisplayName}
          boundaryEl={containerRef.current}
          onWillOpen={() => {
            setOpenMenu(null);
            setCoeffPopover(null);
          }}
          closeSignal={closeMentionMatriculeSignal}
          onSaveMentionRules={handleSaveMentionRules}
          onSaveShowMatricule={handleSaveShowMatricule}
          onSaveAverageScale={handleSaveAverageScale}
        />

        {/* Bouton Assistant Delmas (Robot bleu animé + "Assistant Delmas" écrit en bas, placé tout à droite du ruban) */}
        <TeacherDelmasAssistantRibbonButton
          isOpen={isDelmasAssistantOpen}
          onToggle={() => setIsDelmasAssistantOpen((prev) => !prev)}
        />
      </section>

      {/* ========================================================================= */}
      {/* 3. BARRE DE FORMULE EXCEL (Coordonnée active | fx | Détail du calcul)     */}
      {/* ========================================================================= */}
      <section className="h-7 sm:h-8 bg-white border-b border-slate-300 px-2 flex items-center gap-2 text-xs shrink-0 select-none relative z-20">
        <div className="flex items-center justify-between w-20 sm:w-24 h-6 px-1.5 bg-[#f9fafb] border border-slate-300 rounded text-slate-700 font-mono font-bold text-[11px] shrink-0">
          <span className="truncate">{activeCell.coordDisplay}</span>
          <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
        </div>
        <div className="w-[1px] h-4 bg-slate-300 shrink-0" />
        <div className="flex items-center justify-center w-5 h-5 text-slate-500 font-serif italic font-bold text-xs shrink-0">
          fx
        </div>
        <div className="flex-1 h-6 px-2 flex items-center text-slate-700 font-medium text-xs truncate bg-slate-50/60 rounded">
          {activeCell.formulaText ||
            'Cliquez sur une case pour voir le détail du calcul (Moy. /20 × Coeff = Total, Moyenne générale)...'}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3B. BANDEAU D'ALERTE COEFFICIENTS MANQUANTS + AJOUT RAPIDE                */}
      {/* ========================================================================= */}
      {subjectsWithoutCoeff.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-700/80 px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0 select-none z-20">
          <div className="flex items-center gap-2 min-w-0">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="text-amber-950 dark:text-amber-100 font-semibold leading-snug">
              {subjectsWithoutCoeff.length === 1 ? (
                <>
                  Aucun coefficient enregistré pour{' '}
                  <strong className="font-extrabold">{subjectsWithoutCoeff[0].name}</strong>{' '}
                  <span className="text-amber-800/90 dark:text-amber-300/90 font-normal">
                    (calculé provisoirement avec Coeff 1).
                  </span>
                </>
              ) : (
                <>
                  Aucun coefficient enregistré pour{' '}
                  <strong className="font-extrabold">
                    {subjectsWithoutCoeff.length} matières
                  </strong>{' '}
                  <span className="text-amber-800/90 dark:text-amber-300/90 font-normal">
                    (
                    {subjectsWithoutCoeff
                      .slice(0, 3)
                      .map((s) => s.name)
                      .join(', ')}
                    {subjectsWithoutCoeff.length > 3
                      ? ` +${subjectsWithoutCoeff.length - 3}`
                      : ''}
                    ) — calculées provisoirement avec Coeff 1.
                  </span>
                </>
              )}
            </span>
          </div>

          <button
            ref={bulkCoeffBtnRef}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (subjectsWithoutCoeff.length === 1) {
                openSingleCoeffPopover(subjectsWithoutCoeff[0], e.currentTarget);
              } else {
                openBulkCoeffPopover(e.currentTarget);
              }
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold border border-amber-700 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>
              {subjectsWithoutCoeff.length === 1
                ? 'Ajouter le coefficient'
                : 'Ajouter les coefficients'}
            </span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. GRILLE DE TABLEUR EXCEL AVEC LE TABLEAU DE MOYENNE GÉNÉRALE            */}
      {/* ========================================================================= */}
      <div
        className="term-avg-grid-canvas flex-1 min-h-0 overflow-auto bg-[#fafbfc] relative p-0 touch-pan-x touch-pan-y"
        onClick={(e) => {
          if (
            (e.target as HTMLElement)?.closest(
              'button, input, select, [data-cell-key]'
            )
          ) {
            return;
          }
          setOpenMenu(null);
          setCloseMentionMatriculeSignal((n) => n + 1);
        }}
      >
        <div
          className="inline-block min-w-full pb-24 pr-24"
          style={{ zoom: `${zoomPercent}%` }}
        >
          {/* En-têtes de colonnes Excel (A, B, C...) — toujours strictement au-dessus de la grille */}
          <div className="term-avg-excel-hdr flex items-center sticky top-0 z-30 bg-[#f8fafc] border-b border-slate-300 shadow-2xs">
            <div className="term-avg-excel-hdr w-9 h-6 bg-[#f1f5f9] border-r border-b border-slate-300 text-[10px] flex items-center justify-center font-mono text-slate-500 shrink-0 sticky left-0 z-40">
              ◢
            </div>
            {Array.from({ length: backgroundColCount }).map((_, c) => (
              <div
                key={`col-lbl-${c}`}
                className="term-avg-excel-hdr w-16 h-6 border-r border-b border-slate-300 bg-[#f8fafc] text-slate-500 font-mono text-[10.5px] font-semibold flex items-center justify-center shrink-0"
              >
                {getExcelColumnLabel(c)}
              </div>
            ))}
          </div>

          <div className="flex items-stretch">
            {/* Numéros de lignes Excel (1, 2, 3...) — toujours strictement au-dessus du tableau qui défile dessous */}
            <div className="term-avg-excel-gutter flex flex-col shrink-0 self-stretch sticky left-0 z-20 bg-[#f8fafc] border-r border-slate-300 shadow-[2px_0_4px_-2px_rgba(15,23,42,0.18)]">
              {Array.from({ length: backgroundRowCount }).map((_, r) => (
                <div
                  key={`row-num-${r}`}
                  className="term-avg-excel-hdr w-9 h-11 border-b border-slate-300 bg-[#f8fafc] text-slate-500 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0"
                >
                  {r + 1}
                </div>
              ))}
            </div>

            {/* Zone principale isolée à z-0 pour qu'aucun élément du tableau ne passe au-dessus de 1, 2, 3... ou A, B, C... */}
            <div className="relative shrink-0 z-0 isolate">
              {/* Ligne 1 de marge Excel au-dessus */}
              <div className="flex">
                {Array.from({ length: backgroundColCount }).map((_, c) => (
                  <div
                    key={`top-cell-${c}`}
                    className="term-avg-excel-margin w-16 h-6 border-r border-b border-slate-300 bg-white"
                  />
                ))}
              </div>

              <div className="flex items-start">
                {/* Petite marge Excel à gauche (compacte pour ne jamais cacher le début du tableau) */}
                <div className="flex flex-col shrink-0">
                  {Array.from({ length: backgroundRowCount - 1 }).map((_, r) => (
                    <div
                      key={`left-cell-${r}`}
                      className="term-avg-excel-margin w-6 h-11 border-r border-b border-slate-300 bg-white"
                    />
                  ))}
                </div>

                {/* ========================================================= */}
                {/* TABLEAU PRINCIPAL DE MOYENNE GÉNÉRALE DU TRIMESTRE        */}
                {/* ========================================================= */}
                <div className="term-avg-table-card bg-white border-2 border-slate-800 shadow-md relative">
                  {cloudStatus === 'loading' &&
                  computed.subjects.length === 0 &&
                  computed.students.length === 0 ? (
                    <div className="px-10 py-14 flex flex-col items-center justify-center gap-3 min-w-[680px]">
                      <Loader2 className="w-7 h-7 text-blue-600 animate-spin" />
                      <p className="text-sm font-bold text-slate-700">
                        Chargement de vos données...
                      </p>
                    </div>
                  ) : computed.subjects.length === 0 ? (
                    <div className="px-10 py-12 flex flex-col items-center justify-center text-center gap-3 min-w-[680px] max-w-[760px]">
                      <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
                        <Award className="w-6 h-6 text-blue-600" />
                      </div>
                      <h3 className="text-base font-black text-slate-800">
                        Aucune matière dans {liveTerm?.name || term?.name || 'ce trimestre'}
                      </h3>
                      <p className="text-xs text-slate-600 leading-relaxed max-w-md">
                        Créez d'abord les matières de ce trimestre (avec leur coefficient si souhaité). Chaque matière apparaîtra automatiquement en colonne ici avec sa <strong>Moyenne /20</strong> et son calcul <strong>Moyenne × Coeff</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={handleSafeBack}
                        className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Retourner créer des matières</span>
                      </button>
                    </div>
                  ) : (
                    <table
                      className="border-collapse table-fixed"
                      style={{ width: `${totalTableWidth}px` }}
                    >
                      <thead>
                        {/* LIGNE D'EN-TÊTE 1 : COLONNES FIXES + MATIÈRES GROUPÉES (2 SOUS-COLONNES) + RÉSULTATS */}
                        <tr className="bg-[#f1f5f9] text-slate-800">
                          {/* RANG */}
                          <th
                            rowSpan={2}
                            style={getHeaderInlineStyle('header_rank', { width: `${colWidthRank}px` })}
                            className="relative border-r border-b-2 border-slate-800 px-1.5 py-2 text-center font-black text-[11px] tracking-wide uppercase align-middle bg-[#eef2f6]"
                          >
                            RANG
                            <div
                              onMouseDown={(e) =>
                                startColumnResize(e, colWidthRank, 52, (w) =>
                                  setLayout((p) => ({ ...p, colWidthRank: w }))
                                )
                              }
                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>

                          {/* PROFIL */}
                          <th
                            rowSpan={2}
                            style={getHeaderInlineStyle('header_photo', { width: `${colWidthPhoto}px` })}
                            className="relative border-r border-b-2 border-slate-800 px-1.5 py-2 text-center font-black text-[11px] tracking-wide uppercase align-middle bg-[#eef2f6]"
                          >
                            PROFIL
                            <div
                              onMouseDown={(e) =>
                                startColumnResize(e, colWidthPhoto, 52, (w) =>
                                  setLayout((p) => ({ ...p, colWidthPhoto: w }))
                                )
                              }
                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>

                          {/* MATRICULE (optionnel — derrière PROFIL) */}
                          {effectiveShowMatricule && (
                            <th
                              rowSpan={2}
                              style={getHeaderInlineStyle('header_matricule', { width: `${colWidthMatricule}px` })}
                              className="relative border-r border-b-2 border-slate-800 px-2 py-2 text-center font-black text-[11px] tracking-wide uppercase align-middle bg-[#eef2f6]"
                            >
                              MATRICULE
                              <div
                                onMouseDown={(e) =>
                                  startColumnResize(e, colWidthMatricule, 90, (w) =>
                                    setLayout((p) => ({ ...p, colWidthMatricule: w }))
                                  )
                                }
                                className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                              />
                            </th>
                          )}

                          {/* NOM & PRÉNOM */}
                          <th
                            rowSpan={2}
                            style={getHeaderInlineStyle('header_name', { width: `${colWidthName}px` })}
                            className="relative border-r-2 border-b-2 border-slate-800 px-3 py-2 text-left font-black text-[11px] tracking-wide uppercase align-middle bg-[#eef2f6]"
                          >
                            NOM & PRÉNOM
                            <div
                              onMouseDown={(e) =>
                                startColumnResize(e, colWidthName, 140, (w) =>
                                  setLayout((p) => ({ ...p, colWidthName: w }))
                                )
                              }
                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>

                          {/* EN-TÊTES GROUPÉS DES MATIÈRES (COLSPAN = 2 : MOY. /20 | MOY. × COEFF) */}
                          {computed.subjects.map((subject) => {
                            const hasMissingCoeff =
                              subject.coefficient === null ||
                              subject.coefficient === undefined ||
                              subject.coefficient <= 0;
                            const accentColor = hasMissingCoeff
                              ? '#d97706'
                              : subject.color && subject.color.toLowerCase() !== '#ffffff'
                              ? subject.color
                              : '#0ea5e9';
                            return (
                              <th
                                key={`grp-${subject.id}`}
                                colSpan={2}
                                style={getHeaderInlineStyle(`header_item_${subject.id}`, {
                                  width: `${
                                    getSubjMoyWidth(subject.id) +
                                    getSubjWeightedWidth(subject.id)
                                  }px`,
                                })}
                                className="relative border-r-2 border-b border-slate-400 px-2 py-1.5 text-center align-middle bg-white group"
                              >
                                <div
                                  className="absolute top-0 left-0 right-0 h-1"
                                  style={{ backgroundColor: accentColor }}
                                />
                                <div className="flex items-center justify-center gap-1 pt-0.5">
                                  <span
                                    style={getCellTextOverrideStyle(`header_item_${subject.id}`)}
                                    className="font-black text-[11px] text-slate-900 dark:text-slate-100 uppercase leading-tight line-clamp-2"
                                    title={subject.name}
                                  >
                                    {subject.name}
                                  </span>
                                  {onOpenSubject && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onOpenSubject(subject.id);
                                      }}
                                      className="opacity-40 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 hover:text-blue-700 transition cursor-pointer shrink-0"
                                      title={`Ouvrir le tableau de notes : ${subject.name}`}
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                                {hasMissingCoeff ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSingleCoeffPopover(subject, e.currentTarget);
                                    }}
                                    className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 hover:bg-amber-200 dark:hover:bg-amber-800/80 border border-amber-400 dark:border-amber-600 text-[10px] font-extrabold text-amber-900 dark:text-amber-200 transition cursor-pointer"
                                    title={`Coefficient non enregistré pour ${subject.name} — cliquer pour l'ajouter`}
                                  >
                                    <AlertTriangle className="w-2.5 h-2.5 text-amber-700 dark:text-amber-300 shrink-0" />
                                    <span>Coeff manquant · + Ajouter</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openSingleCoeffPopover(subject, e.currentTarget);
                                    }}
                                    className="mt-0.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-300/90 dark:border-slate-600 hover:border-blue-400 text-[10px] font-extrabold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                    title={`Cliquer pour modifier le coefficient de ${subject.name}`}
                                  >
                                    <span>
                                      Coeff {formatCoeffDisplay(subject.effectiveCoeff)}
                                    </span>
                                  </button>
                                )}
                              </th>
                            );
                          })}

                          {/* TOTAL GÉNÉRAL (Somme des Moy. × Coeff) */}
                          <th
                            rowSpan={2}
                            style={getHeaderInlineStyle('header_total', { width: `${colWidthTotalGeneral}px` })}
                            className="relative border-r border-b-2 border-slate-800 px-2 py-2 text-center align-middle bg-indigo-50/70"
                          >
                            <div
                              style={getCellTextOverrideStyle('header_total')}
                              className="font-black text-[11px] text-indigo-950 uppercase leading-tight"
                            >
                              TOTAL GÉNÉRAL
                            </div>
                            <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
                              Total Coeff :{' '}
                              {formatCoeffDisplay(
                                computed.classSummary.totalClassCoeff
                              )}
                            </div>
                            <div
                              onMouseDown={(e) =>
                                startColumnResize(
                                  e,
                                  colWidthTotalGeneral,
                                  88,
                                  (w) =>
                                    setLayout((p) => ({
                                      ...p,
                                      colWidthTotalGeneral: w,
                                    }))
                                )
                              }
                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>

                          {/* MOYENNE GÉNÉRALE */}
                          <th
                            rowSpan={2}
                            style={getHeaderInlineStyle('header_avg', { width: `${colWidthGeneralAvg}px` })}
                            className="relative border-r border-b-2 border-slate-800 px-2 py-2 text-center align-middle bg-emerald-50/80"
                          >
                            <div
                              style={getCellTextOverrideStyle('header_avg')}
                              className="font-black text-[11px] text-emerald-950 uppercase leading-tight"
                            >
                              MOYENNE GÉNÉRALE
                            </div>
                            <div className="text-[10px] font-bold text-emerald-700 mt-0.5">
                              / {effectiveScaleLabel}
                            </div>
                            <div
                              onMouseDown={(e) =>
                                startColumnResize(
                                  e,
                                  colWidthGeneralAvg,
                                  88,
                                  (w) =>
                                    setLayout((p) => ({
                                      ...p,
                                      colWidthGeneralAvg: w,
                                    }))
                                )
                              }
                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>

                          {/* MENTION */}
                          <th
                            rowSpan={2}
                            style={getHeaderInlineStyle('header_mention', { width: `${colWidthMention}px` })}
                            className="relative border-b-2 border-slate-800 px-2 py-2 text-center font-black text-[11px] tracking-wide uppercase align-middle bg-[#eef2f6]"
                          >
                            MENTION
                            <div
                              onMouseDown={(e) =>
                                startColumnResize(e, colWidthMention, 86, (w) =>
                                  setLayout((p) => ({
                                    ...p,
                                    colWidthMention: w,
                                  }))
                                )
                              }
                              className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                            />
                          </th>
                        </tr>

                        {/* LIGNE D'EN-TÊTE 2 : SOUS-COLONNES MOY. /20 ET MOY. × COEFF POUR CHAQUE MATIÈRE */}
                        <tr className="bg-[#f8fafc] text-slate-600">
                          {computed.subjects.map((subject) => (
                            <React.Fragment key={`subhdr-${subject.id}`}>
                              <th
                                style={getHeaderInlineStyle(`header_moy_${subject.id}`, {
                                  width: `${getSubjMoyWidth(subject.id)}px`,
                                })}
                                className="relative border-r border-b-2 border-slate-800 px-1 py-1 text-center text-[10px] font-extrabold uppercase tracking-tight text-slate-700 bg-white"
                                title={`Moyenne sur ${effectiveScaleLabel} en ${subject.name}`}
                              >
                                Moy. /{effectiveScaleLabel}
                                <div
                                  onMouseDown={(e) =>
                                    startColumnResize(
                                      e,
                                      getSubjMoyWidth(subject.id),
                                      60,
                                      (w) =>
                                        setLayout((p) => ({
                                          ...p,
                                          customSubjectMoyWidths: {
                                            ...(p.customSubjectMoyWidths || {}),
                                            [subject.id]: w,
                                          },
                                        }))
                                    )
                                  }
                                  className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                                />
                              </th>
                              <th
                                style={getHeaderInlineStyle(`header_tot_${subject.id}`, {
                                  width: `${getSubjWeightedWidth(subject.id)}px`,
                                })}
                                className="relative border-r-2 border-b-2 border-slate-800 px-1 py-1 text-center text-[10px] font-extrabold uppercase tracking-tight text-indigo-800 bg-slate-50/90"
                                title={`Moyenne × Coeff ${formatCoeffDisplay(
                                  subject.effectiveCoeff
                                )} en ${subject.name}`}
                              >
                                Moy. × Coeff
                                <div
                                  onMouseDown={(e) =>
                                    startColumnResize(
                                      e,
                                      getSubjWeightedWidth(subject.id),
                                      68,
                                      (w) =>
                                        setLayout((p) => ({
                                          ...p,
                                          customSubjectWeightedWidths: {
                                            ...(p.customSubjectWeightedWidths ||
                                              {}),
                                            [subject.id]: w,
                                          },
                                        }))
                                    )
                                  }
                                  className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/60"
                                />
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {computed.students.length === 0 ? (
                          <tr>
                            <td
                              colSpan={(effectiveShowMatricule ? 7 : 6) + computed.subjects.length * 2}
                              className="px-6 py-10 text-center text-xs text-slate-500 border-b border-slate-300 bg-slate-50/40"
                            >
                              <p className="font-bold text-slate-700 mb-1">
                                Aucun élève enregistré pour ce trimestre pour le moment.
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                                Saisissez vos élèves et leurs notes dans les tableaux de chaque matière du trimestre : ils apparaîtront automatiquement ici avec leur moyenne générale.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          computed.students.map((student, rIdx) => {
                            const rowNum = rIdx + 1;
                            const rowKey = student.key;
                            const rowCustomHeight =
                              layout.customRowHeights?.[rowKey] ??
                              layout.customRowHeights?.[String(rIdx)];

                            return (
                              <tr
                                key={student.key}
                                data-custom-height={rowCustomHeight ? '1' : undefined}
                                style={rowCustomHeight ? { height: `${rowCustomHeight}px` } : undefined}
                                className="group hover:bg-blue-50/25 transition-colors"
                              >
                                {/* 1. RANG */}
                                {(() => {
                                  const cellKey = `${rowKey}_rank`;
                                  const isSel = activeCell.cellKey === cellKey;
                                  const rankBadge =
                                    student.rankNumber === 1
                                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                                      : student.rankNumber === 2
                                      ? 'bg-slate-200 text-slate-800 border-slate-300'
                                      : student.rankNumber === 3
                                      ? 'bg-orange-100 text-orange-900 border-orange-300'
                                      : '';
                                  return (
                                    <td
                                      data-cell-key={cellKey}
                                      onClick={() =>
                                        setActiveCell({
                                          cellKey,
                                          rowKey,
                                          coordDisplay: `RANG${rowNum}`,
                                          formulaText:
                                            student.rankNumber !== null
                                              ? `Rang de ${
                                                  student.name || 'cet élève'
                                                } : ${student.rankLabel} (Moyenne générale : ${formatFrenchNumber(
                                                  student.generalAverage
                                                )} / ${effectiveScaleLabel})`
                                              : 'Non classé (aucune moyenne saisie)',
                                        })
                                      }
                                      style={getCellInlineStyle(cellKey, rowKey)}
                                      className={`h-11 border-r border-b border-slate-300 px-1.5 text-center text-xs font-extrabold text-slate-800 align-middle cursor-pointer ${
                                        isSel ? 'ring-2 ring-inset ring-blue-500' : ''
                                      }`}
                                    >
                                      {rankBadge ? (
                                        <span
                                          className={`inline-block px-1.5 py-0.5 rounded-md border text-[11px] font-black ${rankBadge}`}
                                        >
                                          {student.rankLabel}
                                        </span>
                                      ) : (
                                        <span>{student.rankLabel}</span>
                                      )}
                                    </td>
                                  );
                                })()}

                                {/* 2. PROFIL (PHOTO) */}
                                {(() => {
                                  const cellKey = `${rowKey}_photo`;
                                  return (
                                    <td
                                      data-cell-key={cellKey}
                                      onClick={() => setPreviewStudent(student)}
                                      style={getCellInlineStyle(cellKey, rowKey)}
                                      className="h-11 border-r border-b border-slate-300 p-1 text-center align-middle cursor-pointer"
                                      title="Cliquer pour ouvrir la fiche récapitulative de l'élève"
                                    >
                                      <div className="w-9 h-9 mx-auto rounded-lg overflow-hidden border border-slate-300 bg-slate-100 flex items-center justify-center hover:ring-2 hover:ring-blue-400 transition">
                                        {student.photoUrl ? (
                                          <img
                                            src={student.photoUrl}
                                            alt={student.name || 'Élève'}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <User className="w-4 h-4 text-slate-400" />
                                        )}
                                      </div>
                                    </td>
                                  );
                                })()}

                                {/* 2bis. MATRICULE (optionnel — derrière PROFIL) */}
                                {effectiveShowMatricule &&
                                  (() => {
                                    const cellKey = `${rowKey}_matricule`;
                                    const isSel = activeCell.cellKey === cellKey;
                                    const isEditingMat =
                                      editingMatriculeCell?.studentKey === student.key;
                                    return (
                                      <td
                                        data-cell-key={cellKey}
                                        onClick={() => {
                                          setActiveCell({
                                            cellKey,
                                            rowKey,
                                            coordDisplay: `MAT${rowNum}`,
                                            formulaText: student.matricule
                                              ? `Matricule de ${student.name || 'cet élève'} : ${student.matricule} (cliquer pour modifier)`
                                              : `Matricule de ${student.name || 'cet élève'} : non renseigné (cliquer pour saisir)`,
                                          });
                                          if (!isEditingMat) {
                                            setEditingMatriculeCell({
                                              studentKey: student.key,
                                              draft: student.matricule || '',
                                            });
                                          }
                                        }}
                                        style={getCellInlineStyle(cellKey, rowKey)}
                                        className={`h-11 border-r border-b border-slate-300 px-2 text-center align-middle text-xs font-mono font-bold text-slate-700 cursor-pointer ${
                                          isSel ? 'ring-2 ring-inset ring-blue-500' : ''
                                        }`}
                                        title="Cliquer pour saisir ou modifier le matricule"
                                      >
                                        {isEditingMat ? (
                                          <input
                                            type="text"
                                            autoFocus
                                            maxLength={48}
                                            value={editingMatriculeCell.draft}
                                            onChange={(e) =>
                                              setEditingMatriculeCell((prev) =>
                                                prev ? { ...prev, draft: e.target.value } : null
                                              )
                                            }
                                            onBlur={() =>
                                              commitManualMatricule(
                                                student.key,
                                                editingMatriculeCell.draft
                                              )
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                commitManualMatricule(
                                                  student.key,
                                                  editingMatriculeCell.draft
                                                );
                                              } else if (e.key === 'Escape') {
                                                setEditingMatriculeCell(null);
                                              }
                                            }}
                                            placeholder="Matricule..."
                                            className="w-full h-7 px-1.5 text-center font-mono text-xs font-bold rounded border border-blue-500 bg-blue-50/60 text-slate-900 outline-none"
                                          />
                                        ) : student.matricule ? (
                                          <span className="truncate block">{student.matricule}</span>
                                        ) : (
                                          <span className="text-slate-300 font-sans font-normal">—</span>
                                        )}
                                      </td>
                                    );
                                  })()}

                                {/* 3. NOM & PRÉNOM */}
                                {(() => {
                                  const cellKey = `${rowKey}_name`;
                                  const isSel = activeCell.cellKey === cellKey;
                                  return (
                                    <td
                                      data-cell-key={cellKey}
                                      onClick={() =>
                                        setActiveCell({
                                          cellKey,
                                          rowKey,
                                          coordDisplay: `NOM${rowNum}`,
                                          formulaText: student.isManualOnly
                                            ? `${
                                                student.name || 'Nouvel élève'
                                              } (ajouté directement dans ce tableau)`
                                            : `${
                                                student.name || 'Élève'
                                              } — synchronisé automatiquement avec les matières (${
                                                student.gradedSubjectsCount
                                              }/${
                                                computed.subjects.length
                                              } matière(s) notée(s))`,
                                        })
                                      }
                                      style={getCellInlineStyle(cellKey, rowKey)}
                                      className={`h-11 border-r-2 border-b border-slate-300 border-r-slate-800/80 px-2.5 align-middle ${
                                        isSel ? 'ring-2 ring-inset ring-blue-500' : ''
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        {student.isManualOnly ? (
                                          <input
                                            type="text"
                                            value={student.name}
                                            onChange={(e) =>
                                              handleRenameManualStudent(
                                                student.key,
                                                e.target.value
                                              )
                                            }
                                            style={getCellTextOverrideStyle(cellKey)}
                                            placeholder="Nom et prénom de l'élève..."
                                            className="w-full bg-transparent text-xs font-bold text-slate-800 outline-none placeholder:text-slate-400 placeholder:font-normal"
                                          />
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setPreviewStudent(student);
                                            }}
                                            style={getCellTextOverrideStyle(cellKey)}
                                            className="text-left text-xs font-bold text-slate-800 hover:text-blue-700 transition truncate cursor-pointer w-full"
                                            title="Voir le récapitulatif complet de l'élève"
                                          >
                                            {student.name || 'Élève sans nom'}
                                          </button>
                                        )}

                                        {student.isManualOnly && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDeleteManualStudent(
                                                student.key
                                              );
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-600 transition cursor-pointer shrink-0"
                                            title="Retirer cet élève ajouté manuellement"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  );
                                })()}

                                {/* 4. POUR CHAQUE MATIÈRE : MOY. /20 + MOY. × COEFF */}
                                {computed.subjects.map((subject, sIdx) => {
                                  const cell = student.cellsBySubject[subject.id];
                                  const moyKey = `${rowKey}_moy_${subject.id}`;
                                  const weightedKey = `${rowKey}_tot_${subject.id}`;
                                  const isMoySel = activeCell.cellKey === moyKey;
                                  const isWeightedSel =
                                    activeCell.cellKey === weightedKey;

                                  const isEditingThis =
                                    editingManualCell?.studentKey ===
                                      student.key &&
                                    editingManualCell?.subjectId === subject.id;

                                  const canDirectEdit =
                                    cell?.source !== 'gradebook';

                                  return (
                                    <React.Fragment
                                      key={`cells-${student.key}-${subject.id}`}
                                    >
                                      {/* Sous-colonne 1 : MOY. /20 */}
                                      <td
                                        data-cell-key={moyKey}
                                        onClick={() => {
                                          const avgStr = formatFrenchNumber(
                                            cell?.effectiveAverage
                                          );
                                          setActiveCell({
                                            cellKey: moyKey,
                                            rowKey,
                                            coordDisplay: `M${sIdx + 1}:${rowNum}`,
                                            formulaText:
                                              cell?.source === 'gradebook'
                                                ? `${subject.name} · Moyenne de ${
                                                    student.name || 'cet élève'
                                                  } : ${avgStr} / ${effectiveScaleLabel} (calculée automatiquement depuis le tableau de la matière)`
                                                : cell?.source === 'manual'
                                                ? `${subject.name} · Saisie directe : ${avgStr} / ${effectiveScaleLabel} (cliquez pour modifier ou effacer)`
                                                : `${subject.name} · Aucune note dans la matière — cliquez ici pour saisir directement une moyenne (/${effectiveScaleLabel})`,
                                          });
                                          if (canDirectEdit && !isEditingThis) {
                                            setEditingManualCell({
                                              studentKey: student.key,
                                              subjectId: subject.id,
                                              draft:
                                                cell?.manualAverage !== null &&
                                                cell?.manualAverage !== undefined
                                                  ? String(
                                                      Math.round(cell.manualAverage * 100) / 100
                                                    ).replace('.', ',')
                                                  : '',
                                            });
                                          }
                                        }}
                                        style={getCellInlineStyle(moyKey, rowKey)}
                                        className={`h-11 border-r border-b border-slate-300 px-1.5 text-center align-middle text-xs font-bold relative cursor-pointer ${
                                          isMoySel
                                            ? 'ring-2 ring-inset ring-blue-500'
                                            : ''
                                        } ${
                                          cell?.effectiveAverage !== null &&
                                          cell.effectiveAverage < passThreshold
                                            ? 'text-red-600'
                                            : 'text-slate-800'
                                        }`}
                                        title={
                                          cell?.source === 'gradebook'
                                            ? 'Synchronisée automatiquement depuis le tableau de cette matière'
                                            : `Cliquer pour saisir directement une moyenne (/${effectiveScaleLabel})`
                                        }
                                      >
                                        {isEditingThis ? (
                                          <input
                                            type="text"
                                            autoFocus
                                            value={editingManualCell.draft}
                                            onChange={(e) =>
                                              setEditingManualCell((prev) =>
                                                prev
                                                  ? {
                                                      ...prev,
                                                      draft: e.target.value,
                                                      invalid: false,
                                                    }
                                                  : null
                                              )
                                            }
                                            onBlur={() =>
                                              commitManualAverage(
                                                student.key,
                                                subject.id,
                                                editingManualCell.draft
                                              )
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                commitManualAverage(
                                                  student.key,
                                                  subject.id,
                                                  editingManualCell.draft
                                                );
                                              } else if (e.key === 'Escape') {
                                                setEditingManualCell(null);
                                              }
                                            }}
                                            placeholder={`/${effectiveScaleLabel}`}
                                            className={`w-full h-7 text-center text-xs font-bold rounded outline-none border ${
                                              editingManualCell.invalid
                                                ? 'border-red-500 bg-red-50 text-red-700'
                                                : 'border-blue-500 bg-blue-50/60 text-slate-900'
                                            }`}
                                          />
                                        ) : (
                                          <div className="flex items-center justify-center gap-0.5">
                                            <span
                                              className={
                                                cell?.effectiveAverage === null
                                                  ? 'text-slate-300 font-normal'
                                                  : ''
                                              }
                                            >
                                              {formatFrenchNumber(
                                                cell?.effectiveAverage
                                              )}
                                            </span>
                                            {cell?.source === 'manual' && (
                                              <span
                                                className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0"
                                                title="Moyenne saisie directement ici"
                                              />
                                            )}
                                          </div>
                                        )}
                                      </td>

                                      {/* Sous-colonne 2 : MOY. × COEFF */}
                                      <td
                                        data-cell-key={weightedKey}
                                        onClick={() =>
                                          setActiveCell({
                                            cellKey: weightedKey,
                                            rowKey,
                                            coordDisplay: `T${sIdx + 1}:${rowNum}`,
                                            formulaText:
                                              cell?.effectiveAverage !== null &&
                                              cell?.weightedValue !== null
                                                ? `${subject.name} : ${formatFrenchNumber(
                                                    cell.effectiveAverage
                                                  )} × Coeff ${formatCoeffDisplay(
                                                    subject.effectiveCoeff
                                                  )} = ${formatFrenchNumber(
                                                    cell.weightedValue
                                                  )}`
                                                : `${subject.name} : en attente d'une moyenne /20`,
                                          })
                                        }
                                        style={getCellInlineStyle(
                                          weightedKey,
                                          rowKey
                                        )}
                                        className={`h-11 border-r-2 border-b border-slate-300 border-r-slate-400 bg-slate-50 dark:bg-[#162033] px-1.5 text-center align-middle text-xs font-semibold cursor-pointer ${
                                          isWeightedSel
                                            ? 'ring-2 ring-inset ring-blue-500'
                                            : ''
                                        } ${
                                          cell?.weightedValue === null
                                            ? 'text-slate-300 dark:text-slate-600'
                                            : 'text-indigo-900 dark:text-indigo-200'
                                        }`}
                                      >
                                        {formatFrenchNumber(cell?.weightedValue)}
                                      </td>
                                    </React.Fragment>
                                  );
                                })}

                                {/* 5. TOTAL GÉNÉRAL */}
                                {(() => {
                                  const cellKey = `${rowKey}_total`;
                                  const isSel = activeCell.cellKey === cellKey;
                                  const partialCoeff =
                                    student.totalCoeffCounted > 0 &&
                                    Math.abs(
                                      student.totalCoeffCounted -
                                        computed.classSummary.totalClassCoeff
                                    ) > 1e-6;
                                  return (
                                    <td
                                      data-cell-key={cellKey}
                                      onClick={() => {
                                        const parts = computed.subjects
                                          .map((s) => {
                                            const c =
                                              student.cellsBySubject[s.id];
                                            return c?.weightedValue !== null &&
                                              c?.weightedValue !== undefined
                                              ? formatFrenchNumber(
                                                  c.weightedValue
                                                )
                                              : null;
                                          })
                                          .filter(Boolean);
                                        setActiveCell({
                                          cellKey,
                                          rowKey,
                                          coordDisplay: `TOT${rowNum}`,
                                          formulaText:
                                            student.totalGeneral !== null
                                              ? `Total Général = ${parts.join(
                                                  ' + '
                                                )} = ${formatFrenchNumber(
                                                  student.totalGeneral
                                                )} (Total des coefficients comptés : ${formatCoeffDisplay(
                                                  student.totalCoeffCounted
                                                )})`
                                              : 'Total Général : aucune matière notée',
                                        });
                                      }}
                                      style={getCellInlineStyle(cellKey, rowKey)}
                                      className={`h-11 border-r border-b border-slate-300 bg-indigo-50/75 dark:bg-indigo-950/50 px-2 text-center align-middle cursor-pointer ${
                                        isSel
                                          ? 'ring-2 ring-inset ring-blue-500'
                                          : ''
                                      }`}
                                    >
                                      <div
                                        style={getCellTextOverrideStyle(cellKey)}
                                        className="text-xs font-black text-indigo-950 dark:text-indigo-200 leading-tight"
                                      >
                                        {formatFrenchNumber(student.totalGeneral)}
                                      </div>
                                      {partialCoeff && (
                                        <div className="text-[9px] font-bold text-indigo-600 dark:text-indigo-300 leading-none mt-0.5">
                                          Coeff{' '}
                                          {formatCoeffDisplay(
                                            student.totalCoeffCounted
                                          )}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })()}

                                {/* 6. MOYENNE GÉNÉRALE */}
                                {(() => {
                                  const cellKey = `${rowKey}_avg`;
                                  const isSel = activeCell.cellKey === cellKey;
                                  const isPassing =
                                    student.generalAverage !== null &&
                                    student.generalAverage + 1e-9 >= passThreshold;
                                  return (
                                    <td
                                      data-cell-key={cellKey}
                                      onClick={() =>
                                        setActiveCell({
                                          cellKey,
                                          rowKey,
                                          coordDisplay: `MOY${rowNum}`,
                                          formulaText:
                                            student.generalAverage !== null &&
                                            student.totalGeneral !== null
                                              ? `Moyenne Générale = ${formatFrenchNumber(
                                                  student.totalGeneral
                                                )} ÷ ${formatCoeffDisplay(
                                                  student.totalCoeffCounted
                                                )} = ${formatFrenchNumber(
                                                  student.generalAverage
                                                )} / ${effectiveScaleLabel}`
                                              : 'Moyenne Générale : aucune matière notée',
                                        })
                                      }
                                      style={getCellInlineStyle(cellKey, rowKey)}
                                      className={`h-11 border-r border-b border-slate-300 px-2 text-center align-middle text-[13px] font-black cursor-pointer ${
                                        isSel
                                          ? 'ring-2 ring-inset ring-blue-500'
                                          : ''
                                      } ${
                                        student.generalAverage === null
                                          ? 'bg-slate-50 dark:bg-[#162033] text-slate-400 dark:text-slate-500'
                                          : isPassing
                                          ? 'bg-emerald-50 dark:bg-emerald-950/45 text-emerald-800 dark:text-emerald-300'
                                          : 'bg-red-50 dark:bg-red-950/45 text-red-700 dark:text-red-300'
                                      }`}
                                    >
                                      {formatFrenchNumber(student.generalAverage)}
                                    </td>
                                  );
                                })()}

                                {/* 7. MENTION */}
                                {(() => {
                                  const cellKey = `${rowKey}_mention`;
                                  const isSel = activeCell.cellKey === cellKey;
                                  return (
                                    <td
                                      data-cell-key={cellKey}
                                      onClick={() =>
                                        setActiveCell({
                                          cellKey,
                                          rowKey,
                                          coordDisplay: `MEN${rowNum}`,
                                          formulaText: `Mention : ${student.mention}`,
                                        })
                                      }
                                      style={getCellInlineStyle(cellKey, rowKey)}
                                      className={`h-11 border-b border-slate-300 px-1.5 text-center align-middle cursor-pointer ${
                                        isSel
                                          ? 'ring-2 ring-inset ring-blue-500'
                                          : ''
                                      }`}
                                    >
                                      <span
                                        style={getCellTextOverrideStyle(cellKey)}
                                        className={`inline-block px-2 py-0.5 rounded-full border text-[10.5px] font-extrabold whitespace-nowrap ${getMentionBadgeStyle(
                                          student.generalAverage,
                                          effectiveMentionRules,
                                          effectiveAverageScale
                                        )}`}
                                      >
                                        {student.mention}
                                      </span>
                                    </td>
                                  );
                                })()}
                              </tr>
                            );
                          })
                        )}

                        {/* LIGNE DE SYNTHÈSE : MOYENNE DE LA CLASSE */}
                        <tr className="term-avg-footer-row bg-slate-100 border-t-2 border-slate-800 font-black text-slate-900">
                          <td
                            colSpan={effectiveShowMatricule ? 4 : 3}
                            className="h-11 border-r-2 border-b border-slate-800 px-3 text-right text-[11px] uppercase tracking-wide bg-slate-200/70"
                          >
                            Moyenne de la classe
                          </td>

                          {computed.subjects.map((subject) => {
                            const stat = computed.classSummary.bySubject[subject.id];
                            return (
                              <React.Fragment key={`cls-${subject.id}`}>
                                <td className="h-11 border-r border-b border-slate-400 px-1.5 text-center text-xs font-black text-slate-900 bg-white/80">
                                  {formatFrenchNumber(stat?.classAverage20)}
                                </td>
                                <td className="h-11 border-r-2 border-b border-slate-400 px-1.5 text-center text-xs font-extrabold text-indigo-900 bg-slate-100">
                                  {formatFrenchNumber(stat?.classWeightedAverage)}
                                </td>
                              </React.Fragment>
                            );
                          })}

                          <td className="h-11 border-r border-b border-slate-400 px-2 text-center text-xs font-black text-indigo-950 bg-indigo-100/70">
                            {formatFrenchNumber(
                              computed.classSummary.classTotalGeneralAvg
                            )}
                          </td>

                          <td className="h-11 border-r border-b border-slate-400 px-2 text-center text-[13px] font-black text-emerald-900 bg-emerald-100/80">
                            {formatFrenchNumber(
                              computed.classSummary.classGeneralAverage
                            )}
                          </td>

                          <td className="h-11 border-b border-slate-400 px-2 text-center text-[10.5px] font-extrabold text-slate-700 bg-slate-100">
                            {computed.classSummary.passRatePercent !== null
                              ? `Réussite : ${Math.round(
                                  computed.classSummary.passRatePercent
                                )} %`
                              : '—'}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  )}

                  {/* BANDEAU INFÉRIEUR DU TABLEAU : BILAN CLASSE (SYNCHRONISÉ AUTOMATIQUEMENT) */}
                  {computed.subjects.length > 0 && (
                    <div className="term-avg-bottom-bar bg-[#f8fafc] border-t border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        Les élèves sont synchronisés automatiquement depuis les tableaux de chaque matière.
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-slate-700 font-semibold">
                        <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200">
                          Effectif :{' '}
                          <strong className="text-slate-900">
                            {computed.classSummary.totalStudents}
                          </strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
                          Plus forte :{' '}
                          <strong>
                            {formatFrenchNumber(
                              computed.classSummary.highestAverage
                            )}
                          </strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-700">
                          Plus faible :{' '}
                          <strong>
                            {formatFrenchNumber(
                              computed.classSummary.lowestAverage
                            )}
                          </strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-800">
                          Admis (≥ {formatScaleValue(passThreshold)}) :{' '}
                          <strong>
                            {computed.classSummary.passCount}/
                            {computed.classSummary.gradedStudentCount}
                          </strong>
                          {computed.classSummary.passRatePercent !== null
                            ? ` (${Math.round(
                                computed.classSummary.passRatePercent
                              )} %)`
                            : ''}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. BARRE D'ONGLET DE FEUILLE EN BAS (ÉPURÉE)                              */}
      {/* ========================================================================= */}
      <footer className="h-8 bg-[#eef2f6] border-t border-slate-300 px-3 flex items-center justify-between text-[11px] shrink-0 select-none z-20">
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-white border border-b-0 border-slate-300 rounded-t-md font-extrabold text-[#00313d] shadow-2xs -mt-1">
            {averageCard.title}
          </div>
          <span className="hidden sm:inline text-[10.5px] text-slate-500">
            Calcul automatique par matière (Moy. /{effectiveScaleLabel} et Moy. × Coeff) •{' '}
            {computed.subjects.length} matière(s)
          </span>
        </div>
        <div className="text-[10.5px] font-semibold text-slate-500 hidden md:block">
          {school?.name ? `${school.name} • ` : ''}
          {schoolYear?.label || ''}
        </div>
      </footer>

      {/* ========================================================================= */}
      {/* POPOVERS INTELLIGENTS (COULEURS CASE, TEXTE, LIGNE, TRI)                  */}
      {/* ========================================================================= */}
      <SmartFloatingPopover
        open={openMenu === 'bg'}
        anchorEl={bgBtnRef.current}
        onClose={() => setOpenMenu(null)}
        preferredSide="bottom"
        preferredAlign="start"
      >
        <div className="w-56 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5">
          <div className="text-[11px] font-black text-slate-700 mb-2">
            Couleur de fond de la case
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {BG_COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.label}
                type="button"
                onClick={() => {
                  updateActiveCellStyle({ bgColor: sw.value || undefined });
                  setOpenMenu(null);
                }}
                className="h-7 rounded-lg border border-slate-300 flex items-center justify-center text-[10px] font-bold hover:scale-105 transition cursor-pointer"
                style={{ backgroundColor: sw.value || '#ffffff' }}
                title={sw.label}
              >
                {!sw.value && '✕'}
              </button>
            ))}
          </div>
        </div>
      </SmartFloatingPopover>

      <SmartFloatingPopover
        open={openMenu === 'text'}
        anchorEl={textBtnRef.current}
        onClose={() => setOpenMenu(null)}
        preferredSide="bottom"
        preferredAlign="start"
      >
        <div className="w-52 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5">
          <div className="text-[11px] font-black text-slate-700 mb-2">
            Couleur du texte
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {TEXT_COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.label}
                type="button"
                onClick={() => {
                  updateActiveCellStyle({ color: sw.value || undefined });
                  setOpenMenu(null);
                }}
                className="px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-[10.5px] font-extrabold transition cursor-pointer"
                style={{ color: sw.value || '#0f172a' }}
              >
                {sw.label}
              </button>
            ))}
          </div>
        </div>
      </SmartFloatingPopover>

      <SmartFloatingPopover
        open={openMenu === 'row'}
        anchorEl={rowBtnRef.current}
        onClose={() => setOpenMenu(null)}
        preferredSide="bottom"
        preferredAlign="start"
      >
        <div className="w-56 bg-white rounded-xl shadow-2xl border border-slate-200 p-2.5">
          <div className="text-[11px] font-black text-slate-700 mb-2">
            Couleur de toute la ligne élève
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {BG_COLOR_SWATCHES.map((sw) => (
              <button
                key={sw.label}
                type="button"
                onClick={() => {
                  applyRowColor(sw.value);
                  setOpenMenu(null);
                }}
                className="h-7 rounded-lg border border-slate-300 flex items-center justify-center text-[10px] font-bold hover:scale-105 transition cursor-pointer"
                style={{ backgroundColor: sw.value || '#ffffff' }}
                title={sw.label}
              >
                {!sw.value && '✕'}
              </button>
            ))}
          </div>
        </div>
      </SmartFloatingPopover>

      <SmartFloatingPopover
        open={openMenu === 'sort'}
        anchorEl={sortBtnRef.current}
        onClose={() => setOpenMenu(null)}
        preferredSide="bottom"
        preferredAlign="start"
      >
        <div className="w-56 bg-white rounded-xl shadow-2xl border border-slate-200 p-1.5 flex flex-col gap-0.5">
          {(
            [
              {
                id: 'merit',
                label: 'Ordre de mérite (1er → dernier)',
                desc: 'Classement par moyenne décroissante',
              },
              {
                id: 'alpha',
                label: 'Ordre alphabétique (A → Z)',
                desc: 'Tri par nom et prénom',
              },
              {
                id: 'order',
                label: 'Ordre initial',
                desc: "Ordre d'apparition dans les matières",
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                pushUndoState();
                setSortMode(opt.id);
                setIsDirty(true);
                setOpenMenu(null);
              }}
              className={`w-full text-left px-2.5 py-2 rounded-lg transition cursor-pointer ${
                sortMode === opt.id
                  ? 'bg-blue-50 text-blue-800'
                  : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="text-xs font-extrabold flex items-center justify-between">
                <span>{opt.label}</span>
                {sortMode === opt.id && <Check className="w-3.5 h-3.5" />}
              </div>
              <div className="text-[10px] text-slate-500">{opt.desc}</div>
            </button>
          ))}
        </div>
      </SmartFloatingPopover>

      {/* POPOVER AJOUT / MODIFICATION RAPIDE DE COEFFICIENT */}
      <SmartFloatingPopover
        open={coeffPopover !== null}
        anchorEl={coeffPopover?.anchorEl ?? null}
        onClose={() => {
          if (!isSavingCoeff) setCoeffPopover(null);
        }}
        preferredSide="bottom"
        preferredAlign="center"
      >
        {coeffPopover?.mode === 'single' ? (
          <div className="w-64 bg-white dark:bg-[#111827] rounded-xl shadow-2xl border border-slate-300 dark:border-slate-600 p-3 space-y-2.5 select-none">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Coefficient
                </div>
                <div className="text-xs font-extrabold text-slate-900 dark:text-white truncate">
                  {coeffPopover.subjectName}
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingCoeff}
                onClick={() => setCoeffPopover(null)}
                className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div>
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={coeffPopover.draft}
                onChange={(e) => {
                  const val = e.target.value;
                  setCoeffPopover((prev) =>
                    prev && prev.mode === 'single'
                      ? { ...prev, draft: val, error: null }
                      : prev
                  );
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleApplySingleCoeff();
                  } else if (e.key === 'Escape' && !isSavingCoeff) {
                    setCoeffPopover(null);
                  }
                }}
                placeholder="Ex : 2 ou 1,5"
                className="w-full h-9 px-2.5 rounded-lg bg-white dark:bg-[#0f172a] border border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-sm font-bold text-slate-900 dark:text-white outline-none"
              />
              <div className="mt-1.5 flex items-center gap-1">
                {['1', '2', '3', '4', '5'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() =>
                      setCoeffPopover((prev) =>
                        prev && prev.mode === 'single'
                          ? { ...prev, draft: preset, error: null }
                          : prev
                      )
                    }
                    className={`flex-1 py-1 rounded-md border text-[11px] font-bold transition cursor-pointer ${
                      coeffPopover.draft.trim() === preset
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {coeffPopover.error && (
              <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 leading-snug">
                {coeffPopover.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={isSavingCoeff}
                onClick={() => setCoeffPopover(null)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSavingCoeff}
                onClick={handleApplySingleCoeff}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {isSavingCoeff ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>Appliquer</span>
              </button>
            </div>
          </div>
        ) : coeffPopover?.mode === 'bulk' ? (
          <div className="w-80 bg-white dark:bg-[#111827] rounded-xl shadow-2xl border border-slate-300 dark:border-slate-600 p-3 space-y-2.5 select-none">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-900 dark:text-white">
                  Coefficients manquants ({subjectsWithoutCoeff.length})
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enregistrés immédiatement sur votre compte
                </div>
              </div>
              <button
                type="button"
                disabled={isSavingCoeff}
                onClick={() => setCoeffPopover(null)}
                className="w-6 h-6 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-2 pr-0.5">
              {subjectsWithoutCoeff.map((subj, idx) => (
                <div
                  key={subj.id}
                  className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700"
                >
                  <span
                    className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate flex-1"
                    title={subj.name}
                  >
                    {subj.name}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus={idx === 0}
                    value={coeffPopover.drafts[subj.id] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCoeffPopover((prev) =>
                        prev && prev.mode === 'bulk'
                          ? {
                              ...prev,
                              drafts: { ...prev.drafts, [subj.id]: val },
                              error: null,
                            }
                          : prev
                      );
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleApplyBulkCoeffs();
                      }
                    }}
                    placeholder="Coeff"
                    className="w-20 h-8 px-2 text-center rounded-md bg-white dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 focus:border-blue-500 text-xs font-bold text-slate-900 dark:text-white outline-none shrink-0"
                  />
                </div>
              ))}
            </div>

            {coeffPopover.error && (
              <div className="text-[11px] font-semibold text-red-600 dark:text-red-400 leading-snug">
                {coeffPopover.error}
              </div>
            )}

            <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                disabled={isSavingCoeff}
                onClick={() => setCoeffPopover(null)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-xs font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isSavingCoeff}
                onClick={handleApplyBulkCoeffs}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              >
                {isSavingCoeff ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                )}
                <span>Appliquer</span>
              </button>
            </div>
          </div>
        ) : null}
      </SmartFloatingPopover>

      {/* ========================================================================= */}
      {/* MODALE PORTAL : FICHE RÉCAPITULATIVE DÉTAILLÉE DE L'ÉLÈVE                 */}
      {/* ========================================================================= */}
      {previewStudent &&
        createPortal(
          <div
            className="teacher-dark-scope fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none"
            onClick={() => setPreviewStudent(null)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-300 bg-white flex items-center justify-center shrink-0">
                    {previewStudent.photoUrl ? (
                      <img
                        src={previewStudent.photoUrl}
                        alt={previewStudent.name || 'Élève'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900 truncate">
                      {previewStudent.name || 'Élève sans nom'}
                    </h4>
                    <div className="text-[11px] font-semibold text-slate-500 truncate">
                      {previewStudent.matricule ? `Mat. ${previewStudent.matricule} • ` : ''}
                      {classDisplayName} • {periodBadgeLabel}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewStudent(null)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                {/* Synthèse Rang / Total / Moyenne / Mention */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-center">
                    <div className="text-[10px] font-bold text-amber-700 uppercase">
                      Rang
                    </div>
                    <div className="text-base font-black text-amber-900">
                      {previewStudent.rankLabel}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-center">
                    <div className="text-[10px] font-bold text-indigo-700 uppercase">
                      Total Général
                    </div>
                    <div className="text-base font-black text-indigo-950">
                      {formatFrenchNumber(previewStudent.totalGeneral)}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
                    <div className="text-[10px] font-bold text-emerald-700 uppercase">
                      Moy. Générale
                    </div>
                    <div className="text-base font-black text-emerald-900">
                      {formatFrenchNumber(previewStudent.generalAverage)}
                    </div>
                  </div>
                </div>

                {/* Détail par matière */}
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600 text-[10px] uppercase">
                      <tr>
                        <th className="py-1.5 px-2.5 text-left font-black">
                          Matière
                        </th>
                        <th className="py-1.5 px-2 text-center font-black">
                          Coeff
                        </th>
                        <th className="py-1.5 px-2 text-center font-black">
                          Moy. /{effectiveScaleLabel}
                        </th>
                        <th className="py-1.5 px-2 text-center font-black">
                          Moy. × Coeff
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {computed.subjects.map((subj) => {
                        const cell = previewStudent.cellsBySubject[subj.id];
                        return (
                          <tr key={subj.id}>
                            <td className="py-1.5 px-2.5 font-bold text-slate-800">
                              {subj.name}
                            </td>
                            <td className="py-1.5 px-2 text-center text-slate-600 font-semibold">
                              {formatCoeffDisplay(subj.effectiveCoeff)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-bold text-slate-900">
                              {formatFrenchNumber(cell?.effectiveAverage)}
                            </td>
                            <td className="py-1.5 px-2 text-center font-extrabold text-indigo-900 bg-slate-50">
                              {formatFrenchNumber(cell?.weightedValue)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-bold text-slate-500">
                    Mention obtenue :
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full border text-xs font-black ${getMentionBadgeStyle(
                      previewStudent.generalAverage,
                      effectiveMentionRules,
                      effectiveAverageScale
                    )}`}
                  >
                    {previewStudent.mention}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ========================================================================= */}
      {/* MODALE PORTAL : VÉRIFICATION DES NOMS PROCHES, FUSIONS & SÉPARATIONS      */}
      {/* ========================================================================= */}
      {isDuplicatesModalOpen &&
        createPortal(
          <div
            className="teacher-dark-scope fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none"
            onClick={() => setIsDuplicatesModalOpen(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center border shrink-0 ${
                      computed.potentialDuplicates.length > 0
                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                        : 'bg-blue-50 border-blue-200 text-blue-700'
                    }`}
                  >
                    {computed.potentialDuplicates.length > 0 ? (
                      <AlertTriangle className="w-5 h-5" />
                    ) : (
                      <Link2 className="w-5 h-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-900">
                      Rapprochement des élèves entre matières
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Aucune fusion douteuse n'est faite sans votre accord. Vos choix sont enregistrés sur votre compte.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDuplicatesModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-white hover:bg-slate-200 border border-slate-200 flex items-center justify-center text-slate-600 cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 overflow-y-auto space-y-5">
                {/* 1. Doublons potentiels détectés */}
                <div>
                  <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                    Noms proches détectés ({computed.potentialDuplicates.length})
                  </div>

                  {computed.potentialDuplicates.length === 0 ? (
                    <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>
                        Aucun doublon suspect détecté entre les matières de ce trimestre.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {computed.potentialDuplicates.map((cand) => (
                        <div
                          key={cand.id}
                          className="p-3 rounded-xl bg-amber-50/50 border border-amber-200 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10.5px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                              {cand.reasonLabel}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[cand.studentA, cand.studentB].map((st) => (
                              <div
                                key={st.key}
                                className="p-2 rounded-lg bg-white border border-slate-200 flex items-center gap-2 min-w-0"
                              >
                                <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center shrink-0">
                                  {st.photoUrl ? (
                                    <img
                                      src={st.photoUrl}
                                      alt={st.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <User className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-black text-slate-900 truncate">
                                    {st.name}
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate">
                                    {st.subjectNames.join(', ') || 'Tableau moyenne'}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                handleMarkDistinctStudents(
                                  cand.studentA.key,
                                  cand.studentB.key
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-[11px] font-bold text-slate-700 transition cursor-pointer"
                            >
                              ✕ Ce sont 2 élèves différents
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleMergeStudents(
                                  cand.studentA.key,
                                  cand.studentB.key
                                )
                              }
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-extrabold shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                              <span>✓ C'est le même élève (Fusionner)</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Fusions actives (réversibles en 1 clic) */}
                {(overrides.mergedLinks?.length || 0) > 0 && (
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">
                      Fusions confirmées ({overrides.mergedLinks?.length})
                    </div>
                    <div className="space-y-1.5">
                      {(overrides.mergedLinks || []).map((link) => {
                        const primaryStudent = computed.students.find(
                          (s) => s.key === link.primaryKey
                        );
                        return link.mergedKeys.map((mk) => (
                          <div
                            key={`${link.primaryKey}-${mk}`}
                            className="px-3 py-2 rounded-xl bg-blue-50/60 border border-blue-200 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-black text-slate-900">
                                {primaryStudent?.name || link.primaryKey}
                              </span>
                              <span className="text-slate-500 text-[11px] ml-1.5">
                                (réuni avec {mk.replace(/^(name:|uid:)/, '')})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                handleUnmergeStudent(link.primaryKey, mk)
                              }
                              className="px-2.5 py-1 rounded-lg bg-white hover:bg-red-50 border border-slate-300 hover:border-red-300 text-[11px] font-bold text-slate-700 hover:text-red-700 transition cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <Unlink className="w-3 h-3" />
                              <span>Séparer</span>
                            </button>
                          </div>
                        ));
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Fusion manuelle sécurisée (uniquement entre élèves sans matière commune) */}
                {computed.students.length >= 2 && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                    <div className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                      Associer manuellement 2 lignes (même élève)
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Utile si un élève a été saisi sous un surnom ou un nom très différent dans une autre matière. Seuls les élèves sans matière commune peuvent être réunis.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={manualMergePrimaryKey}
                        onChange={(e) => {
                          setManualMergePrimaryKey(e.target.value);
                          setManualMergeSecondaryKey('');
                        }}
                        className="h-9 px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none"
                      >
                        <option value="">1. Choisir l'élève à conserver…</option>
                        {computed.students.map((st) => (
                          <option key={st.key} value={st.key}>
                            {st.name || 'Élève sans nom'}
                          </option>
                        ))}
                      </select>

                      <select
                        value={manualMergeSecondaryKey}
                        onChange={(e) => setManualMergeSecondaryKey(e.target.value)}
                        disabled={!manualMergePrimaryKey}
                        className="h-9 px-2.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 outline-none disabled:opacity-50"
                      >
                        <option value="">2. Choisir la ligne à réunir…</option>
                        {(() => {
                          const primary = computed.students.find(
                            (s) => s.key === manualMergePrimaryKey
                          );
                          const primarySubjs = new Set(
                            primary?.presentSubjectIds || []
                          );
                          return computed.students
                            .filter((st) => {
                              if (st.key === manualMergePrimaryKey) return false;
                              // Interdire de fusionner 2 élèves qui coexistent dans une même matière
                              return !st.presentSubjectIds.some((sid) =>
                                primarySubjs.has(sid)
                              );
                            })
                            .map((st) => (
                              <option key={st.key} value={st.key}>
                                {st.name || 'Élève sans nom'}
                              </option>
                            ));
                        })()}
                      </select>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={
                          !manualMergePrimaryKey || !manualMergeSecondaryKey
                        }
                        onClick={() =>
                          handleMergeStudents(
                            manualMergePrimaryKey,
                            manualMergeSecondaryKey
                          )
                        }
                        className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>Réunir ces 2 lignes</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>,
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
