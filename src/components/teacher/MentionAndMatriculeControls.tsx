import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Check,
  ChevronDown,
  Columns3,
  EyeOff,
  GripVertical,
  Hash,
  Loader2,
  Lock,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import {
  DEFAULT_AVERAGE_SCALE,
  DEFAULT_CUSTOM_MENTION_RULES,
  formatScaleValue,
  getDefaultMentionRulesForScale,
  sanitizeAverageScale,
  sanitizeCustomMentionRules,
  scaleMentionRulesToTarget,
  type CustomMentionRule,
} from '../../utils/gradebookCalculations';
import {
  COLUMN_LAYOUT_PRESETS,
  detectMatchingPresetId,
  getDefaultColumnOrder,
  getPresetColumnOrder,
  GRADEBOOK_COLUMN_META,
  isDefaultColumnOrder,
  moveColumnToSide,
  moveColumnWithinSide,
  sanitizeGradebookColumnOrder,
  type GradebookColumnOrder,
  type GradebookPeripheralColumnKey,
} from '../../utils/gradebookColumnLayout';

export type SheetSettingScope = 'sheet' | 'class';

export interface NoteColumnOption {
  index: number;
  label: string;
  maxScore: number;
}

export interface BulkNoteMaxUpdateInput {
  mode: 'all' | 'specific';
  colIndex?: number;
  maxScore: number;
  convertExistingScores: boolean;
}

export interface MentionAndMatriculeControlsProps {
  /** Règles de mentions actuellement effectives sur ce tableau */
  effectiveMentionRules: readonly CustomMentionRule[];
  /** True si des règles personnalisées (tableau ou classe) sont actives */
  hasCustomMentionRules: boolean;
  /** True si la colonne MATRICULE est actuellement affichée sur ce tableau */
  showMatricule: boolean;
  /** Barème maximal effectif de la moyenne (défaut : 20, ex: 20, 40, 100...) */
  averageScale?: number;
  /** Colonnes de notes disponibles (uniquement dans le tableau par matière, pour changer le max en 1 clic) */
  noteColumns?: NoteColumnOption[];
  /** Nombre d'élèves (pour l'aperçu dans le menu Barème des notes) */
  studentsCount?: number;
  /** Libellé lisible de la classe (ex: "BTS 2 • GROUPE 2") */
  classLabel: string;
  /** Conteneur limite pour SmartFloatingPopover */
  boundaryEl?: HTMLElement | null;
  /** Appelé à l'ouverture d'un des popovers (pour fermer d'autres menus du ruban) */
  onWillOpen?: () => void;
  /** Signal externe pour fermer les popovers si l'utilisateur clique sur la grille */
  closeSignal?: number;
  /** Enregistrement des règles de mention (null = réinitialiser par défaut) */
  onSaveMentionRules: (
    rules: CustomMentionRule[] | null,
    scope: SheetSettingScope
  ) => Promise<void> | void;
  /** Enregistrement de la visibilité de la colonne Matricule */
  onSaveShowMatricule: (
    show: boolean,
    scope: SheetSettingScope
  ) => Promise<void> | void;
  /** Enregistrement de la moyenne maximale (ce tableau ou toute la classe) */
  onSaveAverageScale?: (
    scale: number,
    scope: SheetSettingScope
  ) => Promise<void> | void;
  /** Modification en lot du barème max des notes (toutes les notes ou une colonne spécifique) */
  onBulkUpdateNoteMax?: (
    input: BulkNoteMaxUpdateInput
  ) => Promise<void> | void;
  /** Disposition effective des colonnes périphériques (gauche/droite des notes/matières/trimestres) */
  effectiveColumnOrder?: GradebookColumnOrder;
  /** True si une disposition personnalisée (non défaut) est active */
  hasCustomColumnOrder?: boolean;
  /** True sur les tableaux Moyenne Générale (inclut la colonne Total Général / Annuel) */
  includeTotalColumn?: boolean;
  /** Libellé du bloc central verrouillé (ex: "NOTES 1…N", "MATIÈRES", "TRIMESTRES") */
  centerBlockLabel?: string;
  /** Enregistrement de la disposition des colonnes (null = réinitialiser par défaut) */
  onSaveColumnOrder?: (
    order: GradebookColumnOrder | null,
    scope: SheetSettingScope
  ) => Promise<void> | void;
}

interface DraftRuleRow {
  uid: string;
  minStr: string;
  label: string;
}

const AVG_SCALE_PRESETS = [10, 20, 30, 40, 50, 100] as const;
const NOTE_MAX_PRESETS = [5, 10, 20, 30, 40, 50, 100] as const;

const makeRowUid = () => `mr-${Math.random().toString(36).slice(2, 9)}`;

const formatFrenchMin = (val: number): string => {
  if (!Number.isFinite(val)) return '0';
  if (Math.abs(val - Math.round(val)) < 1e-6) return String(Math.round(val));
  return val.toFixed(2).replace(/0$/, '').replace('.', ',');
};

