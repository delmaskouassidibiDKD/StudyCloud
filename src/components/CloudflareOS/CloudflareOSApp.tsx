import React, { useState, useRef, useEffect } from 'react';
import {
  Hexagon,
  Home,
  MessageSquare,
  LayoutGrid,
  Layers,
  Shield,
  Settings,
  Search,
  Plus,
  Play,
  RotateCcw,
  Sparkles,
  Paperclip,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Sliders,
  Send,
  Code2,
  Cpu,
  Database,
  Cloud,
  FileText,
  Presentation,
  TrendingUp,
  Zap,
  Gamepad2,
  Compass,
  Lock,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Copy,
  Check
} from 'lucide-react';
import { MeshBackground } from './MeshBackground';

export type CloudflareOSTab = 'home' | 'workspace' | 'gadgets' | 'blueprints' | 'gatekeepers' | 'settings';

interface BlueprintItem {
  id: string;
  title: string;
  category: string;
  description: string;
  tags: string[];
  downloads: string;
  icon: any;
}

const BLUEPRINTS: BlueprintItem[] = [
  {
    id: 'team-slides',
    title: 'Deck de Réunion d\'Équipe',
    category: 'Présentation',
    description: 'Diapositives interactives avec suivi d\'avancement, risques, décisions et animations fluides.',
    tags: ['Slides', 'Cap\'n Web', 'Durable Objects'],
    downloads: '14.2k',
    icon: Presentation,
  },
  {
    id: 'interactive-whiteboard',
    title: 'Tableau Blanc Collaboratif',
    category: 'Productivité',
    description: 'Espace de dessin vectoriel temps réel sandboxé avec notes adhésives et collaboration multi-utilisateurs.',
    tags: ['Canvas', 'Multiplayer', 'Sandbox'],
    downloads: '9.8k',
    icon: LayoutGrid,
  },
  {
    id: 'data-analytics',
    title: 'Analyseur de Données & Métriques',
    category: 'Data',
    description: 'Génère des visualisations, tendances et recommandations instantanées à partir de tableaux ou CSV.',
    tags: ['Analytics', 'Charts', 'Workers AI'],
    downloads: '18.5k',
    icon: TrendingUp,
  },
  {
    id: 'tic-tac-toe-ai',
    title: 'Mini-Jeu Morpion contre l\'IA',
    category: 'Gadget',
    description: 'Application autonome de morpion exécutée dans une Facet de Worker dynamique avec IA intégrée.',
    tags: ['Gaming', 'Dynamic Worker', 'Facet'],
    downloads: '6.4k',
    icon: Gamepad2,
  },
  {
    id: 'github-triage',
    title: 'Triage Automatisé GitHub',
    category: 'Automatisation',
    description: 'Workflow de tri des issues, résumé des PR et génération de changelogs via Gatekeeper sécurisé.',
    tags: ['Gatekeeper', 'GitHub API', 'Workflow'],
    downloads: '11.3k',
    icon: Zap,
  },
];

interface GatekeeperService {
  id: string;
  name: string;
  type: string;
  status: 'connected' | 'simulated' | 'ready';
  description: string;
  capabilities: string[];
  color: string;
}

const GATEKEEPERS: GatekeeperService[] = [
  {
    id: 'cf-workers',
    name: 'Cloudflare Platform',
    type: 'Infrastructure & Edge',
    status: 'connected',
    description: 'Contrôle des Workers, KV, Durable Objects et buckets R2 avec sécurité basée sur les capacités.',
    capabilities: ['Workers Deployment', 'D1 Query Execution', 'R2 Object Store', 'Durable Object Facets'],
    color: '#ff4801',
  },
  {
    id: 'github',
    name: 'GitHub Gatekeeper',
    type: 'Code & Dépôts',
    status: 'connected',
    description: 'Interactions sécurisées avec les dépôts, commits, PR et lecture de code sans exposition de token direct.',
    capabilities: ['Repo Read/Write', 'Pull Request Review', 'Issue Automation', 'Webhook Receiver'],
    color: '#24292F',
  },
  {
    id: 'google-suite',
    name: 'Google Workspace',
    type: 'Documents & Stockage',
    status: 'simulated',
    description: 'Accès modéré aux Google Docs, Sheets et Drive avec simulation d\'action avant confirmation utilisateur.',
    capabilities: ['Docs Read & Diff', 'Spreadsheet Parsing', 'Drive Storage Sync'],
    color: '#4285F4',
  },
  {
    id: 'slack',
    name: 'Slack Gateway',
    type: 'Communication',
    status: 'ready',
    description: 'Diffusion d\'alertes, synthèses quotidiennes d\'équipes et interactions par bots dans vos canaux.',
    capabilities: ['Channel Messages', 'Interactive Buttons', 'Thread Summaries'],
    color: '#4A154B',
  },
  {
    id: 'notion',
    name: 'Notion Database',
    type: 'Connaissances & Wikilinks',
    status: 'ready',
    description: 'Lecture et structuration de pages, wikis d\'ingénierie et tableaux de suivi.',
    capabilities: ['Page Creation', 'Database Query', 'Block Appending'],
    color: '#000000',
  },
  {
    id: 'supabase',
    name: 'Supabase Postgres',
    type: 'Base Relationnelle',
    status: 'ready',
    description: 'Connexion directe SQL avec bac à sable de lecture/écriture et contrôle granulaire.',
    capabilities: ['Postgres SQL Query', 'Auth Webhooks', 'Storage Buckets'],
    color: '#3ECF8E',
  },
];

