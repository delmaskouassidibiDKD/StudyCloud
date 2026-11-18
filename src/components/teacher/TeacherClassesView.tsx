import React, { useState, useEffect, useRef } from 'react';
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
  Plus,
  X,
  Check,
  Calendar,
  Sparkles,
  Trash2,
  School,
  FolderPlus
} from 'lucide-react';

export interface SchoolYearItem {
  id: string;
  label: string; // ex: "2026 - 2027"
  color: string; // hex ou 'white'
  textColor?: string;
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
        {/* ESPACE DE TRAVAIL ÉPURÉ (MOCK DEMO SUPPRIMÉ COMME DEMANDÉ SUR L'IMAGE 2)*/}
        {/* ----------------------------------------------------------------------- */}
        <section className="flex-1 flex flex-col justify-center items-center py-10 px-4">
          {currentSelectedYear ? (
            <div className="w-full max-w-2xl bg-white/80 backdrop-blur-xl border border-white/90 rounded-3xl p-6 sm:p-8 shadow-[0_10px_25px_rgba(0,40,60,0.04)] text-center space-y-4 animate-fade-in">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center text-white shadow-md"
                style={{ backgroundColor: currentSelectedYear.color || '#00313d' }}
              >
                <School className="w-8 h-8 text-white" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-cyan-700 bg-cyan-50 px-2.5 py-1 rounded-full border border-cyan-200/60 inline-block mb-1.5">
                  Rentrée scolaire sélectionnée
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight font-mono">
                  {currentSelectedYear.label}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                  Cette année scolaire est prête pour la gestion de vos classes, étudiants, évaluations et moyennes.
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-3 text-xs font-bold text-slate-400">
                <span>0 Classes</span>
                <span>&bull;</span>
                <span>0 Étudiants</span>
                <span>&bull;</span>
                <span>0 Évaluations</span>
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 p-8 bg-white/60 backdrop-blur-md rounded-3xl border border-white/80 max-w-md">
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
