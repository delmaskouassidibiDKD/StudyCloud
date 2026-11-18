import React, { useState, useEffect, useRef } from 'react';
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
  School,
  FolderPlus,
  Upload,
  Building2
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

  // Création d'une nouvelle école
  const handleCreateSchool = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = schoolName.trim();
    if (!cleanName || !selectedYearId) return;

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
    setSchoolName('');
    setSchoolLogo(null);
    setSelectedSchoolColor(SCHOOL_COLOR_OPTIONS[0]);
  };

  // Suppression d'une école
  const handleDeleteSchool = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSchools(prev => prev.filter(s => s.id !== id));
    if (selectedSchoolId === id) {
      setSelectedSchoolId(null);
    }
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
        {/* EN-TÊTE : BOUTON RETOUR (ET NON CLASSE), ACTIONS & PROFIL */}
        {/* ----------------------------------------------------------------------- */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          {/* Bouton Retour (nommé "Retour" comme demandé) et Titre */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wider flex items-center gap-1 mb-1">
              <span>Tableau de bord</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-slate-700 hover:text-slate-900 border border-white/90 shadow-xs transition active:scale-95 font-bold text-xs sm:text-sm"
                title="Retour à l'accueil"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5]" />
                <span>Retour</span>
              </button>
              <h1 className="text-xl sm:text-2xl font-black text-[#0f2430] tracking-tight ml-1">
                Tableau de bord
              </h1>
            </div>
          </div>

          {/* Contrôles du haut : Recherche, Notifs, Paramètres, Profil & Bouton "Créer une rentrée scolaire" */}
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
            {/* BOUTON "Créer une rentrée scolaire" AVEC MENU DÉROULANT RECTANGLE */}
            {/* ------------------------------------------------------------------- */}
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
          </div>
        </header>

        {/* ----------------------------------------------------------------------- */}
        {/* EMPLACEMENT DE L'IMAGE 3 : AFFICHAGE DES ANNÉES CRÉÉES SOUS FORME */}
        {/* DE PETITS RECTANGLES SUCCESSIFS AVEC LA COULEUR CHOISIE               */}
        {/* ----------------------------------------------------------------------- */}
        <section className="space-y-2 pt-1">
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

        {/* ----------------------------------------------------------------------- */}
        {/* ESPACE DE TRAVAIL DES ÉCOLES (REMPLACE L'ANCIENNE CARTE CENTRÉE)       */}
        {/* ----------------------------------------------------------------------- */}
        <section className="flex-1 flex flex-col justify-start pt-2">
          {currentSelectedYear ? (
            currentYearSchools.length === 0 ? (
              // 1. AUCUNE ÉCOLE : Bouton Plus au milieu avec pointillé autour formant un carré
              <div className="flex-1 flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
                <button
                  type="button"
                  onClick={() => {
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

                    return (
                      <div
                        key={school.id}
                        onClick={() => setSelectedSchoolId(school.id)}
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

                          {/* Badge année et bouton supprimer */}
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
                              onClick={(e) => handleDeleteSchool(school.id, e)}
                              className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition ${
                                isWhite 
                                  ? 'hover:bg-red-50 text-slate-400 hover:text-red-600' 
                                  : 'hover:bg-black/30 text-white/70 hover:text-white'
                              }`}
                              title="Supprimer cette école"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Milieu de la carte : Nom de l'école & Type */}
                        <div className="mt-3.5 space-y-0.5">
                          <h3 className="font-black text-base sm:text-lg tracking-tight leading-snug line-clamp-2">
                            {school.name}
                          </h3>
                          <span className={`text-[11px] font-semibold block ${
                            isWhite ? 'text-slate-500' : 'text-white/80'
                          }`}>
                            Établissement scolaire
                          </span>
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
          )}
        </section>

        {/* ========================================================================= */}
        {/* MODAL PROFESSIONNEL POUR AJOUTER UNE ÉCOLE (BIEN CARRÉ, BIEN GRAND)      */}
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
                    <School className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-[#00313d] leading-none">
                      Ajouter une école
                    </h2>
                    <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">
                      Rentrée scolaire {currentSelectedYear?.label}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAddSchoolModalOpen(false)}
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

                {/* 4. Bouton Créer accessible quand toutes les informations sont rentrées */}
                <div className="pt-3 border-t border-slate-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddSchoolModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700 transition"
                  >
                    Annuler
                  </button>

                  <button
                    type="submit"
                    disabled={!schoolName.trim()}
                    style={{ backgroundColor: schoolName.trim() ? '#00313d' : undefined }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-black transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 ${
                      schoolName.trim() 
                        ? 'text-white hover:bg-[#00242e] cursor-pointer' 
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                    <span>Créer l'école</span>
                  </button>
                </div>
              </form>
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
