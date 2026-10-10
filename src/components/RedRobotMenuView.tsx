import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  ExternalLink, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Check, 
  Settings,
  Radio, 
  Cpu, 
  ShieldCheck, 
  Sparkles,
  Layers,
  Globe,
  UserCheck
} from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { getCurrentUserId } from '../services/userSync';

interface RedRobotMenuViewProps {
  onBack: () => void;
}

const DEFAULT_CLOUDFLARE_URL = 'https://router.delmaskouassidibi.workers.dev';

export const RedRobotMenuView: React.FC<RedRobotMenuViewProps> = ({ onBack }) => {
  const [serverUrl, setServerUrl] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_cloudflare_os_url') : null;
    if (!saved || saved.includes('localhost') || saved.includes('127.0.0.1')) {
      return DEFAULT_CLOUDFLARE_URL;
    }
    return saved;
  });
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [tempUrl, setTempUrl] = useState<string>(serverUrl);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);
  const [activeView, setActiveView] = useState<'app' | 'admin'>('app');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Récupérer l'identité de l'utilisateur StudyCloud connecté
  const currentUserId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || 'etudiant';
  const currentUserName = (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_name') : '') || 'Étudiant StudyCloud';
  const currentUserEmail = (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_email') : '') || '';

  // URL enrichie avec les identifiants StudyCloud pour Single Sign-On (SSO) transparent
  const authenticatedIframeUrl = React.useMemo(() => {
    try {
      const url = new URL(serverUrl);
      if (activeView === 'admin') {
        url.pathname = '/admin';
      }
      url.searchParams.set('sc_user_id', currentUserId);
      url.searchParams.set('sc_user_name', currentUserName);
      if (currentUserEmail) {
        url.searchParams.set('sc_user_email', currentUserEmail);
      }
      return url.toString();
    } catch {
      const sep = serverUrl.includes('?') ? '&' : '?';
      return `${serverUrl}${sep}sc_user_id=${encodeURIComponent(currentUserId)}&sc_user_name=${encodeURIComponent(currentUserName)}`;
    }
  }, [serverUrl, currentUserId, currentUserName, currentUserEmail, activeView]);

  // Vérifier la disponibilité de l'URL Cloudflare Edge
  const checkServerStatus = async () => {
    setIsChecking(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      await fetch(serverUrl, { 
        mode: 'no-cors', 
        cache: 'no-store',
        signal: controller.signal 
      });
      clearTimeout(timeoutId);
      setIsOnline(true);
    } catch {
      // Si la requête échoue
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkServerStatus();
    // Sonde régulière toutes les 30 secondes pour surveiller la connectivité Edge
    const interval = setInterval(() => {
      checkServerStatus();
    }, 30000);
    return () => clearInterval(interval);
  }, [serverUrl]);

  const handleRefreshIframe = () => {
    setIsLoadingIframe(true);
    setIframeKey(prev => prev + 1);
    checkServerStatus();
  };

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = tempUrl.trim().replace(/\/+$/, '') || DEFAULT_CLOUDFLARE_URL;
    setServerUrl(cleanUrl);
    localStorage.setItem('studycloud_cloudflare_os_url', cleanUrl);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowSettings(false);
    }, 1500);
    setIsLoadingIframe(true);
    setIframeKey(prev => prev + 1);
  };

  const handleResetDefaultUrl = () => {
    setTempUrl(DEFAULT_CLOUDFLARE_URL);
    setServerUrl(DEFAULT_CLOUDFLARE_URL);
    localStorage.removeItem('studycloud_cloudflare_os_url');
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      setShowSettings(false);
    }, 1500);
    setIsLoadingIframe(true);
    setIframeKey(prev => prev + 1);
  };

  return (
    <div className={`absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] bg-[#090d16] text-[#f1f5f9] flex flex-col min-h-[calc(100vh-66px)] transition-all duration-300 overflow-hidden ${
      isFullscreen ? 'fixed inset-0 top-0 left-0 z-50 md:left-0 md:w-full min-h-screen' : ''
    }`}>
      {/* Barre supérieure avec bouton Retour et statut Cloudflare Serverless */}
      <div className="w-full flex flex-wrap items-center justify-between px-3 sm:px-6 py-2.5 bg-[#0d1322] border-b border-white/10 shrink-0 z-30 gap-2 shadow-md">
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
              Studio IA <span className="text-[#ff4801] font-black">StudyCloud</span>
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/25 flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Connecté
            </span>
          </div>

          {/* Badge Utilisateur StudyCloud connecté */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900 border border-stone-800 text-xs text-stone-300">
            <UserCheck className="w-3.5 h-3.5 text-[#ff4801]" />
            <span className="font-semibold text-white truncate max-w-[150px]">{currentUserName}</span>
          </div>

          {/* Bascule Accueil Studio vs Tableau de bord Admin */}
          <div className="flex items-center gap-1 bg-stone-900/90 p-1 rounded-xl border border-stone-800">
            <button
              onClick={() => { setActiveView('app'); setIsLoadingIframe(true); }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeView === 'app'
                  ? 'bg-[#ff4801] text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Studio IA (Accueil)
            </button>
            <button
              onClick={() => { setActiveView('admin'); setIsLoadingIframe(true); }}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'admin'
                  ? 'bg-[#ff4801] text-white shadow-xs'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
              title="Configurer les modèles d'IA pour tous les utilisateurs"
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Tableau de bord Admin</span>
            </button>
          </div>
        </div>

        {/* Indicateur d'état et commandes de contrôle */}
        <div className="flex items-center gap-2">
          {/* Badge de statut Edge Serverless */}
          <div 
            onClick={checkServerStatus}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs cursor-pointer hover:border-white/20 transition-colors"
            title="Cliquez pour re-tester la connexion Cloudflare Edge"
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
            <span className="font-mono text-[11px] text-stone-300 hidden sm:inline">
              {isOnline 
                ? 'Cloudflare Edge (En ligne)' 
                : isChecking 
                  ? 'Vérification...' 
                  : 'Connexion interrompue'}
            </span>
          </div>

          {/* Bouton paramètres d'URL */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
              showSettings 
                ? 'bg-[#ff4801]/20 text-[#ff7a45] border-[#ff4801]/40' 
                : 'bg-stone-800 hover:bg-stone-700 text-stone-300 border-stone-700'
            }`}
            title="Configurer l'URL du service Cloudflare"
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Bouton rafraîchir */}
          <button
            onClick={handleRefreshIframe}
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors cursor-pointer"
            title="Rafraîchir Cloudflare OS"
          >
            <RefreshCw className={`w-4 h-4 ${isChecking || isLoadingIframe ? 'animate-spin text-[#ff4801]' : ''}`} />
          </button>

          {/* Bouton ouvrir dans un nouvel onglet */}
          <a
            href={serverUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700 transition-colors"
            title={`Ouvrir dans un nouvel onglet (${serverUrl})`}
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

      {/* Popover / Panneau des Paramètres d'URL Cloudflare */}
      {showSettings && (
        <div className="w-full bg-[#0d1424] border-b border-stone-800 p-4 shrink-0 z-40 animate-in fade-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSaveUrl} className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <label className="block text-xs font-semibold text-stone-300 mb-1">
                URL du service Cloudflare Edge :
              </label>
              <input
                type="url"
                value={tempUrl}
                onChange={(e) => setTempUrl(e.target.value)}
                placeholder="https://router.delmaskouassidibi.workers.dev"
                className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-stone-200 font-mono text-xs focus:outline-hidden focus:border-[#ff4801]"
              />
            </div>
            <div className="flex items-center gap-2 mt-auto w-full sm:w-auto">
              <button
                type="submit"
                className="flex-1 sm:flex-none px-4 py-2 bg-[#ff4801] hover:bg-[#ff5714] text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Enregistré !</span>
                  </>
                ) : (
                  <span>Valider</span>
                )}
              </button>
              <button
                type="button"
                onClick={handleResetDefaultUrl}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded-xl border border-stone-700 transition-colors cursor-pointer"
                title="Rétablir l'URL officielle déployée"
              >
                Par défaut
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-3 py-2 bg-stone-800 hover:bg-stone-700 text-stone-400 text-xs rounded-xl border border-stone-700 transition-colors cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Zone principale : Affichage de Cloudflare OS en direct */}
      <div className="flex-1 w-full overflow-hidden flex flex-col relative bg-[#060a12]">
        {/* Loader pendant le chargement initial de l'iframe */}
        {isLoadingIframe && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070b14]/90 backdrop-blur-xs pointer-events-none transition-opacity duration-300">
            <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl flex flex-col items-center gap-3">
              <DelmasRobot size={48} variant="red" floating={true} />
              <div className="flex items-center gap-2 text-stone-300 text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#ff4801]" />
                <span>Chargement de Cloudflare OS...</span>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full flex flex-col relative">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={authenticatedIframeUrl}
            title="Cloudflare OS - Studio IA StudyCloud"
            onLoad={() => {
              setIsLoadingIframe(false);
              if (iframeRef.current?.contentWindow) {
                iframeRef.current.contentWindow.postMessage({
                  type: 'STUDYCLOUD_AUTH',
                  userId: currentUserId,
                  userName: currentUserName,
                  userEmail: currentUserEmail
                }, '*');
              }
            }}
            className="w-full h-full flex-1 border-0"
            allow="clipboard-read; clipboard-write; camera; microphone; fullscreen; payment"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads"
          />
        </div>
      </div>
    </div>
  );
};
