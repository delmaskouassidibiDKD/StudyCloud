import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  Check,
  ChevronDown,
  Hash,
  Loader2,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import {
  DEFAULT_CUSTOM_MENTION_RULES,
  sanitizeCustomMentionRules,
  type CustomMentionRule,
} from '../../utils/gradebookCalculations';

export type SheetSettingScope = 'sheet' | 'class';

export interface MentionAndMatriculeControlsProps {
  /** Règles de mentions actuellement effectives sur ce tableau */
  effectiveMentionRules: readonly CustomMentionRule[];
  /** True si des règles personnalisées (tableau ou classe) sont actives */
  hasCustomMentionRules: boolean;
  /** True si la colonne MATRICULE est actuellement affichée sur ce tableau */
  showMatricule: boolean;
  /** Libellé lisible de la classe (ex: "BTS 2 • GROUPE 2") */
  classLabel: string;
  /** Conteneur limite pour SmartFloatingPopover */
  boundaryEl?: HTMLElement | null;
  /** Appelé à l'ouverture d'un des 2 popovers (pour fermer d'autres menus du ruban) */
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
}

interface DraftRuleRow {
  uid: string;
  minStr: string;
  label: string;
}

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
  classLabel,
  boundaryEl,
  onWillOpen,
  closeSignal = 0,
  onSaveMentionRules,
  onSaveShowMatricule,
}) => {
  const [openMenu, setOpenMenu] = useState<'mentions' | 'matricule' | null>(null);
  const mentionBtnRef = useRef<HTMLButtonElement>(null);
  const matriculeBtnRef = useRef<HTMLButtonElement>(null);

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
    }, 2400);
  };

  const openMentionsPopover = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const next = openMenu === 'mentions' ? null : 'mentions';
    onWillOpen?.();
    if (next === 'mentions') {
      const base =
        effectiveMentionRules.length > 0
          ? effectiveMentionRules
          : DEFAULT_CUSTOM_MENTION_RULES;
      setDraftRows(
        [...base]
          .sort((a, b) => b.min - a.min)
          .map((r) => ({
            uid: makeRowUid(),
            minStr: String(r.min).replace('.', ','),
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

  // Aperçu temps réel des plages calculées pour chaque ligne (ex: "16 – 20", "14 – 15,99")
  const computedRangeHints = useMemo(() => {
    const parsed = draftRows.map((row) => {
      const n = Number(row.minStr.trim().replace(',', '.'));
      return {
        uid: row.uid,
        min: row.minStr.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 20 ? n : null,
      };
    });
    const validSorted = parsed
      .filter((p): p is { uid: string; min: number } => p.min !== null)
      .sort((a, b) => b.min - a.min);

    const map = new Map<string, string>();
    validSorted.forEach((item, idx) => {
      if (idx === 0) {
        map.set(item.uid, `${formatFrenchMin(item.min)} – 20`);
      } else {
        const upper = Math.max(item.min, Math.round((validSorted[idx - 1].min - 0.01) * 100) / 100);
        map.set(item.uid, `${formatFrenchMin(item.min)} – ${formatFrenchMin(upper)}`);
      }
    });
    return map;
  }, [draftRows]);

  const handleAddRuleRow = () => {
    if (draftRows.length >= 12) return;
    setDraftRows((prev) => [
      ...prev,
      { uid: makeRowUid(), minStr: '', label: '' },
    ]);
    setMentionError(null);
  };

  const handleResetDefaultRules = () => {
    setDraftRows(
      DEFAULT_CUSTOM_MENTION_RULES.map((r) => ({
        uid: makeRowUid(),
        minStr: String(r.min),
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
      if (rawMin === '' || !Number.isFinite(num) || num < 0 || num > 20) {
        setMentionError(`Ligne ${i + 1} : indiquez une note minimale entre 0 et 20.`);
        return;
      }
      if (!label) {
        setMentionError(`Ligne ${i + 1} : saisissez le nom de la mention (ex: Bien, Excellent…).`);
        return;
      }
      const rounded = Math.round(num * 100) / 100;
      if (seenMins.has(rounded)) {
        setMentionError(`Le seuil ${formatFrenchMin(rounded)}/20 est défini en double.`);
        return;
      }
      seenMins.add(rounded);
      candidateRules.push({ min: rounded, label: label.slice(0, 48) });
    }

    const sanitized = sanitizeCustomMentionRules(candidateRules);
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

        {feedbackToast && openMenu === null && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-md shadow-lg whitespace-nowrap z-[100] pointer-events-none">
            {feedbackToast}
          </div>
        )}
      </div>
      <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium leading-none mb-0.5">
        Mentions &amp; Matricule
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
                  Sur /20
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                Définissez librement chaque seuil minimal et le texte de la mention affichée.
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
            <div className="grid grid-cols-[96px_1fr_76px_30px] items-center gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
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
                  className="grid grid-cols-[96px_1fr_76px_30px] items-center gap-2 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1.5"
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
                      placeholder="14"
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
              title="Revenir au barème classique (16, 14, 12, 10, 0)"
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
    </div>
  );
};
