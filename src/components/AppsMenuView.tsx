import React, { useState, useMemo } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  LayoutGrid,
  Calculator,
  Clock,
  FileCode,
  BookOpen,
  Sparkles,
  FileEdit,
  SlidersHorizontal,
  Play,
  RotateCcw,
  CheckCircle2,
  Atom,
  FlaskConical,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface AppsMenuViewProps {
  onBack: () => void;
  onLaunchApp?: (appId: string) => void;
}

interface StudyAppItem {
  id: string;
  name: string;
  category: 'Outils' | 'Étude' | 'Maths' | 'Focus' | 'Sciences';
  icon: any;
  color: string;
  badge: string;
  desc: string;
  details: string;
}

export const AppsMenuView: React.FC<AppsMenuViewProps> = ({ onBack, onLaunchApp }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // État de l'application interactive ouverte en modal
  const [activeModalApp, setActiveModalApp] = useState<string | null>(null);

  // État du Pomodoro interactif
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [isPomodoroRunning, setIsPomodoroRunning] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState<'work' | 'break'>('work');

  // État de la calculatrice interactive rapide
  const [calcInput, setCalcInput] = useState('');
  const [calcResult, setCalcResult] = useState('');

  // État du bloc-notes rapide
  const [quickNote, setQuickNote] = useState('');

  const studyApps: StudyAppItem[] = useMemo(() => [
    {
      id: 'app-calc',
      name: 'Calculatrice Scientifique',
      category: 'Maths',
      icon: Calculator,
      color: 'text-amber-400',
      badge: 'Maths & Formules',
      desc: 'Calculs arithmétiques, fonctions trigonométriques, puissances et racines carrées.',
      details: 'Outil de calcul complet adapté aux programmes du secondaire et supérieur.'
    },
    {
      id: 'app-pomodoro',
      name: 'Chronomètre & Pomodoro',
      category: 'Focus',
      icon: Clock,
      color: 'text-rose-400',
      badge: 'Concentration 25/5',
      desc: 'Gestion des sessions de travail intensif et des pauses de récupération.',
      details: 'Basé sur la méthode Pomodoro pour maximiser la mémorisation et éviter la fatigue.'
    },
    {
      id: 'app-latex',
      name: 'Éditeur & Rendu LaTeX',
      category: 'Sciences',
      icon: FileCode,
      color: 'text-emerald-400',
      badge: 'Équations & Symboles',
      desc: 'Édition et prévisualisation d\'équations mathématiques, physiques et chimiques.',
      details: 'Générez des formules de qualité publication pour vos comptes-rendus et devoirs.'
    },
    {
      id: 'app-notes',
      name: 'Bloc-notes Rapide',
      category: 'Outils',
      icon: FileEdit,
      color: 'text-cyan-400',
      badge: 'Prise de notes',
      desc: 'Écriture instantanée de mémos de cours, synthèses et listes de tâches.',
      details: 'Synchronisé avec votre espace de stockage pour ne jamais perdre une idée.'
    },
    {
      id: 'app-board',
      name: 'Tableau Blanc Virtuel',
      category: 'Étude',
      icon: Sparkles,
      color: 'text-pink-400',
      badge: 'Schémas & Esquisses',
      desc: 'Espace de dessin vectoriel pour concevoir des diagrammes et schémas scientifiques.',
      details: 'Idéal pour annoter des cartes mentales et visualiser des concepts complexes.'
    },
    {
      id: 'app-dict',
      name: 'Dictionnaire & Lexique Académique',
      category: 'Étude',
      icon: BookOpen,
      color: 'text-blue-400',
      badge: 'Définitions & Concepts',
      desc: 'Base de données terminologique et définitions scientifiques fondamentales.',
      details: 'Retrouvez immédiatement les termes clés de physique, chimie, biologie et littérature.'
    }
  ], []);

  // Timer Pomodoro
  React.useEffect(() => {
    let timer: any = null;
    if (isPomodoroRunning && pomodoroTime > 0) {
      timer = setInterval(() => {
        setPomodoroTime(t => t - 1);
      }, 1000);
    } else if (pomodoroTime === 0) {
      setIsPomodoroRunning(false);
      if (pomodoroMode === 'work') {
        alert('🎉 Session de travail terminée ! Prenez une pause de 5 minutes.');
        setPomodoroMode('break');
        setPomodoroTime(5 * 60);
      } else {
        alert('⏰ Pause terminée ! Prêt pour une nouvelle session de concentration ?');
        setPomodoroMode('work');
        setPomodoroTime(25 * 60);
      }
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPomodoroRunning, pomodoroTime, pomodoroMode]);

  // Évaluation calculatrice
  const handleCalculate = (expr: string) => {
    try {
      // Nettoyage sécurité simple
      const sanitized = expr.replace(/[^0-9+\-*/().√^% ]/g, '');
      const evalReady = sanitized.replace(/√\(([^)]+)\)/g, 'Math.sqrt($1)').replace(/\^/g, '**');
      // eslint-disable-next-line no-eval
      const res = Function(`'use strict'; return (${evalReady})`)();
      setCalcResult(String(res));
    } catch {
      setCalcResult('Erreur');
    }
  };

  const filteredApps = useMemo(() => {
    let list = studyApps;
    if (activeCategory !== 'all') {
      list = list.filter(a => a.category.toLowerCase() === activeCategory.toLowerCase());
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(a => a.name.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
    }
    return list;
  }, [studyApps, activeCategory, searchQuery]);

  return (
    <div className="flex-1 flex flex-col w-full min-h-screen bg-[#070A12] text-white select-none animate-in fade-in duration-200">
      {/* EN-TÊTE FIXE DU MENU APPLICATIONS */}
      <header className="sticky top-0 z-30 w-full bg-[#0A0E1A]/95 backdrop-blur-md px-3 sm:px-6 md:px-10 lg:px-12 py-2.5 border-b border-white/10 shadow-lg">
        <div className="w-full flex items-center justify-between gap-2 sm:gap-4">
          {/* GAUCHE : Bouton Retour et Titre Applications */}
          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 rounded-full bg-[#04060A] hover:bg-[#121826] text-white border border-white/10 transition-all cursor-pointer active:scale-95 shadow-sm font-bold text-xs"
              title="Retour au gestionnaire de fichiers"
            >
              <ArrowLeft className="w-4 h-4 stroke-[2.2]" />
              <span className="hidden xs:inline">Retour</span>
            </button>

            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-black border border-white/10 text-pink-400">
                <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.2]" />
              </div>
              <div>
                <h1 className="text-xs sm:text-sm md:text-base font-black text-white leading-tight">
                  Applications & Outils
                </h1>
                <p className="text-[10px] sm:text-[11px] font-semibold text-pink-400/80 leading-tight">
                  {studyApps.length} applications éducatives intégrées
                </p>
              </div>
            </div>
          </div>

          {/* MILIEU : Barre de Recherche Applications */}
          <div className="flex-1 max-w-xs sm:max-w-sm md:max-w-md mx-auto relative flex items-center px-1 sm:px-2">
            <div className="w-full flex items-center bg-[#04060A] hover:bg-[#0A0E18] focus-within:bg-[#0A0E18] focus-within:ring-2 focus-within:ring-pink-500/50 border border-white/10 rounded-full px-3.5 sm:px-4 py-1.5 transition-all shadow-inner gap-2">
              <Search className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-pink-400/80 shrink-0 stroke-[2.2]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher une application..."
                className="w-full bg-transparent text-xs sm:text-sm text-white placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-300 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ONGLETS DE FILTRAGE DES APPLICATIONS */}
        <div className="flex items-center gap-1.5 sm:gap-2 mt-2.5 overflow-x-auto pb-1 scrollbar-none">
          {[
            { id: 'all', label: 'Toutes les applications' },
            { id: 'maths', label: 'Maths & Calcul' },
            { id: 'focus', label: 'Concentration & Focus' },
            { id: 'sciences', label: 'Sciences & Formules' },
            { id: 'outils', label: 'Outils Pratiques' },
            { id: 'étude', label: 'Étude & Lexique' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveCategory(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeCategory === tab.id
                  ? 'bg-pink-500 text-white shadow-md shadow-pink-500/20'
                  : 'bg-[#10162A] text-slate-300 hover:text-white hover:bg-[#192242] border border-white/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* CONTENU PRINCIPAL : CATALOGUE DES APPLICATIONS */}
      <main className="flex-1 w-full px-3 sm:px-6 md:px-10 lg:px-12 py-4 pb-32">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredApps.map((app) => {
            const Icon = app.icon;

            return (
              <div
                key={app.id}
                onClick={() => {
                  if (onLaunchApp) onLaunchApp(app.id);
                  else setActiveModalApp(app.id);
                }}
                className="group relative rounded-3xl p-5 bg-[#0B0F1D] hover:bg-[#121828] border border-white/10 hover:border-pink-500/40 shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between hover:scale-102"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className={`p-3.5 rounded-2xl bg-black/60 border border-white/10 shrink-0 group-hover:scale-110 transition-transform ${app.color}`}>
                      <Icon className="w-7 h-7 stroke-[2]" />
                    </div>

                    <span className="px-2.5 py-1 rounded-full bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[10px] font-extrabold tracking-wider uppercase">
                      {app.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-black text-white mb-1.5 group-hover:text-pink-300 transition-colors">
                    {app.name}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    {app.desc}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    {app.details}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-bold text-pink-400 group-hover:translate-x-1 transition-transform flex items-center gap-1">
                    <span>Lancer l'application</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>

                  <span className="text-[10px] font-bold text-slate-400 bg-black/40 px-2 py-0.5 rounded-md border border-white/5">
                    {app.category}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* MODAL 1 : CALCULATRICE RAPIDE INTERACTIVE */}
      {activeModalApp === 'app-calc' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1222] border border-amber-500/30 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-black text-white">Calculatrice Scientifique</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#050812] p-4 rounded-2xl border border-white/10 text-right">
              <div className="text-xs text-slate-400 font-mono h-4">{calcInput || '0'}</div>
              <div className="text-2xl font-black text-amber-400 font-mono mt-1">{calcResult || '0'}</div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {['C', '(', ')', '/', '7', '8', '9', '*', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '%', '='].map((btn) => (
                <button
                  key={btn}
                  type="button"
                  onClick={() => {
                    if (btn === 'C') {
                      setCalcInput('');
                      setCalcResult('');
                    } else if (btn === '=') {
                      handleCalculate(calcInput);
                    } else {
                      setCalcInput(prev => prev + btn);
                    }
                  }}
                  className={`py-3 rounded-xl font-black text-sm transition-all active:scale-90 ${
                    btn === '='
                      ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                      : btn === 'C'
                      ? 'bg-red-500/20 text-red-300'
                      : ['/', '*', '-', '+'].includes(btn)
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-[#151D33] text-white hover:bg-[#1E2945]'
                  }`}
                >
                  {btn}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : CHRONOMÈTRE POMODORO INTERACTIF */}
      {activeModalApp === 'app-pomodoro' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-3xl bg-[#0D1222] border border-rose-500/30 p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-rose-400" />
                <h3 className="text-sm font-black text-white">Chronomètre Pomodoro</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-4">
              <span className="text-[11px] font-extrabold uppercase px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                {pomodoroMode === 'work' ? '🧠 Session de Focus (25 min)' : '☕ Pause Récupération (5 min)'}
              </span>

              <div className="text-5xl font-mono font-black text-white my-6 tracking-wider">
                {Math.floor(pomodoroTime / 60).toString().padStart(2, '0')}:
                {(pomodoroTime % 60).toString().padStart(2, '0')}
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPomodoroRunning(!isPomodoroRunning)}
                  className="px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-400 text-black font-black text-sm shadow-lg shadow-rose-500/25 transition-all active:scale-95"
                >
                  {isPomodoroRunning ? 'Pause' : 'Démarrer'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPomodoroRunning(false);
                    setPomodoroTime(pomodoroMode === 'work' ? 25 * 60 : 5 * 60);
                  }}
                  className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
                  title="Réinitialiser"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3 : BLOC-NOTES RAPIDE */}
      {activeModalApp === 'app-notes' && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#0D1222] border border-cyan-500/30 p-5 shadow-2xl space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <FileEdit className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-black text-white">Bloc-notes Rapide</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModalApp(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              value={quickNote}
              onChange={(e) => setQuickNote(e.target.value)}
              placeholder="Écrivez vos notes, formules, devoirs à faire ici..."
              className="w-full h-48 bg-[#050814] rounded-2xl p-4 text-xs font-mono text-slate-200 border border-white/10 focus:outline-none focus:border-cyan-400 leading-relaxed resize-none"
            />

            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>{quickNote.length} caractères</span>
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([quickNote], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `Note_StudyCloud_${Date.now()}.txt`;
                  a.click();
                }}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 text-black font-bold text-xs"
              >
                Enregistrer en .txt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
