import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  MessageSquare,
  Users2,
  Layers,
  ArrowLeft,
  Search,
  Bell,
  Settings,
  Grid,
  List,
  SlidersHorizontal,
  Plus,
  MoreVertical,
  X,
  Check,
  BookOpen,
  Sparkles
} from 'lucide-react';

export interface ClassItem {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  traineesCount: number;
  materialsCount: number;
  progressPercent: number;
  status: 'active' | 'warning' | 'completed';
  instructorName: string;
  instructorAvatar?: string;
  gradientTheme: string; // Tailwind gradient classes
  accentOutline?: boolean;
  category?: string;
  traineeAvatars: { initial: string; bg: string }[];
}

interface TeacherClassesViewProps {
  onBack: () => void;
  user?: {
    name?: string;
    email?: string;
    avatar_url?: string;
  } | null;
}

const INITIAL_FEATURED_CLASSES: ClassItem[] = [
  {
    id: 'feat-1',
    title: 'JavaScript Essentials',
    description: 'In this course, you will learn web front-end development through the development of applications that run on a single browser.',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 68,
    status: 'active',
    instructorName: 'David Wallace',
    gradientTheme: 'from-pink-500 via-rose-500 to-purple-600',
    category: 'Web',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-emerald-500' },
      { initial: 'O', bg: 'bg-cyan-500' },
      { initial: 'T', bg: 'bg-amber-500' },
      { initial: 'S', bg: 'bg-rose-500' },
    ]
  },
  {
    id: 'feat-2',
    title: '自動アンロックしない',
    subtitle: 'Bases de données & Systèmes SQL',
    description: 'このコースは、Webシステム開発において必要なデータベースについてや、SQLを用いたプログラミングを学んでいきます。',
    traineesCount: 48,
    materialsCount: 10,
    progressPercent: 42,
    status: 'active',
    instructorName: 'John Doe',
    gradientTheme: 'from-emerald-400 via-teal-500 to-cyan-600',
    category: 'Database',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-indigo-500' },
      { initial: 'O', bg: 'bg-teal-500' },
      { initial: 'T', bg: 'bg-amber-500' },
      { initial: 'S', bg: 'bg-purple-500' },
    ]
  }
];

const INITIAL_ALL_CLASSES: ClassItem[] = [
  {
    id: 'class-1',
    title: 'JavaScript Essentials',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 65,
    status: 'active',
    instructorName: 'David Wallace',
    gradientTheme: 'from-orange-500 to-rose-500',
    category: 'Web',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-cyan-500' },
      { initial: 'G', bg: 'bg-emerald-500' },
    ]
  },
  {
    id: 'class-2',
    title: 'Problem Solving',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 50,
    status: 'warning',
    instructorName: 'Sarah Connor',
    gradientTheme: 'from-amber-400 to-orange-500',
    accentOutline: true,
    category: 'Algorithm',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-rose-500' },
      { initial: 'G', bg: 'bg-amber-500' },
    ]
  },
  {
    id: 'class-3',
    title: 'Front End Fundamentals',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 80,
    status: 'active',
    instructorName: 'Michael Scott',
    gradientTheme: 'from-blue-600 to-sky-400',
    category: 'Web',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-purple-500' },
      { initial: 'G', bg: 'bg-cyan-500' },
    ]
  },
  {
    id: 'class-4',
    title: 'JavaScript',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 72,
    status: 'active',
    instructorName: 'David Wallace',
    gradientTheme: 'from-teal-400 to-emerald-500',
    category: 'Web',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-emerald-500' },
      { initial: 'G', bg: 'bg-teal-500' },
    ]
  },
  {
    id: 'class-5',
    title: 'Learning Soft Skills',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 40,
    status: 'active',
    instructorName: 'Pam Beesly',
    gradientTheme: 'from-sky-400 to-blue-500',
    category: 'Soft Skills',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-amber-500' },
      { initial: 'G', bg: 'bg-indigo-500' },
    ]
  },
  {
    id: 'class-6',
    title: 'PHP 101',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 35,
    status: 'active',
    instructorName: 'Jim Halpert',
    gradientTheme: 'from-purple-500 to-indigo-600',
    category: 'Backend',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-pink-500' },
      { initial: 'G', bg: 'bg-sky-500' },
    ]
  },
  {
    id: 'class-7',
    title: 'Intro to JS',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 90,
    status: 'warning',
    instructorName: 'Dwight Schrute',
    gradientTheme: 'from-yellow-400 to-amber-500',
    category: 'Web',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-orange-500' },
      { initial: 'G', bg: 'bg-rose-500' },
    ]
  },
  {
    id: 'class-8',
    title: 'SQL Essentials',
    traineesCount: 120,
    materialsCount: 15,
    progressPercent: 60,
    status: 'active',
    instructorName: 'Stanley Hudson',
    gradientTheme: 'from-teal-400 to-cyan-600',
    category: 'Database',
    traineeAvatars: [
      { initial: 'J', bg: 'bg-cyan-500' },
      { initial: 'G', bg: 'bg-emerald-500' },
    ]
  }
];