export const MentionAndMatriculeControls: React.FC<MentionAndMatriculeControlsProps> = ({
  effectiveMentionRules,
  hasCustomMentionRules,
  showMatricule,
  averageScale = DEFAULT_AVERAGE_SCALE,
  noteColumns,
  studentsCount,
  classLabel,
  boundaryEl,
  onWillOpen,
  closeSignal = 0,
  onSaveMentionRules,
  onSaveShowMatricule,
  onSaveAverageScale,
  onBulkUpdateNoteMax,
  effectiveColumnOrder,
  hasCustomColumnOrder = false,
  includeTotalColumn = false,
  centerBlockLabel,
  onSaveColumnOrder,
}) => {
  const activeScale = sanitizeAverageScale(averageScale) ?? DEFAULT_AVERAGE_SCALE;
  const activeScaleLabel = formatScaleValue(activeScale);
  const hasCustomAverageScale = Math.abs(activeScale - DEFAULT_AVERAGE_SCALE) > 1e-6;
  const supportsNoteMaxBulk = Boolean(
    noteColumns && noteColumns.length > 0 && onBulkUpdateNoteMax
  );
  const resolvedCenterLabel =
    centerBlockLabel || (includeTotalColumn ? 'MATIÈRES' : 'NOTES 1…N');
  const resolvedCenterNoun =
    resolvedCenterLabel.toLowerCase().includes('trimestre')
      ? 'les trimestres'
      : resolvedCenterLabel.toLowerCase().includes('matière')
      ? 'les matières'
      : 'les notes';

  const [openMenu, setOpenMenu] = useState<
    'mentions' | 'matricule' | 'scale' | 'layout' | null
  >(null);
  const mentionBtnRef = useRef<HTMLButtonElement>(null);
  const matriculeBtnRef = useRef<HTMLButtonElement>(null);
  const scaleBtnRef = useRef<HTMLButtonElement>(null);
  const layoutBtnRef = useRef<HTMLButtonElement>(null);

  // État local du menu Disposition des colonnes
  const [draftColumnOrder, setDraftColumnOrder] = useState<GradebookColumnOrder>(() =>
    sanitizeGradebookColumnOrder(effectiveColumnOrder, {
      includeTotal: includeTotalColumn,
    }) || getDefaultColumnOrder({ includeTotal: includeTotalColumn })
  );
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [savingLayoutScope, setSavingLayoutScope] = useState<SheetSettingScope | null>(null);
  const [draggedColKey, setDraggedColKey] = useState<GradebookPeripheralColumnKey | null>(null);
  const [dragOverZone, setDragOverZone] = useState<'left' | 'right' | null>(null);

  // État local du menu Mentions
  const [draftRows, setDraftRows] = useState<DraftRuleRow[]>([]);
  const [mentionScope, setMentionScope] = useState<SheetSettingScope>('class');
  const [mentionError, setMentionError] = useState<string | null>(null);
  const [isSavingMention, setIsSavingMention] = useState(false);

  // État local du menu Matricule
  const [draftShowMatricule, setDraftShowMatricule] = useState<boolean>(showMatricule);
  const [matriculeScope, setMatriculeScope] = useState<SheetSettingScope>('class');
  const [matriculeError, setMatriculeError] = useState<string | null>(null);
  const [isSavingMatricule, setIsSavingMatricule] = useState(false);

  // État local du menu Barème (Onglet 1 : Moyenne max | Onglet 2 : Max des notes)
  const [scaleTab, setScaleTab] = useState<'average' | 'notes'>('average');
  const [draftAvgScaleStr, setDraftAvgScaleStr] = useState<string>(activeScaleLabel);
  const [avgScaleScope, setAvgScaleScope] = useState<SheetSettingScope>('class');
  const [avgScaleError, setAvgScaleError] = useState<string | null>(null);
  const [isSavingAvgScale, setIsSavingAvgScale] = useState(false);

  const [noteMaxMode, setNoteMaxMode] = useState<'all' | 'specific'>('all');
  const [selectedNoteColIndex, setSelectedNoteColIndex] = useState<number>(0);
  const [draftNoteMaxStr, setDraftNoteMaxStr] = useState<string>('20');
  const [convertExistingScores, setConvertExistingScores] = useState<boolean>(false);
  const [noteMaxError, setNoteMaxError] = useState<string | null>(null);
  const [isSavingNoteMax, setIsSavingNoteMax] = useState(false);

  // Feedback visuel discret après enregistrement
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  useEffect(() => {
    if (closeSignal > 0) {
      setOpenMenu(null);
    }
  }, [closeSignal]);

  const showTempFeedback = (msg: string) => {
    setFeedbackToast(msg);
    window.setTimeout(() => {
      setFeedbackToast((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  const openMentionsPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const next = openMenu === 'mentions' ? null : 'mentions';
    onWillOpen?.();
    if (next === 'mentions') {
      const base =
        effectiveMentionRules.length > 0
          ? scaleMentionRulesToTarget(effectiveMentionRules, activeScale)
          : getDefaultMentionRulesForScale(activeScale);
      setDraftRows(
        [...base]
          .sort((a, b) => b.min - a.min)
          .map((r) => ({
            uid: makeRowUid(),
            minStr: formatFrenchMin(r.min),
            label: r.label,
          }))
      );
      setMentionError(null);
      setOpenMenu('mentions');
    } else {
      setOpenMenu(null);
    }
  };

  const openMatriculePopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const next = openMenu === 'matricule' ? null : 'matricule';
    onWillOpen?.();
    if (next === 'matricule') {
      setDraftShowMatricule(showMatricule);
      setMatriculeError(null);
      setOpenMenu('matricule');
    } else {
      setOpenMenu(null);
    }
  };

  const openScalePopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const next = openMenu === 'scale' ? null : 'scale';
    onWillOpen?.();
    if (next === 'scale') {
      setScaleTab('average');
      setDraftAvgScaleStr(formatScaleValue(activeScale));
      setAvgScaleError(null);

      const firstCol = noteColumns?.[0];
      setNoteMaxMode('all');
      setSelectedNoteColIndex(firstCol ? firstCol.index : 0);
      setDraftNoteMaxStr(formatScaleValue(firstCol?.maxScore ?? activeScale));
      setConvertExistingScores(false);
      setNoteMaxError(null);

      setOpenMenu('scale');
    } else {
      setOpenMenu(null);
    }
  };

  const openLayoutPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const next = openMenu === 'layout' ? null : 'layout';
    onWillOpen?.();
    if (next === 'layout') {
      setDraftColumnOrder(
        sanitizeGradebookColumnOrder(effectiveColumnOrder, {
          includeTotal: includeTotalColumn,
        }) || getDefaultColumnOrder({ includeTotal: includeTotalColumn })
      );
      setLayoutError(null);
      setDraggedColKey(null);
      setDragOverZone(null);
      setOpenMenu('layout');
    } else {
      setOpenMenu(null);
    }
  };

  const activeDraftPresetId = useMemo(
    () =>
      detectMatchingPresetId(draftColumnOrder, {
        includeTotal: includeTotalColumn,
      }),
    [draftColumnOrder, includeTotalColumn]
  );

  const isDraftDefaultLayout = useMemo(
    () =>
      isDefaultColumnOrder(draftColumnOrder, {
        includeTotal: includeTotalColumn,
      }),
    [draftColumnOrder, includeTotalColumn]
  );

  const handleApplyColumnOrder = async (scope: SheetSettingScope) => {
    if (!onSaveColumnOrder) return;
    setLayoutError(null);
    setSavingLayoutScope(scope);
    try {
      const sanitized =
        sanitizeGradebookColumnOrder(draftColumnOrder, {
          includeTotal: includeTotalColumn,
        }) || getDefaultColumnOrder({ includeTotal: includeTotalColumn });
      const payloadToSave = isDefaultColumnOrder(sanitized, {
        includeTotal: includeTotalColumn,
      })
        ? null
        : sanitized;
      await onSaveColumnOrder(payloadToSave, scope);
      setOpenMenu(null);
      showTempFeedback(
        payloadToSave === null
          ? scope === 'class'
            ? 'Disposition par défaut rétablie pour toute la classe'
            : 'Disposition par défaut rétablie sur ce tableau'
          : scope === 'class'
          ? 'Disposition appliquée à toute la classe'
          : 'Disposition appliquée à ce tableau'
      );
    } catch (err: any) {
      setLayoutError(
        err?.message || "Erreur lors de l'enregistrement de la disposition des colonnes."
      );
    } finally {
      setSavingLayoutScope(null);
    }
  };

  const handleDropOnZone = (
    targetSide: 'left' | 'right',
    targetKey?: GradebookPeripheralColumnKey
  ) => {
    if (!draggedColKey) return;
    setDraftColumnOrder((prev) => {
      const base =
        sanitizeGradebookColumnOrder(prev, {
          includeTotal: includeTotalColumn,
        }) || getDefaultColumnOrder({ includeTotal: includeTotalColumn });
      if (targetKey && targetKey === draggedColKey) return base;
      const left = base.left.filter((k) => k !== draggedColKey);
      const right = base.right.filter((k) => k !== draggedColKey);
      const list = targetSide === 'left' ? left : right;
      if (targetKey) {
        const idx = list.indexOf(targetKey);
        if (idx >= 0) {
          list.splice(idx, 0, draggedColKey);
        } else {
          list.push(draggedColKey);
        }
      } else {
        list.push(draggedColKey);
      }
      return { left, right };
    });
    setDraggedColKey(null);
    setDragOverZone(null);
  };

  // Aperçu temps réel des plages calculées pour chaque ligne (ex: "16 – 20", "32 – 40")
  const computedRangeHints = useMemo(() => {
    const parsed = draftRows.map((row) => {
      const n = Number(row.minStr.trim().replace(',', '.'));
      return {
        uid: row.uid,
        min:
          row.minStr.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= activeScale
            ? n
            : null,
      };
    });
    const validSorted = parsed
      .filter((p): p is { uid: string; min: number } => p.min !== null)
      .sort((a, b) => b.min - a.min);

    const map = new Map<string, string>();
    validSorted.forEach((item, idx) => {
      if (idx === 0) {
        map.set(item.uid, `${formatFrenchMin(item.min)} – ${activeScaleLabel}`);
      } else {
        const upper = Math.max(
          item.min,
          Math.round((validSorted[idx - 1].min - 0.01) * 100) / 100
        );
        map.set(item.uid, `${formatFrenchMin(item.min)} – ${formatFrenchMin(upper)}`);
      }
    });
    return map;
  }, [draftRows, activeScale, activeScaleLabel]);

  const parsedDraftAvgScale = useMemo(
    () => sanitizeAverageScale(draftAvgScaleStr),
    [draftAvgScaleStr]
  );

  const parsedDraftNoteMax = useMemo(
    () => sanitizeAverageScale(draftNoteMaxStr),
    [draftNoteMaxStr]
  );

  const handleAddRuleRow = () => {
    if (draftRows.length >= 12) return;
    setDraftRows((prev) => [
      ...prev,
      { uid: makeRowUid(), minStr: '', label: '' },
    ]);
    setMentionError(null);
  };

  const handleResetDefaultRules = () => {
    const defaults = getDefaultMentionRulesForScale(activeScale);
    setDraftRows(
      defaults.map((r) => ({
        uid: makeRowUid(),
        minStr: formatFrenchMin(r.min),
        label: r.label,
      }))
    );
    setMentionError(null);
  };

  const handleApplyMentions = async () => {
    setMentionError(null);
    const candidateRules: CustomMentionRule[] = [];
    const seenMins = new Set<number>();

    for (let i = 0; i < draftRows.length; i++) {
      const row = draftRows[i];
      const rawMin = row.minStr.trim().replace(',', '.');
      const label = row.label.trim();
      if (!rawMin && !label) continue;
      const num = Number(rawMin);
      if (rawMin === '' || !Number.isFinite(num) || num < 0 || num > activeScale) {
        setMentionError(
          `Ligne ${i + 1} : indiquez une note minimale entre 0 et ${activeScaleLabel}.`
        );
        return;
      }
      if (!label) {
        setMentionError(
          `Ligne ${i + 1} : saisissez le nom de la mention (ex: Bien, Excellent…).`
        );
        return;
      }
      const rounded = Math.round(num * 100) / 100;
      if (seenMins.has(rounded)) {
        setMentionError(
          `Le seuil ${formatFrenchMin(rounded)}/${activeScaleLabel} est défini en double.`
        );
        return;
      }
      seenMins.add(rounded);
      candidateRules.push({
        min: rounded,
        label: label.slice(0, 48),
        scale: activeScale,
      });
    }

    const sanitized = sanitizeCustomMentionRules(candidateRules, activeScale);
    if (!sanitized || sanitized.length === 0) {
      setMentionError('Ajoutez au moins un intervalle de mention valide.');
      return;
    }

    setIsSavingMention(true);
    try {
      await onSaveMentionRules(sanitized, mentionScope);
      setOpenMenu(null);
      showTempFeedback(
        mentionScope === 'class'
          ? 'Mentions appliquées à toute la classe'
          : 'Mentions appliquées à ce tableau'
      );
    } catch (err: any) {
      setMentionError(err?.message || "Erreur lors de l'enregistrement des mentions.");
    } finally {
      setIsSavingMention(false);
    }
  };

  const handleApplyMatricule = async () => {
    setMatriculeError(null);
    setIsSavingMatricule(true);
    try {
      await onSaveShowMatricule(draftShowMatricule, matriculeScope);
      setOpenMenu(null);
      showTempFeedback(
        draftShowMatricule
          ? matriculeScope === 'class'
            ? 'Colonne Matricule activée pour toute la classe'
            : 'Colonne Matricule activée sur ce tableau'
          : matriculeScope === 'class'
          ? 'Colonne Matricule masquée sur toute la classe'
          : 'Colonne Matricule masquée sur ce tableau'
      );
    } catch (err: any) {
      setMatriculeError(err?.message || "Erreur lors de l'enregistrement du réglage Matricule.");
    } finally {
      setIsSavingMatricule(false);
    }
  };

  const handleApplyAverageScale = async () => {
    if (!onSaveAverageScale) return;
    setAvgScaleError(null);
    const parsed = sanitizeAverageScale(draftAvgScaleStr);
    if (parsed === null) {
      setAvgScaleError('Saisissez une moyenne maximale valide comprise entre 1 et 1000 (ex: 20, 40, 100).');
      return;
    }

    setIsSavingAvgScale(true);
    try {
      await onSaveAverageScale(parsed, avgScaleScope);
      setOpenMenu(null);
      const lbl = formatScaleValue(parsed);
      showTempFeedback(
        avgScaleScope === 'class'
          ? `Moyenne ramenée sur /${lbl} pour toute la classe`
          : `Moyenne ramenée sur /${lbl} pour ce tableau`
      );
    } catch (err: any) {
      setAvgScaleError(
        err?.message || "Erreur lors de l'enregistrement de la moyenne maximale."
      );
    } finally {
      setIsSavingAvgScale(false);
    }
  };

  const handleApplyBulkNoteMax = async () => {
    if (!onBulkUpdateNoteMax) return;
    setNoteMaxError(null);
    const parsed = sanitizeAverageScale(draftNoteMaxStr);
    if (parsed === null) {
      setNoteMaxError('Saisissez un barème max valide compris entre 1 et 1000 (ex: 10, 20, 40).');
      return;
    }

    const targetCol =
      noteMaxMode === 'specific'
        ? noteColumns?.find((c) => c.index === selectedNoteColIndex) || noteColumns?.[0]
        : undefined;

    if (noteMaxMode === 'specific' && !targetCol) {
      setNoteMaxError('Sélectionnez une colonne de note.');
      return;
    }

    setIsSavingNoteMax(true);
    try {
      await onBulkUpdateNoteMax({
        mode: noteMaxMode,
        colIndex: targetCol?.index,
        maxScore: parsed,
        convertExistingScores,
      });
      setOpenMenu(null);
      const lbl = formatScaleValue(parsed);
      showTempFeedback(
        noteMaxMode === 'all'
          ? `Toutes les notes passées sur /${lbl}`
          : `${targetCol?.label || 'Note'} passée sur /${lbl}`
      );
    } catch (err: any) {
      setNoteMaxError(
        err?.message || "Erreur lors de l'application du barème aux notes."
      );
    } finally {
      setIsSavingNoteMax(false);
    }
  };

  const selectedColObj = noteColumns?.find((c) => c.index === selectedNoteColIndex) || noteColumns?.[0];

  return (
    <div className="flex flex-col items-center justify-between pl-2.5 border-l border-slate-300 dark:border-slate-700 shrink-0 relative">
      <div className="flex items-center gap-1.5 pt-1 relative">
        {/* 1. BOUTON MENTIONS PERSONNALISÉES */}
        <button
          ref={mentionBtnRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openMentionsPopover}
          className={`gb-menu-trigger h-7 px-2.5 rounded-md border flex items-center gap-1.5 text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95 outline-none focus:outline-none whitespace-nowrap ${
            openMenu === 'mentions'
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500'
              : hasCustomMentionRules
              ? 'bg-indigo-50 text-indigo-800 border-indigo-300 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-700'
              : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
          }`}
          title="Définir vos propres intervalles et libellés de mentions (ce tableau ou toute la classe)"
        >
          <Award
            className={`w-3.5 h-3.5 shrink-0 ${
              openMenu === 'mentions'
                ? 'text-amber-300'
                : hasCustomMentionRules
                ? 'text-indigo-600 dark:text-indigo-300'
                : 'text-amber-600'
            }`}
          />
          <span>Mentions</span>
          {hasCustomMentionRules && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-sky-400 shrink-0" />
          )}
          <ChevronDown
            className={`w-3 h-3 shrink-0 ${
              openMenu === 'mentions' ? 'text-white' : 'text-slate-400'
            }`}
          />
        </button>

        {/* 2. BOUTON COLONNE MATRICULE (DERRIÈRE MENTIONS) */}
        <button
          ref={matriculeBtnRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={openMatriculePopover}
          className={`gb-menu-trigger h-7 px-2.5 rounded-md border flex items-center gap-1.5 text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95 outline-none focus:outline-none whitespace-nowrap ${
            openMenu === 'matricule'
              ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500'
              : showMatricule
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-200 dark:border-emerald-700'
              : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
          }`}
          title="Afficher ou masquer la colonne Matricule juste derrière Profil (ce tableau ou toute la classe)"
        >
          <Hash
            className={`w-3.5 h-3.5 shrink-0 ${
              openMenu === 'matricule'
                ? 'text-emerald-300'
                : showMatricule
                ? 'text-emerald-600 dark:text-emerald-300'
                : 'text-slate-500'
            }`}
          />
          <span>Matricule</span>
          {showMatricule && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
          )}
          <ChevronDown
            className={`w-3 h-3 shrink-0 ${
              openMenu === 'matricule' ? 'text-white' : 'text-slate-400'
            }`}
          />
        </button>

        {/* 3. BOUTON BARÈME / MOYENNE MAX & MAX DES NOTES (DERRIÈRE MATRICULE) */}
        {onSaveAverageScale && (
          <button
            ref={scaleBtnRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openScalePopover}
            className={`gb-menu-trigger h-7 px-2.5 rounded-md border flex items-center gap-1.5 text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95 outline-none focus:outline-none whitespace-nowrap ${
              openMenu === 'scale'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500'
                : hasCustomAverageScale
                ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-700'
                : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
            }`}
            title={
              supportsNoteMaxBulk
                ? `Définir la moyenne maximale (actuellement /${activeScaleLabel}) et modifier le barème max des notes en 1 clic`
                : `Définir sur combien est calculée la moyenne maximale (actuellement /${activeScaleLabel})`
            }
          >
            <SlidersHorizontal
              className={`w-3.5 h-3.5 shrink-0 ${
                openMenu === 'scale'
                  ? 'text-sky-300'
                  : hasCustomAverageScale
                  ? 'text-blue-600 dark:text-sky-300'
                  : 'text-blue-600'
              }`}
            />
            <span>Sur /{activeScaleLabel}</span>
            {hasCustomAverageScale && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-sky-400 shrink-0" />
            )}
            <ChevronDown
              className={`w-3 h-3 shrink-0 ${
                openMenu === 'scale' ? 'text-white' : 'text-slate-400'
              }`}
            />
          </button>
        )}

        {/* 4. BOUTON DISPOSITION DES COLONNES (À DROITE DE SUR /20) */}
        {onSaveColumnOrder && (
          <button
            ref={layoutBtnRef}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={openLayoutPopover}
            className={`gb-menu-trigger h-7 px-2.5 rounded-md border flex items-center gap-1.5 text-[11px] font-bold transition cursor-pointer shadow-2xs active:scale-95 outline-none focus:outline-none whitespace-nowrap ${
              openMenu === 'layout'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500'
                : hasCustomColumnOrder
                ? 'bg-sky-50 text-sky-800 border-sky-300 hover:bg-sky-100 dark:bg-sky-950/60 dark:text-sky-200 dark:border-sky-700'
                : 'bg-white text-slate-800 border-slate-300 hover:border-blue-500 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600'
            }`}
            title="Réorganiser l'emplacement du Rang, Profil, Matricule, Nom & Prénom, Moyenne et Mention (devant ou derrière les notes)"
          >
            <Columns3
              className={`w-3.5 h-3.5 shrink-0 ${
                openMenu === 'layout'
                  ? 'text-sky-300'
                  : hasCustomColumnOrder
                  ? 'text-sky-600 dark:text-sky-300'
                  : 'text-violet-600 dark:text-violet-400'
              }`}
            />
            <span>Disposition</span>
            {hasCustomColumnOrder && (
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-sky-400 shrink-0" />
            )}
            <ChevronDown
              className={`w-3 h-3 shrink-0 ${
                openMenu === 'layout' ? 'text-white' : 'text-slate-400'
              }`}
            />
          </button>
        )}

        {feedbackToast && openMenu === null && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-md shadow-lg whitespace-nowrap z-[100] pointer-events-none">
            {feedbackToast}
          </div>
        )}
      </div>
      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-none mb-0.5">
        {onSaveAverageScale && onSaveColumnOrder
          ? 'Mentions · Matricule · Barème · Disposition'
          : onSaveAverageScale
          ? 'Mentions · Matricule · Barème'
          : onSaveColumnOrder
          ? 'Mentions · Matricule · Disposition'
          : 'Mentions & Matricule'}
      </span>

      {/* ===================================================================== */}
      {/* POPOVER 1 : INTERVALLES DE MENTIONS (SPACIEUX & AÉRÉ)                 */}
      {/* ===================================================================== */}
      <SmartFloatingPopover
        open={openMenu === 'mentions'}
        anchorEl={mentionBtnRef.current}
        boundaryEl={boundaryEl}
        preferredSide="bottom"
        preferredAlign="start"
        gap={8}
        onClose={() => setOpenMenu(null)}
        ignoreOutsideSelector=".gb-menu-trigger"
        dataPopoverId="gb-mention-rules-menu"
        className="w-[460px] max-w-[calc(100vw-24px)] rounded-2xl"
      >
        <div
          className="p-4 text-xs select-none space-y-4 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600 shrink-0" />
                <h3 className="text-[13px] font-black text-slate-900 dark:text-white tracking-tight">
                  Intervalles des mentions
                </h3>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  Sur /{activeScaleLabel}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Définissez librement chaque seuil minimal (sur /{activeScaleLabel}) et le texte de la mention affichée.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenMenu(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tableau aéré des intervalles */}
          <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
            <div className="grid grid-cols-[96px_1fr_84px_30px] items-center gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <span>À partir de</span>
              <span>Nom de la mention</span>
              <span className="text-center">Intervalle</span>
              <span />
            </div>

            {draftRows.map((row) => {
              const rangeHint = computedRangeHints.get(row.uid) || '—';
              return (
                <div
                  key={row.uid}
                  className="grid grid-cols-[96px_1fr_84px_30px] items-center gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5"
                >
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[11px] font-black text-slate-500 dark:text-slate-400 shrink-0">
                      ≥
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={row.minStr}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9.,]/g, '');
                        setDraftRows((prev) =>
                          prev.map((r) => (r.uid === row.uid ? { ...r, minStr: val } : r))
                        );
                        setMentionError(null);
                      }}
                      placeholder={formatFrenchMin(Math.round((activeScale * 0.7) * 100) / 100)}
                      className="w-full min-w-0 h-8 px-2 text-center font-black text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>

                  <input
                    type="text"
                    value={row.label}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDraftRows((prev) =>
                        prev.map((r) => (r.uid === row.uid ? { ...r, label: val } : r))
                      );
                      setMentionError(null);
                    }}
                    placeholder="Ex: Très bien, Excellent, Honorable..."
                    maxLength={48}
                    className="w-full min-w-0 h-8 px-2.5 font-bold text-xs text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                  />

                  <span className="text-[10.5px] font-mono font-bold text-center text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md py-1 px-1 truncate">
                    {rangeHint}
                  </span>

                  <button
                    type="button"
                    disabled={draftRows.length <= 1}
                    onClick={() =>
                      setDraftRows((prev) => prev.filter((r) => r.uid !== row.uid))
                    }
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer shrink-0"
                    title="Supprimer cet intervalle"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Actions rapides sur la liste */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={draftRows.length >= 12}
              onClick={handleAddRuleRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Ajouter un intervalle</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefaultRules}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              title={`Revenir au barème classique adapté sur /${activeScaleLabel}`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Par défaut</span>
            </button>
          </div>

          {/* Portée : Ce tableau uniquement vs Toute la classe */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Appliquer ce barème à :
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMentionScope('sheet')}
                className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                  mentionScope === 'sheet'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11.5px] font-extrabold">Ce tableau</span>
                  {mentionScope === 'sheet' && <Check className="w-3.5 h-3.5 shrink-0" />}
                </div>
                <p
                  className={`text-[10px] mt-0.5 leading-tight ${
                    mentionScope === 'sheet'
                      ? 'text-slate-200'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Uniquement cette feuille
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMentionScope('class')}
                className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                  mentionScope === 'class'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11.5px] font-extrabold">Toute la classe</span>
                  {mentionScope === 'class' && <Check className="w-3.5 h-3.5 shrink-0" />}
                </div>
                <p
                  className={`text-[10px] mt-0.5 leading-tight truncate ${
                    mentionScope === 'class'
                      ? 'text-slate-200'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Tous les tableaux ({classLabel})
                </p>
              </button>
            </div>
          </div>

          {mentionError && (
            <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-bold">
              {mentionError}
            </div>
          )}

          {/* Bouton Enregistrer et appliquer */}
          <button
            type="button"
            disabled={isSavingMention}
            onClick={handleApplyMentions}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            {isSavingMention ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Enregistrer et appliquer</span>
              </>
            )}
          </button>
        </div>
      </SmartFloatingPopover>

      {/* ===================================================================== */}
      {/* POPOVER 2 : COLONNE MATRICULE (AFFICHER/MASQUER + PORTÉE)             */}
      {/* ===================================================================== */}
      <SmartFloatingPopover
        open={openMenu === 'matricule'}
        anchorEl={matriculeBtnRef.current}
        boundaryEl={boundaryEl}
        preferredSide="bottom"
        preferredAlign="start"
        gap={8}
        onClose={() => setOpenMenu(null)}
        ignoreOutsideSelector=".gb-menu-trigger"
        dataPopoverId="gb-matricule-menu"
        className="w-[340px] max-w-[calc(100vw-24px)] rounded-2xl"
      >
        <div
          className="p-4 text-xs select-none space-y-3.5 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* En-tête */}
          <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-emerald-600 shrink-0" />
                <h3 className="text-[13px] font-black text-slate-900 dark:text-white">
                  Colonne Matricule
                </h3>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Affiche la colonne <strong>MATRICULE</strong> juste derrière <strong>PROFIL</strong> pour enregistrer les matricules des étudiants.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpenMenu(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Afficher / Masquer */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDraftShowMatricule(true)}
              className={`py-2 px-2.5 rounded-xl border text-[11.5px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                draftShowMatricule
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
              }`}
            >
              {draftShowMatricule && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
              <span>Afficher</span>
            </button>
            <button
              type="button"
              onClick={() => setDraftShowMatricule(false)}
              className={`py-2 px-2.5 rounded-xl border text-[11.5px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                !draftShowMatricule
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-700 dark:border-slate-500 shadow-xs'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
              }`}
            >
              {!draftShowMatricule && <Check className="w-3.5 h-3.5 stroke-[2.8]" />}
              <span>Masquer</span>
            </button>
          </div>

          {/* Portée */}
          <div className="space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-700">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Appliquer à :
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setMatriculeScope('sheet')}
                className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                  matriculeScope === 'sheet'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-[11px] font-extrabold">Ce tableau</div>
                <div
                  className={`text-[9.5px] leading-tight mt-0.5 ${
                    matriculeScope === 'sheet'
                      ? 'text-slate-200'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Uniquement ici
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMatriculeScope('class')}
                className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                  matriculeScope === 'class'
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                }`}
              >
                <div className="text-[11px] font-extrabold">Toute la classe</div>
                <div
                  className={`text-[9.5px] leading-tight mt-0.5 truncate ${
                    matriculeScope === 'class'
                      ? 'text-slate-200'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  Tous les tableaux
                </div>
              </button>
            </div>
          </div>

          {matriculeError && (
            <div className="px-2.5 py-1.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[10.5px] font-bold">
              {matriculeError}
            </div>
          )}

          <button
            type="button"
            disabled={isSavingMatricule}
            onClick={handleApplyMatricule}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
          >
            {isSavingMatricule ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Enregistrement...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4 stroke-[2.5]" />
                <span>Enregistrer et appliquer</span>
              </>
            )}
          </button>
        </div>
      </SmartFloatingPopover>

      {/* ===================================================================== */}
      {/* POPOVER 3 : BARÈME — MOYENNE MAXIMALE (/20, /40...) & MAX DES NOTES   */}
      {/* ===================================================================== */}
      {onSaveAverageScale && (
        <SmartFloatingPopover
          open={openMenu === 'scale'}
          anchorEl={scaleBtnRef.current}
          boundaryEl={boundaryEl}
          preferredSide="bottom"
          preferredAlign="start"
          gap={8}
          onClose={() => setOpenMenu(null)}
          ignoreOutsideSelector=".gb-menu-trigger"
          dataPopoverId="gb-scale-menu"
          className="w-[480px] max-w-[calc(100vw-24px)] rounded-2xl"
        >
          <div
            className="p-4 text-xs select-none space-y-4 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-700">
              <div>
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-600 shrink-0" />
                  <h3 className="text-[13px] font-black text-slate-900 dark:text-white tracking-tight">
                    Barème de notation &amp; Moyenne maximale
                  </h3>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  {supportsNoteMaxBulk
                    ? 'Choisissez sur combien ramener la moyenne finale ou changez le maximum de vos notes en un clic.'
                    : 'Définissez librement sur combien est calculée la moyenne maximale (ex : /20, /40, /100).'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenMenu(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
                title="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Onglets (dans les tableaux matières qui disposent des colonnes NOTE 1..N) */}
            {supportsNoteMaxBulk && (
              <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => {
                    setScaleTab('average');
                    setAvgScaleError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-[11.5px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    scaleTab === 'average'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Moyenne max</span>
                  <span className="px-1.5 py-0.2 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-sky-300 text-[10px] font-black">
                    /{activeScaleLabel}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScaleTab('notes');
                    setNoteMaxError(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-[11.5px] font-extrabold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    scaleTab === 'notes'
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs border border-slate-200 dark:border-slate-600'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <span>Max des notes</span>
                  <span className="px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black">
                    {noteColumns?.length || 0} col.
                  </span>
                </button>
              </div>
            )}

            {/* =============================================================== */}
            {/* ONGLET 1 : MOYENNE MAXIMALE (SUR /20, /40, /100...)             */}
            {/* =============================================================== */}
            {scaleTab === 'average' ? (
              <div className="space-y-4">
                {/* Propositions rapides */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Propositions rapides
                  </div>
                  <div className="grid grid-cols-6 gap-1.5">
                    {AVG_SCALE_PRESETS.map((preset) => {
                      const isSelected =
                        parsedDraftAvgScale !== null &&
                        Math.abs(parsedDraftAvgScale - preset) < 1e-6;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setDraftAvgScaleStr(String(preset));
                            setAvgScaleError(null);
                          }}
                          className={`py-2 rounded-xl border text-xs font-black transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                          }`}
                        >
                          /{preset}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Saisie libre */}
                <div className="space-y-1.5">
                  <label className="block text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Ou saisir une valeur personnalisée
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                        Moyenne sur /
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={draftAvgScaleStr}
                        onChange={(e) => {
                          setDraftAvgScaleStr(e.target.value.replace(/[^0-9.,]/g, ''));
                          setAvgScaleError(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleApplyAverageScale();
                          }
                        }}
                        placeholder="20"
                        className="w-full h-10 pl-[104px] pr-3 font-black text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                      />
                    </div>
                    {parsedDraftAvgScale !== null &&
                      Math.abs(parsedDraftAvgScale - DEFAULT_AVERAGE_SCALE) > 1e-6 && (
                        <button
                          type="button"
                          onClick={() => {
                            setDraftAvgScaleStr('20');
                            setAvgScaleError(null);
                          }}
                          className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1 cursor-pointer shrink-0"
                          title="Revenir sur /20"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>/20</span>
                        </button>
                      )}
                  </div>
                </div>

                {/* Aperçu pédagogique clair */}
                {parsedDraftAvgScale !== null && (
                  <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/35 border border-blue-200/90 dark:border-blue-800/70 text-[11px] text-blue-950 dark:text-blue-100 leading-relaxed">
                    Toutes les notes (même si elles sont sur <strong>/10</strong>,{' '}
                    <strong>/20</strong> ou <strong>/40</strong>) sont ramenées automatiquement sur{' '}
                    <strong>/{formatScaleValue(parsedDraftAvgScale)}</strong>. Seuil de réussite :{' '}
                    <strong>
                      ≥ {formatScaleValue(parsedDraftAvgScale / 2)} /{' '}
                      {formatScaleValue(parsedDraftAvgScale)}
                    </strong>
                    .
                  </div>
                )}

                {/* Portée : Ce tableau vs Toute la classe */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-700 space-y-2">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Appliquer cette moyenne maximale à :
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAvgScaleScope('sheet')}
                      className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                        avgScaleScope === 'sheet'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11.5px] font-extrabold">Ce tableau</span>
                        {avgScaleScope === 'sheet' && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <p
                        className={`text-[10px] mt-0.5 leading-tight ${
                          avgScaleScope === 'sheet'
                            ? 'text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Uniquement cette feuille
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAvgScaleScope('class')}
                      className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                        avgScaleScope === 'class'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11.5px] font-extrabold">Toute la classe</span>
                        {avgScaleScope === 'class' && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <p
                        className={`text-[10px] mt-0.5 leading-tight truncate ${
                          avgScaleScope === 'class'
                            ? 'text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Tous les tableaux ({classLabel})
                      </p>
                    </button>
                  </div>
                </div>

                {avgScaleError && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-bold">
                    {avgScaleError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSavingAvgScale}
                  onClick={handleApplyAverageScale}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingAvgScale ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Enregistrer et appliquer</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              /* =============================================================== */
              /* ONGLET 2 : CHANGER LE MAX DES NOTES EN UN COUP (TOUTES OU 1)    */
              /* =============================================================== */
              <div className="space-y-4">
                {/* Choix cible : Toutes les notes vs Note spécifique */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Notes à modifier
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setNoteMaxMode('all');
                        setNoteMaxError(null);
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                        noteMaxMode === 'all'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11.5px] font-extrabold">Toutes les notes</span>
                        {noteMaxMode === 'all' && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <p
                        className={`text-[10px] mt-0.5 leading-tight ${
                          noteMaxMode === 'all'
                            ? 'text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Les {noteColumns?.length || 0} colonnes d&apos;un coup
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setNoteMaxMode('specific');
                        if (selectedColObj) {
                          setDraftNoteMaxStr(formatScaleValue(selectedColObj.maxScore));
                        }
                        setNoteMaxError(null);
                      }}
                      className={`px-3 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                        noteMaxMode === 'specific'
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11.5px] font-extrabold">Note spécifique</span>
                        {noteMaxMode === 'specific' && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </div>
                      <p
                        className={`text-[10px] mt-0.5 leading-tight ${
                          noteMaxMode === 'specific'
                            ? 'text-slate-200'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        Choisir 1 colonne précise
                      </p>
                    </button>
                  </div>

                  {noteMaxMode === 'specific' && noteColumns && noteColumns.length > 0 && (
                    <div className="pt-1">
                      <select
                        value={selectedNoteColIndex}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setSelectedNoteColIndex(idx);
                          const col = noteColumns.find((c) => c.index === idx);
                          if (col) setDraftNoteMaxStr(formatScaleValue(col.maxScore));
                          setNoteMaxError(null);
                        }}
                        className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs font-extrabold text-slate-900 dark:text-white outline-none focus:border-blue-500 cursor-pointer"
                      >
                        {noteColumns.map((col) => (
                          <option key={col.index} value={col.index}>
                            {col.label} (actuellement /{formatScaleValue(col.maxScore)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Propositions rapides pour le max des notes */}
                <div className="space-y-2">
                  <div className="text-[10.5px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Nouveau barème maximal
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {NOTE_MAX_PRESETS.map((preset) => {
                      const isSelected =
                        parsedDraftNoteMax !== null &&
                        Math.abs(parsedDraftNoteMax - preset) < 1e-6;
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => {
                            setDraftNoteMaxStr(String(preset));
                            setNoteMaxError(null);
                          }}
                          className={`py-2 rounded-xl border text-[11px] font-black transition cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                              : 'bg-slate-50 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-blue-400'
                          }`}
                        >
                          /{preset}
                        </button>
                      );
                    })}
                  </div>

                  {/* Saisie libre */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                      Notes sur /
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={draftNoteMaxStr}
                      onChange={(e) => {
                        setDraftNoteMaxStr(e.target.value.replace(/[^0-9.,]/g, ''));
                        setNoteMaxError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyBulkNoteMax();
                        }
                      }}
                      placeholder="40"
                      className="w-full h-10 pl-[84px] pr-3 font-black text-sm text-slate-900 dark:text-white bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-xl outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40"
                    />
                  </div>
                </div>

                {/* Option facultative : convertir proportionnellement les notes déjà saisies */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={convertExistingScores}
                    onChange={(e) => setConvertExistingScores(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="text-[11.5px] font-extrabold text-slate-800 dark:text-slate-100 leading-tight">
                      Convertir proportionnellement les notes déjà saisies
                    </div>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                      {convertExistingScores
                        ? 'Exemple : une note de 14/20 passée sur /40 deviendra automatiquement 28/40.'
                        : 'Désactivé (défaut) : seul le maximum change pour tous les élèves (ex : -/20 → -/40, 14/20 → 14/40).'}
                    </p>
                  </div>
                </label>

                {/* Résumé de l'opération */}
                {parsedDraftNoteMax !== null && (
                  <div className="px-3 py-2 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
                    {noteMaxMode === 'all' ? (
                      <>
                        Applique <strong>/{formatScaleValue(parsedDraftNoteMax)}</strong> à{' '}
                        <strong>toutes les {noteColumns?.length || 0} colonnes</strong>
                        {typeof studentsCount === 'number' && studentsCount > 0
                          ? ` pour les ${studentsCount} lignes d'élèves`
                          : ''}
                        , puis enregistre automatiquement.
                      </>
                    ) : (
                      <>
                        Applique <strong>/{formatScaleValue(parsedDraftNoteMax)}</strong> à{' '}
                        <strong>{selectedColObj?.label || 'la note sélectionnée'}</strong>
                        {typeof studentsCount === 'number' && studentsCount > 0
                          ? ` pour les ${studentsCount} lignes d'élèves`
                          : ''}
                        , puis enregistre automatiquement.
                      </>
                    )}
                  </div>
                )}

                {noteMaxError && (
                  <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-bold">
                    {noteMaxError}
                  </div>
                )}

                <button
                  type="button"
                  disabled={isSavingNoteMax}
                  onClick={handleApplyBulkNoteMax}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-xs font-extrabold shadow-sm transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSavingNoteMax ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Application et enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Appliquer et enregistrer</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </SmartFloatingPopover>
      )}

      {/* ===================================================================== */}
      {/* POPOVER 4 : DISPOSITION DES COLONNES (AVANT / APRÈS LES NOTES)        */}
      {/* ===================================================================== */}
      {onSaveColumnOrder && (
        <SmartFloatingPopover
          open={openMenu === 'layout'}
          anchorEl={layoutBtnRef.current}
          boundaryEl={boundaryEl}
          preferredSide="bottom"
          preferredAlign="end"
          gap={8}
          onClose={() => setOpenMenu(null)}
          ignoreOutsideSelector=".gb-menu-trigger"
          dataPopoverId="gb-column-layout-menu"
          className="w-[480px] max-w-[calc(100vw-24px)] rounded-2xl"
        >
          <div
            className="p-4 text-xs select-none space-y-3.5 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-700 max-h-[82vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête */}
            <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-700">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Columns3 className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                  <h3 className="text-[13px] font-black text-slate-900 dark:text-white tracking-tight">
                    Disposition des colonnes
                  </h3>
                  {!isDraftDefaultLayout && (
                    <span className="px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-700 text-[9.5px] font-extrabold text-sky-700 dark:text-sky-300">
                      Personnalisée
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                  Placez librement chaque colonne avant ou après{' '}
                  <strong className="text-slate-700 dark:text-slate-200">{resolvedCenterNoun}</strong>{' '}
                  et choisissez son ordre exact.
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    setDraftColumnOrder(
                      getDefaultColumnOrder({ includeTotal: includeTotalColumn })
                    )
                  }
                  disabled={isDraftDefaultLayout}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                  title="Réinitialiser à la disposition par défaut StudyCloud"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Par défaut</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOpenMenu(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  title="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* 1. Barre d'aperçu visuel en direct */}
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <span>Aperçu en direct de l&apos;en-tête</span>
                <span className="font-semibold normal-case text-slate-400">
                  Exports PDF · Word · Excel inclus
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {draftColumnOrder.left.map((colKey) => {
                  const isHiddenMatricule = colKey === 'matricule' && !showMatricule;
                  return (
                    <span
                      key={`prev-l-${colKey}`}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold border ${
                        isHiddenMatricule
                          ? 'bg-slate-100/70 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-dashed border-slate-300 dark:border-slate-600'
                          : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600 shadow-2xs'
                      }`}
                      title={
                        isHiddenMatricule
                          ? 'Colonne Matricule actuellement masquée — sa position est mémorisée'
                          : GRADEBOOK_COLUMN_META[colKey].label
                      }
                    >
                      {isHiddenMatricule && <EyeOff className="w-2.5 h-2.5 shrink-0" />}
                      {GRADEBOOK_COLUMN_META[colKey].shortLabel}
                    </span>
                  );
                })}

                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black bg-blue-600 text-white shadow-xs">
                  <Lock className="w-2.5 h-2.5 shrink-0" />
                  <span>{resolvedCenterLabel}</span>
                </span>

                {draftColumnOrder.right.map((colKey) => {
                  const isHiddenMatricule = colKey === 'matricule' && !showMatricule;
                  return (
                    <span
                      key={`prev-r-${colKey}`}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-extrabold border ${
                        isHiddenMatricule
                          ? 'bg-slate-100/70 dark:bg-slate-900/50 text-slate-400 dark:text-slate-500 border-dashed border-slate-300 dark:border-slate-600'
                          : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700 shadow-2xs'
                      }`}
                      title={
                        isHiddenMatricule
                          ? 'Colonne Matricule actuellement masquée — sa position est mémorisée'
                          : GRADEBOOK_COLUMN_META[colKey].label
                      }
                    >
                      {isHiddenMatricule && <EyeOff className="w-2.5 h-2.5 shrink-0" />}
                      {GRADEBOOK_COLUMN_META[colKey].shortLabel}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* 2. Modèles rapides (1 clic) */}
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Modèles rapides (1 clic)
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {COLUMN_LAYOUT_PRESETS.map((preset) => {
                  const isActive = activeDraftPresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setDraftColumnOrder(
                          getPresetColumnOrder(preset.id, {
                            includeTotal: includeTotalColumn,
                          })
                        );
                        setLayoutError(null);
                      }}
                      className={`px-2.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                        isActive
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-sky-600 dark:border-sky-500 shadow-xs'
                          : 'bg-slate-50 dark:bg-slate-800/70 text-slate-800 dark:text-slate-100 border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-sky-500'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-extrabold truncate">
                          {preset.name}
                        </span>
                        {isActive && <Check className="w-3 h-3 shrink-0" />}
                      </div>
                      <p
                        className={`text-[9.5px] mt-0.5 leading-snug truncate ${
                          isActive ? 'text-slate-200' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {preset.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. Éditeur libre 2 zones : Avant (Gauche) / Après (Droite) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Personnalisation libre (↑ ↓ ordre · ← → côté · glisser-déposer)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {(['left', 'right'] as const).map((side) => {
                  const items = draftColumnOrder[side];
                  const isLeft = side === 'left';
                  return (
                    <div
                      key={side}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverZone !== side) setDragOverZone(side);
                      }}
                      onDragLeave={() => {
                        if (dragOverZone === side) setDragOverZone(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropOnZone(side);
                      }}
                      className={`rounded-xl border p-2 space-y-1.5 min-h-[140px] transition ${
                        dragOverZone === side
                          ? 'bg-blue-50/70 dark:bg-sky-950/40 border-blue-400 dark:border-sky-500'
                          : 'bg-slate-50/80 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between px-1 pb-1 border-b border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] font-black uppercase tracking-wide text-slate-600 dark:text-slate-300">
                          {isLeft
                            ? `Avant ${resolvedCenterNoun}`
                            : `Après ${resolvedCenterNoun}`}
                        </span>
                        <span className="text-[9.5px] font-bold text-slate-400">
                          {items.length}
                        </span>
                      </div>

                      {items.length === 0 ? (
                        <div className="h-[92px] rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center text-center px-2 text-[10px] font-semibold text-slate-400">
                          Aucune colonne de ce côté
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {items.map((colKey, idx) => {
                            const isHiddenMatricule = colKey === 'matricule' && !showMatricule;
                            return (
                              <div
                                key={colKey}
                                draggable
                                onDragStart={() => setDraggedColKey(colKey)}
                                onDragEnd={() => {
                                  setDraggedColKey(null);
                                  setDragOverZone(null);
                                }}
                                onDragOver={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleDropOnZone(side, colKey);
                                }}
                                className={`flex items-center justify-between gap-1 px-1.5 py-1.5 rounded-lg border transition cursor-grab active:cursor-grabbing ${
                                  draggedColKey === colKey
                                    ? 'opacity-50 border-blue-400 bg-blue-50 dark:bg-sky-950/60'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 shadow-2xs'
                                }`}
                              >
                                <div className="flex items-center gap-1 min-w-0">
                                  <GripVertical className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0" />
                                  <span
                                    className={`text-[11px] font-extrabold truncate ${
                                      isHiddenMatricule
                                        ? 'text-slate-400 dark:text-slate-500'
                                        : 'text-slate-800 dark:text-slate-100'
                                    }`}
                                  >
                                    {GRADEBOOK_COLUMN_META[colKey].label}
                                  </span>
                                  {isHiddenMatricule && (
                                    <span
                                      className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[8.5px] font-bold text-slate-500 dark:text-slate-400 shrink-0"
                                      title="Actuellement masquée — sa place reste sauvegardée"
                                    >
                                      Masquée
                                    </span>
                                  )}
                                </div>

                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    disabled={idx === 0}
                                    onClick={() =>
                                      setDraftColumnOrder((prev) =>
                                        moveColumnWithinSide(prev, colKey, 'up', {
                                          includeTotal: includeTotalColumn,
                                        })
                                      )
                                    }
                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                    title="Monter (placer devant)"
                                  >
                                    <ArrowUp className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={idx === items.length - 1}
                                    onClick={() =>
                                      setDraftColumnOrder((prev) =>
                                        moveColumnWithinSide(prev, colKey, 'down', {
                                          includeTotal: includeTotalColumn,
                                        })
                                      )
                                    }
                                    className="w-5 h-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer"
                                    title="Descendre (placer derrière)"
                                  >
                                    <ArrowDown className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDraftColumnOrder((prev) =>
                                        moveColumnToSide(
                                          prev,
                                          colKey,
                                          isLeft ? 'right' : 'left',
                                          { includeTotal: includeTotalColumn }
                                        )
                                      )
                                    }
                                    className={`h-5 px-1.5 rounded flex items-center gap-0.5 text-[9.5px] font-extrabold transition cursor-pointer ${
                                      isLeft
                                        ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/70 dark:text-indigo-300 dark:hover:bg-indigo-900/70'
                                        : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/70 dark:text-sky-300 dark:hover:bg-sky-900/70'
                                    }`}
                                    title={
                                      isLeft
                                        ? `Passer après ${resolvedCenterNoun}`
                                        : `Ramener avant ${resolvedCenterNoun}`
                                    }
                                  >
                                    {isLeft ? (
                                      <ArrowRight className="w-2.5 h-2.5" />
                                    ) : (
                                      <ArrowLeft className="w-2.5 h-2.5" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {layoutError && (
              <div className="px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-[11px] font-bold">
                {layoutError}
              </div>
            )}

            {/* 4. Boutons d'application (Ce tableau vs Toute la classe) */}
            <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={savingLayoutScope !== null}
                onClick={() => handleApplyColumnOrder('sheet')}
                className="px-3 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-60 text-white text-left transition active:scale-[0.99] cursor-pointer shadow-xs"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold">Ce tableau uniquement</span>
                  {savingLayoutScope === 'sheet' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
                </div>
                <p className="text-[9.5px] text-slate-300 mt-0.5 leading-tight">
                  Sauvegardé pour cette feuille
                </p>
              </button>

              <button
                type="button"
                disabled={savingLayoutScope !== null}
                onClick={() => handleApplyColumnOrder('class')}
                className="px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-left transition active:scale-[0.99] cursor-pointer shadow-xs"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] font-extrabold">Toute la classe</span>
                  {savingLayoutScope === 'class' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  ) : (
                    <Check className="w-3.5 h-3.5 shrink-0" />
                  )}
                </div>
                <p className="text-[9.5px] text-blue-100 mt-0.5 leading-tight truncate">
                  Matières, trimestres &amp; annuel ({classLabel})
                </p>
              </button>
            </div>
          </div>
        </SmartFloatingPopover>
      )}
    </div>
  );
};
