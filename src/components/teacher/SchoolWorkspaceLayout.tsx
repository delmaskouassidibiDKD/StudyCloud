import React, { useState, useRef } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowLeftRight,
  Award,
  BookOpen,
  ChevronRight,
  Cloud,
  CloudOff,
  FolderKanban,
  GraduationCap,
  Layers,
  Loader2,
  Maximize2,
  Menu,
  Minimize2,
  MoreHorizontal,
  Plus,
  Search,
  CheckCircle2,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  ClassAverageCardItem,
  ClassItem,
  SchoolItem,
  SchoolYearItem,
  StudyLevelItem,
  SubjectItem,
  TermItem,
} from './TeacherClassesView';
import type { GradebookInspection } from '../../utils/teacherTransferEngine';
import { SmartFloatingPopover } from './SmartFloatingPopover';
import { ViewerSuperExpandButton } from '../ViewerSuperExpandButton';
import type { ViewerExpandLevel } from '../../utils/viewerExpandManager';

export interface SchoolWorkspaceLayoutProps {
  school: SchoolItem;
  schoolYear: SchoolYearItem | null;
  levels: StudyLevelItem[];
  activeLevel: StudyLevelItem | null;
  allSchoolClasses: ClassItem[];
  levelClasses: ClassItem[];
  enteredClass: ClassItem | null;
  allTerms: TermItem[];
  classTerms: TermItem[];
  activeTerm: TermItem | null;
  allSubjects: SubjectItem[];
  termSubjects: SubjectItem[];
  classAverages: ClassAverageCardItem[];
  currentClassAverageCards: ClassAverageCardItem[];
  serverGradebookStats?: Record<string, GradebookInspection>;
  // Statut cloud & utilisateur
  saveUiState: 'idle' | 'saving' | 'saved' | 'offline' | 'error';
  cloudStatus: 'idle' | 'loading' | 'syncing' | 'ready' | 'error';
  isOnline: boolean;
  saveFeedbackMessage: string | null;
  userName: string;
  // Vue plein écran / agrandissement
  viewerExpandLevel: ViewerExpandLevel;
  isViewerMaximized: boolean;
  onExpandChange: (lvl: ViewerExpandLevel) => void;
  onToggleMaximize: () => void;
  // Transfert
  isTransferViewOpen: boolean;
  renderTransferView: () => React.ReactNode;
  onOpenTransfer: () => void;
  onCloseTransfer: () => void;
  // Navigation
  onExitSchool: () => void;
  onSelectLevel: (levelId: string) => void;
  onEnterClass: (cls: ClassItem) => void;
  onExitClass: () => void;
  onSelectTerm: (termId: string) => void;
  onOpenSubject: (subject: SubjectItem) => void;
  onOpenAverageCard: (card: ClassAverageCardItem, cls: ClassItem) => void;
  // Créations & Menus (100 % connectés aux modales/popovers existants de TeacherClassesView)
  onAddLevel: () => void;
  onAddClass: () => void;
  onAddSubject: () => void;
  addTermBtnRef: React.RefObject<HTMLButtonElement | null>;
  onToggleAddTermPopover: () => void;
  nextTermNumber: number;
  onOpenMenu: (
    e: React.MouseEvent,
    type: 'level' | 'class' | 'term' | 'subject',
    item: any
  ) => void;
  boundaryRef: React.RefObject<HTMLElement | null>;
}

const isCustomCardColor = (rawColor?: string): boolean => {
  if (!rawColor) return false;
  const low = rawColor.trim().toLowerCase();
  return low !== '#ffffff' && low !== 'white' && low !== '#f8fafc' && low !== '#f1f5f9';
};

const getSafeAccentColor = (rawColor?: string): string => {
  if (!isCustomCardColor(rawColor)) return '#64748b';
  return rawColor!;
};

const formatClassDisplayTitle = (cls: ClassItem): string => {
  if (cls.name?.trim()) return cls.name.trim();
  return cls.level || 'Classe';
};

