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
import { X, FolderPlus, Upload, ArrowLeft, Download, Share2, ArrowLeftRight, Maximize, Minimize, Dna, Menu, Clock } from 'lucide-react';
import { FileIconBadge } from './components/FileIconBadge';
import { AssistantChat } from './components/AssistantChat';
import { DnaLogo } from './components/DnaLogo';
import { LeftMenu } from './components/LeftMenu';
import { CenterMenu } from './components/CenterMenu';
import { RightMenu } from './components/RightMenu';
import { StudyTimerModal, formatTimerDisplay } from './components/StudyTimerModal';
import { StudyCloudAPI } from './services/api';
import { useAuth } from './context/AuthContext';
import { AuthPage } from './components/auth/AuthPage';
import { OnboardingPage } from './components/auth/OnboardingPage';
import { GoogleSecuritySetupPage } from './components/auth/GoogleSecuritySetupPage';

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

    if (googleCode && !isAuthenticated) {
      const redirectUri = `${window.location.origin}${window.location.pathname}`;
      const action = urlParams.get('state') || localStorage.getItem('sc_google_auth_mode') || 'login';
      localStorage.removeItem('sc_google_auth_mode');
      window.history.replaceState({}, '', window.location.pathname);
      StudyCloudAPI.googleAuth({ code: googleCode, redirectUri, action })
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
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return INITIAL_FOLDERS.map((f) => ({ ...f, isPasswordProtected: true }));
  });

  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    const saved = localStorage.getItem('unifolder_current_tab');
    if (saved && ['folders', 'upload', 'share-portal', 'library', 'shared', 'settings', 'publish-file'].includes(saved)) {
      return saved as NavigationTab;
    }
    return 'folders';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleSetTab = (tab: NavigationTab) => {
    if (tab !== 'publish-file') {
      localStorage.removeItem('published_selected_files');
    }
    setCurrentTab(tab);
  };

  useEffect(() => {
    localStorage.setItem('unifolder_current_tab', currentTab);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [currentTab]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 8000);
  };

  const handleStartBackgroundCreation = (
    linkName: string,
    comment: string,
    items: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[],
    onComplete?: (folder: SharedFolder) => void,
    isPublic: boolean = true
  ) => {
    setTimeout(async () => {
      const files = items.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type || 'file',
        url: item.url,
      }));
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);
      const folderId = 'folder-' + Math.random().toString(36).substring(2, 9);
      const shareCode = 'DKD-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      const userCountry = localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire";
      const userName = localStorage.getItem('unifolder_user_name') || 'Alexandre K.';
      const userSchool = localStorage.getItem('unifolder_user_school') || 'CME';
      const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
      const shareUrl = `${window.location.origin}/#share=${folderId}`;
      const qrCodeData = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(shareUrl)}`;

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
        isPasswordProtected: !isPublic,
        viewsCount: 0,
        shareCode,
        shareUrl,
        qrCodeData,
        isPublic,
        allowDownload: true,
      };

      setFolders((prev) => [newFolder, ...prev]);
      setUploadedItems([]);
      showToast(`✨ Votre lien "${linkName.trim()}" a été créé ! Code : ${shareCode} (${userCountry}). Retrouvez-le dans Partagés.`);

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
          isPasswordProtected: !isPublic,
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
    }, 2000);
  };

  // Modals state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [showCreateShareLinkModal, setShowCreateShareLinkModal] = useState(false);
  const [activeFolderDetail, setActiveFolderDetail] = useState<SharedFolder | null>(null);
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
  const [activePreviewItemState, setActivePreviewItemState] = useState<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean; folderName?: string; lockFullscreen?: boolean } | null>(null);
  const [previewOwnerTab, setPreviewOwnerTab] = useState<NavigationTab | null>('folders');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const setActivePreviewItem = (item: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean; folderName?: string; lockFullscreen?: boolean } | null) => {
    if (!item) {
      setActivePreviewItemState(null);
      setPreviewOwnerTab(null);
      setIsPreviewLoading(false);
      setIsCenterFullscreen(false);
      return;
    }
    setIsPreviewLoading(true);
    setActivePreviewItemState(item);
    setPreviewOwnerTab(currentTab || 'folders');
    if (item.lockFullscreen) {
      setIsCenterFullscreen(true);
      setMobilePreviewTab(1);
    }
    setTimeout(() => {
      setIsPreviewLoading(false);
    }, 1000);
  };

  const activePreviewItem = activePreviewItemState;
  const [previewScrollMode, setPreviewScrollMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [mobilePreviewTab, setMobilePreviewTab] = useState<0 | 1 | 2>(1);
  const [previewLeftWidth, setPreviewLeftWidth] = useState(33.33);
  const [previewRightWidth, setPreviewRightWidth] = useState(33.33);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isCenterFullscreen, setIsCenterFullscreen] = useState(false);
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
    if (!isResizingLeft && !isResizingRight) return;

    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!previewContainerRef.current) return;
      const rect = previewContainerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const percentage = (x / rect.width) * 100;

      if (isResizingLeft) {
        // Limit left column width between 25% and (100% - rightWidth - 30% for center)
        const newWidth = Math.min(Math.max(25, percentage), 100 - previewRightWidth - 30);
        setPreviewLeftWidth(newWidth);
      } else if (isResizingRight) {
        // Limit right column width between 25% and (100% - leftWidth - 30% for center)
        const newRightWidth = 100 - percentage;
        const boundedRight = Math.min(Math.max(25, newRightWidth), 100 - previewLeftWidth - 30);
        setPreviewRightWidth(boundedRight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight, previewLeftWidth, previewRightWidth]);


  const handleReplaceFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && replacingItemId) {
      const f = e.target.files[0];
      const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
      const isImg = !isPdf && (f.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif)$/i.test(f.name));
      
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
      localStorage.setItem('unifolder_uploaded_items', JSON.stringify(uploadedItems));
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
  const [shareId, setShareId] = useState<string | null>(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      return hash.replace('#share=', '');
    }
    return null;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#share=')) {
        setShareId(hash.replace('#share=', ''));
      } else {
        setShareId(null);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    localStorage.setItem('unifolder_shares', JSON.stringify(folders));
  }, [folders]);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;
    StudyCloudAPI.getShares(user.id)
      .then((res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          const mapped: SharedFolder[] = res.data.map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description || '',
            category: row.category || 'Cours',
            author: row.author_name || user.name || 'Étudiant',
            school: row.school || user.school || '',
            country: row.country || user.country || "Côte d'Ivoire",
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
            isPasswordProtected: Boolean(row.is_password_protected),
            password: row.password_hash || undefined,
            viewsCount: row.views_count || 0,
            shareCode: row.share_code,
            shareUrl: row.share_url,
            qrCodeData: row.qr_code_data,
            isPublic: Boolean(row.is_public),
            allowDownload: Boolean(row.allow_download),
          }));
          setFolders(mapped);
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

  // If viewing a share link (e.g. #share=folder-id)
  if (shareId) {
    const sharedFolder = folders.find((f) => f.id === shareId);
    if (!sharedFolder) {
      return (
        <div className="min-h-dvh bg-[#FDFBF7] flex items-center justify-center p-4">
          <div className="bg-[#F5F1E9] border-3 border-stone-800 rounded-2xl p-8 max-w-md text-center shadow-[6px_6px_0px_0px_#1c1917]">
            <h2 className="text-xl font-extrabold text-stone-900 mb-2">Dossier introuvable</h2>
            <p className="text-sm text-stone-600 mb-6">Le lien de partage est invalide ou le dossier a été supprimé par l'étudiant.</p>
            <button
              onClick={() => {
                window.location.hash = '';
                setShareId(null);
              }}
              className="bg-orange-500 text-white font-bold text-xs px-6 py-3 rounded-xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917]"
            >
              Retourner à l'accueil
            </button>
          </div>
        </div>
      );
    }
    return (
      <SharePortalView
        folder={sharedFolder}
        onBackToApp={() => {
          window.location.hash = '';
          setShareId(null);
        }}
        onIncrementDownload={handleIncrementDownload}
      />
    );
  }

  // Filter folders
  const filteredFolders = folders.filter((f) => {
    const matchesSearch =
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.files.some((file) => file.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'Tous' || f.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-dvh bg-[#FDFBF7] flex flex-col md:flex-row font-sans text-stone-900">
      {/* Sidebar (Desktop & Mobile Nav) */}
      <Sidebar
        currentTab={currentTab}
        setTab={handleSetTab}
        foldersCount={folders.length}
        onOpenUpload={() => setShowUploadModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-dvh pb-20 md:pb-0 md:ml-64">
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
            />
          ) : currentTab === 'publish-file' ? (
            <PublishFileView
              onBack={() => handleSetTab('folders')}
              onPublish={(title, description, category, files) => {
                const totalSize = files.reduce((acc, f) => acc + f.size, 0);
                const newFolder: SharedFolder = {
                  id: 'folder-' + Math.random().toString(36).substring(2, 9),
                  title,
                  description: description || `Publication de ${files.length} document(s).`,
                  category,
                  author: 'Utilisateur',
                  createdAt: new Date().toISOString(),
                  files,
                  totalSize,
                  downloadsCount: 0,
                  isPasswordProtected: false,
                  viewsCount: 0,
                };
                setFolders((prev) => [newFolder, ...prev]);
                showToast('Publications effectuées avec succès');
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
              onOpenClearConfirm={() => setShowClearConfirmModal(true)}
              onOpenCreateShareLink={() => setShowCreateShareLinkModal(true)}
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
            />
          ) : currentTab === 'library' ? (
            <LibraryView
              folders={folders}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSelectFolder={(folder) => setActiveFolderDetail(folder)}
              setActivePreviewItem={setActivePreviewItem}
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
        </main>
      </div>

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

      {showCreateShareLinkModal && (
        <CreateShareLinkModal
          uploadedItems={uploadedItems}
          onClose={() => setShowCreateShareLinkModal(false)}
          onStartBackgroundCreation={handleStartBackgroundCreation}
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
          shareUrl={activeQRCodeFolder.shareUrl || `${window.location.origin}/#share=${activeQRCodeFolder.id}`}
          shareCode={activeQRCodeFolder.shareCode}
          country={activeQRCodeFolder.country}
          isPublic={activeQRCodeFolder.isPublic}
          onClose={() => setActiveQRCodeFolder(null)}
        />
      )}

      {activePreviewItem && (previewOwnerTab ? previewOwnerTab === currentTab : currentTab === 'folders') && (
        <div className="fixed inset-0 md:left-64 z-[99999] bg-[#FDFBF7] dark:bg-[#0b0f19] flex flex-col animate-fadeIn overflow-hidden">
          {/* Top Header Bar - Solid Dark #070a13 */}
          <div className="fixed top-0 left-0 right-0 md:left-64 z-50 bg-[#FDFBF7] dark:bg-[#070a13] py-1.5 px-3 md:px-6 border-b-2 border-stone-800 dark:border-[#1e293b] shadow-sm flex items-center justify-between gap-2">
            {/* Left: Bouton Retour et badge du dossier/matière juste derrière */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActivePreviewItem(null)}
                className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-[#1e293b] hover:bg-stone-100 dark:hover:bg-[#283852] text-stone-900 dark:text-white font-extrabold text-[11px] sm:text-xs rounded-lg border-2 border-stone-800 dark:border-[#334155] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3 h-3 text-stone-900 dark:text-white" />
                <span>Retour</span>
              </button>

              {(activePreviewItem.folderName || activeFolderDetail?.title) && (
                <span className="text-[10px] sm:text-[11px] font-black text-stone-800 dark:text-orange-400 uppercase tracking-widest max-w-[140px] sm:max-w-[220px] truncate bg-[#E8DFD0] dark:bg-[#111a2e] px-2.5 py-1 rounded-lg border-2 border-stone-800 dark:border-[#1e293b] shadow-[1px_1px_0px_0px_#1c1917] dark:shadow-none shrink-0 text-center">
                  {activePreviewItem.folderName || activeFolderDetail?.title}
                </span>
              )}
            </div>

            {/* Center: Nom du fichier (masqué sur mobile car pas assez de place) */}
            <div className="hidden md:flex flex-1 items-center justify-center gap-2 overflow-hidden px-1 sm:px-2 min-w-0">
              <p className="text-[11px] sm:text-xs font-bold text-stone-900 dark:text-white leading-tight truncate overflow-hidden text-ellipsis text-center max-w-sm lg:max-w-md">
                {activePreviewItem.name}
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-[9px] sm:text-[10px] text-stone-600 dark:text-slate-300 font-semibold px-1">
                {(() => {
                  const bytes = activePreviewItem.size;
                  if (!bytes) return '0 o';
                  const k = 1024;
                  const sizes = ['o', 'Ko', 'Mo', 'Go'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                })()}
              </span>
              <div className="flex items-center gap-1.5 sm:gap-2.5">
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
                    const shareUrl = window.location.href;
                    navigator.clipboard.writeText(shareUrl).then(() => {
                      setShareToast(true);
                      setTimeout(() => setShareToast(false), 2500);
                    }).catch(() => {
                      alert("Lien du document copié dans le presse-papier !");
                    });
                  }}
                  className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-white hover:bg-stone-100 text-stone-900 rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 shrink-0"
                  title="Partager le document"
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
          <div className="flex-1 w-full h-dvh">
            
            {/* Desktop 3-Column Grid / Mobile Single Tab */}
            <div 
              ref={previewContainerRef}
              className={`w-full h-full ${isMobileScreen ? 'flex flex-col' : 'grid'} gap-0 relative ${isResizingLeft || isResizingRight ? 'select-none pointer-events-none' : ''}`}
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
    </div>
  );
}
