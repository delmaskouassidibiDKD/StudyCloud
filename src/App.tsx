import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { FolderCard } from './components/FolderCard';
import { UploadModal } from './components/UploadModal';
import { FolderDetailModal } from './components/FolderDetailModal';
import { QRCodeModal } from './components/QRCodeModal';
import { SharePortalView } from './components/SharePortalView';
import { LibraryView } from './components/LibraryView';
import { FoldersView } from './components/FoldersView';
import { UploadView } from './components/UploadView';
import { SharedLinksView } from './components/SharedLinksView';
import { SettingsView } from './components/SettingsView';
import { CreateShareLinkModal } from './components/CreateShareLinkModal';
import { PublishFileView } from './components/PublishFileView';
import { INITIAL_FOLDERS } from './data/initialData';
import { SharedFolder, NavigationTab } from './types';
import { X, FolderPlus, Upload, ArrowLeft, Download, Share2, ArrowLeftRight, Maximize, Minimize, Dna, Menu, Clock, Mic, Loader2 } from 'lucide-react';
import { FileIconBadge } from './components/FileIconBadge';
import { AssistantChat } from './components/AssistantChat';
import { DnaLogo } from './components/DnaLogo';
import { LeftMenu } from './components/LeftMenu';
import { CenterMenu } from './components/CenterMenu';
import { RightMenu } from './components/RightMenu';
import { StudyTimerModal, formatTimerDisplay } from './components/StudyTimerModal';
import { StudyCloudAPI, generateCleanShareCode, getWorkerApiUrl } from './services/api';
import { getFileBlob, storeFileBlob } from './services/localFileStorage';
import { buildSharedLinkFileKey } from './services/storageUtils';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingPage } from './components/auth/OnboardingPage';
import { GoogleSecuritySetupPage } from './components/auth/GoogleSecuritySetupPage';

// Utilitaire de sécurisation du stockage local pour éviter l'erreur "QuotaExceededError" (5MB max)
export const sanitizeFoldersForStorage = (foldersList: SharedFolder[]): SharedFolder[] => {
  if (!Array.isArray(foldersList)) return [];
  return foldersList.map((folder) => ({
    ...folder,
    qrCodeData: folder.qrCodeData && folder.qrCodeData.length > 500 ? undefined : folder.qrCodeData,
    files: (folder.files || []).map((file) => ({
      id: file.id,
      name: file.name,
      size: file.size,
      type: file.type,
      // Ne JAMAIS persister de data URL base64 dans le stockage local pour éviter l'erreur de dépassement de quota
      url: file.url && !file.url.startsWith('data:') ? file.url : '',
      r2Key: file.r2Key || undefined,
    })),
  }));
};

