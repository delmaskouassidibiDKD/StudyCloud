import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
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
  Trash2
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
  notes: string[]; // Notes dynamiques sans limite
}

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
  let maxWordPx = 150; // Largeur minimale de sécurité
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
  const rowHeightsKey = `studycloud_row_heights_${subject.id}_${term?.id || 't1'}`;

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
        if (!isNaN(w) && w >= 52 && w <= 240) return w;
      }
    } catch { }
    return 72;
  });

  const [colWidthAverage, setColWidthAverage] = useState<number>(() => {
    try {
      const s = localStorage.getItem(colWidthAvgKey);
      if (s) { const n = parseInt(s, 10); if (!isNaN(n) && n >= 75) return n; }
    } catch { }
    return 104;
  });

  // Hauteurs personnalisées de chaque ligne d'élève
  const [customRowHeights, setCustomRowHeights] = useState<{ [index: number]: number }>(() => {
    try {
      const s = localStorage.getItem(rowHeightsKey);
      if (s) { const parsed = JSON.parse(s); if (typeof parsed === 'object') return parsed; }
    } catch { }
    return {};
  });

  // État de sélection et de redimensionnement des lignes (double clic / glissement)
  const [selectedLine, setSelectedLine] = useState<{ type: 'col' | 'row'; id: string | number } | null>(null);
  const [resizingLine, setResizingLine] = useState<{ type: 'col' | 'row'; id: string | number } | null>(null);
  const [hoveredColDivider, setHoveredColDivider] = useState<string | null>(null);
  const [hoveredRowDivider, setHoveredRowDivider] = useState<number | null>(null);

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
    type: 'rank' | 'photo' | 'name' | 'note' | 'average';
    rowIndex: number;
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

  // Référence pour l'upload de photo d'élève
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
      localStorage.setItem(rowHeightsKey, JSON.stringify(customRowHeights));
      setIsSaved(true);
    } catch { }
  }, [students, noteColumnCount, noteColWidth, colWidthRank, colWidthPhoto, colWidthName, colWidthAverage, customRowHeights, storageKey, colCountKey, colWidthKey, colWidthRankKey, colWidthPhotoKey, colWidthNameKey, colWidthAvgKey, rowHeightsKey]);

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

  // Calcul dynamique des moyennes et des rangs en temps réel
  const studentsWithStats = useMemo(() => {
    const withAverage = students.map((std, idx) => {
      const validNotes = std.notes
        .slice(0, noteColumnCount)
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
  }, [students, noteColumnCount]);

  // Modification du nom d'un élève
  const handleNameChange = (studentId: string, newName: string) => {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, name: newName } : s));
    setIsSaved(false);
  };

  // Modification d'une note N
  const handleNoteChange = (studentId: string, noteIndex: number, newVal: string) => {
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

  // Suppression d'une colonne de note
  const handleDeleteNoteColumn = (colIndex: number) => {
    if (noteColumnCount <= 1) return;
    setNoteColumnCount(prev => prev - 1);
    setStudents(prevStudents => prevStudents.map(s => {
      const updated = [...s.notes];
      updated.splice(colIndex, 1);
      return { ...s, notes: updated };
    }));
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
      setStudents(prev => prev.map(s => s.id === uploadingStudentId ? { ...s, photoUrl: base64 } : s));
      setIsSaved(false);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // =========================================================================
  // GESTION DU REDIMENSIONNEMENT DES LIGNES VERTICALES (COLONNES)
  // Double-clic = sélection et changement de couleur immédiat
  // Glissement = élargit ou rétrécit la colonne en bloquant à la limite du texte
  // =========================================================================
  const handleStartColResize = (e: React.MouseEvent | React.TouchEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLine({ type: 'col', id: colId });
    setResizingLine({ type: 'col', id: colId });

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const initialWidth = 
      colId === 'rank' ? colWidthRank :
      colId === 'photo' ? colWidthPhoto :
      colId === 'name' ? colWidthName :
      colId === 'note' ? noteColWidth :
      colId === 'average' ? colWidthAverage : 72;

    // Limite minimale bloquante pour ne jamais masquer le texte ni créer de pointillés
    const minWidth = 
      colId === 'rank' ? 55 :
      colId === 'photo' ? 60 :
      colId === 'name' ? getMinNameColWidth(students) :
      colId === 'note' ? 52 :
      colId === 'average' ? 80 : 50;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = curX - startX;
      // Arrêt automatique bloqué à minWidth pour que l'écriture ne soit jamais tronquée
      const newWidth = Math.max(minWidth, Math.round(initialWidth + deltaX));

      if (colId === 'rank') setColWidthRank(newWidth);
      else if (colId === 'photo') setColWidthPhoto(newWidth);
      else if (colId === 'name') setColWidthName(newWidth);
      else if (colId === 'note') setNoteColWidth(newWidth);
      else if (colId === 'average') setColWidthAverage(newWidth);
    };

    const handleMouseUp = () => {
      setResizingLine(null);
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

  // =========================================================================
  // GESTION DU REDIMENSIONNEMENT DES LIGNES HORIZONTALES (LIGNES D'ÉLÈVES)
  // Double-clic = sélection et changement de couleur immédiat
  // Glissement = agrandit ou réduit la hauteur de la ligne associée
  // =========================================================================
  const handleStartRowResize = (e: React.MouseEvent | React.TouchEvent, rowIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedLine({ type: 'row', id: rowIndex });
    setResizingLine({ type: 'row', id: rowIndex });

    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const initialHeight = customRowHeights[rowIndex] || 44;
    const minHeight = 42; // Hauteur minimale bloquante pour préserver le texte

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      const deltaY = curY - startY;
      const newHeight = Math.max(minHeight, Math.round(initialHeight + deltaY));

      setCustomRowHeights(prev => ({
        ...prev,
        [rowIndex]: newHeight
      }));
    };

    const handleMouseUp = () => {
      setResizingLine(null);
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

  // Vérification de l'état actif d'un séparateur de colonne
  const isColDividerActive = (id: string) => {
    return (resizingLine?.type === 'col' && resizingLine.id === id) || 
           (selectedLine?.type === 'col' && selectedLine.id === id) ||
           (hoveredColDivider === id);
  };

  // Vérification de l'état actif d'un séparateur de ligne
  const isRowDividerActive = (rIdx: number) => {
    return (resizingLine?.type === 'row' && resizingLine.id === rIdx) || 
           (selectedLine?.type === 'row' && selectedLine.id === rIdx) ||
           (hoveredRowDivider === rIdx);
  };

  // Poignée astérisque rouge (*) extérieure
  const handleStartRightResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    setIsDraggingRight(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startWidth = noteColWidth;

    const handleMouseMove = (moveEvent: MouseEvent | TouchEvent) => {
      const curX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const deltaX = (curX - clientX) * 0.42;
      const newWidth = Math.max(52, Math.min(240, Math.round(startWidth + deltaX)));
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
      const noteHeaders = Array.from({ length: noteColumnCount }, (_, i) => `Note ${i + 1}`);
      const headers = ['Rang', 'Nom & Prénom', ...noteHeaders, 'Moyenne'];
      const dataRows = studentsWithStats.map(s => [
        s.rank,
        s.name,
        ...s.notes.slice(0, noteColumnCount),
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
      onClick={() => setSelectedLine(null)}
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
                {/* LE TABLEAU MODERNE PROFESSIONNEL (Bordures bien visibles et carrées) */}
                {/* RANG | PROFIL | NOM & PRÉNOM | NOTE 1... NOTE N | [+] | MOYENNE     */}
                {/* =================================================================== */}
                <div className="relative shrink-0 border-2 border-slate-900 bg-white shadow-xl">
                  {/* EN-TÊTE DU TABLEAU : TEXTES EN DUR NON MODÉLABLES VERTICALEMENT, */}
                  {/* MAIS PARFAITEMENT SYNCHRONISÉS EN LARGEUR AVEC LES COLONNES      */}
                  <div className="flex bg-[#f1f5f9] border-b-2 border-slate-900 select-none items-stretch text-slate-900">
                    {/* 1. RANG */}
                    <div 
                      style={{ width: `${colWidthRank}px` }} 
                      className="h-12 sm:h-14 flex items-center justify-center p-1 text-center bg-[#f1f5f9] shrink-0"
                      title="Rang de l'élève (classement)"
                    >
                      <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        RANG
                      </span>
                    </div>

                    {/* SÉPARATEUR VERTICAL 1 : RANG / PROFIL */}
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => prev?.id === 'rank' ? null : { type: 'col', id: 'rank' });
                      }}
                      onMouseDown={(e) => handleStartColResize(e, 'rank')}
                      onTouchStart={(e) => handleStartColResize(e, 'rank')}
                      onMouseEnter={() => setHoveredColDivider('rank')}
                      onMouseLeave={() => setHoveredColDivider(null)}
                      className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                      title="Double-cliquer pour sélectionner ou faire glisser pour redimensionner"
                    >
                      <div className={`w-[1px] h-full transition-all duration-150 ${
                        isColDividerActive('rank')
                          ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                          : 'bg-slate-700 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                      }`} />
                    </div>

                    {/* 2. PROFIL / PHOTO */}
                    <div 
                      style={{ width: `${colWidthPhoto}px` }} 
                      className="h-12 sm:h-14 flex items-center justify-center p-1 text-center bg-[#f1f5f9] shrink-0"
                      title="Profil / Photo de l'élève"
                    >
                      <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        PROFIL
                      </span>
                    </div>

                    {/* SÉPARATEUR VERTICAL 2 : PROFIL / NOM & PRÉNOM */}
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => prev?.id === 'photo' ? null : { type: 'col', id: 'photo' });
                      }}
                      onMouseDown={(e) => handleStartColResize(e, 'photo')}
                      onTouchStart={(e) => handleStartColResize(e, 'photo')}
                      onMouseEnter={() => setHoveredColDivider('photo')}
                      onMouseLeave={() => setHoveredColDivider(null)}
                      className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                      title="Double-cliquer pour sélectionner ou faire glisser pour redimensionner"
                    >
                      <div className={`w-[1px] h-full transition-all duration-150 ${
                        isColDividerActive('photo')
                          ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                          : 'bg-slate-700 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                      }`} />
                    </div>

                    {/* 3. NOM & PRÉNOM */}
                    <div 
                      style={{ width: `${colWidthName}px` }} 
                      className="h-12 sm:h-14 flex items-center justify-center p-1 text-center bg-[#f1f5f9] shrink-0"
                      title="Nom et Prénom de l'élève"
                    >
                      <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase">
                        NOM & PRÉNOM
                      </span>
                    </div>

                    {/* SÉPARATEUR VERTICAL 3 : NOM & PRÉNOM / NOTE 1 (IMAGE 1 - ENTOURE EN ROUGE) */}
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => prev?.id === 'name' ? null : { type: 'col', id: 'name' });
                      }}
                      onMouseDown={(e) => handleStartColResize(e, 'name')}
                      onTouchStart={(e) => handleStartColResize(e, 'name')}
                      onMouseEnter={() => setHoveredColDivider('name')}
                      onMouseLeave={() => setHoveredColDivider(null)}
                      className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                      title="Double-cliquer pour sélectionner ou faire glisser pour redimensionner la colonne"
                    >
                      <div className={`w-[1px] h-full transition-all duration-150 ${
                        isColDividerActive('name')
                          ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                          : 'bg-slate-700 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                      }`} />
                    </div>

                    {/* 4. COLONNES DE NOTES DYNAMIQUES */}
                    {Array.from({ length: noteColumnCount }).map((_, i) => (
                      <React.Fragment key={`header-note-fragment-${i}`}>
                        <div 
                          style={{ width: `${noteColWidth}px` }}
                          className="h-12 sm:h-14 flex items-center justify-center p-1 text-center relative group bg-[#f1f5f9] shrink-0"
                          title={`Note ${i + 1}`}
                        >
                          <span className="font-black text-xs sm:text-sm text-slate-900 tracking-wider uppercase truncate px-1">
                            NOTE {i + 1}
                          </span>

                          {noteColumnCount > 1 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteNoteColumn(i);
                              }}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-red-600 transition"
                              title={`Supprimer la colonne Note ${i + 1}`}
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>

                        {/* SÉPARATEUR VERTICAL ENTRE NOTES */}
                        <div
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setSelectedLine(prev => prev?.id === 'note' ? null : { type: 'col', id: 'note' });
                          }}
                          onMouseDown={(e) => handleStartColResize(e, 'note')}
                          onTouchStart={(e) => handleStartColResize(e, 'note')}
                          onMouseEnter={() => setHoveredColDivider('note')}
                          onMouseLeave={() => setHoveredColDivider(null)}
                          className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                          title="Double-cliquer pour sélectionner ou faire glisser pour redimensionner les notes"
                        >
                          <div className={`w-[1px] h-full transition-all duration-150 ${
                            isColDividerActive('note')
                              ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                              : 'bg-slate-700 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                          }`} />
                        </div>
                      </React.Fragment>
                    ))}

                    {/* 5. BOUTON [+] AJOUTER UNE NOUVELLE NOTE */}
                    <div 
                      className="w-12 h-12 sm:h-14 flex items-center justify-center bg-slate-200/70 hover:bg-blue-100 transition cursor-pointer shrink-0"
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

                    {/* SÉPARATEUR VERTICAL : BOUTON [+] / MOYENNE */}
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setSelectedLine(prev => prev?.id === 'average' ? null : { type: 'col', id: 'average' });
                      }}
                      onMouseDown={(e) => handleStartColResize(e, 'average')}
                      onTouchStart={(e) => handleStartColResize(e, 'average')}
                      onMouseEnter={() => setHoveredColDivider('average')}
                      onMouseLeave={() => setHoveredColDivider(null)}
                      className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                      title="Double-cliquer pour sélectionner ou faire glisser pour redimensionner"
                    >
                      <div className={`w-[1px] h-full transition-all duration-150 ${
                        isColDividerActive('average')
                          ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                          : 'bg-slate-700 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                      }`} />
                    </div>

                    {/* 6. MOYENNE */}
                    <div 
                      style={{ width: `${colWidthAverage}px` }} 
                      className="h-12 sm:h-14 flex items-center justify-center p-1 text-center bg-blue-100/70 shrink-0"
                      title="Moyenne générale de l'élève"
                    >
                      <span className="font-black text-xs sm:text-sm text-blue-950 tracking-wider uppercase">
                        MOYENNE
                      </span>
                    </div>
                  </div>

                  {/* ================================================================= */}
                  {/* CORPS DU TABLEAU : LIGNES D'ÉLÈVES MODÉLABLES                     */}
                  {/* (Image 2 : pourtour modelable, lignes intérieures redimensionnables) */}
                  {/* ================================================================= */}
                  <div className="flex flex-col">
                    {studentsWithStats.map((std, rIdx) => {
                      const isRowSelected = activeCellInfo.rowIndex === rIdx;
                      const customHeight = customRowHeights[rIdx];

                      return (
                        <React.Fragment key={std.id}>
                          {/* Ligne d'un élève */}
                          <div 
                            style={{ 
                              height: customHeight ? `${customHeight}px` : undefined,
                              minHeight: '44px'
                            }}
                            className={`flex items-stretch transition-colors ${
                              isRowSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50/70'
                            }`}
                          >
                            {/* RANG */}
                            <div 
                              style={{ width: `${colWidthRank}px` }}
                              onClick={() => {
                                setActiveCellInfo({
                                  id: `cell-rank-${rIdx}`,
                                  type: 'rank',
                                  rowIndex: rIdx,
                                  coordDisplay: `RANG${rIdx + 1}`,
                                  value: std.rank ? `=RANG(M${rIdx + 1})` : ''
                                });
                              }}
                              className={`flex items-center justify-center p-1 cursor-pointer relative shrink-0 ${
                                activeCellInfo.id === `cell-rank-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-emerald-50/40' : ''
                              }`}
                            >
                              {std.rank ? (
                                <span className={`px-2 py-0.5 rounded text-xs font-black shadow-2xs ${
                                  std.rank === '1er'
                                    ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-amber-950 border border-amber-400 ring-1 ring-amber-300/50'
                                    : std.rank.startsWith('2e')
                                    ? 'bg-slate-200 text-slate-800 border border-slate-300'
                                    : std.rank.startsWith('3e')
                                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-700 font-bold'
                                }`}>
                                  {std.rank}
                                </span>
                              ) : (
                                <span className="text-slate-300 text-xs font-semibold">-</span>
                              )}
                            </div>

                            {/* SÉPARATEUR VERTICAL LIGNE ÉLÈVE : RANG / PROFIL */}
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setSelectedLine(prev => prev?.id === 'rank' ? null : { type: 'col', id: 'rank' });
                              }}
                              onMouseDown={(e) => handleStartColResize(e, 'rank')}
                              onTouchStart={(e) => handleStartColResize(e, 'rank')}
                              onMouseEnter={() => setHoveredColDivider('rank')}
                              onMouseLeave={() => setHoveredColDivider(null)}
                              className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                            >
                              <div className={`w-[1px] h-full transition-all duration-150 ${
                                isColDividerActive('rank')
                                  ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                                  : 'bg-slate-600 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                              }`} />
                            </div>

                            {/* PROFIL / PHOTO */}
                            <div 
                              style={{ width: `${colWidthPhoto}px` }}
                              onClick={() => {
                                setActiveCellInfo({
                                  id: `cell-photo-${rIdx}`,
                                  type: 'photo',
                                  rowIndex: rIdx,
                                  coordDisplay: `PHOTO${rIdx + 1}`,
                                  value: std.photoUrl ? 'Photo chargée' : 'Aucune photo'
                                });
                              }}
                              className={`flex items-center justify-center p-1 cursor-pointer relative group shrink-0 ${
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

                            {/* SÉPARATEUR VERTICAL LIGNE ÉLÈVE : PROFIL / NOM */}
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setSelectedLine(prev => prev?.id === 'photo' ? null : { type: 'col', id: 'photo' });
                              }}
                              onMouseDown={(e) => handleStartColResize(e, 'photo')}
                              onTouchStart={(e) => handleStartColResize(e, 'photo')}
                              onMouseEnter={() => setHoveredColDivider('photo')}
                              onMouseLeave={() => setHoveredColDivider(null)}
                              className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                            >
                              <div className={`w-[1px] h-full transition-all duration-150 ${
                                isColDividerActive('photo')
                                  ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                                  : 'bg-slate-600 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                              }`} />
                            </div>

                            {/* NOM & PRÉNOM (Centré verticalement/horizontalement, retour à la ligne automatique si étroit, sans pointillés) */}
                            <div 
                              style={{ width: `${colWidthName}px` }}
                              onClick={() => {
                                setActiveCellInfo({
                                  id: `cell-name-${rIdx}`,
                                  type: 'name',
                                  rowIndex: rIdx,
                                  coordDisplay: `NOM${rIdx + 1}`,
                                  value: std.name
                                });
                              }}
                              className={`flex items-center justify-center p-1.5 relative shrink-0 ${
                                activeCellInfo.id === `cell-name-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-50/30' : ''
                              }`}
                            >
                              <textarea
                                rows={1}
                                value={std.name}
                                onChange={(e) => handleNameChange(std.id, e.target.value)}
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
                                className="w-full text-center text-xs font-semibold text-slate-800 placeholder:text-slate-300 bg-transparent outline-none border border-transparent focus:border-blue-400 focus:bg-white rounded transition resize-none overflow-hidden py-1 px-2 leading-snug my-auto whitespace-pre-wrap break-words"
                                style={{
                                  textAlign,
                                  fontWeight: isBold ? 'bold' : '600',
                                  fontStyle: isItalic ? 'italic' : 'normal',
                                  textDecoration: isUnderline ? 'underline' : isStrikethrough ? 'line-through' : 'none',
                                }}
                              />
                            </div>

                            {/* SÉPARATEUR VERTICAL LIGNE ÉLÈVE : NOM / NOTE 1 (IMAGE 1 - ENTOURÉ EN ROUGE) */}
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setSelectedLine(prev => prev?.id === 'name' ? null : { type: 'col', id: 'name' });
                              }}
                              onMouseDown={(e) => handleStartColResize(e, 'name')}
                              onTouchStart={(e) => handleStartColResize(e, 'name')}
                              onMouseEnter={() => setHoveredColDivider('name')}
                              onMouseLeave={() => setHoveredColDivider(null)}
                              className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                              title="Double-cliquer pour sélectionner ou faire glisser pour redimensionner"
                            >
                              <div className={`w-[1px] h-full transition-all duration-150 ${
                                isColDividerActive('name')
                                  ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                                  : 'bg-slate-600 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                              }`} />
                            </div>

                            {/* NOTES DYNAMIQUES */}
                            {Array.from({ length: noteColumnCount }).map((_, cIdx) => {
                              const noteVal = std.notes[cIdx] || '';
                              const isSelectedNote = activeCellInfo.id === `cell-note-${rIdx}-${cIdx}`;

                              return (
                                <React.Fragment key={`note-cell-fragment-${std.id}-${cIdx}`}>
                                  <div 
                                    style={{ width: `${noteColWidth}px` }}
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
                                    className={`flex items-center justify-center p-1 relative shrink-0 ${
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

                                    {isSelectedNote && (
                                      <div className="absolute -bottom-[3px] -right-[3px] w-2 h-2 bg-[#107c41] border border-white cursor-crosshair z-20 pointer-events-none" />
                                    )}
                                  </div>

                                  {/* SÉPARATEUR VERTICAL ENTRE NOTES */}
                                  <div
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedLine(prev => prev?.id === 'note' ? null : { type: 'col', id: 'note' });
                                    }}
                                    onMouseDown={(e) => handleStartColResize(e, 'note')}
                                    onTouchStart={(e) => handleStartColResize(e, 'note')}
                                    onMouseEnter={() => setHoveredColDivider('note')}
                                    onMouseLeave={() => setHoveredColDivider(null)}
                                    className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                                  >
                                    <div className={`w-[1px] h-full transition-all duration-150 ${
                                      isColDividerActive('note')
                                        ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                                        : 'bg-slate-600 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                                    }`} />
                                  </div>
                                </React.Fragment>
                              );
                            })}

                            {/* Case vide sous le bouton [+] */}
                            <div className="w-12 flex items-center justify-center bg-slate-50/60 shrink-0">
                              <span className="text-slate-200 text-xs">•</span>
                            </div>

                            {/* SÉPARATEUR VERTICAL [+] / MOYENNE */}
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setSelectedLine(prev => prev?.id === 'average' ? null : { type: 'col', id: 'average' });
                              }}
                              onMouseDown={(e) => handleStartColResize(e, 'average')}
                              onTouchStart={(e) => handleStartColResize(e, 'average')}
                              onMouseEnter={() => setHoveredColDivider('average')}
                              onMouseLeave={() => setHoveredColDivider(null)}
                              className="relative w-[7px] -mx-[3.5px] cursor-col-resize z-20 flex items-center justify-center group/col shrink-0 select-none"
                            >
                              <div className={`w-[1px] h-full transition-all duration-150 ${
                                isColDividerActive('average')
                                  ? 'w-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                                  : 'bg-slate-600 group-hover/col:bg-blue-500 group-hover/col:w-[2px]'
                              }`} />
                            </div>

                            {/* MOYENNE */}
                            <div 
                              style={{ width: `${colWidthAverage}px` }}
                              onClick={() => {
                                setActiveCellInfo({
                                  id: `cell-avg-${rIdx}`,
                                  type: 'average',
                                  rowIndex: rIdx,
                                  coordDisplay: `MOY${rIdx + 1}`,
                                  value: std.average !== null ? `=MOYENNE(Notes) => ${std.averageFormatted}` : ''
                                });
                              }}
                              className={`flex items-center justify-between px-2 cursor-pointer relative bg-blue-50/40 shrink-0 ${
                                activeCellInfo.id === `cell-avg-${rIdx}` ? 'outline-2 outline-[#107c41] -outline-offset-2 z-10 bg-blue-100/50' : ''
                              }`}
                              title="Moyenne automatique calculée d'après les notes saisies"
                            >
                              <span className={`w-full text-center text-xs font-black tracking-tight ${
                                std.average === null
                                  ? 'text-slate-300'
                                  : std.average >= 12
                                  ? 'text-emerald-700 bg-emerald-50/90 py-0.5 px-1.5 rounded border border-emerald-300'
                                  : std.average >= 10
                                  ? 'text-blue-700 bg-blue-50/90 py-0.5 px-1.5 rounded border border-blue-300'
                                  : 'text-rose-700 bg-rose-50/90 py-0.5 px-1.5 rounded border border-rose-300'
                              }`}>
                                {std.averageFormatted || '-'}
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
                            </div>
                          </div>

                          {/* ============================================================= */}
                          {/* SÉPARATEUR HORIZONTAL INTERACTIF ENTRE DEUX LIGNES D'ÉLÈVES   */}
                          {/* (IMAGE 1 - ENTOURÉ EN ROUGE HORIZONTALEMENT)                  */}
                          {/* ============================================================= */}
                          {rIdx < studentsWithStats.length - 1 && (
                            <div
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setSelectedLine(prev => prev?.id === rIdx ? null : { type: 'row', id: rIdx });
                              }}
                              onMouseDown={(e) => handleStartRowResize(e, rIdx)}
                              onTouchStart={(e) => handleStartRowResize(e, rIdx)}
                              onMouseEnter={() => setHoveredRowDivider(rIdx)}
                              onMouseLeave={() => setHoveredRowDivider(null)}
                              className="relative h-[7px] -my-[3.5px] w-full cursor-row-resize z-20 flex items-center justify-center group/row select-none"
                              title="Double-cliquer pour sélectionner ou faire glisser pour agrandir/réduire la hauteur"
                            >
                              <div className={`h-[1px] w-full transition-all duration-150 ${
                                isRowDividerActive(rIdx)
                                  ? 'h-[3px] bg-blue-600 shadow-[0_0_8px_#2563eb]'
                                  : 'bg-slate-400 group-hover/row:bg-blue-500 group-hover/row:h-[2px]'
                              }`} />
                            </div>
                          )}
                        </React.Fragment>
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
          <span>Largeur & hauteur <strong className="text-blue-600">ajustables sans coupure de texte</strong></span>
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
    </div>
  );
};
