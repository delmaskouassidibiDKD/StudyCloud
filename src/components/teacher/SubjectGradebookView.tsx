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
  ChevronDown,
  User,
  Camera,
  Trash2,
  Award
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

// Structure d'un élève dans le tableau moderne de notes
export interface StudentGradeRow {
  id: string;
  name: string;
  photoUrl?: string;
  notes: string[]; // 7 notes (N 1 à N 7)
}

// 7 colonnes de notes comme dessiné sur l'image
const TOTAL_NOTE_COLS = 7;

// Grille de fond de tableur entourant le tableau (lignes et colonnes)
const BACKGROUND_EXTRA_COLS = 12;
const BACKGROUND_EXTRA_ROWS = 25;

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

  // Clé de persistance pour ce tableau de notes par matière et trimestre
  const storageKey = `studycloud_student_gradebook_${subject.id}_${term?.id || 't1'}`;

  // Liste des élèves avec leurs notes (Persistance locale)
  const [students, setStudents] = useState<StudentGradeRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }

    // 8 lignes d'élèves prêtes à l'emploi par défaut
    return Array.from({ length: 8 }, (_, i) => ({
      id: `student-${Date.now()}-${i}`,
      name: '',
      photoUrl: undefined,
      notes: Array(TOTAL_NOTE_COLS).fill('')
    }));
  });

  // Cellule active sélectionnée pour la barre de formule (champ, ligne, colonne)
  const [activeCellInfo, setActiveCellInfo] = useState<{
    id: string;
    type: 'rank' | 'photo' | 'name' | 'note' | 'average';
    rowIndex: number;
    noteColIndex?: number;
    coordDisplay: string;
    value: string;
  }>({
    id: 'cell-name-0',
    type: 'name',
    rowIndex: 0,
    coordDisplay: 'NO1',
    value: ''
  });

  // Styles de formatage du ruban
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

  // Référence pour l'upload de photo d'élève
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);

  // Sauvegarde persistante dans le localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(students));
      setIsSaved(true);
    } catch { }
  }, [students, storageKey]);

  // Calcul dynamique des moyennes (M) et des rangs (R) en temps réel
  const studentsWithStats = useMemo(() => {
    // 1. Calcul de la moyenne pour chaque élève
    const withAverage = students.map((std, idx) => {
      const validNotes = std.notes
        .map(n => parseFloat(n.replace(',', '.').trim()))
        .filter(n => !isNaN(n) && n >= 0 && n <= 20);

      const avg = validNotes.length > 0
        ? validNotes.reduce((sum, val) => sum + val, 0) / validNotes.length
        : null;

      return {
        ...std,
        rowNumber: idx + 1,
        average: avg,
        averageFormatted: avg !== null ? avg.toFixed(2) : ''
      };
    });

    // 2. Attribution automatique des rangs selon la moyenne décroissante
    const sortedActive = [...withAverage]
      .filter(s => s.average !== null)
      .sort((a, b) => b.average! - a.average!);

    const rankMap = new Map<string, string>();
    let currentRank = 1;

    sortedActive.forEach((s, i) => {
      if (i > 0 && sortedActive[i - 1].average === s.average) {
        rankMap.set(s.id, `${currentRank}e ex`);
      } else {
        currentRank = i + 1;
        rankMap.set(s.id, currentRank === 1 ? '1er' : `${currentRank}e`);
      }
    });

    return withAverage.map(s => ({
      ...s,
      rank: rankMap.get(s.id) || (s.name.trim() ? '-' : '')
    }));
  }, [students]);

  // Modification du nom d'un élève
  const handleNameChange = (studentId: string, newName: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, name: newName } : s));
    setIsSaved(false);
  };

  // Modification d'une note N
  const handleNoteChange = (studentId: string, noteIndex: number, newVal: string) => {
    // Autorise seulement les chiffres, virgules et points
    const sanitized = newVal.replace(/[^0-9.,]/g, '');
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      const copyNotes = [...s.notes];
      copyNotes[noteIndex] = sanitized;
      return { ...s, notes: copyNotes };
    }));
    setIsSaved(false);
  };

  // Ajout d'une ligne d'élève
  const handleAddStudentRow = () => {
    const newStudent: StudentGradeRow = {
      id: `student-${Date.now()}-${students.length}`,
      name: '',
      photoUrl: undefined,
      notes: Array(TOTAL_NOTE_COLS).fill('')
    };
    setStudents(prev => [...prev, newStudent]);
    setIsSaved(false);
  };

  // Suppression d'un élève
  const handleDeleteStudentRow = (studentId: string) => {
    if (students.length <= 1) {
      // Si une seule ligne, juste vider son contenu
      setStudents([{
        id: `student-${Date.now()}-0`,
        name: '',
        photoUrl: undefined,
        notes: Array(TOTAL_NOTE_COLS).fill('')
      }]);
      return;
    }
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setIsSaved(false);
  };

  // Déclenchement de l'upload de photo d'élève
  const handleTriggerPhotoUpload = (studentId: string) => {
    setUploadingStudentId(studentId);
    photoInputRef.current?.click();
  };

  // Réception de l'image sélectionnée
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingStudentId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      setStudents(prev => prev.map(s => s.id === uploadingStudentId ? { ...s, photoUrl: base64 } : s));
      setIsSaved(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Export officiel vers Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const headers = ['Rang (R)', 'Nom & Prénom (NO)', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'Moyenne (M)'];
      const dataRows = studentsWithStats.map(s => [
        s.rank,
        s.name,
        ...s.notes,
        s.averageFormatted
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeSheetTab);

      const safeName = `Releve_Notes_${subject.name}_${schoolClass.level}_${term?.name || 'T1'}.xlsx`.replace(/[^\w\d-_.]/g, '_');
      XLSX.writeFile(wb, safeName);
    } catch (err) {
      console.error('Erreur export Excel:', err);
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
      {/* Input invisible pour l'upload des photos d'élèves */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFileChange}
        className="hidden"
      />

      {/* ========================================================================= */}
      {/* 1. EN-TÊTE ÉPURÉ : BOUTON RETOUR À GAUCHE & BOUTONS ZOOMER À DROITE */}
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
            className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200 transition text-slate-800 mt-0.5 active:scale-95"
            title="Moyennes calculées automatiquement"
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
      {/* 3. BARRE DE FORMULE EXCEL (Coordonnée active | fx | Champ de saisie) */}
      {/* ========================================================================= */}
      <section className="h-7 sm:h-8 bg-white border-b border-slate-300 px-2 flex items-center gap-2 text-xs shrink-0 select-none">
        {/* Zone de nom / coordonnée active */}
        <div className="flex items-center justify-between w-16 sm:w-20 h-6 px-1.5 bg-[#f9fafb] border border-slate-300 rounded text-slate-700 font-mono font-bold text-[11px]">
          <span>{activeCellInfo.coordDisplay}</span>
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
          type="text"
          value={activeCellInfo.value}
          readOnly={activeCellInfo.type === 'rank' || activeCellInfo.type === 'average' || activeCellInfo.type === 'photo'}
          onChange={(e) => {
            const val = e.target.value;
            setActiveCellInfo(prev => ({ ...prev, value: val }));
            if (activeCellInfo.type === 'name') {
              const std = students[activeCellInfo.rowIndex];
              if (std) handleNameChange(std.id, val);
            } else if (activeCellInfo.type === 'note' && activeCellInfo.noteColIndex !== undefined) {
              const std = students[activeCellInfo.rowIndex];
              if (std) handleNoteChange(std.id, activeCellInfo.noteColIndex, val);
            }
          }}
          placeholder="Sélectionnez une case du tableau pour voir ou modifier sa valeur..."
          className="flex-1 h-6 px-2 bg-transparent text-slate-800 font-medium text-xs outline-none focus:bg-blue-50/40 rounded transition"
        />
      </section>

      {/* ========================================================================= */}
      {/* 4. GRILLE DE TABLEUR EXCEL / WPS : TABLEAU ENRICHI AVEC CARREAUX AGRANDIS */}
      {/* ET CARREAUX DE FOND AUTOUR QUI RESTENT PETITS (Conforme à l'image tracée) */}
      {/* ========================================================================= */}
      <div 
        className="flex-1 overflow-auto bg-white relative p-2 sm:p-3"
        style={{
          zoom: `${zoomPercent}%`
        }}
      >
        <div className="inline-block min-w-full">
          {/* Ligne 0 : Rangée de petites cases de fond au-dessus pour l'effet tableur authentique */}
          <div className="flex mb-[1px]">
            {Array.from({ length: 22 }).map((_, c) => (
              <div 
                key={`top-bg-${c}`} 
                className="w-16 h-5 border-r border-b border-slate-200/50 bg-[#fafbfc]"
              />
            ))}
          </div>

          <div className="flex items-start">
            {/* Colonne 0 : Petites cases de fond à gauche */}
            <div className="flex flex-col shrink-0 mr-[1px]">
              {Array.from({ length: studentsWithStats.length + 3 }).map((_, r) => (
                <div 
                  key={`left-bg-${r}`} 
                  className="w-8 h-11 border-b border-r border-slate-200/50 bg-[#fafbfc]"
                />
              ))}
            </div>

            {/* =================================================================== */}
            {/* LE TABLEAU MODERNE TRACÉ (LIGNES BIEN VISIBLES & CARREAUX AGRANDIS) */}
            {/* R : Rang | I : Photo | NO : Nom | N.. : Notes 1 à 7 | M : Moyenne   */}
            {/* =================================================================== */}
            <div className="shrink-0 rounded-sm border-2 border-slate-800 shadow-md bg-white">
              {/* EN-TÊTE DU TABLEAU : LETTRES BLEUES IDENTIQUES À LA PHOTO */}
              <div className="flex bg-[#f8fafc] border-b-2 border-slate-800 select-none text-blue-600 font-black">
                {/* R : RANG */}
                <div 
                  className="w-14 sm:w-16 h-11 border-r border-slate-400 flex flex-col items-center justify-center p-0.5 text-center"
                  title="R : Rang de l'élève (classement)"
                >
                  <span className="text-base sm:text-lg leading-none tracking-tight">R</span>
                  <span className="text-[8.5px] font-bold text-slate-500 mt-0.5">Rang</span>
                </div>

                {/* I : PROFIL / PHOTO */}
                <div 
                  className="w-16 sm:w-18 h-11 border-r border-slate-400 flex flex-col items-center justify-center p-0.5 text-center"
                  title="I : Profil / Photo de l'élève"
                >
                  <span className="text-base sm:text-lg leading-none tracking-tight">I</span>
                  <span className="text-[8.5px] font-bold text-slate-500 mt-0.5">Photo</span>
                </div>

                {/* NO : NOM ET PRÉNOM */}
                <div 
                  className="w-56 sm:w-64 h-11 border-r border-slate-400 flex flex-col items-center justify-center p-0.5 text-center"
                  title="NO : Nom et Prénom de l'élève"
                >
                  <span className="text-base sm:text-lg leading-none tracking-tight">NO</span>
                  <span className="text-[8.5px] font-bold text-slate-500 mt-0.5">Nom et Prénom</span>
                </div>

                {/* N.. : LES 7 COLONNES DE NOTES */}
                {Array.from({ length: TOTAL_NOTE_COLS }).map((_, i) => (
                  <div 
                    key={`header-note-${i}`}
                    className="w-16 sm:w-18 h-11 border-r border-slate-400 flex flex-col items-center justify-center p-0.5 text-center"
                    title={`N : Note ${i + 1} de l'élève`}
                  >
                    <span className="text-base sm:text-lg leading-none tracking-tight">N</span>
                    <span className="text-[8.5px] font-bold text-slate-500 mt-0.5">Note {i + 1}</span>
                  </div>
                ))}

                {/* M : LA MOYENNE */}
                <div 
                  className="w-20 sm:w-24 h-11 flex flex-col items-center justify-center p-0.5 text-center bg-blue-50/40"
                  title="M : Moyenne générale de l'élève"
                >
                  <span className="text-base sm:text-lg leading-none tracking-tight text-blue-700">M</span>
                  <span className="text-[8.5px] font-bold text-slate-600 mt-0.5">Moyenne</span>
                </div>
              </div>

              {/* CORPS DU TABLEAU : LIGNES D'ÉLÈVES MODÈLE PROFESSIONNEL */}
              <div className="divide-y divide-slate-300">
                {studentsWithStats.map((std, rIdx) => {
                  const isRowSelected = activeCellInfo.rowIndex === rIdx;

                  return (
                    <div 
                      key={std.id}
                      className={`flex items-stretch transition-colors ${
                        isRowSelected ? 'bg-blue-50/20' : 'hover:bg-slate-50/60'
                      }`}
                    >
                      {/* R : RANG (Automatique d'après la moyenne) */}
                      <div 
                        onClick={() => {
                          setActiveCellInfo({
                            id: `cell-rank-${rIdx}`,
                            type: 'rank',
                            rowIndex: rIdx,
                            coordDisplay: `R${rIdx + 1}`,
                            value: std.rank ? `=RANG(M${rIdx + 1})` : ''
                          });
                        }}
                        className={`w-14 sm:w-16 h-11 border-r border-slate-400 flex items-center justify-center p-1 cursor-pointer relative ${
                          activeCellInfo.id === `cell-rank-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-emerald-50/40' : ''
                        }`}
                      >
                        {std.rank ? (
                          <span className={`px-2 py-0.5 rounded-md text-xs font-black shadow-2xs ${
                            std.rank === '1er'
                              ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border border-amber-400 ring-1 ring-amber-300/50'
                              : std.rank.startsWith('2e')
                              ? 'bg-slate-200 text-slate-800 border border-slate-300'
                              : std.rank.startsWith('3e')
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 font-bold'
                          }`}>
                            {std.rank}
                          </span>
                        ) : (
                          <span className="text-slate-300 text-xs font-semibold">-</span>
                        )}
                      </div>

                      {/* I : PHOTO / PROFIL (Avatar avec clic pour téléverser) */}
                      <div 
                        onClick={() => {
                          setActiveCellInfo({
                            id: `cell-photo-${rIdx}`,
                            type: 'photo',
                            rowIndex: rIdx,
                            coordDisplay: `I${rIdx + 1}`,
                            value: std.photoUrl ? 'Photo chargée' : 'Aucune photo'
                          });
                        }}
                        className={`w-16 sm:w-18 h-11 border-r border-slate-400 flex items-center justify-center p-1 cursor-pointer relative group ${
                          activeCellInfo.id === `cell-photo-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' : ''
                        }`}
                        title="Cliquer pour changer la photo de l'élève"
                      >
                        <div 
                          onClick={() => handleTriggerPhotoUpload(std.id)}
                          className="w-8 h-8 rounded-full border border-slate-300 shadow-2xs overflow-hidden flex items-center justify-center bg-slate-100 group-hover:ring-2 group-hover:ring-blue-400 transition"
                        >
                          {std.photoUrl ? (
                            <img src={std.photoUrl} alt={std.name || 'Élève'} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400 group-hover:text-blue-600 transition">
                              <Camera className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* NO : NOM ET PRÉNOM (Champ de saisie étendu) */}
                      <div 
                        onClick={() => {
                          setActiveCellInfo({
                            id: `cell-name-${rIdx}`,
                            type: 'name',
                            rowIndex: rIdx,
                            coordDisplay: `NO${rIdx + 1}`,
                            value: std.name
                          });
                        }}
                        className={`w-56 sm:w-64 h-11 border-r border-slate-400 flex items-center p-1.5 relative ${
                          activeCellInfo.id === `cell-name-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' : ''
                        }`}
                      >
                        <input
                          type="text"
                          value={std.name}
                          onChange={(e) => handleNameChange(std.id, e.target.value)}
                          onFocus={() => {
                            setActiveCellInfo({
                              id: `cell-name-${rIdx}`,
                              type: 'name',
                              rowIndex: rIdx,
                              coordDisplay: `NO${rIdx + 1}`,
                              value: std.name
                            });
                          }}
                          placeholder={`Nom et prénom élève ${rIdx + 1}...`}
                          className="w-full h-full px-2 text-xs font-semibold text-slate-800 placeholder:text-slate-300 bg-transparent outline-none border border-transparent focus:border-blue-400 focus:bg-white rounded transition"
                          style={{
                            textAlign,
                            fontWeight: isBold ? 'bold' : '600',
                            fontStyle: isItalic ? 'italic' : 'normal',
                            textDecoration: isUnderline ? 'underline' : isStrikethrough ? 'line-through' : 'none',
                          }}
                        />
                      </div>

                      {/* N.. : LES 7 COLONNES DE NOTES ÉDITABLES */}
                      {Array.from({ length: TOTAL_NOTE_COLS }).map((_, cIdx) => {
                        const noteVal = std.notes[cIdx] || '';
                        const isSelectedNote = activeCellInfo.id === `cell-note-${rIdx}-${cIdx}`;

                        return (
                          <div 
                            key={`note-cell-${std.id}-${cIdx}`}
                            onClick={() => {
                              setActiveCellInfo({
                                id: `cell-note-${rIdx}-${cIdx}`,
                                type: 'note',
                                rowIndex: rIdx,
                                noteColIndex: cIdx,
                                coordDisplay: `N${cIdx + 1}_${rIdx + 1}`,
                                value: noteVal
                              });
                            }}
                            className={`w-16 sm:w-18 h-11 border-r border-slate-400 flex items-center justify-center p-1 relative ${
                              isSelectedNote ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' : ''
                            }`}
                          >
                            <input
                              type="text"
                              value={noteVal}
                              onChange={(e) => handleNoteChange(std.id, cIdx, e.target.value)}
                              onFocus={() => {
                                setActiveCellInfo({
                                  id: `cell-note-${rIdx}-${cIdx}`,
                                  type: 'note',
                                  rowIndex: rIdx,
                                  noteColIndex: cIdx,
                                  coordDisplay: `N${cIdx + 1}_${rIdx + 1}`,
                                  value: noteVal
                                });
                              }}
                              placeholder="-"
                              maxLength={5}
                              className="w-full h-full text-center text-xs font-bold text-slate-800 placeholder:text-slate-300 bg-transparent outline-none border border-transparent focus:border-blue-400 focus:bg-white rounded transition"
                            />

                            {/* Poignée de recopie verte style Excel si sélectionnée */}
                            {isSelectedNote && (
                              <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-[#107c41] border border-white cursor-crosshair z-20 pointer-events-none" />
                            )}
                          </div>
                        );
                      })}

                      {/* M : MOYENNE GÉNÉRALE (Calculée automatiquement) */}
                      <div 
                        onClick={() => {
                          setActiveCellInfo({
                            id: `cell-avg-${rIdx}`,
                            type: 'average',
                            rowIndex: rIdx,
                            coordDisplay: `M${rIdx + 1}`,
                            value: std.average !== null ? `=MOYENNE(N1:N7) => ${std.averageFormatted}` : ''
                          });
                        }}
                        className={`w-20 sm:w-24 h-11 flex items-center justify-between px-2 cursor-pointer relative bg-slate-50/50 ${
                          activeCellInfo.id === `cell-avg-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/40' : ''
                        }`}
                        title="Moyenne automatique calculée d'après les notes N1 à N7"
                      >
                        <span className={`w-full text-center text-xs font-black tracking-tight ${
                          std.average === null
                            ? 'text-slate-300'
                            : std.average >= 12
                            ? 'text-emerald-700 bg-emerald-50/80 py-0.5 px-1.5 rounded border border-emerald-200'
                            : std.average >= 10
                            ? 'text-blue-700 bg-blue-50/80 py-0.5 px-1.5 rounded border border-blue-200'
                            : 'text-rose-700 bg-rose-50/80 py-0.5 px-1.5 rounded border border-rose-200'
                        }`}>
                          {std.averageFormatted || '-'}
                        </span>

                        {/* Bouton supprimer la ligne au survol */}
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
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* PIED DU TABLEAU : BOUTON AJOUTER UN ÉLÈVE */}
              <div className="p-2 bg-[#f8fafc] border-t border-slate-300 flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleAddStudentRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 text-blue-600 stroke-[3]" />
                  <span>+ Ajouter un élève</span>
                </button>

                <div className="text-[11px] font-semibold text-slate-500">
                  Total : <span className="font-bold text-slate-800">{students.length}</span> élèves
                </div>
              </div>
            </div>

            {/* Petites cases de fond à droite qui restent petites comme actuellement */}
            <div className="flex shrink-0 ml-[1px]">
              {Array.from({ length: BACKGROUND_EXTRA_COLS }).map((_, c) => (
                <div key={`right-bg-col-${c}`} className="flex flex-col">
                  {Array.from({ length: studentsWithStats.length + 3 }).map((_, r) => (
                    <div 
                      key={`right-bg-cell-${c}-${r}`}
                      className="w-16 h-11 border-r border-b border-slate-200/50 bg-[#fafbfc]"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Petites cases de fond en bas du tableau qui restent petites comme actuellement */}
          <div className="mt-[1px]">
            {Array.from({ length: BACKGROUND_EXTRA_ROWS }).map((_, r) => (
              <div key={`bottom-bg-row-${r}`} className="flex">
                {Array.from({ length: 30 }).map((_, c) => (
                  <div 
                    key={`bottom-bg-cell-${r}-${c}`}
                    className="w-16 h-6 border-r border-b border-slate-200/50 bg-[#fafbfc]"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
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
            <Plus className="w-3.5 h-3.5" />
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
