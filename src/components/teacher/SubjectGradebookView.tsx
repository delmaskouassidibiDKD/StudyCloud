import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
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
  WrapText,
  Sigma,
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
  RotateCcw
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

// Métadonnées d'une colonne de notes (intitulé, barème max, couleur de case, couleur de colonne)
export interface GradebookColumnMeta {
  title?: string;        // Intitulé personnalisable (ex: "NOTE", "DEVOIR", "INTERRO", "TP")
  maxScore: number;     // Barème maximal par défaut (ex: 20, 10, 40)
  headerBgColor?: string;// Couleur de fond de l'en-tête seul
  columnBgColor?: string;// Couleur de fond de toute la colonne
}

// Structure d'un élève dans le tableau moderne de notes
export interface StudentGradeRow {
  id: string;
  name: string;
  photoUrl?: string;
  notes: string[]; // Notes dynamiques stockées sous forme "score/max" ou "score"
}

// Analyse d'une note d'élève stockée ("score/max" ou "score")
export interface ParsedNote {
  scoreStr: string;
  maxScore: number;
  scoreNum: number | null;
  isInvalid: boolean; // true si scoreNum > maxScore
}

export const parseStudentNote = (rawVal: string, defaultMax = 20): ParsedNote => {
  const safe = (rawVal || '').trim();
  let scoreStr = '';
  let maxScore = defaultMax > 0 ? defaultMax : 20;

  if (safe.includes('/')) {
    const parts = safe.split('/');
    scoreStr = (parts[0] || '').trim();
    const parsedMax = parseFloat((parts[1] || '').trim().replace(',', '.'));
    if (!isNaN(parsedMax) && parsedMax > 0) {
      maxScore = parsedMax;
    }
  } else {
    scoreStr = safe;
  }

  scoreStr = scoreStr.replace(/[^0-9.,]/g, '');
  const scoreNum = scoreStr !== '' ? parseFloat(scoreStr.replace(',', '.')) : null;
  const isInvalid = scoreNum !== null && !isNaN(scoreNum) && scoreNum > maxScore;

  return {
    scoreStr,
    maxScore,
    scoreNum: scoreNum !== null && !isNaN(scoreNum) ? scoreNum : null,
    isInvalid
  };
};

export const formatStudentNote = (scoreStr: string, maxScore: number): string => {
  const cleanScore = (scoreStr || '').trim().replace(/[^0-9.,]/g, '');
  return `${cleanScore}/${maxScore > 0 ? maxScore : 20}`;
};