export const SchoolWorkspaceLayout: React.FC<SchoolWorkspaceLayoutProps> = ({
  school,
  schoolYear,
  levels,
  activeLevel,
  allSchoolClasses,
  levelClasses,
  enteredClass,
  allTerms,
  classTerms,
  activeTerm,
  allSubjects,
  termSubjects,
  classAverages,
  currentClassAverageCards,
  serverGradebookStats,
  saveUiState,
  cloudStatus,
  isOnline,
  saveFeedbackMessage,
  userName,
  viewerExpandLevel,
  isViewerMaximized,
  onExpandChange,
  onToggleMaximize,
  isTransferViewOpen,
  renderTransferView,
  onOpenTransfer,
  onCloseTransfer,
  onExitSchool,
  onSelectLevel,
  onEnterClass,
  onExitClass,
  onSelectTerm,
  onOpenSubject,
  onOpenAverageCard,
  onAddLevel,
  onAddClass,
  onAddSubject,
  addTermBtnRef,
  onToggleAddTermPopover,
  nextTermNumber,
  onOpenMenu,
  boundaryRef,
}) => {
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Popover "Moyenne générale" en bas de la barre latérale de l'ÉCOLE (accès rapide par classe)
  const [isSchoolAvgMenuOpen, setIsSchoolAvgMenuOpen] = useState(false);
  const schoolAvgBtnRef = useRef<HTMLButtonElement>(null);

  const filteredClasses = classSearch.trim()
    ? levelClasses.filter((c) => {
        const q = classSearch.trim().toLowerCase();
        return (
          (c.name || '').toLowerCase().includes(q) ||
          (c.level || '').toLowerCase().includes(q) ||
          (c.teacherName || '').toLowerCase().includes(q)
        );
      })
    : levelClasses;

  const filteredSubjects = subjectSearch.trim()
    ? termSubjects.filter((s) =>
        (s.name || '').toLowerCase().includes(subjectSearch.trim().toLowerCase())
      )
    : termSubjects;

  const annualAvgCard = currentClassAverageCards.find((c) => c.kind === 'annual') || null;
  const termAvgCards = currentClassAverageCards.filter((c) => c.kind === 'term');

  const getAverageCardsForClass = (cls: ClassItem): ClassAverageCardItem[] => {
    const clsTerms = allTerms
      .filter((t) => t.classId === cls.id)
      .sort((a, b) => a.number - b.number);
    const persisted = classAverages.filter((ca) => ca.classId === cls.id);
    const annual: ClassAverageCardItem =
      persisted.find((ca) => ca.kind === 'annual') || {
        id: `avg-annual-${cls.id}`,
        classId: cls.id,
        schoolId: cls.schoolId,
        yearId: cls.yearId,
        kind: 'annual',
        title: "Moyenne générale de l'année",
        sortOrder: 0,
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        createdAt: cls.createdAt,
      };
    const tCards: ClassAverageCardItem[] = clsTerms.map((t, idx) => {
      const found = persisted.find((ca) => ca.kind === 'term' && ca.termId === t.id);
      if (found) return found;
      return {
        id: `avg-term-${t.id}`,
        classId: cls.id,
        termId: t.id,
        schoolId: cls.schoolId,
        yearId: cls.yearId,
        kind: 'term',
        title: `Moyenne générale · ${t.name}`,
        sortOrder: idx + 1,
        color: '#ffffff',
        textColor: '#0f172a',
        borderColor: '#e2e8f0',
        borderDarkColor: '#cbd5e1',
        createdAt: t.createdAt,
      };
    });
    return [annual, ...tCards];
  };

  // ============================================================================
  // BARRE LATÉRALE GAUCHE (STYLE LOGICIEL PRO ÉPURÉ, LIGNES NETTES, JOUR & SOMBRE)
  // ============================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full min-h-0 bg-white dark:bg-[#111827] text-slate-800 dark:text-slate-100 select-none">
      {/* HAUT DE LA BARRE LATÉRALE (FIXE) */}
      <div className="px-3 pt-2.5 pb-2.5 border-b border-slate-300 dark:border-slate-700 shrink-0 space-y-2">
        <button
          type="button"
          onClick={() => {
            setIsMobileSidebarOpen(false);
            if (isTransferViewOpen) {
              onCloseTransfer();
            } else if (enteredClass) {
              onExitClass();
            } else {
              onExitSchool();
            }
          }}
          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="truncate">
            {isTransferViewOpen
              ? 'Retour à la vue'
              : enteredClass
              ? activeLevel?.name || 'Retour au niveau'
              : 'Toutes les écoles'}
          </span>
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-[#1e293b] overflow-hidden flex items-center justify-center shrink-0">
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt={school.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {school.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 dark:text-white truncate leading-tight">
              {school.name}
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400 truncate leading-tight mt-0.5">
              {enteredClass
                ? `${activeLevel?.name || ''} · ${schoolYear?.label || ''}`
                : schoolYear?.label || 'Année scolaire'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer shrink-0"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MILIEU DÉFILABLE : NIVEAUX (EN MODE ÉCOLE) OU CLASSES (EN MODE CLASSE) */}
      <div className="flex-1 min-h-0 overflow-y-auto px-2.5 py-2.5 space-y-1">
        {!enteredClass ? (
          <>
            <div className="px-1.5 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Niveaux ({levels.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onAddLevel();
                }}
                className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="Ajouter un niveau d'étude"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {levels.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onAddLevel();
                }}
                className="w-full px-2.5 py-2 rounded-md border border-dashed border-slate-400 dark:border-slate-600 bg-slate-50 dark:bg-[#161f33] hover:bg-slate-100 dark:hover:bg-slate-800 text-[11.5px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                <span>Créer un niveau</span>
              </button>
            ) : (
              levels.map((lvl) => {
                const isSelected = activeLevel?.id === lvl.id && !isTransferViewOpen;
                const count = allSchoolClasses.filter((c) => c.levelId === lvl.id).length;
                const hasColor = isCustomCardColor(lvl.color);
                const isFull = hasColor && lvl.colorStyle === 'full';
                return (
                  <div
                    key={lvl.id}
                    data-popover-avoid="true"
                    onClick={() => {
                      if (isTransferViewOpen) onCloseTransfer();
                      onSelectLevel(lvl.id);
                      setIsMobileSidebarOpen(false);
                    }}
                    style={
                      isFull
                        ? {
                            backgroundColor: lvl.color,
                            color: lvl.textColor || '#ffffff',
                            borderColor: lvl.borderColor || lvl.color,
                          }
                        : undefined
                    }
                    className={`group relative overflow-hidden flex items-center justify-between gap-1.5 px-2.5 h-8 rounded-md border text-xs transition cursor-pointer ${
                      isFull
                        ? isSelected
                          ? 'font-semibold ring-2 ring-[#0051c3] dark:ring-blue-400 ring-offset-1 ring-offset-white dark:ring-offset-[#111827]'
                          : 'font-medium opacity-95 hover:opacity-100'
                        : isSelected
                        ? 'bg-[#eff6ff] dark:bg-blue-500/20 border-[#0051c3]/70 dark:border-blue-400/70 text-[#0051c3] dark:text-blue-200 font-semibold'
                        : 'bg-white dark:bg-[#161f33]/70 border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                    }`}
                  >
                    {!isFull && (isSelected || hasColor) && (
                      <span
                        className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                        style={{
                          backgroundColor: hasColor ? lvl.color : '#0051c3',
                        }}
                      />
                    )}
                    <div className={`flex items-center gap-2 min-w-0 flex-1 ${!isFull && (isSelected || hasColor) ? 'pl-1' : ''}`}>
                      <Layers
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isFull
                            ? 'text-white/90'
                            : isSelected
                            ? 'text-[#0051c3] dark:text-blue-300'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      />
                      <span className="truncate">{lvl.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                          isFull
                            ? 'bg-black/20 border-white/25 text-white'
                            : isSelected
                            ? 'bg-white/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500/50 text-[#0051c3] dark:text-blue-200'
                            : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => onOpenMenu(e, 'level', lvl)}
                        className={`card-menu-trigger w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                          isFull
                            ? 'text-white/80 hover:text-white hover:bg-black/20'
                            : isSelected
                            ? 'text-[#0051c3] dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                        title={`Options de ${lvl.name}`}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </>
        ) : (
          <>
            <div className="px-1.5 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                Classes ({levelClasses.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onAddClass();
                }}
                className="w-6 h-6 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="Ajouter une classe dans ce niveau"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {levelClasses.map((cls) => {
              const isSelected = enteredClass.id === cls.id && !isTransferViewOpen;
              const subjCount = allSubjects.filter((s) => s.classId === cls.id).length;
              const hasColor = isCustomCardColor(cls.color);
              const isFull = hasColor && cls.colorStyle === 'full';
              return (
                <div
                  key={cls.id}
                  data-popover-avoid="true"
                  onClick={() => {
                    if (isTransferViewOpen) onCloseTransfer();
                    onEnterClass(cls);
                    setIsMobileSidebarOpen(false);
                  }}
                  style={
                    isFull
                      ? {
                          backgroundColor: cls.color,
                          color: cls.textColor || '#ffffff',
                          borderColor: cls.borderDarkColor || cls.borderColor || cls.color,
                        }
                      : undefined
                  }
                  className={`group relative overflow-hidden flex items-center justify-between gap-1.5 px-2.5 h-8 rounded-md border text-xs transition cursor-pointer ${
                    isFull
                      ? isSelected
                        ? 'font-semibold ring-2 ring-[#0051c3] dark:ring-blue-400 ring-offset-1 ring-offset-white dark:ring-offset-[#111827]'
                        : 'font-medium opacity-95 hover:opacity-100'
                      : isSelected
                      ? 'bg-[#eff6ff] dark:bg-blue-500/20 border-[#0051c3]/70 dark:border-blue-400/70 text-[#0051c3] dark:text-blue-200 font-semibold'
                      : 'bg-white dark:bg-[#161f33]/70 border-slate-200 dark:border-slate-700/90 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                  }`}
                >
                  {!isFull && (isSelected || hasColor) && (
                    <span
                      className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                      style={{
                        backgroundColor: hasColor ? cls.color : '#0051c3',
                      }}
                    />
                  )}
                  <div className={`flex items-center gap-2 min-w-0 flex-1 ${!isFull && (isSelected || hasColor) ? 'pl-1' : ''}`}>
                    <GraduationCap
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isFull
                          ? 'text-white/90'
                          : isSelected
                          ? 'text-[#0051c3] dark:text-blue-300'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    />
                    <span className="truncate">{formatClassDisplayTitle(cls)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${
                        isFull
                          ? 'bg-black/20 border-white/25 text-white'
                          : isSelected
                          ? 'bg-white/90 dark:bg-blue-950/60 border-blue-300 dark:border-blue-500/50 text-[#0051c3] dark:text-blue-200'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {subjCount}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => onOpenMenu(e, 'class', cls)}
                      className={`card-menu-trigger w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                        isFull
                          ? 'text-white/80 hover:text-white hover:bg-black/20'
                          : isSelected
                          ? 'text-[#0051c3] dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                          : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                      title={`Options de ${formatClassDisplayTitle(cls)}`}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </div>

      {/* ===================================================================== */}
      {/* BAS FIXE DE LA BARRE LATÉRALE (TOUJOURS VISIBLE, NE DÉFILE JAMAIS)    */}
      {/* ===================================================================== */}
      <div className="shrink-0 border-t border-slate-300 dark:border-slate-700 bg-[#f8fafc] dark:bg-[#0d1424] px-2.5 py-2.5 space-y-2">
        {!enteredClass ? (
          <button
            ref={schoolAvgBtnRef}
            type="button"
            onClick={() => setIsSchoolAvgMenuOpen((prev) => !prev)}
            disabled={levelClasses.length === 0}
            className={`w-full h-8 px-2.5 rounded-md border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              isSchoolAvgMenuOpen
                ? 'bg-[#eff6ff] dark:bg-blue-500/20 border-[#0051c3] dark:border-blue-400 text-[#0051c3] dark:text-blue-200'
                : 'bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 text-slate-800 dark:text-slate-100'
            }`}
            title="Accéder directement à la moyenne générale d'une classe"
          >
            <span className="flex items-center gap-2 truncate">
              <Award className="w-3.5 h-3.5 text-[#0051c3] dark:text-blue-400 shrink-0" />
              <span className="truncate">Moyenne générale</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          </button>
        ) : (
          <div className="space-y-1.5">
            <div className="px-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Moyenne générale
            </div>

            {annualAvgCard && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onOpenAverageCard(annualAvgCard, enteredClass);
                }}
                className="w-full h-8 px-2.5 rounded-md border border-slate-300 dark:border-slate-600 hover:border-[#0051c3] dark:hover:border-blue-400 bg-white dark:bg-[#161f33] hover:bg-[#eff6ff] dark:hover:bg-blue-500/20 text-slate-800 dark:text-slate-100 hover:text-[#0051c3] dark:hover:text-blue-200 text-[11.5px] font-semibold flex items-center justify-between gap-1.5 transition cursor-pointer"
                title="Ouvrir la Moyenne générale de l'année"
              >
                <span className="flex items-center gap-2 truncate">
                  <Award className="w-3.5 h-3.5 text-[#0051c3] dark:text-blue-400 shrink-0" />
                  <span className="truncate">Moyenne annuelle</span>
                </span>
                <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
              </button>
            )}

            {termAvgCards.length > 0 && (
              <div className="grid grid-cols-3 gap-1">
                {termAvgCards.map((card, idx) => {
                  const linkedTerm = classTerms.find((t) => t.id === card.termId);
                  const shortLabel = linkedTerm
                    ? `T${linkedTerm.number}`
                    : `T${idx + 1}`;
                  return (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => {
                        setIsMobileSidebarOpen(false);
                        onOpenAverageCard(card, enteredClass);
                      }}
                      className="h-7 px-1.5 rounded-md border border-slate-300 dark:border-slate-600 hover:border-[#0051c3] dark:hover:border-blue-400 bg-white dark:bg-[#161f33] hover:bg-[#eff6ff] dark:hover:bg-blue-500/20 text-slate-800 dark:text-slate-200 hover:text-[#0051c3] dark:hover:text-blue-200 text-[11px] font-semibold flex items-center justify-center transition cursor-pointer truncate"
                      title={card.title}
                    >
                      {shortLabel}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="border-t border-slate-300/80 dark:border-slate-700/80 pt-2">
          <button
            type="button"
            onClick={() => {
              setIsMobileSidebarOpen(false);
              if (isTransferViewOpen) onCloseTransfer();
              else onOpenTransfer();
            }}
            className={`w-full h-8 px-2.5 rounded-md border text-xs font-semibold flex items-center justify-between gap-2 transition cursor-pointer ${
              isTransferViewOpen
                ? 'bg-[#eff6ff] dark:bg-blue-500/20 border-[#0051c3] dark:border-blue-400 text-[#0051c3] dark:text-blue-200'
                : 'bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 text-slate-800 dark:text-slate-100'
            }`}
            title="Transférer niveaux, classes, matières ou listes d'élèves"
          >
            <span className="flex items-center gap-2 truncate">
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" />
              <span className="truncate">Transférer</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <main
      ref={boundaryRef}
      className="flex flex-1 w-full h-full min-h-0 bg-[#eef2f6] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 overflow-hidden"
    >
      {/* BARRE LATÉRALE DESKTOP (>= md) */}
      <aside className="hidden md:flex w-[228px] lg:w-[244px] shrink-0 flex-col border-r border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] h-full min-h-0 z-20">
        {renderSidebarContent()}
      </aside>

      {/* TIROIR LATÉRAL MOBILE (< md) */}
      {isMobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-slate-900/50 backdrop-blur-[1px]"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="w-[264px] max-w-[82vw] h-full bg-white dark:bg-[#111827] shadow-xl border-r border-slate-300 dark:border-slate-700"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZONE PRINCIPALE À DROITE (CLAIRE EN JOUR, SOMBRE EN NUIT, LIGNES NETTES) */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 overflow-hidden bg-[#eef2f6] dark:bg-[#0b1120]">
        {/* BARRE SUPÉRIEURE UNIFIÉE : MENU MOBILE + FIL D'ARIANE + STATUT + EXPAND */}
        <header className="h-12 bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-700 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden w-8 h-8 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#1e293b] hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
              aria-label="Ouvrir le menu latéral"
            >
              <Menu className="w-4 h-4" />
            </button>

            <nav
              className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden"
              aria-label="Fil d'Ariane"
            >
              <button
                type="button"
                onClick={onExitSchool}
                className="text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium truncate max-w-[90px] sm:max-w-none cursor-pointer"
              >
                {schoolYear?.label || 'Rentrées'}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  if (isTransferViewOpen) onCloseTransfer();
                  if (enteredClass) onExitClass();
                }}
                className={`truncate max-w-[110px] sm:max-w-[160px] cursor-pointer ${
                  !enteredClass && !activeLevel
                    ? 'text-slate-900 dark:text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                }`}
              >
                {school.name}
              </button>

              {activeLevel && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      if (isTransferViewOpen) onCloseTransfer();
                      if (enteredClass) onExitClass();
                    }}
                    className={`truncate max-w-[110px] sm:max-w-[150px] cursor-pointer ${
                      !enteredClass && !isTransferViewOpen
                        ? 'text-slate-900 dark:text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium'
                    }`}
                  >
                    {activeLevel.name}
                  </button>
                </>
              )}

              {enteredClass && !isTransferViewOpen && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  <span className="text-slate-900 dark:text-white font-bold truncate max-w-[140px] sm:max-w-[200px]">
                    {formatClassDisplayTitle(enteredClass)}
                  </span>
                </>
              )}

              {isTransferViewOpen && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 shrink-0" />
                  <span className="text-[#0051c3] dark:text-blue-400 font-bold truncate">
                    Transférer
                  </span>
                </>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border select-none ${
                saveUiState === 'saving' || cloudStatus === 'loading' || cloudStatus === 'syncing'
                  ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-500/40'
                  : saveUiState === 'saved'
                  ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                  : saveUiState === 'offline' || !isOnline || saveUiState === 'error' || cloudStatus === 'error'
                  ? 'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-300 dark:border-red-500/40'
                  : 'bg-slate-50 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
              }`}
              title={saveFeedbackMessage || 'Synchronisé avec votre compte'}
            >
              {saveUiState === 'saving' || cloudStatus === 'syncing' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700 dark:text-amber-300" />
                  <span>Enregistrement...</span>
                </>
              ) : cloudStatus === 'loading' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700 dark:text-amber-300" />
                  <span>Chargement de vos données...</span>
                </>
              ) : saveUiState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Enregistré</span>
                </>
              ) : saveUiState === 'offline' || !isOnline ? (
                <>
                  <WifiOff className="w-3 h-3 text-red-600 dark:text-red-400" />
                  <span>Hors ligne</span>
                </>
              ) : saveUiState === 'error' || cloudStatus === 'error' ? (
                <>
                  <CloudOff className="w-3 h-3 text-red-600 dark:text-red-400" />
                  <span>Erreur</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Synchronisé</span>
                </>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#1e293b]">
              <div className="w-5 h-5 rounded-full bg-slate-800 dark:bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">
                {(userName || 'P').charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 max-w-[100px] truncate">
                {userName || 'Professeur'}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 pl-1.5 border-l border-slate-300 dark:border-slate-700">
              <ViewerSuperExpandButton
                expandLevel={viewerExpandLevel}
                onExpandChange={onExpandChange}
              />
              <button
                type="button"
                onClick={onToggleMaximize}
                className={`w-7 h-7 rounded-md flex items-center justify-center border transition cursor-pointer ${
                  viewerExpandLevel >= 1 || isViewerMaximized
                    ? 'bg-[#0051c3] text-white border-[#0051c3]'
                    : 'bg-white dark:bg-[#1e293b] hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
                title={
                  viewerExpandLevel >= 1 || isViewerMaximized
                    ? 'Réduire la vue'
                    : "Agrandir l'espace"
                }
              >
                {viewerExpandLevel >= 1 || isViewerMaximized ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* CONTENU PRINCIPAL SELON LE MODE */}
        {isTransferViewOpen ? (
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="teacher-dark-scope max-w-5xl mx-auto">{renderTransferView()}</div>
          </div>
        ) : !enteredClass ? (
          /* ================================================================= */
          /* ÉCRAN B : INTÉRIEUR D'UNE ÉCOLE -> CLASSES DU NIVEAU ACTIF        */
          /* ================================================================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {levels.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center space-y-3 shadow-xs">
                  <div className="w-11 h-11 mx-auto rounded-lg bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Aucun niveau d'étude dans {school.name}
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                    Créez votre premier niveau d'étude (ex. 6ème, Terminale, BTS 2, Licence 2) dans la barre latérale pour organiser vos classes.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onAddLevel}
                      className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#0f172a] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 border border-slate-900 dark:border-blue-400/60 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Créer un niveau</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="shrink-0 bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-700 px-4 sm:px-8 py-3.5">
                  <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        {activeLevel?.name}
                      </h1>
                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                        {levelClasses.length} classe{levelClasses.length > 1 ? 's' : ''} enregistrée{levelClasses.length > 1 ? 's' : ''} — cliquez sur une classe pour ouvrir ses trimestres et matières.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="relative flex-1 sm:w-60">
                        <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={classSearch}
                          onChange={(e) => setClassSearch(e.target.value)}
                          placeholder="Rechercher une classe..."
                          className="w-full h-8 pl-8 pr-7 rounded-lg bg-slate-50 dark:bg-[#1e293b] focus:bg-white dark:focus:bg-[#161f33] border border-slate-300 dark:border-slate-600 focus:border-[#0051c3] dark:focus:border-blue-400 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition"
                        />
                        {classSearch && (
                          <button
                            type="button"
                            onClick={() => setClassSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={onAddClass}
                        className="h-8 px-3 rounded-lg bg-[#0f172a] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 border border-slate-900 dark:border-blue-400/60 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Nouvelle classe</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
                  <div className="max-w-6xl mx-auto">
                    {levelClasses.length === 0 ? (
                      <div className="bg-white dark:bg-[#131c2e] border border-dashed border-slate-400 dark:border-slate-600 rounded-xl p-10 text-center space-y-2.5">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                          Aucune classe dans {activeLevel?.name}
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                          Créez votre première classe pour commencer à gérer ses trimestres, ses matières et ses moyennes générales.
                        </p>
                        <button
                          type="button"
                          onClick={onAddClass}
                          className="mt-1 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-[#0f172a] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Créer une classe</span>
                        </button>
                      </div>
                    ) : filteredClasses.length === 0 ? (
                      <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                        Aucune classe ne correspond à « {classSearch} ».
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                        {filteredClasses.map((cls) => {
                          const subjCount = allSubjects.filter(
                            (s) => s.classId === cls.id
                          ).length;
                          const termCount = allTerms.filter(
                            (t) => t.classId === cls.id
                          ).length;
                          const accent = getSafeAccentColor(cls.color);
                          const isFull = isCustomCardColor(cls.color) && cls.colorStyle === 'full';

                          return (
                            <div
                              key={cls.id}
                              data-popover-avoid="true"
                              onClick={() => onEnterClass(cls)}
                              style={
                                isFull
                                  ? {
                                      backgroundColor: cls.color,
                                      color: cls.textColor || '#ffffff',
                                      borderColor: cls.borderDarkColor || cls.borderColor || cls.color,
                                    }
                                  : undefined
                              }
                              className={`group relative rounded-xl p-4 flex flex-col justify-between min-h-[126px] transition cursor-pointer overflow-hidden border shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-md ${
                                isFull
                                  ? 'hover:brightness-[1.04]'
                                  : 'bg-white dark:bg-[#131c2e] border-slate-300 dark:border-slate-600 hover:border-slate-500 dark:hover:border-blue-400'
                              }`}
                            >
                              {!isFull && (
                                <div
                                  className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                                  style={{ backgroundColor: accent }}
                                />
                              )}

                              <div className={`flex items-start justify-between gap-2 ${!isFull ? 'pl-1.5' : ''}`}>
                                <div className="min-w-0">
                                  <div
                                    className={`text-[10.5px] font-semibold uppercase tracking-wide truncate ${
                                      isFull
                                        ? 'text-white/80'
                                        : 'text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    {cls.level}
                                  </div>
                                  <h3
                                    className={`text-sm font-bold transition truncate mt-0.5 ${
                                      isFull
                                        ? 'text-white'
                                        : 'text-slate-900 dark:text-white group-hover:text-[#0051c3] dark:group-hover:text-blue-300'
                                    }`}
                                  >
                                    {formatClassDisplayTitle(cls)}
                                  </h3>
                                  {cls.teacherName?.trim() && (
                                    <div
                                      className={`text-[11px] truncate mt-0.5 ${
                                        isFull
                                          ? 'text-white/85'
                                          : 'text-slate-600 dark:text-slate-400'
                                      }`}
                                    >
                                      {cls.teacherName.trim()}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => onOpenMenu(e, 'class', cls)}
                                  className={`card-menu-trigger w-7 h-7 rounded-md border border-transparent flex items-center justify-center transition cursor-pointer shrink-0 ${
                                    isFull
                                      ? 'hover:border-white/30 hover:bg-black/20 text-white/80 hover:text-white'
                                      : 'hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                  }`}
                                  title={`Options de ${formatClassDisplayTitle(cls)}`}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </div>

                              <div
                                className={`mt-4 pt-2.5 border-t flex items-center justify-between text-[11px] ${
                                  !isFull ? 'pl-1.5 ' : ''
                                }${
                                  isFull
                                    ? 'border-white/25'
                                    : 'border-slate-200 dark:border-slate-700'
                                }`}
                              >
                                <div
                                  className={`flex items-center gap-2 font-medium ${
                                    isFull
                                      ? 'text-white/90'
                                      : 'text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span>{termCount} trim.</span>
                                  <span className={isFull ? 'text-white/60' : 'text-slate-400 dark:text-slate-600'}>•</span>
                                  <span>{subjCount} mat.</span>
                                </div>
                                <span
                                  className={`inline-flex items-center gap-1 font-semibold transition ${
                                    isFull
                                      ? 'text-white'
                                      : 'text-slate-700 dark:text-slate-200 group-hover:text-[#0051c3] dark:group-hover:text-blue-300'
                                  }`}
                                >
                                  <span>Ouvrir</span>
                                  <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          /* ================================================================= */
          /* ÉCRAN C : INTÉRIEUR D'UNE CLASSE                                  */
          /* Trimestres FIXES en haut | Matières défilent SOUS les trimestres  */
          /* ================================================================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <div className="shrink-0 bg-white dark:bg-[#111827] border-b border-slate-300 dark:border-slate-700 px-4 sm:px-8 pt-3.5 pb-3 z-10 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="max-w-6xl mx-auto space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                        {formatClassDisplayTitle(enteredClass)}
                      </h1>
                      <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-md">
                        {enteredClass.level}
                      </span>
                      {enteredClass.teacherName?.trim() && (
                        <span className="text-xs text-slate-600 dark:text-slate-400 hidden sm:inline truncate">
                          · {enteredClass.teacherName.trim()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        placeholder="Rechercher une matière..."
                        className="w-full h-8 pl-8 pr-7 rounded-lg bg-slate-50 dark:bg-[#1e293b] focus:bg-white dark:focus:bg-[#161f33] border border-slate-300 dark:border-slate-600 focus:border-[#0051c3] dark:focus:border-blue-400 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none transition"
                      />
                      {subjectSearch && (
                        <button
                          type="button"
                          onClick={() => setSubjectSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={onAddSubject}
                      disabled={!activeTerm}
                      className="h-8 px-3 rounded-lg bg-[#0f172a] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 border border-slate-900 dark:border-blue-400/60 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Nouvelle matière</span>
                    </button>
                  </div>
                </div>

                {/* Barre horizontale FIXE des Trimestres */}
                <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
                  {classTerms.map((term) => {
                    const isSelected = activeTerm?.id === term.id;
                    const hasCoeff =
                      term.coefficient !== undefined && term.coefficient !== null;
                    return (
                      <div
                        key={term.id}
                        data-popover-avoid="true"
                        onClick={() => onSelectTerm(term.id)}
                        className={`group shrink-0 h-8 pl-3 pr-1.5 rounded-lg border text-xs flex items-center gap-1.5 transition cursor-pointer ${
                          isSelected
                            ? 'bg-[#eff6ff] dark:bg-blue-500/20 border-[#0051c3] dark:border-blue-400 text-[#0051c3] dark:text-blue-200 font-semibold'
                            : 'bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-slate-800 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 text-slate-700 dark:text-slate-200 font-medium'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isSelected
                              ? 'bg-[#0051c3] dark:bg-blue-400'
                              : 'bg-slate-400 dark:bg-slate-500'
                          }`}
                        />
                        <span className="whitespace-nowrap">{term.name}</span>
                        {hasCoeff && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border whitespace-nowrap ${
                              isSelected
                                ? 'bg-white/90 dark:bg-blue-950/60 text-[#0051c3] dark:text-blue-200 border-blue-300 dark:border-blue-500/60'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                            }`}
                          >
                            Coeff {term.coefficient}
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={(e) => onOpenMenu(e, 'term', term)}
                          className={`card-menu-trigger w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                            isSelected
                              ? 'text-[#0051c3] dark:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-900/50'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                          title={`Options du ${term.name}`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  <button
                    ref={addTermBtnRef}
                    type="button"
                    onClick={onToggleAddTermPopover}
                    className="add-term-trigger shrink-0 h-8 px-2.5 rounded-lg border border-dashed border-slate-400 dark:border-slate-500 hover:border-slate-600 dark:hover:border-slate-300 bg-white dark:bg-[#161f33] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 transition cursor-pointer"
                    title={`Ajouter le Trimestre ${nextTermNumber}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Trimestre</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ZONE DÉFILABLE DES MATIÈRES */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6">
              <div className="max-w-6xl mx-auto">
                {!activeTerm ? (
                  <div className="bg-white dark:bg-[#131c2e] border border-dashed border-slate-400 dark:border-slate-600 rounded-xl p-10 text-center space-y-2.5">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Aucun trimestre dans cette classe
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Ajoutez un trimestre ci-dessus pour pouvoir créer vos matières.
                    </p>
                  </div>
                ) : termSubjects.length === 0 ? (
                  <div className="bg-white dark:bg-[#131c2e] border border-dashed border-slate-400 dark:border-slate-600 rounded-xl p-10 text-center space-y-2.5">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 dark:bg-[#1e293b] border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-300">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Aucune matière dans {activeTerm.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 max-w-sm mx-auto">
                      Créez les matières de ce trimestre (avec leur coefficient facultatif) pour saisir vos notes et calculer automatiquement les moyennes.
                    </p>
                    <button
                      type="button"
                      onClick={onAddSubject}
                      className="mt-1 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-[#0f172a] hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Ajouter une matière</span>
                    </button>
                  </div>
                ) : filteredSubjects.length === 0 ? (
                  <div className="bg-white dark:bg-[#131c2e] border border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center text-xs font-medium text-slate-600 dark:text-slate-400">
                    Aucune matière ne correspond à « {subjectSearch} ».
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      <span>
                        Matières · {activeTerm.name} ({filteredSubjects.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {filteredSubjects.map((subject) => {
                        const accent = getSafeAccentColor(subject.color);
                        const isFull = isCustomCardColor(subject.color) && subject.colorStyle === 'full';
                        const statKey = `${subject.id}__${activeTerm.id || 't1'}`;
                        const gbStat = serverGradebookStats?.[statKey];
                        const hasCoeff =
                          subject.coefficient !== undefined &&
                          subject.coefficient !== null;

                        return (
                          <div
                            key={subject.id}
                            data-popover-avoid="true"
                            onClick={() => onOpenSubject(subject)}
                            style={
                              isFull
                                ? {
                                    backgroundColor: subject.color,
                                    color: subject.textColor || '#ffffff',
                                    borderColor: subject.borderDarkColor || subject.borderColor || subject.color,
                                  }
                                : undefined
                            }
                            className={`group relative rounded-xl p-4 flex flex-col justify-between min-h-[116px] transition cursor-pointer overflow-hidden border shadow-[0_1px_2px_rgba(15,23,42,0.05)] hover:shadow-md ${
                              isFull
                                ? 'hover:brightness-[1.04]'
                                : 'bg-white dark:bg-[#131c2e] border-slate-300 dark:border-slate-600 hover:border-slate-500 dark:hover:border-blue-400'
                            }`}
                          >
                            {!isFull && (
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[3.5px]"
                                style={{ backgroundColor: accent }}
                              />
                            )}

                            <div className={`flex items-start justify-between gap-2 ${!isFull ? 'pl-1.5' : ''}`}>
                              <div className="min-w-0">
                                <h3
                                  className={`text-sm font-bold transition line-clamp-2 leading-snug ${
                                    isFull
                                      ? 'text-white'
                                      : 'text-slate-900 dark:text-white group-hover:text-[#0051c3] dark:group-hover:text-blue-300'
                                  }`}
                                >
                                  {subject.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {hasCoeff ? (
                                    <span
                                      className={`text-[10.5px] font-semibold px-1.5 py-0.2 rounded border ${
                                        isFull
                                          ? 'bg-black/25 text-white border-white/25'
                                          : 'bg-slate-100 dark:bg-[#1e293b] text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                                      }`}
                                    >
                                      Coeff {subject.coefficient}
                                    </span>
                                  ) : (
                                    <span
                                      className={`text-[10.5px] font-medium ${
                                        isFull
                                          ? 'text-white/80'
                                          : 'text-slate-500 dark:text-slate-400'
                                      }`}
                                    >
                                      Sans coefficient
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => onOpenMenu(e, 'subject', subject)}
                                className={`card-menu-trigger w-7 h-7 rounded-md border border-transparent flex items-center justify-center transition cursor-pointer shrink-0 ${
                                  isFull
                                    ? 'hover:border-white/30 hover:bg-black/20 text-white/80 hover:text-white'
                                    : 'hover:border-slate-300 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                                }`}
                                title={`Options de ${subject.name}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>

                            <div
                              className={`mt-3.5 pt-2.5 border-t flex items-center justify-between text-[11px] ${
                                !isFull ? 'pl-1.5 ' : ''
                              }${
                                isFull
                                  ? 'border-white/25'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <span
                                className={`font-medium truncate ${
                                  isFull
                                    ? 'text-white/90'
                                    : 'text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {gbStat && gbStat.namedStudentsCount > 0
                                  ? `${gbStat.namedStudentsCount} élève${
                                      gbStat.namedStudentsCount > 1 ? 's' : ''
                                    }`
                                  : 'Tableur de notes'}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 font-semibold transition shrink-0 ${
                                  isFull
                                    ? 'text-white'
                                    : 'text-slate-700 dark:text-slate-200 group-hover:text-[#0051c3] dark:group-hover:text-blue-300'
                                }`}
                              >
                                <span>Notes</span>
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* POPOVER RAPIDE "MOYENNE GÉNÉRALE" DEPUIS LA BARRE LATÉRALE DE L'ÉCOLE */}
      <SmartFloatingPopover
        open={isSchoolAvgMenuOpen && !enteredClass}
        anchorEl={schoolAvgBtnRef.current}
        boundaryEl={boundaryRef.current}
        preferredSide="right"
        preferredAlign="end"
        gap={8}
        onClose={() => setIsSchoolAvgMenuOpen(false)}
        dataPopoverId="school-sidebar-averages-popover"
        className="w-72 rounded-xl"
      >
        <div className="bg-white dark:bg-[#111827] rounded-xl border border-slate-300 dark:border-slate-600 shadow-xl overflow-hidden text-slate-800 dark:text-slate-100 select-none">
          <div className="px-3 py-2 bg-slate-50 dark:bg-[#0d1424] border-b border-slate-300 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
              <FolderKanban className="w-3.5 h-3.5 text-[#0051c3] dark:text-blue-400" />
              <span>Moyennes · {activeLevel?.name || 'Classes'}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSchoolAvgMenuOpen(false)}
              className="w-5 h-5 rounded hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-300 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-200 dark:divide-slate-700 p-1.5">
            {levelClasses.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                Aucune classe dans ce niveau.
              </div>
            ) : (
              levelClasses.map((cls) => {
                const cards = getAverageCardsForClass(cls);
                const annual = cards.find((c) => c.kind === 'annual');
                const tCards = cards.filter((c) => c.kind === 'term');
                return (
                  <div key={cls.id} className="py-2 px-1.5 space-y-1.5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {formatClassDisplayTitle(cls)}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {annual && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSchoolAvgMenuOpen(false);
                            onOpenAverageCard(annual, cls);
                          }}
                          className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:border-[#0051c3] dark:hover:border-blue-400 bg-slate-50 dark:bg-[#1e293b] hover:bg-[#eff6ff] dark:hover:bg-blue-500/20 text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:text-[#0051c3] dark:hover:text-blue-200 transition cursor-pointer"
                        >
                          Annuelle
                        </button>
                      )}
                      {tCards.map((tc, i) => {
                        const lt = allTerms.find((t) => t.id === tc.termId);
                        return (
                          <button
                            key={tc.id}
                            type="button"
                            onClick={() => {
                              setIsSchoolAvgMenuOpen(false);
                              onOpenAverageCard(tc, cls);
                            }}
                            className="px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 hover:border-[#0051c3] dark:hover:border-blue-400 bg-white dark:bg-[#161f33] hover:bg-[#eff6ff] dark:hover:bg-blue-500/20 text-[11px] font-semibold text-slate-800 dark:text-slate-100 hover:text-[#0051c3] dark:hover:text-blue-200 transition cursor-pointer"
                            title={tc.title}
                          >
                            {lt ? `T${lt.number}` : `T${i + 1}`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </SmartFloatingPopover>
    </main>
  );
};
