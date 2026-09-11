import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Search, FileText, Download, Folder, Eye, Sparkles, Building2, Menu, X, GraduationCap, Package, ChevronDown, ArrowLeft, Share2, Copy, ShoppingCart, RefreshCw, Globe, Hash } from 'lucide-react';
import { SharedFolder, SharedFile } from '../types';
import { FileIconBadge } from './FileIconBadge';
import { StudyCloudAPI } from '../services/api';

interface ProductItem {
  id: string;
  title: string;
  description: string;
  price: string;
  category: string;
  date: string;
  views?: number;
  sales?: number;
  imageUrl?: string;
  imageUrls?: string[];
}

interface LibraryViewProps {
  folders: SharedFolder[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onSelectFolder: (folder: SharedFolder) => void;
  setActivePreviewItem: (file: any) => void;
}

const DEFAULT_PRODUCTS: ProductItem[] = [
  {
    id: '1',
    title: "Cours d'Électrotechnique S1",
    description: 'Résumés complets et schémas expliqués pour le premier semestre.',
    price: '5 €',
    category: 'Cours',
    date: '02/09/2026',
    imageUrls: [],
  },
  {
    id: '2',
    title: 'Aide Projet Arduino',
    description: 'Assistance pour câblage, schémas et programmation C++.',
    price: '15 €',
    category: 'Service',
    date: '01/09/2026',
    imageUrls: [],
  },
  {
    id: '3',
    title: 'Annales Corrigées Physique - L2',
    description: 'Sujets d\'examens résolus avec explications détaillées étape par étape.',
    price: '8 €',
    category: 'Examens',
    date: '31/08/2026',
    imageUrls: [],
  },
  {
    id: '4',
    title: 'Fiches de Synthèse Thermodynamique',
    description: 'Formules clés et fiches mémo condensées pour révisions rapides.',
    price: '6 €',
    category: 'Notes',
    date: '28/08/2026',
    imageUrls: [],
  },
];

export const LibraryView: React.FC<LibraryViewProps> = ({
  folders,
  searchQuery,
  setSearchQuery,
  onSelectFolder,
  setActivePreviewItem,
}) => {
  const [selectedCategory, setSelectedCategory] = useState('Tous');
  const [activeSubTab, setActiveSubTab] = useState<'librairie' | 'ressources' | 'liens'>('librairie');
  const [selectedSchoolFilter, setSelectedSchoolFilter] = useState<string | null>(null);
  const [selectedFiliereFilter, setSelectedFiliereFilter] = useState<string | null>(null);
  const [isRecentFilterActive, setIsRecentFilterActive] = useState<boolean>(false);
  const [showSchoolsModal, setShowSchoolsModal] = useState(false);
  const [showFiliereModal, setShowFiliereModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [activeCategoryTooltipId, setActiveCategoryTooltipId] = useState<string | null>(null);

  useEffect(() => {
    const handleDocumentClick = () => setActiveCategoryTooltipId(null);
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, []);

  // ---- Published Documents (onglet Ressources) ----
  const [publishedDocs, setPublishedDocs] = useState<any[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  const loadPublishedDocs = useCallback(async () => {
    setIsLoadingDocs(true);
    setDocsError(null);
    try {
      const filters: any = {};
      if (selectedSchoolFilter) filters.school = selectedSchoolFilter;
      if (selectedFiliereFilter) filters.filiere = selectedFiliereFilter;
      if (selectedCategory !== 'Tous') filters.category = selectedCategory;
      if (searchQuery.trim()) filters.search = searchQuery.trim();
      filters.isPublic = true;
      const res = await StudyCloudAPI.getPublishedDocuments(filters);
      setPublishedDocs(res.data || []);
    } catch (err: any) {
      setDocsError(err.message || 'Erreur de chargement');
      setPublishedDocs([]);
    } finally {
      setIsLoadingDocs(false);
    }
  }, [selectedSchoolFilter, selectedFiliereFilter, selectedCategory, searchQuery]);

  useEffect(() => {
    if (activeSubTab === 'ressources') {
      loadPublishedDocs();
    }
  }, [activeSubTab, loadPublishedDocs]);

  // Products state for Librairie tab
  const [productsList, setProductsList] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_published_products');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_PRODUCTS;
  });

  const [selectedDetailProduct, setSelectedDetailProduct] = useState<ProductItem | null>(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Cart state
  const [cartItemIds, setCartItemIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_cart');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });
  const [isCartViewOpen, setIsCartViewOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('unifolder_cart', JSON.stringify(cartItemIds));
    } catch (e) {}
  }, [cartItemIds]);

  const toggleCartItem = (productId: string, productTitle: string) => {
    if (cartItemIds.includes(productId)) {
      setCartItemIds(prev => prev.filter(id => id !== productId));
      triggerToast(`"${productTitle}" retiré du panier`);
    } else {
      setCartItemIds(prev => [...prev, productId]);
      triggerToast(`"${productTitle}" ajouté au panier !`);
    }
  };

  const cartProducts = productsList.filter(item => cartItemIds.includes(item.id));

  // Store info state
  const [shopName, setShopName] = useState(() => localStorage.getItem('unifolder_shop_name') || 'DKD Technologies');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('unifolder_shop_phone') || '+225 07 00 00 00 00');
  const [shopAvatarUrl, setShopAvatarUrl] = useState(() => localStorage.getItem('unifolder_shop_avatar') || '');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('unifolder_published_products');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) setProductsList(parsed);
        }
        const name = localStorage.getItem('unifolder_shop_name');
        if (name) setShopName(name);
        const phone = localStorage.getItem('unifolder_shop_phone');
        if (phone) setShopPhone(phone);
        const avatar = localStorage.getItem('unifolder_shop_avatar');
        if (avatar !== null) setShopAvatarUrl(avatar);
      } catch (e) {}
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const handleDownloadFolder = (folder: SharedFolder, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!folder.files || folder.files.length === 0) {
      return;
    }
    folder.files.forEach((file, index) => {
      setTimeout(() => {
        handleDownloadSingle(file, folder.title);
      }, index * 250);
    });
  };

  const handleCopyLink = (folder: SharedFolder) => {
    const url = `${window.location.origin}/#share=${folder.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLinkId(folder.id);
      setTimeout(() => setCopiedLinkId(null), 2000);
    }).catch(() => {
      alert("Lien copié dans le presse-papier !");
    });
  };

  const handleDownloadSingle = (file: SharedFile, folderTitle: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const content = file.url || `Ceci est le fichier ${file.name} téléchargé depuis UniFolder Share.\nDossier: ${folderTitle}`;
    const blob = file.url && file.url.startsWith('data:') 
      ? fetch(file.url).then(r => r.blob()).catch(() => new Blob([content], { type: 'text/plain;charset=utf-8' }))
      : Promise.resolve(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    
    blob.then((b) => {
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };
  const allFilesWithFolder: { file: SharedFile; folder: SharedFolder }[] = [];
  folders.forEach((folder) => {
    folder.files.forEach((file) => {
      allFilesWithFolder.push({ file, folder });
    });
  });

  const categories = ['Tous', 'Cours', 'TD/TP', 'Examens', 'Projets', 'Notes'];

  const filteredItems = allFilesWithFolder.filter(({ file, folder }) => {
    const matchesSearch =
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      folder.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (folder.category && folder.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (folder.school && folder.school.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = selectedCategory === 'Tous' || folder.category === selectedCategory;

    const matchesSchool = !selectedSchoolFilter || (
      folder.school && (
        folder.school.toLowerCase().includes(selectedSchoolFilter.toLowerCase()) ||
        selectedSchoolFilter.toLowerCase().includes(folder.school.toLowerCase())
      )
    );

    const matchesFiliere = !selectedFiliereFilter || (
      folder.category && (
        folder.category.toLowerCase().includes(selectedFiliereFilter.toLowerCase()) ||
        selectedFiliereFilter.toLowerCase().includes(folder.category.toLowerCase())
      )
    );

    return matchesSearch && matchesCategory && matchesSchool && matchesFiliere;
  });

  const getFileBadgeInfo = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') {
      return { label: 'PDF', bg: 'bg-red-600', text: 'text-white' };
    } else if (['doc', 'docx'].includes(ext)) {
      return { label: 'W', bg: 'bg-blue-600', text: 'text-white' };
    } else if (['xls', 'xlsx'].includes(ext)) {
      return { label: 'X', bg: 'bg-emerald-600', text: 'text-white' };
    } else if (['ppt', 'pptx'].includes(ext)) {
      return { label: 'P', bg: 'bg-orange-600', text: 'text-white' };
    } else if (['txt', 'md'].includes(ext)) {
      return { label: 'T', bg: 'bg-slate-600', text: 'text-white' };
    } else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) {
      return { label: 'IMG', bg: 'bg-purple-600', text: 'text-white' };
    } else {
      return { label: ext.toUpperCase() || 'FILE', bg: 'bg-stone-700', text: 'text-white' };
    }
  };

  return (
    <div className="flex flex-col space-y-4 pb-24 pt-24 md:pt-26 animate-fadeIn w-full px-2 sm:px-4">
      {/* Fixed Header Container enclosing search bar and 3 fixed compact buttons */}
      <div className="fixed top-0 left-0 right-0 md:left-64 z-40 bg-[#FDFBF7] border-b-2 border-stone-800 shadow-sm px-3 sm:px-6 pt-2.5 pb-2 space-y-2">
        <div className="flex items-center justify-between gap-2 sm:gap-3 w-full">
          {/* Expanded Search input */}
          <div className="relative flex-1 min-w-[120px]">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-stone-400">
              <Search className="w-3.5 h-3.5" />
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                activeSubTab === 'librairie'
                  ? "Rechercher un livre, cours, produit..."
                  : activeSubTab === 'ressources'
                  ? "Rechercher un fichier ou dossier..."
                  : "Rechercher un lien public ou dossier..."
              }
              className="w-full bg-white border-2 border-stone-800 rounded-xl pl-8 pr-3 py-1.5 text-xs font-medium outline-none shadow-[2px_2px_0px_0px_#1c1917]"
            />
          </div>

          {/* Top Right Cart Button for 'librairie' tab */}
          {activeSubTab === 'librairie' && (
            <button
              type="button"
              onClick={() => setIsCartViewOpen(!isCartViewOpen)}
              className={`px-3 py-1.5 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                isCartViewOpen ? 'bg-amber-400 text-stone-900' : 'bg-white hover:bg-stone-100 text-stone-900'
              }`}
              title="Voir mon panier"
            >
              <ShoppingCart className="w-4 h-4 text-stone-900" />
              <span className="hidden sm:inline font-extrabold">Panier</span>
            </button>
          )}

          {/* Right side buttons (Filière, Schools & Menu): Render ONLY in 'ressources' tab */}
          {activeSubTab === 'ressources' && (
            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              {/* Filière Button */}
              <button
                onClick={() => setShowFiliereModal(true)}
                className="px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5"
                title="Filières d'études"
              >
                <GraduationCap className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Filière</span>
              </button>

              {/* Schools Button */}
              <button
                onClick={() => setShowSchoolsModal(true)}
                className="px-2.5 py-1.5 bg-white hover:bg-stone-100 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center gap-1.5"
                title="Écoles partenaires"
              >
                <Building2 className="w-3.5 h-3.5 text-orange-600" />
                <span className="hidden sm:inline">Écoles</span>
              </button>

              {/* Three-line Menu Button at the very right */}
              <button
                onClick={() => setShowMenuModal(true)}
                className="p-2 bg-white hover:bg-stone-100 text-stone-900 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center"
                title="Menu principal"
              >
                <Menu className="w-4 h-4 text-stone-800" />
              </button>
            </div>
          )}
        </div>

        {/* 3 Fixed Compact Navigation Buttons: Centered & Balanced across row */}
        <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 w-full pt-0.5">
          <button
            type="button"
            onClick={() => { setActiveSubTab('librairie'); setIsRecentFilterActive(false); }}
            className={`flex-1 max-w-[135px] justify-center px-2 sm:px-3 py-1 text-xs font-extrabold rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
              activeSubTab === 'librairie'
                ? 'bg-amber-400 text-stone-900 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-800'
            }`}
          >
            <span>📚</span>
            <span>Librairie</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('ressources'); setIsCartViewOpen(false); }}
            className={`flex-1 max-w-[135px] justify-center px-2 sm:px-3 py-1 text-xs font-extrabold rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
              activeSubTab === 'ressources'
                ? 'bg-orange-500 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-800'
            }`}
          >
            <span>📁</span>
            <span>Ressources</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveSubTab('liens'); setIsCartViewOpen(false); setIsRecentFilterActive(false); }}
            className={`flex-1 max-w-[135px] justify-center px-2 sm:px-3 py-1 text-xs font-extrabold rounded-xl border-2 transition-all cursor-pointer flex items-center gap-1 sm:gap-1.5 shrink-0 ${
              activeSubTab === 'liens'
                ? 'bg-blue-600 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-800'
            }`}
          >
            <span>🔗</span>
            <span className="truncate">Liens publics</span>
          </button>
        </div>
      </div>

      {/* Filière Side Menu Modal */}
      {showFiliereModal && (
        <div className="fixed inset-0 z-[99999]" onClick={() => setShowFiliereModal(false)}>
          <div className="absolute top-16 right-28 bg-[#2A2A2A] text-white border-2 border-stone-700 rounded-2xl py-2 w-64 shadow-[0px_10px_30px_rgba(0,0,0,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-stone-700 mb-1 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">Filtrer par filière</span>
              <button onClick={() => setShowFiliereModal(false)} className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>
            <div className="flex flex-col">
              <button 
                onClick={() => {
                  setSelectedFiliereFilter('Informatique');
                  setSelectedSchoolFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowFiliereModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between border-b border-stone-800 cursor-pointer ${
                  selectedFiliereFilter === 'Informatique' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>💻 Informatique & Génie Logiciel</span>
                {selectedFiliereFilter === 'Informatique' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
              <button 
                onClick={() => {
                  setSelectedFiliereFilter('Mathématiques');
                  setSelectedSchoolFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowFiliereModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between border-b border-stone-800 cursor-pointer ${
                  selectedFiliereFilter === 'Mathématiques' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>📐 Mathématiques & Appliquées</span>
                {selectedFiliereFilter === 'Mathématiques' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
              <button 
                onClick={() => {
                  setSelectedFiliereFilter('Droit');
                  setSelectedSchoolFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowFiliereModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between border-b border-stone-800 cursor-pointer ${
                  selectedFiliereFilter === 'Droit' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>⚖️ Droit & Sciences Politiques</span>
                {selectedFiliereFilter === 'Droit' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
              <button 
                onClick={() => {
                  setSelectedFiliereFilter('Médecine');
                  setSelectedSchoolFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowFiliereModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                  selectedFiliereFilter === 'Médecine' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>🩺 Médecine & Santé</span>
                {selectedFiliereFilter === 'Médecine' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schools Side Menu Modal */}
      {showSchoolsModal && (
        <div className="fixed inset-0 z-[99999]" onClick={() => setShowSchoolsModal(false)}>
          <div className="absolute top-16 right-16 bg-[#2A2A2A] text-white border-2 border-stone-700 rounded-2xl py-2 w-64 shadow-[0px_10px_30px_rgba(0,0,0,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 py-2 border-b border-stone-700 mb-1 flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-orange-400">Écoles partenaires</span>
              <button onClick={() => setShowSchoolsModal(false)} className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer">✕</button>
            </div>
            <div className="flex flex-col">
              <button 
                onClick={() => {
                  setSelectedSchoolFilter('Université Paris-Saclay');
                  setSelectedFiliereFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowSchoolsModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between border-b border-stone-800 cursor-pointer ${
                  selectedSchoolFilter === 'Université Paris-Saclay' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>🏛️ Université Paris-Saclay</span>
                {selectedSchoolFilter === 'Université Paris-Saclay' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
              <button 
                onClick={() => {
                  setSelectedSchoolFilter('Université Félix Houphouët-Boigny');
                  setSelectedFiliereFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowSchoolsModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between border-b border-stone-800 cursor-pointer ${
                  selectedSchoolFilter === 'Université Félix Houphouët-Boigny' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>🏛️ Université Félix Houphouët-Boigny</span>
                {selectedSchoolFilter === 'Université Félix Houphouët-Boigny' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
              <button 
                onClick={() => {
                  setSelectedSchoolFilter('École Polytechnique');
                  setSelectedFiliereFilter(null);
                  setIsRecentFilterActive(false);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowSchoolsModal(false);
                }}
                className={`w-full text-left px-4 py-3 hover:bg-stone-700/60 text-xs font-semibold transition-colors flex items-center justify-between cursor-pointer ${
                  selectedSchoolFilter === 'École Polytechnique' ? 'text-orange-400 font-bold bg-stone-700/40' : 'text-stone-200'
                }`}
              >
                <span>🏛️ École Polytechnique</span>
                {selectedSchoolFilter === 'École Polytechnique' && <span className="text-[10px] text-orange-400 font-bold">Actif</span>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Three-line Menu Side Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-[99999] bg-black/40 backdrop-blur-sm animate-fadeIn" onClick={() => setShowMenuModal(false)}>
          <div className="absolute top-16 right-3 md:right-8 bg-[#2A2A2A] text-white border-2 border-stone-700 rounded-2xl py-2 w-64 md:w-80 shadow-[0px_10px_30px_rgba(0,0,0,0.3)] animate-fadeIn" onClick={(e) => e.stopPropagation()}>
            <div className="px-4 md:px-5 py-3 md:py-4 border-b border-stone-700 mb-1 flex items-center justify-between">
              <span className="text-xs md:text-sm font-extrabold uppercase tracking-wider text-orange-400">Options du menu</span>
              <button onClick={() => setShowMenuModal(false)} className="text-stone-400 hover:text-white text-xs md:text-sm font-bold">✕</button>
            </div>
            <div className="flex flex-col">
              <button 
                onClick={() => { setShowMenuModal(false); }}
                className="w-full text-left px-4 md:px-5 py-3 md:py-4 hover:bg-stone-700/60 text-xs md:text-sm font-semibold text-stone-200 transition-colors border-b border-stone-800 flex items-center gap-3 cursor-pointer"
              >
                <span className="text-base md:text-lg">👁️</span> Voir l'aperçu des fichiers
              </button>
              <button 
                onClick={() => {
                  setIsRecentFilterActive(true);
                  setSelectedSchoolFilter(null);
                  setSelectedFiliereFilter(null);
                  setSelectedCategory('Tous');
                  setActiveSubTab('ressources');
                  setShowMenuModal(false);
                }}
                className="w-full text-left px-4 md:px-5 py-3 md:py-4 hover:bg-stone-700/60 text-xs md:text-sm font-semibold text-stone-200 transition-colors flex items-center gap-3 cursor-pointer"
              >
                <span className="text-base md:text-lg">📚</span> Tous les fichiers récents
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Scrollable Area */}
      <div className="w-full">
        {/* ONGLET LIBRAIRIE */}
        {activeSubTab === 'librairie' && (
          <div className="space-y-4">
            {/* Si le panier est ouvert, afficher la vue du panier avec le bouton Retour 3D et le titre centré */}
            {isCartViewOpen ? (
              <div className="space-y-4">
                {/* Header connecté avec bouton Retour 3D Pilule et Titre Mon Panier centré */}
                <div className="sticky top-[92px] z-30 bg-[#FDFBF7]/95 backdrop-blur-sm -mt-2 pt-1 pb-2 mb-2 flex items-center justify-between gap-2 border-b border-stone-200/80">
                  {/* 3D Pill 'Retour' Button */}
                  <button
                    type="button"
                    onClick={() => setIsCartViewOpen(false)}
                    className="px-3.5 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-900 rounded-full border-2 border-stone-800 shadow-[2.5px_2.5px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center gap-2 shrink-0 active:translate-x-0.5 active:translate-y-0.5"
                    title="Retour à la librairie"
                  >
                    <ArrowLeft className="w-4 h-4 stroke-[2.5] text-stone-900" />
                    <span className="font-black text-xs sm:text-sm text-stone-900 tracking-tight">Retour</span>
                  </button>

                  {/* Centered Cart Title */}
                  <div className="flex-1 flex items-center justify-center gap-2 font-black text-xs sm:text-sm md:text-base text-stone-900 text-center px-1 truncate">
                    <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600 shrink-0" />
                    <span className="truncate">Mon Panier ({cartProducts.length})</span>
                  </div>

                  {/* Invisible spacer to maintain centered title */}
                  <div className="w-[88px] sm:w-[98px] shrink-0 pointer-events-none" aria-hidden="true" />
                </div>

                {cartProducts.length === 0 ? (
                  <div className="bg-[#FDFBF7] border-2 border-stone-300 rounded-2xl p-12 text-center shadow-xs">
                    <div className="w-12 h-12 bg-amber-100 border-2 border-stone-800 rounded-2xl flex items-center justify-center text-amber-700 mx-auto mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
                      <ShoppingCart className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-extrabold text-stone-900">Votre panier est vide</h3>
                    <p className="text-xs text-stone-600 mt-1">Parcourez les produits de la librairie pour ajouter des articles à votre panier !</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                    {cartProducts.map((item) => {
                      const displayImages = item.imageUrls && item.imageUrls.length > 0
                        ? item.imageUrls
                        : (item.imageUrl ? [item.imageUrl] : []);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedDetailProduct(item);
                            setActiveDetailImageIndex(0);
                            setIsDescriptionExpanded(false);
                          }}
                          className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                        >
                          <div>
                            {/* Top Image Box */}
                            <div className="w-full h-36 sm:h-44 bg-stone-100/80 relative overflow-hidden flex items-center justify-center p-3">
                              {displayImages.length > 0 ? (
                                <img
                                  src={displayImages[0]}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300">
                                  <Package className="w-12 h-12 stroke-[1.5]" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="p-3 sm:p-3.5 space-y-1">
                              <h4 className="font-extrabold text-xs sm:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] sm:text-xs text-stone-500 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="p-3 sm:p-3.5 pt-0 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <div className="font-extrabold text-sm sm:text-base text-orange-600">
                                {item.price}
                              </div>

                              {/* Non-3D Cart button above Commander button (on the right) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCartItem(item.id, item.title);
                                }}
                                className="px-2.5 py-1 bg-amber-100 text-amber-900 border border-amber-300 font-extrabold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 hover:bg-amber-200"
                                title="Retirer du panier"
                              >
                                <ShoppingCart className="w-3.5 h-3.5 text-amber-800 fill-amber-700" />
                                <span className="text-[11px]">Ajouté</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerToast(`Commande initiée pour "${item.title}" !`);
                              }}
                              className="w-full py-2 sm:py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
                            >
                              Commander
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* Vue standard des produits */
              productsList.filter(item => 
                item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
              ).length === 0 ? (
                <div className="bg-[#FDFBF7] border-2 border-stone-300 rounded-2xl p-12 text-center shadow-xs">
                  <div className="w-12 h-12 bg-orange-100 border-2 border-stone-800 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
                    <Package className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-stone-900">Aucun produit trouvé</h3>
                  <p className="text-xs text-stone-600 mt-1">Aucun produit ne correspond à votre recherche.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 w-full">
                  {productsList
                    .filter(item => 
                      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
                    )
                    .map((item) => {
                      const displayImages = item.imageUrls && item.imageUrls.length > 0
                        ? item.imageUrls
                        : (item.imageUrl ? [item.imageUrl] : []);

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedDetailProduct(item);
                            setActiveDetailImageIndex(0);
                            setIsDescriptionExpanded(false);
                          }}
                          className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                        >
                          <div>
                            {/* Top Image Box */}
                            <div className="w-full h-36 sm:h-44 bg-stone-100/80 relative overflow-hidden flex items-center justify-center p-3">
                              {displayImages.length > 0 ? (
                                <img
                                  src={displayImages[0]}
                                  alt={item.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-300">
                                  <Package className="w-12 h-12 stroke-[1.5]" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="p-3 sm:p-3.5 space-y-1">
                              <h4 className="font-extrabold text-xs sm:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                                {item.title}
                              </h4>
                              {item.description && (
                                <p className="text-[11px] sm:text-xs text-stone-500 line-clamp-1">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="p-3 sm:p-3.5 pt-0 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <div className="font-extrabold text-sm sm:text-base text-orange-600">
                                {item.price}
                              </div>

                              {/* Non-3D Cart button above Commander button (on the right) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleCartItem(item.id, item.title);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
                                  cartItemIds.includes(item.id)
                                    ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold hover:bg-amber-200'
                                    : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                                }`}
                                title={cartItemIds.includes(item.id) ? "Retirer du panier" : "Ajouter au panier"}
                              >
                                <ShoppingCart className={`w-3.5 h-3.5 ${cartItemIds.includes(item.id) ? 'text-amber-800 fill-amber-700' : 'text-stone-700'}`} />
                                <span className="text-[11px]">
                                  {cartItemIds.includes(item.id) ? 'Ajouté' : 'Ajouter'}
                                </span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                triggerToast(`Commande initiée pour "${item.title}" !`);
                              }}
                              className="w-full py-2 sm:py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
                            >
                              Commander
                            </button>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )
            )}
          </div>
        )}

        {/* ONGLET RESSOURCES (Actuel) */}
        {activeSubTab === 'ressources' && (
          <div className="space-y-3">
            {/* If a School, Filière or Recent Files filter is active, show sticky header connected to top navigation with centered title & 3D pill 'Retour' button */}
            {(selectedSchoolFilter || selectedFiliereFilter || isRecentFilterActive) ? (
              <div className="sticky top-[92px] z-30 bg-[#FDFBF7]/95 backdrop-blur-sm -mt-2 pt-1 pb-2 mb-2 flex items-center justify-between gap-2 border-b border-stone-200/80">
                {/* 3D Pill 'Retour' Button matching user design */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSchoolFilter(null);
                    setSelectedFiliereFilter(null);
                    setIsRecentFilterActive(false);
                  }}
                  className="px-3.5 py-1.5 bg-white hover:bg-stone-100 active:bg-stone-200 text-stone-900 rounded-full border-2 border-stone-800 shadow-[2.5px_2.5px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center gap-2 shrink-0 active:translate-x-0.5 active:translate-y-0.5"
                  title="Retour"
                >
                  <ArrowLeft className="w-4 h-4 stroke-[2.5] text-stone-900" />
                  <span className="font-black text-xs sm:text-sm text-stone-900 tracking-tight">Retour</span>
                </button>

                {/* Centered Title */}
                <div className="flex-1 flex items-center justify-center gap-2 font-black text-xs sm:text-sm md:text-base text-stone-900 text-center px-1 truncate">
                  {selectedSchoolFilter ? (
                    <>
                      <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 shrink-0" />
                      <span className="truncate">{selectedSchoolFilter}</span>
                    </>
                  ) : selectedFiliereFilter ? (
                    <>
                      <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 shrink-0" />
                      <span className="truncate">{selectedFiliereFilter}</span>
                    </>
                  ) : (
                    <>
                      <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-600 shrink-0" />
                      <span className="truncate">Tous les fichiers récents</span>
                    </>
                  )}
                </div>

                {/* Spacer on right to ensure mathematical centering of school title */}
                <div className="w-[88px] sm:w-[98px] shrink-0 pointer-events-none" aria-hidden="true" />
              </div>
            ) : (
              /* Filtre de recherche rapide par catégorie */
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-2.5 py-1 text-xs font-extrabold rounded-lg border transition-all cursor-pointer whitespace-nowrap ${
                      selectedCategory === cat
                        ? 'bg-stone-900 text-white border-stone-900 shadow-[1px_1px_0px_0px_#1c1917]'
                        : 'bg-white hover:bg-stone-100 text-stone-700 border-stone-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Bouton Actualiser */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-stone-500 font-medium">
                {isLoadingDocs ? 'Chargement...' : `${publishedDocs.length} document${publishedDocs.length > 1 ? 's' : ''} publié${publishedDocs.length > 1 ? 's' : ''}`}
              </span>
              <button
                onClick={loadPublishedDocs}
                disabled={isLoadingDocs}
                className="flex items-center gap-1 px-2 py-1 bg-white border border-stone-300 rounded-lg text-[10px] font-bold text-stone-700 hover:bg-stone-100 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingDocs ? 'animate-spin' : ''}`} />
                Actualiser
              </button>
            </div>

            {/* Contenu : Documents Publiés */}
            {isLoadingDocs ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <RefreshCw className="w-8 h-8 text-orange-500 animate-spin" />
                <p className="text-xs text-stone-500 font-medium">Chargement des ressources...</p>
              </div>
            ) : docsError ? (
              <div className="bg-red-50 border-2 border-red-400 rounded-2xl p-6 text-center">
                <p className="text-xs font-bold text-red-700">⚠️ {docsError}</p>
                <button onClick={loadPublishedDocs} className="mt-3 px-4 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg cursor-pointer hover:bg-red-700">Réessayer</button>
              </div>
            ) : publishedDocs.length === 0 ? (
              <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_#1c1917]">
                <div className="w-12 h-12 bg-orange-100 border-2 border-stone-800 rounded-2xl flex items-center justify-center text-orange-600 mx-auto mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="text-base font-extrabold text-stone-900">Aucun document trouvé</h3>
                <p className="text-xs text-stone-600 mt-1">Essayez de modifier vos filtres ou publiez un document depuis vos fichiers.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-2.5 lg:gap-3 w-full">
                {publishedDocs.map((doc) => {
                  const docSizeStr = (() => {
                    const bytes = doc.file_size || 0;
                    if (!bytes) return '—';
                    const k = 1024;
                    const sizes = ['o', 'Ko', 'Mo', 'Go'];
                    const i = Math.floor(Math.log(bytes) / Math.log(k));
                    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                  })();

                  return (
                    <div
                      key={doc.id}
                      className="bg-[#FDFBF7] border-2 border-stone-800 rounded-xl p-2 sm:p-2.5 md:p-3 shadow-[2px_2px_0px_0px_#1c1917] hover:shadow-[3.5px_3.5px_0px_0px_#1c1917] transition-all flex flex-col justify-between group h-full relative"
                    >
                      <div>
                        {/* Header: icône + badge catégorie */}
                        <div className="flex items-start justify-between gap-1.5 mb-1.5">
                          <FileIconBadge fileName={doc.file_name || doc.title} size={28} />
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveCategoryTooltipId(prev => prev === doc.id ? null : doc.id);
                              }}
                              className="text-[8.5px] sm:text-[10px] font-extrabold bg-orange-100 hover:bg-orange-200 text-orange-800 px-1.5 py-0.5 rounded-md border border-stone-800 truncate max-w-[55px] sm:max-w-[70px] transition-all cursor-pointer block text-left active:scale-95"
                              title={doc.category}
                            >
                              {doc.category || 'Cours'}
                            </button>
                            {activeCategoryTooltipId === doc.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 top-full mt-1.5 z-50 bg-stone-900 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-2xl border-2 border-stone-700 whitespace-nowrap animate-fadeIn flex items-center gap-2"
                              >
                                <span className="text-orange-400 text-xs">🎓</span>
                                <span>{doc.category}</span>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setActiveCategoryTooltipId(null); }}
                                  className="p-0.5 hover:bg-stone-800 rounded text-stone-400 hover:text-white transition-colors cursor-pointer">
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Titre */}
                        <h3 className="text-[11px] sm:text-xs font-extrabold text-stone-900 truncate mb-0.5 group-hover:text-orange-600 transition-colors" title={doc.title}>
                          {doc.title || doc.file_name}
                        </h3>

                        {/* Matière */}
                        {doc.matiere_name && (
                          <p className="text-[9px] text-stone-500 font-semibold truncate mb-0.5" title={doc.matiere_name}>
                            📚 {doc.matiere_name}{doc.level ? ` · ${doc.level}` : ''}
                          </p>
                        )}

                        {/* École */}
                        <div className="min-h-[16px] mb-1.5 flex items-center">
                          <div className="flex items-center gap-1 text-[8.5px] sm:text-[10px] text-stone-600 truncate w-full">
                            <Building2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-stone-500 shrink-0" />
                            {doc.school && doc.school.trim() ? (
                              <span className="font-bold truncate text-stone-800" title={doc.school}>{doc.school}</span>
                            ) : (
                              <span className="font-normal italic text-stone-400 truncate">Non renseigné</span>
                            )}
                          </div>
                        </div>

                        {/* Pays + Auteur */}
                        <div className="flex items-center gap-1 text-[8px] text-stone-400 font-medium truncate mb-1">
                          {doc.country && <span className="flex items-center gap-0.5"><Globe className="w-2.5 h-2.5" />{doc.country}</span>}
                          {doc.author_name && <span className="truncate">· {doc.author_name}</span>}
                        </div>
                      </div>

                      {/* Bas de carte */}
                      <div className="flex items-center justify-between pt-1.5 border-t border-stone-200 gap-1">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[8.5px] sm:text-[10px] font-bold text-stone-500 truncate">{docSizeStr}</span>
                          <span className="text-[8px] text-stone-400 font-medium">
                            {doc.views_count || 0} vues · {doc.downloads_count || 0} DL
                          </span>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={() => StudyCloudAPI.incrementDocumentView(doc.id).catch(() => {})}
                              className="p-1 sm:px-2 sm:py-1 bg-white hover:bg-stone-100 text-stone-900 font-bold text-[10px] sm:text-xs rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center gap-1 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                              title="Visualiser"
                            >
                              <Eye className="w-3 h-3" />
                              <span className="hidden sm:inline">Voir</span>
                            </a>
                          ) : (
                            <button
                              onClick={() => setActivePreviewItem({ name: doc.file_name || doc.title, url: doc.file_url || '', folderName: doc.school || '', lockFullscreen: true })}
                              className="p-1 sm:px-2 sm:py-1 bg-white hover:bg-stone-100 text-stone-900 font-bold text-[10px] sm:text-xs rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center gap-1 transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                              title="Visualiser"
                            >
                              <Eye className="w-3 h-3" />
                              <span className="hidden sm:inline">Voir</span>
                            </button>
                          )}
                          {doc.file_url ? (
                            <a
                              href={doc.file_url}
                              download={doc.file_name || doc.title}
                              onClick={() => StudyCloudAPI.incrementDocumentDownload(doc.id).catch(() => {})}
                              className="p-1 sm:p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center active:translate-x-0.5 active:translate-y-0.5"
                              title="Télécharger"
                            >
                              <Download className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              className="p-1 sm:p-1.5 bg-stone-300 text-stone-400 rounded-lg border border-stone-300 cursor-not-allowed flex items-center justify-center"
                              title="Fichier non disponible"
                              disabled
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ONGLET LIENS PUBLICS */}
        {activeSubTab === 'liens' && (() => {
          const filteredPublicFolders = folders.filter((folder) => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              folder.title.toLowerCase().includes(q) ||
              (folder.description && folder.description.toLowerCase().includes(q)) ||
              (folder.school && folder.school.toLowerCase().includes(q)) ||
              (folder.category && folder.category.toLowerCase().includes(q)) ||
              folder.files.some(f => f.name.toLowerCase().includes(q))
            );
          });

          return (
            <div className="space-y-4">
              {filteredPublicFolders.length === 0 ? (
                <div className="bg-[#FDFBF7] border-3 border-stone-800 rounded-2xl p-12 text-center shadow-[4px_4px_0px_0px_#1c1917]">
                  <div className="w-12 h-12 bg-blue-100 border-2 border-stone-800 rounded-2xl flex items-center justify-center text-blue-600 mx-auto mb-3 shadow-[2px_2px_0px_0px_#1c1917]">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-extrabold text-stone-900">
                    {searchQuery ? "Aucun lien ne correspond à la recherche" : "Aucun lien public disponible"}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1">
                    {searchQuery ? "Essayez avec d'autres termes de recherche." : "Créez un dossier partagé pour générer un lien public."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 w-full">
                  {filteredPublicFolders.map((folder) => {
                    const isCopied = copiedLinkId === folder.id;
                    const totalBytes = folder.totalSize || folder.files.reduce((acc, f) => acc + (f.size || 0), 0);
                    const totalSizeStr = formatSize(totalBytes);
                    const downloadsCount = (folder.files.length * 9 + 12);

                    return (
                      <div
                        key={folder.id}
                        className="bg-[#FDFBF7] border-2 border-stone-800 rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1c1917] flex flex-col justify-between transition-all hover:shadow-[4px_4px_0px_0px_#1c1917]"
                      >
                        <div>
                          {/* Top Line: Title inside pill badge on left, Size on right (No lock icon) */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <span className="px-3 py-1 bg-amber-100/90 text-amber-950 border border-stone-800 font-extrabold text-xs rounded-xl truncate max-w-[210px] sm:max-w-[240px] shadow-[1px_1px_0px_0px_#1c1917]">
                              {folder.title}
                            </span>
                            <span className="text-xs font-bold text-stone-600 shrink-0">
                              {totalSizeStr}
                            </span>
                          </div>

                          {/* Description / Subtitle */}
                          <p className="text-xs text-stone-600 font-medium line-clamp-2 my-2.5 leading-relaxed">
                            {folder.description || (folder.school ? `Cours, TDs corrigés, codes sources et ressources d'études (${folder.school}).` : 'Cours, TDs corrigés, codes sources TP et rapport de projet.')}
                          </p>

                          {/* Folder Files Box */}
                          <div
                            onClick={() => onSelectFolder(folder)}
                            className="bg-stone-100/90 border-2 border-stone-800 rounded-xl p-3 flex items-center gap-3 my-2 cursor-pointer hover:bg-stone-200/70 transition-colors shadow-[1.5px_1.5px_0px_0px_#1c1917]"
                          >
                            <div className="w-10 h-10 bg-amber-400 border-2 border-stone-800 rounded-lg flex items-center justify-center shrink-0 shadow-[1px_1px_0px_0px_#1c1917]">
                              <Folder className="w-5 h-5 text-amber-950 fill-amber-300 stroke-[2]" />
                            </div>
                            <div className="overflow-hidden space-y-0.5">
                              <h4 className="font-extrabold text-xs text-stone-900 truncate">
                                {folder.files.length} fichier{folder.files.length > 1 ? 's' : ''} inclus
                              </h4>
                              <p className="text-[11px] text-stone-500 font-medium truncate">
                                {folder.files.length > 0 ? folder.files.map(f => f.name).join(', ') : 'Aucun fichier'}
                              </p>
                            </div>
                          </div>

                          {/* Dotted Divider */}
                          <div className="border-b-2 border-dashed border-stone-300 my-3" />

                          {/* Downloads Counter */}
                          <div className="text-xs font-bold text-stone-600 flex items-center justify-center gap-1.5 mb-3">
                            <Download className="w-3.5 h-3.5 text-orange-600" />
                            <span>{downloadsCount} téléchargements</span>
                          </div>
                        </div>

                        {/* Bottom Action Row: Lien + Download Arrow Button (In place of Trash) */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(folder)}
                            className={`flex-1 py-2 px-3 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] ${
                              isCopied ? 'bg-emerald-600 text-white' : 'bg-white hover:bg-stone-50 text-stone-900'
                            }`}
                          >
                            {isCopied ? (
                              'Copié ! ✓'
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" />
                                <span>Lien</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => handleDownloadFolder(folder, e)}
                            className="px-4 py-2 bg-white hover:bg-stone-50 active:bg-stone-100 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center gap-1.5 cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px]"
                            title="Télécharger les fichiers du dossier"
                          >
                            <Download className="w-4 h-4 text-stone-900 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Toast Notification Top (Fixed, Green, Top position without bouncing) */}
      {toastMsg && (
        <div className="fixed top-2.5 sm:top-3 left-1/2 -translate-x-1/2 z-[300000] bg-emerald-600 text-white font-extrabold text-xs sm:text-sm px-5 py-2.5 rounded-2xl border-2 border-stone-900 shadow-[0_6px_20px_rgba(0,0,0,0.25)] flex items-center gap-2 max-w-[92vw] text-center transition-all animate-fadeIn">
          <span>🛒</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Product Detail Full Screen View */}
      {selectedDetailProduct && (
        <div id="product-detail-modal" className="fixed inset-0 md:left-64 z-[100000] bg-[#FAF8F5] flex flex-col animate-fadeIn overflow-y-auto text-left">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-stone-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setSelectedDetailProduct(null);
                setActiveDetailImageIndex(0);
                setIsDescriptionExpanded(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl transition-all cursor-pointer border border-stone-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row gap-6 md:gap-10 p-0 md:p-8 pb-12 items-start">
            
            {/* Left Column (Image & Info - Sticky on desktop) */}
            <div className="flex-1 w-full space-y-5 md:sticky md:top-6">
            {/* Horizontal Image Gallery Slider */}
            {(() => {
              const rawImages = selectedDetailProduct.imageUrls && selectedDetailProduct.imageUrls.length > 0
                ? selectedDetailProduct.imageUrls
                : (selectedDetailProduct.imageUrl ? [selectedDetailProduct.imageUrl] : []);

              const imageSlides = Array.from({ length: 3 }).map((_, i) => rawImages[i] || (rawImages[0] ? rawImages[0] : null));

              return (
                <div className="space-y-2 bg-stone-100/70 border-b border-stone-200 pb-3">
                  <div
                    className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth w-full"
                    onScroll={(e) => {
                      const scrollLeft = e.currentTarget.scrollLeft;
                      const width = e.currentTarget.clientWidth;
                      if (width > 0) {
                        setActiveDetailImageIndex(Math.round(scrollLeft / width));
                      }
                    }}
                  >
                    {imageSlides.map((imgUrl, idx) => (
                      <div key={idx} className="w-full shrink-0 snap-center h-72 sm:h-80 bg-white flex items-center justify-center relative p-3">
                        {imgUrl ? (
                          <img src={imgUrl} alt={`${selectedDetailProduct.title} - Image ${idx + 1}`} className="w-full h-full object-contain" />
                        ) : (
                          <div className="w-full h-full bg-stone-50 flex flex-col items-center justify-center text-stone-300 gap-2 rounded-xl border border-dashed border-stone-200">
                            <Package className="w-12 h-12 stroke-1" />
                            <span className="text-xs font-medium text-stone-400">Image {idx + 1} / 3</span>
                          </div>
                        )}
                        <span className="absolute bottom-3 right-4 px-2 py-0.5 bg-stone-900/80 text-white font-bold text-[10px] rounded-md backdrop-blur-xs">
                          {idx + 1} / 3
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Slider Indicator Dots */}
                  <div className="flex items-center justify-center gap-1.5 pt-1">
                    {imageSlides.map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-2 rounded-full transition-all ${
                          idx === activeDetailImageIndex ? 'w-5 bg-stone-900' : 'w-2 bg-stone-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Title & Price in Orange */}
            <div className="px-4 space-y-1">
              <h1 className="font-serif font-black text-xl text-stone-900 leading-snug">
                {selectedDetailProduct.title}
              </h1>
              <div className="font-extrabold text-2xl text-orange-600 pt-1">
                {selectedDetailProduct.price}
              </div>
            </div>

            {/* Description */}
            <div className="px-4 space-y-2 pt-2 border-t border-stone-200">
              <h4 className="font-bold text-xs uppercase tracking-wider text-stone-500">Description</h4>
              <div className="text-xs text-stone-700 leading-relaxed whitespace-pre-line font-medium">
                <p className={!isDescriptionExpanded && selectedDetailProduct.description && selectedDetailProduct.description.length > 80 ? "line-clamp-2" : ""}>
                  {selectedDetailProduct.description || "Aucune description fournie pour ce produit."}
                </p>
                {selectedDetailProduct.description && selectedDetailProduct.description.length > 80 && (
                  <button
                    type="button"
                    onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                    className="text-xs font-bold text-stone-900 hover:text-stone-700 flex items-center gap-1.5 cursor-pointer pt-2 underline underline-offset-2"
                  >
                    <span>{isDescriptionExpanded ? 'Réduire la description' : 'Dérouler la description'}</span>
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isDescriptionExpanded ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>

            {/* Commander Button & Cart Button */}
            <div className="px-4 pt-3 flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => toggleCartItem(selectedDetailProduct.id, selectedDetailProduct.title)}
                className={`py-3.5 px-4 font-extrabold text-xs sm:text-sm rounded-xl border transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 ${
                  cartItemIds.includes(selectedDetailProduct.id)
                    ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-300'
                }`}
                title={cartItemIds.includes(selectedDetailProduct.id) ? "Retirer du panier" : "Ajouter au panier"}
              >
                <ShoppingCart className={`w-4 h-4 ${cartItemIds.includes(selectedDetailProduct.id) ? 'text-amber-800 fill-amber-700' : 'text-stone-700'}`} />
                <span>{cartItemIds.includes(selectedDetailProduct.id) ? "Ajouté ✓" : "Ajouter au panier"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  triggerToast(`Commande initiée pour "${selectedDetailProduct.title}" !`);
                }}
                className="flex-1 py-3.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer text-center shadow-md active:scale-98"
              >
                Commander
              </button>
            </div>

            </div>

            {/* Right Column (Shop & Related Products - Scrollable) */}
            <div className="flex-1 w-full space-y-5 min-w-0">
              
              {/* Shop Profile Card */}
              <div className="px-4 pt-4 md:px-0 md:pt-0">
                <div className="bg-white rounded-3xl border border-stone-200/90 p-4 shadow-sm space-y-3.5 text-left">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-full bg-amber-100/90 border-2 border-stone-800 overflow-hidden shrink-0 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center font-black text-amber-900 text-base">
                    {shopAvatarUrl ? (
                      <img src={shopAvatarUrl} alt={shopName} className="w-full h-full object-cover" />
                    ) : (
                      shopName ? shopName.substring(0, 2).toUpperCase() : 'DK'
                    )}
                  </div>
                  <div className="overflow-hidden space-y-0.5">
                    <h3 className="font-extrabold text-base text-stone-900 truncate">{shopName}</h3>
                    <p className="text-xs text-stone-500 font-bold truncate">{shopPhone}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSubscribed(!isSubscribed);
                      triggerToast(isSubscribed ? "Vous êtes désabonné de la boutique." : "Vous êtes abonné à la boutique !");
                    }}
                    className={`flex-1 py-2.5 font-extrabold text-xs sm:text-sm rounded-2xl border-2 transition-all cursor-pointer ${
                      isSubscribed
                        ? 'bg-stone-100 text-stone-800 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                        : 'bg-blue-600 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-blue-700'
                    }`}
                  >
                    {isSubscribed ? "Abonné ✓" : "S'abonner"}
                  </button>

                  <button
                    type="button"
                    onClick={() => triggerToast("Lien de la boutique copié dans le presse-papier !")}
                    className="flex-1 py-2.5 bg-white text-stone-800 font-extrabold text-xs sm:text-sm rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-stone-50 cursor-pointer transition-all flex items-center justify-center gap-1.5"
                  >
                    <Share2 className="w-4 h-4 text-stone-800" />
                    <span>Partager</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Related Products displayed when scrolling down */}
            <div className="px-4 pt-4 pb-8 space-y-3">
              <div className="flex items-center justify-between md:px-0">
                <h3 className="font-extrabold text-sm text-stone-900">
                  Autres produits
                </h3>
                <span className="text-[11px] text-stone-500 font-bold">📚 Librairie</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 md:px-0">
                {productsList
                  .filter((p) => p.id !== selectedDetailProduct.id)
                  .map((item, idx) => {
                    const displayImages = item.imageUrls && item.imageUrls.length > 0
                      ? item.imageUrls
                      : (item.imageUrl ? [item.imageUrl] : []);

                    return (
                      <div
                        key={`${item.id}-rec-${idx}`}
                        onClick={() => {
                          setSelectedDetailProduct(item);
                          setActiveDetailImageIndex(0);
                          setIsDescriptionExpanded(false);
                          const modalElem = document.getElementById('product-detail-modal');
                          if (modalElem) {
                            modalElem.scrollTop = 0;
                          }
                        }}
                        className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                      >
                        <div>
                          {/* Top Image Box */}
                          <div className="w-full h-32 sm:h-36 md:h-48 bg-stone-100/80 relative overflow-hidden flex items-center justify-center p-2.5 md:p-3">
                            {displayImages.length > 0 ? (
                              <img
                                src={displayImages[0]}
                                alt={item.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-300">
                                <Package className="w-10 h-10 md:w-12 md:h-12 stroke-[1.5]" />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="p-2.5 md:p-3 space-y-0.5 md:space-y-1">
                            <h4 className="font-extrabold text-xs md:text-sm text-stone-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition-colors">
                              {item.title}
                            </h4>
                            {item.description && (
                              <p className="text-[10px] md:text-xs text-stone-500 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="p-2.5 md:p-3 pt-0 space-y-1.5 md:space-y-2.5">
                          <div className="flex items-center justify-between gap-1">
                            <div className="font-extrabold text-xs md:text-sm text-orange-600">
                              {item.price}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCartItem(item.id, item.title);
                              }}
                              className={`px-2 md:px-2.5 py-0.5 md:py-1 rounded-lg md:rounded-xl text-[10px] md:text-xs font-bold transition-all cursor-pointer flex items-center gap-1 border ${
                                cartItemIds.includes(item.id)
                                  ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold hover:bg-amber-200'
                                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                              }`}
                              title={cartItemIds.includes(item.id) ? "Retirer du panier" : "Ajouter au panier"}
                            >
                              <ShoppingCart className={`w-3 h-3 md:w-3.5 md:h-3.5 ${cartItemIds.includes(item.id) ? 'text-amber-800 fill-amber-700' : 'text-stone-700'}`} />
                              <span>{cartItemIds.includes(item.id) ? 'Ajouté' : 'Ajouter'}</span>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerToast(`Commande initiée pour "${item.title}" !`);
                            }}
                            className="w-full py-1.5 md:py-2.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-[11px] md:text-sm rounded-xl md:rounded-2xl shadow-xs transition-all cursor-pointer text-center active:scale-[0.98]"
                          >
                            Commander
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