export default function App() {
  const { user, isAuthenticated, isLoading: authLoading, needsOnboarding, needsSecuritySetup, loginWithToken } = useAuth();

  // Détecter immédiatement à l'initialisation si l'URL contient un retour Google OAuth ou une confirmation email
  const [isProcessingAuth, setIsProcessingAuth] = useState<string | null>(() => {
    try {
      const p = new URLSearchParams(window.location.search);
      if (p.get('code')) return 'Connexion sécurisée avec votre compte Google en cours...';
      if (p.get('verify_token') || (p.get('verified') === '1' && p.get('token'))) return 'Validation de votre adresse email en cours...';
    } catch {}
    return null;
  });

  // Gérer le callback Google OAuth et la confirmation email (verify_token ou redirect)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const googleCode = urlParams.get('code');
    const verifyToken = urlParams.get('verify_token');
    const verified = urlParams.get('verified');
    const authToken = urlParams.get('token');

    // Détection d'un lien d'invitation / parrainage (?ref=171765542 ou hash #register)
    const refParam = urlParams.get('ref') || urlParams.get('referral') || urlParams.get('code_parrainage') || urlParams.get('code');
    if (refParam) {
      sessionStorage.setItem('sc_referral_code', refParam.trim());
      localStorage.removeItem('sc_referral_code'); // Nettoyage de l'ancien stockage permanent
      localStorage.setItem('sc_auth_redirect_mode', 'register');
      window.dispatchEvent(new Event('studycloud_auth_redirect'));
    }

    if (googleCode && !isAuthenticated) {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const action = urlParams.get('state') || localStorage.getItem('sc_google_auth_mode') || 'login';
      const savedReferral = sessionStorage.getItem('sc_referral_code') || undefined;
      localStorage.removeItem('sc_google_auth_mode');
      window.history.replaceState({}, '', window.location.pathname);
      StudyCloudAPI.googleAuth({ code: googleCode, redirectUri, action, referralCode: savedReferral })
        .then((res: any) => {
          if (res.success && res.token && res.user) {
            loginWithToken(res.token, res.user);
          } else if (res.userNotFound || res.code === 'USER_NOT_FOUND') {
            localStorage.setItem('sc_auth_redirect_mode', 'register');
            localStorage.setItem('sc_auth_redirect_notice', res.error || "Aucun compte associé à cette adresse Google n'a été trouvé. Nous vous avons orienté vers l'inscription : complétez vos informations ci-dessous pour créer votre compte en quelques secondes !");
            if (res.googleEmail) localStorage.setItem('sc_auth_prefill_email', res.googleEmail);
            if (res.googleName) localStorage.setItem('sc_auth_prefill_name', res.googleName);
            window.dispatchEvent(new Event('studycloud_auth_redirect'));
          }
        })
        .catch((err: any) => {
          if (err.userNotFound || err.status === 404 || err.data?.userNotFound) {
            const data = err.data || {};
            localStorage.setItem('sc_auth_redirect_mode', 'register');
            localStorage.setItem('sc_auth_redirect_notice', data.error || err.message || "Aucun compte associé à cette adresse Google n'a été trouvé. Nous vous avons orienté vers l'inscription : complétez vos informations ci-dessous pour créer votre compte en quelques secondes !");
            if (data.googleEmail) localStorage.setItem('sc_auth_prefill_email', data.googleEmail);
            if (data.googleName) localStorage.setItem('sc_auth_prefill_name', data.googleName);
            window.dispatchEvent(new Event('studycloud_auth_redirect'));
          } else {
            console.error(err);
          }
        })
        .finally(() => {
          setIsProcessingAuth(null);
        });
    } else if (urlParams.get('verify_error') === 'expired') {
      window.history.replaceState({}, '', window.location.pathname);
      localStorage.setItem('sc_verification_expired_notice', 'Votre lien de confirmation a expiré (validité 70 secondes). Veuillez réclamer un nouveau lien ci-dessous.');
      setIsProcessingAuth(null);
      window.dispatchEvent(new Event('studycloud_auth_redirect'));
    } else if (verifyToken) {
      // Confirmation directe par token dans l'URL (depuis le bouton de l'email)
      window.history.replaceState({}, '', window.location.pathname);
      StudyCloudAPI.verifyEmail(verifyToken)
        .then((res: any) => {
          if (res.success && res.token && res.user) {
            localStorage.removeItem('sc_pending_verification_email');
            localStorage.removeItem('sc_pending_verification_is_login');
            loginWithToken(res.token, res.user);
          } else {
            localStorage.setItem('sc_verification_expired_notice', res.error || 'Votre lien de confirmation a expiré (validité 70 secondes). Veuillez réclamer un nouveau lien ci-dessous.');
            window.dispatchEvent(new Event('studycloud_auth_redirect'));
          }
        })
        .catch((err: any) => {
          console.error(err);
          localStorage.setItem('sc_verification_expired_notice', err.message || 'Votre lien de confirmation a expiré (validité 70 secondes). Veuillez réclamer un nouveau lien ci-dessous.');
          window.dispatchEvent(new Event('studycloud_auth_redirect'));
        })
        .finally(() => {
          setIsProcessingAuth(null);
        });
    } else if (verified === '1' && authToken) {
      // Redirection après validation depuis le Worker
      localStorage.removeItem('sc_pending_verification_email');
      localStorage.removeItem('sc_pending_verification_is_login');
      window.history.replaceState({}, '', window.location.pathname);
      StudyCloudAPI.getMe(authToken)
        .then((res: any) => {
          if (res.success && res.data) {
            loginWithToken(authToken, res.data);
          }
        })
        .catch(console.error)
        .finally(() => {
          setIsProcessingAuth(null);
        });
    } else {
      if (isProcessingAuth) {
        setIsProcessingAuth(null);
      }
    }
  }, [isAuthenticated, loginWithToken]);

  // Tous les useState ci-dessous (nécessaires avant tout return conditionnel)
  const [folders, setFolders] = useState<SharedFolder[]>(() => {
    const saved = localStorage.getItem('unifolder_shares');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('product')) {
        return 'library';
      }
      if (urlParams.get('view') === 'notifications') {
        localStorage.setItem('studycloud_open_subview', 'notifications');
        return 'settings';
      }
    } catch (e) {}
    const saved = localStorage.getItem('unifolder_current_tab');
    if (saved && ['folders', 'upload', 'share-portal', 'library', 'shared', 'settings', 'publish-file'].includes(saved)) {
      return saved as NavigationTab;
    }
    return 'folders';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Écouter les clics sur les notifications push du Service Worker
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const handleSwMessage = (event: MessageEvent) => {
        if (event.data && event.data.type === 'OPEN_NOTIFICATIONS') {
          setCurrentTab('settings');
          localStorage.setItem('studycloud_open_subview', 'notifications');
          window.dispatchEvent(new Event('studycloud_open_notifications'));
        }
      };
      navigator.serviceWorker.addEventListener('message', handleSwMessage);
      return () => navigator.serviceWorker.removeEventListener('message', handleSwMessage);
    }
  }, []);

  const [publishStatus, setPublishStatus] = useState<{ isPublishing: boolean; hasFiles: boolean; progress?: string } | null>(() => {
    try {
      const savedFiles = localStorage.getItem('published_selected_files');
      if (savedFiles && JSON.parse(savedFiles).length > 0) {
        return { isPublishing: false, hasFiles: true, progress: `${JSON.parse(savedFiles).length} fichier(s)` };
      }
    } catch {}
    return null;
  });

  const handleSetTab = (tab: NavigationTab) => {
    // Ne jamais effacer les fichiers de publication en cours lors d'un changement d'onglet
    setCurrentTab(tab);
  };

  useEffect(() => {
    localStorage.setItem('unifolder_current_tab', currentTab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentTab]);

  // Nettoyage immédiat des anciennes données de démonstration / locales écrites en dur dans le cache
  useEffect(() => {
    try {
      // Nettoyer les éventuelles data URLs géantes déjà stockées dans unifolder_shares pour libérer le quota
      const rawShares = localStorage.getItem('unifolder_shares');
      if (rawShares && (rawShares.includes('data:image') || rawShares.length > 300000)) {
        try {
          const parsed = JSON.parse(rawShares);
          if (Array.isArray(parsed)) {
            const cleaned = sanitizeFoldersForStorage(parsed);
            localStorage.setItem('unifolder_shares', JSON.stringify(cleaned));
          }
        } catch (cleanErr) {
          localStorage.removeItem('unifolder_shares');
        }
      }

      if (localStorage.getItem('sc_mock_cleaned_v2') !== 'true') {
        localStorage.setItem('sc_mock_cleaned_v2', 'true');
        // Nettoyer les faux dossiers de démo
        const savedShares = localStorage.getItem('unifolder_shares');
        if (savedShares && savedShares.includes('math-l1')) {
          localStorage.removeItem('unifolder_shares');
          setFolders([]);
        }
        // Nettoyer les faux produits de démo
        const savedProds = localStorage.getItem('unifolder_published_products');
        if (savedProds && savedProds.includes("Cours d'Électrotechnique S1")) {
          localStorage.removeItem('unifolder_published_products');
        }
        // Nettoyer les fausses notes de démo
        const savedNotes = localStorage.getItem('unifolder_keep_notes');
        if (savedNotes && savedNotes.includes('note-1')) {
          localStorage.removeItem('unifolder_keep_notes');
        }
        // Nettoyer les fausses alarmes de démo
        const savedAlarms = localStorage.getItem('unifolder_clock_alarms') || localStorage.getItem('unifolder_alarms');
        if (savedAlarms && savedAlarms.includes('alarm-1')) {
          localStorage.removeItem('unifolder_clock_alarms');
          localStorage.removeItem('unifolder_alarms');
        }
        // Nettoyer les fausses notes d'école
        const savedGrades = localStorage.getItem('user_grades_trimesters_data');
        if (savedGrades && savedGrades.includes('Mathématiques') && !savedGrades.includes('custom_')) {
          localStorage.removeItem('user_grades_trimesters_data');
        }
      }
    } catch (e) {}
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 8000);
  };

  const [showCreateShareLinkModal, setShowCreateShareLinkModal] = useState(false);
  const [shareModalTargetItems, setShareModalTargetItems] = useState<any[] | null>(null);
  const [shareModalInitialName, setShareModalInitialName] = useState<string>('');

  const handleStartBackgroundCreation = (
    linkName: string,
    comment: string,
    items: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[],
    onComplete?: (folder: SharedFolder) => void,
    isPublic: boolean = false
  ) => {
    setTimeout(async () => {
      const folderId = 'folder-' + Math.random().toString(36).substring(2, 9);
      const shareCode = generateCleanShareCode();
      const userCountry = localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire";
      const userName = localStorage.getItem('unifolder_user_name') || 'Alexandre K.';
      const userSchool = localStorage.getItem('unifolder_user_school') || 'CME';
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const workerUrl = getWorkerApiUrl();
      const shareUrl = `${workerUrl}/s/${shareCode}`;
      const qrCodeData = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`;

      // Enregistrer exclusivement les fichiers associés au lien dans le dossier dédié Cloudflare R2 (shared-links/files)
      const files = await Promise.all(
        items.map(async (item) => {
          let fileUrl = item.url || '';
          let storedR2Key: string | undefined = undefined;
          let fileBlob: Blob | null = null;

          try {
            // 1. Tenter de récupérer le fichier binaire depuis IndexedDB
            fileBlob = await getFileBlob(item.id);

            // 2. Si non trouvé, vérifier si un Blob / File est directement attaché à l'objet
            if (!fileBlob && (item as any).file instanceof Blob) {
              fileBlob = (item as any).file;
            }

            // 3. Si toujours aucun blob mais qu'une URL locale ou distante existe (blob:, data: ou http)
            if (!fileBlob && fileUrl) {
              try {
                const resp = await fetch(fileUrl);
                if (resp.ok) {
                  fileBlob = await resp.blob();
                }
              } catch (fetchErr) {
                console.warn('Sync fetch blob pour partage:', fetchErr);
              }
            }

            // Clé R2 dédiée exclusivement aux fichiers de liens partagés
            const r2Key = buildSharedLinkFileKey(folderId, item.id, item.name);

            // 4. Si nous avons le fichier binaire, l'uploader dans le dossier dédié R2
            if (fileBlob) {
              const fileObj = new File([fileBlob], item.name, {
                type: item.type || fileBlob.type || 'application/octet-stream',
              });
              const r2Res = await StudyCloudAPI.uploadFileToR2(fileObj, r2Key);
              if (r2Res.success && r2Res.url) {
                fileUrl = r2Res.url;
                storedR2Key = r2Res.key;
              }
            } else if (fileUrl && fileUrl.startsWith('http')) {
              // Fichier distant déjà stocké
              storedR2Key = (item as any).r2Key || (item as any).r2_key || r2Key;
            }
          } catch (err) {
            console.warn('Erreur upload vers R2 lors de la création du partage:', err);
          }

          return {
            id: item.id || crypto.randomUUID(),
            fileId: item.id,
            name: item.name,
            size: item.size || (fileBlob ? fileBlob.size : 0),
            type: item.type || (fileBlob ? fileBlob.type : 'file'),
            url: fileUrl,
            r2Key: storedR2Key,
          };
        })
      );

      const totalSize = files.reduce((acc, f) => acc + f.size, 0);

      const newFolder: SharedFolder = {
        id: folderId,
        title: linkName.trim(),
        description: comment.trim() ? `${comment.trim()} • Contient ${items.length} élément(s).` : `Dossier partagé contenant ${items.length} élément(s).`,
        category: 'Cours',
        author: userName,
        school: userSchool,
        country: userCountry,
        createdAt: new Date().toISOString(),
        files,
        totalSize,
        downloadsCount: 0,
        isPasswordProtected: false,
        viewsCount: 0,
        shareCode,
        shareUrl,
        qrCodeData,
        isPublic,
        allowDownload: true,
      };

      setFolders((prev) => [newFolder, ...prev]);
      setUploadedItems([]);
      setSelectedItemIds([]);
      try {
        localStorage.removeItem('unifolder_uploaded_items');
      } catch (e) {}
      showToast(`✨ Votre lien "${linkName.trim()}" a été créé avec succès (${userCountry}) ! Retrouvez-le dans Partagés.`);

      try {
        await StudyCloudAPI.createShare({
          id: folderId,
          userId,
          title: newFolder.title,
          description: newFolder.description,
          category: newFolder.category,
          authorName: userName,
          school: userSchool,
          country: userCountry,
          isPublic,
          isPasswordProtected: false,
          allowDownload: true,
          shareCode,
          shareUrl,
          qrCodeData,
          totalSize,
          files,
        });
      } catch (err) {
        console.warn('Sync share with Worker:', err);
      }

      if (onComplete) {
        onComplete(newFolder);
      }
    }, 150);
  };

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [activeFolderDetail, setActiveFolderDetail] = useState<SharedFolder | null>(() => {
    try {
      const saved = localStorage.getItem('studycloud_active_folder_detail');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    try {
      if (activeFolderDetail) {
        localStorage.setItem('studycloud_active_folder_detail', JSON.stringify(activeFolderDetail));
      } else {
        localStorage.removeItem('studycloud_active_folder_detail');
      }
    } catch (e) {}
  }, [activeFolderDetail]);

  const [activeQRCodeFolder, setActiveQRCodeFolder] = useState<SharedFolder | null>(null);
  const [uploadedItems, setUploadedItems] = useState<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[]>(() => {
    const saved = localStorage.getItem('unifolder_uploaded_items');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed;
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });
  const [activePreviewItemState, setActivePreviewItemState] = useState<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean; folderName?: string; lockFullscreen?: boolean } | null>(() => {
    try {
      const saved = localStorage.getItem('studycloud_active_preview_item');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return null;
  });
  const [previewOwnerTab, setPreviewOwnerTab] = useState<NavigationTab | null>(() => {
    try {
      const saved = localStorage.getItem('studycloud_preview_owner_tab');
      if (saved && ['folders', 'upload', 'share-portal', 'library', 'shared', 'settings', 'publish-file'].includes(saved)) {
        return saved as NavigationTab;
      }
    } catch (e) {}
    return 'folders';
  });
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const setActivePreviewItem = (item: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean; folderName?: string; lockFullscreen?: boolean } | null) => {
    if (!item) {
      setActivePreviewItemState(null);
      setPreviewOwnerTab(null);
      setIsPreviewLoading(false);
      setIsCenterFullscreen(false);
      try {
        localStorage.removeItem('studycloud_active_preview_item');
        localStorage.removeItem('studycloud_preview_owner_tab');
      } catch (e) {}
      return;
    }
    setIsPreviewLoading(true);
    setActivePreviewItemState(item);
    const tabOwner = currentTab || 'folders';
    setPreviewOwnerTab(tabOwner);
    try {
      localStorage.setItem('studycloud_active_preview_item', JSON.stringify(item));
      localStorage.setItem('studycloud_preview_owner_tab', tabOwner);
    } catch (e) {}
    if (item.lockFullscreen) {
      setIsCenterFullscreen(true);
      setMobilePreviewTab(1);
    }
    setTimeout(() => {
      setIsPreviewLoading(false);
    }, 1000);
  };

  useEffect(() => {
    try {
      if (activePreviewItemState) {
        localStorage.setItem('studycloud_active_preview_item', JSON.stringify(activePreviewItemState));
      } else {
        localStorage.removeItem('studycloud_active_preview_item');
      }
    } catch (e) {}
  }, [activePreviewItemState]);

  // Synchronise currentTab avec previewOwnerTab si un preview actif est restauré
  useEffect(() => {
    if (activePreviewItemState && previewOwnerTab && currentTab !== previewOwnerTab) {
      setCurrentTab(previewOwnerTab);
    }
  }, []);

  const activePreviewItem = activePreviewItemState;
  const [previewScrollMode, setPreviewScrollMode] = useState<'vertical' | 'horizontal'>(() => {
    try {
      const saved = localStorage.getItem('studycloud_preview_scroll_mode');
      if (saved === 'vertical' || saved === 'horizontal') return saved;
    } catch (e) {}
    return 'vertical';
  });

  useEffect(() => {
    try {
      localStorage.setItem('studycloud_preview_scroll_mode', previewScrollMode);
    } catch (e) {}
  }, [previewScrollMode]);

  const [mobilePreviewTab, setMobilePreviewTab] = useState<0 | 1 | 2>(1);

  useEffect(() => {
    const handleSwitchMobileTab = (e: any) => {
      if (typeof e.detail?.tab === 'number') {
        setMobilePreviewTab(e.detail.tab);
      }
    };
    window.addEventListener('switch-mobile-tab', handleSwitchMobileTab as any);
    return () => window.removeEventListener('switch-mobile-tab', handleSwitchMobileTab as any);
  }, []);
  const [previewLeftWidth, setPreviewLeftWidth] = useState(33.33);
  const [previewRightWidth, setPreviewRightWidth] = useState(33.33);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isCenterFullscreen, setIsCenterFullscreen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('studycloud_active_preview_item');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.lockFullscreen) return true;
      }
    } catch (e) {}
    return false;
  });
  const [isRightFullscreen, setIsRightFullscreen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);

  // Determine if actually running on a mobile touch screen or desktop
  const [isMobileScreen, setIsMobileScreen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const isTouchMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
      (window.screen.width < 768 && navigator.maxTouchPoints > 1);
    return Boolean(isTouchMobile && window.innerWidth < 768);
  });

  useEffect(() => {
    const handleResize = () => {
      const isTouchMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        (window.screen.width < 768 && navigator.maxTouchPoints > 1);
      setIsMobileScreen(Boolean(isTouchMobile && window.innerWidth < 768));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  const [shareToast, setShareToast] = useState(false);
  const [activeLongPressItem, setActiveLongPressItem] = useState<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);

  // Study Timer State
  const [showStudyTimer, setShowStudyTimer] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(5);
  const [customSeconds, setCustomSeconds] = useState(0);
  const [timerDuration, setTimerDuration] = useState(300);
  const [timerLeft, setTimerLeft] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinishedAlert, setTimerFinishedAlert] = useState(false);

  // Audio Beep helper for Study Timer
  const playTimerBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let interval: any;
    if (timerRunning) {
      // Déterminer ou récupérer l'heure cible exacte
      let targetTime = parseInt(localStorage.getItem('sc_study_timer_target') || '0', 10);
      if (!targetTime || targetTime <= Date.now()) {
        targetTime = Date.now() + timerLeft * 1000;
        localStorage.setItem('sc_study_timer_target', targetTime.toString());
      }

      const syncStudyTimer = () => {
        const storedTarget = parseInt(localStorage.getItem('sc_study_timer_target') || '0', 10);
        if (!storedTarget) return;
        const remaining = Math.max(0, Math.ceil((storedTarget - Date.now()) / 1000));
        setTimerLeft(remaining);

        if (remaining <= 0) {
          localStorage.removeItem('sc_study_timer_target');
          setTimerRunning(false);
          setTimerFinishedAlert(true);
          setShowStudyTimer(true);
          playTimerBeep();
        }
      };

      // Synchronisation immédiate
      syncStudyTimer();

      interval = setInterval(syncStudyTimer, 500);

      // Réactivation instantanée au retour sur l'écran
      const handleWakeUp = () => syncStudyTimer();
      document.addEventListener('visibilitychange', handleWakeUp);
      window.addEventListener('focus', handleWakeUp);
      window.addEventListener('pageshow', handleWakeUp);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', handleWakeUp);
        window.removeEventListener('focus', handleWakeUp);
        window.removeEventListener('pageshow', handleWakeUp);
      };
    } else {
      localStorage.removeItem('sc_study_timer_target');
    }
  }, [timerRunning]);
  
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  const handleTouchStart = (item: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }) => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      setActiveLongPressItem(item);
    }, 400);
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(e.target?.result as string);
          
          let width = img.width;
          let height = img.height;
          const maxDim = 1200;
          
          if (width > height && width > maxDim) {
            height *= maxDim / width;
            width = maxDim;
          } else if (height > maxDim) {
            width *= maxDim / height;
            height = maxDim;
          }
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  useEffect(() => {
    if (!isResizingLeft) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const percentage = (x / rect.width) * 100;

      // Bloque le panneau gauche au niveau optimal (~260px / ~22%) pour préserver LeftMenu
      const minLeft = Math.max(22, (260 / rect.width) * 100);
      // Bloque également quand le menu central (document) atteint sa taille minimale (~440px / ~38%) pour ne pas trop le réduire
      const minCenter = Math.max(38, (440 / rect.width) * 100);
      const maxLeft = Math.max(minLeft, 100 - previewRightWidth - minCenter);
      const newWidth = Math.min(Math.max(minLeft, percentage), maxLeft);
      setPreviewLeftWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('touchmove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      document.body.style.removeProperty('cursor');
      document.body.style.removeProperty('user-select');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizingLeft, previewLeftWidth, previewRightWidth]);


  const handleReplaceFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && replacingItemId) {
      const f = e.target.files[0];
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const isImg = !isPdf && (f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
      
      // Sauvegarder le binaire réel dans IndexedDB
      storeFileBlob(replacingItemId, f).catch((err) => console.warn('Erreur stockage IndexedDB:', err));

      if (isImg) {
        const tempUrl = URL.createObjectURL(f);
        setUploadedItems((prev) =>
          prev.map((item) =>
            item.id === replacingItemId
              ? { ...item, name: f.name, size: f.size, type: f.type || 'file', url: tempUrl, isImage: true }
              : item
          )
        );
        setReplacingItemId(null);
        setActiveLongPressItem(null);

        compressImage(f).then((dataUrl) => {
          if (dataUrl) {
            setUploadedItems((prev) =>
              prev.map((item) => (item.id === replacingItemId ? { ...item, url: dataUrl } : item))
            );
          }
        });
      } else {
        setUploadedItems((prev) =>
          prev.map((item) =>
            item.id === replacingItemId
              ? { ...item, name: f.name, size: f.size, type: f.type || 'file', url: undefined, isImage: false }
              : item
          )
        );
        setReplacingItemId(null);
        setActiveLongPressItem(null);
      }
      e.target.value = '';
    }
  };

  const handleSelectAll = () => {
    if (selectedItemIds.length === uploadedItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(uploadedItems.map((i) => i.id));
    }
    setActiveLongPressItem(null);
  };

  useEffect(() => {
    try {
      if (uploadedItems.length === 0) {
        localStorage.removeItem('unifolder_uploaded_items');
      } else {
        localStorage.setItem('unifolder_uploaded_items', JSON.stringify(uploadedItems));
      }
    } catch (e) {
      console.error(e);
    }
  }, [uploadedItems]);

  const handleFilesSelected = (e: React.ChangeEvent<HTMLInputElement>, typeLabel: string) => {
    try {
      if (e.target.files && e.target.files.length > 0) {
        const fileList = e.target.files;
        const newItems: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[] = [];
        const imageFilesToCompress: { id: string; file: File }[] = [];

        for (let i = 0; i < fileList.length; i++) {
          const f = fileList[i];
          const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
          const isImg = !isPdf && (f.type.startsWith('image/') || typeLabel === 'images' || typeLabel === 'Images' || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
          const id = `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`;
          
          // Sauvegarder immédiatement le binaire réel dans IndexedDB
          storeFileBlob(id, f).catch((err) => console.warn('Erreur stockage IndexedDB:', err));

          let url: string | undefined = undefined;
          try {
            if (isImg) {
              url = URL.createObjectURL(f);
              imageFilesToCompress.push({ id, file: f });
            }
          } catch (blobErr) {
            console.error(blobErr);
          }

          newItems.push({
            id,
            name: f.name,
            size: f.size,
            type: f.type || typeLabel,
            url,
            isImage: isImg
          });
        }

        setUploadedItems((prev) => [...prev, ...newItems]);
        setCurrentTab('upload');
        localStorage.setItem('unifolder_current_tab', 'upload');

        // Background compression for persistent local storage previews without losing state
        imageFilesToCompress.forEach(({ id, file }) => {
          compressImage(file).then((dataUrl) => {
            if (dataUrl) {
              setUploadedItems((prev) =>
                prev.map((item) => (item.id === id ? { ...item, url: dataUrl } : item))
              );
            }
          });
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleFilesDropped = (files: File[]) => {
    try {
      if (files && files.length > 0) {
        const newItems: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[] = [];
        const imageFilesToCompress: { id: string; file: File }[] = [];

        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
          const isImg = !isPdf && (f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
          const id = `item-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 9)}`;
          
          // Sauvegarder immédiatement le binaire réel dans IndexedDB
          storeFileBlob(id, f).catch((err) => console.warn('Erreur stockage IndexedDB:', err));

          let url: string | undefined = undefined;
          try {
            if (isImg) {
              url = URL.createObjectURL(f);
              imageFilesToCompress.push({ id, file: f });
            }
          } catch (blobErr) {
            console.error(blobErr);
          }

          newItems.push({
            id,
            name: f.name,
            size: f.size,
            type: f.type || 'Fichiers',
            url,
            isImage: isImg
          });
        }

        setUploadedItems((prev) => [...prev, ...newItems]);
        setCurrentTab('upload');
        localStorage.setItem('unifolder_current_tab', 'upload');

        imageFilesToCompress.forEach(({ id, file }) => {
          compressImage(file).then((dataUrl) => {
            if (dataUrl) {
              setUploadedItems((prev) =>
                prev.map((item) => (item.id === id ? { ...item, url: dataUrl } : item))
              );
            }
          });
        });
      }
    } catch (err) {
      console.error(err);
    }
  };
  const [shareId, setShareId] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      const id = hash.replace('#share=', '');
      const workerUrl = getWorkerApiUrl().replace(/\/+$/, '');
      window.location.replace(`${workerUrl}/s/${id}`);
      return null;
    }
    return null;
  });

  const [remoteSharedFolder, setRemoteSharedFolder] = useState<SharedFolder | null>(null);
  const [isLoadingRemoteShare, setIsLoadingRemoteShare] = useState<boolean>(false);
  const [remoteShareError, setRemoteShareError] = useState<boolean>(false);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#share=')) {
        const id = hash.replace('#share=', '');
        const workerUrl = getWorkerApiUrl().replace(/\/+$/, '');
        window.location.replace(`${workerUrl}/s/${id}`);
      } else {
        setShareId(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Récupération automatique du dossier partagé depuis Cloudflare D1/R2 si absent localement
  useEffect(() => {
    if (!shareId) {
      setRemoteSharedFolder(null);
      setRemoteShareError(false);
      setIsLoadingRemoteShare(false);
      return;
    }

    const localFolder = folders.find((f) => f.id === shareId);
    if (localFolder) {
      setRemoteSharedFolder(localFolder);
      return;
    }

    setIsLoadingRemoteShare(true);
    setRemoteShareError(false);
    StudyCloudAPI.getShareDetail(shareId)
      .then((res) => {
        if (res.success && res.data) {
          const row = res.data;
          const mapped: SharedFolder = {
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: row.category || "Pas d'informations",
            author: row.author_name || 'Étudiant',
            school: row.school || '',
            country: row.country || "Côte d'Ivoire",
            createdAt: row.created_at || new Date().toISOString(),
            files: Array.isArray(row.files)
              ? row.files.map((f: any) => ({
                  id: f.id || f.file_id || crypto.randomUUID(),
                  name: f.name,
                  size: f.size || 0,
                  type: f.type || 'file',
                  url: f.file_url || f.url || '',
                }))
              : [],
            totalSize: row.total_size || 0,
            downloadsCount: row.downloads_count || 0,
            isPasswordProtected: false,
            password: row.password_hash || undefined,
            viewsCount: row.views_count || 0,
            shareCode: row.share_code,
            shareUrl: `${getWorkerApiUrl().replace(/\/+$/, '')}/s/${row.share_code || row.id}`,
            qrCodeData: row.qr_code_data,
            isPublic: Boolean(row.is_public),
            allowDownload: Boolean(row.allow_download),
          };
          setRemoteSharedFolder(mapped);
        } else {
          setRemoteShareError(true);
        }
      })
      .catch((err) => {
        console.warn('Erreur chargement share distant:', err);
        setRemoteShareError(true);
      })
      .finally(() => {
        setIsLoadingRemoteShare(false);
      });
  }, [shareId, folders]);

  useEffect(() => {
    try {
      const sanitized = sanitizeFoldersForStorage(folders);
      localStorage.setItem('unifolder_shares', JSON.stringify(sanitized));
    } catch (e) {
      console.warn('LocalStorage quota exceeded for unifolder_shares:', e);
      try {
        // En cas de saturation du quota, conserver seulement les 15 partages les plus récents
        const trimmed = sanitizeFoldersForStorage(folders.slice(0, 15));
        localStorage.setItem('unifolder_shares', JSON.stringify(trimmed));
      } catch (err2) {
        console.error('Impossible de persister unifolder_shares dans le stockage local:', err2);
      }
    }
  }, [folders]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    StudyCloudAPI.getShares(user.id)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped: SharedFolder[] = res.data.map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: row.category || "Pas d'informations",
            author: row.author_name || user?.name || 'Étudiant',
            school: row.school || user?.school || '',
            country: row.country || user?.country || "Côte d'Ivoire",
            createdAt: row.created_at || new Date().toISOString(),
            files: Array.isArray(row.files)
              ? row.files.map((f: any) => ({
                  id: f.id || f.file_id || crypto.randomUUID(),
                  name: f.name,
                  size: f.size || 0,
                  type: f.type || 'file',
                  url: f.file_url || f.url || '',
                  r2Key: f.r2_key || f.r2Key || undefined,
                }))
              : [],
            totalSize: row.total_size || 0,
            downloadsCount: row.downloads_count || 0,
            isPasswordProtected: false,
            password: row.password_hash || undefined,
            viewsCount: row.views_count || 0,
            shareCode: row.share_code,
            shareUrl: `${getWorkerApiUrl().replace(/\/+$/, '')}/s/${row.share_code || row.id}`,
            qrCodeData: row.qr_code_data,
            isPublic: Boolean(row.is_public),
            allowDownload: Boolean(row.allow_download),
          }));
          setFolders(mapped);
          try {
            const sanitizedMapped = sanitizeFoldersForStorage(mapped);
            localStorage.setItem('unifolder_shares', JSON.stringify(sanitizedMapped));
          } catch (e) {
            console.warn('Erreur mise en cache locale des partages distants:', e);
          }
        }
      })
      .catch((err) => console.warn('Failed to load user shares from D1:', err));
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleRestore = () => {
      const saved = localStorage.getItem('unifolder_shares');
      if (saved) {
        try { setFolders(JSON.parse(saved)); } catch (e) {}
      } else {
        setFolders([]);
      }
    };
    window.addEventListener('unifolder_data_restored', handleRestore);
    return () => window.removeEventListener('unifolder_data_restored', handleRestore);
  }, []);

  const handleAddFolder = (newFolder: SharedFolder) => {
    setFolders((prev) => [newFolder, ...prev]);
    setCurrentTab('folders');
    const userId = user?.id || localStorage.getItem('unifolder_user_id') || 'default-user';
    StudyCloudAPI.createShare({
      id: newFolder.id,
      userId,
      title: newFolder.title,
      description: newFolder.description,
      category: newFolder.category,
      authorName: newFolder.author,
      school: newFolder.school,
      country: newFolder.country,
      isPublic: newFolder.isPublic !== undefined ? newFolder.isPublic : true,
      isPasswordProtected: newFolder.isPasswordProtected,
      totalSize: newFolder.totalSize,
      files: newFolder.files,
      shareCode: newFolder.shareCode,
      shareUrl: newFolder.shareUrl,
      qrCodeData: newFolder.qrCodeData,
    }).catch((e) => console.warn('Sync share to cloud:', e));
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolderDetail?.id === folderId) {
      setActiveFolderDetail(null);
    }
    StudyCloudAPI.deleteShare(folderId).catch(() => {});
  };

  const handleIncrementDownload = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, downloadsCount: f.downloadsCount + 1 } : f))
    );
  };

  // ─── AUTH GUARDS ─────────────────────────────────────────────────────────────
  // 1. Écran de chargement lors de la vérification du token JWT ou du retour Google / Email
  if (authLoading || isProcessingAuth) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center bg-[#0f0c29]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl"
            style={{ background: 'linear-gradient(135deg, #1e1b4b, #0f172a)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <DnaLogo className="w-10 h-10 drop-shadow-[0_0_8px_rgba(234,88,12,0.5)]" glow={true} />
          </div>
          <div className="w-8 h-8 border-3 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/80 text-sm font-semibold tracking-wide">
            {isProcessingAuth || 'Initialisation de StudyCloud...'}
          </p>
        </div>
      </div>
    );
  }

  // If viewing a share link (e.g. #share=folder-id)
  if (shareId) {
    if (isLoadingRemoteShare) {
      return (
        <div className="min-h-dvh bg-[#FDFBF7] flex items-center justify-center p-4">
          <div className="bg-[#F5F1E9] border-3 border-stone-800 rounded-2xl p-8 max-w-sm text-center shadow-[6px_6px_0px_0px_#1c1917] flex flex-col items-center gap-3 animate-fadeIn">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            <h3 className="text-base font-extrabold text-stone-900">Chargement du document partagé...</h3>
            <p className="text-xs text-stone-600">Connexion sécurisée à Cloudflare D1/R2...</p>
          </div>
        </div>
      );
    }
    const targetFolder = remoteSharedFolder || folders.find((f) => f.id === shareId);
    if (!targetFolder || remoteShareError) {
      return (
        <div className="min-h-dvh bg-[#FDFBF7] flex items-center justify-center p-4">
          <div className="bg-[#F5F1E9] border-3 border-stone-800 rounded-2xl p-8 max-w-md text-center shadow-[6px_6px_0px_0px_#1c1917]">
            <h2 className="text-xl font-extrabold text-stone-900 mb-2">Dossier introuvable</h2>
            <p className="text-sm text-stone-600 mb-6">Le lien de partage est invalide ou le dossier a été supprimé par l'étudiant.</p>
            <button
              onClick={() => {
                window.location.hash = '';
                setShareId(null);
                setRemoteSharedFolder(null);
              }}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs px-6 py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] cursor-pointer"
            >
              Retourner à l'accueil
            </button>
          </div>
        </div>
      );
    }
    return (
      <SharePortalView
        folder={targetFolder}
        onBackToApp={() => {
          window.location.hash = '';
          setShareId(null);
          setRemoteSharedFolder(null);
        }}
        onIncrementDownload={handleIncrementDownload}
      />
    );
  }

  // 2. Si non connecté : afficher directement la page de connexion (Google ou Email)
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // 3. Si mot de passe ou questions de sécurité non définis (ex: premier accès via Google) : configuration de sécurité D'ABORD
  if (needsSecuritySetup) {
    return <GoogleSecuritySetupPage />;
  }

  // 4. Ensuite, questions personnelles d'onboarding (nom, école, filière, niveau, pays, téléphone, photo/logo)
  if (needsOnboarding) {
    return <OnboardingPage />;
  }

  // Filter folders
  const filteredFolders = folders.filter((f) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      f.title.toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q) ||
      (f.shareCode && f.shareCode.toLowerCase().includes(q)) ||
      f.files.some((file) => file.name.toLowerCase().includes(q));
    const matchesCategory = selectedCategory === 'Tous' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className={`min-h-dvh ${currentTab === 'upload' ? 'bg-[#F2EDDA]' : 'bg-[#E9D7C9]'} dark:bg-[#0b0f19] flex flex-col md:flex-row font-sans text-stone-900 dark:text-slate-100 transition-colors duration-200`}>
      {/* Sidebar (Desktop & Mobile Nav) */}
      <Sidebar
        currentTab={currentTab}
        setTab={handleSetTab}
        foldersCount={folders.length}
        onOpenUpload={() => setShowUploadModal(true)}
        publishStatus={publishStatus}
      />

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col min-h-dvh pb-20 md:pb-0 md:ml-64 ${currentTab === 'upload' ? 'bg-[#F2EDDA]' : 'bg-[#E9D7C9]'} dark:bg-[#0b0f19] transition-colors duration-200`}>
        <main className={`flex-1 ${currentTab === 'library' ? 'p-0 w-full' : 'p-6 md:p-8 max-w-7xl w-full mx-auto'}`}>
          {currentTab === 'folders' ? (
            <FoldersView
              onOpenUpload={() => setShowUploadModal(true)}
              setTab={handleSetTab}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              setActivePreviewItem={setActivePreviewItem}
              onImportFile={() => {
                handleSetTab('upload');
              }}
              onOpenPublishView={() => {
                handleSetTab('publish-file');
              }}
              onOpenCreateShareLink={(items) => {
                setShareModalTargetItems(items);
                setShareModalInitialName(
                  items.length === 1 ? items[0].name.replace(/\.[^/.]+$/, '') : `Partage (${items.length} fichiers)`
                );
                setShowCreateShareLinkModal(true);
              }}
            />
          ) : currentTab === 'upload' ? (
            <UploadView
              currentTab={currentTab}
              setTab={handleSetTab}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onOpenUploadModal={() => setShowUploadModal(true)}
              onOpenAddMenu={() => setShowAddMenu(true)}
              onOpenClearConfirm={() => {
                if (uploadedItems.length > 0) {
                  setShowClearConfirmModal(true);
                }
              }}
              onOpenCreateShareLink={() => {
                setShareModalTargetItems(null);
                setShareModalInitialName('');
                setShowCreateShareLinkModal(true);
              }}
              uploadedItems={uploadedItems}
              setUploadedItems={setUploadedItems}
              selectedItemIds={selectedItemIds}
              setSelectedItemIds={setSelectedItemIds}
              setActivePreviewItem={setActivePreviewItem}
              activeLongPressItem={activeLongPressItem}
              setActiveLongPressItem={setActiveLongPressItem}
              handleFilesSelected={handleFilesSelected}
              handleReplaceFileSelected={handleReplaceFileSelected}
              replaceInputRef={replaceInputRef}
              handleTouchStart={handleTouchStart}
              handleTouchMove={handleTouchMove}
              handleTouchEnd={handleTouchEnd}
              handleSelectAll={handleSelectAll}
              setReplacingItemId={setReplacingItemId}
              onFilesDropped={handleFilesDropped}
            />
          ) : currentTab === 'library' ? (
            <LibraryView
              folders={folders}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectFolder={(folder) => setActiveFolderDetail(folder)}
              setActivePreviewItem={setActivePreviewItem}
              onOpenCreateShareLink={(items) => {
                setShareModalTargetItems(items);
                setShareModalInitialName(
                  items.length === 1 ? items[0].name.replace(/\.[^/.]+$/, '') : `Partage (${items.length} fichiers)`
                );
                setShowCreateShareLinkModal(true);
              }}
            />
          ) : currentTab === 'shared' ? (
            <SharedLinksView
              folders={folders}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectFolder={(folder) => setActiveFolderDetail(folder)}
              onOpenQR={(folder) => setActiveQRCodeFolder(folder)}
              onDeleteFolder={handleDeleteFolder}
              setFolders={setFolders}
            />
          ) : currentTab === 'settings' ? (
            <SettingsView />
          ) : null}

          {/* Persistent PublishFileView: keeps in-progress uploads, drafts, rejected files & status intact */}
          <div className={currentTab === 'publish-file' ? 'contents' : 'hidden'}>
            <PublishFileView
              onBack={() => {
                setPublishStatus(null);
                handleSetTab('folders');
              }}
              onPublish={() => {
                // Ne PAS rediriger vers Ressources : rester où l'utilisateur se trouve
                window.dispatchEvent(new Event('studycloud_refresh_published_docs'));
              }}
              onStatusChange={setPublishStatus}
            />
          </div>
        </main>
      </div>

      {/* Floating pill when publication is in progress or has draft files and user is on another menu */}
      {currentTab !== 'publish-file' && (publishStatus?.isPublishing || publishStatus?.hasFiles) && (
        <div className="fixed bottom-20 md:bottom-6 right-4 sm:right-6 z-50 animate-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <button
            onClick={() => handleSetTab('publish-file')}
            className="flex items-center gap-3 px-4 py-2.5 bg-[#2D4A3E] hover:bg-[#1e332a] text-white font-bold text-xs rounded-2xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 group"
          >
            <div className="relative flex items-center justify-center">
              <div className={`w-3 h-3 rounded-full ${publishStatus.isPublishing ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`} />
              <div className={`absolute w-2 h-2 rounded-full ${publishStatus.isPublishing ? 'bg-amber-400' : 'bg-emerald-400'}`} />
            </div>
            <div className="text-left">
              <div className="text-[10px] text-emerald-200 uppercase font-black tracking-wider">
                {publishStatus.isPublishing ? 'Publication en cours' : 'Publication en attente'}
              </div>
              <div className="text-xs font-bold text-white max-w-[200px] truncate">
                {publishStatus.progress || 'Cliquez pour ouvrir'}
              </div>
            </div>
            <span className="bg-emerald-950/80 px-2 py-1 rounded-lg text-[10px] font-bold border border-emerald-400/30 text-emerald-100 group-hover:bg-emerald-900">
              Ouvrir →
            </span>
          </button>
        </div>
      )}

      {/* Modals */}
      {showAddMenu && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_#1c1917] space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b-2 border-stone-300">
              <h3 className="font-extrabold text-lg text-stone-900">Choisir une option</h3>
              <button
                onClick={() => setShowAddMenu(false)}
                className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-700 border-2 border-stone-800 bg-[#F5F1E9] shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              {[
                { id: 'dossier', label: 'Dossier', icon: FolderPlus, color: 'bg-amber-100 hover:bg-amber-200 text-amber-900' },
                { id: 'fichiers', label: 'Fichiers', icon: Upload, color: 'bg-blue-100 hover:bg-blue-200 text-blue-900' },
                { id: 'images', label: 'Images', icon: Upload, color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900' },
                { id: 'son', label: 'Son', icon: Upload, color: 'bg-purple-100 hover:bg-purple-200 text-purple-900' },
              ].map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    onClick={() => {
                      setShowAddMenu(false);
                      if (opt.id === 'dossier') {
                        folderInputRef.current?.click();
                      } else if (opt.id === 'fichiers') {
                        fileInputRef.current?.click();
                      } else if (opt.id === 'images') {
                        imageInputRef.current?.click();
                      } else if (opt.id === 'son') {
                        audioInputRef.current?.click();
                      }
                    }}
                    className={`${opt.color} flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all font-bold text-xs gap-2`}
                  >
                    <Icon className="w-6 h-6" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {showClearConfirmModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/30 backdrop-blur-xs animate-fadeIn">
          <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-3xl p-6 w-full max-w-sm shadow-[8px_8px_0px_0px_#1c1917] space-y-4 relative">
            <div className="flex items-center justify-between pb-3 border-b-2 border-stone-300">
              <h3 className="font-extrabold text-lg text-stone-900">Nouveau partage</h3>
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="p-1.5 hover:bg-stone-200 rounded-lg text-stone-700 border-2 border-stone-800 bg-[#F5F1E9] shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs font-medium text-stone-700 leading-relaxed">
              Voulez-vous supprimer les éléments importés et vider le cache pour commencer un nouveau partage ?
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="px-4 py-2 bg-[#F5F1E9] hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  setUploadedItems([]);
                  setSelectedItemIds([]);
                  setShowClearConfirmModal(false);
                }}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden file and folder pickers */}
      <input
        type="file"
        ref={folderInputRef}
        style={{ display: 'none' }}
        {...({ webkitdirectory: '', directory: '' } as any)}
        multiple
        onChange={(e) => handleFilesSelected(e, 'Dossier')}
      />
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        onChange={(e) => handleFilesSelected(e, 'Fichiers')}
      />
      <input
        type="file"
        ref={imageInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={(e) => handleFilesSelected(e, 'Images')}
      />
      <input
        type="file"
        ref={audioInputRef}
        style={{ display: 'none' }}
        accept="audio/mpeg,audio/wav,audio/ogg,audio/aac,audio/flac,audio/mp4,audio/x-m4a"
        multiple
        onChange={(e) => handleFilesSelected(e, 'Son')}
      />

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onAddFolder={handleAddFolder}
        />
      )}

      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[10000] bg-emerald-900 border-2 border-emerald-500 text-white px-5 py-3 rounded-xl shadow-xl flex items-center justify-between gap-4 animate-fadeIn w-[90%] max-w-sm">
          <p className="text-xs font-bold leading-relaxed">{toastMessage}</p>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 hover:bg-emerald-800 rounded-lg text-emerald-200 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeFolderDetail && (
        <FolderDetailModal
          folder={activeFolderDetail}
          onClose={() => setActiveFolderDetail(null)}
          setActivePreviewItem={setActivePreviewItem}
          onOpenQR={(f) => {
            setActiveFolderDetail(null);
            setActiveQRCodeFolder(f);
          }}
        />
      )}

      {activeQRCodeFolder && (
        <QRCodeModal
          folderTitle={activeQRCodeFolder.title}
          shareUrl={activeQRCodeFolder.shareUrl || `${getWorkerApiUrl().replace(/\/+$/, '')}/s/${activeQRCodeFolder.shareCode || activeQRCodeFolder.id}`}
          shareCode={activeQRCodeFolder.shareCode}
          country={activeQRCodeFolder.country}
          isPublic={activeQRCodeFolder.isPublic}
          onClose={() => setActiveQRCodeFolder(null)}
        />
      )}

      {activePreviewItem && (previewOwnerTab ? previewOwnerTab === currentTab : currentTab === 'folders') && (
        <div className="fixed inset-0 md:left-64 z-[99999] bg-[#FDFBF7] dark:bg-[#0b0f19] flex flex-col animate-fadeIn overflow-hidden">
          {/* Top Header Bar - Solid Dark #070a13 */}
          <div className="fixed top-0 left-0 right-0 md:left-64 z-50 bg-[#FDFBF7] dark:bg-[#070a13] h-[44px] py-1 px-3 md:px-6 border-b-2 border-stone-800 dark:border-[#1e293b] shadow-sm flex items-center justify-between gap-2">
            {/* Left: Bouton Retour & badge du dossier/matière */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setActivePreviewItem(null)}
                className="flex items-center gap-1 px-2.5 py-1 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white font-extrabold text-[11px] sm:text-xs rounded-lg border-2 border-stone-800 dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-stone-900 dark:text-white" />
                <span>Retour</span>
              </button>

              {(activePreviewItem.folderName || activeFolderDetail?.title) && (
                <span className="text-[10px] sm:text-[11px] font-black text-stone-800 dark:text-orange-400 uppercase tracking-widest max-w-[120px] sm:max-w-[180px] truncate bg-[#E8DFD0] dark:bg-[#111a2e] px-2.5 py-1 rounded-lg border-2 border-stone-800 dark:border-[#1e293b] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none shrink-0 text-center">
                  {activePreviewItem.folderName || activeFolderDetail?.title}
                </span>
              )}
            </div>

            {/* Center: Nom du fichier & Contrôles Audio (au-dessus de la page en mode écran réduit) */}
            <div className="flex-1 items-center justify-center gap-2 overflow-hidden px-1 sm:px-2 min-w-0 flex">
              <p className="text-[11px] sm:text-xs font-bold text-stone-900 dark:text-white leading-tight truncate overflow-hidden text-ellipsis text-center max-w-[140px] sm:max-w-xs lg:max-w-sm shrink">
                {activePreviewItem.name}
              </p>
              <div id="studycloud-top-audio-portal" className="flex items-center shrink-0" />
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-[9px] sm:text-[10px] text-stone-600 dark:text-slate-300 font-semibold px-1">
                {(() => {
                  const bytes = activePreviewItem.size;
                  if (!bytes) return '0 o';
                  const k = 1024;
                  const sizes = ['o', 'Ko', 'Mo', 'Go'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                })()}
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                {/* Clock / Study Timer Button */}
                <button
                  onClick={() => setShowStudyTimer(true)}
                  className={`px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 ${
                    timerRunning
                      ? 'bg-amber-400 text-stone-950 border-stone-900 animate-pulse'
                      : timerLeft < timerDuration
                      ? 'bg-amber-100 text-amber-900 border-stone-800'
                      : 'bg-white hover:bg-stone-100 text-stone-900'
                  }`}
                  title="Minuteur d'étude"
                >
                  <Clock className={`w-3.5 h-3.5 shrink-0 ${timerRunning ? 'text-stone-950' : 'text-blue-600'}`} />
                  <span className="text-[7.5px] sm:text-xs font-bold sm:font-extrabold leading-none text-center">
                    {timerRunning || timerLeft < timerDuration
                      ? formatTimerDisplay(timerLeft)
                      : 'Horloge'}
                  </span>
                </button>

                {/* Share Button */}
                <button
                  onClick={() => {
                    if (!activePreviewItem) return;
                    setShareModalTargetItems([activePreviewItem]);
                    setShareModalInitialName(activePreviewItem.name.replace(/\.[^/.]+$/, ''));
                    setShowCreateShareLinkModal(true);
                  }}
                  className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white hover:bg-stone-100 text-stone-900 rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 shrink-0"
                  title="Créer un lien de partage pour ce document"
                >
                  <Share2 className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                  <span className="text-[7.5px] sm:text-xs font-bold sm:font-extrabold leading-none text-center">
                    Partager
                  </span>
                </button>

                {/* Download Button */}
                <button
                  onClick={() => {
                    const content = activePreviewItem.url || `Ceci est le fichier ${activePreviewItem.name} téléchargé depuis UniFolder Share.`;
                    const blob = activePreviewItem.url && (activePreviewItem.url.startsWith('data:') || activePreviewItem.url.startsWith('blob:') || activePreviewItem.url.startsWith('http')) 
                      ? fetch(activePreviewItem.url).then(r => r.blob()).catch(() => new Blob([content], { type: 'text/plain;charset=utf-8' }))
                      : Promise.resolve(new Blob([content], { type: 'text/plain;charset=utf-8' }));
                    blob.then((b) => {
                      const url = URL.createObjectURL(b);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = activePreviewItem.name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    });
                  }}
                  className="px-2 sm:px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[11px] sm:text-xs rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  title="Télécharger le fichier"
                >
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area: 3 Columns on Desktop, Navigable Tabs on Mobile */}
          <div className="flex-1 w-full h-dvh relative">
            
            {/* Transparent blocker during resize so iframes (PDF/Viewer) never swallow mouse events */}
            {isResizingLeft && (
              <div 
                className="fixed inset-0 z-[999999] cursor-col-resize select-none bg-transparent"
                style={{ cursor: 'col-resize' }}
              />
            )}

            {/* Desktop 3-Column Grid / Mobile Single Tab */}
            <div 
              ref={previewContainerRef}
              className={`w-full h-full ${isMobileScreen ? 'flex flex-col' : 'grid'} gap-0 relative`}
              style={{
                gridTemplateColumns: isCenterFullscreen || isRightFullscreen 
                  ? '100%' 
                  : (isMobileScreen ? '100%' : `${previewLeftWidth}% ${100 - previewLeftWidth - previewRightWidth}% ${previewRightWidth}%`),
              }}
            >
              
              {/* Left Navigation Buttons (Mobile only) */}
              {!activePreviewItem?.lockFullscreen && isMobileScreen && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -ml-2 z-20">
                  <button 
                    onClick={() => setMobilePreviewTab(prev => Math.max(0, prev - 1) as 0|1|2)}
                    disabled={mobilePreviewTab === 0}
                    className={`p-2 rounded-full bg-white border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all ${mobilePreviewTab === 0 ? 'opacity-50' : 'active:translate-x-0.5 active:translate-y-0.5'}`}
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </div>
              )}

              {/* Right Navigation Buttons (Mobile only) */}
              {!activePreviewItem?.lockFullscreen && isMobileScreen && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 -mr-2 z-20">
                  <button 
                    onClick={() => setMobilePreviewTab(prev => Math.min(2, prev + 1) as 0|1|2)}
                    disabled={mobilePreviewTab === 2}
                    className={`p-2 rounded-full bg-white border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all ${mobilePreviewTab === 2 ? 'opacity-50' : 'active:translate-x-0.5 active:translate-y-0.5'}`}
                  >
                    <ArrowLeftRight className="w-5 h-5 rotate-180" />
                  </button>
                </div>
              )}

                {/* Column 1: Left Area */}
                <LeftMenu 
                  isCenterFullscreen={isCenterFullscreen}
                  isRightFullscreen={isRightFullscreen}
                  mobilePreviewTab={mobilePreviewTab}
                  isAssistantOpen={isAssistantOpen}
                  setIsAssistantOpen={setIsAssistantOpen}
                  setIsResizingLeft={setIsResizingLeft}
                  activePreviewItem={activePreviewItem}
                  setActivePreviewItem={setActivePreviewItem}
                  activeFolderDetail={activeFolderDetail}
                  isMobileScreen={isMobileScreen}
                  onImportFile={() => {
                    setActivePreviewItem(null);
                    handleSetTab('upload');
                  }}
                />

                {/* Column 2: Center Area */}
                <CenterMenu 
                  isCenterFullscreen={isCenterFullscreen}
                  setIsCenterFullscreen={setIsCenterFullscreen}
                  isRightFullscreen={isRightFullscreen}
                  mobilePreviewTab={mobilePreviewTab}
                  isPreviewLoading={isPreviewLoading}
                  activePreviewItem={activePreviewItem}
                  previewScrollMode={previewScrollMode}
                  setPreviewScrollMode={setPreviewScrollMode}
                  isMobileScreen={isMobileScreen}
                />

                {/* Column 3: Right Area */}
                <RightMenu 
                  isRightFullscreen={isRightFullscreen}
                  setIsRightFullscreen={setIsRightFullscreen}
                  isCenterFullscreen={isCenterFullscreen}
                  mobilePreviewTab={mobilePreviewTab}
                  activePreviewItem={activePreviewItem}
                  isMobileScreen={isMobileScreen}
                />

            </div>
          </div>

          {/* Share Toast Notification */}
          {shareToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100000] bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-[4px_4px_0px_0px_#e58325] border-2 border-stone-700 animate-fadeIn">
              🔗 Lien de partage copié dans le presse-papier !
            </div>
          )}
        </div>
      )}

      {/* Study Timer Modal */}
      <StudyTimerModal
        isOpen={showStudyTimer}
        onClose={() => setShowStudyTimer(false)}
        userId={user?.id || localStorage.getItem('unifolder_user_id') || undefined}
        timerLeft={timerLeft}
        setTimerLeft={setTimerLeft}
        timerDuration={timerDuration}
        setTimerDuration={setTimerDuration}
        timerRunning={timerRunning}
        setTimerRunning={setTimerRunning}
        customHours={customHours}
        setCustomHours={setCustomHours}
        customMinutes={customMinutes}
        setCustomMinutes={setCustomMinutes}
        customSeconds={customSeconds}
        setCustomSeconds={setCustomSeconds}
        timerFinishedAlert={timerFinishedAlert}
        setTimerFinishedAlert={setTimerFinishedAlert}
      />

      {/* Modal de Partage de Document / Dossier (Placé au premier plan absolu z-[100000]) */}
      {showCreateShareLinkModal && (
        <CreateShareLinkModal
          uploadedItems={shareModalTargetItems || uploadedItems}
          initialLinkName={shareModalInitialName}
          onClose={() => {
            setShowCreateShareLinkModal(false);
            setShareModalTargetItems(null);
            setShareModalInitialName('');
            setUploadedItems([]);
            setSelectedItemIds([]);
            try {
              localStorage.removeItem('unifolder_uploaded_items');
            } catch (e) {}
          }}
          onStartBackgroundCreation={handleStartBackgroundCreation}
        />
      )}
    </div>
  );
}