export const TeacherClassesView: React.FC<TeacherClassesViewProps> = ({ onBack, user }) => {
  // Navigation active tab dans la barre latérale
  const [activeNavTab, setActiveNavTab] = useState<'dashboard' | 'trainees' | 'classes' | 'discussions' | 'groups' | 'library'>('classes');
  
  // États de recherche, filtres et affichage
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<string>('all');
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);

  // Liste des classes (dynamique)
  const [featuredClasses, setFeaturedClasses] = useState<ClassItem[]>(INITIAL_FEATURED_CLASSES);
  const [allClasses, setAllClasses] = useState<ClassItem[]>(INITIAL_ALL_CLASSES);
  const [selectedCardId, setSelectedCardId] = useState<string>('class-2');

  // Modal Création de classe
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTrainees, setNewTrainees] = useState(30);
  const [newMaterials, setNewMaterials] = useState(12);
  const [newInstructor, setNewInstructor] = useState(user?.name || 'Professeur');
  const [newTheme, setNewTheme] = useState('from-cyan-500 to-blue-600');
  const [newCategory, setNewCategory] = useState('Général');

  // Filtrage
  const filteredAllClasses = useMemo(() => {
    return allClasses.filter((item) => {
      const matchSearch = searchQuery.trim() === '' || 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        item.instructorName.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCategory = selectedFilterCategory === 'all' || item.category === selectedFilterCategory;
      return matchSearch && matchCategory;
    });
  }, [allClasses, searchQuery, selectedFilterCategory]);

  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newClass: ClassItem = {
      id: `class-${Date.now()}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      traineesCount: Number(newTrainees) || 25,
      materialsCount: Number(newMaterials) || 10,
      progressPercent: 0,
      status: 'active',
      instructorName: newInstructor.trim() || (user?.name || 'Professeur'),
      gradientTheme: newTheme,
      category: newCategory,
      traineeAvatars: [
        { initial: 'A', bg: 'bg-cyan-500' },
        { initial: 'B', bg: 'bg-emerald-500' }
      ]
    };

    setAllClasses([newClass, ...allClasses]);
    setIsCreateModalOpen(false);
    setNewTitle('');
    setNewDescription('');
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trainees', label: 'Trainees', icon: Users },
    { id: 'classes', label: 'Classes', icon: GraduationCap },
    { id: 'discussions', label: 'Discussions', icon: MessageSquare },
    { id: 'groups', label: 'Groups', icon: Users2 },
    { id: 'library', label: 'Library', icon: Layers },
  ] as const;

  return (
    <div className="relative w-full h-full min-h-[calc(100vh-4rem)] flex overflow-hidden font-sans select-none"
      style={{
        background: 'linear-gradient(135deg, #dcf0fa 0%, #e6f4fb 35%, #edf7fc 70%, #dff2fa 100%)'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. BARRE LATÉRALE GAUCHE (Couleur identique : Deep Teal / Pétrole Foncé) */}
      {/* ========================================================================= */}
      <aside 
        className="w-18 sm:w-20 md:w-22 shrink-0 flex flex-col items-center py-5 justify-between z-30 transition-all border-r border-[#002830]/30 shadow-2xl"
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

        {/* Éléments de navigation verticaux */}
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
      {/* 2. ESPACE PRINCIPAL DE TRAVAIL (Fond doux dégradé bleu ciel / givré) */}
      {/* ========================================================================= */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-6 md:p-8 space-y-6">
        
        {/* ----------------------------------------------------------------------- */}
        {/* EN-TÊTE : BREADCRUMB, TITRE, ACTIONS & PROFIL */}
        {/* ----------------------------------------------------------------------- */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Titre & Fil d'Ariane */}
          <div>
            <div className="text-[11px] font-semibold text-slate-400 tracking-wider flex items-center gap-1 mb-0.5">
              <span>Dashboard</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onBack}
                className="p-1 rounded-lg hover:bg-black/5 text-slate-700 transition"
                title="Retour"
              >
                <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
              </button>
              <h1 className="text-2xl sm:text-3xl font-black text-[#0f2430] tracking-tight">
                Classes
              </h1>
            </div>
          </div>

          {/* Contrôles du haut : Recherche, Notifs, Paramètres, Profil & Bouton Create Class */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 flex-wrap">
            {/* Barre de recherche dynamique */}
            <div className="relative flex items-center">
              {isSearchOpen ? (
                <div className="flex items-center bg-white/90 backdrop-blur-md rounded-2xl px-3 py-1.5 shadow-sm border border-white/80 transition-all w-52 sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search classes, instructors..."
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
                  title="Search classes"
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
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Profil Utilisateur (Capsule comme sur l'image) */}
            <div className="flex items-center gap-2 pl-1 pr-3 py-1 bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/90">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-cyan-600 to-teal-400 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  (user?.name ? user.name.charAt(0).toUpperCase() : 'M')
                )}
              </div>
              <div className="flex flex-col text-left">
                <span className="text-xs font-bold text-slate-800 leading-none">
                  {user?.name || 'Michael'}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  Instructor
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* ----------------------------------------------------------------------- */}
        {/* BARRE D'ACTIONS : TOGGLES DE VUE & BOUTON PRINCIPAL + CREATE CLASS */}
        {/* ----------------------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 pt-1">
          {/* Toggles Vue (Grid 2x2, List, Filtre) */}
          <div className="flex items-center gap-1.5 bg-white/60 backdrop-blur-md p-1 rounded-2xl border border-white/80 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-xl transition ${
                viewMode === 'grid' 
                  ? 'bg-cyan-500 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
              title="Grid view"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-xl transition ${
                viewMode === 'list' 
                  ? 'bg-cyan-500 text-white shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
              }`}
              title="List view"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                className={`p-1.5 rounded-xl transition ${
                  selectedFilterCategory !== 'all' 
                    ? 'bg-teal-600 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                }`}
                title="Filter by category"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {/* Menu dropdown de filtre */}
              {isFilterMenuOpen && (
                <div className="absolute left-0 mt-2 w-44 bg-white/95 backdrop-blur-xl border border-white/90 rounded-2xl shadow-xl p-2 z-40 text-xs">
                  <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase tracking-wider">Categories</div>
                  {['all', 'Web', 'Database', 'Algorithm', 'Soft Skills', 'Backend'].map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => {
                        setSelectedFilterCategory(cat);
                        setIsFilterMenuOpen(false);
                      }}
                      className={`w-full text-left px-2.5 py-1.5 rounded-xl flex items-center justify-between transition ${
                        selectedFilterCategory === cat ? 'bg-cyan-50 font-bold text-cyan-700' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>{cat === 'all' ? 'All Categories' : cat}</span>
                      {selectedFilterCategory === cat && <Check className="w-3.5 h-3.5 text-cyan-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bouton Pro : + CREATE CLASS (Couleur pétrole sombre comme sur l'image) */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black text-white shadow-md transition-all active:scale-95"
            style={{ backgroundColor: '#00313d' }}
            title="Create a new class"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span className="tracking-wide uppercase text-[11px]">CREATE CLASS</span>
          </button>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* SECTION 1 : LES 2 GRANDES CARTES À LA UNE (En vedette / En cours) */}
        {/* ----------------------------------------------------------------------- */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {featuredClasses.map((item) => (
            <div
              key={item.id}
              className="bg-white/80 backdrop-blur-xl border border-white/90 rounded-3xl p-5 md:p-6 shadow-[0_10px_25px_rgba(0,40,60,0.04)] hover:shadow-lg transition-all flex flex-col justify-between gap-5 relative overflow-hidden"
            >
              {/* Partie supérieure de la carte */}
              <div className="flex items-start gap-4">
                {/* Miniature abstraite moderne avec vagues arrondies */}
                <div className={`w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br ${item.gradientTheme} shadow-md flex items-center justify-center text-white shrink-0 relative overflow-hidden`}>
                  {/* Formes organiques douces pour répliquer le design de l'image */}
                  <div className="absolute -bottom-3 -left-3 w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm"></div>
                  <div className="absolute top-2 -right-2 w-12 h-12 rounded-full bg-white/15"></div>
                  <BookOpen className="w-7 h-7 text-white/90 drop-shadow relative z-10" />
                </div>

                {/* Infos du cours */}
                <div className="flex-1 min-w-0 pr-6">
                  <div className="text-[11px] font-semibold text-slate-400 mb-0.5">
                    {item.traineesCount} Trainees &bull; {item.materialsCount} Materials
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-slate-800 tracking-tight leading-snug">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <div className="text-[11px] font-bold text-teal-600 mt-0.5">
                      {item.subtitle}
                    </div>
                  )}
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>

                {/* Statut & Menu options */}
                <div className="absolute top-5 right-5 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" title="Classe active"></span>
                  <button type="button" className="text-slate-400 hover:text-slate-700 p-1 rounded-lg transition">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Partie inférieure de la carte (Progression, Trainees, Enseignant) */}
              <div className="pt-3 border-t border-slate-100/80 flex items-center justify-between flex-wrap gap-3">
                {/* Progression de la classe */}
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Class Progress
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-700 font-extrabold text-[10px] flex items-center justify-center">
                      12
                    </div>
                    <div className="w-4 h-0.5 bg-teal-400"></div>
                    <div className="w-6 h-6 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-700 font-extrabold text-[10px] flex items-center justify-center">
                      5
                    </div>
                    <div className="w-4 h-0.5 bg-slate-200"></div>
                    <div className="w-6 h-6 rounded-full bg-slate-100 border border-slate-300 text-slate-500 font-extrabold text-[10px] flex items-center justify-center">
                      8
                    </div>
                  </div>
                </div>

                {/* Stacks d'avatars des apprenants */}
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Trainees
                  </span>
                  <div className="flex items-center -space-x-1.5">
                    {item.traineeAvatars.map((avatar, idx) => (
                      <div
                        key={idx}
                        className={`w-6 h-6 rounded-full ${avatar.bg} border-2 border-white text-white font-black text-[9px] flex items-center justify-center shadow-xs`}
                      >
                        {avatar.initial}
                      </div>
                    ))}
                    <div className="w-6 h-6 rounded-full bg-cyan-100 border-2 border-white text-cyan-800 font-black text-[8px] flex items-center justify-center">
                      +{item.traineesCount - 4}
                    </div>
                  </div>
                </div>

                {/* Instructeur */}
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Instructor
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center border border-white">
                      {item.instructorName.charAt(0)}
                    </div>
                    <span className="text-xs font-bold text-slate-700">
                      {item.instructorName}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ----------------------------------------------------------------------- */}
        {/* SECTION 2 : TOUTES LES CLASSES ("All Classes") */}
        {/* ----------------------------------------------------------------------- */}
        <section className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-[#0f2430] tracking-tight">
              All Classes
            </h2>
            <span className="text-xs font-bold text-slate-400">
              {filteredAllClasses.length} {filteredAllClasses.length > 1 ? 'classes' : 'classe'}
            </span>
          </div>

          {/* Grille de cartes */}
          <div className={`grid gap-4 ${
            viewMode === 'grid' 
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
              : 'grid-cols-1'
          }`}>
            {filteredAllClasses.map((c) => {
              const isSelected = selectedCardId === c.id;

              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedCardId(c.id)}
                  className={`bg-white/80 backdrop-blur-xl rounded-2xl p-4 shadow-[0_6px_20px_rgba(0,40,60,0.03)] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-3 relative ${
                    isSelected || c.accentOutline
                      ? 'border-2 border-orange-400/80 shadow-orange-500/10'
                      : 'border border-white/90 hover:border-cyan-300/60'
                  }`}
                >
                  {/* Ligne du haut : Miniature + Titre + Nombre d'étudiants */}
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.gradientTheme} shadow-sm flex items-center justify-center text-white shrink-0 relative overflow-hidden`}>
                      <div className="absolute -bottom-2 -left-2 w-8 h-8 rounded-full bg-white/20"></div>
                      <BookOpen className="w-5 h-5 text-white/90" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="text-[10px] font-semibold text-slate-400">
                        {c.traineesCount} Trainees &bull; {c.materialsCount} Materials
                      </div>
                      <h4 className="text-xs sm:text-sm font-extrabold text-slate-800 truncate mt-0.5" title={c.title}>
                        {c.title}
                      </h4>
                    </div>

                    {/* Statut & Menu options */}
                    <div className="absolute top-3.5 right-3 flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${c.status === 'warning' ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                      <button type="button" className="text-slate-400 hover:text-slate-600 p-0.5">
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Ligne du bas : Barre de progression + Avatars */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                        Class Progress
                      </span>
                      <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden mt-1">
                        <div
                          className={`h-full rounded-full ${c.status === 'warning' ? 'bg-orange-500' : 'bg-teal-500'}`}
                          style={{ width: `${c.progressPercent}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">
                        Trainees
                      </span>
                      <div className="flex items-center -space-x-1 mt-0.5">
                        {c.traineeAvatars.map((a, i) => (
                          <div
                            key={i}
                            className={`w-5 h-5 rounded-full ${a.bg} border border-white text-white font-black text-[8px] flex items-center justify-center`}
                          >
                            {a.initial}
                          </div>
                        ))}
                        <div className="w-5 h-5 rounded-full bg-cyan-100 border border-white text-cyan-800 font-bold text-[7px] flex items-center justify-center">
                          +{c.traineesCount - 2}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* ========================================================================= */}
      {/* 3. MODALE "CREATE CLASS" (Pour créer une nouvelle classe en direct) */}
      {/* ========================================================================= */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl border border-white/80 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#00313d] text-white flex items-center justify-center">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800">Créer une nouvelle classe</h3>
                  <p className="text-[11px] text-slate-400">Configurez l'intitulé et les paramètres de la classe</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Intitulé de la classe *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="ex: Mathématiques Avancées, JavaScript..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Description du cours
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Bref résumé des objectifs pédagogiques..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nombre d'apprenants
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newTrainees}
                    onChange={(e) => setNewTrainees(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Modules / Matériels
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newMaterials}
                    onChange={(e) => setNewMaterials(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Nom du Professeur / Instructeur
                  </label>
                  <input
                    type="text"
                    value={newInstructor}
                    onChange={(e) => setNewInstructor(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Catégorie
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  >
                    <option value="Général">Général</option>
                    <option value="Web">Web</option>
                    <option value="Database">Database</option>
                    <option value="Algorithm">Algorithm</option>
                    <option value="Soft Skills">Soft Skills</option>
                    <option value="Backend">Backend</option>
                  </select>
                </div>
              </div>

              {/* Sélection du dégradé thématique */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  Thème visuel de la vignette
                </label>
                <div className="flex items-center gap-2">
                  {[
                    { id: 'from-pink-500 to-purple-600', label: 'Rose/Violet' },
                    { id: 'from-emerald-400 to-teal-600', label: 'Menthe' },
                    { id: 'from-orange-500 to-rose-500', label: 'Orange' },
                    { id: 'from-blue-600 to-sky-400', label: 'Bleu Roi' },
                    { id: 'from-amber-400 to-orange-500', label: 'Doré' },
                  ].map((grad) => (
                    <button
                      key={grad.id}
                      type="button"
                      onClick={() => setNewTheme(grad.id)}
                      className={`w-7 h-7 rounded-full bg-gradient-to-tr ${grad.id} transition-transform ${
                        newTheme === grad.id ? 'scale-125 ring-2 ring-offset-2 ring-slate-800' : 'hover:scale-110'
                      }`}
                      title={grad.label}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-500 hover:text-slate-800 font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl font-bold text-white shadow-md transition active:scale-95"
                  style={{ backgroundColor: '#00313d' }}
                >
                  Créer la classe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
