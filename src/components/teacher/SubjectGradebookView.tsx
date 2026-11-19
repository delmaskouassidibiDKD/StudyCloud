import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Maximize2,
  Minimize2,
  Paintbrush,
  Scissors,
  Copy,
  Clipboard,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Grid3X3,
  PaintBucket,
  Type,
  AlignLeft,
  AlignCenter,
  AlignRight,
  WrapText,
  Sigma,
  Plus,
  Minus,
  Search,
  Download,
  Save,
  Check,
  ChevronDown
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { SubjectItem, ClassItem, SchoolItem, SchoolYearItem, TermItem } from './TeacherClassesView';
import { ViewerSuperExpandButton } from '../ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../../utils/viewerExpandManager';

interface SubjectGradebookViewProps {
  subject: SubjectItem;
  schoolClass: ClassItem;
  schoolYear?: SchoolYearItem | null;
  school?: SchoolItem | null;
  term?: TermItem | null;
  onBack: () => void;
}

// Générateur des lettres de colonnes Excel : A, B, C ... Z, AA, AB, AC ...
const getColumnLabel = (index: number): string => {
  let label = '';
  let num = index;
  while (num >= 0) {
    label = String.fromCharCode((num % 26) + 65) + label;
    num = Math.floor(num / 26) - 1;
  }
  return label;
};

// 30 colonnes (A à AD)
const TOTAL_COLUMNS = 30;
// 45 lignes (1 à 45)
const TOTAL_ROWS = 45;