// Palette de couleurs pastel pour la coloration (16 teintes riches, nettes et bien contrastées)
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
  onBack,
}) => {
  const viewerExpandLevel = useViewerExpandLevel();
  const [isViewerMaximized, setIsViewerMaximized] = useState(false);

  // Clés de persistance locale
  const storageKey = `studycloud_student_gradebook_${subject.id}_${term?.id || 't1'}`;
  const colCountKey = `studycloud_note_col_count_${subject.id}_${term?.id || 't1'}`;
  const colWidthKey = `studycloud_note_col_width_${subject.id}_${term?.id || 't1'}`;
  const colWidthRankKey = `studycloud_col_width_rank_${subject.id}_${term?.id || 't1'}`;
  const colWidthPhotoKey = `studycloud_col_width_photo_${subject.id}_${term?.id || 't1'}`;
  const colWidthNameKey = `studycloud_col_width_name_${subject.id}_${term?.id || 't1'}`;
  const colWidthAvgKey = `studycloud_col_width_avg_${subject.id}_${term?.id || 't1'}`;
  const colWidthMentionKey = `studycloud_col_width_mention_${subject.id}_${term?.id || 't1'}`;
  const customNoteWidthsKey = `studycloud_custom_note_widths_${subject.id}_${term?.id || 't1'}`;
  const rowHeightsKey = `studycloud_row_heights_${subject.id}_${term?.id || 't1'}`;
  const colMetasKey = `studycloud_col_metas_${subject.id}_${term?.id || 't1'}`;

  // Référence du conteneur de défilement
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Nombre de colonnes de notes dynamique (infini, minimum 1, 7 par défaut)
  const [noteColumnCount, setNoteColumnCount] = useState<number>(() => {
    try {
      const savedCount = localStorage.getItem(colCountKey);
      if (savedCount) {
        const count = parseInt(savedCount, 10);
        if (!isNaN(count) && count >= 1) return count;
      }
      const savedData = localStorage.getItem(storageKey);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (Array.isArray(parsed) && parsed.length > 0 && Array.isArray(parsed[0].notes)) {
          return Math.max(7, parsed[0].notes.length);
        }
      }
    } catch { }
    return 7;
  });

  // Métadonnées de chaque colonne de note (titre, barème max, couleur de fond)
  const [columnMetas, setColumnMetas] = useState<{ [colIndex: number]: GradebookColumnMeta }>(() => {
    try {
      const s = localStorage.getItem(colMetasKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (typeof parsed === 'object') return parsed;
      }
    } catch { }
    return {};
  });

  // Clés de stockage pour les couleurs personnalisées
  const cellColorsKey = `studycloud_cell_colors_${subject.id}_${term?.id || 't1'}`;
  const rowColorsKey = `studycloud_row_colors_${subject.id}_${term?.id || 't1'}`;

  const [cellColors, setCellColors] = useState<{ [key: string]: string }>(() => {
    try {
      const s = localStorage.getItem(cellColorsKey);
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });

  const [rowColors, setRowColors] = useState<{ [rowId: string]: string }>(() => {
    try {
      const s = localStorage.getItem(rowColorsKey);
      if (s) return JSON.parse(s);
    } catch {}
    return {};
  });

  // Menu contextuel 3 points de colonne
  const [activeMenuCol, setActiveMenuCol] = useState<number | null>(null);

  // Menus contextuels 3 points additionnels
  const [activeMenuCell, setActiveMenuCell] = useState<{ studentId: string; colIndex: number } | null>(null);
  const [activeMenuRow, setActiveMenuRow] = useState<string | null>(null);
  const [activeMenuNameCol, setActiveMenuNameCol] = useState<boolean>(false);
  const [activeMenuPhoto, setActiveMenuPhoto] = useState<string | null>(null);

  // Prévisualisation centrée de photo d'élève (nom, photo, moyenne)
  const [previewPhotoStudent, setPreviewPhotoStudent] = useState<StudentGradeRow | null>(null);

  // Message rouge d'alerte ciblé sur la case où l'utilisateur tente d'écrire une note sans nom d'élève
  const [blockedNoteTarget, setBlockedNoteTarget] = useState<{ studentId: string; colIndex: number } | null>(null);

  // Un seul petit menu peut être ouvert à la fois
  const isAnyMenuOpen = activeMenuCol !== null || activeMenuRow !== null || activeMenuCell !== null || activeMenuNameCol || activeMenuPhoto !== null;

  // Palette de couleur active
  const [activeColorPicker, setActiveColorPicker] = useState<{
    mode: 'cell' | 'column' | 'singleCell' | 'row';
    colIndex?: number;
    studentId?: string;
    targetId?: string | number;
  } | null>(null);

  // Modale de modification d'intitulé et barème de la colonne
  const [editingColModal, setEditingColModal] = useState<{
    colIndex: number;
    title: string;
    maxScore: number;
  } | null>(null);

  // Mode déplacement actif pour une colonne (flèches bleues affichées)
  const [movingColIndex, setMovingColIndex] = useState<number | null>(null);

  // Largeurs personnalisables et modelables des colonnes
  const [colWidthRank, setColWidthRank] = useState<number>(() => {
    try {
      const s = localStorage.getItem(colWidthRankKey);
      if (s) { const n = parseInt(s, 10); if (!isNaN(n) && n >= 55) return n; }
    } catch { }
    return 68;
  });

  const [colWidthPhoto, setColWidthPhoto] = useState<number>(() => {
    try {
      const s = localStorage.getItem(colWidthPhotoKey);
      if (s) { const n = parseInt(s, 10); if (!isNaN(n) && n >= 60) return n; }
    } catch { }
    return 76;
  });

  const [colWidthName, setColWidthName] = useState<number>(() => {
    try {
      const s = localStorage.getItem(colWidthNameKey);
      if (s) { const n = parseInt(s, 10); if (!isNaN(n) && n >= 150) return n; }
    } catch { }
    return 280;
  });

  const [noteColWidth, setNoteColWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(colWidthKey);
      if (saved) {
        const w = parseInt(saved, 10);
        if (!isNaN(w) && w >= 80 && w <= 240) return w;
      }
    } catch { }
    return 84;
  });

  // Largeurs individuelles pour chaque colonne de note
  const [customNoteWidths, setCustomNoteWidths] = useState<{ [index: number]: number }>(() => {
    try {
      const s = localStorage.getItem(customNoteWidthsKey);
      if (s) {
        const parsed = JSON.parse(s);
        if (typeof parsed === 'object') return parsed;
      }
    } catch { }
    return {};
  });

  const [colWidthAverage, setColWidthAverage] = useState<number>(() => {
    try {
      const s = localStorage.getItem(colWidthAvgKey);
      if (s) { const n = parseInt(s, 10); if (!isNaN(n) && n >= 75) return n; }
    } catch { }
    return 104;
  });

  const [colWidthMention, setColWidthMention] = useState<number>(() => {
    try {
      const s = localStorage.getItem(colWidthMentionKey);
      if (s) { const n = parseInt(s, 10); if (!isNaN(n) && n >= 80) return n; }
    } catch { }
    return 108;
  });

  // Hauteurs personnalisées de chaque ligne d'élève
  const [customRowHeights, setCustomRowHeights] = useState<{ [index: number]: number }>(() => {
    try {
      const s = localStorage.getItem(rowHeightsKey);
      if (s) { const parsed = JSON.parse(s); if (typeof parsed === 'object') return parsed; }
    } catch { }
    return {};
  });

  // ÉTAT DE SÉLECTION STRICT : Une seule ligne sélectionnée à la fois (exclusive)
  // Double-clic requis pour sélectionner. Le simple survol ne sélectionne PAS !
  const [selectedLine, setSelectedLine] = useState<{ type: 'col' | 'row'; id: string } | null>(null);
  const [resizingLine, setResizingLine] = useState<{ type: 'col' | 'row'; id: string } | null>(null);

  // Liste des élèves avec leurs notes (Infini, persistance locale)
  const [students, setStudents] = useState<StudentGradeRow[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const maxNotes = Math.max(7, ...parsed.map((p: any) => p.notes?.length || 0));
          return parsed.map((s: any, idx: number) => ({
            id: s.id || `student-${Date.now()}-${idx}`,
            name: s.name || '',
            photoUrl: s.photoUrl,
            notes: Array.from({ length: maxNotes }, (_, i) => s.notes?.[i] || '')
          }));
        }
      }
    } catch { }

    return Array.from({ length: 8 }, (_, i) => ({
      id: `student-${Date.now()}-${i}`,
      name: '',
      photoUrl: undefined,
      notes: Array(7).fill('')
    }));
  });

  // Cellule active pour la barre de formule
  const [activeCellInfo, setActiveCellInfo] = useState<{
    id: string;
    type: 'rank' | 'photo' | 'name' | 'note' | 'average' | 'column' | 'mention';
    rowIndex?: number;
    noteColIndex?: number;
    coordDisplay: string;
    value: string;
  }>({
    id: 'cell-name-0',
    type: 'name',
    rowIndex: 0,
    coordDisplay: 'NOM1',
    value: ''
  });

  // Styles de formatage du ruban
  const [isBold, setIsBold] = useState<boolean>(false);
  const [isItalic, setIsItalic] = useState<boolean>(false);
  const [isUnderline, setIsUnderline] = useState<boolean>(false);
  const [isStrikethrough, setIsStrikethrough] = useState<boolean>(false);
  const [textAlign, setTextAlign] = useState<'left' | 'center' | 'right'>('center');
  const [fontSize, setFontSize] = useState<number>(12);
  const [fontFamily, setFontFamily] = useState<string>('Calibri');

  // Zoom : 70% par défaut
  const [zoomPercent, setZoomPercent] = useState<number>(70);

  // Onglets feuilles
  const [sheetTabs, setSheetTabs] = useState<string[]>(['Feuille1']);
  const [activeSheetTab, setActiveSheetTab] = useState<string>('Feuille1');

  // État de sauvegarde
  const [isSaved, setIsSaved] = useState<boolean>(true);

  // Référence upload photo
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingStudentId, setUploadingStudentId] = useState<string | null>(null);

  // Poignées externes (Astérisque et coin bas-droite)
  const [isDraggingCorner, setIsDraggingCorner] = useState(false);
  const [isDraggingRight, setIsDraggingRight] = useState(false);
  const [dragPreviewRows, setDragPreviewRows] = useState(0);

  // Sauvegarde persistante dans le localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(students));
      localStorage.setItem(colCountKey, noteColumnCount.toString());
      localStorage.setItem(colWidthKey, noteColWidth.toString());
      localStorage.setItem(colWidthRankKey, colWidthRank.toString());
      localStorage.setItem(colWidthPhotoKey, colWidthPhoto.toString());
      localStorage.setItem(colWidthNameKey, colWidthName.toString());
      localStorage.setItem(colWidthAvgKey, colWidthAverage.toString());
      localStorage.setItem(colWidthMentionKey, colWidthMention.toString());
      localStorage.setItem(customNoteWidthsKey, JSON.stringify(customNoteWidths));
      localStorage.setItem(rowHeightsKey, JSON.stringify(customRowHeights));
      localStorage.setItem(colMetasKey, JSON.stringify(columnMetas));
      localStorage.setItem(cellColorsKey, JSON.stringify(cellColors));
      localStorage.setItem(rowColorsKey, JSON.stringify(rowColors));
      setIsSaved(true);
    } catch { }
  }, [students, noteColumnCount, noteColWidth, colWidthRank, colWidthPhoto, colWidthName, colWidthAverage, colWidthMention, customNoteWidths, customRowHeights, columnMetas, storageKey, colCountKey, colWidthKey, colWidthRankKey, colWidthPhotoKey, colWidthNameKey, colWidthAvgKey, colWidthMentionKey, customNoteWidthsKey, rowHeightsKey, colMetasKey]);

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

  // Désélectionner les lignes et fermer les menus avec la touche Échap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Gestion du zoom avec touchpad (Ctrl + wheel) et tactile 2 doigts
  useEffect(() => {
    const container = gridContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.12;
        setZoomPercent(prev => Math.min(200, Math.max(30, Math.round(prev + delta))));
      }
    };

    let initialDistance: number | null = null;
    let initialZoom: number = zoomPercent;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialZoom = zoomPercent;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && initialDistance !== null) {
        e.preventDefault();
        const currentDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const factor = currentDistance / initialDistance;
        const newZoom = Math.min(200, Math.max(30, Math.round(initialZoom * factor)));
        setZoomPercent(newZoom);
      }
    };

    const handleTouchEnd = () => {
      initialDistance = null;
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [zoomPercent]);

  // Calcul automatique de la mention pédagogique selon la moyenne
  const getStudentMention = (average: number | null): { label: string; badgeClass: string } => {
    if (average === null) return { label: '-', badgeClass: 'text-slate-400 font-semibold' };
    if (average >= 16) {
      return { label: 'Très Bien', badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300 font-black' };
    }
    if (average >= 14) {
      return { label: 'Bien', badgeClass: 'bg-teal-100 text-teal-950 border-teal-300 font-extrabold' };
    }
    if (average >= 12) {
      return { label: 'Assez Bien', badgeClass: 'bg-sky-100 text-sky-950 border-sky-300 font-extrabold' };
    }
    if (average >= 10) {
      return { label: 'Passable', badgeClass: 'bg-amber-100 text-amber-950 border-amber-300 font-bold' };
    }
    if (average >= 8) {
      return { label: 'Insuffisant', badgeClass: 'bg-orange-100 text-orange-950 border-orange-300 font-bold' };
    }
    return { label: 'Faible', badgeClass: 'bg-rose-100 text-rose-950 border-rose-300 font-bold' };
  };

  // Calcul dynamique des moyennes, des mentions et des rangs en temps réel
  // Si un élève a une note > noteMaximale, sa moyenne n'est pas calculée (grisée avec '...') et rang '-'
  const studentsWithStats = useMemo(() => {
    const withAverage = students.map((std, idx) => {
      let hasInvalidNote = false;
      const studentNotes = std.notes.slice(0, noteColumnCount);

      const parsedNotes = studentNotes.map((rawNote, cIdx) => {
        const colDefaultMax = columnMetas[cIdx]?.maxScore || 20;
        return parseStudentNote(rawNote, colDefaultMax);
      });

      for (const p of parsedNotes) {
        if (p.isInvalid) {
          hasInvalidNote = true;
          break;
        }
      }

      if (hasInvalidNote) {
        return {
          ...std,
          rowNumber: idx + 1,
          average: null,
          averageFormatted: '...',
          mention: '-',
          mentionClass: 'text-slate-400 font-semibold',
          hasInvalidNote: true,
          rank: '-'
        };
      }

      // Notes valides ramenées sur 20 pour un calcul équitable
      const validScoresOn20 = parsedNotes
        .filter(p => p.scoreNum !== null && !p.isInvalid)
        .map(p => (p.scoreNum! / p.maxScore) * 20);

      const avg = validScoresOn20.length > 0
        ? validScoresOn20.reduce((sum, val) => sum + val, 0) / validScoresOn20.length
        : null;

      const mentionInfo = getStudentMention(avg);

      return {
        ...std,
        rowNumber: idx + 1,
        average: avg,
        averageFormatted: avg !== null ? avg.toFixed(2) : '',
        mention: mentionInfo.label,
        mentionClass: mentionInfo.badgeClass,
        hasInvalidNote: false,
        rank: ''
      };
    });

    const sortedActive = [...withAverage]
      .filter(s => s.average !== null && !s.hasInvalidNote)
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

    return withAverage.map(s => {
      if (s.hasInvalidNote) {
        return { ...s, rank: '-' };
      }
      return {
        ...s,
        rank: rankMap.get(s.id) || (s.name.trim() ? '-' : '')
      };
    });
  }, [students, noteColumnCount, columnMetas]);

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
      id: `student-${Date.now()}-${students.length}`,
      name: '',
      photoUrl: undefined,
      notes: Array(noteColumnCount).fill('')
    };
    setStudents(prev => [...prev, newStudent]);
    setIsSaved(false);
  };

  // Ajout de plusieurs lignes d'élèves
  const handleAddMultipleStudentRows = (count: number) => {
    if (count <= 0) return;
    setStudents(prev => {
      const newRows: StudentGradeRow[] = Array.from({ length: count }, (_, i) => ({
        id: `student-${Date.now()}-${prev.length + i}`,
        name: '',
        photoUrl: undefined,
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
        id: `student-${Date.now()}-0`,
        name: '',
        photoUrl: undefined,
        notes: Array(noteColumnCount).fill('')
      }]);
      return;
    }
    setStudents(prev => prev.filter(s => s.id !== studentId));
    setIsSaved(false);
  };

  // Upload photo
  const handleTriggerPhotoUpload = (studentId: string) => {
    setUploadingStudentId(studentId);
    photoInputRef.current?.click();
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingStudentId) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const targetStudentId = uploadingStudentId;
      setStudents(prev => {
        const studentIndex = prev.findIndex(s => s.id === targetStudentId);
        if (studentIndex >= 0) {
          setCustomRowHeights(rowPrev => ({
            ...rowPrev,
            [studentIndex]: Math.max(rowPrev[studentIndex] || 44, 80)
          }));
        }
        return prev.map(s => s.id === targetStudentId ? { ...s, photoUrl: base64 } : s);
      });
      // La case grandit automatiquement en largeur et en hauteur pour un affichage carré optimal
      setColWidthPhoto(prev => Math.max(prev, 80));
      setIsSaved(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
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

  // Recopier une note vers le bas pour tous les élèves suivants
  const handleFillDown = (colIndex: number, fromRowIndex: number) => {
    const sourceStudent = students[fromRowIndex];
    if (!sourceStudent) return;
    const sourceNote = sourceStudent.notes[colIndex] || '';

    setStudents(prev => prev.map((s, idx) => {
      if (idx <= fromRowIndex) return s;
      const copyNotes = [...s.notes];
      copyNotes[colIndex] = sourceNote;
      return { ...s, notes: copyNotes };
    }));
    setIsSaved(false);
  };

  // =========================================================================
  // GESTION INDIVIDUELLE DES COLONNES : Chaque séparateur a son ID unique !
  // Aucune ligne ne se mélange. Double-clic obligatoire pour sélectionner.
  // =========================================================================
  const getColWidth = (colId: string): number => {
    if (colId === 'col-rank') return colWidthRank;
    if (colId === 'col-photo') return colWidthPhoto;
    if (colId === 'col-name') return colWidthName;
    if (colId.startsWith('col-note-')) {
      const idx = parseInt(colId.replace('col-note-', ''), 10);
      return customNoteWidths[idx] || noteColWidth;
    }
    if (colId === 'col-moyenne') return colWidthAverage;
    if (colId === 'col-mention') return colWidthMention;
    return 72;
  };

  const getColMinWidth = (colId: string): number => {
    if (colId === 'col-rank') return 60;
    if (colId === 'col-photo') {
      const hasAnyPhoto = students.some(s => Boolean(s.photoUrl));
      return hasAnyPhoto ? 76 : 60;
    }
    if (colId === 'col-name') return getMinNameColWidth(students);
    if (colId.startsWith('col-note-')) return 80;
    if (colId === 'col-moyenne') return 88;
    if (colId === 'col-mention') return 88;
    return 60;
  };

  const setColWidth = (colId: string, w: number) => {
    if (colId === 'col-rank') setColWidthRank(w);
    else if (colId === 'col-photo') {
      const hasAnyPhoto = students.some(s => Boolean(s.photoUrl));
      const minW = hasAnyPhoto ? 76 : 60;
      setColWidthPhoto(Math.max(minW, w));
    }
    else if (colId === 'col-name') setColWidthName(w);
    else if (colId.startsWith('col-note-')) {
      const idx = parseInt(colId.replace('col-note-', ''), 10);
      setCustomNoteWidths(prev => ({ ...prev, [idx]: Math.max(80, w) }));
    }
    else if (colId === 'col-moyenne') setColWidthAverage(Math.max(88, w));
    else if (colId === 'col-mention') setColWidthMention(Math.max(88, w));
  };

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

  // Lancement du redimensionnement ou de la sélection d'une colonne verticale spécifique
  const handleStartColResize = (e: React.MouseEvent | React.TouchEvent, colId: string) => {
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialWidth = getColWidth(colId);
    const minWidth = getColMinWidth(colId);
    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = curX - startX;
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

    const handleMouseUp = (upEvent: MouseEvent | TouchEvent) => {
      upEvent.stopPropagation();
      setResizingLine(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  // Lancement du redimensionnement ou de la sélection d'une ligne d'élève horizontale spécifique
  const handleStartRowResize = (e: React.MouseEvent | React.TouchEvent, rowIndex: number) => {
    e.stopPropagation();
    const rowKey = `row-${rowIndex}`;

    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const initialHeight = customRowHeights[rowIndex] || 44;
    const hasPhoto = Boolean(students[rowIndex]?.photoUrl);
    const minHeight = hasPhoto ? 76 : 44;
    let hasMoved = false;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = curY - startY;
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

    const handleMouseUp = (upEvent: MouseEvent | TouchEvent) => {
      upEvent.stopPropagation();
      setResizingLine(null);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('touchend', handleMouseUp);
  };

  // Poignée interactive discrète superposée sur la bordure droite de chaque colonne
  // Ne casse PAS le flex ni les bordures CSS normales : position absolue z-30
  // AUCUNE COULEUR N'APPARAÎT AU SIMPLE SURVOL OU TOUCHER TANT QUE CE N'EST PAS SÉLECTIONNÉ !
  // Quand sélectionné : la bordure elle-même change en bleu ciel fin (border-sky-500)
  const renderColHandle = (colId: string) => {
    return (
      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setSelectedLine(prev => (prev?.type === 'col' && prev.id === colId) ? null : { type: 'col', id: colId });
        }}
        onMouseDown={(e) => handleStartColResize(e, colId)}
        onTouchStart={(e) => handleStartColResize(e, colId)}
        className={`absolute top-0 -right-1.5 w-3 h-full cursor-col-resize z-30 select-none flex items-center justify-center bg-transparent ${
          isAnyMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        title={isAnyMenuOpen ? undefined : "Double-cliquer pour sélectionner le trait vertical, glisser pour agrandir/réduire"}
      />
    );
  };

  // Poignée interactive discrète superposée sur la bordure inférieure de chaque ligne d'élève
  // Ne casse PAS la hauteur ni les bordures : position absolue z-30
  // AUCUNE COULEUR N'APPARAÎT AU SIMPLE TOUCHER TANT QUE CE N'EST PAS SÉLECTIONNÉ !
  // Quand sélectionné : la bordure elle-même change en bleu ciel fin (border-sky-500)
  const renderRowHandle = (rowIndex: number) => {
    const rowKey = `row-${rowIndex}`;
    return (
      <div
        onDoubleClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setSelectedLine(prev => (prev?.type === 'row' && prev.id === rowKey) ? null : { type: 'row', id: rowKey });
        }}
        onMouseDown={(e) => handleStartRowResize(e, rowIndex)}
        onTouchStart={(e) => handleStartRowResize(e, rowIndex)}
        className={`absolute -bottom-1.5 left-0 w-full h-3 cursor-row-resize z-30 select-none flex items-center justify-center bg-transparent ${
          isAnyMenuOpen ? 'pointer-events-none' : 'pointer-events-auto'
        }`}
        title={isAnyMenuOpen ? undefined : "Double-cliquer pour sélectionner la ligne, glisser pour agrandir/réduire"}
      />
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
      const newWidth = Math.max(80, Math.min(240, Math.round(startWidth + deltaX)));
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
      const noteHeaders = Array.from({ length: noteColumnCount }, (_, i) => {
        const meta = columnMetas[i];
        const title = meta?.title || 'NOTE';
        const max = meta?.maxScore || 20;
        return `${title} ${i + 1} (/${max})`;
      });
      const headers = ['Rang', 'Nom & Prénom', ...noteHeaders, 'Moyenne (/20)', 'Mention'];
      const dataRows = studentsWithStats.map(s => {
        const notesFormatted = s.notes.slice(0, noteColumnCount).map((n, i) => {
          const meta = columnMetas[i];
          const parsed = parseStudentNote(n, meta?.maxScore || 20);
          return parsed.scoreStr ? `${parsed.scoreStr}/${parsed.maxScore}` : '';
        });
        return [
          s.rank,
          s.name,
          ...notesFormatted,
          s.hasInvalidNote ? '...' : s.averageFormatted,
          s.mention || '-'
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, activeSheetTab);

      const safeName = `Releve_Notes_${subject.name}_${schoolClass.level}_${term?.name || 'T1'}.xlsx`.replace(/[^\w\d-_.]/g, '_');
      XLSX.writeFile(wb, safeName);
    } catch (err) {
      console.error('Erreur export Excel:', err);
    }
  };

  // Nouvelle feuille
  const handleAddSheet = () => {
    const newName = `Feuille${sheetTabs.length + 1}`;
    setSheetTabs(prev => [...prev, newName]);
    setActiveSheetTab(newName);
  };

  // Nombre total de colonnes et lignes d'arrière-plan
  const backgroundColCount = Math.max(68, noteColumnCount + RIGHT_EXTRA_COLS + 16);
  const backgroundRowCount = Math.max(65, students.length + 35);

  return (
    <div 
      onClick={() => {
        // Clic sur l'espace extérieur désélectionne toute ligne et ferme les menus
        if (selectedLine) setSelectedLine(null);
        if (activeMenuCol !== null) setActiveMenuCol(null);
        if (activeMenuCell !== null) setActiveMenuCell(null);
        if (activeMenuRow !== null) setActiveMenuRow(null);
        if (activeMenuNameCol) setActiveMenuNameCol(false);
        if (activeMenuPhoto !== null) setActiveMenuPhoto(null);
        if (activeColorPicker !== null) setActiveColorPicker(null);
        if (blockedNoteTarget) setBlockedNoteTarget(null);
      }}
      className={`w-full flex flex-col bg-[#eef2f6] text-slate-800 font-sans select-none overflow-hidden transition-all duration-300 ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : 'relative w-full h-full min-h-dvh'
      }`}
    >
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
      <header className="h-11 sm:h-12 bg-white border-b border-slate-300 px-2 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-20 shadow-xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs border border-slate-300/90 shadow-2xs transition active:scale-95 cursor-pointer shrink-0"
            title="Retour à la liste des matières"
          >
            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5] text-slate-700" />
            <span className="leading-none hidden xs:inline">Retour</span>
          </button>

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
              <span className="text-slate-400 font-normal hidden sm:inline">•</span>
              <span className="text-slate-600 font-semibold truncate hidden sm:inline">{schoolClass.level} {schoolClass.name || ''}</span>
              <span className="text-slate-400 font-normal hidden md:inline">•</span>
              <span className="text-cyan-800 font-bold bg-cyan-50 px-2 py-0.5 rounded text-[10px] border border-cyan-200/80 hidden md:inline-block">
                {term?.name || 'Trimestre 1'}
              </span>
            </div>
          </div>
        </div>

        {/* BOUTONS ZOOM HAUT DROIT */}
        <div className="flex items-center gap-2 shrink-0">
          <div 
            className="flex items-center bg-slate-100 hover:bg-slate-200/90 border border-slate-300 rounded-lg p-0.5 shadow-2xs transition"
            title="Contrôle du zoom d'affichage"
          >
            <button
              type="button"
              onClick={() => setZoomPercent(prev => Math.max(30, prev - 10))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 transition active:scale-90 cursor-pointer"
              title="Zoom arrière (-10%)"
            >
              <Minus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
            <span 
              onClick={() => setZoomPercent(70)}
              className="text-[11px] font-mono font-black text-slate-800 px-1.5 min-w-[36px] text-center cursor-pointer hover:text-blue-600 transition select-none"
              title="Cliquer pour réinitialiser le zoom à 70%"
            >
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => setZoomPercent(prev => Math.min(200, prev + 10))}
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-white text-slate-700 transition active:scale-90 cursor-pointer"
              title="Zoom avant (+10%)"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportExcel}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition shadow-2xs cursor-pointer active:scale-95"
            title="Télécharger cette feuille au format Excel (.xlsx)"
          >
            <Download className="w-3 h-3 text-emerald-700" />
            <span className="hidden md:inline">Exporter .xlsx</span>
          </button>

          <span className="text-[10px] text-slate-400 font-medium hidden lg:inline">
            {isSaved ? 'Enregistré' : 'Enregistrement...'}
          </span>

          <div className="flex items-center gap-1.5 shrink-0 ml-0.5">
            <ViewerSuperExpandButton
              expandLevel={viewerExpandLevel}
              onExpandChange={(lvl) => {
                if (lvl >= 1) setIsViewerMaximized(true);
                else setIsViewerMaximized(false);
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
      {/* 2. RUBAN D'OUTILS STYLE WPS OFFICE / EXCEL */}
      {/* ========================================================================= */}
      <section className="bg-[#f3f4f6] border-b border-slate-300 px-2 py-1 flex items-stretch gap-1 sm:gap-2 overflow-x-auto text-slate-700 shrink-0 select-none">
        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80 min-w-[52px]">
          <div className="flex items-center gap-1 mt-0.5">
            <button type="button" className="p-1 rounded hover:bg-slate-200 text-slate-700 transition" title="Coller">
              <Clipboard className="w-4 h-4 text-amber-600" />
            </button>
            <button type="button" className="p-1 rounded hover:bg-slate-200 text-slate-700 transition" title="Format Painter">
              <Paintbrush className="w-3.5 h-3.5 text-blue-600" />
            </button>
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">Coller</span>
        </div>

        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80">
          <div className="flex items-center gap-1">
            <div className="flex items-center h-6 px-1.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800">
              <span>{fontFamily}</span>
              <ChevronDown className="w-3 h-3 ml-1 text-slate-500" />
            </div>
            <div className="flex items-center h-6 px-1.5 bg-white border border-slate-300 rounded text-[11px] font-medium text-slate-800">
              <span>{fontSize}</span>
              <ChevronDown className="w-3 h-3 ml-1 text-slate-500" />
            </div>
            <button type="button" onClick={() => setFontSize(prev => Math.min(24, prev + 1))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-700 font-bold text-xs">
              A<sup>+</sup>
            </button>
            <button type="button" onClick={() => setFontSize(prev => Math.max(8, prev - 1))} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-200 text-slate-700 font-bold text-xs">
              A<sup>-</sup>
            </button>
          </div>

          <div className="flex items-center gap-0.5 mt-1">
            <button type="button" onClick={() => setIsBold(!isBold)} className={`w-5 h-5 flex items-center justify-center rounded transition ${isBold ? 'bg-slate-300 text-slate-900 font-black' : 'hover:bg-slate-200 text-slate-700'}`}>
              <Bold className="w-3 h-3 stroke-[2.8]" />
            </button>
            <button type="button" onClick={() => setIsItalic(!isItalic)} className={`w-5 h-5 flex items-center justify-center rounded transition ${isItalic ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}>
              <Italic className="w-3 h-3 stroke-[2.5]" />
            </button>
            <button type="button" onClick={() => setIsUnderline(!isUnderline)} className={`w-5 h-5 flex items-center justify-center rounded transition ${isUnderline ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}>
              <Underline className="w-3 h-3 stroke-[2.5]" />
            </button>
            <button type="button" onClick={() => setIsStrikethrough(!isStrikethrough)} className={`w-5 h-5 flex items-center justify-center rounded transition ${isStrikethrough ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}>
              <Strikethrough className="w-3 h-3 stroke-[2.5]" />
            </button>
            <div className="flex items-center p-0.5 rounded hover:bg-slate-200 cursor-pointer">
              <Grid3X3 className="w-3 h-3 text-slate-700" />
            </div>
            <div className="flex items-center p-0.5 rounded hover:bg-slate-200 cursor-pointer">
              <PaintBucket className="w-3 h-3 text-amber-500" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between px-1.5 border-r border-slate-300/80">
          <div className="flex items-center gap-1 mt-0.5">
            <button type="button" onClick={() => setTextAlign('left')} className={`p-1 rounded transition ${textAlign === 'left' ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}>
              <AlignLeft className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setTextAlign('center')} className={`p-1 rounded transition ${textAlign === 'center' ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}>
              <AlignCenter className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => setTextAlign('right')} className={`p-1 rounded transition ${textAlign === 'right' ? 'bg-slate-300 text-slate-900' : 'hover:bg-slate-200 text-slate-700'}`}>
              <AlignRight className="w-3.5 h-3.5" />
            </button>
            <button type="button" className="p-1 rounded hover:bg-slate-200 text-slate-700" title="Renvoyer à la ligne">
              <WrapText className="w-3.5 h-3.5" />
            </button>
          </div>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">Alignement</span>
        </div>

        <div className="flex flex-col items-center justify-between px-1.5">
          <button type="button" className="flex items-center gap-1 px-2 py-0.5 rounded hover:bg-slate-200 transition text-slate-800 mt-0.5 active:scale-95" title="Moyennes calculées">
            <Sigma className="w-4 h-4 text-emerald-700 stroke-[2.5]" />
            <span className="text-[10px] font-bold">Moyenne</span>
          </button>
          <span className="text-[9px] text-slate-500 font-medium leading-none mb-0.5">Données</span>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. BARRE DE FORMULE EXCEL (Coordonnée active | fx | Champ de saisie) */}
      {/* ========================================================================= */}
      <section className="h-7 sm:h-8 bg-white border-b border-slate-300 px-2 flex items-center gap-2 text-xs shrink-0 select-none">
        <div className="flex items-center justify-between w-18 sm:w-22 h-6 px-1.5 bg-[#f9fafb] border border-slate-300 rounded text-slate-700 font-mono font-bold text-[11px]">
          <span>{activeCellInfo.coordDisplay}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </div>
        <div className="w-[1px] h-4 bg-slate-300" />
        <div className="flex items-center justify-center w-5 h-5 text-slate-500 font-serif italic font-bold text-xs select-none">
          fx
        </div>
        <input
          type="text"
          value={activeCellInfo.value}
          readOnly={activeCellInfo.type === 'rank' || activeCellInfo.type === 'average' || activeCellInfo.type === 'photo' || activeCellInfo.type === 'column' || activeCellInfo.type === 'mention'}
          onChange={(e) => {
            const val = e.target.value;
            setActiveCellInfo(prev => ({ ...prev, value: val }));
            if (activeCellInfo.type === 'name') {
              const std = students[activeCellInfo.rowIndex];
              if (std) handleNameChange(std.id, val);
            } else if (activeCellInfo.type === 'note' && activeCellInfo.noteColIndex !== undefined) {
              const std = students[activeCellInfo.rowIndex];
              if (std) handleRawNoteChange(std.id, activeCellInfo.noteColIndex, val);
            }
          }}
          placeholder="Sélectionnez une case du tableau pour voir ou modifier sa valeur..."
          className="flex-1 h-6 px-2 bg-transparent text-slate-800 font-medium text-xs outline-none focus:bg-blue-50/40 rounded transition"
        />
      </section>

      {/* ========================================================================= */}
      {/* 4. GRILLE DE TABLEUR EXCEL / WPS : TABLEAU ENRICHI AVEC LIGNES INTÉRIEURES */}
      {/* SÉLECTIONNABLES PAR DOUBLE-CLIC, GLISSABLES POUR AGRANDIR/RÉDUIRE,         */}
      {/* TEXTES PARFAITEMENT CENTRÉS ET RETOUR À LA LIGNE AUTOMATIQUE SANS COUPURE */}
      {/* ========================================================================= */}
      <div 
        ref={gridContainerRef}
        className="flex-1 overflow-auto bg-[#fafbfc] relative p-2 sm:p-3 touch-pan-x touch-pan-y"
        style={{
          zoom: `${zoomPercent}%`
        }}
      >
        <div className="inline-block min-w-full">
          {/* Ligne d'en-tête de colonnes Excel (A, B, C, ... AV puis reprend à zéro A, B...) */}
          <div className="flex items-center mb-0 sticky top-0 z-10 select-none">
            <div className="w-9 h-6 bg-[#f1f5f9] border-r border-b border-slate-300 text-[10px] flex items-center justify-center font-mono text-slate-400 shrink-0">
              ◢
            </div>
            {Array.from({ length: backgroundColCount }).map((_, c) => (
              <div 
                key={`excel-col-letter-${c}`} 
                className="w-16 h-6 border-r border-b border-slate-300 bg-[#f8fafc] text-slate-500 font-mono text-[10.5px] font-semibold flex items-center justify-center shrink-0"
              >
                {getExcelColumnLabel(c)}
              </div>
            ))}
          </div>

          <div className="flex items-start">
            {/* Colonne de numéros de lignes Excel à gauche (1, 2, 3...) */}
            <div className="flex flex-col shrink-0 select-none sticky left-0 z-10">
              {Array.from({ length: backgroundRowCount }).map((_, r) => (
                <div 
                  key={`excel-row-num-${r}`} 
                  className="w-9 h-11 border-b border-r border-slate-300 bg-[#f8fafc] text-slate-500 font-mono text-[10px] font-semibold flex items-center justify-center shrink-0"
                >
                  {r + 1}
                </div>
              ))}
            </div>

            {/* Zone principale contenant le tableau et la grille environnante */}
            <div className="relative shrink-0">
              {/* Petites cases de fond au-dessus du tableau (Ligne 1) */}
              <div className="flex">
                {Array.from({ length: backgroundColCount }).map((_, c) => (
                  <div 
                    key={`top-grid-${c}`} 
                    className="w-16 h-6 border-r border-b border-slate-300 bg-white"
                  />
                ))}
              </div>

              <div className="flex items-start">
                {/* Petites cases de fond à gauche du tableau */}
                <div className="flex flex-col shrink-0">
                  {Array.from({ length: studentsWithStats.length + 3 }).map((_, r) => (
                    <div 
                      key={`left-grid-${r}`} 
                      className="w-16 h-11 border-b border-r border-slate-300 bg-white"
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
                  {/* TOILE DE FOND TRANSPARENTE FERMANT TOUT MENU AU CLIC EXTÉRIEUR */}
                  {isAnyMenuOpen && (
                    <div 
                      className="fixed inset-0 z-40 bg-transparent cursor-default" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveMenuCol(null);
                        setActiveMenuRow(null);
                        setActiveMenuCell(null);
                        setActiveMenuNameCol(false);
                        setActiveMenuPhoto(null);
                        setActiveColorPicker(null);
                      }}
                    />
                  )}

                  {/* EN-TÊTE DU TABLEAU : MOTS EN GRAND CARACTÈRE, BIEN CENTRÉS */}
                  <div className="flex bg-[#f1f5f9] border-b-2 border-slate-900 select-none items-stretch text-slate-900 w-fit">
                    {/* 1. RANG */}
                    <div 
                      style={{ width: `${colWidthRank}px`, minWidth: `${colWidthRank}px`, maxWidth: `${colWidthRank}px` }}
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
                      className={`h-12 border-r ${isColActive('col-rank') ? 'border-sky-500 z-10' : 'border-slate-700'} flex items-center justify-center p-1 text-center bg-[#f1f5f9] shrink-0 relative cursor-pointer`}
                      title="Rang de l'élève (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        RANG
                      </span>
                      {renderColHandle('col-rank')}
                    </div>

                    {/* 2. PROFIL / PHOTO */}
                    <div 
                      style={{ width: `${colWidthPhoto}px`, minWidth: `${colWidthPhoto}px`, maxWidth: `${colWidthPhoto}px` }}
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
                      className={`h-12 border-r ${isColActive('col-photo') ? 'border-sky-500 z-10' : 'border-slate-700'} flex items-center justify-center p-1 text-center bg-[#f1f5f9] shrink-0 relative cursor-pointer`}
                      title="Profil / Photo (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        PROFIL
                      </span>
                      {renderColHandle('col-photo')}
                    </div>

                    {/* 3. NOM & PRÉNOM */}
                    <div 
                      style={{ width: `${colWidthName}px`, minWidth: `${colWidthName}px`, maxWidth: `${colWidthName}px` }}
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
                      className={`h-12 border-r ${isColActive('col-name') ? 'border-sky-500 z-10' : 'border-slate-700'} flex items-center justify-center p-1 text-center bg-[#f1f5f9] shrink-0 relative group cursor-pointer`}
                      title="Nom et Prénom (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        NOM & PRÉNOM
                      </span>

                      {/* BOUTON 3 POINTS ⋮ POUR LA COLONNE NOM & PRÉNOM */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuNameCol(prev => !prev);
                          setActiveMenuCol(null);
                          setActiveMenuRow(null);
                          setActiveMenuCell(null);
                          setActiveColorPicker(null);
                        }}
                        className={`absolute top-1 right-1 p-0.5 rounded transition cursor-pointer z-10 border-0 shadow-none ${
                          activeMenuNameCol
                            ? 'text-sky-600 bg-sky-100/70'
                            : 'text-slate-800 hover:text-black hover:bg-slate-200/60'
                        }`}
                        title="Options de la colonne NOM & PRÉNOM (Tri alphabétique, ajout d'élèves, etc.)"
                      >
                        <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      {/* MENU CONTEXTUEL POUR NOM & PRÉNOM */}
                      {activeMenuNameCol && (
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg shadow-2xl py-1.5 z-50 text-left text-xs select-none animate-in fade-in zoom-in-95"
                        >
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
                      )}

                      {renderColHandle('col-name')}
                    </div>

                    {/* 4. COLONNES DE NOTES DYNAMIQUES */}
                    {Array.from({ length: noteColumnCount }).map((_, i) => {
                      const colMeta = columnMetas[i] || { maxScore: 20 };
                      const colTitle = colMeta.title || 'NOTE';
                      const headerBg = colMeta.headerBgColor || colMeta.columnBgColor || '#f1f5f9';
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
                          className={`h-12 border-r ${isColActive(`col-note-${i}`) ? 'border-sky-500 z-10' : 'border-slate-700'} flex flex-col items-center justify-center p-1 text-center relative group shrink-0 transition-colors cursor-pointer ${
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

                          {/* TITRE ET NUMÉRO AUTOMATIQUE */}
                          <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase truncate px-1">
                            {colTitle} {i + 1}
                          </span>
                          <span className="text-[9.5px] font-bold text-slate-500">
                            /{colMeta.maxScore}
                          </span>

                          {/* BOUTON 3 POINTS ⋮ SUR L'EN-TÊTE DE LA COLONNE DE NOTE */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuCol(prev => prev === i ? null : i);
                              setActiveColorPicker(null);
                              setActiveMenuNameCol(false);
                              setActiveMenuRow(null);
                              setActiveMenuCell(null);
                            }}
                            className={`absolute top-1 right-1 p-0.5 rounded transition cursor-pointer z-10 border-0 shadow-none ${
                              isMenuOpen
                                ? 'text-sky-600 bg-sky-100/70'
                                : 'text-slate-800 hover:text-black hover:bg-slate-200/60'
                            }`}
                            title={`Options de la colonne ${colTitle} ${i + 1}`}
                          >
                            <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                          </button>

                          {/* MENU CONTEXTUEL RECTANGULAIRE SOIGNÉ */}
                          {isMenuOpen && (
                            <div 
                              onClick={(e) => e.stopPropagation()}
                              className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg shadow-2xl py-1.5 z-50 text-left text-xs select-none animate-in fade-in zoom-in-95"
                            >
                              {/* 1. Modifier */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMenuCol(null);
                                  setEditingColModal({
                                    colIndex: i,
                                    title: colMeta.title || 'NOTE',
                                    maxScore: colMeta.maxScore || 20
                                  });
                                }}
                                className="w-full px-3 py-1.5 flex items-center gap-2 hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-blue-600" />
                                <span>Modifier l'intitulé & barème</span>
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
                                  const targetStudentId = activeCellInfo.rowIndex >= 0 ? students[activeCellInfo.rowIndex]?.id : students[0]?.id;
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
                          )}

                          {/* Poignée interactive de sélection & redimensionnement de colonne */}
                          {renderColHandle(`col-note-${i}`)}
                        </div>
                      );
                    })}

                    {/* 5. BOUTON [+] AJOUTER UNE NOUVELLE NOTE */}
                    <div 
                      style={{ width: '48px', minWidth: '48px', maxWidth: '48px' }}
                      className="h-12 border-r border-slate-700 flex items-center justify-center bg-slate-200/70 hover:bg-blue-100 transition cursor-pointer shrink-0 relative"
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

                    {/* 6. MOYENNE */}
                    <div 
                      style={{ width: `${colWidthAverage}px`, minWidth: `${colWidthAverage}px`, maxWidth: `${colWidthAverage}px` }}
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
                      className={`h-12 border-r ${
                        isColActive('col-moyenne') ? 'border-sky-500 z-10' : 'border-slate-700'
                      } flex items-center justify-center p-1 text-center bg-blue-100/70 shrink-0 relative cursor-pointer`}
                      title="Moyenne générale (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span className="font-black text-xs sm:text-sm text-blue-950 tracking-wider uppercase">
                        MOYENNE
                      </span>
                      {renderColHandle('col-moyenne')}
                    </div>

                    {/* 7. MENTION */}
                    <div 
                      style={{ width: `${colWidthMention}px`, minWidth: `${colWidthMention}px`, maxWidth: `${colWidthMention}px` }}
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
                      className={`h-12 border-r ${
                        isColActive('col-mention') ? 'border-sky-500 z-10' : 'border-slate-700'
                      } flex items-center justify-center p-1 text-center bg-emerald-100/70 shrink-0 relative cursor-pointer`}
                      title="Mention pédagogique (Double-cliquer pour sélectionner le trait vertical)"
                    >
                      <span className="font-black text-xs sm:text-sm text-emerald-950 tracking-wider uppercase">
                        MENTION
                      </span>
                      {renderColHandle('col-mention')}
                    </div>
                  </div>

                  {/* ================================================================= */}
                  {/* CORPS DU TABLEAU : LIGNES D'ÉLÈVES BIEN TRACÉES                   */}
                  {/* ================================================================= */}
                  <div className="bg-white">
                    {studentsWithStats.map((std, rIdx) => {
                      const isRowSelected = activeCellInfo.rowIndex === rIdx;
                      const rowHeight = customRowHeights[rIdx] || 44;
                      const isRowLineActive = isRowActive(rIdx);
                      const rowBg = rowColors[std.id];
                      const nameCellBg = cellColors[`${std.id}_name`] || rowBg || undefined;

                      return (
                        <div 
                          key={std.id}
                          style={{ height: `${rowHeight}px` }}
                          className={`flex items-stretch transition-colors relative w-fit ${
                            isRowSelected ? 'bg-blue-50/40' : 'hover:bg-slate-50/70'
                          }`}
                        >
                          {/* RANG */}
                          <div 
                            style={{ 
                              width: `${colWidthRank}px`, 
                              minWidth: `${colWidthRank}px`,
                              maxWidth: `${colWidthRank}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: rowBg || undefined
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
                            className={`border-r ${isColActive('col-rank') ? 'border-sky-500 z-10' : 'border-slate-700'} border-b ${isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'} flex items-center justify-center p-1 cursor-pointer relative shrink-0 ${
                              activeCellInfo.id === `cell-rank-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-emerald-50/40' : ''
                            }`}
                            title="Cliquer pour sélectionner, double-cliquer pour sélectionner la ligne"
                          >
                            {std.rank ? (
                              <span className={`px-2.5 py-1 rounded-md text-sm sm:text-base font-black shadow-xs tracking-tight ${
                                std.rank === '1er'
                                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border border-amber-400 ring-2 ring-amber-300/60'
                                  : std.rank.startsWith('2e')
                                  ? 'bg-slate-200 text-slate-900 border border-slate-300'
                                  : std.rank.startsWith('3e')
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-800 border border-slate-200'
                              }`}>
                                {std.rank}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-sm font-bold">-</span>
                            )}
                            {renderColHandle('col-rank')}
                          </div>

                          {/* PROFIL / PHOTO : IMAGE CARRÉE OCCUPANT TOUT L'ESPACE AVEC MENU 3 POINTS VISIBLE */}
                          <div 
                            style={{ 
                              width: `${colWidthPhoto}px`, 
                              minWidth: `${colWidthPhoto}px`,
                              maxWidth: `${colWidthPhoto}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: rowBg || undefined
                            }}
                            className={`border-r ${isColActive('col-photo') ? 'border-sky-500 z-10' : 'border-slate-700'} border-b ${isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'} flex items-center justify-center p-0 relative group shrink-0 ${
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
                                    className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition duration-200" 
                                  />
                                </div>

                                {/* BOUTON 3 POINTS ⋮ POUR LA PHOTO */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuPhoto(prev => prev === std.id ? null : std.id);
                                    setActiveMenuRow(null);
                                    setActiveMenuCol(null);
                                    setActiveMenuCell(null);
                                    setActiveMenuNameCol(false);
                                    setActiveColorPicker(null);
                                  }}
                                  className={`absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-30 border-0 shadow-none ${
                                    activeMenuPhoto === std.id
                                      ? 'text-white bg-black/70'
                                      : 'text-slate-900 hover:text-black bg-white/70 hover:bg-white/90 drop-shadow-xs'
                                  }`}
                                  title="Options de la photo (Remplacer / Supprimer)"
                                >
                                  <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>

                                {/* MENU CONTEXTUEL PHOTO - Hors d'overflow-hidden pour être 100% visible ! */}
                                {activeMenuPhoto === std.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className={`absolute ${rIdx >= students.length - 2 ? 'bottom-full mb-1' : 'top-full mt-1'} left-0 w-48 bg-white border border-slate-300 rounded-lg shadow-2xl py-1.5 z-50 text-left text-xs select-none animate-in fade-in zoom-in-95`}
                                  >
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
                                        setStudents(prev => prev.map(s => s.id === std.id ? { ...s, photoUrl: undefined } : s));
                                        setIsSaved(false);
                                      }}
                                      className="w-full px-3 py-2 flex items-center gap-2 hover:bg-red-50 text-red-600 transition"
                                    >
                                      <Trash2 className="w-4 h-4 text-red-500" />
                                      <span className="font-semibold">Supprimer la photo</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleTriggerPhotoUpload(std.id)}
                                className="w-full h-full flex flex-col items-center justify-center bg-slate-50 hover:bg-blue-50/70 text-slate-400 hover:text-blue-600 transition cursor-pointer p-0.5"
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

                          {/* NOM & PRÉNOM */}
                          <div 
                            style={{ 
                              width: `${colWidthName}px`, 
                              minWidth: `${colWidthName}px`,
                              maxWidth: `${colWidthName}px`,
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
                            className={`border-r ${isColActive('col-name') ? 'border-sky-500 z-10' : 'border-slate-700'} border-b ${isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'} flex items-center p-1.5 relative group shrink-0 ${
                              blockedNoteTarget?.studentId === std.id && !(std.name || '').trim() ? 'ring-2 ring-red-500 bg-red-50/60' : ''
                            } ${
                              activeCellInfo.id === `cell-name-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' : ''
                            }`}
                          >
                            <input
                              id={`input-name-${std.id}`}
                              type="text"
                              value={std.name}
                              onChange={(e) => {
                                handleNameChange(std.id, e.target.value);
                                if (blockedNoteTarget?.studentId === std.id && e.target.value.trim()) {
                                  setBlockedNoteTarget(null);
                                }
                              }}
                              onFocus={() => {
                                setActiveCellInfo({
                                  id: `cell-name-${rIdx}`,
                                  type: 'name',
                                  rowIndex: rIdx,
                                  coordDisplay: `NOM${rIdx + 1}`,
                                  value: std.name
                                });
                              }}
                              placeholder={`Nom et prénom élève ${rIdx + 1}...`}
                              className="w-full h-full text-center px-2 text-xs sm:text-sm font-black text-slate-950 placeholder:text-slate-400 placeholder:font-semibold bg-transparent outline-none border border-transparent focus:border-blue-500 focus:bg-white rounded transition pr-5"
                              style={{
                                textAlign,
                                fontWeight: isBold ? '900' : '800',
                                fontStyle: isItalic ? 'italic' : 'normal',
                                textDecoration: isUnderline ? 'underline' : isStrikethrough ? 'line-through' : 'none',
                              }}
                            />

                            {/* BOUTON 3 POINTS ⋮ POUR CETTE CASE NOM & PRÉNOM */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuRow(prev => prev === std.id ? null : std.id);
                                setActiveMenuCol(null);
                                setActiveMenuNameCol(false);
                                setActiveMenuCell(null);
                                setActiveMenuPhoto(null);
                                setActiveColorPicker(null);
                              }}
                              className={`absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-10 border-0 shadow-none ${
                                activeMenuRow === std.id
                                  ? 'text-sky-600 bg-sky-100/70'
                                  : 'text-slate-700 hover:text-black hover:bg-slate-200/50'
                              }`}
                              title={`Options pour l'élève ${std.name || `n°${rIdx + 1}`}`}
                            >
                              <MoreVertical className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* MENU CONTEXTUEL POUR LA CASE NOM IDENTIQUE AU STYLE COLONNE */}
                            {activeMenuRow === std.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg shadow-2xl py-1.5 z-50 text-left text-xs select-none animate-in fade-in zoom-in-95"
                              >
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
                            )}
                            {renderColHandle('col-name')}
                          </div>

                          {/* NOTES DYNAMIQUES */}
                          {Array.from({ length: noteColumnCount }).map((_, cIdx) => {
                            const noteVal = std.notes[cIdx] || '';
                            const colMeta = columnMetas[cIdx] || { maxScore: 20 };
                            const parsed = parseStudentNote(noteVal, colMeta.maxScore);
                            const isSelectedNote = activeCellInfo.id === `cell-note-${rIdx}-${cIdx}`;
                            const isInvalid = parsed.isInvalid;
                            const colBg = colMeta.columnBgColor;
                            const singleCellBg = cellColors[`${std.id}_${cIdx}`];
                            const noteCellBg = isInvalid ? '#fef2f2' : (singleCellBg || rowBg || colBg || undefined);
                            const thisNoteWidth = getColWidth(`col-note-${cIdx}`);
                            const isThisColActive = isColActive(`col-note-${cIdx}`);
                            const isNoteCellMenuOpen = activeMenuCell?.studentId === std.id && activeMenuCell?.colIndex === cIdx;
                            const hasStudentName = Boolean((std.name || '').trim());
                            const isBlockedForName = blockedNoteTarget?.studentId === std.id && blockedNoteTarget?.colIndex === cIdx && !hasStudentName;

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
                                className={`border-r ${isThisColActive ? 'border-sky-500 z-10' : 'border-slate-700'} border-b ${isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'} flex items-center justify-center px-1 relative shrink-0 transition-colors group cursor-text ${
                                  isInvalid 
                                    ? 'bg-red-50 ring-2 ring-red-500 z-10' 
                                    : isSelectedNote 
                                    ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' 
                                    : ''
                                }`}
                              >
                                {/* BOUTON 3 POINTS ⋮ POUR CETTE CASE DE NOTE */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuCell(prev => (prev?.studentId === std.id && prev?.colIndex === cIdx) ? null : { studentId: std.id, colIndex: cIdx });
                                    setActiveMenuCol(null);
                                    setActiveMenuRow(null);
                                    setActiveMenuPhoto(null);
                                    setActiveMenuNameCol(false);
                                    setActiveColorPicker(null);
                                  }}
                                  className={`absolute top-0.5 right-0.5 p-0.5 rounded transition cursor-pointer z-20 border-0 shadow-none ${
                                    isNoteCellMenuOpen
                                      ? 'text-sky-600 bg-sky-100/70'
                                      : 'text-slate-900 hover:text-black hover:bg-slate-200/50'
                                  }`}
                                  title={`Options de la note ${cIdx + 1}`}
                                >
                                  <MoreVertical className="w-3 h-3 text-slate-900 stroke-[2.5]" />
                                </button>

                                {/* MENU CONTEXTUEL POUR LA CASE DE NOTE */}
                                {isNoteCellMenuOpen && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-300 rounded-lg shadow-2xl py-1.5 z-50 text-left text-xs select-none animate-in fade-in zoom-in-95"
                                  >
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
                                )}

                                {/* INFOBULLE FLOTTANTE SANS BLOQUER LA VUE SI NOTE > MAX */}
                                {isInvalid && (
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-red-600 text-white text-[10px] font-bold rounded-lg shadow-xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                                    <AlertCircle className="w-3.5 h-3.5 text-white shrink-0" />
                                    <span>⚠️ La note ne peut pas être supérieure à la note maximale ({parsed.maxScore})</span>
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
                                <div className="flex items-center justify-center w-full h-full pt-1.5 pr-2.5">
                                  {/* Note de l'élève (modifiable, rouge et soulignée si > max) */}
                                  <input
                                    type="text"
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
                                      const sanitized = e.target.value.replace(/[^0-9.]/g, '');
                                      const newRaw = formatStudentNote(sanitized, parsed.maxScore);
                                      handleRawNoteChange(std.id, cIdx, newRaw);
                                    }}
                                    onFocus={() => {
                                      setActiveCellInfo({
                                        id: `cell-note-${rIdx}-${cIdx}`,
                                        type: 'note',
                                        rowIndex: rIdx,
                                        noteColIndex: cIdx,
                                        coordDisplay: `N${cIdx + 1}_${rIdx + 1}`,
                                        value: noteVal || `.../${parsed.maxScore}`
                                      });
                                    }}
                                    placeholder="-"
                                    maxLength={6}
                                    className={`w-[48%] text-right text-xs sm:text-sm transition outline-none bg-transparent cursor-text ${
                                      isInvalid
                                        ? 'text-red-600 underline font-black decoration-red-600 decoration-2'
                                        : 'font-black text-slate-900 placeholder:text-slate-400 focus:text-blue-700'
                                    }`}
                                  />

                                  {/* SÉPARATEUR FIXE NON MODIFIABLE ULTRA VISIBLE */}
                                  <span className={`px-0.5 text-xs sm:text-sm font-black select-none pointer-events-none ${
                                    isInvalid ? 'text-red-600' : 'text-slate-900'
                                  }`}>
                                    /
                                  </span>

                                  {/* Barème maximal (défaut 20, modifiable) ULTRA VISIBLE */}
                                  <input
                                    type="text"
                                    value={parsed.maxScore}
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
                                      const sanitizedMax = e.target.value.replace(/[^0-9.]/g, '');
                                      const newMax = parseFloat(sanitizedMax) || 20;
                                      const newRaw = formatStudentNote(parsed.scoreStr, newMax);
                                      handleRawNoteChange(std.id, cIdx, newRaw);
                                    }}
                                    maxLength={4}
                                    className="w-[44%] text-left text-xs sm:text-[12px] font-black transition outline-none bg-transparent cursor-text text-slate-900 hover:text-blue-700 focus:text-blue-700"
                                    title="Barème maximal pour cette case"
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
                            className={`border-r border-slate-700 border-b ${isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'} bg-slate-50/60 flex items-center justify-center shrink-0 relative`}
                          >
                            <span className="text-slate-200 text-xs">•</span>
                          </div>

                          {/* MOYENNE */}
                          <div 
                            style={{ 
                              width: `${colWidthAverage}px`, 
                              minWidth: `${colWidthAverage}px`,
                              maxWidth: `${colWidthAverage}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: std.hasInvalidNote ? '#f1f5f9' : (rowBg || undefined)
                            }}
                            onClick={() => {
                              setActiveCellInfo({
                                id: `cell-avg-${rIdx}`,
                                type: 'average',
                                rowIndex: rIdx,
                                coordDisplay: `MOY${rIdx + 1}`,
                                value: std.hasInvalidNote
                                  ? 'Moyenne bloquée : une ou plusieurs notes dépassent le barème maximal'
                                  : std.average !== null 
                                  ? `=MOYENNE(Notes) => ${std.averageFormatted} / 20` 
                                  : ''
                              });
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-moyenne') ? null : { type: 'col', id: 'col-moyenne' });
                            }}
                            className={`border-r ${isColActive('col-moyenne') ? 'border-sky-500 z-10' : 'border-slate-700'} border-b ${
                              isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'
                            } flex items-center justify-between px-2 cursor-pointer relative shrink-0 transition-colors ${
                              std.hasInvalidNote
                                ? 'bg-slate-200 text-slate-400 border border-slate-300'
                                : 'bg-blue-50/40'
                            } ${
                              activeCellInfo.id === `cell-avg-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-100/50' : ''
                            }`}
                            title={
                              std.hasInvalidNote
                                ? 'Moyenne non calculée : une note dépasse le barème maximal'
                                : 'Moyenne générale de l\'élève (sur 20)'
                            }
                          >
                            <span className={`w-full text-center text-xs font-black tracking-tight flex items-center justify-center gap-1 ${
                              std.hasInvalidNote
                                ? 'text-slate-400 font-mono text-sm tracking-widest'
                                : std.average === null
                                ? 'text-slate-300'
                                : std.average >= 12
                                ? 'text-emerald-700 bg-emerald-50/90 py-0.5 px-1.5 rounded border border-emerald-300'
                                : std.average >= 10
                                ? 'text-blue-700 bg-blue-50/90 py-0.5 px-1.5 rounded border border-blue-300'
                                : 'text-rose-700 bg-rose-50/90 py-0.5 px-1.5 rounded border border-rose-300'
                            }`}>
                              {std.hasInvalidNote ? (
                                '...'
                              ) : std.average !== null ? (
                                <>
                                  <span>{std.averageFormatted}</span>
                                  <span className="text-[10px] sm:text-[11px] opacity-75 font-black">/ 20</span>
                                </>
                              ) : (
                                <span className="text-slate-300 font-semibold">-</span>
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

                          {/* MENTION */}
                          <div 
                            style={{ 
                              width: `${colWidthMention}px`, 
                              minWidth: `${colWidthMention}px`,
                              maxWidth: `${colWidthMention}px`,
                              height: `${rowHeight}px`,
                              backgroundColor: std.hasInvalidNote ? '#f1f5f9' : (rowBg || undefined)
                            }}
                            onClick={() => {
                              setActiveCellInfo({
                                id: `cell-mention-${rIdx}`,
                                type: 'mention',
                                rowIndex: rIdx,
                                coordDisplay: `MEN${rIdx + 1}`,
                                value: std.hasInvalidNote
                                  ? 'Mention bloquée : note non valide'
                                  : std.mention && std.mention !== '-'
                                  ? `=MENTION(M${rIdx + 1}) => ${std.mention}`
                                  : '-'
                              });
                            }}
                            onDoubleClick={(e) => {
                              e.stopPropagation();
                              setSelectedLine(prev => (prev?.type === 'col' && prev.id === 'col-mention') ? null : { type: 'col', id: 'col-mention' });
                            }}
                            className={`border-r ${isColActive('col-mention') ? 'border-sky-500 z-10' : 'border-slate-700'} border-b ${
                              isRowLineActive ? 'border-sky-500 z-10' : 'border-slate-400'
                            } flex items-center justify-center px-2 cursor-pointer relative shrink-0 transition-colors ${
                              std.hasInvalidNote
                                ? 'bg-slate-200 text-slate-400 border border-slate-300'
                                : 'bg-emerald-50/20'
                            } ${
                              activeCellInfo.id === `cell-mention-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-emerald-100/50' : ''
                            }`}
                            title="Mention pédagogique de l'élève"
                          >
                            {std.mention && std.mention !== '-' ? (
                              <span className={`px-2 py-0.5 rounded-md text-[11px] sm:text-xs border shadow-2xs whitespace-nowrap tracking-tight ${std.mentionClass}`}>
                                {std.mention}
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs font-semibold">-</span>
                            )}
                            {renderColHandle('col-mention')}
                          </div>

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
      {/* 5. BARRE INFÉRIEURE : ONGLETS FEUILLES & CURSEUR ZOOM                     */}
      {/* ========================================================================= */}
      <footer className="h-7 bg-[#f3f4f6] border-t border-slate-300 px-3 flex items-center justify-between text-xs text-slate-600 shrink-0 select-none">
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

        <div className="hidden lg:flex items-center gap-3 text-[10.5px] text-slate-500 font-medium">
          <span>Double-clic sur un trait pour <strong className="text-blue-600">sélectionner & glisser</strong></span>
          <span>•</span>
          <span>Sélection individuelle stricte sans mélange</span>
          <span>•</span>
          <span>Zoom à deux doigts ou en haut <strong className="text-slate-800">[-] [+]</strong></span>
        </div>

        <div className="flex items-center gap-2">
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
      {/* 6. MODALE DE MODIFICATION D'INTITULÉ & BARÈME DE COLONNE                   */}
      {/* ========================================================================= */}
      {editingColModal && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in"
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
                  max={100}
                  value={editingColModal.maxScore}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setEditingColModal(prev => prev ? { ...prev, maxScore: isNaN(val) ? 20 : val } : null);
                  }}
                  className="w-full h-9 px-3 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Exemple : 20 pour une note sur 20, 10 pour une note sur 10.
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

                  setColumnMetas(prev => ({
                    ...prev,
                    [idx]: {
                      ...prev[idx],
                      title: cleanTitle,
                      maxScore: cleanMax
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

      {/* BACKDROP DÉSACTIVATION ARRIÈRE-PLAN QUAND UN MENU EST OUVERT */}
      {isAnyMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/5 cursor-default"
          onClick={(e) => {
            e.stopPropagation();
            setActiveMenuCol(null);
            setActiveMenuRow(null);
            setActiveMenuCell(null);
            setActiveMenuPhoto(null);
            setActiveMenuNameCol(false);
            setActiveColorPicker(null);
          }}
        />
      )}

      {/* MODALE POPUP CARTE AU MILIEU : APERÇU PHOTO, NOM & MOYENNE */}
      {previewPhotoStudent && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none animate-in fade-in duration-150"
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

                {/* Moyenne générale de l'élève */}
                <div className="mt-2 flex items-center gap-2 text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
                  <span>Moyenne générale :</span>
                  <span className={`font-black text-sm ${
                    !previewStats || previewStats.average === null
                      ? 'text-slate-400'
                      : previewStats.average >= 12
                      ? 'text-emerald-700'
                      : previewStats.average >= 10
                      ? 'text-blue-700'
                      : 'text-rose-700'
                  }`}>
                    {previewStats?.averageFormatted ? `${previewStats.averageFormatted} / 20` : '-'}
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
    </div>
  );
};