export const CloudflareOSApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CloudflareOSTab>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [promptText, setPromptText] = useState('');
  const [selectedModel, setSelectedModel] = useState<'workers-ai' | 'gemini-flash' | 'llama-vision'>('workers-ai');
  const [selectedFormat, setSelectedFormat] = useState<'gadget' | 'slides' | 'doc' | 'workflow' | 'analytics'>('gadget');

  // État du Gadget interactif en cours (Morpion IA ou Slides)
  const [activeGadgetId, setActiveGadgetId] = useState<string>('tic-tac-toe');
  const [ticTacToeBoard, setTicTacToeBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [currentTurn, setCurrentTurn] = useState<'X' | 'O'>('X');
  const [gameWinner, setGameWinner] = useState<string | null>(null);

  // État des Slides
  const [slideIndex, setSlideIndex] = useState(0);
  const SLIDES_CONTENT = [
    {
      title: 'Cloudflare OS v2.0 Architecture',
      subtitle: 'Environnement de productivité piloté par l\'IA avec bacs à sable autonomes',
      points: [
        'Durable Objects pour la collaboration multijoueur temps réel',
        'Facets de Workers Dynamiques pour isoler chaque Gadget privé',
        'Gatekeepers pour la sécurité basée sur les capacités et le contrôle humain',
      ],
      tag: 'Aperçu Système',
    },
    {
      title: 'Le Concept des « Gadgets »',
      subtitle: 'Une rupture majeure avec le modèle SaaS centralisé classique',
      points: [
        'Chaque utilisateur possède sa propre instance privée d\'application',
        'Aucune fuite de données inter-utilisateurs possible par conception',
        'L\'IA peut modifier et personnaliser le code de votre gadget à la volée',
      ],
      tag: 'Bacs à Sable',
    },
    {
      title: 'Gatekeepers & Approbations Asynchrones',
      subtitle: 'Plus besoin d\'attendre les autorisations humaines bloquantes',
      points: [
        'Simulation locale des actions avec effets de bord pour que l\'agent continue',
        'Validation ou refus groupé des actions au moment opportun',
        'Audit complet et transparent de chaque requête sortante',
      ],
      tag: 'Sécurité Gatekeepers',
    },
  ];

  // Logique du jeu Morpion
  const handleTicTacToeCellClick = (index: number) => {
    if (ticTacToeBoard[index] || gameWinner) return;
    const nextBoard = [...ticTacToeBoard];
    nextBoard[index] = 'X';
    
    // Vérifier victoire joueur X
    const winnerX = checkTicTacToeWinner(nextBoard);
    if (winnerX) {
      setTicTacToeBoard(nextBoard);
      setGameWinner(winnerX);
      return;
    }

    // Tour de l'Agent IA (O)
    const emptyIndices = nextBoard.map((val, i) => val === null ? i : null).filter((v): v is number => v !== null);
    if (emptyIndices.length > 0) {
      const randomAiMove = emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      nextBoard[randomAiMove] = 'O';
      const winnerAi = checkTicTacToeWinner(nextBoard);
      if (winnerAi) {
        setGameWinner(winnerAi);
      }
    } else {
      setGameWinner('Égalité');
    }
    setTicTacToeBoard(nextBoard);
  };

  const checkTicTacToeWinner = (board: (string | null)[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      [0, 4, 8], [2, 4, 6]
    ];
    for (const [a, b, c] of lines) {
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    return null;
  };

  const resetTicTacToe = () => {
    setTicTacToeBoard(Array(9).fill(null));
    setGameWinner(null);
    setCurrentTurn('X');
  };

  // Chat conversationnel de l'Espace de travail
  const [messages, setMessages] = useState<Array<{ sender: 'user' | 'agent'; text: string; time: string; logs?: string[] }>>([
    {
      sender: 'agent',
      text: 'Bienvenue dans Cloudflare OS ! Je suis votre agent multi-usage dédié. Je peux concevoir des gadgets en bac à sable, manipuler des blueprints ou automatiser des flux avec vos Gatekeepers.',
      time: '12:00',
      logs: ['Durable Object Facet initialisé', 'Cap\'n Web RPC prêt sur localhost:8787'],
    },
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleSendChat = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = {
      sender: 'user' as const,
      text: chatInput,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const inputSnapshot = chatInput;
    setChatInput('');

    // Réponse de l'Agent Cloudflare OS
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: `J'ai analysé votre consigne : « ${inputSnapshot} ». J'ai déployé un nouveau bac à sable avec un Dynamic Worker Facet pour exécuter ce composant de manière isolée.`,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          logs: [
            'Gatekeeper: Simulation sécurisée validée',
            'Compilation TypeScript / Vite OK',
            'Instance Durable Object mise en cache locale',
          ],
        },
      ]);
    }, 800);
  };

  const handleLaunchPrompt = (text: string) => {
    setChatInput(text);
    setActiveTab('workspace');
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'user',
          text: text,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        },
        {
          sender: 'agent',
          text: `✨ Création du Gadget initiée avec le modèle ${selectedModel.toUpperCase()} ! Votre application est en cours de rendu interactif dans la zone de droite.`,
          time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          logs: ['Dynamic Worker Facet créé', 'Gatekeeper security checks: PASS'],
        },
      ]);
    }, 400);
  };

  return (
    <div className="relative flex flex-col md:flex-row h-full min-h-[calc(100vh-140px)] w-full bg-[#fcfcfb] dark:bg-[#090d16] text-[#1c1a18] dark:text-[#f1f5f9] font-sans overflow-hidden select-none transition-colors duration-200">
      
      {/* ========================================================================= */}
      {/* 1. BARRE LATÉRALE CLOUDFLARE OS (RAIL PERSISTANT)                         */}
      {/* ========================================================================= */}
      <aside
        className={`flex flex-col shrink-0 border-r border-[#1411100f] dark:border-white/10 bg-[#f8f8f7] dark:bg-[#0d1322] transition-all duration-200 z-20 ${
          sidebarCollapsed ? 'w-16' : 'w-full md:w-64'
        }`}
      >
        {/* En-tête de Marque Cloudflare OS */}
        <div className="flex h-14 shrink-0 items-center justify-between px-3 border-b border-[#1411100f] dark:border-white/10">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-[#ff4801] flex items-center justify-center text-white shadow-sm shrink-0">
              <Hexagon className="w-5 h-5 fill-white stroke-[#ff4801]" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-[#100f0d] dark:text-white">
                    Cloudflare OS
                  </span>
                  <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded-md bg-[#ff4801]/10 text-[#ff4801] border border-[#ff4801]/20">
                    v2.0
                  </span>
                </div>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">
                  AI Productivity OS
                </span>
              </div>
            )}
          </div>

          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white hover:bg-stone-200/60 dark:hover:bg-white/10 transition-colors"
            title={sidebarCollapsed ? 'Agrandir la barre' : 'Réduire la barre'}
          >
            {sidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Bouton Recherche / Palette de Commandes ⌘K */}
        {!sidebarCollapsed && (
          <div className="p-3 border-b border-[#1411100f] dark:border-white/10">
            <button
              onClick={() => setActiveTab('workspace')}
              className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-stone-200 dark:border-white/10 bg-white dark:bg-stone-900 text-xs text-stone-500 dark:text-stone-400 hover:border-[#ff4801]/50 shadow-xs transition-all"
            >
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5" />
                <span>Rechercher...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[10px] rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 border border-stone-300 dark:border-stone-700">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        {/* Liens de Navigation Principale */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {[
            { id: 'home' as const, label: 'Accueil (Launcher)', icon: Home, badge: 'Nouveau' },
            { id: 'workspace' as const, label: 'Espace de Travail', icon: MessageSquare, badge: 'Live' },
            { id: 'gadgets' as const, label: 'Mes Gadgets', icon: LayoutGrid, count: '4' },
            { id: 'blueprints' as const, label: 'Blueprints (Modèles)', icon: Layers, count: '5' },
            { id: 'gatekeepers' as const, label: 'Gatekeepers (Sécurité)', icon: Shield, count: '6' },
            { id: 'settings' as const, label: 'Paramètres & Modèles', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#ff4801] text-white shadow-sm'
                    : 'text-stone-700 dark:text-stone-300 hover:bg-stone-200/60 dark:hover:bg-white/5'
                }`}
                title={item.label}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-stone-500 dark:text-stone-400'}`} />
                {!sidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between overflow-hidden">
                    <span className="truncate text-left">{item.label}</span>
                    {item.badge && (
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.2 rounded-full ${
                        isActive ? 'bg-white/20 text-white' : 'bg-[#ff4801]/10 text-[#ff4801]'
                      }`}>
                        {item.badge}
                      </span>
                    )}
                    {item.count && !isActive && (
                      <span className="text-[11px] font-mono text-stone-400">
                        {item.count}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}

          {/* Section Récents & Favoris */}
          {!sidebarCollapsed && (
            <div className="pt-4 mt-3 border-t border-stone-200 dark:border-white/10">
              <span className="px-3 text-[10px] font-black uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Gadgets Récents
              </span>
              <div className="mt-1.5 space-y-0.5">
                {[
                  { name: 'Diapositives Q3 Planning', type: 'Slides', icon: Presentation },
                  { name: 'Morpion contre Llama 3', type: 'Jeu IA', icon: Gamepad2 },
                  { name: 'Dashboard Triage GitHub', type: 'Gatekeeper', icon: Zap },
                ].map((rec, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      if (rec.type === 'Slides') setActiveGadgetId('slides');
                      else setActiveGadgetId('tic-tac-toe');
                      setActiveTab('gadgets');
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-white/5 transition-colors cursor-pointer text-left truncate"
                  >
                    <rec.icon className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
                    <span className="truncate">{rec.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* Pied de Barre Latérale : Statut Gatekeeper & Edge Workers */}
        <div className="p-3 border-t border-[#1411100f] dark:border-white/10 bg-white/60 dark:bg-black/20">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            {!sidebarCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-stone-800 dark:text-stone-200 truncate">
                  Workers AI Edge Connecté
                </span>
                <span className="text-[10px] text-stone-500 dark:text-stone-400 truncate">
                  Sandboxes prêtes • 0ms cold start
                </span>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* ========================================================================= */}
      {/* 2. ZONE CENTRALE DE CONTENU SELON L'ONGLET ACTIF                           */}
      {/* ========================================================================= */}
      <main className="relative flex-1 flex flex-col h-full overflow-y-auto overflow-x-hidden min-h-[500px]">
        
        {/* ======================================================================= */}
        {/* ONGLET 1 : ACCUEIL / HERO LAUNCHER AVEC MESH BACKGROUND                 */}
        {/* ======================================================================= */}
        {activeTab === 'home' && (
          <div className="relative flex-1 flex flex-col items-center justify-start px-4 sm:px-8 py-8 md:py-12 z-10">
            {/* Grille hexagonale perspective Cloudflare OS */}
            <MeshBackground />

            {/* Hero Header */}
            <div className="w-full max-w-3xl text-center space-y-3 relative z-10 pt-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#ff4801]/10 text-[#ff4801] border border-[#ff4801]/20 text-xs font-bold">
                <Hexagon className="w-3.5 h-3.5 fill-[#ff4801]" />
                <span>Cloudflare OS • Environnement de Productivité IA</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#100f0d] dark:text-white">
                Que souhaitez-vous créer aujourd'hui ?
              </h1>
              <p className="text-sm sm:text-base text-stone-600 dark:text-stone-400 max-w-xl mx-auto font-medium">
                Demandez à l'agent de générer un Gadget autonome, d'extraire des insights de vos cours ou d'orchestrer un flux automatisé sécurisé par Gatekeepers.
              </p>
            </div>

            {/* Prompt Composer Cloudflare OS */}
            <div className="w-full max-w-3xl mt-8 relative z-10">
              <div className="bg-white dark:bg-[#121927] rounded-2xl border-2 border-stone-200 dark:border-white/10 shadow-xl overflow-hidden focus-within:border-[#ff4801] transition-all">
                
                {/* Barre d'options supérieures : Sélecteur de Modèle & Format */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 bg-stone-50 dark:bg-black/30 border-b border-stone-200 dark:border-white/10 text-xs">
                  {/* Sélecteur de Modèle */}
                  <div className="flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-[#ff4801]" />
                    <span className="font-bold text-stone-700 dark:text-stone-300">Modèle :</span>
                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value as any)}
                      className="bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-lg px-2 py-1 text-xs font-semibold cursor-pointer focus:outline-none"
                    >
                      <option value="workers-ai">Llama 3.3 70B (Cloudflare Workers AI)</option>
                      <option value="gemini-flash">Gemini 2.0 Flash (Multimodal)</option>
                      <option value="llama-vision">Llama 3.2 Vision (Documents & Schémas)</option>
                    </select>
                  </div>

                  {/* Format d'application */}
                  <div className="flex items-center gap-1">
                    {[
                      { id: 'gadget', label: 'Gadget Interactif', icon: LayoutGrid },
                      { id: 'slides', label: 'Slides', icon: Presentation },
                      { id: 'doc', label: 'Document', icon: FileText },
                      { id: 'workflow', label: 'Workflow', icon: Zap },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setSelectedFormat(fmt.id as any)}
                        className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                          selectedFormat === fmt.id
                            ? 'bg-[#ff4801] text-white shadow-xs'
                            : 'text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-white/10'
                        }`}
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Champ de saisie prompt */}
                <div className="p-4">
                  <textarea
                    rows={3}
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Exemple : « Crée une présentation interactive pour mes révisions », « Conçois un mini-jeu morpion », « Analyse ce cours et génère une fiche de synthèse »..."
                    className="w-full bg-transparent resize-none focus:outline-none text-sm text-stone-900 dark:text-white placeholder-stone-400 font-medium"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey && promptText.trim()) {
                        e.preventDefault();
                        handleLaunchPrompt(promptText);
                      }
                    }}
                  />

                  {/* Actions du bas */}
                  <div className="flex items-center justify-between pt-3 border-t border-stone-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPromptText('Crée un mini-jeu interactif morpion')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 border border-stone-200 dark:border-white/10 cursor-pointer"
                      >
                        <Gamepad2 className="w-3.5 h-3.5 text-[#ff4801]" />
                        <span>Morpion Sandbox</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPromptText('Génère un jeu de diapositives d\'équipe')}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/5 border border-stone-200 dark:border-white/10 cursor-pointer"
                      >
                        <Presentation className="w-3.5 h-3.5 text-[#ff4801]" />
                        <span>Slides Q3</span>
                      </button>
                    </div>

                    <button
                      onClick={() => handleLaunchPrompt(promptText || 'Crée un Gadget interactif')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ff4801] hover:bg-[#e03f00] text-white font-bold text-xs shadow-md transition-all cursor-pointer active:scale-95"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Lancer l'Agent</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Cartes de suggestions de tâches (HomeTaskSuggestions) */}
            <div className="w-full max-w-3xl mt-8 relative z-10">
              <span className="text-xs font-black uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-3 block text-left">
                Suggestions Prêtes à l'Emploi
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  {
                    title: 'Faire un deck de diapositives',
                    desc: 'Présentation structurée avec avancement, risques et décisions claires.',
                    icon: Presentation,
                    prompt: 'Crée un jeu de diapositives interactif pour réviser et planifier mes objectifs d\'étude.',
                  },
                  {
                    title: 'Bâtir un mini-outil interactif',
                    desc: 'Petite application, calculateur de notes ou widget autonome.',
                    icon: LayoutGrid,
                    prompt: 'Construis un outil interactif autonome de calcul et d\'optimisation de moyenne scolaire.',
                  },
                  {
                    title: 'Extraire des insights de données',
                    desc: 'Analyse narrative de tendances, anomalies et recommandations concrètes.',
                    icon: TrendingUp,
                    prompt: 'Prends ces données d\'exercice et transforme-les en analyse claire avec recommandations.',
                  },
                  {
                    title: 'Automatiser avec Gatekeeper',
                    desc: 'Déclenche un agent dès qu\'une modification ou fichier arrive.',
                    icon: Zap,
                    prompt: 'Configure un flux d\'automatisation avec le Gatekeeper Cloudflare pour synchroniser les fichiers.',
                  },
                  {
                    title: 'Mini-jeu morpion sandboxé',
                    desc: 'Une application dynamique jouable en temps réel contre l\'IA.',
                    icon: Gamepad2,
                    prompt: 'Lance le jeu du morpion interactif en direct contre l\'IA.',
                  },
                  {
                    title: 'Document de synthèse 1:1',
                    desc: 'Pré-lecture avec snapshot de progrès et questions clés.',
                    icon: FileText,
                    prompt: 'Rédige une fiche de synthèse complète pour mon prochain entretien de révision.',
                  },
                ].map((sugg, idx) => {
                  const SuggIcon = sugg.icon;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleLaunchPrompt(sugg.prompt)}
                      className="group flex flex-col p-3.5 bg-white/90 dark:bg-[#121927]/90 rounded-2xl border border-stone-200 dark:border-white/10 hover:border-[#ff4801] shadow-xs hover:shadow-md cursor-pointer transition-all active:scale-98 text-left"
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#ff4801]/10 text-[#ff4801] flex items-center justify-center mb-2.5 group-hover:bg-[#ff4801] group-hover:text-white transition-colors">
                        <SuggIcon className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-xs text-stone-900 dark:text-white group-hover:text-[#ff4801] transition-colors">
                        {sugg.title}
                      </h3>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1 leading-snug">
                        {sugg.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ONGLET 2 : ESPACE DE TRAVAIL & STUDIO MULTI-AGENTS EN DIRECT             */}
        {/* ======================================================================= */}
        {activeTab === 'workspace' && (
          <div className="flex-1 flex flex-col md:flex-row h-full min-h-[500px] overflow-hidden">
            
            {/* Panneau de Gauche : Chat avec l'Agent Cloudflare OS */}
            <div className="w-full md:w-1/2 flex flex-col h-full border-b md:border-b-0 md:border-r border-stone-200 dark:border-white/10 bg-white dark:bg-[#0c121e]">
              {/* Header de discussion */}
              <div className="p-3.5 border-b border-stone-200 dark:border-white/10 flex items-center justify-between bg-stone-50/80 dark:bg-black/20">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-[#ff4801] flex items-center justify-center text-white">
                    <Hexagon className="w-3.5 h-3.5 fill-white stroke-[#ff4801]" />
                  </div>
                  <span className="font-bold text-xs">Session Agent • Dynamic Facet</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-800">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Durable Object Connecté</span>
                </div>
              </div>

              {/* Flux de messages */}
              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm font-medium leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-[#ff4801] text-white rounded-br-xs shadow-sm'
                          : 'bg-[#f1f0ee] dark:bg-stone-800 text-stone-900 dark:text-stone-100 rounded-bl-xs border border-stone-200 dark:border-white/10'
                      }`}
                    >
                      <p>{m.text}</p>

                      {/* Logs d'exécution système Cloudflare OS */}
                      {m.logs && m.logs.length > 0 && (
                        <div className="mt-2.5 pt-2 border-t border-stone-300/60 dark:border-white/10 font-mono text-[10px] space-y-1 text-stone-600 dark:text-stone-400">
                          {m.logs.map((log, lIdx) => (
                            <div key={lIdx} className="flex items-center gap-1.5">
                              <Code2 className="w-3 h-3 text-[#ff4801]" />
                              <span>{log}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-stone-400 mt-1 px-1">{m.time}</span>
                  </div>
                ))}
              </div>

              {/* Entrée de saisie */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-stone-200 dark:border-white/10 bg-stone-50 dark:bg-black/30 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Instruire l'agent Cloudflare OS..."
                  className="flex-1 bg-white dark:bg-stone-800 border border-stone-300 dark:border-stone-700 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white focus:outline-none focus:border-[#ff4801]"
                />
                <button
                  type="submit"
                  className="p-2 rounded-xl bg-[#ff4801] hover:bg-[#e03f00] text-white transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* Panneau de Droite : Rendu Fidèle du Gadget Interactif (Sandbox) */}
            <div className="w-full md:w-1/2 flex flex-col h-full bg-[#f8f8f7] dark:bg-[#090d16]">
              {/* Header du Gadget */}
              <div className="p-3.5 border-b border-stone-200 dark:border-white/10 flex items-center justify-between bg-white dark:bg-[#101726]">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-[#ff4801]" />
                  <span className="font-bold text-xs text-stone-800 dark:text-stone-200">
                    Gadget Sandbox : {activeGadgetId === 'slides' ? 'Présentation Diapositives' : 'Morpion Interactif'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setActiveGadgetId('tic-tac-toe')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeGadgetId === 'tic-tac-toe'
                        ? 'bg-[#ff4801] text-white'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5'
                    }`}
                  >
                    Morpion
                  </button>
                  <button
                    onClick={() => setActiveGadgetId('slides')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                      activeGadgetId === 'slides'
                        ? 'bg-[#ff4801] text-white'
                        : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/5'
                    }`}
                  >
                    Slides
                  </button>
                </div>
              </div>

              {/* Rendu du Gadget en Direct */}
              <div className="flex-1 p-6 flex flex-col items-center justify-center overflow-y-auto">
                {activeGadgetId === 'tic-tac-toe' ? (
                  <div className="w-full max-w-sm bg-white dark:bg-[#121927] p-6 rounded-3xl border-2 border-stone-300 dark:border-stone-700 shadow-xl flex flex-col items-center">
                    <div className="flex items-center justify-between w-full mb-4 pb-2 border-b border-stone-200 dark:border-stone-800">
                      <span className="text-xs font-black uppercase text-[#ff4801]">Dynamic Facet Sandbox</span>
                      <button
                        onClick={resetTicTacToe}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Rejouer</span>
                      </button>
                    </div>

                    <div className="text-center mb-4">
                      {gameWinner ? (
                        <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                          {gameWinner === 'Égalité' ? 'Partie nulle !' : `Victoire de : ${gameWinner} 🎉`}
                        </div>
                      ) : (
                        <div className="text-xs font-bold text-stone-600 dark:text-stone-400">
                          À vous de jouer (X) contre l'Agent Cloudflare (O)
                        </div>
                      )}
                    </div>

                    {/* Grille 3x3 */}
                    <div className="grid grid-cols-3 gap-2.5 w-64 h-64">
                      {ticTacToeBoard.map((cell, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleTicTacToeCellClick(idx)}
                          disabled={!!cell || !!gameWinner}
                          className={`flex items-center justify-center rounded-2xl text-2xl font-black transition-all cursor-pointer border-2 ${
                            cell === 'X'
                              ? 'bg-[#ff4801]/10 text-[#ff4801] border-[#ff4801]'
                              : cell === 'O'
                              ? 'bg-blue-500/10 text-blue-500 border-blue-500'
                              : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-[#ff4801]/50'
                          }`}
                        >
                          {cell}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Gadget Slides Q3 */
                  <div className="w-full max-w-lg bg-white dark:bg-[#121927] p-8 rounded-3xl border-2 border-stone-300 dark:border-stone-700 shadow-xl flex flex-col justify-between min-h-[340px]">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#ff4801]/10 text-[#ff4801]">
                          {SLIDES_CONTENT[slideIndex].tag}
                        </span>
                        <span className="text-xs font-mono text-stone-400">
                          Slide {slideIndex + 1} / {SLIDES_CONTENT.length}
                        </span>
                      </div>

                      <h2 className="text-xl sm:text-2xl font-black text-stone-900 dark:text-white">
                        {SLIDES_CONTENT[slideIndex].title}
                      </h2>
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 mb-6 font-medium">
                        {SLIDES_CONTENT[slideIndex].subtitle}
                      </p>

                      <ul className="space-y-2.5">
                        {SLIDES_CONTENT[slideIndex].points.map((pt, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2.5 text-xs text-stone-700 dark:text-stone-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#ff4801] mt-1.5 shrink-0" />
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="flex items-center justify-between mt-8 pt-4 border-t border-stone-200 dark:border-stone-800">
                      <button
                        onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))}
                        disabled={slideIndex === 0}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-stone-100 dark:bg-stone-800 disabled:opacity-40 cursor-pointer"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() => setSlideIndex((prev) => Math.min(SLIDES_CONTENT.length - 1, prev + 1))}
                        disabled={slideIndex === SLIDES_CONTENT.length - 1}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#ff4801] text-white disabled:opacity-40 cursor-pointer"
                      >
                        Suivant
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ONGLET 3 : MES GADGETS (APPLICATIONS PRIVÉES EN BAC À SABLE)             */}
        {/* ======================================================================= */}
        {activeTab === 'gadgets' && (
          <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Mes Gadgets Privés</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Chaque gadget tourne dans son bac à sable étanche sur Cloudflare Workers. Vous seul y avez accès.
                </p>
              </div>
              <button
                onClick={() => setActiveTab('home')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ff4801] text-white text-xs font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Nouveau Gadget</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                {
                  id: 'tic-tac-toe',
                  title: 'Morpion contre l\'IA',
                  type: 'Jeu Interactif',
                  status: 'Actif • 0ms',
                  desc: 'Instance privée avec Dynamic Worker Facet pour jouer directement.',
                  icon: Gamepad2,
                },
                {
                  id: 'slides',
                  title: 'Présentation Q3 Planning',
                  type: 'Suite Bureautique',
                  status: 'Actif • DO v2',
                  desc: 'Jeu de diapositives avec révision de code et synchronisation locale.',
                  icon: Presentation,
                },
                {
                  id: 'whiteboard',
                  title: 'Tableau Blanc d\'Idées',
                  type: 'Collaboration',
                  status: 'En veille',
                  desc: 'Canvas vectoriel avec rendu temps réel pour diagrammes.',
                  icon: LayoutGrid,
                },
                {
                  id: 'data-analytics',
                  title: 'Analyseur de Données d\'Examen',
                  type: 'Outil Données',
                  status: 'En veille',
                  desc: 'Tableau de bord de calcul de notes et prévisions de mentions.',
                  icon: TrendingUp,
                },
              ].map((g) => {
                const GIcon = g.icon;
                return (
                  <div
                    key={g.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#121927] border border-stone-200 dark:border-white/10 shadow-xs hover:border-[#ff4801] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-[#ff4801]/10 text-[#ff4801] flex items-center justify-center">
                          <GIcon className="w-5 h-5" />
                        </div>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                          {g.status}
                        </span>
                      </div>
                      <h3 className="font-bold text-sm">{g.title}</h3>
                      <span className="text-[11px] font-semibold text-[#ff4801] block mb-2">{g.type}</span>
                      <p className="text-xs text-stone-500 dark:text-stone-400">{g.desc}</p>
                    </div>

                    <button
                      onClick={() => {
                        setActiveGadgetId(g.id);
                        setActiveTab('workspace');
                      }}
                      className="mt-5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-[#ff4801] hover:text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Ouvrir dans le Studio</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ONGLET 4 : BLUEPRINTS (MODÈLES & APPLICATIONS PARTAGÉES)                  */}
        {/* ======================================================================= */}
        {activeTab === 'blueprints' && (
          <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Blueprints (Modèles d'Apps)</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Les Blueprints sont du code réutilisable : lancez votre propre copie en un clic ou partagez la vôtre.
                </p>
              </div>
              <button
                onClick={() => handleLaunchPrompt('Publier un nouveau Blueprint d\'application')}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#ff4801] text-white text-xs font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>Publier un Blueprint</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {BLUEPRINTS.map((bp) => {
                const BpIcon = bp.icon;
                return (
                  <div
                    key={bp.id}
                    className="p-5 rounded-2xl bg-white dark:bg-[#121927] border border-stone-200 dark:border-white/10 shadow-xs hover:border-[#ff4801] transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-[#ff4801]/10 text-[#ff4801] flex items-center justify-center">
                            <BpIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-sm">{bp.title}</h3>
                            <span className="text-[11px] text-stone-400">{bp.category}</span>
                          </div>
                        </div>
                        <span className="text-xs font-mono text-stone-400">⬇ {bp.downloads}</span>
                      </div>

                      <p className="text-xs text-stone-600 dark:text-stone-300 mb-4">{bp.description}</p>

                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {bp.tags.map((t, tI) => (
                          <span
                            key={tI}
                            className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => handleLaunchPrompt(`Créer un gadget basé sur le Blueprint : ${bp.title}`)}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#ff4801] hover:bg-[#e03f00] text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Instancier ma copie privée</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ONGLET 5 : GATEKEEPERS (SÉCURITÉ & CAPABILITÉS EXTERNES)                  */}
        {/* ======================================================================= */}
        {activeTab === 'gatekeepers' && (
          <div className="flex-1 p-6 max-w-5xl mx-auto w-full">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-stone-200 dark:border-white/10">
              <div>
                <h2 className="text-2xl font-black tracking-tight">Gatekeepers & Sécurité par Capacités</h2>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  Les Gatekeepers agissent comme des pilotes pour les services externes (comme MCP amélioré) avec simulation des effets de bord.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GATEKEEPERS.map((gk) => (
                <div
                  key={gk.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#121927] border border-stone-200 dark:border-white/10 shadow-xs flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-[#ff4801]" />
                        <h3 className="font-bold text-sm">{gk.name}</h3>
                      </div>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        gk.status === 'connected'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                      }`}>
                        {gk.status === 'connected' ? 'Connecté' : 'Simulation'}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-stone-300 mb-4">{gk.description}</p>

                    <div className="space-y-1.5 mb-4">
                      <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 block">
                        Capacités accordées :
                      </span>
                      {gk.capabilities.map((cap, cI) => (
                        <div key={cI} className="flex items-center gap-2 text-xs font-mono text-stone-700 dark:text-stone-300">
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => handleLaunchPrompt(`Auditer et tester les permissions du Gatekeeper ${gk.name}`)}
                    className="w-full py-2 rounded-xl border border-stone-300 dark:border-stone-700 hover:border-[#ff4801] text-xs font-bold transition-colors cursor-pointer text-center"
                  >
                    Gérer les autorisations
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* ONGLET 6 : PARAMÈTRES & FOURNISSEURS D'IA                                */}
        {/* ======================================================================= */}
        {activeTab === 'settings' && (
          <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-6">
            <div className="pb-4 border-b border-stone-200 dark:border-white/10">
              <h2 className="text-2xl font-black tracking-tight">Paramètres Cloudflare OS</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Configurez les clés d'API, l'environnement d'exécution workerd et la politique des Gatekeepers.
              </p>
            </div>

            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-white dark:bg-[#121927] border border-stone-200 dark:border-white/10 space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#ff4801]" />
                  <span>Modèles de Langage & Inférence Edge</span>
                </h3>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800">
                    <div>
                      <span className="font-bold block">Cloudflare Workers AI (Llama 3.3 70B)</span>
                      <span className="text-[11px] text-stone-500">Exécution native sur les 300+ datacenters de Cloudflare</span>
                    </div>
                    <span className="text-emerald-500 font-bold">Actif (Défaut)</span>
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 dark:bg-stone-800">
                    <div>
                      <span className="font-bold block">Google Gemini 2.0 Flash</span>
                      <span className="text-[11px] text-stone-500">Multimodalité complète avec vision et audio</span>
                    </div>
                    <span className="text-emerald-500 font-bold">Connecté</span>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl bg-white dark:bg-[#121927] border border-stone-200 dark:border-white/10 space-y-4">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#ff4801]" />
                  <span>Politique de Sécurité Gatekeeper</span>
                </h3>
                <div className="space-y-2 text-xs text-stone-600 dark:text-stone-300">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#ff4801] w-4 h-4 rounded" />
                    <span>Activer la simulation locale automatique des effets de bord</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#ff4801] w-4 h-4 rounded" />
                    <span>Isoler chaque Gadget dans un Dynamic Worker Facet dédié</span>
                  </label>
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" defaultChecked className="accent-[#ff4801] w-4 h-4 rounded" />
                    <span>Journaliser les appels RPC Cap'n Web</span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