export const SubjectGradebookView: React.FC<SubjectGradebookViewProps> = ({
  subject,
  schoolClass,
  schoolYear,
  school,
  term,
  onBack,
}) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // Clé de persistance pour les notes de cette matière et ce trimestre
  const storageKey = `studycloud_gradebook_${subject.id}_${term?.id || 't1'}`;

  // Initialisation des données du tableur (Entièrement vierge, aucune valeur pré-enregistrée)
  const [gridData, setGridData] = useState<string[][]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Si les données sauvegardées contiennent encore les anciens CP-1 ou N°, on les purge
        if (Array.isArray(parsed) && parsed.length > 0) {
          const hasOldDefaults = parsed.some((r: any) =>
            Array.isArray(r) && r.some((v: any) => typeof v === 'string' && (v.includes('CP-') || v === 'N°' || v === 'MATRICULE'))
          );
          if (!hasOldDefaults) return parsed;
        }
      }
    } catch { }

    // Grille 100% vierge sans aucune valeur pré-enregistrée (sans CP-1, sans N°, sans 1, 2, 3)
    return Array.from({ length: TOTAL_ROWS }, () =>
      Array.from({ length: TOTAL_COLUMNS }, () => '')
    );
  });

  // Nettoyage immédiat au montage si l'ancienne clé contenait les valeurs pré-enregistrées
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && (saved.includes('CP-') || saved.includes('MATRICULE') || saved.includes('N°'))) {
        localStorage.removeItem(storageKey);
      }
    } catch { }
  }, [storageKey]);

  // Cellule active : initialisée sur la première cellule
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [editingCell, setEditingCell] = useState<{ r: number; c: number } | null>(null);
  const [formulaValue, setFormulaValue] = useState<string>('');
  const [editInputVal, setEditInputVal] = useState<string>('');

  // Styles de formatage
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrikethrough, setIsStrikethrough] = useState<boolean>(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('left');
  const [fontSize, setFontSize] = useState<number>(12);
  const [fontFamily, setFontFamily] = useState<string>('Calibri');

  // Zoom : 70% par défaut comme affiché dans le coin inférieur droit de la photo
  const [zoomPercent, setZoomPercent] = useState<number>(70);

  // Onglets feuilles
  const [sheetTabs, setSheetTabs] = useState<string[]>(['Feuille1']);
  const [activeSheetTab, setActiveSheetTab] = useState<string>('Feuille1');

  // État de sauvegarde automatique
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Référence pour le conteneur du tableau
  const tableRef = useRef<HTMLDivElement>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);

  // Coordonnée textuelle de la cellule sélectionnée (ex: "E21")
  const activeCoordinate = useMemo(() => {
    return `${getColumnLabel(selectedCell.c)}${selectedCell.r + 1}`;
  }, [selectedCell]);

  // Synchronisation de la barre de formule lorsque la cellule active change
  useEffect(() => {
    const val = gridData[selectedCell.r]?.[selectedCell.c] || '';
    setFormulaValue(val);
  }, [selectedCell, gridData]);

  // Focus sur l'input lors de l'édition en cellule
  useEffect(() => {
    if (editingCell && cellInputRef.current) {
      cellInputRef.current.focus();
    }
  }, [editingCell]);

  // Sauvegarde persistante avec auto-save
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(gridData));
      setIsSaved(true);
    } catch { }
  }, [gridData, storageKey]);

  // Gestion des raccourcis clavier globaux (Échap, Flèches, Tab, Entrée)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingCell) {
        if (e.key === 'Enter') {
          e.preventDefault();
          commitCellEdit(editInputVal);
          // Aller à la cellule du dessous
          setSelectedCell(prev => ({
            r: Math.min(TOTAL_ROWS - 1, prev.r + 1),
            c: prev.c
          }));
          setEditingCell(null);
        } else if (e.key === 'Tab') {
          e.preventDefault();
          commitCellEdit(editInputVal);
          // Aller à la cellule de droite
          setSelectedCell(prev => ({
            r: prev.r,
            c: Math.min(TOTAL_COLUMNS - 1, prev.c + 1)
          }));
          setEditingCell(null);
        } else if (e.key === 'Escape') {
          setEditingCell(null);
        }
        return;
      }

      // Si on n'est pas en édition, les flèches déplacent la cellule active
      if (document.activeElement === formulaInputRef.current) {
        if (e.key === 'Enter') {
          e.preventDefault();
          formulaInputRef.current?.blur();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCell(prev => ({ r: Math.max(0, prev.r - 1), c: prev.c }));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCell(prev => ({ r: Math.min(TOTAL_ROWS - 1, prev.r + 1), c: prev.c }));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setSelectedCell(prev => ({ r: prev.r, c: Math.max(0, prev.c - 1) }));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setSelectedCell(prev => ({ r: prev.r, c: Math.min(TOTAL_COLUMNS - 1, prev.c + 1) }));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        startCellEdit(selectedCell.r, selectedCell.c);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        commitCellEdit('', selectedCell.r, selectedCell.c);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        // Commencer à taper directement dans la cellule
        startCellEdit(selectedCell.r, selectedCell.c, e.key);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedCell, editingCell, editInputVal]);

  // Commencer l'édition d'une cellule
  const startCellEdit = (r: number, c: number, initialChar?: string) => {
    setEditingCell({ r, c });
    const currentVal = gridData[r]?.[c] || '';
    setEditInputVal(initialChar !== undefined ? initialChar : currentVal);
  };

  // Valider et enregistrer la valeur d'une cellule
  const commitCellEdit = (newVal: string, targetR?: number, targetC?: number) => {
    const r = targetR !== undefined ? targetR : (editingCell?.r ?? selectedCell.r);
    const c = targetC !== undefined ? targetC : (editingCell?.c ?? selectedCell.c);

    setGridData(prev => {
      const copy = prev.map(row => [...row]);
      while (copy.length <= r) copy.push([]);
      while (copy[r].length <= c) copy[r].push('');
      copy[r][c] = newVal;
      return copy;
    });

    setFormulaValue(newVal);
    setIsSaved(false);
  };

  // Modification directe depuis la barre de formule fx
  const handleFormulaBarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormulaValue(val);
    commitCellEdit(val, selectedCell.r, selectedCell.c);
  };

  // Export officiel en fichier Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const ws = XLSX.utils.aoa_to_sheet(gridData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeSheetTab);
      const safeName = `${subject.name}_${schoolClass.level}_${term?.name || 'Notes'}.xlsx`.replace(/[^\w\d-_.]/g, '_');
      XLSX.writeFile(wb, safeName);
    } catch (err) {
      console.error('Erreur export Excel:', err);
    }
  };

  // Calcul automatique de la moyenne ou somme (AutoSum / Sigma)
  const handleAutoSum = () => {
    // Calcule la moyenne des notes CP pour l'élève de la ligne active
    const r = selectedCell.r;
    if (r < 4) return; // Ne pas calculer sur les en-têtes

    let total = 0;
    let count = 0;
    for (let c = 3; c <= 24; c++) {
      const raw = (gridData[r]?.[c] || '').replace(',', '.').trim();
      const num = parseFloat(raw);
      if (!isNaN(num)) {
        total += num;
        count++;
      }
    }

    if (count > 0) {
      const avg = (total / count).toFixed(2);
      commitCellEdit(avg, r, 25); // Col 25 = Moy. CP
      commitCellEdit(avg, r, 27); // Col 27 = Moyenne
    }
  };

  // Ajout d'une nouvelle feuille
  const handleAddSheet = () => {
    const newName = `Feuille${sheetTabs.length + 1}`;
    setSheetTabs(prev => [...prev, newName]);
    setActiveSheetTab(newName);
  };

  return (
    <div 
      className={`w-full flex flex-col bg-[#f0f2f5] text-slate-800 font-sans select-none overflow-hidden transition-all duration-300 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : 'relative w-full h-full min-h-dvh'
      }`}
    >
      {/* ========================================================================= */}
      {/* 1. EN-TÊTE ÉPURÉ AVEC BOUTON RETOUR À GAUCHE ET BOUTONS ZOOMER À DROITE */}
      {/* ========================================================================= */}
      <header className="h-11 sm:h-12 bg-white border-b border-slate-300 px-3 sm:px-4 flex items-center justify-between gap-3 shrink-0 z-20 shadow-xs">
        {/* À GAUCHE : Bouton Retour sur la même ligne horizontale */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300/90 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            title="Retour à la liste des matières"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5] text-slate-700" />
            <span className="leading-none">Retour</span>
          </button>

          {/* Badge & Titre de la matière sélectionnée */}
          <div className="flex items-center gap-2 min-w-0">
            <div 
              className="w-3 h-3 rounded-sm border shrink-0"
              style={{
                backgroundColor: subject.color || '#2563eb',
                borderColor: subject.borderColor || '#1d4ed8'
              }}
            />
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 truncate">
              <span className="truncate">{subject.name}</span>
              <span className="text-slate-400 font-normal">•</span>
              <span className="text-slate-600 font-semibold truncate">{schoolClass.level} {schoolClass.name || ''}</span>
              <span className="text-slate-400 font-normal hidden sm:inline">•</span>
              <span className="text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded text-[10px] border border-cyan-200/80 hidden sm:inline-block">
                {term?.name || 'Trimestre 1'}
              </span>
            </div>
          </div>
        </div>

        {/* AU CENTRE / DROITE : Indicateur de sauvegarde & Export Excel rapide */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportExcel}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
            title="Télécharger cette feuille au format Excel (.xlsx)"
          >
            <Download className="w-3 h-3 text-emerald-700" />
            <span>Exporter .xlsx</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium hidden md:inline">
            {isSaved ? 'Enregistré automatiquement' : 'Enregistrement...'}
          </span>

          {/* À DROITE : BOUTONS ZOOMER PROGRESSIF & PLEIN ÉCRAN (Desktop) */}
          <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-1">
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

      {/* ========================================================================= */}
      {/* 2. RUBAN D'OUTILS STYLE WPS OFFICE / EXCEL (Identique à la photo) */}
      {/* ========================================================================= */}
      <section className="bg-[#f3f4f6] border-b border-slate-300 px-2 py-1 flex items-stretch gap-1 sm:gap-2 overflow-x-auto text-slate-700 shrink-0 select-none">
        {/* GROUPE 1 : PRESSE-PAPIERS / FORMAT PAINTER */}
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80 min-w-[55px]">
          <div className="flex items-center gap-1 mt-0.5">
            <button 
              type="button" 
              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition" 
              title="Coller"
            >
              <Clipboard className="w-4 h-4 text-amber-600" />
            </button>
            <button 
              type="button" 
              className="p-1 rounded hover:bg-slate-200 text-slate-700 transition" 
              title="Format Painter (Reproduire la mise en forme)"
            >
              <Paintbrush className="w-3.5 h-3.5 text-blue-600" />
            </button>
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">
            Coller
          </span>
        </div>

        {/* GROUPE 2 : POLICE (Calibri 12, B, I, U, ab, Bordures, Remplissage, Couleur) */}
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80">
          <div className="flex items-center gap-1">
            {/* Nom de police */}
            <div className="flex items-center h-6 px-1.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800">
              <span>{fontFamily}</span>
              <ChevronDown className="w-3 h-3 ml-1 text-slate-500" />
            </div>

            {/* Taille de police */}
            <div className="flex items-center h-6 px-1.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800">
              <span>{fontSize}</span>
              <ChevronDown className="w-3 h-3 ml-1 text-slate-500" />
            </div>

            {/* A^ et A_ */}
            <button
              type="button"
              onClick={() => setFontSize(prev => Math.min(24, prev + 1))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-700 font-bold text-xs"
              title="Agrandir la police"
            >
              A<sup>+</sup>
            </button>
            <button
              type="button"
              onClick={() => setFontSize(prev => Math.max(8, prev - 1))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-700 font-bold text-xs"
              title="Réduire la police"
            >
              A<sup>-</sup>
            </button>
          </div>

          {/* Ligne inférieure : B, I, U, ab, Bordure, Pot de peinture, Couleur police */}
          <div className="flex items-center gap-0.5 mt-1">
            <button
              type="button"
              onClick={() => setIsBold(!isBold)}
              className={`w-5 h-5 flex items-center justify-center rounded transition ${
                isBold ? 'bg-slate-300 text-slate-900 font-black' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Gras"
            >
              <Bold className="w-3 h-3 stroke-[2.8]" />
            </button>

            <button
              type="button"
              onClick={() => setIsItalic(!isItalic)}
              className={`w-5 h-5 flex items-center justify-center rounded transition ${
                isItalic ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Italique"
            >
              <Italic className="w-3 h-3 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={() => setIsUnderline(!isUnderline)}
              className={`w-5 h-5 flex items-center justify-center rounded transition ${
                isUnderline ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Souligné"
            >
              <Underline className="w-3 h-3 stroke-[2.5]" />
            </button>

            <button
              type="button"
              onClick={() => setIsStrikethrough(!isStrikethrough)}
              className={`w-5 h-5 flex items-center justify-center rounded transition ${
                isStrikethrough ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'
              }`}
              title="Barré"
            >
              <Strikethrough className="w-3 h-3 stroke-[2.5]" />
            </button>

            {/* Bordure de cellule */}
            <div className="flex items-center p-0.5 rounded hover:bg-slate-200 cursor-pointer" title="Bordures">
              <Grid3X3 className="w-3 h-3 text-slate-700" />
              <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
            </div>

            {/* Pot de peinture */}
            <div className="flex items-center p-0.5 rounded hover:bg-slate-200 cursor-pointer" title="Couleur de remplissage">
              <PaintBucket className="w-3 h-3 text-amber-500" />
              <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
            </div>

            {/* Couleur de police */}
            <div className="flex items-center p-0.5 rounded hover:bg-slate-200 cursor-pointer" title="Couleur de police">
              <div className="flex flex-col items-center">
                <span className="font-bold text-xs text-slate-800 leading-none">A</span>
                <span className="w-2.5 h-0.5 bg-red-600 rounded-full"></span>
              </div>
              <ChevronDown className="w-2.5 h-2.5 text-slate-500 ml-0.5" />
            </div>
          </div>
        </div>

        {/* GROUPE 3 : ALIGNEMENT */}
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80">
          <div className="flex items-center gap-1 mt-0.5">
            <button
              type="button"
              onClick={() => setTextAlign('left')}
              className={`p-1 rounded transition ${textAlign === 'left' ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Aligner à gauche"
            >
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTextAlign('center')}
              className={`p-1 rounded transition ${textAlign === 'center' ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Centrer"
            >
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setTextAlign('right')}
              className={`p-1 rounded transition ${textAlign === 'right' ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}
              title="Aligner à droite"
            >
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-slate-200 text-slate-700"
              title="Renvoyer à la ligne automatiquement"
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5 flex items-center gap-0.5">
            Alignement <ChevronDown className="w-2 h-2 text-slate-400" />
          </span>
        </div>

        {/* GROUPE 4 : FORMAT DE NOMBRE */}
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80 min-w-[75px]">
          <div className="h-6 px-1.5 bg-white border border-slate-300 rounded text-[10.5px] font-medium text-slate-800 flex items-center justify-between w-full mt-0.5">
            <span>Général</span>
            <ChevronDown className="w-2.5 h-2.5 text-slate-500" />
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5 flex items-center gap-0.5">
            Format de nombre <ChevronDown className="w-2 h-2 text-slate-400" />
          </span>
        </div>

        {/* GROUPE 5 : CELLULES */}
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80">
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-700">
            <div className="w-4 h-4 rounded border border-slate-400 flex items-center justify-center font-bold text-[9px] bg-white">
              #
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5 flex items-center gap-0.5">
            Cellules <ChevronDown className="w-2 h-2 text-slate-400" />
          </span>
        </div>

        {/* GROUPE 6 : FORMAT */}
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80">
          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-slate-700">
            <div className="w-4 h-4 rounded border border-slate-400 flex items-center justify-center bg-white">
              <Grid3X3 className="w-2.5 h-2.5 text-slate-600" />
            </div>
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5 flex items-center gap-0.5">
            Format <ChevronDown className="w-2 h-2 text-slate-400" />
          </span>
        </div>

        {/* GROUPE 7 : TRAITEMENT DES DONNÉES / SOMME AUTOMATIQUE */}
        <div className="flex flex-col items-center justify-between px-1.5">
          <button
            type="button"
            onClick={handleAutoSum}
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200 transition text-slate-800 mt-0.5 active:scale-95"
            title="Calculer automatiquement la moyenne des notes CP"
          >
            <Sigma className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
            <span className="text-[10px] font-bold">Moyenne</span>
          </button>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5 flex items-center gap-0.5">
            Traitement des données <ChevronDown className="w-2 h-2 text-slate-400" />
          </span>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. BARRE DE FORMULE EXCEL (Coordonnée ex: E21 | fx | Champ de saisie) */}
      {/* ========================================================================= */}
      <section className="h-7 sm:h-8 bg-white border-b border-slate-300 px-2 flex items-center gap-2 text-xs shrink-0 select-none">
        {/* Zone de nom / coordonnée active (ex: E21) */}
        <div className="flex items-center justify-between w-14 sm:w-16 h-6 px-1.5 bg-[#f9fafb] border border-slate-300 rounded text-slate-700 font-mono font-bold text-[11px]">
          <span>{activeCoordinate}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>

        {/* Séparateur vertical */}
        <div className="w-[1px] h-4 bg-slate-300" />

        {/* Symbole de fonction fx */}
        <div className="flex items-center justify-center w-5 h-5 text-slate-500 font-serif italic font-bold text-xs select-none">
          fx
        </div>

        {/* Champ de saisie de formule étendu */}
        <input
          ref={formulaInputRef}
          type="text"
          value={formulaValue}
          onChange={handleFormulaBarChange}
          placeholder="Entrez une note, un texte ou une valeur..."
          className="flex-1 h-6 px-2 bg-transparent text-slate-800 font-medium text-xs outline-none focus:bg-blue-50/40 rounded transition"
        />
      </section>

      {/* ========================================================================= */}
      {/* 4. GRILLE DE TABLEUR EXCEL / WPS (A, B, C... et 1, 2, 3... avec CP-1 à CP-22) */}
      {/* ========================================================================= */}
      <div 
        ref={tableRef}
        className="flex-1 overflow-auto bg-white relative"
        style={{
          // Zoom appliqué à la grille comme sur la capture d'écran
          zoom: `${zoomPercent}%`
        }}
      >
        <table className="border-collapse table-fixed w-max min-w-full text-xs">
          <tbody>
            {/* Grille 100% vierge sans les A,B.., sans les 123.., sans les cp-1.. et sans le N°.. */}
            {gridData.map((row, rIdx) => {
              const rowNum = rIdx + 1;

              return (
                <tr key={rowNum} className="border-b border-slate-200 hover:bg-slate-50/40">
                  {/* Cellules de la ligne */}
                  {Array.from({ length: TOTAL_COLUMNS }).map((_, cIdx) => {
                    const isSelected = selectedCell.r === rIdx && selectedCell.c === cIdx;
                    const isEditing = editingCell?.r === rIdx && editingCell?.c === cIdx;
                    const cellVal = row[cIdx] || '';

                    return (
                      <td
                        key={cIdx}
                        onClick={() => {
                          setSelectedCell({ r: rIdx, c: cIdx });
                          setEditingCell(null);
                        }}
                        onDoubleClick={() => startCellEdit(rIdx, cIdx)}
                        className={`w-24 min-w-[85px] h-6 px-2 text-xs border-r border-slate-200 relative transition-colors ${
                          isSelected
                            ? 'outline-2 outline-[#107c41] -outline-offset-2 z-1 bg-blue-50/20'
                            : ''
                        }`}
                        style={{
                          textAlign,
                          fontWeight: isBold ? 'bold' : 'normal',
                          fontStyle: isItalic ? 'italic' : 'normal',
                          textDecoration: isUnderline ? 'underline' : isStrikethrough ? 'line-through' : 'none',
                        }}
                      >
                        {isEditing ? (
                          <input
                            ref={cellInputRef}
                            type="text"
                            value={editInputVal}
                            onChange={(e) => setEditInputVal(e.target.value)}
                            onBlur={() => {
                              commitCellEdit(editInputVal, rIdx, cIdx);
                              setEditingCell(null);
                            }}
                            className="w-full h-full p-0 m-0 bg-white text-slate-900 outline-none border-none text-xs"
                          />
                        ) : (
                          <span className="block truncate">{cellVal}</span>
                        )}

                        {/* Petit carré de poignée de recopie Excel en bas à droite de la cellule active */}
                        {isSelected && !isEditing && (
                          <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-[#107c41] border border-white cursor-crosshair z-2" />
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ========================================================================= */}
      {/* 5. BARRE INFÉRIEURE : ONGLETS FEUILLES & CURSEUR ZOOM (70% comme sur photo) */}
      {/* ========================================================================= */}
      <footer className="h-7 bg-[#f3f4f6] border-t border-slate-300 px-3 flex items-center justify-between text-xs text-slate-600 shrink-0 select-none">
        {/* À GAUCHE : Onglets de feuilles (Feuille1 + bouton '+') */}
        <div className="flex items-center gap-1">
          {sheetTabs.map((sTab) => {
            const isActive = activeSheetTab === sTab;
            return (
              <button
                key={sTab}
                type="button"
                onClick={() => setActiveSheetTab(sTab)}
                className={`px-3 py-1 text-[11px] font-bold rounded-t border-t border-x transition cursor-pointer ${
                  isActive
                    ? 'bg-white text-emerald-800 border-slate-300 border-b-white -mb-[1px] shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-200 border-transparent'
                }`}
              >
                {sTab}
              </button>
            );
          })}

          <button
            type="button"
            onClick={handleAddSheet}
            className="w-5 h-5 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-600 ml-1 cursor-pointer transition active:scale-95"
            title="Ajouter une nouvelle feuille"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* À DROITE : Curseur de Zoom (Affichant 70% comme sur la photo du professeur) */}
        <div className="flex items-center gap-2">
          {/* Bouton Zoom Moins */}
          <button
            type="button"
            onClick={() => setZoomPercent(prev => Math.max(40, prev - 10))}
            className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            title="Zoom arrière (-10%)"
          >
            <Minus className="w-3 h-3" />
          </button>

          {/* Slider de zoom */}
          <input
            type="range"
            min="40"
            max="150"
            step="5"
            value={zoomPercent}
            onChange={(e) => setZoomPercent(Number(e.target.value))}
            className="w-16 sm:w-24 h-1.5 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-emerald-700"
          />

          {/* Bouton Zoom Plus */}
          <button
            type="button"
            onClick={() => setZoomPercent(prev => Math.min(150, prev + 10))}
            className="w-5 h-5 rounded hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
            title="Zoom avant (+10%)"
          >
            <Plus className="w-3 h-3" />
          </button>

          {/* Valeur du zoom affichée (70% comme sur l'image) */}
          <span className="text-[11px] font-mono font-bold text-slate-700 min-w-[36px] text-right">
            {zoomPercent}%
          </span>
        </div>
      </footer>
    </div>
  );
};
