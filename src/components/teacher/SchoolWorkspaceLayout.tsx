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

const getSafeAccentColor = (rawColor?: string): string => {
  if (!rawColor) return '#0051c3';
  const low = rawColor.trim().toLowerCase();
  if (low === '#ffffff' || low === 'white' || low === '#f8fafc' || low === '#f1f5f9') {
    return '#94a3b8';
  }
  return rawColor;
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

  // Cartes de moyenne générale pour la classe active (mode Classe)
  const annualAvgCard = currentClassAverageCards.find((c) => c.kind === 'annual') || null;
  const termAvgCards = currentClassAverageCards.filter((c) => c.kind === 'term');

  // Helper pour construire les cartes d'une classe donnée (utilisé dans le menu rapide de l'École)
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
  // BARRE LATÉRALE GAUCHE (STYLE LOGICIEL PRO ÉPURÉ — IMAGE 2 CLOUDFLARE)
  // - Mode École  : Liste verticale des Niveaux + Bas fixe (Moyenne générale + Transférer)
  // - Mode Classe : Liste verticale des Classes + Bas fixe (Moyenne annuelle + T1..TN + Transférer)
  // ============================================================================
  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white text-slate-800 select-none">
      {/* HAUT DE LA BARRE LATÉRALE (FIXE) */}
      <div className="px-3 pt-3 pb-2.5 border-b border-slate-200 shrink-0 space-y-2">
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
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-900 transition cursor-pointer"
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
          <div className="w-7 h-7 rounded-md border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt={school.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-[11px] font-bold text-slate-700">
                {school.name.slice(0, 2).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-bold text-slate-900 truncate leading-tight">
              {school.name}
            </div>
            <div className="text-[10.5px] text-slate-500 truncate leading-tight mt-0.5">
              {enteredClass
                ? `${activeLevel?.name || ''} · ${schoolYear?.label || ''}`
                : schoolYear?.label || 'Année scolaire'}
            </div>
          </div>
          {/* Bouton fermer sur mobile uniquement */}
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="md:hidden w-7 h-7 rounded-md hover:bg-slate-100 flex items-center justify-center text-slate-500 cursor-pointer shrink-0"
            aria-label="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* MILIEU DÉFILABLE : NIVEAUX (EN MODE ÉCOLE) OU CLASSES (EN MODE CLASSE) */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
        {!enteredClass ? (
          <>
            <div className="px-2 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Niveaux ({levels.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onAddLevel();
                }}
                className="w-5 h-5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
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
                className="w-full px-2.5 py-2 rounded-md border border-dashed border-slate-300 hover:border-slate-400 bg-slate-50/70 hover:bg-slate-100/70 text-[11.5px] font-medium text-slate-600 flex items-center gap-2 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
                <span>Créer un niveau</span>
              </button>
            ) : (
              levels.map((lvl) => {
                const isSelected = activeLevel?.id === lvl.id && !isTransferViewOpen;
                const count = allSchoolClasses.filter((c) => c.levelId === lvl.id).length;
                return (
                  <div
                    key={lvl.id}
                    data-popover-avoid="true"
                    onClick={() => {
                      if (isTransferViewOpen) onCloseTransfer();
                      onSelectLevel(lvl.id);
                      setIsMobileSidebarOpen(false);
                    }}
                    className={`group relative flex items-center justify-between gap-1.5 px-2.5 h-8 rounded-md text-xs transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#eff6ff] text-[#0051c3] font-semibold'
                        : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r bg-[#0051c3]" />
                    )}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Layers
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-[#0051c3]' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{lvl.name}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                          isSelected
                            ? 'bg-blue-100/90 text-[#0051c3]'
                            : 'text-slate-400 group-hover:text-slate-600'
                        }`}
                      >
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => onOpenMenu(e, 'level', lvl)}
                        className={`card-menu-trigger w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                          isSelected
                            ? 'text-[#0051c3]/70 hover:text-[#0051c3] hover:bg-blue-100'
                            : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70'
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
            <div className="px-2 pb-1 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate">
                Classes ({levelClasses.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onAddClass();
                }}
                className="w-5 h-5 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 flex items-center justify-center transition cursor-pointer"
                title="Ajouter une classe dans ce niveau"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>

            {levelClasses.map((cls) => {
              const isSelected = enteredClass.id === cls.id && !isTransferViewOpen;
              const subjCount = allSubjects.filter((s) => s.classId === cls.id).length;
              return (
                <div
                  key={cls.id}
                  data-popover-avoid="true"
                  onClick={() => {
                    if (isTransferViewOpen) onCloseTransfer();
                    onEnterClass(cls);
                    setIsMobileSidebarOpen(false);
                  }}
                  className={`group relative flex items-center justify-between gap-1.5 px-2.5 h-8 rounded-md text-xs transition cursor-pointer ${
                    isSelected
                      ? 'bg-[#eff6ff] text-[#0051c3] font-semibold'
                      : 'text-slate-700 hover:bg-slate-100/90 hover:text-slate-900 font-medium'
                  }`}
                >
                  {isSelected && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-r bg-[#0051c3]" />
                  )}
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <GraduationCap
                      className={`w-3.5 h-3.5 shrink-0 ${
                        isSelected ? 'text-[#0051c3]' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{formatClassDisplayTitle(cls)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                        isSelected
                          ? 'bg-blue-100/90 text-[#0051c3]'
                          : 'text-slate-400 group-hover:text-slate-600'
                      }`}
                    >
                      {subjCount}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => onOpenMenu(e, 'class', cls)}
                      className={`card-menu-trigger w-5 h-5 rounded flex items-center justify-center transition cursor-pointer ${
                        isSelected
                          ? 'text-[#0051c3]/70 hover:text-[#0051c3] hover:bg-blue-100'
                          : 'opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70'
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
      {/* BAS FIXE DE LA BARRE LATÉRALE (NE DÉFILE JAMAIS)                      */}
      {/* Présent dans les DEUX menus (École & Classe) : Moyenne générale + Transférer */}
      {/* ===================================================================== */}
      <div className="shrink-0 border-t border-slate-200 bg-[#fbfcfd] px-2.5 py-2.5 space-y-2">
        {!enteredClass ? (
          /* Mode École : Bouton compact "Moyenne générale ▸" qui ouvre l'accès rapide aux classes */
          <button
            ref={schoolAvgBtnRef}
            type="button"
            onClick={() => setIsSchoolAvgMenuOpen((prev) => !prev)}
            disabled={levelClasses.length === 0}
            className={`w-full h-8 px-2.5 rounded-md border text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed ${
              isSchoolAvgMenuOpen
                ? 'bg-[#eff6ff] border-blue-300 text-[#0051c3] font-semibold'
                : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
            }`}
            title="Accéder directement à la moyenne générale d'une classe"
          >
            <span className="flex items-center gap-2 truncate">
              <Award className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span className="truncate">Moyenne générale</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          </button>
        ) : (
          /* Mode Classe : Bloc fixe ultra-compact (Moyenne annuelle + grille compacte T1, T2, T3...) */
          <div className="space-y-1.5">
            <div className="px-1 text-[9.5px] font-bold uppercase tracking-wider text-slate-400">
              Moyenne générale
            </div>

            {annualAvgCard && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileSidebarOpen(false);
                  onOpenAverageCard(annualAvgCard, enteredClass);
                }}
                className="w-full h-8 px-2.5 rounded-md border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-[11.5px] font-semibold flex items-center justify-between gap-1.5 transition cursor-pointer"
                title="Ouvrir la Moyenne générale de l'année"
              >
                <span className="flex items-center gap-2 truncate">
                  <Award className="w-3.5 h-3.5 text-[#0051c3] shrink-0" />
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
                      className="h-7 px-1.5 rounded-md border border-slate-200 hover:border-[#0051c3]/50 bg-white hover:bg-[#eff6ff] text-slate-700 hover:text-[#0051c3] text-[11px] font-semibold flex items-center justify-center transition cursor-pointer truncate"
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

        {/* Bouton Transférer fixe tout en bas dans les deux menus */}
        <button
          type="button"
          onClick={() => {
            setIsMobileSidebarOpen(false);
            if (isTransferViewOpen) onCloseTransfer();
            else onOpenTransfer();
          }}
          className={`w-full h-8 px-2.5 rounded-md border text-xs font-medium flex items-center justify-between gap-2 transition cursor-pointer ${
            isTransferViewOpen
              ? 'bg-[#eff6ff] border-blue-300 text-[#0051c3] font-semibold'
              : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
          title="Transférer niveaux, classes, matières ou listes d'élèves"
        >
          <span className="flex items-center gap-2 truncate">
            <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">Transférer</span>
          </span>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        </button>
      </div>
    </div>
  );

  return (
    <main
      ref={boundaryRef}
      className="flex flex-1 w-full h-full min-h-dvh bg-[#f8fafc] text-slate-900 overflow-hidden"
    >
      {/* BARRE LATÉRALE DESKTOP (>= md) */}
      <aside className="hidden md:flex w-[240px] lg:w-[252px] shrink-0 flex-col border-r border-slate-200 bg-white h-full z-20">
        {renderSidebarContent()}
      </aside>

      {/* TIROIR LATÉRAL MOBILE (< md) */}
      {isMobileSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-slate-900/40 backdrop-blur-[1px]"
          onClick={() => setIsMobileSidebarOpen(false)}
        >
          <div
            className="w-[264px] max-w-[82vw] h-full bg-white shadow-xl border-r border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ZONE PRINCIPALE À DROITE (FOND CLAIR NEUTRE, SANS ANIMATION 3D)       */}
      {/* ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#f8fafc]">
        {/* BARRE SUPÉRIEURE UNIFIÉE : MENU MOBILE + FIL D'ARIANE + STATUT + EXPAND */}
        <header className="h-12 bg-white border-b border-slate-200 px-3 sm:px-6 flex items-center justify-between gap-2 shrink-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden w-8 h-8 rounded-md border border-slate-200 hover:bg-slate-50 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
              aria-label="Ouvrir le menu latéral"
            >
              <Menu className="w-4 h-4" />
            </button>

            {/* Fil d'Ariane cliquable (style Cloudflare Dashboard) */}
            <nav
              className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden"
              aria-label="Fil d'Ariane"
            >
              <button
                type="button"
                onClick={onExitSchool}
                className="text-slate-500 hover:text-slate-900 font-medium truncate max-w-[90px] sm:max-w-none cursor-pointer"
              >
                {schoolYear?.label || 'Rentrées'}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
              <button
                type="button"
                onClick={() => {
                  if (isTransferViewOpen) onCloseTransfer();
                  if (enteredClass) onExitClass();
                }}
                className={`truncate max-w-[110px] sm:max-w-[160px] cursor-pointer ${
                  !enteredClass && !activeLevel
                    ? 'text-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-900 font-medium'
                }`}
              >
                {school.name}
              </button>

              {activeLevel && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <button
                    type="button"
                    onClick={() => {
                      if (isTransferViewOpen) onCloseTransfer();
                      if (enteredClass) onExitClass();
                    }}
                    className={`truncate max-w-[110px] sm:max-w-[150px] cursor-pointer ${
                      !enteredClass && !isTransferViewOpen
                        ? 'text-slate-900 font-semibold'
                        : 'text-slate-500 hover:text-slate-900 font-medium'
                    }`}
                  >
                    {activeLevel.name}
                  </button>
                </>
              )}

              {enteredClass && !isTransferViewOpen && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-slate-900 font-semibold truncate max-w-[140px] sm:max-w-[200px]">
                    {formatClassDisplayTitle(enteredClass)}
                  </span>
                </>
              )}

              {isTransferViewOpen && (
                <>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                  <span className="text-[#0051c3] font-semibold truncate">
                    Transférer
                  </span>
                </>
              )}
            </nav>
          </div>

          {/* Contrôles droite : Statut synchronisation sobre + Profil + Agrandir */}
          <div className="flex items-center gap-2 shrink-0">
            <div
              className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border select-none ${
                saveUiState === 'saving' || cloudStatus === 'loading'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : saveUiState === 'saved'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : saveUiState === 'offline' || !isOnline || saveUiState === 'error' || cloudStatus === 'error'
                  ? 'bg-red-50 text-red-700 border-red-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
              title={saveFeedbackMessage || 'Synchronisé avec votre compte'}
            >
              {saveUiState === 'saving' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                  <span>Enregistrement...</span>
                </>
              ) : cloudStatus === 'loading' ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-700" />
                  <span>Chargement de vos données...</span>
                </>
              ) : saveUiState === 'saved' ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Enregistré</span>
                </>
              ) : saveUiState === 'offline' || !isOnline ? (
                <>
                  <WifiOff className="w-3 h-3 text-red-600" />
                  <span>Hors ligne</span>
                </>
              ) : saveUiState === 'error' || cloudStatus === 'error' ? (
                <>
                  <CloudOff className="w-3 h-3 text-red-600" />
                  <span>Erreur</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Synchronisé</span>
                </>
              )}
            </div>

            <div className="hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-md border border-slate-200 bg-slate-50/70">
              <div className="w-5 h-5 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-[10px]">
                {(userName || 'P').charAt(0).toUpperCase()}
              </div>
              <span className="text-[11px] font-semibold text-slate-700 max-w-[100px] truncate">
                {userName || 'Professeur'}
              </span>
            </div>

            <div className="hidden md:flex items-center gap-1.5 pl-1 border-l border-slate-200">
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
                    : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
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
          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-5xl mx-auto">{renderTransferView()}</div>
          </div>
        ) : !enteredClass ? (
          /* ================================================================= */
          /* ÉCRAN B : INTÉRIEUR D'UNE ÉCOLE -> CLASSES DU NIVEAU ACTIF        */
          /* ================================================================= */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {levels.length === 0 ? (
              <div className="flex-1 flex items-center justify-center p-6">
                <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-8 text-center space-y-3">
                  <div className="w-11 h-11 mx-auto rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h2 className="text-base font-bold text-slate-900">
                    Aucun niveau d'étude dans {school.name}
                  </h2>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Créez votre premier niveau d'étude (ex. 6ème, Terminale, BTS 2, Licence 2) dans la barre latérale pour organiser vos classes.
                  </p>
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={onAddLevel}
                      className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Créer un niveau</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* En-tête fixe de la page Classes (recherche + bouton Nouvelle classe) */}
                <div className="shrink-0 bg-[#f8fafc] border-b border-slate-200/80 px-4 sm:px-8 py-4">
                  <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                        {activeLevel?.name}
                      </h1>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {levelClasses.length} classe{levelClasses.length > 1 ? 's' : ''} enregistrée{levelClasses.length > 1 ? 's' : ''} — cliquez sur une classe pour ouvrir ses trimestres et matières.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      <div className="relative flex-1 sm:w-60">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={classSearch}
                          onChange={(e) => setClassSearch(e.target.value)}
                          placeholder="Rechercher une classe..."
                          className="w-full h-8 pl-8 pr-7 rounded-lg bg-white border border-slate-200 focus:border-[#0051c3] text-xs text-slate-800 placeholder:text-slate-400 outline-none transition"
                        />
                        {classSearch && (
                          <button
                            type="button"
                            onClick={() => setClassSearch('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={onAddClass}
                        className="h-8 px-3 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Nouvelle classe</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Grille des classes : horizontale, retour automatique à la ligne, défilement vertical */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
                  <div className="max-w-6xl mx-auto">
                    {levelClasses.length === 0 ? (
                      <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-2.5">
                        <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                          <GraduationCap className="w-5 h-5" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Aucune classe dans {activeLevel?.name}
                        </h3>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Créez votre première classe pour commencer à gérer ses trimestres, ses matières et ses moyennes générales.
                        </p>
                        <button
                          type="button"
                          onClick={onAddClass}
                          className="mt-1 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Créer une classe</span>
                        </button>
                      </div>
                    ) : filteredClasses.length === 0 ? (
                      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs font-medium text-slate-500">
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

                          return (
                            <div
                              key={cls.id}
                              data-popover-avoid="true"
                              onClick={() => onEnterClass(cls)}
                              className="group relative bg-white hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between min-h-[126px] transition cursor-pointer overflow-hidden hover:shadow-xs"
                            >
                              {/* Fin repère de couleur discret (3px) — sans effet 3D ni surcharge */}
                              <div
                                className="absolute left-0 top-0 bottom-0 w-[3px]"
                                style={{ backgroundColor: accent }}
                              />

                              <div className="flex items-start justify-between gap-2 pl-1">
                                <div className="min-w-0">
                                  <div className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-wide truncate">
                                    {cls.level}
                                  </div>
                                  <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0051c3] transition truncate mt-0.5">
                                    {formatClassDisplayTitle(cls)}
                                  </h3>
                                  {cls.teacherName?.trim() && (
                                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                      {cls.teacherName.trim()}
                                    </div>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={(e) => onOpenMenu(e, 'class', cls)}
                                  className="card-menu-trigger w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                                  title={`Options de ${formatClassDisplayTitle(cls)}`}
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>
                              </div>

                              <div className="mt-4 pt-2.5 border-t border-slate-100 pl-1 flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-2 text-slate-500 font-medium">
                                  <span>
                                    {termCount} trim.
                                  </span>
                                  <span className="text-slate-300">•</span>
                                  <span>
                                    {subjCount} mat.
                                  </span>
                                </div>
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-600 group-hover:text-[#0051c3] transition">
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
            {/* BANDEAU FIXE EN HAUT : EN-TÊTE CLASSE + BARRE HORIZONTALE DES TRIMESTRES */}
            <div className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-8 pt-4 pb-3 z-10 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
              <div className="max-w-6xl mx-auto space-y-3">
                {/* Ligne 1 : Titre de la classe + Recherche matière + Bouton + Matière */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                        {formatClassDisplayTitle(enteredClass)}
                      </h1>
                      <span className="text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-md">
                        {enteredClass.level}
                      </span>
                      {enteredClass.teacherName?.trim() && (
                        <span className="text-xs text-slate-500 hidden sm:inline truncate">
                          · {enteredClass.teacherName.trim()}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        placeholder="Rechercher une matière..."
                        className="w-full h-8 pl-8 pr-7 rounded-lg bg-[#f8fafc] focus:bg-white border border-slate-200 focus:border-[#0051c3] text-xs text-slate-800 placeholder:text-slate-400 outline-none transition"
                      />
                      {subjectSearch && (
                        <button
                          type="button"
                          onClick={() => setSubjectSearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={onAddSubject}
                      disabled={!activeTerm}
                      className="h-8 px-3 rounded-lg bg-[#0f172a] hover:bg-slate-800 disabled:opacity-45 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Nouvelle matière</span>
                    </button>
                  </div>
                </div>

                {/* Ligne 2 : Barre horizontale FIXE des Trimestres (ne bouge pas quand les matières défilent) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
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
                            ? 'bg-[#eff6ff] border-[#0051c3] text-[#0051c3] font-semibold'
                            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 text-slate-700 font-medium'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            isSelected ? 'bg-[#0051c3]' : 'bg-slate-300'
                          }`}
                        />
                        <span className="whitespace-nowrap">{term.name}</span>
                        {hasCoeff && (
                          <span
                            className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border whitespace-nowrap ${
                              isSelected
                                ? 'bg-white/80 text-[#0051c3] border-blue-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
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
                              ? 'text-[#0051c3]/70 hover:text-[#0051c3] hover:bg-blue-100'
                              : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                          }`}
                          title={`Options du ${term.name}`}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}

                  {/* Bouton plat "+ Trimestre" (connecté au popover existant avec coefficient facultatif) */}
                  <button
                    ref={addTermBtnRef}
                    type="button"
                    onClick={onToggleAddTermPopover}
                    className="add-term-trigger shrink-0 h-8 px-2.5 rounded-lg border border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 text-xs font-medium inline-flex items-center gap-1 transition cursor-pointer"
                    title={`Ajouter le Trimestre ${nextTermNumber}`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Trimestre</span>
                  </button>
                </div>
              </div>
            </div>

            {/* ZONE DÉFILABLE DES MATIÈRES (PASSE SOUS LES TRIMESTRES QUI RESTENT FIXES) */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
              <div className="max-w-6xl mx-auto">
                {!activeTerm ? (
                  <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-2.5">
                    <h3 className="text-sm font-bold text-slate-900">
                      Aucun trimestre dans cette classe
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ajoutez un trimestre ci-dessus pour pouvoir créer vos matières.
                    </p>
                  </div>
                ) : termSubjects.length === 0 ? (
                  <div className="bg-white border border-dashed border-slate-300 rounded-xl p-10 text-center space-y-2.5">
                    <div className="w-10 h-10 mx-auto rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Aucune matière dans {activeTerm.name}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Créez les matières de ce trimestre (avec leur coefficient facultatif) pour saisir vos notes et calculer automatiquement les moyennes.
                    </p>
                    <button
                      type="button"
                      onClick={onAddSubject}
                      className="mt-1 inline-flex items-center gap-1.5 px-3.5 h-8 rounded-lg bg-[#0f172a] hover:bg-slate-800 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Ajouter une matière</span>
                    </button>
                  </div>
                ) : filteredSubjects.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs font-medium text-slate-500">
                    Aucune matière ne correspond à « {subjectSearch} ».
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
                      <span>
                        Matières · {activeTerm.name} ({filteredSubjects.length})
                      </span>
                    </div>

                    {/* Grille horizontale avec retour automatique à la ligne & défilement vertical illimité */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                      {filteredSubjects.map((subject) => {
                        const accent = getSafeAccentColor(subject.color);
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
                            className="group relative bg-white hover:bg-white border border-slate-200 hover:border-slate-300 rounded-xl p-4 flex flex-col justify-between min-h-[116px] transition cursor-pointer overflow-hidden hover:shadow-xs"
                          >
                            {/* Repère de couleur ultra-sobre de 3px (respecte les couleurs existantes sans surcharge) */}
                            <div
                              className="absolute left-0 top-0 bottom-0 w-[3px]"
                              style={{ backgroundColor: accent }}
                            />

                            <div className="flex items-start justify-between gap-2 pl-1">
                              <div className="min-w-0">
                                <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#0051c3] transition line-clamp-2 leading-snug">
                                  {subject.name}
                                </h3>
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {hasCoeff ? (
                                    <span className="text-[10.5px] font-semibold px-1.5 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                      Coeff {subject.coefficient}
                                    </span>
                                  ) : (
                                    <span className="text-[10.5px] font-medium text-slate-400">
                                      Sans coefficient
                                    </span>
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => onOpenMenu(e, 'subject', subject)}
                                className="card-menu-trigger w-7 h-7 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-800 flex items-center justify-center transition cursor-pointer shrink-0"
                                title={`Options de ${subject.name}`}
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="mt-3.5 pt-2.5 border-t border-slate-100 pl-1 flex items-center justify-between text-[11px]">
                              <span className="text-slate-500 font-medium truncate">
                                {gbStat && gbStat.namedStudentsCount > 0
                                  ? `${gbStat.namedStudentsCount} élève${
                                      gbStat.namedStudentsCount > 1 ? 's' : ''
                                    }`
                                  : 'Tableur de notes'}
                              </span>
                              <span className="inline-flex items-center gap-1 font-semibold text-slate-600 group-hover:text-[#0051c3] transition shrink-0">
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

      {/* ===================================================================== */}
      {/* POPOVER RAPIDE "MOYENNE GÉNÉRALE" DEPUIS LA BARRE LATÉRALE DE L'ÉCOLE */}
      {/* ===================================================================== */}
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden text-slate-800 select-none">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <FolderKanban className="w-3.5 h-3.5 text-[#0051c3]" />
              <span>Moyennes · {activeLevel?.name || 'Classes'}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSchoolAvgMenuOpen(false)}
              className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-500 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 p-1.5">
            {levelClasses.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                Aucune classe dans ce niveau.
              </div>
            ) : (
              levelClasses.map((cls) => {
                const cards = getAverageCardsForClass(cls);
                const annual = cards.find((c) => c.kind === 'annual');
                const tCards = cards.filter((c) => c.kind === 'term');
                return (
                  <div key={cls.id} className="py-2 px-1.5 space-y-1.5">
                    <div className="text-xs font-bold text-slate-800 truncate">
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
                          className="px-2 py-1 rounded-md border border-slate-200 hover:border-[#0051c3] bg-slate-50 hover:bg-[#eff6ff] text-[11px] font-semibold text-slate-700 hover:text-[#0051c3] transition cursor-pointer"
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
                            className="px-2 py-1 rounded-md border border-slate-200 hover:border-[#0051c3] bg-white hover:bg-[#eff6ff] text-[11px] font-semibold text-slate-700 hover:text-[#0051c3] transition cursor-pointer"
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
