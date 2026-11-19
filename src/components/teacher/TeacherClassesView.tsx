import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  MessageSquare,
  Users2,
  Layers,
  ArrowLeft,
  ArrowRight,
  Search,
  Bell,
  Settings,
  Plus,
  X,
  Check,
  Calendar,
  Sparkles,
  Trash2,
  Pencil,
  AlertTriangle,
  School,
  FolderPlus,
  Upload,
  Building2,
  BookOpen,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Copy
} from 'lucide-react';

export interface SchoolYearItem {
  id: string;
  label: string; // ex: "2026 - 2027"
  color: string; // hex ou 'white'
  textColor?: string;
  createdAt: number;
}

export interface SchoolItem {
  id: string;
  yearId: string; // Attache l'école à la rentrée scolaire sélectionnée
  name: string; // Nom de l'école (requis)
  logoUrl?: string; // Logo de l'école (facultatif, image base64)
  color: string; // hex couleur de la carte
  textColor: string;
  borderColor: string;
  borderDarkColor: string; // pour l'effet 3D en bas
  createdAt: number;
}

export interface ClassItem {
  id: string;
  schoolId: string; // Attache la classe à l'école sélectionnée
  yearId: string; // Attache à l'année scolaire sélectionnée
  level: string; // ex: "CP1", "6ème", "Terminale" (requis)
  name?: string; // ex: "A", "1", "Élite" (facultatif)
  slogan?: string; // ex: "Rigueur et Succès" (facultatif)
  teacherName: string; // ex: "M. Delmas Kouassi" (requis)
  subject?: string; // facultatif
  color: string; // hex
  textColor: string;
  borderColor: string;
  borderDarkColor: string;
  iconGradient: string;
  createdAt: number;
}

export interface TermItem {
  id: string;
  classId: string; // Attache le trimestre à sa classe
  schoolId: string;
  yearId: string;
  number: number; // 1, 2, 3, 4...
  name: string; // ex: "Trimestre 1", "Trimestre 2"...
  createdAt: number;
}

export interface SubjectItem {
  id: string;
  classId: string; // Attache la matière à la classe sélectionnée
  termId?: string; // Attache la matière au trimestre sélectionné de la classe
  schoolId: string; // Attache à l'école
  yearId: string; // Attache à l'année scolaire
  name: string; // Nom de la matière (ex: Mathématiques)
  coefficient?: number; // Coefficient (facultatif, ex: 3, 2, 1)
  color: string; // hex couleur (Blanc par défaut si non choisi)
  textColor: string;
  borderColor: string;
  borderDarkColor: string;
  createdAt: number;
}

interface TeacherClassesViewProps {
  onBack: () => void;
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
}

// Couleurs proposées pour la rentrée scolaire
const YEAR_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc (Défaut)', bg: '#ffffff', text: '#0f172a', border: '#cbd5e1' },
  { id: 'teal', label: 'Pétrole / Lagon', bg: '#00313d', text: '#ffffff', border: '#00252e' },
  { id: 'blue', label: 'Bleu Roi', bg: '#2563eb', text: '#ffffff', border: '#1d4ed8' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490' },
  { id: 'emerald', label: 'Émeraude', bg: '#059669', text: '#ffffff', border: '#047857' },
  { id: 'orange', label: 'Orange Ambré', bg: '#ea580c', text: '#ffffff', border: '#c2410c' },
  { id: 'rose', label: 'Rose Framboise', bg: '#db2777', text: '#ffffff', border: '#be185d' },
  { id: 'purple', label: 'Violet Sombre', bg: '#7c3aed', text: '#ffffff', border: '#6d28d9' },
  { id: 'gold', label: 'Or / Safran', bg: '#d97706', text: '#ffffff', border: '#b45309' },
  { id: 'red', label: 'Rouge Écarlate', bg: '#dc2626', text: '#ffffff', border: '#b91c1c' },
];

