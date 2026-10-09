import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Terminal, 
  Check, 
  Copy, 
  Radio, 
  Cpu, 
  ShieldCheck, 
  Play, 
  Sparkles,
  Layers
} from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';

interface RedRobotMenuViewProps {
  onBack: () => void;
}

export const RedRobotMenuView: React.FC<RedRobotMenuViewProps> = ({ onBack }) => {
  const [serverUrl, setServerUrl] = useState('http://localhost:8787');
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [forceDisplayIframe, setForceDisplayIframe] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Vérifier si le serveur local Cloudflare OS (http://localhost:8787) répond
  const checkServerStatus = async () => {
    setIsChecking(true);
    try {
      // mode: 'no-cors' permet de tester si le port 8787 écoute sans être bloqué par CORS
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      await fetch(serverUrl, { 
        mode: 'no-cors', 
        cache: 'no-store',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      setIsOnline(true);
    } catch {
      // Si la requête échoue ou timeout
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
    // Sonde régulière toutes les 5 secondes pour basculer automatiquement dès que le serveur démarre
    const interval = setInterval(() => {
      checkServerStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRefreshIframe = () => {
    setIframeKey(prev => prev + 1);
    checkServerStatus();
  };

  return (
    <div className={`absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#090d16] text-[#f1f5f9] flex flex-col min-h-[calc(100vh-66px)] transition-all duration-300 overflow-hidden ${
      isFullscreen ? 'fixed inset-0 top-0 left-0 z-50 md:left-0 md:w-full min-h-screen' : ''
    }`}>
      {/* Barre supérieure avec bouton Retour et statut du serveur */}
      <div className="w-full flex flex-wrap items-center justify-between px-3 sm:px-6 py-2.5 bg-[#0d1322] border-b border-white/10 shrink-0 z-30 gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-3 sm:px-4 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-bold text-xs sm:text-sm rounded-xl border border-stone-700 shadow-xs transition-all cursor-pointer active:scale-95"
            title="Retour à l'écran d'accueil StudyCloud"
          >
            <ArrowLeft className="w-4 h-4 text-[#ff4801]" />
            <span>Retour à l'accueil</span>
          </button>

          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-stone-900 border border-stone-800 shadow-2xs">
            <DelmasRobot size={22} variant="red" floating={true} />
            <span className="text-xs font-bold text-stone-200">
              Cloudflare OS <span className="text-[#ff4801] font-black">v2</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#ff4801]/20 text-[#ff7a45] font-semibold">
              Dépôt Officiel
            </span>
          </div>
        </div>

        {/* Indicateur d'état et commandes de contrôle */}
        <div className="flex items-center gap-2">
          {/* Badge de statut du serveur */}
          <div 
            onClick={checkServerStatus}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/40 border border-white/10 text-xs cursor-pointer hover:border-white/20 transition-colors"
            title="Cliquez pour re-tester la connexion locale"
          >
            <span className="relative flex h-2.5 w-2.5">
              {isOnline ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </>
              ) : isChecking ? (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400 animate-pulse"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              )}
            </span>
            <span className="font-mono text-[11px] text-stone-300">
              {isOnline 
                ? 'localhost:8787 (En ligne)' 
                : isChecking 
                  ? 'Vérification...' 
                  : 'Serveur local arrêté'}
            </span>
          </div>

          {/* Bouton rafraîchir */}
          <button
            onClick={handleRefreshIframe}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
            title="Rafraîchir Cloudflare OS"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking ? 'animate-spin text-[#ff4801]' : ''}`} />
          </button>

          {/* Bouton ouvrir dans un nouvel onglet */}
          <a
            href={serverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors"
            title="Ouvrir dans un nouvel onglet (http://localhost:8787)"
          >
            <ExternalLink className="w-4 h-4 text-[#ff7a45]" />
          </a>

          {/* Bascule plein écran */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
            title={isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Zone principale : Affichage de Cloudflare OS ou Écran de démarrage */}
      <div className="flex-1 w-full overflow-hidden flex flex-col relative bg-[#060a12]">
        {isOnline || forceDisplayIframe ? (
          <div className="w-full h-full flex flex-col relative">
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src={serverUrl}
              title="Cloudflare OS v2"
              className="w-full h-full flex-1 border-0"
              allow="clipboard-read; clipboard-write; camera; microphone; fullscreen; payment"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
            />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex flex-col items-center justify-center">
            <div className="max-w-2xl w-full bg-[#0c1220]/90 border border-stone-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden text-center">
              {/* Effet lumineux d'arrière-plan */}
              <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-[#ff4801]/15 rounded-full blur-3xl pointer-events-none" />

              {/* Avatar Robot & Cloudflare */}
              <div className="flex items-center justify-center gap-4 mb-5">
                <div className="p-3 bg-stone-900 border border-stone-800 rounded-2xl shadow-lg">
                  <DelmasRobot size={54} variant="red" floating={true} />
                </div>
              </div>

              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
                Cloudflare OS <span className="text-[#ff4801]">v2</span>
              </h2>
              <p className="text-sm text-stone-400 mb-6 max-w-lg mx-auto">
                Le véritable environnement de productivité IA <span className="text-white font-medium">cloudflare/cloudflare-os</span> est intégré directement dans ce menu.
              </p>

              {/* Guide de lancement rapide */}
              <div className="bg-[#070b14] border border-stone-800/80 rounded-2xl p-4 sm:p-5 text-left mb-6 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-stone-300 flex items-center gap-1.5">
                    <Terminal className="w-4 h-4 text-[#ff4801]" />
                    Commande pour exécuter Cloudflare OS en local :
                  </span>
                  <button
                    onClick={() => copyCommand('cd cloudflare-os && pnpm run-local')}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg border border-stone-700 transition-colors cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400 font-bold">Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-stone-400" />
                        <span>Copier</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="font-mono text-xs sm:text-sm bg-black/60 p-3 rounded-xl border border-white/5 text-[#ff7a45] overflow-x-auto select-all">
                  cd cloudflare-os && pnpm run-local
                </div>

                <p className="text-[11px] text-stone-500 mt-2.5 flex items-center gap-1.5">
                  <Play className="w-3 h-3 text-[#ff4801]" />
                  Ce script exécute l'ensemble de la pile localement sur <strong>wrangler</strong> et <strong>workerd</strong> sur le port <strong>8787</strong>.
                </p>
              </div>

              {/* Boutons d'action */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={checkServerStatus}
                  className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#ff4801] to-[#e03f00] hover:from-[#ff5714] hover:to-[#e03f00] text-white font-bold text-sm shadow-lg shadow-[#ff4801]/25 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-95"
                >
                  <Radio className={`w-4 h-4 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Recherche du serveur...' : 'Vérifier la connexion (localhost:8787)'}</span>
                </button>

                <button
                  onClick={() => setForceDisplayIframe(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-300 font-semibold text-sm border border-stone-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                  title="Afficher la fenêtre si le serveur est déjà lancé"
                >
                  <ExternalLink className="w-4 h-4 text-stone-400" />
                  <span>Forcer l'affichage</span>
                </button>
              </div>

              {/* Présentation des fonctionnalités clés */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-8 pt-6 border-t border-stone-800/80 text-left">
                <div className="p-3 bg-stone-900/50 rounded-xl border border-stone-800">
                  <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-[#ff4801]" />
                    <span>Gadgets Sandboxés</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Chaque utilisateur exécute une instance privée et sécurisée de ses applications générées par IA.
                  </p>
                </div>

                <div className="p-3 bg-stone-900/50 rounded-xl border border-stone-800">
                  <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Gatekeepers</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Contrôle des accès, simulation d'actions et approbation humaine sans blocage.
                  </p>
                </div>

                <div className="p-3 bg-stone-900/50 rounded-xl border border-stone-800">
                  <div className="flex items-center gap-2 text-white font-bold text-xs mb-1">
                    <Layers className="w-3.5 h-3.5 text-blue-400" />
                    <span>Blueprints</span>
                  </div>
                  <p className="text-[11px] text-stone-400">
                    Modèles complets pour générer des diapositives, tableaux blancs et outils sur mesure.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
