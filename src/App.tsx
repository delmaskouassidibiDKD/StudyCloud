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
import { X, FolderPlus, Upload, ArrowLeft, Download, Share2, ArrowLeftRight } from 'lucide-react';
import { FileIconBadge } from './components/FileIconBadge';

export default function App() {
  const [folders, setFolders] = useState<SharedFolder[]>(() => {
    return INITIAL_FOLDERS.map((f) => ({ ...f, isPasswordProtected: true }));
  });

  const [currentTab, setCurrentTab] = useState<NavigationTab>(() => {
    const saved = localStorage.getItem('unifolder_current_tab');
    if (saved && ['folders', 'upload', 'share-portal', 'library', 'shared', 'settings', 'publish-file'].includes(saved)) {
      return saved as NavigationTab;
    }
    return 'folders';
  });

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 8000);
  };

  const handleStartBackgroundCreation = (linkName: string, comment: string, items: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean }[], onComplete?: (folder: SharedFolder) => void) => {
    setTimeout(() => {
      const files = items.map((item) => ({
        id: item.id,
        name: item.name,
        size: item.size,
        type: item.type || 'file',
        url: item.url,
      }));
      const totalSize = files.reduce((acc, f) => acc + f.size, 0);

      const newFolder: SharedFolder = {
        id: 'folder-' + Math.random().toString(36).substring(2, 9),
        title: linkName.trim(),
        description: comment.trim() ? `${comment.trim()} • Contient ${items.length} élément(s).` : `Dossier partagé contenant ${items.length} élément(s).`,
        category: 'Cours',
        author: 'Alexandre K.',
        createdAt: new Date().toISOString(),
        files,
        totalSize,
        downloadsCount: 0,
        isPasswordProtected: true,
        viewsCount: 0,
      };

      setFolders((prev) => [newFolder, ...prev]);
      setUploadedItems([]);
      showToast(`✨ Votre lien "${linkName.trim()}" a été créé avec succès ! Retrouvez-le dans le menu Partagés.`);
      if (onComplete) {
        onComplete(newFolder);
      }
    }, 3000);
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
  const [activePreviewItemState, setActivePreviewItemState] = useState<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const setActivePreviewItem = (item: { id: string; name: string; size: number; type: string; url?: string; isImage?: boolean } | null) => {
    if (!item) {
      setActivePreviewItemState(null);
      setIsPreviewLoading(false);
      return;
    }
    setIsPreviewLoading(true);
    setActivePreviewItemState(item);
    setTimeout(() => {
      setIsPreviewLoading(false);
    }, 1000);
  };

  const activePreviewItem = activePreviewItemState;
  const [previewScrollMode, setPreviewScrollMode] = useState<'vertical' | 'horizontal'>('vertical');
  const [shareToast, setShareToast] = useState(false);
  const [activeLongPressItem, setActiveLongPressItem] = useState<{ id: string; name: string; size: number; type: string; url?: string; isImage?: boolean } | null>(null);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [replacingItemId, setReplacingItemId] = useState<string | null>(null);
  
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
          let width = img.width;
          let height = img.height;
          const maxDim = 400;
          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        img.onerror = () => resolve(e.target?.result as string || '');
        img.src = e.target?.result as string;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

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

  const handleAddFolder = (newFolder: SharedFolder) => {
    setFolders((prev) => [newFolder, ...prev]);
    setCurrentTab('folders');
  };

  const handleDeleteFolder = (folderId: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (activeFolderDetail?.id === folderId) {
      setActiveFolderDetail(null);
    }
  };

  const handleIncrementDownload = (folderId: string) => {
    setFolders((prev) =>
      prev.map((f) => (f.id === folderId ? { ...f, downloadsCount: f.downloadsCount + 1 } : f))
    );
  };

  // If viewing a share link (e.g. #share=folder-id)
  if (shareId) {
    const sharedFolder = folders.find((f) => f.id === shareId);
    if (!sharedFolder) {
      return (
        <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center p-4">
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
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col md:flex-row font-sans text-stone-900">
      {/* Sidebar (Desktop & Mobile Nav) */}
      <Sidebar
        currentTab={currentTab}
        setTab={handleSetTab}
        foldersCount={folders.length}
        onOpenUpload={() => setShowUploadModal(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen pb-20 md:pb-0">
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
          shareUrl={`${window.location.origin}/#share=${activeQRCodeFolder.id}`}
          onClose={() => setActiveQRCodeFolder(null)}
        />
      )}

      {activePreviewItem && (
        <div className="fixed inset-0 z-[99999] bg-[#FDFBF7] flex flex-col animate-fadeIn overflow-hidden">
          {/* Top Header Bar */}
          <div className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7] py-1.5 px-3 md:px-6 border-b-2 border-stone-800 shadow-sm flex items-center justify-between gap-2">
            <button
              onClick={() => setActivePreviewItem(null)}
              className="flex items-center gap-1 px-2 py-1 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-[11px] sm:text-xs rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Retour</span>
            </button>
            <div className="text-center px-2 flex-1 max-w-xs sm:max-w-xl overflow-hidden">
              <p className="text-[11px] sm:text-xs font-bold text-stone-900 leading-tight line-clamp-3 overflow-hidden text-ellipsis break-all">{activePreviewItem.name}</p>
            </div>
            
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <span className="text-[9px] sm:text-[10px] text-stone-600 font-semibold px-1">
                {(() => {
                  const bytes = activePreviewItem.size;
                  if (!bytes) return '0 o';
                  const k = 1024;
                  const sizes = ['o', 'Ko', 'Mo', 'Go'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                })()}
              </span>
              <div className="flex items-center gap-2 sm:gap-3">
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
                  className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-[10px] sm:text-xs rounded-md border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1"
                  title="Partager le document"
                >
                  <Share2 className="w-3 h-3 text-orange-500" />
                  <span className="hidden md:inline">Partager</span>
                </button>

                {/* Vertical/Horizontal View Mode Toggle Button */}
                <button
                  onClick={() => setPreviewScrollMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
                  className="px-2 py-0.5 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-[10px] sm:text-xs rounded-md border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1"
                  title="Basculer entre défilement vertical et horizontal"
                >
                  <ArrowLeftRight className="w-3 h-3 text-stone-700" />
                  <span className="hidden md:inline">{previewScrollMode === 'vertical' ? 'Vertical' : 'Horizontal'}</span>
                </button>

                {/* Download Button */}
                <button
                  onClick={() => {
                    const content = activePreviewItem.url || `Ceci est le fichier ${activePreviewItem.name} téléchargé depuis UniFolder Share.`;
                    const blob = activePreviewItem.url && activePreviewItem.url.startsWith('data:') 
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
                  className="px-2.5 py-1 bg-orange-500 hover:bg-orange-600 text-white font-extrabold text-[11px] sm:text-xs rounded-lg border-2 border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1"
                  title="Télécharger le fichier"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Télécharger</span>
                </button>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className={`flex-1 w-full max-w-6xl mx-auto flex items-center justify-center p-4 md:p-8 mt-16 md:mt-20 mb-6 ${previewScrollMode === 'horizontal' ? 'overflow-x-auto flex-row snap-x' : 'overflow-auto flex-col'}`}>
            {isPreviewLoading ? (
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-stone-800 font-extrabold text-sm tracking-wide">Chargement du document...</p>
              </div>
            ) : activePreviewItem.isImage && activePreviewItem.url ? (
              <div className={`bg-white border-3 border-stone-800 rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1c1917] max-h-full flex items-center justify-center overflow-hidden ${previewScrollMode === 'horizontal' ? 'min-w-[80vw] snap-center shrink-0' : ''}`}>
                <img
                  src={activePreviewItem.url}
                  alt={activePreviewItem.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl"
                />
              </div>
            ) : (
              <div className={`bg-white border-3 border-stone-800 rounded-3xl p-8 sm:p-12 flex flex-col items-center justify-center text-center shadow-[6px_6px_0px_0px_#1c1917] max-w-md w-full animate-fadeIn ${previewScrollMode === 'horizontal' ? 'snap-center shrink-0 min-w-[320px]' : ''}`}>
                <div className="mb-6">
                  <FileIconBadge fileName={activePreviewItem.name} size={64} />
                </div>
                <h4 className="text-lg font-extrabold text-stone-900 mb-2">{activePreviewItem.name}</h4>
                <p className="text-xs text-stone-500 font-mono mb-6">
                  Taille : {(() => {
                    const bytes = activePreviewItem.size;
                    if (!bytes) return '0 o';
                    const k = 1024;
                    const sizes = ['o', 'Ko', 'Mo', 'Go'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                  })()} • Mode {previewScrollMode === 'vertical' ? 'Vertical' : 'Horizontal'}
                </p>
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 text-xs text-orange-900 font-medium leading-relaxed">
                  Ce document est entièrement chargé en mode {previewScrollMode === 'vertical' ? 'vertical (défilement haut en bas)' : 'horizontal (défilement latéral)'}.
                </div>
              </div>
            )}
          </div>

          {/* Share Toast Notification */}
          {shareToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100000] bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-[4px_4px_0px_0px_#e58325] border-2 border-stone-700 animate-fadeIn">
              🔗 Lien de partage copié dans le presse-papier !
            </div>
          )}
        </div>
      )}
    </div>
  );
}
