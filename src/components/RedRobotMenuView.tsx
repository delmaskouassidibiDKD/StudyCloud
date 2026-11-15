import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  UserCheck
} from 'lucide-react';
import { DelmasRobot } from './DelmasRobot';
import { getCurrentUserId } from '../services/userSync';
import { ViewerSuperExpandButton } from './ViewerSuperExpandButton';
import { useViewerExpandLevel, setViewerExpandLevel, resetViewerExpand } from '../utils/viewerExpandManager';

interface RedRobotMenuViewProps {
  onBack: () => void;
}

const DEFAULT_CLOUDFLARE_URL = 'https://router.delmaskouassidibi.workers.dev';

export const RedRobotMenuView: React.FC<RedRobotMenuViewProps> = ({ onBack }) => {
  const [serverUrl] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_cloudflare_os_url') : null;
    if (!saved || saved.includes('localhost') || saved.includes('127.0.0.1')) {
      return DEFAULT_CLOUDFLARE_URL;
    }
    return saved;
  });
  const [iframeKey, setIframeKey] = useState<number>(0);
  const [isLoadingIframe, setIsLoadingIframe] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const viewerExpandLevel = useViewerExpandLevel();

  // Nettoyage complet de l'agrandissement au démontage du composant
  useEffect(() => {
    return () => {
      resetViewerExpand();
    };
  }, []);

  // Gestion de la touche Échap pour réduire la vue
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (viewerExpandLevel >= 1) {
          resetViewerExpand();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [viewerExpandLevel]);

  // Récupérer l'identité de l'utilisateur StudyCloud connecté
  const currentUserId = getCurrentUserId() || (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_id') : '') || 'etudiant';
  const currentUserName = (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_name') : '') || 'Étudiant StudyCloud';
  const currentUserEmail = (typeof localStorage !== 'undefined' ? localStorage.getItem('unifolder_user_email') : '') || '';

  // URL enrichie avec les identifiants StudyCloud pour Single Sign-On (SSO) transparent vers l'accueil Studio
  const authenticatedIframeUrl = React.useMemo(() => {
    try {
      const url = new URL(serverUrl);
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
  }, [serverUrl, currentUserId, currentUserName, currentUserEmail]);

  const handleRefreshIframe = () => {
    setIsLoadingIframe(true);
    setIframeKey(prev => prev + 1);
  };

  const handleBack = () => {
    resetViewerExpand();
    onBack();
  };

  return (
    <div
      className={`w-full flex-1 flex flex-col bg-[#090d16] text-[#f1f5f9] transition-all duration-300 overflow-hidden ${
        viewerExpandLevel >= 2
          ? 'fixed inset-0 z-50 w-screen h-screen min-h-screen'
          : viewerExpandLevel === 1
            ? 'relative w-full h-dvh min-h-dvh'
            : 'relative w-full h-[calc(100dvh-64px)] md:h-[calc(100dvh-68px)]'
      }`}
    >
      {/* En-tête compact et moderne (une seule ligne sur mobile comme sur PC) */}
      <div className="w-full h-11 sm:h-12 flex items-center justify-between px-2.5 sm:px-4 bg-[#0d1322] border-b border-white/10 shrink-0 z-30 shadow-md select-none">
        {/* Partie gauche : Bouton retour compact + Titre Studio IA */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 bg-stone-800/90 hover:bg-stone-700 text-stone-200 font-bold text-xs rounded-xl border border-stone-700/80 shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
            title="Retour à l'accueil"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="leading-none">Retour</span>
          </button>

          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-xl bg-stone-900 border border-stone-800/80 shadow-2xs shrink-0">
            <DelmasRobot size={18} variant="red" floating={false} />
            <span className="text-xs font-bold text-stone-200 tracking-tight whitespace-nowrap">
              Studio IA <span className="text-[#ff4801] font-black hidden xs:inline">StudyCloud</span>
            </span>
          </div>

          {/* Badge Utilisateur connecté (visible sur grands écrans) */}
          <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-stone-900/80 border border-stone-800 text-xs text-stone-300">
            <UserCheck className="w-3.5 h-3.5 text-[#ff4801] shrink-0" />
            <span className="font-semibold text-white truncate max-w-[140px]">{currentUserName}</span>
          </div>
        </div>

        {/* Partie droite : Bouton rafraîchir + Bouton super-agrandir (PC) + Bouton zoom deux flèches */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Bouton rafraîchir */}
          <button
            onClick={handleRefreshIframe}
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-stone-800 hover:bg-stone-700 text-stone-300 flex items-center justify-center border border-stone-700 transition-colors cursor-pointer shrink-0 active:scale-95"
            title="Rafraîchir"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingIframe ? 'animate-spin text-[#ff4801]' : ''}`} />
          </button>

          {/* Bouton Super Agrandissement Progressif (Desktop uniquement, Image 3) */}
          <ViewerSuperExpandButton
            expandLevel={viewerExpandLevel}
            onExpandChange={(lvl) => {
              if (viewerExpandLevel >= 2) {
                setViewerExpandLevel(1);
              } else {
                setViewerExpandLevel(2);
              }
            }}
          />

          {/* Bouton Zoom 2 flèches opposées (Image 3) */}
          <button
            type="button"
            onClick={() => {
              const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
              if (isMobile) {
                // Sur téléphone : bascule plein écran (masque le header du robot bleu et monte tout en haut)
                if (viewerExpandLevel >= 1) {
                  resetViewerExpand();
                } else {
                  setViewerExpandLevel(2);
                }
              } else {
                // Sur ordinateur : clic 1 prend l'espace du milieu et monte à la place du robot bleu (niveau 1)
                if (viewerExpandLevel >= 1) {
                  resetViewerExpand();
                } else {
                  setViewerExpandLevel(1);
                }
              }
            }}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center border transition-all cursor-pointer shadow-sm active:scale-95 shrink-0 ${
              viewerExpandLevel >= 1
                ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-400 ring-2 ring-blue-400/40'
                : 'bg-black/60 hover:bg-blue-600/80 text-white border-white/10'
            }`}
            title={
              viewerExpandLevel >= 1
                ? "Réduire"
                : (typeof window !== 'undefined' && window.innerWidth < 768 ? "Plein écran" : "Agrandir l'espace central")
            }
          >
            {viewerExpandLevel >= 1 ? (
              <Minimize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 stroke-[2.2]" />
            )}
          </button>
        </div>
      </div>

      {/* Zone principale : Affichage de l'iframe Studio IA */}
      <div className="flex-1 w-full overflow-hidden flex flex-col relative bg-[#060a12] min-h-0">
        {/* Loader pendant le chargement de l'iframe */}
        {isLoadingIframe && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#070b14]/90 backdrop-blur-xs pointer-events-none transition-opacity duration-300">
            <div className="p-4 bg-stone-900/90 border border-stone-800 rounded-2xl shadow-xl flex flex-col items-center gap-3">
              <DelmasRobot size={48} variant="red" floating={true} />
              <div className="flex items-center gap-2 text-stone-300 text-xs font-semibold">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#ff4801]" />
                <span>Chargement du Studio IA...</span>
              </div>
            </div>
          </div>
        )}

        <div className="w-full h-full flex flex-col relative flex-1 min-h-0">
          <iframe
            key={iframeKey}
            ref={iframeRef}
            src={authenticatedIframeUrl}
            title="Studio IA StudyCloud"
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