// Couleurs proposées pour les classes (Orange Ambré comme sur l'image par défaut)
const CLASS_COLOR_OPTIONS = [
  { id: 'amber', label: 'Orange Ambré (Style Référence)', bg: '#ea580c', text: '#ffffff', border: '#c2410c', borderDark: '#9a3412', iconGradient: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' },
  { id: 'white', label: 'Blanc Épuré', bg: '#ffffff', text: '#0f172a', border: '#e2e8f0', borderDark: '#94a3b8', iconGradient: 'linear-gradient(135deg, #334155 0%, #0f172a 100%)' },
  { id: 'teal', label: 'Bleu Pétrole', bg: '#00313d', text: '#ffffff', border: '#00252e', borderDark: '#00141a', iconGradient: 'linear-gradient(135deg, #0d9488 0%, #00313d 100%)' },
  { id: 'blue', label: 'Bleu Océan', bg: '#1d4ed8', text: '#ffffff', border: '#1e40af', borderDark: '#172554', iconGradient: 'linear-gradient(135deg, #38bdf8 0%, #1d4ed8 100%)' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490', borderDark: '#155e75', iconGradient: 'linear-gradient(135deg, #22d3ee 0%, #0891b2 100%)' },
  { id: 'emerald', label: 'Vert Émeraude', bg: '#047857', text: '#ffffff', border: '#065f46', borderDark: '#064e3b', iconGradient: 'linear-gradient(135deg, #34d399 0%, #047857 100%)' },
  { id: 'red', label: 'Rouge Carmin', bg: '#b91c1c', text: '#ffffff', border: '#991b1b', borderDark: '#7f1d1d', iconGradient: 'linear-gradient(135deg, #f87171 0%, #b91c1c 100%)' },
  { id: 'purple', label: 'Violet Profond', bg: '#6b21a8', text: '#ffffff', border: '#581c87', borderDark: '#3b0764', iconGradient: 'linear-gradient(135deg, #c084fc 0%, #6b21a8 100%)' },
  { id: 'gold', label: 'Or / Safran', bg: '#d97706', text: '#ffffff', border: '#b45309', borderDark: '#92400e', iconGradient: 'linear-gradient(135deg, #facc15 0%, #d97706 100%)' },
  { id: 'rose', label: 'Rose Framboise', bg: '#be185d', text: '#ffffff', border: '#9d174d', borderDark: '#831843', iconGradient: 'linear-gradient(135deg, #f472b6 0%, #be185d 100%)' },
];

// Couleurs proposées pour les matières (Blanc par défaut si non choisi)
const SUBJECT_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc (Défaut)', bg: '#ffffff', text: '#0f172a', border: '#cbd5e1', borderDark: '#94a3b8' },
  { id: 'teal', label: 'Bleu Pétrole', bg: '#00313d', text: '#ffffff', border: '#00252e', borderDark: '#00141a' },
  { id: 'blue', label: 'Bleu Roi', bg: '#2563eb', text: '#ffffff', border: '#1d4ed8', borderDark: '#1e40af' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490', borderDark: '#155e75' },
  { id: 'emerald', label: 'Vert Émeraude', bg: '#059669', text: '#ffffff', border: '#047857', borderDark: '#064e3b' },
  { id: 'amber', label: 'Orange Ambré', bg: '#ea580c', text: '#ffffff', border: '#c2410c', borderDark: '#9a3412' },
  { id: 'red', label: 'Rouge Carmin', bg: '#dc2626', text: '#ffffff', border: '#b91c1c', borderDark: '#991b1b' },
  { id: 'purple', label: 'Violet Sombre', bg: '#7c3aed', text: '#ffffff', border: '#6d28d9', borderDark: '#5b21b6' },
  { id: 'gold', label: 'Or / Safran', bg: '#d97706', text: '#ffffff', border: '#b45309', borderDark: '#92400e' },
  { id: 'rose', label: 'Rose Framboise', bg: '#db2777', text: '#ffffff', border: '#be185d', borderDark: '#9d174d' },
];

const CLASS_LEVEL_SUGGESTIONS = [
  'CP1', 'CP2', 'CE1', 'CE2', 'CM1', 'CM2',
  '6ème', '5ème', '4ème', '3ème',
  '2nde', '1ère', 'Terminale',
  'Licence 1', 'Licence 2', 'Master 1'
];

const CLASS_SUBJECT_SUGGESTIONS = [
  'Mathématiques', 'Français', 'Physique-Chimie', 'SVT',
  'Histoire-Géo', 'Anglais', 'Philosophie', 'Informatique',
  'EPS / Sport', 'Arts Plastiques', 'Musique', 'Économie',
  'Espagnol', 'Allemand'
];

// Couleurs proposées pour les écoles (Blanc par défaut si non choisi)
const SCHOOL_COLOR_OPTIONS = [
  { id: 'white', label: 'Blanc (Défaut)', bg: '#ffffff', text: '#0f172a', border: '#e2e8f0', borderDark: '#94a3b8' },
  { id: 'teal', label: 'Bleu Pétrole', bg: '#00313d', text: '#ffffff', border: '#00252e', borderDark: '#00141a' },
  { id: 'blue', label: 'Bleu Océan', bg: '#1d4ed8', text: '#ffffff', border: '#1e40af', borderDark: '#172554' },
  { id: 'cyan', label: 'Cyan Céleste', bg: '#0891b2', text: '#ffffff', border: '#0e7490', borderDark: '#155e75' },
  { id: 'emerald', label: 'Vert Émeraude', bg: '#047857', text: '#ffffff', border: '#065f46', borderDark: '#064e3b' },
  { id: 'amber', label: 'Orange Ambré', bg: '#c2410c', text: '#ffffff', border: '#9a3412', borderDark: '#7c2d12' },
  { id: 'red', label: 'Rouge Carmin', bg: '#b91c1c', text: '#ffffff', border: '#991b1b', borderDark: '#7f1d1d' },
  { id: 'purple', label: 'Violet Profond', bg: '#6b21a8', text: '#ffffff', border: '#581c87', borderDark: '#3b0764' },
  { id: 'indigo', label: 'Indigo Nuit', bg: '#3730a3', text: '#ffffff', border: '#312e81', borderDark: '#1e1b4b' },
  { id: 'slate', label: 'Gris Ardoise', bg: '#334155', text: '#ffffff', border: '#1e293b', borderDark: '#0f172a' },
];

// Années suggérées automatiquement à partir de l'année courante (2026)
const CURRENT_YEAR = new Date().getFullYear() || 2026;
const SUGGESTED_YEARS = [
  `${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`,
  `${CURRENT_YEAR + 1} - ${CURRENT_YEAR + 2}`,
  `${CURRENT_YEAR + 2} - ${CURRENT_YEAR + 3}`,
  `${CURRENT_YEAR + 3} - ${CURRENT_YEAR + 4}`,
  `${CURRENT_YEAR - 1} - ${CURRENT_YEAR}`,
];

export const TeacherClassesView: React.FC<TeacherClassesViewProps> = ({ onBack, user }) => {
  // 1. Accueil par défaut de cette application : le bouton "Tableau de bord" (comme entouré sur l'image 1)
  const [activeNavTab, setActiveNavTab] = useState<'dashboard' | 'trainees' | 'classes' | 'discussions' | 'groups' | 'library'>('dashboard');

  // Recherche dans l'en-tête
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Années scolaires créées (Persistance locale)
  const [schoolYears, setSchoolYears] = useState<SchoolYearItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_teacher_school_years');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch { }
    // Par défaut, première rentrée scolaire 2026 - 2027 pré-initialisée
    return [
      { id: 'year-default', label: `${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`, color: '#00313d', textColor: '#ffffff', createdAt: Date.now() }
    ];
  });

  const [selectedYearId, setSelectedYearId] = useState<string>(() => {
    return schoolYears[0]?.id || '';
  });

  // Sauvegarde persistante des années scolaires
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_teacher_school_years', JSON.stringify(schoolYears));
    } catch { }
  }, [schoolYears]);

  // Écoles créées attachées à chaque année scolaire (Persistance locale)
  const [schools, setSchools] = useState<SchoolItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_teacher_schools');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  // École sélectionnée dans laquelle on est "rentré" à l'intérieur
  const [selectedSchoolInside, setSelectedSchoolInside] = useState<SchoolItem | null>(null);

  // Classes créées attachées à chaque école (Persistance locale)
  const [classes, setClasses] = useState<ClassItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_teacher_classes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  // Sauvegarde persistante des classes
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_teacher_classes', JSON.stringify(classes));
    } catch { }
  }, [classes]);

  // Classe activement sélectionnée parmi les classes de l'école (comme des boutons sélectionnables)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  // Référence pour le défilement horizontal fluide des classes
  const classesScrollRef = useRef<HTMLDivElement>(null);

  const scrollClasses = (direction: 'left' | 'right') => {
    if (classesScrollRef.current) {
      const scrollAmount = 300;
      classesScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Matières créées attachées à chaque classe (Persistance locale)
  const [subjects, setSubjects] = useState<SubjectItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_teacher_subjects');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  // Sauvegarde persistante des matières
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_teacher_subjects', JSON.stringify(subjects));
    } catch { }
  }, [subjects]);

  // Trimestres des classes (Trimestre 1, 2, 3 créés automatiquement par classe)
  const [terms, setTerms] = useState<TermItem[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_teacher_terms');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { }
    return [];
  });

  // Sauvegarde persistante des trimestres
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_teacher_terms', JSON.stringify(terms));
    } catch { }
  }, [terms]);

  // Trimestre actif sélectionné
  const [selectedTermId, setSelectedTermId] = useState<string | null>(null);

  // Référence pour le défilement horizontal fluide des trimestres
  const termsScrollRef = useRef<HTMLDivElement>(null);

  const scrollTerms = (direction: 'left' | 'right') => {
    if (termsScrollRef.current) {
      const scrollAmount = 250;
      termsScrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // État du modal d'ajout d'un nouveau trimestre
  const [isAddTermModalOpen, setIsAddTermModalOpen] = useState(false);

  // État pour le bouton de copie rapide du nom dans la modale de suppression
  const [isCopiedDeleteName, setIsCopiedDeleteName] = useState(false);
  const handleCopyDeleteName = (name: string) => {
    try {
      navigator.clipboard.writeText(name);
    } catch { }
    setDeleteConfirmInput(name);
    setIsCopiedDeleteName(true);
    setTimeout(() => setIsCopiedDeleteName(false), 2000);
  };

  // Migration automatique : s'assurer que toutes les classes existantes ont leurs 3 trimestres par défaut
  useEffect(() => {
    if (classes.length === 0) return;
    setTerms(prev => {
      let updated = [...prev];
      let added = false;
      classes.forEach(c => {
        const classTerms = updated.filter(t => t.classId === c.id);
        if (classTerms.length === 0) {
          added = true;
          updated.push(
            { id: `term-${c.id}-1`, classId: c.id, schoolId: c.schoolId, yearId: c.yearId, number: 1, name: 'Trimestre 1', createdAt: Date.now() },
            { id: `term-${c.id}-2`, classId: c.id, schoolId: c.schoolId, yearId: c.yearId, number: 2, name: 'Trimestre 2', createdAt: Date.now() + 1 },
            { id: `term-${c.id}-3`, classId: c.id, schoolId: c.schoolId, yearId: c.yearId, number: 3, name: 'Trimestre 3', createdAt: Date.now() + 2 }
          );
        }
      });
      return added ? updated : prev;
    });
  }, [classes]);

  // --- ÉTATS POUR LES MENUS CONTEXTUELS "3 TRAITS", ÉDITION ET SUPPRESSION SÉCURISÉE ---
  interface ActiveMenuState {
    type: 'school' | 'class' | 'subject';
    id: string;
    item: any;
    position: { top: number; left: number };
  }
  const [activeMenu, setActiveMenu] = useState<ActiveMenuState | null>(null);

  // Cible de suppression sécurisée (nécessite la saisie exacte du nom)
  interface DeleteTargetState {
    type: 'school' | 'class' | 'subject';
    id: string;
    name: string;
    displayName: string;
    warningMessage: string;
  }
  const [deleteTarget, setDeleteTarget] = useState<DeleteTargetState | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('');

  // États des éléments en cours de modification
  const [editingSchool, setEditingSchool] = useState<SchoolItem | null>(null);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);

  // Fermer le menu contextuel lors d'un clic extérieur ou du défilement
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.card-dropdown-menu') && !target.closest('.card-menu-trigger')) {
        setActiveMenu(null);
      }
    };
    const handleScroll = () => {
      setActiveMenu(null);
    };
    if (activeMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
      window.addEventListener('scroll', handleScroll, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeMenu]);

  // Positionnement intelligent du menu 3 traits (ne se coupe jamais dans le creux, ne déborde pas)
  const handleOpenMenu = (
    e: React.MouseEvent<HTMLButtonElement>,
    type: 'school' | 'class' | 'subject',
    item: any
  ) => {
    e.stopPropagation();
    if (activeMenu?.type === type && activeMenu?.id === item.id) {
      setActiveMenu(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 195;
    const menuHeight = 90;

    let left = rect.right - menuWidth;
    if (left < 10) {
      left = rect.left;
    }
    if (left + menuWidth > window.innerWidth - 10) {
      left = window.innerWidth - menuWidth - 10;
    }

    let top = rect.bottom + 4;
    if (top + menuHeight > window.innerHeight - 10) {
      top = rect.top - menuHeight - 4;
    }

    setActiveMenu({
      type,
      id: item.id,
      item,
      position: { top, left }
    });
  };

  const handleTriggerEdit = (type: 'school' | 'class' | 'subject', item: any) => {
    setActiveMenu(null);
    if (type === 'school') {
      const school = item as SchoolItem;
      setEditingSchool(school);
      setSchoolName(school.name);
      setSchoolLogo(school.logoUrl || null);
      setSelectedSchoolColor(
        SCHOOL_COLOR_OPTIONS.find(c => c.bg === school.color) ||
        SCHOOL_COLOR_OPTIONS[0]
      );
      setIsAddSchoolModalOpen(true);
    } else if (type === 'class') {
      const cls = item as ClassItem;
      setEditingClass(cls);
      setClassLevel(cls.level);
      setClassName(cls.name || '');
      setClassSlogan(cls.slogan || '');
      setClassTeacherName(cls.teacherName);
      setSelectedClassColor(
        CLASS_COLOR_OPTIONS.find(c => c.bg === cls.color) ||
        CLASS_COLOR_OPTIONS[0]
      );
      setIsAddClassModalOpen(true);
    } else if (type === 'subject') {
      const subj = item as SubjectItem;
      setEditingSubject(subj);
      setSubjectName(subj.name);
      setSubjectCoefficient(subj.coefficient !== undefined ? String(subj.coefficient) : '');
      setSelectedSubjectColor(
        SUBJECT_COLOR_OPTIONS.find(c => c.bg === subj.color) ||
        SUBJECT_COLOR_OPTIONS[0]
      );
      setIsAddSubjectModalOpen(true);
    }
  };

  const handleTriggerDelete = (type: 'school' | 'class' | 'subject', item: any) => {
    setActiveMenu(null);
    if (type === 'school') {
      const school = item as SchoolItem;
      setDeleteTarget({
        type: 'school',
        id: school.id,
        name: school.name,
        displayName: `l'établissement "${school.name}"`,
        warningMessage: "Toutes les classes, matières, évaluations et données associées à cet établissement seront définitivement supprimées."
      });
    } else if (type === 'class') {
      const cls = item as ClassItem;
      const fullName = `${cls.level}${cls.name ? ' ' + cls.name : ''}`.trim();
      setDeleteTarget({
        type: 'class',
        id: cls.id,
        name: fullName,
        displayName: `la classe "${fullName}"`,
        warningMessage: "Toutes les matières, les élèves enregistrés, les notes et moyennes associées à cette classe seront définitivement supprimés."
      });
    } else if (type === 'subject') {
      const subj = item as SubjectItem;
      setDeleteTarget({
        type: 'subject',
        id: subj.id,
        name: subj.name,
        displayName: `la matière "${subj.name}"`,
        warningMessage: "Toutes les évaluations, notes et coefficients associés à cette matière seront définitivement supprimés."
      });
    }
    setDeleteConfirmInput('');
  };

  const handleConfirmDelete = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!deleteTarget) return;
    if (deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()) return;

    if (deleteTarget.type === 'school') {
      const id = deleteTarget.id;
      setSchools(prev => prev.filter(s => s.id !== id));
      setClasses(prev => prev.filter(c => c.schoolId !== id));
      setSubjects(prev => prev.filter(s => s.schoolId !== id));
      setTerms(prev => prev.filter(t => t.schoolId !== id));
      if (selectedSchoolId === id) setSelectedSchoolId(null);
      if (selectedSchoolInside?.id === id) setSelectedSchoolInside(null);
    } else if (deleteTarget.type === 'class') {
      const id = deleteTarget.id;
      setClasses(prev => prev.filter(c => c.id !== id));
      setSubjects(prev => prev.filter(s => s.classId !== id));
      setTerms(prev => prev.filter(t => t.classId !== id));
      if (selectedClassId === id) setSelectedClassId(null);
    } else if (deleteTarget.type === 'subject') {
      const id = deleteTarget.id;
      setSubjects(prev => prev.filter(s => s.id !== id));
    }

    setDeleteTarget(null);
    setDeleteConfirmInput('');
  };

  // État du modal "Ajouter / Modifier une classe"
  const [isAddClassModalOpen, setIsAddClassModalOpen] = useState(false);
  const [classLevel, setClassLevel] = useState('');
  const [className, setClassName] = useState('');
  const [classSlogan, setClassSlogan] = useState('');
  const [classTeacherName, setClassTeacherName] = useState(user?.name || '');
  const [selectedClassColor, setSelectedClassColor] = useState(CLASS_COLOR_OPTIONS[0]); // Orange ambré style image

  const resetClassForm = () => {
    setClassLevel('');
    setClassName('');
    setClassSlogan('');
    setClassTeacherName(user?.name || 'Professeur');
    setSelectedClassColor(CLASS_COLOR_OPTIONS[0]);
    setEditingClass(null);
  };

  // Vérification de modification (Dirty) pour la classe
  const isClassDirty = editingClass
    ? (
        classLevel.trim() !== editingClass.level ||
        classTeacherName.trim() !== editingClass.teacherName ||
        (className.trim() || '') !== (editingClass.name || '') ||
        (classSlogan.trim() || '') !== (editingClass.slogan || '') ||
        selectedClassColor.bg !== editingClass.color
      )
    : (classLevel.trim().length > 0 && classTeacherName.trim().length > 0);

  const handleCreateClass = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!classLevel.trim() || !classTeacherName.trim()) return;

    if (editingClass) {
      if (!isClassDirty) return;
      const updated: ClassItem = {
        ...editingClass,
        level: classLevel.trim(),
        name: className.trim() || undefined,
        slogan: classSlogan.trim() || undefined,
        teacherName: classTeacherName.trim(),
        color: selectedClassColor.bg,
        textColor: selectedClassColor.text,
        borderColor: selectedClassColor.border,
        borderDarkColor: selectedClassColor.borderDark,
        iconGradient: selectedClassColor.iconGradient,
      };
      setClasses(prev => prev.map(c => c.id === editingClass.id ? updated : c));
      setIsAddClassModalOpen(false);
      resetClassForm();
    } else {
      if (!selectedSchoolInside) return;
      const newClassId = `class-${Date.now()}`;
      const newClass: ClassItem = {
        id: newClassId,
        schoolId: selectedSchoolInside.id,
        yearId: selectedSchoolInside.yearId,
        level: classLevel.trim(),
        name: className.trim() || undefined,
        slogan: classSlogan.trim() || undefined,
        teacherName: classTeacherName.trim(),
        color: selectedClassColor.bg,
        textColor: selectedClassColor.text,
        borderColor: selectedClassColor.border,
        borderDarkColor: selectedClassColor.borderDark,
        iconGradient: selectedClassColor.iconGradient,
        createdAt: Date.now()
      };
      const defaultTerms: TermItem[] = [
        { id: `term-${newClassId}-1`, classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 1, name: 'Trimestre 1', createdAt: Date.now() },
        { id: `term-${newClassId}-2`, classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 2, name: 'Trimestre 2', createdAt: Date.now() + 1 },
        { id: `term-${newClassId}-3`, classId: newClassId, schoolId: selectedSchoolInside.id, yearId: selectedSchoolInside.yearId, number: 3, name: 'Trimestre 3', createdAt: Date.now() + 2 }
      ];
      setClasses(prev => [...prev, newClass]);
      setTerms(prev => [...prev, ...defaultTerms]);
      setSelectedClassId(newClass.id);
      setSelectedTermId(defaultTerms[0].id);
      setIsAddClassModalOpen(false);
      resetClassForm();
    }
  };

  // État du modal "Créer / Modifier une matière"
  const [isAddSubjectModalOpen, setIsAddSubjectModalOpen] = useState(false);
  const [subjectName, setSubjectName] = useState('');
  const [subjectCoefficient, setSubjectCoefficient] = useState<string>('');
  const [selectedSubjectColor, setSelectedSubjectColor] = useState(SUBJECT_COLOR_OPTIONS[0]); // Blanc par défaut

  const resetSubjectForm = () => {
    setSubjectName('');
    setSubjectCoefficient('');
    setSelectedSubjectColor(SUBJECT_COLOR_OPTIONS[0]);
    setEditingSubject(null);
  };

  // Vérification de modification (Dirty) pour la matière
  const origSubjectCoeff = (editingSubject?.coefficient !== undefined && editingSubject?.coefficient !== null)
    ? String(editingSubject.coefficient)
    : '';
  const isSubjectDirty = editingSubject
    ? (
        subjectName.trim() !== editingSubject.name ||
        subjectCoefficient.trim() !== origSubjectCoeff ||
        selectedSubjectColor.bg !== editingSubject.color
      )
    : subjectName.trim().length > 0;

  const handleCreateSubject = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!subjectName.trim()) return;

    const coeffNum = subjectCoefficient.trim() ? parseFloat(subjectCoefficient.trim()) : undefined;
    const parsedCoeff = (coeffNum !== undefined && !isNaN(coeffNum)) ? coeffNum : undefined;

    if (editingSubject) {
      if (!isSubjectDirty) return;
      const updated: SubjectItem = {
        ...editingSubject,
        name: subjectName.trim(),
        coefficient: parsedCoeff,
        termId: editingSubject.termId || activeTerm?.id,
        color: selectedSubjectColor.bg,
        textColor: selectedSubjectColor.text,
        borderColor: selectedSubjectColor.border,
        borderDarkColor: selectedSubjectColor.borderDark,
      };
      setSubjects(prev => prev.map(s => s.id === editingSubject.id ? updated : s));
      setIsAddSubjectModalOpen(false);
      resetSubjectForm();
    } else {
      if (!activeClass || !selectedSchoolInside) return;
      const targetTermId = activeTerm?.id || currentClassTerms[0]?.id || `term-${activeClass.id}-1`;
      const newSubject: SubjectItem = {
        id: `subject-${Date.now()}`,
        classId: activeClass.id,
        termId: targetTermId,
        schoolId: selectedSchoolInside.id,
        yearId: selectedSchoolInside.yearId,
        name: subjectName.trim(),
        coefficient: parsedCoeff,
        color: selectedSubjectColor.bg,
        textColor: selectedSubjectColor.text,
        borderColor: selectedSubjectColor.border,
        borderDarkColor: selectedSubjectColor.borderDark,
        createdAt: Date.now()
      };
      setSubjects(prev => [...prev, newSubject]);
      // Si l'espace de 3 lignes (15 matières) vient d'être totalement rempli, on bascule vers le nouvel espace vide
      if ((currentClassSubjects.length + 1) % 15 === 0) {
        setSubjectPageIndex(Math.floor((currentClassSubjects.length + 1) / 15));
      }
      setIsAddSubjectModalOpen(false);
      resetSubjectForm();
    }
  };

  // Sauvegarde persistante des écoles
  useEffect(() => {
    try {
      localStorage.setItem('studycloud_teacher_schools', JSON.stringify(schools));
    } catch { }
  }, [schools]);

  // État du modal "Ajouter une école"
  const [isAddSchoolModalOpen, setIsAddSchoolModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [selectedSchoolColor, setSelectedSchoolColor] = useState(SCHOOL_COLOR_OPTIONS[0]); // Blanc par défaut
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compression & chargement du logo de l'école (format rond max 256x256 px pour préserver le stockage)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png', 0.85);
          setSchoolLogo(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Vérification de modification (Dirty) pour l'école
  const isSchoolDirty = editingSchool
    ? (
        schoolName.trim() !== editingSchool.name ||
        (schoolLogo || null) !== (editingSchool.logoUrl || null) ||
        selectedSchoolColor.bg !== editingSchool.color
      )
    : schoolName.trim().length > 0;

  // Création ou modification d'une école
  const handleCreateSchool = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = schoolName.trim();
    if (!cleanName) return;

    if (editingSchool) {
      if (!isSchoolDirty) return;
      const updated: SchoolItem = {
        ...editingSchool,
        name: cleanName,
        logoUrl: schoolLogo || undefined,
        color: selectedSchoolColor.bg,
        textColor: selectedSchoolColor.text,
        borderColor: selectedSchoolColor.border,
        borderDarkColor: selectedSchoolColor.borderDark,
      };
      setSchools(prev => prev.map(s => s.id === editingSchool.id ? updated : s));
      if (selectedSchoolInside?.id === editingSchool.id) {
        setSelectedSchoolInside(updated);
      }
      setIsAddSchoolModalOpen(false);
      setEditingSchool(null);
    } else {
      if (!selectedYearId) return;
      const newSchool: SchoolItem = {
        id: `school-${Date.now()}`,
        yearId: selectedYearId,
        name: cleanName,
        logoUrl: schoolLogo || undefined,
        color: selectedSchoolColor.bg,
        textColor: selectedSchoolColor.text,
        borderColor: selectedSchoolColor.border,
        borderDarkColor: selectedSchoolColor.borderDark,
        createdAt: Date.now(),
      };

      setSchools(prev => [...prev, newSchool]);
      setSelectedSchoolId(newSchool.id);
      setIsAddSchoolModalOpen(false);
    }

    setSchoolName('');
    setSchoolLogo(null);
    setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
  };

  // État du menu déroulant "Créer une rentrée scolaire"
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [inputYearValue, setInputYearValue] = useState(`${CURRENT_YEAR} - ${CURRENT_YEAR + 1}`);
  const [selectedColorObj, setSelectedColorObj] = useState(YEAR_COLOR_OPTIONS[0]); // Par défaut blanc / aucune couleur
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fermer le menu déroulant lors d'un clic en dehors
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    if (isCreateMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isCreateMenuOpen]);

  // Gestion de la saisie manuelle : Uniquement chiffres et tiret/espace, max 12 caractères
  const handleYearInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // Seulement les chiffres, espaces et tirets sont autorisés, max 12 caractères
    const filtered = raw.replace(/[^0-9\s-]/g, '').slice(0, 12);
    setInputYearValue(filtered);
  };

  // Création / Application de l'année scolaire
  const handleApplyYear = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanLabel = inputYearValue.trim();
    if (!cleanLabel) return;

    // Vérifier si l'année existe déjà
    const existing = schoolYears.find(y => y.label.toLowerCase() === cleanLabel.toLowerCase());
    if (existing) {
      setSelectedYearId(existing.id);
      setIsCreateMenuOpen(false);
      return;
    }

    const newYearItem: SchoolYearItem = {
      id: `year-${Date.now()}`,
      label: cleanLabel,
      color: selectedColorObj.bg,
      textColor: selectedColorObj.text,
      createdAt: Date.now()
    };

    setSchoolYears(prev => [...prev, newYearItem]);
    setSelectedYearId(newYearItem.id);
    setIsCreateMenuOpen(false);
  };

  // Suppression d'une rentrée scolaire
  const handleDeleteYear = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSchoolYears(prev => {
      const updated = prev.filter(y => y.id !== id);
      if (selectedYearId === id && updated.length > 0) {
        setSelectedYearId(updated[0].id);
      }
      return updated;
    });
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trainees', label: 'Trainees', icon: Users },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
    { id: 'groups', label: 'Groups', icon: Users2 },
    { id: 'library', label: 'Library', icon: Layers },
  ] as const;

  const currentSelectedYear = schoolYears.find(y => y.id === selectedYearId) || schoolYears[0];
  const currentYearSchools = schools.filter(s => s.yearId === currentSelectedYear?.id);
  const currentSchoolClasses = selectedSchoolInside
    ? classes.filter(c => c.schoolId === selectedSchoolInside.id)
    : [];

  // Classe active (sélectionnée via les cartes boutons horizontales)
  const activeClass = (selectedClassId && currentSchoolClasses.find(c => c.id === selectedClassId))
    || currentSchoolClasses[0]
    || null;

  // Assurer que selectedClassId pointe toujours vers une classe valide si disponible
  useEffect(() => {
    if (currentSchoolClasses.length > 0) {
      if (!selectedClassId || !currentSchoolClasses.some(c => c.id === selectedClassId)) {
        setSelectedClassId(currentSchoolClasses[0].id);
      }
    } else {
      setSelectedClassId(null);
    }
  }, [currentSchoolClasses, selectedClassId]);

  // Trimestres de la classe active (Trimestre 1, Trimestre 2, Trimestre 3...)
  const currentClassTerms = useMemo(() => {
    if (!activeClass) return [];
    return terms
      .filter(t => t.classId === activeClass.id)
      .sort((a, b) => a.number - b.number);
  }, [terms, activeClass]);

  // Trimestre actif
  const activeTerm = (selectedTermId && currentClassTerms.find(t => t.id === selectedTermId))
    || currentClassTerms[0]
    || null;

  // Assurer que selectedTermId pointe toujours vers un trimestre valide
  useEffect(() => {
    if (currentClassTerms.length > 0) {
      if (!selectedTermId || !currentClassTerms.some(t => t.id === selectedTermId)) {
        setSelectedTermId(currentClassTerms[0].id);
      }
    } else {
      setSelectedTermId(null);
    }
  }, [currentClassTerms, selectedTermId]);

  // Prochain numéro de trimestre pour l'ajout
  const nextTermNumber = useMemo(() => {
    if (currentClassTerms.length === 0) return 1;
    return Math.max(...currentClassTerms.map(t => t.number)) + 1;
  }, [currentClassTerms]);

  // Confirmation de l'ajout d'un nouveau trimestre pour la classe active
  const handleConfirmAddTerm = () => {
    if (!activeClass || !selectedSchoolInside) return;
    const newTerm: TermItem = {
      id: `term-${activeClass.id}-${Date.now()}`,
      classId: activeClass.id,
      schoolId: selectedSchoolInside.id,
      yearId: selectedSchoolInside.yearId,
      number: nextTermNumber,
      name: `Trimestre ${nextTermNumber}`,
      createdAt: Date.now()
    };
    setTerms(prev => [...prev, newTerm]);
    setSelectedTermId(newTerm.id);
    setIsAddTermModalOpen(false);
  };

  // Matières de la classe active DANS LE TRIMESTRE ACTIF SÉLECTIONNÉ
  const currentClassSubjects = useMemo(() => {
    if (!activeClass || !activeTerm) return [];
    return subjects.filter(s => {
      if (s.classId !== activeClass.id) return false;
      const effectiveTermId = s.termId || currentClassTerms[0]?.id;
      return effectiveTermId === activeTerm.id;
    });
  }, [subjects, activeClass, activeTerm, currentClassTerms]);

  // --- GESTION PAR ESPACE / PAGE DE 3 LIGNES (15 EMPLACEMENTS PAR ESPACE) SANS DÉFILEMENT VERTICAL ---
  const SUBJECTS_PER_PAGE = 15; // 3 lignes de 5 colonnes
  const [subjectPageIndex, setSubjectPageIndex] = useState<number>(0);

  const totalSubjectPages = useMemo(() => {
    return Math.floor(currentClassSubjects.length / SUBJECTS_PER_PAGE) + 1;
  }, [currentClassSubjects.length]);

  // Réinitialiser la page quand on change de classe ou de trimestre
  useEffect(() => {
    setSubjectPageIndex(0);
  }, [selectedClassId, selectedTermId]);

  // S'assurer que subjectPageIndex ne dépasse pas totalSubjectPages
  useEffect(() => {
    if (subjectPageIndex >= totalSubjectPages) {
      setSubjectPageIndex(Math.max(0, totalSubjectPages - 1));
    }
  }, [totalSubjectPages, subjectPageIndex]);

  // Matières découpées pour l'espace actuellement affiché
  const pagedSubjects = useMemo(() => {
    const start = subjectPageIndex * SUBJECTS_PER_PAGE;
    return currentClassSubjects.slice(start, start + SUBJECTS_PER_PAGE);
  }, [currentClassSubjects, subjectPageIndex]);

  const isLastSubjectPage = subjectPageIndex === totalSubjectPages - 1;

  return (
    <div 
      className="relative w-full h-full min-h-dvh flex flex-col md:flex-row overflow-hidden font-sans select-none"
      style={{
        background: 'linear-gradient(135deg, #dcf0fa 0%, #e6f4fb 35%, #edf7fc 70%, #dff2fa 100%)'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. BARRE LATÉRALE BUREAU (Desktop >= md : Deep Teal / Pétrole Foncé) */}
      {/* ========================================================================= */}
      <aside 
        className="hidden md:flex w-20 lg:w-24 shrink-0 flex-col items-center py-5 justify-between z-30 transition-all border-r border-[#002830]/30 shadow-2xl h-full"
        style={{ backgroundColor: '#002f3a' }}
      >
        {/* Logo supérieur (Vague circulaire cyan / StudyCloud Pro) */}
        <div className="flex flex-col items-center gap-1.5 cursor-pointer" onClick={onBack} title="Retour à l'accueil StudyCloud">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-300 to-teal-200 flex items-center justify-center shadow-lg shadow-cyan-900/40 border border-white/40 group hover:scale-105 transition">
            <svg className="w-6 h-6 text-[#002f3a]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
          </div>
          <span className="text-[9px] font-bold tracking-tight text-cyan-200/90 text-center leading-none">
            StudyCloud
          </span>
        </div>

        {/* Éléments de navigation verticaux Desktop (Accueil actif sur Dashboard - Image 1) */}
        <nav className="flex flex-col items-center gap-4 my-auto w-full px-2">
          {navItems.map((item) => {
            const isActive = activeNavTab === item.id;
            const IconComponent = item.icon;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNavTab(item.id)}
                className={`group flex flex-col items-center justify-center w-full py-1.5 transition-all relative ${
                  isActive ? 'opacity-100' : 'opacity-65 hover:opacity-100'
                }`}
                title={item.label}
              >
                {isActive ? (
                  // Onglet Actif : Icône dans un conteneur blanc doux arrondi
                  <div className="w-10 h-10 rounded-2xl bg-white text-[#002f3a] shadow-lg shadow-black/20 flex items-center justify-center transition-transform scale-105">
                    <IconComponent className="w-5 h-5 stroke-[2.4]" />
                  </div>
                ) : (
                  // Onglet Inactif : Icône épurée
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-cyan-100/80 group-hover:bg-white/10 group-hover:text-white transition">
                    <IconComponent className="w-5 h-5 stroke-[1.8]" />
                  </div>
                )}
                
                {/* Libellé sous l'icône */}
                <span className={`text-[10px] mt-1 font-semibold tracking-wide transition-colors ${
                  isActive ? 'text-white font-bold' : 'text-cyan-100/70 group-hover:text-white'
                }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* Bouton retour bas de page */}
        <button
          type="button"
          onClick={onBack}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-cyan-200/70 hover:text-white hover:bg-white/10 transition"
          title="Quitter et revenir à StudyCloud"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </aside>

      {/* ========================================================================= */}
      {/* 2. ESPACE PRINCIPAL DE TRAVAIL (Plein écran Edge-to-Edge & Défilement fluide) */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full min-h-dvh overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 lg:p-8 pb-24 md:pb-8 space-y-5 md:space-y-6">
        
        {/* ----------------------------------------------------------------------- */}
        {/* EN-TÊTE : BOUTON RETOUR, TITRE DYNAMIQUE, ACTIONS & PROFIL */}
        {/* ----------------------------------------------------------------------- */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Bouton Retour (nommé "Retour" comme demandé) et Titre dynamique */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wider flex items-center gap-1.5 mb-1">
              <span>Tableau de bord</span>
              {selectedSchoolInside ? (
                <>
                  <span>/</span>
                  <span className="text-slate-500">{currentSelectedYear?.label}</span>
                  <span>/</span>
                  <span className="text-cyan-700 font-extrabold">{selectedSchoolInside.name}</span>
                </>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={selectedSchoolInside ? () => setSelectedSchoolInside(null) : onBack}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 shadow-xs transition active:scale-95 font-bold text-xs sm:text-sm"
                title={selectedSchoolInside ? "Retour à la liste des écoles" : "Retour à l'accueil"}
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Retour</span>
              </button>

              {selectedSchoolInside ? (
                <div className="flex items-center gap-2.5 ml-1">
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-xs shrink-0 flex items-center justify-center bg-white/60">
                    {selectedSchoolInside.logoUrl ? (
                      <img src={selectedSchoolInside.logoUrl} alt={selectedSchoolInside.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-black text-xs text-[#00313d]">
                        {selectedSchoolInside.name.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <h1 className="text-xl sm:text-2xl font-black text-[#0f2430] tracking-tight">
                    {selectedSchoolInside.name}
                  </h1>
                  <span className="text-[10px] font-extrabold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200/60 hidden sm:inline-block">
                    {currentSelectedYear?.label}
                  </span>
                </div>
              ) : (
                <h1 className="text-xl sm:text-2xl font-black text-[#0f2430] tracking-tight ml-1">
                  Tableau de bord
                </h1>
              )}
            </div>
          </div>

          {/* Contrôles du haut : Recherche, Notifs, Paramètres, Profil & Bouton d'action contextuel */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-between sm:justify-end">
            {/* Barre de recherche dynamique */}
            <div className="relative flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center bg-white/95 backdrop-blur-md rounded-2xl px-3 py-1.5 shadow-sm border border-white/90 transition-all w-44 sm:w-56">
                  <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Recherche..."
                    className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
                    autoFocus
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button type="button" onClick={() => setIsSearchOpen(false)} className="ml-1 text-slate-400 hover:text-slate-600">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="w-9 h-9 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white text-slate-600 flex items-center justify-center shadow-sm border border-white/90 transition"
                  title="Rechercher"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Notification Bell */}
            <button
              type="button"
              className="relative w-9 h-9 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white text-slate-600 flex items-center justify-center shadow-sm border border-white/90 transition"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>

            {/* Settings Gear */}
            <button
              type="button"
              className="w-9 h-9 rounded-2xl bg-white/80 backdrop-blur-md hover:bg-white text-slate-600 flex items-center justify-center shadow-sm border border-white/90 transition"
              title="Paramètres"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Profil Enseignant */}
            <div className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/90">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (user?.name ? user.name.charAt(0).toUpperCase() : 'DKD')
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-none">
                  {user?.name || 'Professeur'}
                </span>
                <span className="text-[9px] text-slate-400 font-medium">
                  Enseignant Pro
                </span>
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* BOUTON D'ACTION : Créer une classe (si dans l'école) OU Créer une rentrée */}
            {/* ------------------------------------------------------------------- */}
            {selectedSchoolInside ? (
              <button
                type="button"
                onClick={() => {
                  resetClassForm();
                  setIsAddClassModalOpen(true);
                }}
                className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black text-white shadow-md transition-all active:scale-95 shrink-0 hover:bg-[#00252e]"
                style={{ backgroundColor: '#00313d' }}
                title="Créer une classe"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span className="tracking-wide text-[11px] sm:text-xs">
                  Créer une classe
                </span>
              </button>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsCreateMenuOpen(!isCreateMenuOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-black text-white shadow-md transition-all active:scale-95 shrink-0"
                  style={{ backgroundColor: '#00313d' }}
                  title="Créer une rentrée scolaire"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span className="tracking-wide text-[11px] sm:text-xs">
                    Créer une rentrée scolaire
                  </span>
                </button>

                {/* Petit menu déroulant bien rectangle qui descend vers le bas */}
                {isCreateMenuOpen && (
                  <div 
                    className="absolute right-0 top-full mt-2 w-72 sm:w-80 bg-white/95 backdrop-blur-2xl rounded-2xl p-4 shadow-2xl border border-white/90 z-50 text-slate-800 space-y-3 animate-fade-in"
                    style={{
                      boxShadow: '0 20px 40px -10px rgba(0, 49, 61, 0.25)'
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-extrabold text-[#00313d] flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-cyan-600" />
                        <span>Nouvelle rentrée scolaire</span>
                      </span>
                      <button 
                        type="button" 
                        onClick={() => setIsCreateMenuOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* 1. Champ en haut bien rectangle avec bouton Créer / Appliquer à côté */}
                    <form onSubmit={handleApplyYear} className="space-y-1.5">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Année scolaire (max 12 chiffres)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={inputYearValue}
                          onChange={handleYearInputChange}
                          maxLength={12}
                          placeholder="ex: 2026 - 2027"
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono font-bold text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                          autoFocus
                        />
                        <button
                          type="submit"
                          disabled={!inputYearValue.trim()}
                          className="px-3.5 py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                          style={{ backgroundColor: '#00313d' }}
                        >
                          Créer
                        </button>
                      </div>
                      <span className="text-[9px] text-slate-400 block">
                        {inputYearValue.length}/12 caractères &bull; Chiffres autorisés
                      </span>
                    </form>

                    {/* 2. Palette de couleurs à appliquer */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Couleur du bouton de l'année
                      </label>
                      <div className="grid grid-cols-5 gap-2">
                        {YEAR_COLOR_OPTIONS.map((col) => {
                          const isSelected = selectedColorObj.id === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedColorObj(col)}
                              style={{ backgroundColor: col.bg, borderColor: col.border }}
                              className={`w-full h-7 rounded-lg border flex items-center justify-center transition-all ${
                                isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                              }`}
                              title={col.label}
                            >
                              {isSelected && (
                                <Check className={`w-3.5 h-3.5 ${col.id === 'white' ? 'text-slate-800' : 'text-white'} stroke-[3]`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 3. Propositions d'années qui commencent cette année (2026 - 2027...) */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                        Propositions rapides
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {SUGGESTED_YEARS.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setInputYearValue(sug)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold font-mono transition-all ${
                              inputYearValue === sug
                                ? 'bg-cyan-500 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bouton Appliquer bas du menu */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => handleApplyYear()}
                        className="w-full py-2 rounded-xl text-xs font-black text-white shadow-sm transition active:scale-95"
                        style={{ backgroundColor: '#00313d' }}
                      >
                        Appliquer cette rentrée scolaire
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ----------------------------------------------------------------------- */}
        {/* EMPLACEMENT DE L'IMAGE 3 : AFFICHAGE DES ANNÉES CRÉÉES SOUS FORME */}
        {/* DE PETITS RECTANGLES SUCCESSIFS (MASQUÉ SI DANS UNE ÉCOLE)           */}
        {/* ----------------------------------------------------------------------- */}
        {!selectedSchoolInside && (
          <section className="space-y-2 pt-1 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Rentrées scolaires enregistrées :
              </span>
              <span className="text-[11px] font-extrabold text-[#00313d]">
                ({schoolYears.length})
              </span>
            </div>

            {/* Ligne des boutons d'années successifs (Emplacement entouré en rouge sur l'image 3) */}
            <div className="flex items-center gap-2.5 flex-wrap">
              {schoolYears.map((year) => {
                const isSelected = selectedYearId === year.id;
                const isWhite = !year.color || year.color === '#ffffff' || year.color === 'white';

                return (
                  <div
                    key={year.id}
                    onClick={() => setSelectedYearId(year.id)}
                    style={{
                      backgroundColor: year.color || '#ffffff',
                      color: year.textColor || (isWhite ? '#0f172a' : '#ffffff'),
                      borderColor: isWhite ? '#cbd5e1' : year.color
                    }}
                    className={`group relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-extrabold tracking-wide cursor-pointer transition-all shadow-xs select-none ${
                      isSelected 
                        ? 'ring-2 ring-offset-2 ring-cyan-500 scale-105 shadow-md' 
                        : 'hover:scale-102 hover:shadow'
                    }`}
                    title={`Sélectionner l'année scolaire ${year.label}`}
                  >
                    <Calendar className="w-3.5 h-3.5 opacity-80" />
                    <span className="font-mono">{year.label}</span>
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 ring-2 ring-white ml-0.5"></span>
                    )}

                    {/* Bouton de suppression au survol si plusieurs années */}
                    {schoolYears.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteYear(year.id, e)}
                        className="opacity-0 group-hover:opacity-100 ml-1 p-0.5 rounded-full hover:bg-black/20 text-current transition"
                        title="Supprimer cette année"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* ESPACE DE TRAVAIL PRINCIPAL (ÉCOLES OU CLASSES SELON LA NAVIGATION)    */}
        {/* ----------------------------------------------------------------------- */}
        <section className="flex-1 flex flex-col justify-start pt-2">
          {selectedSchoolInside ? (
            // =====================================================================
            // CAS 1 : ON EST "À L'INTÉRIEUR" D'UNE ÉCOLE -> GESTION DES CLASSES
            // =====================================================================
            currentSchoolClasses.length === 0 ? (
              // AUCUNE CLASSE : Bouton Plus au milieu avec pointillé autour formant un carré
              <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
                    resetClassForm();
                    setIsAddClassModalOpen(true);
                  }}
                  className="group relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-dashed border-cyan-800/40 hover:border-cyan-600 bg-white/50 hover:bg-white/85 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
                  title="Ajouter une classe"
                >
                  <div className="w-16 h-16 rounded-2xl bg-[#00313d] text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-[#00242e] transition-all duration-300 mb-4 border border-cyan-300/30">
                    <Plus className="w-8 h-8 stroke-[3]" />
                  </div>
                  <span className="text-base font-black text-slate-800 group-hover:text-[#00313d] transition-colors">
                    Ajouter une classe
                  </span>
                  <p className="text-xs text-slate-500 max-w-[210px] mt-2 leading-relaxed">
                    Cliquez ici pour créer votre première classe dans <span className="font-bold text-[#00313d]">{selectedSchoolInside.name}</span>
                  </p>
                  <div className="mt-4 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200/60 text-[10px] font-extrabold text-cyan-800">
                    Nouvelle classe +
                  </div>
                </button>
              </div>
            ) : (
              // CLASSES CRÉÉES : Rangée horizontale avec flèches + Zone des matières sous la classe active
              <div className="space-y-6 pt-1 animate-fade-in">
                
                {/* ------------------------------------------------------------- */}
                {/* ZONE DES CLASSES : STICKY TOP AU DÉFILEMENT VERTICAL          */}
                {/* ------------------------------------------------------------- */}
                <div className="sticky top-0 z-20 -mx-3.5 sm:-mx-6 lg:-mx-8 px-3.5 sm:px-6 lg:px-8 pt-1.5 pb-2.5 backdrop-blur-md bg-[#dcf0fa]/95 border-b border-cyan-900/10">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                        Classes ({currentSchoolClasses.length})
                      </span>
                      <span className="text-xs text-slate-400 font-bold">&bull;</span>
                      <span className="text-xs font-bold text-cyan-800 bg-white/90 px-2 py-0.5 rounded-lg border border-cyan-200/60 shadow-2xs">
                        {selectedSchoolInside.name}
                      </span>
                      <span className="text-[10px] text-slate-400 hidden sm:inline-block font-medium">
                        (Sélectionnez une classe pour afficher et créer ses matières)
                      </span>
                    </div>

                    {/* Flèches de défilement horizontal gauche et droite */}
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => scrollClasses('left')}
                        className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs flex items-center justify-center transition active:scale-95"
                        title="Défiler les classes vers la gauche"
                      >
                        <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollClasses('right')}
                        className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200 shadow-xs flex items-center justify-center transition active:scale-95"
                        title="Défiler les classes vers la droite"
                      >
                        <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                      </button>
                    </div>
                  </div>

                  {/* Rangée horizontale unique de classes avec pt-3.5 pour laisser respirer le badge sans coupure */}
                  <div 
                    ref={classesScrollRef}
                    className="flex items-stretch gap-3.5 overflow-x-auto pt-3.5 pb-2 scrollbar-none scroll-smooth flex-nowrap"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    {currentSchoolClasses.map((cls) => {
                      const isSelected = activeClass?.id === cls.id;
                      const classSubjCount = subjects.filter(s => s.classId === cls.id).length;

                      return (
                        <div
                          key={cls.id}
                          onClick={() => setSelectedClassId(cls.id)}
                          style={{
                            borderColor: isSelected ? '#0891b2' : (cls.borderColor || '#ea580c'),
                            borderBottomColor: isSelected ? '#00313d' : (cls.borderDarkColor || '#9a3412'),
                          }}
                          className={`group relative w-60 sm:w-64 shrink-0 rounded-2xl border-2 border-b-[5px] bg-white p-2.5 sm:p-3 px-3.5 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none ${
                            isSelected
                              ? 'ring-4 ring-offset-2 ring-cyan-500 border-cyan-500 shadow-xl scale-[1.02]'
                              : 'shadow-[0_6px_14px_-3px_rgba(0,0,0,0.08)] hover:shadow-md hover:-translate-y-0.5'
                          } active:translate-y-0.5 active:border-b-2`}
                        >
                          {/* Badge "Classe active" très net, surélevé avec fond sombre et bordure lumineuse, jamais coupé */}
                          {isSelected && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[#00313d] text-cyan-300 text-[9px] font-black shadow-md tracking-wider uppercase border-2 border-cyan-400 whitespace-nowrap z-20">
                              ★ Classe active
                            </div>
                          )}

                          {/* Ligne Supérieure : Icône Livre + Niveau & Slogan + Statut & Suppression */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2 min-w-0 flex-1">
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center shadow-xs shrink-0"
                                style={{ background: cls.iconGradient || 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)' }}
                              >
                                <BookOpen className="w-4 h-4 text-white stroke-[2.2]" />
                              </div>

                              <div className="min-w-0 flex-1">
                                <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400 block truncate leading-tight">
                                  {cls.slogan || `${classSubjCount} matière${classSubjCount > 1 ? 's' : ''}`}
                                </span>
                                <h4 className="text-sm font-black text-slate-900 tracking-tight leading-snug truncate mt-0.5">
                                  {cls.level} {cls.name ? `• ${cls.name}` : ''}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span 
                                className="w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-2xs"
                                style={{ backgroundColor: cls.color || '#ea580c' }}
                              />
                              <button
                                type="button"
                                onClick={(e) => handleOpenMenu(e, 'class', cls)}
                                className="card-menu-trigger w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition z-10"
                                title="Options de la classe"
                              >
                                <div className="w-3.5 h-2.5 flex flex-col justify-between items-center pointer-events-none">
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* Ligne Inférieure : Professeur & Effectif Matières (Hauteur verticale réduite) */}
                          <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                            <div className="flex flex-col min-w-0">
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                PROFESSEUR
                              </span>
                              <span className="text-[10px] font-extrabold text-slate-700 truncate max-w-[110px]">
                                {cls.teacherName}
                              </span>
                            </div>

                            <div className="flex flex-col items-end shrink-0">
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                                MATIÈRES
                              </span>
                              <span className="text-[9.5px] font-black text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200/50 mt-0.5">
                                {classSubjCount} mat.
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Bouton pour ajouter une autre classe dans la rangée horizontale */}
                    <button
                      type="button"
                      onClick={() => {
                        resetClassForm();
                        setIsAddClassModalOpen(true);
                      }}
                      className="w-44 sm:w-52 shrink-0 border-2 border-dashed border-cyan-800/30 hover:border-cyan-600 bg-white/40 hover:bg-white/80 backdrop-blur-md rounded-2xl p-2.5 sm:p-3 flex items-center justify-center gap-2 text-center cursor-pointer transition-all duration-200 group hover:-translate-y-0.5 shadow-2xs"
                      title="Ajouter une autre classe"
                    >
                      <div className="w-7 h-7 rounded-lg bg-[#00313d] text-white flex items-center justify-center group-hover:scale-105 shadow-xs transition shrink-0">
                        <Plus className="w-4 h-4 stroke-[2.5]" />
                      </div>
                      <span className="text-xs font-black text-slate-700 group-hover:text-[#00313d] transition-colors">
                        + Nouvelle classe
                      </span>
                    </button>
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* ZONE DES TRIMESTRES : HORIZONTALE AVEC FLÈCHES & AJOUT (+)   */}
                {/* ------------------------------------------------------------- */}
                {activeClass && (
                  <div className="space-y-2 pt-2 animate-fade-in">
                    {/* En-tête de la section trimestres avec flèches */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Trimestres ({currentClassTerms.length})
                        </span>
                        <span className="text-xs text-slate-400 font-bold">&bull;</span>
                        <span className="text-xs font-bold text-[#00313d] bg-white/80 px-2.5 py-0.5 rounded-lg border border-cyan-200/60 shadow-2xs">
                          {activeClass.level} {activeClass.name ? `• ${activeClass.name}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => scrollTerms('left')}
                          className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-[#00313d] border border-slate-200/80 shadow-2xs flex items-center justify-center transition active:scale-90 cursor-pointer"
                          title="Défiler les trimestres à gauche"
                        >
                          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => scrollTerms('right')}
                          className="w-7 h-7 rounded-lg bg-white/90 hover:bg-white text-slate-700 hover:text-[#00313d] border border-slate-200/80 shadow-2xs flex items-center justify-center transition active:scale-90 cursor-pointer"
                          title="Défiler les trimestres à droite"
                        >
                          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                        </button>
                      </div>
                    </div>

                    {/* Rangée horizontale des trimestres avec overflow-x-auto */}
                    <div 
                      ref={termsScrollRef}
                      className="flex items-center gap-2.5 overflow-x-auto pb-2 scrollbar-none scroll-smooth select-none pt-0.5"
                    >
                      {currentClassTerms.map((term) => {
                        const isSelected = activeTerm?.id === term.id;
                        const termSubjCount = subjects.filter(s => {
                          if (s.classId !== activeClass.id) return false;
                          const effectiveTermId = s.termId || currentClassTerms[0]?.id;
                          return effectiveTermId === term.id;
                        }).length;

                        return (
                          <button
                            key={term.id}
                            type="button"
                            onClick={() => setSelectedTermId(term.id)}
                            className={`group shrink-0 px-4 py-2 sm:px-4.5 sm:py-2 rounded-xl border-2 transition-all duration-200 flex items-center gap-2.5 cursor-pointer ${
                              isSelected
                                ? 'bg-[#00313d] text-white border-[#002028] border-b-[4px] shadow-md scale-[1.02]'
                                : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300 border-b-[3px] shadow-xs hover:-translate-y-0.5'
                            } active:translate-y-0.5`}
                          >
                            <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-400 ring-2 ring-cyan-200/50' : 'bg-slate-300 group-hover:bg-cyan-500'}`} />
                            <span className="text-xs sm:text-sm font-black tracking-tight">
                              {term.name}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md border ${
                              isSelected 
                                ? 'bg-white/20 text-cyan-200 border-white/20' 
                                : 'bg-slate-100 text-slate-500 border-slate-200'
                            }`}>
                              {termSubjCount} mat.
                            </span>
                          </button>
                        );
                      })}

                      {/* Bouton Plus derrière le dernier trimestre pour ajouter un nouveau trimestre */}
                      <button
                        type="button"
                        onClick={() => setIsAddTermModalOpen(true)}
                        className="shrink-0 px-3.5 py-2 rounded-xl border-2 border-dashed border-cyan-800/40 hover:border-cyan-600 bg-white/60 hover:bg-white text-slate-700 hover:text-[#00313d] flex items-center gap-1.5 transition-all duration-200 shadow-2xs hover:shadow-xs group hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                        title={`Ajouter le Trimestre ${nextTermNumber}`}
                      >
                        <div className="w-5 h-5 rounded-md bg-[#00313d] text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                        <span className="text-xs font-black">
                          + Trimestre {nextTermNumber}
                        </span>
                      </button>
                    </div>
                  </div>
                )}

                {/* ------------------------------------------------------------------------- */}
                {/* ZONE DES MATIÈRES : PAGINATION HORIZONTALE PAR ESPACES DE 3 LIGNES (15)  */}
                {/* ------------------------------------------------------------------------- */}
                {activeClass && (
                  <div className="space-y-3 pt-2 animate-fade-in">
                    {/* En-tête de la section matières avec navigation par espace */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                          Matières ({currentClassSubjects.length})
                        </span>
                        <span className="text-xs text-slate-400 font-bold">&bull;</span>
                        <span className="text-xs font-bold text-cyan-900 bg-white/80 px-2.5 py-0.5 rounded-lg border border-cyan-200/60 shadow-2xs">
                          {activeClass.level} {activeClass.name ? `• ${activeClass.name}` : ''}
                        </span>
                        {activeTerm && (
                          <>
                            <span className="text-xs text-slate-400 font-bold">&bull;</span>
                            <span className="text-xs font-black text-white bg-[#00313d] px-2.5 py-0.5 rounded-lg shadow-2xs">
                              {activeTerm.name}
                            </span>
                          </>
                        )}
                        <span className="text-[11px] font-black text-slate-700 bg-white/80 px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                          Espace {subjectPageIndex + 1} / {totalSubjectPages}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline-block">
                          {pagedSubjects.length}/15 dans cet espace &bull; 3 lignes max
                        </span>

                        <div className="flex items-center gap-1.5">
                          {/* Flèche gauche : Espace précédent */}
                          <button
                            type="button"
                            onClick={() => setSubjectPageIndex(prev => Math.max(0, prev - 1))}
                            disabled={subjectPageIndex === 0}
                            className={`w-7 h-7 rounded-lg border shadow-2xs flex items-center justify-center transition-all ${
                              subjectPageIndex === 0
                                ? 'bg-slate-100/60 text-slate-300 border-slate-200/50 cursor-not-allowed'
                                : 'bg-white hover:bg-slate-50 text-slate-700 hover:text-[#00313d] border-slate-200 active:scale-90 cursor-pointer'
                            }`}
                            title={subjectPageIndex === 0 ? "Premier espace atteint" : "Espace précédent"}
                          >
                            <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                          </button>

                          {/* Flèche droite : Espace suivant (disponible seulement si les 3 lignes de l'espace actuel sont remplies) */}
                          <button
                            type="button"
                            onClick={() => setSubjectPageIndex(prev => Math.min(totalSubjectPages - 1, prev + 1))}
                            disabled={subjectPageIndex >= totalSubjectPages - 1}
                            className={`w-7 h-7 rounded-lg border shadow-2xs flex items-center justify-center transition-all ${
                              subjectPageIndex >= totalSubjectPages - 1
                                ? 'bg-slate-100/60 text-slate-300 border-slate-200/50 cursor-not-allowed'
                                : 'bg-[#00313d] hover:bg-[#00242e] text-white border-[#00242e] shadow-xs active:scale-90 cursor-pointer'
                            }`}
                            title={
                              subjectPageIndex >= totalSubjectPages - 1
                                ? "Remplissez les 3 lignes (15 matières) pour ouvrir le prochain espace"
                                : "Espace suivant"
                            }
                          >
                            <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Grille : 3 lignes fixes de 5 colonnes par espace (ne défile plus verticalement) */}
                    <div 
                      key={subjectPageIndex}
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-3.5 items-stretch animate-in fade-in duration-200"
                    >
                      {/* 1. Matières de cet espace (jusqu'à 15 matières) */}
                      {pagedSubjects.map((subj) => {
                        const isWhite = !subj.color || subj.color === '#ffffff' || subj.color === 'white';

                        return (
                          <div
                            key={subj.id}
                            style={{
                              backgroundColor: subj.color || '#ffffff',
                              color: subj.textColor || (isWhite ? '#0f172a' : '#ffffff'),
                              borderColor: isWhite ? '#e2e8f0' : (subj.borderColor || subj.color),
                              borderBottomColor: isWhite ? '#cbd5e1' : (subj.borderDarkColor || '#94a3b8'),
                            }}
                            className="group relative rounded-xl border-2 border-b-[4px] p-2.5 sm:p-3 min-h-[68px] sm:min-h-[76px] flex flex-col justify-between cursor-pointer transition-all duration-200 select-none shadow-xs hover:shadow-md hover:-translate-y-0.5 active:translate-y-0.5 active:border-b-2"
                          >
                            {/* Ligne haute : Badge Coeff & Bouton supprimer */}
                            <div className="flex items-center justify-between w-full">
                              {subj.coefficient ? (
                                <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border ${
                                  isWhite
                                    ? 'bg-slate-100 text-slate-700 border-slate-200'
                                    : 'bg-black/25 text-white/95 border-white/20'
                                }`}>
                                  Coeff: {subj.coefficient}
                                </span>
                              ) : (
                                <span className={`text-[8px] font-bold opacity-60 ${isWhite ? 'text-slate-400' : 'text-white/70'}`}>
                                  Matière
                                </span>
                              )}

                              <button
                                type="button"
                                onClick={(e) => handleOpenMenu(e, 'subject', subj)}
                                className={`card-menu-trigger w-5 h-5 rounded flex items-center justify-center transition ${
                                  isWhite ? 'text-slate-400 hover:text-slate-800 hover:bg-slate-100' : 'text-white/70 hover:text-white hover:bg-black/20'
                                }`}
                                title="Options de la matière"
                              >
                                <div className="w-3 h-2 flex flex-col justify-between items-center pointer-events-none">
                                  <span className="w-full h-[1.6px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.6px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.6px] bg-current rounded-full"></span>
                                </div>
                              </button>
                            </div>

                            {/* Centre : Nom de la matière centré, max 3 lignes puis ... */}
                            <div className="flex-1 flex items-center justify-center my-auto px-1 py-0.5">
                              <h5 
                                className="text-center font-black text-xs sm:text-sm leading-tight line-clamp-3 break-words"
                                title={subj.name}
                              >
                                {subj.name}
                              </h5>
                            </div>
                          </div>
                        );
                      })}

                      {/* 2. LE BOUTON « CRÉER UNE MATIÈRE » : présent uniquement sur le dernier espace si non plein */}
                      {isLastSubjectPage && (
                        <button
                          type="button"
                          onClick={() => {
                            resetSubjectForm();
                            setIsAddSubjectModalOpen(true);
                          }}
                          className="rounded-xl border-2 border-dashed border-red-500/80 hover:border-red-600 bg-white/60 hover:bg-white/95 backdrop-blur-md p-2.5 sm:p-3 min-h-[68px] sm:min-h-[76px] flex items-center justify-center gap-2 text-center cursor-pointer transition-all duration-200 group hover:-translate-y-0.5 shadow-2xs hover:shadow-sm active:translate-y-0"
                          title="Créer une nouvelle matière pour cette classe"
                        >
                          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-red-600 to-orange-500 text-white flex items-center justify-center group-hover:scale-110 shadow-xs transition-transform shrink-0">
                            <Plus className="w-4 h-4 stroke-[3]" />
                          </div>
                          <div className="flex flex-col text-left">
                            <span className="text-xs font-black text-slate-800 group-hover:text-red-600 transition-colors leading-tight">
                              + Créer une matière
                            </span>
                            <span className="text-[9px] text-slate-400 leading-tight">
                              Pour {activeClass.level} &bull; {activeTerm?.name || 'Trimestre 1'}
                            </span>
                          </div>
                        </button>
                      )}

                    </div>
                  </div>
                )}
              </div>
            )
          ) : (
            // =====================================================================
            // CAS 2 : ON EST SUR LA LISTE DES ÉCOLES DE L'ANNÉE SCOLAIRE
            // =====================================================================
            currentSelectedYear ? (
              currentYearSchools.length === 0 ? (
                // 1. AUCUNE ÉCOLE : Bouton Plus au milieu avec pointillé autour formant un carré
                <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSchool(null);
                      setSchoolName('');
                      setSchoolLogo(null);
                      setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
                      setIsAddSchoolModalOpen(true);
                    }}
                    className="group relative w-64 h-64 sm:w-72 sm:h-72 border-2 border-dashed border-cyan-800/40 hover:border-cyan-600 bg-white/50 hover:bg-white/85 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all duration-300 shadow-sm hover:shadow-xl hover:-translate-y-1 active:translate-y-0"
                    title="Ajouter une école"
                  >
                    {/* Icône Plus dans un conteneur carré stylisé */}
                    <div className="w-16 h-16 rounded-2xl bg-[#00313d] text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-[#00242e] transition-all duration-300 mb-4 border border-cyan-300/30">
                      <Plus className="w-8 h-8 stroke-[3]" />
                    </div>

                    {/* Titre et incitation */}
                    <span className="text-base font-black text-slate-800 group-hover:text-[#00313d] transition-colors">
                      Ajouter une école
                    </span>
                    <p className="text-xs text-slate-500 max-w-[200px] mt-2 leading-relaxed">
                      Cliquez ici pour configurer un établissement scolaire pour la rentrée <span className="font-bold text-[#00313d]">{currentSelectedYear.label}</span>
                    </p>

                    {/* Petit badge subtil */}
                    <div className="mt-4 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200/60 text-[10px] font-extrabold text-cyan-800">
                      Nouveau +
                    </div>
                  </button>
                </div>
              ) : (
                // 2. ÉCOLES CRÉÉES : Cartes en 3D sous forme de bouton avec logo rond
                <div className="space-y-4 pt-1 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase tracking-wider text-slate-600">
                        Établissements scolaires ({currentYearSchools.length})
                      </span>
                      <span className="text-xs text-slate-400 font-bold">&bull;</span>
                      <span className="text-xs font-bold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-lg border border-cyan-200/50">
                        Rentrée {currentSelectedYear.label}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 items-stretch">
                    {currentYearSchools.map((school) => {
                      const isSelected = selectedSchoolId === school.id;
                      const isWhite = !school.color || school.color === '#ffffff' || school.color === 'white';
                      const schoolClassesCount = classes.filter(c => c.schoolId === school.id).length;

                      return (
                        <div
                          key={school.id}
                          onClick={() => {
                            setSelectedSchoolId(school.id);
                            setSelectedSchoolInside(school); // Rentrer à l'intérieur de l'école !
                          }}
                          style={{
                            backgroundColor: school.color || '#ffffff',
                            color: school.textColor || (isWhite ? '#0f172a' : '#ffffff'),
                            borderColor: isWhite ? '#e2e8f0' : (school.borderColor || school.color),
                            borderBottomColor: isWhite ? '#94a3b8' : (school.borderDarkColor || '#00141a'),
                          }}
                          className={`group relative rounded-2xl border-2 border-b-[6px] p-4 sm:p-5 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none ${
                            isWhite 
                              ? 'shadow-[0_10px_25px_-5px_rgba(0,40,60,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)] hover:border-b-cyan-600' 
                              : 'shadow-[0_12px_24px_-6px_rgba(0,0,0,0.3)]'
                          } ${
                            isSelected 
                              ? 'ring-2 ring-cyan-500 ring-offset-2 scale-[1.02]' 
                              : 'hover:-translate-y-1'
                          } active:translate-y-1 active:border-b-2`}
                        >
                          {/* Haut de la carte : Logo ROND à gauche & Badge année / Menu à droite */}
                          <div className="flex items-start justify-between gap-3">
                            {/* Logo de l'école (ROND comme demandé explicitement) */}
                            <div className="w-14 h-14 rounded-full overflow-hidden shadow-md border-2 border-white/90 shrink-0 flex items-center justify-center bg-white/20 backdrop-blur-xs">
                              {school.logoUrl ? (
                                <img 
                                  src={school.logoUrl} 
                                  alt={school.name} 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                <div 
                                  className="w-full h-full flex items-center justify-center font-black text-lg tracking-wider"
                                  style={{ color: isWhite ? '#00313d' : '#ffffff' }}
                                >
                                  {school.name.slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            {/* Badge année et menu 3 traits */}
                            <div className="flex items-center gap-1.5">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                                isWhite 
                                   ? 'bg-slate-100 text-slate-700 border-slate-200' 
                                   : 'bg-black/20 text-white/90 border-white/20'
                              }`}>
                                {currentSelectedYear.label}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => handleOpenMenu(e, 'school', school)}
                                className={`card-menu-trigger w-7 h-7 rounded-lg flex items-center justify-center transition z-10 ${
                                  isWhite 
                                    ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-800' 
                                    : 'hover:bg-black/30 text-white/70 hover:text-white'
                                }`}
                                title="Options de l'établissement"
                              >
                                <div className="w-3.5 h-2.5 flex flex-col justify-between items-center pointer-events-none">
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                  <span className="w-full h-[1.8px] bg-current rounded-full"></span>
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* Milieu de la carte : Nom de l'école & Type */}
                          <div className="mt-3.5 space-y-0.5">
                            <h3 className="font-black text-base sm:text-lg tracking-tight leading-snug line-clamp-2">
                              {school.name}
                            </h3>
                            <div className="flex items-center gap-2">
                              <span className={`text-[11px] font-semibold ${
                                isWhite ? 'text-slate-500' : 'text-white/80'
                              }`}>
                                Établissement scolaire
                              </span>
                              <span className="text-[10px] opacity-60">&bull;</span>
                              <span className={`text-[10px] font-bold ${
                                isWhite ? 'text-cyan-800' : 'text-cyan-200'
                              }`}>
                                {schoolClassesCount} classe{schoolClassesCount > 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>

                          {/* Bas de la carte : Bouton d'accès 3D intégré */}
                          <div className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-black ${
                            isWhite 
                              ? 'border-slate-100 text-[#00313d] group-hover:text-cyan-600' 
                              : 'border-white/20 text-white group-hover:text-cyan-200'
                          } transition-colors`}>
                            <span>Accéder aux classes</span>
                            <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      );
                    })}

                    {/* Bouton carré pointillé pour ajouter une autre école */}
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchool(null);
                        setSchoolName('');
                        setSchoolLogo(null);
                        setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
                        setIsAddSchoolModalOpen(true);
                      }}
                      className="min-h-[170px] border-2 border-dashed border-cyan-800/30 hover:border-cyan-600 bg-white/40 hover:bg-white/70 backdrop-blur-md rounded-2xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 group hover:-translate-y-1 shadow-xs hover:shadow-md"
                    >
                      <div className="w-12 h-12 rounded-xl bg-[#00313d] text-white flex items-center justify-center group-hover:scale-105 shadow-sm transition mb-2.5">
                        <Plus className="w-6 h-6 stroke-[2.5]" />
                      </div>
                      <span className="text-xs font-black text-slate-700 group-hover:text-[#00313d] transition-colors">
                        Ajouter une autre école
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Pour {currentSelectedYear.label}
                      </span>
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="text-center space-y-3 p-8 bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 max-w-md mx-auto my-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#00313d] text-white flex items-center justify-center mx-auto shadow-md">
                  <Calendar className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-slate-800">
                  Aucune rentrée scolaire active
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Cliquez sur le bouton « Créer une rentrée scolaire » en haut à droite pour ajouter votre première année scolaire (ex: 2026 - 2027).
                </p>
              </div>
            )
          )}
        </section>

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR AJOUTER / MODIFIER UNE ÉCOLE                      */}
        {/* ========================================================================= */}
        {isAddSchoolModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête bien carré et professionnel */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    {editingSchool ? <Pencil className="w-5 h-5" /> : <School className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingSchool ? "Modifier l'établissement" : "Ajouter une école"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      Rentrée scolaire {currentSelectedYear?.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddSchoolModalOpen(false);
                    setEditingSchool(null);
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulaire intérieur */}
              <form onSubmit={handleCreateSchool} className="p-6 space-y-5">
                
                {/* 1. Nom de l'école (Requis) */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Nom de l'établissement / École <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="Ex : Lycée Moderne d'Excellence, Collège Saint-Joseph..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    autoFocus
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Ce nom apparaîtra sur la carte de l'école et dans vos classes.
                  </span>
                </div>

                {/* 2. Logo de l'école (Facultatif) avec aperçu ROND */}
                <div className="space-y-2">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Logo de l'école <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                  </label>
                  
                  <div className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-200 bg-slate-50/70">
                    {/* Aperçu rond du logo */}
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-cyan-600 bg-white shadow-md shrink-0 flex items-center justify-center">
                      {schoolLogo ? (
                        <img src={schoolLogo} alt="Logo aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[#00313d] font-black text-sm">
                          {schoolName.trim() ? schoolName.trim().slice(0, 2).toUpperCase() : <School className="w-6 h-6 text-slate-400" />}
                        </div>
                      )}
                    </div>

                    {/* Actions logo */}
                    <div className="flex-1 space-y-1.5">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        className="hidden"
                        id="school-logo-input"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:border-slate-400 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition"
                        >
                          {schoolLogo ? 'Changer de logo' : 'Importer une image'}
                        </button>
                        {schoolLogo && (
                          <button
                            type="button"
                            onClick={() => setSchoolLogo(null)}
                            className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-red-600 hover:bg-red-50 transition"
                          >
                            Supprimer
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Format conseillé (PNG, JPG). S'affiche en rond sur la carte de l'école.
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3. Choisir une couleur (Blanc par défaut si non choisi) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Couleur de la carte <span className="text-[10px] font-normal text-slate-400 lowercase">(blanc par défaut)</span>
                    </label>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedSchoolColor.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SCHOOL_COLOR_OPTIONS.map((col) => {
                      const isSelected = selectedSchoolColor.id === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setSelectedSchoolColor(col)}
                          style={{ backgroundColor: col.bg, borderColor: col.border }}
                          className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                          }`}
                          title={col.label}
                        >
                          {isSelected && (
                            <Check className={`w-4 h-4 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aperçu en direct de la carte 3D */}
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aperçu en direct :
                  </span>
                  <div 
                    style={{
                      backgroundColor: selectedSchoolColor.bg,
                      color: selectedSchoolColor.text,
                      borderColor: selectedSchoolColor.id === 'white' ? '#e2e8f0' : selectedSchoolColor.border,
                      borderBottomColor: selectedSchoolColor.id === 'white' ? '#94a3b8' : selectedSchoolColor.borderDark,
                    }}
                    className="rounded-xl border-2 border-b-[5px] p-3.5 flex items-center gap-3 shadow-md max-w-sm transition-all"
                  >
                    <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/90 shadow-md shrink-0 flex items-center justify-center bg-white/20">
                      {schoolLogo ? (
                        <img src={schoolLogo} alt="Aperçu" className="w-full h-full object-cover" />
                      ) : (
                        <span className="font-black text-sm" style={{ color: selectedSchoolColor.id === 'white' ? '#00313d' : '#ffffff' }}>
                          {schoolName.trim() ? schoolName.trim().slice(0, 2).toUpperCase() : 'EC'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="font-black text-sm block truncate">
                        {schoolName.trim() || "Nom de l'école"}
                      </span>
                      <span className="text-[10px] font-semibold opacity-75 block">
                        Établissement &bull; {currentSelectedYear?.label}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 4. Bouton Créer / Enregistrer accessible */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSchoolModalOpen(false);
                      setEditingSchool(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingSchool ? (!schoolName.trim() || !isSchoolDirty) : !schoolName.trim()}
                    style={{ 
                      backgroundColor: (editingSchool ? (schoolName.trim() && isSchoolDirty) : schoolName.trim()) 
                        ? '#00313d' 
                        : undefined 
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingSchool ? (schoolName.trim() && isSchoolDirty) : schoolName.trim())
                        ? 'text-white hover:bg-[#00242e] cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingSchool ? 'Enregistrer' : "Créer l'école"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR AJOUTER UNE CLASSE (2 COLONNES, SANS FILIÈRE,   */}
        {/* SANS COUPURE EN HAUT AVEC APERÇU 3D INTERACTIF)                           */}
        {/* ========================================================================= */}
        {isAddClassModalOpen && selectedSchoolInside && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto max-h-[88vh] flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête bien carré et professionnel */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    {editingClass ? <Pencil className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingClass ? "Modifier la classe" : "Créer une classe"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      {selectedSchoolInside.name} &bull; {currentSelectedYear?.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddClassModalOpen(false);
                    resetClassForm();
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulaire intérieur structuré en 2 colonnes équilibrées pour utiliser l'espace latéral */}
              <form onSubmit={handleCreateClass} className="flex flex-col flex-1 overflow-hidden">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-6 overflow-y-auto flex-1">
                  
                  {/* COLONNE GAUCHE : Niveau, Nom/Groupe, Slogan et Professeur */}
                  <div className="space-y-4">
                    {/* 1. Niveau scolaire (Requis) + Suggestions rapides */}
                    <div className="space-y-1.5">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Niveau scolaire <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={classLevel}
                        onChange={(e) => setClassLevel(e.target.value)}
                        placeholder="Ex: CP1, 6ème, 3ème, Terminale C, Licence 1..."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                        autoFocus
                      />
                      {/* Suggestions rapides cliquables */}
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {CLASS_LEVEL_SUGGESTIONS.map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => setClassLevel(sug)}
                            className={`px-2 py-0.5 rounded-lg text-[10.5px] font-bold transition-all ${
                              classLevel === sug
                                ? 'bg-cyan-600 text-white shadow-2xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 2. Nom de la classe (Facultatif) & Slogan (Facultatif) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Nom / Groupe <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                        </label>
                        <input
                          type="text"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          placeholder="Ex: A, B, 1, Élite, Sciences..."
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Slogan de la classe <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                        </label>
                        <input
                          type="text"
                          value={classSlogan}
                          onChange={(e) => setClassSlogan(e.target.value)}
                          placeholder="Ex: Discipline et Réussite..."
                          className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                        />
                      </div>
                    </div>

                    {/* 3. Nom du professeur ou maître (Requis) */}
                    <div className="space-y-1">
                      <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                        Nom du Professeur / Maître <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={classTeacherName}
                        onChange={(e) => setClassTeacherName(e.target.value)}
                        placeholder="Ex: M. Delmas Kouassi, Mme Koffi..."
                        className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                      />
                    </div>
                  </div>

                  {/* COLONNE DROITE : Couleur de la classe & Aperçu 3D direct */}
                  <div className="space-y-4 flex flex-col justify-between">
                    {/* Choix de la couleur */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                          Couleur de la classe
                        </label>
                        <span className="text-xs font-bold text-slate-500">
                          {selectedClassColor.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {CLASS_COLOR_OPTIONS.map((col) => {
                          const isSelected = selectedClassColor.id === col.id;
                          return (
                            <button
                              key={col.id}
                              type="button"
                              onClick={() => setSelectedClassColor(col)}
                              style={{ backgroundColor: col.bg, borderColor: col.border }}
                              className={`h-9 rounded-xl border flex items-center justify-center transition-all ${
                                isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                              }`}
                              title={col.label}
                            >
                              {isSelected && (
                                <Check className={`w-4 h-4 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Aperçu en direct de la carte 3D */}
                    <div className="space-y-1.5 pt-1">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Aperçu de la carte 3D :
                      </span>
                      <div 
                        style={{
                          borderColor: selectedClassColor.border,
                          borderBottomColor: selectedClassColor.borderDark,
                        }}
                        className="rounded-2xl border-2 border-b-[5px] bg-white p-2.5 sm:p-3 px-3.5 flex flex-col justify-between shadow-md transition-all select-none max-w-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0 flex-1">
                            <div 
                              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-xs shrink-0"
                              style={{ background: selectedClassColor.iconGradient }}
                            >
                              <BookOpen className="w-4 h-4 text-white stroke-[2.2]" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <span className="text-[9px] font-extrabold uppercase tracking-wide text-slate-400 block truncate leading-tight">
                                {classSlogan.trim() ? classSlogan.trim() : 'Classe Pro'}
                              </span>
                              <h4 className="text-sm font-black text-slate-900 tracking-tight leading-snug truncate mt-0.5">
                                {classLevel.trim() || 'Niveau'} {className.trim() ? `• ${className.trim()}` : ''}
                              </h4>
                            </div>
                          </div>
                          <span className="w-2.5 h-2.5 rounded-full shadow-2xs" style={{ backgroundColor: selectedClassColor.bg }} />
                        </div>

                        <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between text-xs">
                          <div className="flex flex-col">
                            <span className="text-[8px] font-black uppercase text-slate-400">PROFESSEUR</span>
                            <span className="font-extrabold text-slate-700 truncate max-w-[120px] text-[10px]">
                              {classTeacherName.trim() || 'Nom du maître'}
                            </span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black uppercase text-slate-400">ÉLÈVES</span>
                            <span className="text-[9.5px] font-black text-cyan-800 bg-cyan-50 px-1.5 py-0.2 rounded border border-cyan-200/50">
                              0 élèves
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bouton Créer / Enregistrer accessible quand les informations requises sont prêtes */}
                <div className="p-4 px-6 border-t border-slate-100 flex items-center gap-3 bg-slate-50/50 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddClassModalOpen(false);
                      resetClassForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingClass ? (!classLevel.trim() || !classTeacherName.trim() || !isClassDirty) : (!classLevel.trim() || !classTeacherName.trim())}
                    style={{ 
                      backgroundColor: (editingClass ? (classLevel.trim() && classTeacherName.trim() && isClassDirty) : (classLevel.trim() && classTeacherName.trim())) 
                        ? '#00313d' 
                        : undefined 
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingClass ? (classLevel.trim() && classTeacherName.trim() && isClassDirty) : (classLevel.trim() && classTeacherName.trim()))
                        ? 'text-white hover:bg-[#00242e] cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingClass ? 'Enregistrer' : "Créer la classe"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR CRÉER UNE MATIÈRE (DANS LA CLASSE SÉLECTIONNÉE)   */}
        {/* ========================================================================= */}
        {isAddSubjectModalOpen && activeClass && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-start justify-center pt-14 sm:pt-16 pb-8 p-3 sm:p-5 overflow-y-auto">
            <div 
              className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-fade-in my-auto max-h-[88vh] flex flex-col"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 35, 46, 0.35)'
              }}
            >
              {/* En-tête bien carré et professionnel */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 to-orange-500 text-white flex items-center justify-center shadow-md">
                    {editingSubject ? <Pencil className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      {editingSubject ? "Modifier la matière" : "Créer une matière"}
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      Classe : {activeClass.level} {activeClass.name ? `• ${activeClass.name}` : ''} &bull; {activeTerm?.name || 'Trimestre 1'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsAddSubjectModalOpen(false);
                    resetSubjectForm();
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Formulaire intérieur */}
              <form onSubmit={handleCreateSubject} className="p-6 space-y-4 overflow-y-auto flex-1">
                
                {/* 1. Nom de la matière (Requis) + Suggestions rapides */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Nom de la matière <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={subjectName}
                    onChange={(e) => setSubjectName(e.target.value)}
                    placeholder="Ex: Mathématiques, Français, SVT..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                    autoFocus
                  />
                  {/* Suggestions rapides */}
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {CLASS_SUBJECT_SUGGESTIONS.map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setSubjectName(sug)}
                        className={`px-2.5 py-1 rounded-lg text-[10.5px] font-bold transition-all ${
                          subjectName === sug
                            ? 'bg-red-500 text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 2. Coefficient (facultatif) */}
                <div className="space-y-1">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Coefficient <span className="text-[10px] font-normal text-slate-400 lowercase">(facultatif)</span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="20"
                    value={subjectCoefficient}
                    onChange={(e) => setSubjectCoefficient(e.target.value)}
                    placeholder="Ex: 1, 2, 3, 4..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500 shadow-inner"
                  />
                  <span className="text-[10px] text-slate-400 block">
                    Utilisé pour le calcul de la moyenne générale de l'élève.
                  </span>
                </div>

                {/* 3. Couleur de la carte de matière (Blanc par défaut) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Couleur de la carte <span className="text-[10px] font-normal text-slate-400 lowercase">(blanc par défaut)</span>
                    </label>
                    <span className="text-xs font-bold text-slate-500">
                      {selectedSubjectColor.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                    {SUBJECT_COLOR_OPTIONS.map((col) => {
                      const isSelected = selectedSubjectColor.id === col.id;
                      return (
                        <button
                          key={col.id}
                          type="button"
                          onClick={() => setSelectedSubjectColor(col)}
                          style={{ backgroundColor: col.bg, borderColor: col.border }}
                          className={`h-8 rounded-xl border flex items-center justify-center transition-all ${
                            isSelected ? 'scale-110 shadow-md ring-2 ring-offset-1 ring-cyan-500' : 'hover:scale-105'
                          }`}
                          title={col.label}
                        >
                          {isSelected && (
                            <Check className={`w-3.5 h-3.5 stroke-[3] ${col.id === 'white' ? 'text-slate-800' : 'text-white'}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Aperçu en direct de la carte matière 3D rectangulaire */}
                <div className="space-y-1.5 pt-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Aperçu de la carte matière (format rectangle compact) :
                  </span>
                  <div 
                    style={{
                      backgroundColor: selectedSubjectColor.bg,
                      color: selectedSubjectColor.text,
                      borderColor: selectedSubjectColor.id === 'white' ? '#e2e8f0' : selectedSubjectColor.border,
                      borderBottomColor: selectedSubjectColor.id === 'white' ? '#cbd5e1' : selectedSubjectColor.borderDark,
                    }}
                    className="w-48 sm:w-56 rounded-xl border-2 border-b-[4px] p-2.5 sm:p-3 min-h-[68px] flex flex-col justify-between shadow-md transition-all select-none"
                  >
                    <div className="flex items-center justify-between w-full">
                      {subjectCoefficient.trim() ? (
                        <span className={`text-[8.5px] font-black px-1.5 py-0.2 rounded border ${
                          selectedSubjectColor.id === 'white'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-black/25 text-white/95 border-white/20'
                        }`}>
                          Coeff: {subjectCoefficient.trim()}
                        </span>
                      ) : (
                        <span className="text-[8px] font-bold opacity-60">Matière</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-center my-auto px-1 py-0.5">
                      <span className="text-center font-black text-xs sm:text-sm leading-tight line-clamp-3 break-words">
                        {subjectName.trim() || 'Nom matière'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Boutons actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddSubjectModalOpen(false);
                      resetSubjectForm();
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={editingSubject ? (!subjectName.trim() || !isSubjectDirty) : !subjectName.trim()}
                    style={{ 
                      backgroundColor: (editingSubject ? (subjectName.trim() && isSubjectDirty) : subjectName.trim()) 
                        ? '#dc2626' 
                        : undefined 
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      (editingSubject ? (subjectName.trim() && isSubjectDirty) : subjectName.trim())
                        ? 'text-white hover:bg-red-700 cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{editingSubject ? 'Enregistrer' : "Créer la matière"}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MENU CONTEXTUEL FLOTTANT "3 TRAITS" INTELLIGENT (NE SE COUPE JAMAIS)      */}
        {/* ========================================================================= */}
        {activeMenu && (
          <div
            className="card-dropdown-menu fixed z-[9999] bg-white rounded-xl shadow-2xl border border-slate-200/90 py-1.5 w-48 text-slate-800 animate-in fade-in zoom-in-95 duration-150 select-none"
            style={{
              top: `${activeMenu.position.top}px`,
              left: `${activeMenu.position.left}px`,
              boxShadow: '0 16px 36px -6px rgba(0, 31, 39, 0.28), 0 4px 12px -2px rgba(0, 0, 0, 0.08)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => handleTriggerEdit(activeMenu.type, activeMenu.item)}
              className="w-full px-3.5 py-2 text-left text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-cyan-700 stroke-[2.2]" />
              <span>Modifier les informations</span>
            </button>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              onClick={() => handleTriggerDelete(activeMenu.type, activeMenu.item)}
              className="w-full px-3.5 py-2 text-left text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-2.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500 stroke-[2.2]" />
              <span>Supprimer</span>
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DE SUPPRESSION SÉCURISÉE AVEC SAISIE EXACTE DU NOM REQUIS          */}
        {/* ========================================================================= */}
        {deleteTarget && (
          <div className="fixed inset-0 z-[10000] bg-[#001820]/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div 
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-150"
              style={{
                boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.35)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* En-tête alerte rouge */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-red-100 bg-red-50/70">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-md shrink-0">
                    <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-red-950 leading-tight">
                      Confirmation de suppression
                    </h3>
                    <span className="text-[11px] font-semibold text-red-600/90 mt-0.5 inline-block">
                      Action irréversible
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setDeleteTarget(null);
                    setDeleteConfirmInput('');
                  }}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-white/80 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Contenu et avertissement */}
              <div className="p-5 sm:p-6 space-y-4">
                <div className="p-3.5 bg-red-50 rounded-xl border border-red-200/80 text-xs text-red-900 leading-relaxed font-medium">
                  {deleteTarget.warningMessage}
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    Pour confirmer la suppression définitive de <span className="font-extrabold text-slate-900">{deleteTarget.displayName}</span>, veuillez recopier son nom ci-dessous :
                  </p>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-black text-slate-800 font-mono tracking-wide truncate select-all">
                      {deleteTarget.name}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyDeleteName(deleteTarget.name)}
                      className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-2xs active:scale-95 border ${
                        isCopiedDeleteName
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                      }`}
                      title="Copier et insérer directement le nom"
                    >
                      {isCopiedDeleteName ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                          <span>Copié !</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-600" />
                          <span>Copier</span>
                        </>
                      )}
                    </button>
                  </div>

                  <input
                    type="text"
                    value={deleteConfirmInput}
                    onChange={(e) => setDeleteConfirmInput(e.target.value)}
                    placeholder="Recopiez le nom exact ici..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500 shadow-inner"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmDelete();
                      }
                    }}
                  />
                  
                  {deleteConfirmInput.trim().length > 0 && 
                   deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase() && (
                    <span className="text-[11px] font-bold text-red-600 block">
                      &bull; Le nom saisi ne correspond pas exactement.
                    </span>
                  )}
                </div>

                {/* Boutons d'action */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteTarget(null);
                      setDeleteConfirmInput('');
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleteConfirmInput.trim().toLowerCase() !== deleteTarget.name.trim().toLowerCase()}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      deleteConfirmInput.trim().toLowerCase() === deleteTarget.name.trim().toLowerCase()
                        ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Supprimer définitivement</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODAL DE CONFIRMATION D'AJOUT D'UN TRIMESTRE                             */}
        {/* ========================================================================= */}
        {isAddTermModalOpen && activeClass && (
          <div className="fixed inset-0 z-50 bg-[#001820]/60 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-in fade-in duration-150">
            <div 
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden text-slate-800 my-auto animate-in zoom-in-95 duration-150"
              style={{
                boxShadow: '0 25px 50px -12px rgba(0, 49, 61, 0.35)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00313d] text-white flex items-center justify-center shadow-md">
                    <Plus className="w-5 h-5 stroke-[2.5]" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-[#00313d] leading-tight">
                      Ajouter un trimestre
                    </h3>
                    <span className="text-[11px] font-semibold text-slate-400 mt-0.5 inline-block">
                      Classe : {activeClass.level} {activeClass.name ? `• ${activeClass.name}` : ''}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddTermModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="p-4 rounded-xl bg-cyan-50/70 border border-cyan-200/80 text-xs sm:text-sm text-cyan-950 leading-relaxed font-semibold">
                  Voulez-vous ajouter le <span className="font-black text-[#00313d]">Trimestre {nextTermNumber}</span> pour la classe <span className="font-black">{activeClass.level} {activeClass.name || ''}</span> ?
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Ce nouveau trimestre vous permettra d'enregistrer et de gérer des matières, notes et évaluations indépendantes des autres trimestres.
                </p>

                <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddTermModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAddTerm}
                    className="flex-1 py-2.5 rounded-xl bg-[#00313d] hover:bg-[#00242e] text-white text-xs font-black shadow-md transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Oui, ajouter Trimestre {nextTermNumber}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ========================================================================= */}
      {/* 3. BARRE DE NAVIGATION INFÉRIEURE MOBILE (< md : Reste responsive)       */}
      {/* ========================================================================= */}
      <nav 
        className="md:hidden fixed bottom-0 inset-x-0 h-16 z-50 flex items-center justify-around px-2 border-t border-cyan-900/40 shadow-2xl backdrop-blur-md"
        style={{ backgroundColor: '#002f3a' }}
      >
        {navItems.map((item) => {
          const isActive = activeNavTab === item.id;
          const IconComponent = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveNavTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 transition-all flex-1 ${
                isActive ? 'opacity-100 scale-105' : 'opacity-65'
              }`}
            >
              {isActive ? (
                <div className="w-8 h-8 rounded-xl bg-white text-[#002f3a] shadow-md flex items-center justify-center">
                  <IconComponent className="w-4 h-4 stroke-[2.4]" />
                </div>
              ) : (
                <div className="w-8 h-8 flex items-center justify-center text-cyan-100/80">
                  <IconComponent className="w-4 h-4 stroke-[1.8]" />
                </div>
              )}
              <span className={`text-[8.5px] mt-0.5 font-semibold tracking-tight ${
                isActive ? 'text-white font-bold' : 'text-cyan-100/70'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
