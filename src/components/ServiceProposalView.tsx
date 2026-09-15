import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Menu, X, Package, List, Megaphone, BarChart2, Plus, Trash2, Check, DollarSign, Eye, Upload, Loader2, Share2, Search, ChevronDown, Store, Phone, MessageCircle, User, Camera, Edit3, Zap, Tag, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StudyCloudAPI } from '../services/api';

interface ProductItem {
  id: string;
  sellerId?: string;
  seller_id?: string;
  sellerName?: string;
  seller_name?: string;
  sellerSchool?: string;
  seller_school?: string;
  sellerFiliere?: string;
  seller_filiere?: string;
  sellerCountry?: string;
  seller_country?: string;
  sellerPhone?: string;
  seller_phone?: string;
  sellerWhatsapp?: string;
  seller_whatsapp?: string;
  sellerAvatarUrl?: string;
  seller_avatar_url?: string;
  title: string;
  description: string;
  price: string;
  currency?: string;
  category: string;
  date: string;
  views?: number;
  sales?: number;
  imageUrl?: string;
  imageUrls?: string[];
  isBoosted?: boolean;
  boostStatus?: 'active' | 'completed';
  boostFormula?: string;
  boostViewsTarget?: number;
  boostViewsCurrent?: number;
  boostEndDate?: string;
}

interface ServiceProposalViewProps {
  onBack: () => void;
}

export const ServiceProposalView: React.FC<ServiceProposalViewProps> = ({ onBack }) => {
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(false);
  const [activePage, setActivePage] = useState<'main' | 'publish' | 'list' | 'advertise' | 'analytics' | 'product-picker' | 'boosted-products'>('main');
  const [listSubView, setListSubView] = useState<'publications' | 'boutique'>('publications');
  const [boostSubView, setBoostSubView] = useState<'active' | 'completed'>('active');
  const [productToDelete, setProductToDelete] = useState<ProductItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [basiqueViews, setBasiqueViews] = useState<number>(500);
  const basiqueBudget = Math.max(500, Math.round(basiqueViews * 4));
  const [showBasiqueModal, setShowBasiqueModal] = useState(false);

  const [proViews, setProViews] = useState<number>(2000);
  const proBudget = Math.max(2000, Math.round(proViews * 5));
  const [showProModal, setShowProModal] = useState(false);

  const [campaignTypeTarget, setCampaignTypeTarget] = useState<'basique' | 'pro' | null>(null);
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showPubSearchInput, setShowPubSearchInput] = useState(false);
  const [pubSearchQuery, setPubSearchQuery] = useState('');
  const [selectedDetailProduct, setSelectedDetailProduct] = useState<ProductItem | null>(null);
  const [activeDetailImageIndex, setActiveDetailImageIndex] = useState<number>(0);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(false);

  // Store profile configuration states
  const [hasCreatedShop, setHasCreatedShop] = useState<boolean>(() => {
    return localStorage.getItem('unifolder_shop_created') === 'true';
  });
  const [shopName, setShopName] = useState(() => localStorage.getItem('unifolder_shop_name') || '');
  const [shopPhone, setShopPhone] = useState(() => localStorage.getItem('unifolder_shop_phone') || '');
  const [shopWhatsapp, setShopWhatsapp] = useState(() => localStorage.getItem('unifolder_shop_whatsapp') || '');
  const [shopAvatarUrl, setShopAvatarUrl] = useState(() => localStorage.getItem('unifolder_shop_avatar') || '');
  const [shopCategory, setShopCategory] = useState(() => localStorage.getItem('unifolder_shop_category') || 'Vente digital (PDF)');
  const [subscribersCount, setSubscribersCount] = useState<number>(0);

  // First-time shop creation onboarding form states
  const [setupShopName, setSetupShopName] = useState('');
  const [setupShopPhone, setSetupShopPhone] = useState('');
  const [setupShopWhatsapp, setSetupShopWhatsapp] = useState('');
  const [setupShopAvatarUrl, setSetupShopAvatarUrl] = useState('');
  const [setupShopCategory, setSetupShopCategory] = useState('Vente digital (PDF)');
  const [setupCustomCategory, setSetupCustomCategory] = useState('');
  const [isSubmittingSetup, setIsSubmittingSetup] = useState(false);
  const setupAvatarInputRef = useRef<HTMLInputElement>(null);

  // Progressive publishing states (ligne de progression en direct)
  const [publishingItems, setPublishingItems] = useState<{
    id: string;
    title: string;
    description: string;
    price: string;
    category: string;
    imageUrl?: string;
    imageUrls?: string[];
    progress: number;
  }[]>([]);

  // Single field edit modal states
  const [editingField, setEditingField] = useState<'name' | 'phone' | 'whatsapp' | 'avatar' | 'category' | null>(null);
  const [tempFieldValue, setTempFieldValue] = useState<string>('');
  const [customEditCategory, setCustomEditCategory] = useState<string>('');
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (shopName) localStorage.setItem('unifolder_shop_name', shopName);
    if (shopPhone) localStorage.setItem('unifolder_shop_phone', shopPhone);
    if (shopWhatsapp) localStorage.setItem('unifolder_shop_whatsapp', shopWhatsapp);
    if (shopAvatarUrl) localStorage.setItem('unifolder_shop_avatar', shopAvatarUrl);
    if (shopCategory) localStorage.setItem('unifolder_shop_category', shopCategory);
  }, [shopName, shopPhone, shopWhatsapp, shopAvatarUrl, shopCategory]);

  const handleOpenFieldEdit = (field: 'name' | 'phone' | 'whatsapp' | 'avatar' | 'category') => {
    setEditingField(field);
    if (field === 'name') setTempFieldValue(shopName);
    if (field === 'phone') setTempFieldValue(shopPhone);
    if (field === 'whatsapp') setTempFieldValue(shopWhatsapp);
    if (field === 'avatar') setTempFieldValue(shopAvatarUrl);
    if (field === 'category') {
      const isPredefined = ['Vente digital (PDF)', 'Vente de documents (livre) à la livraison', 'Matériel scolaire & Électronique', 'Formations & Cours particuliers', 'Services d\'études & Tutorat'].includes(shopCategory);
      if (isPredefined) {
        setTempFieldValue(shopCategory);
        setCustomEditCategory('');
      } else {
        setTempFieldValue('Autre');
        setCustomEditCategory(shopCategory);
      }
    }
  };

  const handleApplyFieldEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFieldModified) return;
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    let nextName = shopName;
    let nextPhone = shopPhone;
    let nextWhatsapp = shopWhatsapp;
    let nextAvatar = shopAvatarUrl;
    let nextCategory = shopCategory;

    if (editingField === 'name') {
      nextName = tempFieldValue.trim() || 'DKD Technologies';
      setShopName(nextName);
      triggerToast("Nom de la boutique mis à jour !");
    } else if (editingField === 'phone') {
      nextPhone = tempFieldValue.trim() || '+225 07 00 00 00 00';
      setShopPhone(nextPhone);
      triggerToast("Numéro de téléphone mis à jour !");
    } else if (editingField === 'whatsapp') {
      nextWhatsapp = tempFieldValue.trim() || '+225 07 00 00 00 00';
      setShopWhatsapp(nextWhatsapp);
      triggerToast("Numéro WhatsApp mis à jour !");
    } else if (editingField === 'avatar') {
      nextAvatar = tempFieldValue;
      setShopAvatarUrl(nextAvatar);
      triggerToast("Photo de profil mise à jour !");
    } else if (editingField === 'category') {
      nextCategory = tempFieldValue === 'Autre' ? (customEditCategory.trim() || 'Vente digital (PDF)') : tempFieldValue;
      setShopCategory(nextCategory);
      triggerToast("Catégorie de vente mise à jour !");
    }
    setEditingField(null);

    StudyCloudAPI.updateShopProfile({
      userId,
      shopName: nextName,
      shopPhone: nextPhone,
      shopWhatsapp: nextWhatsapp,
      shopAvatarUrl: nextAvatar,
      shopCategory: nextCategory
    }).catch(() => {});
  };

  const isFieldModified = (() => {
    if (editingField === 'name') return tempFieldValue.trim() !== '' && tempFieldValue.trim() !== shopName.trim();
    if (editingField === 'phone') return tempFieldValue.trim() !== '' && tempFieldValue.trim() !== shopPhone.trim();
    if (editingField === 'whatsapp') return tempFieldValue.trim() !== '' && tempFieldValue.trim() !== shopWhatsapp.trim();
    if (editingField === 'avatar') return tempFieldValue !== shopAvatarUrl;
    if (editingField === 'category') {
      const finalCat = tempFieldValue === 'Autre' ? customEditCategory.trim() : tempFieldValue;
      return finalCat !== '' && finalCat !== shopCategory;
    }
    return false;
  })();

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string || '';
        setTempFieldValue(url);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleSetupAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const url = ev.target?.result as string || '';
        setSetupShopAvatarUrl(url);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleCreateShopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = setupShopCategory === 'Autre' ? setupCustomCategory.trim() : setupShopCategory;
    if (!setupShopName.trim() || !setupShopPhone.trim() || !finalCategory) {
      triggerToast("Veuillez renseigner les champs obligatoires (*)");
      return;
    }

    setIsSubmittingSetup(true);
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const profile = {
      userId,
      shopName: setupShopName.trim(),
      shopPhone: setupShopPhone.trim(),
      shopWhatsapp: setupShopWhatsapp.trim() || setupShopPhone.trim(),
      shopAvatarUrl: setupShopAvatarUrl || null,
      shopCategory: finalCategory
    };

    try {
      await StudyCloudAPI.updateShopProfile(profile);
      setShopName(profile.shopName);
      setShopPhone(profile.shopPhone);
      setShopWhatsapp(profile.shopWhatsapp);
      if (profile.shopAvatarUrl) setShopAvatarUrl(profile.shopAvatarUrl);
      setShopCategory(profile.shopCategory);

      localStorage.setItem('unifolder_shop_created', 'true');
      localStorage.setItem('unifolder_shop_name', profile.shopName);
      localStorage.setItem('unifolder_shop_phone', profile.shopPhone);
      localStorage.setItem('unifolder_shop_whatsapp', profile.shopWhatsapp);
      if (profile.shopAvatarUrl) localStorage.setItem('unifolder_shop_avatar', profile.shopAvatarUrl);
      localStorage.setItem('unifolder_shop_category', profile.shopCategory);

      setHasCreatedShop(true);
      triggerToast("Félicitations ! Votre boutique a été créée avec succès.");
    } catch (err) {
      console.warn("Erreur création boutique:", err);
      // Fallback local
      setShopName(profile.shopName);
      setShopPhone(profile.shopPhone);
      setShopWhatsapp(profile.shopWhatsapp);
      if (profile.shopAvatarUrl) setShopAvatarUrl(profile.shopAvatarUrl);
      setShopCategory(profile.shopCategory);
      setHasCreatedShop(true);
      localStorage.setItem('unifolder_shop_created', 'true');
      triggerToast("Boutique créée !");
    } finally {
      setIsSubmittingSetup(false);
    }
  };

  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const saved = localStorage.getItem('unifolder_published_products');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newCurrency, setNewCurrency] = useState('FCFA');
  const [newCategory, setNewCategory] = useState('Vente digital (PDF)');
  const [customCategory, setCustomCategory] = useState('');
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isPublishingModalOpen, setIsPublishingModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const publishingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Ad promotion state
  const [selectedProductForAd, setSelectedProductForAd] = useState<string>('');
  const [adBudget, setAdBudget] = useState('5 €');
  const [adDuration, setAdDuration] = useState('3 jours');

  useEffect(() => {
    localStorage.setItem('unifolder_published_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
    const userName = localStorage.getItem('unifolder_user_name') || '';
    const userPhone = localStorage.getItem('unifolder_user_phone') || '';
    const userAvatar = localStorage.getItem('unifolder_user_avatar') || '';

    // Préremplir l'onboarding au cas où
    setSetupShopName(prev => prev || userName || '');
    setSetupShopPhone(prev => prev || userPhone || '');
    setSetupShopWhatsapp(prev => prev || userPhone || '');
    setSetupShopAvatarUrl(prev => prev || userAvatar || '');

    // 1. Récupérer le profil de la boutique depuis D1
    StudyCloudAPI.getShopProfile(userId)
      .then((res) => {
        if (res.success && res.data) {
          if (res.data.shop_name) {
            setShopName(res.data.shop_name);
            setHasCreatedShop(true);
            localStorage.setItem('unifolder_shop_created', 'true');
          }
          if (res.data.shop_phone || res.data.phone) setShopPhone(res.data.shop_phone || res.data.phone);
          if (res.data.shop_whatsapp || res.data.whatsapp) setShopWhatsapp(res.data.shop_whatsapp || res.data.whatsapp);
          if (res.data.shop_avatar_url || res.data.avatar_url) setShopAvatarUrl(res.data.shop_avatar_url || res.data.avatar_url);
          if (res.data.shop_category) {
            setShopCategory(res.data.shop_category);
            localStorage.setItem('unifolder_shop_category', res.data.shop_category);
          }
          if (typeof res.data.subscriber_count === 'number') {
            setSubscribersCount(res.data.subscriber_count);
          }
        }
      })
      .catch((e) => console.warn('D1 Shop profile fetch:', e));

    // 2. Vérifier si l'utilisateur est abonné à son propre compte
    StudyCloudAPI.getSellerFollows(userId)
      .then((res) => {
        if (res.success && Array.isArray(res.followedSellerIds)) {
          if (res.followedSellerIds.includes(userId)) {
            setIsSubscribed(true);
          }
        }
      })
      .catch(() => {});

    // 2. Récupérer les produits réels depuis D1
    StudyCloudAPI.getProducts()
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped: ProductItem[] = res.data.map((row: any) => ({
            id: String(row.id),
            title: row.title,
            description: row.description || '',
            price: row.price || '0 FCFA',
            category: row.category || 'Cours',
            date: row.created_at ? new Date(row.created_at).toLocaleDateString('fr-FR') : '01/09/2026',
            views: row.views || 0,
            sales: row.sales || 0,
            imageUrl: row.image_urls_json ? (JSON.parse(row.image_urls_json)[0] || undefined) : undefined,
            imageUrls: row.image_urls_json ? JSON.parse(row.image_urls_json) : [],
            isBoosted: Boolean(row.is_boosted),
            boostStatus: row.is_boosted ? 'active' : undefined,
            boostFormula: row.boost_formula || undefined,
            boostViewsTarget: row.boost_views_target || undefined,
            boostViewsCurrent: row.views || 0,
            boostEndDate: row.boost_end_date || undefined
          }));
          setProducts(mapped);
          localStorage.setItem('unifolder_published_products', JSON.stringify(mapped));
        }
      })
      .catch((e) => console.warn('D1 Products fetch:', e));
  }, []);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (newImageUrls.length >= 3) {
        triggerToast("Vous pouvez importer un maximum de 3 images.");
        return;
      }
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (uploadEvent) => {
        const resultUrl = uploadEvent.target?.result as string || '';
        setNewImageUrls((prev) => [...prev, resultUrl]);
        triggerToast(`Image ${newImageUrls.length + 1}/3 importée avec succès !`);
      };
      reader.readAsDataURL(file);
      // Reset input value so the same file can be selected again if needed
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setNewImageUrls((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handlePublishProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = newCategory === 'Autre' ? customCategory.trim() : newCategory;
    if (!newTitle.trim() || !newPrice.trim() || !newDesc.trim() || newImageUrls.length === 0 || (newCategory === 'Autre' && !customCategory.trim())) return;

    const tempId = Date.now().toString();
    const tempItem = {
      id: tempId,
      title: newTitle.trim(),
      description: newDesc.trim(),
      price: `${newPrice.trim()} ${newCurrency}`,
      category: finalCategory,
      imageUrl: newImageUrls[0] || undefined,
      imageUrls: [...newImageUrls],
      progress: 15,
    };

    // Rediriger immédiatement vers Mes publications pour observer la progression en direct
    setActivePage('list');
    setListSubView('publications');
    setPublishingItems(prev => [tempItem, ...prev]);

    // Réinitialiser les champs de saisie
    const cachedTitle = newTitle.trim();
    const cachedDesc = newDesc.trim();
    const cachedPrice = `${newPrice.trim()} ${newCurrency}`;
    const cachedCurrency = newCurrency;
    const cachedCategory = finalCategory;
    const cachedImages = [...newImageUrls];

    setNewTitle('');
    setNewDesc('');
    setNewPrice('');
    setNewCurrency('FCFA');
    setNewCategory('Vente digital (PDF)');
    setCustomCategory('');
    setNewImageUrls([]);

    // Animation progressive de publication (15% -> 40% -> 70% -> 92% -> 100%)
    let currentProgress = 15;
    const interval = setInterval(() => {
      currentProgress += Math.floor(Math.random() * 20) + 18;
      if (currentProgress >= 100) {
        currentProgress = 100;
        clearInterval(interval);

        setTimeout(() => {
          setPublishingItems(prev => prev.filter(item => item.id !== tempId));

          const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
          const sellerName = shopName || localStorage.getItem('unifolder_user_name') || 'Étudiant';
          const sellerSchool = localStorage.getItem('unifolder_user_school') || '';
          const sellerFiliere = localStorage.getItem('unifolder_user_filiere') || '';
          const sellerCountry = localStorage.getItem('unifolder_user_country') || "Côte d'Ivoire";
          const sellerPhone = shopPhone || localStorage.getItem('unifolder_user_phone') || '';
          const sellerWhatsapp = shopWhatsapp || localStorage.getItem('unifolder_user_phone') || '';
          const sellerAvatarUrl = shopAvatarUrl || localStorage.getItem('unifolder_user_avatar') || '';

          const newItem: ProductItem = {
            id: tempId,
            sellerId: userId,
            sellerName,
            sellerSchool,
            sellerFiliere,
            sellerCountry,
            sellerPhone,
            sellerWhatsapp,
            sellerAvatarUrl,
            title: cachedTitle,
            description: cachedDesc,
            price: cachedPrice,
            currency: cachedCurrency,
            category: cachedCategory,
            date: new Date().toLocaleDateString('fr-FR'),
            views: 0,
            sales: 0,
            imageUrl: cachedImages[0] || undefined,
            imageUrls: cachedImages
          };

          setProducts((prev) => [newItem, ...prev]);
          triggerToast(`"${newItem.title}" a été bien publié !`);

          StudyCloudAPI.createProduct({
            id: newItem.id,
            sellerId: userId,
            sellerName,
            sellerSchool,
            sellerFiliere,
            sellerCountry,
            sellerPhone,
            sellerWhatsapp,
            sellerAvatarUrl,
            title: newItem.title,
            description: newItem.description,
            price: newItem.price,
            currency: cachedCurrency,
            category: newItem.category,
            imageUrlsJson: JSON.stringify(newItem.imageUrls || []),
            isBoosted: false
          }).catch((e) => console.warn('Sync product to D1:', e));
        }, 500);
      }

      setPublishingItems(prev => prev.map(item => item.id === tempId ? { ...item, progress: Math.min(100, currentProgress) } : item));
    }, 450);
  };

  const handleDeleteProduct = (id: string) => {
    const item = products.find(p => p.id === id);
    if (item) {
      setProductToDelete(item);
    }
  };

  const confirmDeleteProduct = () => {
    if (productToDelete && !isDeleting && !deleteSuccess) {
      setIsDeleting(true);
      setTimeout(() => {
        setIsDeleting(false);
        setDeleteSuccess(true);
        setTimeout(() => {
          setProducts(products.filter(p => p.id !== productToDelete.id));
          StudyCloudAPI.deleteProduct(productToDelete.id).catch(() => {});
          triggerToast("Produit supprimé avec succès.");
          setDeleteSuccess(false);
          setProductToDelete(null);
        }, 900);
      }, 1200);
    }
  };

  const handleCreateAd = (e: React.FormEvent) => {
    e.preventDefault();
    setActivePage('main');
    triggerToast("Campagne publicitaire lancée avec succès ! 🚀");
  };

  const totalEarnings = products.reduce((acc, p) => {
    const priceNum = parseFloat(p.price.replace(/[^0-9,.]/g, '').replace(',', '.')) || 0;
    const salesCount = p.sales || 0;
    return acc + (priceNum * salesCount);
  }, 0);

  const totalViews = products.reduce((acc, p) => acc + (p.views || 0), 0);
  const totalSalesCount = products.reduce((acc, p) => acc + (p.sales || 0), 0);

  const getPageTitle = () => {
    if (!hasCreatedShop) return 'Créer votre boutique';
    switch (activePage) {
      case 'publish': return 'Publier un produit';
      case 'list': return 'Mes produits';
      case 'advertise': return 'Faire une publicité';
      case 'analytics': return 'Analyse de vente';
      case 'product-picker': return 'Choisir un produit à booster';
      case 'boosted-products': return 'Produits Boostés';
      default: return 'Espace Services';
    }
  };

  return (
    <div 
      className="absolute inset-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] h-full bg-[#FDFBF7] dark:bg-[#0b0f19] text-stone-900 dark:text-slate-100 overflow-y-auto overscroll-contain animate-fadeIn transition-colors duration-300"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-fadeIn">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Sticky Success Notification Banner across all menus */}
      {successMessage && (
        <div className="sticky top-0 z-50 w-full bg-emerald-600 text-white text-xs font-semibold px-4 py-3 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2 max-w-4xl mx-auto">
            <Check className="w-4 h-4 text-white shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button 
            onClick={() => setSuccessMessage(null)} 
            className="text-white hover:text-emerald-200 font-bold px-2 py-1 cursor-pointer text-sm"
            title="Fermer"
          >
            ×
          </button>
        </div>
      )}

      {/* Sticky Top Bar (En-tête) - Solid Dark #070a13 */}
      <div className="sticky top-0 left-0 right-0 z-40 bg-[#FDFBF7] dark:bg-[#070a13] px-4 py-2.5 flex items-center justify-between border-b border-stone-200/60 dark:border-[#1e293b]">
        <button
          onClick={() => {
            if (!hasCreatedShop) {
              onBack();
            } else if (activePage === 'product-picker') {
              setActivePage('advertise');
              if (campaignTypeTarget === 'basique') setShowBasiqueModal(true);
              if (campaignTypeTarget === 'pro') setShowProModal(true);
              setCampaignTypeTarget(null);
            } else if (activePage === 'boosted-products') {
              setActivePage('analytics');
            } else if (activePage !== 'main') {
              setActivePage('main');
            } else {
              onBack();
            }
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFBF7] dark:bg-[#1e293b] hover:bg-orange-50 dark:hover:bg-[#283852] text-stone-900 dark:text-white font-bold text-xs rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-stone-900 dark:text-white" />
          <span>Retour</span>
        </button>

        <div className="text-center">
          <h2 className="font-serif font-bold text-xs sm:text-sm text-stone-900 dark:text-white whitespace-nowrap">{getPageTitle()}</h2>
          {hasCreatedShop && activePage === 'list' && (
            <p className="text-[10px] font-bold text-stone-500 dark:text-slate-400">{products.length} produit{products.length > 1 ? 's' : ''} publié{products.length > 1 ? 's' : ''}</p>
          )}
        </div>

        {hasCreatedShop && activePage === 'main' ? (
          <button
            onClick={() => setIsRightDrawerOpen(true)}
            className="p-2 bg-[#E8DFD0] dark:bg-[#1e293b] hover:bg-stone-200 dark:hover:bg-[#283852] text-stone-900 dark:text-white rounded-xl border-2 border-stone-800 dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer flex items-center justify-center"
            title="Menu latéral"
          >
            <Menu className="w-4 h-4 text-stone-900 dark:text-white" />
          </button>
        ) : hasCreatedShop && activePage === 'list' && listSubView === 'publications' ? (
          <button
            onClick={() => {
              if (showPubSearchInput) {
                setPubSearchQuery('');
              }
              setShowPubSearchInput(!showPubSearchInput);
            }}
            className={`p-2 rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center ${
              showPubSearchInput ? 'bg-orange-200 text-stone-900' : 'bg-[#E8DFD0] hover:bg-stone-200 text-stone-900'
            }`}
            title="Rechercher"
          >
            <Search className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-16" />
        )}
      </div>

      {/* Main Content Area with bottom padding for smooth scrolling */}
      <div className="pb-40">
        {!hasCreatedShop ? (
          /* ONBOARDING CRÉATION DE BOUTIQUE (Premier accès vendeur) */
          <div className="w-full max-w-xl mx-auto px-4 py-8 animate-fadeIn text-left space-y-6">
            <div className="bg-white rounded-3xl border-3 border-stone-800 p-6 sm:p-8 shadow-[5px_5px_0px_0px_#1c1917] space-y-6">
              <div className="flex items-center gap-3.5 pb-4 border-b-2 border-stone-200">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 border-2 border-stone-800 flex items-center justify-center text-amber-900 shadow-[2px_2px_0px_0px_#1c1917] shrink-0">
                  <Store className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="font-extrabold text-base sm:text-lg text-stone-900">Profil Boutique</h2>
                  <p className="text-xs text-stone-500 font-medium">Gérer vos coordonnées pour devenir vendeur</p>
                </div>
              </div>

              <form onSubmit={handleCreateShopSubmit} className="space-y-4">
                {/* Photo de profil boutique */}
                <div className="flex flex-col items-center justify-center gap-2.5 pb-2">
                  <div className="relative w-24 h-24 rounded-full bg-amber-100 border-2 border-stone-800 overflow-hidden shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center font-black text-amber-900 text-2xl">
                    {setupShopAvatarUrl ? (
                      <img src={setupShopAvatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      setupShopName ? setupShopName.substring(0, 2).toUpperCase() : 'DK'
                    )}
                    <button
                      type="button"
                      onClick={() => setupAvatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/35 hover:bg-black/45 text-white flex flex-col items-center justify-center gap-1 transition-all cursor-pointer opacity-90"
                      title="Changer la photo"
                    >
                      <Camera className="w-5 h-5 text-white" />
                      <span className="text-[9px] font-extrabold text-white">Changer</span>
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={setupAvatarInputRef}
                    onChange={handleSetupAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <span className="text-[11px] font-bold text-stone-500">Photo de profil boutique</span>
                </div>

                {/* Nom de la boutique */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Nom de la boutique *</label>
                  <input
                    type="text"
                    value={setupShopName}
                    onChange={(e) => setSetupShopName(e.target.value)}
                    placeholder="Ex: DKD Technologies ou votre nom"
                    required
                    className="w-full bg-[#FAF8F5] border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                </div>

                {/* Numéro de téléphone */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Numéro de téléphone *</label>
                  <input
                    type="tel"
                    value={setupShopPhone}
                    onChange={(e) => setSetupShopPhone(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    required
                    className="w-full bg-[#FAF8F5] border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                </div>

                {/* Numéro WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Numéro WhatsApp</label>
                  <input
                    type="tel"
                    value={setupShopWhatsapp}
                    onChange={(e) => setSetupShopWhatsapp(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    className="w-full bg-[#FAF8F5] border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                </div>

                {/* Catégorie / Ce que vous vendez */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Ce que vous vendez (Catégorie) *</label>
                  <select
                    value={setupShopCategory}
                    onChange={(e) => setSetupShopCategory(e.target.value)}
                    className="w-full bg-[#FAF8F5] border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  >
                    <option value="Vente digital (PDF)">Vente digital (PDF)</option>
                    <option value="Vente de documents (livre) à la livraison">Vente de documents (livre) à la livraison</option>
                    <option value="Matériel scolaire & Électronique">Matériel scolaire & Électronique</option>
                    <option value="Formations & Cours particuliers">Formations & Cours particuliers</option>
                    <option value="Services d'études & Tutorat">Services d'études & Tutorat</option>
                    <option value="Autre">Autre</option>
                  </select>

                  {setupShopCategory === 'Autre' && (
                    <div className="mt-2.5">
                      <input
                        type="text"
                        value={setupCustomCategory}
                        onChange={(e) => setSetupCustomCategory(e.target.value)}
                        placeholder="Écrivez ce que vous vendez..."
                        required
                        className="w-full bg-white border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                      />
                    </div>
                  )}
                </div>

                <div className="pt-3">
                  <button
                    type="submit"
                    disabled={isSubmittingSetup}
                    className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-sm rounded-2xl border-2 border-stone-800 shadow-[3px_3px_0px_0px_#1c1917] transition-all cursor-pointer flex items-center justify-center gap-2 active:translate-x-0.5 active:translate-y-0.5"
                  >
                    {isSubmittingSetup ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Création de votre boutique...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Créer ma boutique et commencer</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : (
          <>
        {/* Product Picker Full-Screen Page */}
        {activePage === 'product-picker' && (
          <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 py-4 sm:py-8 animate-fadeIn space-y-4 text-left">
            {/* Search Input */}
            <div className="max-w-xl mx-auto">
              <input
                type="text"
                value={productSearchQuery}
                onChange={(e) => setProductSearchQuery(e.target.value)}
                placeholder="Recherche..."
                className="w-full bg-white border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
              />
            </div>

            {/* Products Grid Cards */}
            <div>
              {products.filter(p => 
                p.title.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                (p.category && p.category.toLowerCase().includes(productSearchQuery.toLowerCase()))
              ).length === 0 ? (
                <div className="text-center py-12 text-stone-400 text-xs font-medium bg-white rounded-2xl border border-stone-200 p-6">
                  Aucun produit trouvé.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                  {products.filter(p => 
                    p.title.toLowerCase().includes(productSearchQuery.toLowerCase()) ||
                    (p.category && p.category.toLowerCase().includes(productSearchQuery.toLowerCase()))
                  ).map(p => {
                    const displayImages = p.imageUrls && p.imageUrls.length > 0 ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
                    const isSelected = selectedProductForAd === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductForAd(p.id);
                          setActivePage('advertise');
                          if (campaignTypeTarget === 'basique') setShowBasiqueModal(true);
                          if (campaignTypeTarget === 'pro') setShowProModal(true);
                          setCampaignTypeTarget(null);
                          triggerToast(`Produit "${p.title}" sélectionné !`);
                        }}
                        className={`bg-white rounded-2xl border-2 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/40 shadow-[2px_2px_0px_0px_#059669]'
                            : 'border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                        }`}
                      >
                        <div>
                          {/* Top Image */}
                          <div className="w-full h-32 bg-stone-100 relative overflow-hidden">
                            {displayImages.length > 0 ? (
                              <img src={displayImages[0]} alt={p.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-stone-400">
                                <Package className="w-6 h-6" />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="p-3 space-y-1">
                            <h4 className="font-bold text-xs text-stone-900 line-clamp-2">{p.title}</h4>
                            {p.description && (
                              <p className="text-[10px] text-stone-500 line-clamp-1">{p.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="p-3 pt-0">
                          <span className="font-black text-xs text-orange-600">{p.price}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Grid View */}
        {activePage === 'main' && (
          <div className="w-full max-w-md mx-auto px-4 py-8 animate-fadeIn">
            <div className="grid grid-cols-2 gap-4">
              {/* 1. Publier un produit */}
              <button
                onClick={() => setActivePage('publish')}
                className="bg-white dark:bg-[#111a2e] hover:bg-stone-50 dark:hover:bg-[#162033] border-3 border-stone-800 dark:border-[#334155] rounded-3xl p-4 shadow-[5px_5px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 flex flex-col items-center justify-between text-center cursor-pointer group min-h-[170px]"
              >
                <div className="w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center p-1 group-hover:scale-105 transition-transform my-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs">
                    <circle cx="50" cy="50" r="48" className="fill-stone-900 dark:fill-blue-600" />
                    <path
                      d="M50 18 L73 41 C75 43 74 46 71 46 L60 46 L60 76 C60 78 58 80 56 80 L44 80 C42 80 40 78 40 76 L40 46 L29 46 C26 46 25 43 27 41 Z"
                      fill="white"
                    />
                  </svg>
                </div>
                <span className="font-extrabold text-xs text-stone-900 dark:text-white leading-snug mt-1">Publier un produit</span>
              </button>

              {/* 2. Voir mes produits */}
              <button
                onClick={() => setActivePage('list')}
                className="bg-white dark:bg-[#111a2e] hover:bg-stone-50 dark:hover:bg-[#162033] border-3 border-stone-800 dark:border-[#334155] rounded-3xl p-4 shadow-[5px_5px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 flex flex-col items-center justify-between text-center cursor-pointer group min-h-[170px]"
              >
                <div className="w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center p-1 group-hover:scale-105 transition-transform relative my-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs" fill="none">
                    {/* Top box */}
                    <rect x="28" y="8" width="44" height="38" rx="3" className="fill-white dark:fill-slate-800 stroke-stone-900 dark:stroke-white" strokeWidth="6" />
                    <path d="M44 8 L44 26 L50 21 L56 26 L56 8" className="fill-stone-900 dark:fill-white" />

                    {/* Bottom Left box */}
                    <rect x="6" y="48" width="44" height="44" rx="3" className="fill-white dark:fill-slate-800 stroke-stone-900 dark:stroke-white" strokeWidth="6" />
                    <path d="M22 48 L22 66 L28 61 L34 66 L34 48" className="fill-stone-900 dark:fill-white" />

                    {/* Bottom Right box */}
                    <rect x="50" y="48" width="44" height="44" rx="3" className="fill-white dark:fill-slate-800 stroke-stone-900 dark:stroke-white" strokeWidth="6" />
                    <path d="M66 48 L66 66 L72 61 L78 66 L78 48" className="fill-stone-900 dark:fill-white" />
                  </svg>
                </div>
                <span className="font-extrabold text-xs text-stone-900 dark:text-white leading-snug mt-1">Voir mes produits</span>
              </button>

              {/* 3. Faire une publicité */}
              <button
                onClick={() => setActivePage('advertise')}
                className="bg-white dark:bg-[#111a2e] hover:bg-stone-50 dark:hover:bg-[#162033] border-3 border-stone-800 dark:border-[#334155] rounded-3xl p-4 shadow-[5px_5px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 flex flex-col items-center justify-between text-center cursor-pointer group min-h-[170px]"
              >
                <div className="w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center p-1 group-hover:scale-105 transition-transform my-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs text-stone-900 dark:text-amber-400" fill="currentColor">
                    {/* Handle */}
                    <path d="M26 60 C26 60 28 82 36 82 C42 82 41 68 41 68 Z" />
                    {/* Body */}
                    <path d="M14 42 C14 37 17 34 22 34 L34 34 C36 34 38 36 38 38 L38 62 C38 64 36 66 34 66 L22 66 C17 66 14 63 14 58 Z" />
                    {/* Cone */}
                    <path d="M38 36 L66 18 C69 16 72 18 72 22 L72 78 C72 82 69 84 66 82 L38 64 Z" />
                    {/* Front rim */}
                    <rect x="72" y="20" width="5" height="60" rx="2.5" fill="currentColor" />
                    {/* Sound Waves */}
                    <path d="M82 30 L93 20" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <path d="M85 50 L97 50" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                    <path d="M82 70 L93 80" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                  </svg>
                </div>
                <span className="font-extrabold text-xs text-stone-900 dark:text-white leading-snug mt-1">Faire une publicité</span>
              </button>

              {/* 4. Analyse de vente */}
              <button
                onClick={() => setActivePage('analytics')}
                className="bg-white dark:bg-[#111a2e] hover:bg-stone-50 dark:hover:bg-[#162033] border-3 border-stone-800 dark:border-[#334155] rounded-3xl p-4 shadow-[5px_5px_0px_0px_#1c1917] dark:shadow-none transition-all active:translate-x-0.5 active:translate-y-0.5 flex flex-col items-center justify-between text-center cursor-pointer group min-h-[170px]"
              >
                <div className="w-24 h-24 sm:w-26 sm:h-26 flex items-center justify-center p-1 group-hover:scale-105 transition-transform my-auto">
                  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xs text-stone-900 dark:text-emerald-400" fill="none">
                    {/* Glass Lens Circle */}
                    <circle cx="42" cy="42" r="32" stroke="currentColor" strokeWidth="8" />
                    {/* Handle */}
                    <path d="M64 64 L86 86" stroke="currentColor" strokeWidth="12" strokeLinecap="round" />
                    {/* Bar Chart */}
                    <rect x="25" y="48" width="7" height="16" rx="2" fill="currentColor" />
                    <rect x="36" y="40" width="7" height="24" rx="2" fill="currentColor" />
                    <rect x="47" y="30" width="7" height="34" rx="2" fill="currentColor" />
                    {/* Arrow Line */}
                    <path d="M22 45 L34 33 L42 39 L56 22" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                    {/* Arrow Head */}
                    <path d="M45 22 L58 21 L56 34 Z" fill="currentColor" />
                  </svg>
                </div>
                <span className="font-extrabold text-xs text-stone-900 dark:text-white leading-snug mt-1">Analyse de vente</span>
              </button>
            </div>
          </div>
        )}

        {/* 1. Publish Page - Up to 3 images import */}
        {activePage === 'publish' && (
          <div className="w-full max-w-2xl lg:max-w-4xl mx-auto px-4 sm:px-8 py-6 md:py-10 animate-fadeIn space-y-4 md:space-y-6 text-left">
            <div className="flex items-center gap-3 md:gap-4 pb-2 md:pb-4">
              <div className="w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl bg-purple-100 border-2 border-stone-800 flex items-center justify-center text-purple-700 shadow-[2px_2px_0px_0px_#1c1917]">
                <Plus className="w-5 h-5 md:w-7 md:h-7" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm md:text-lg text-stone-900">Nouveau Produit / Service</h3>
                <p className="text-[11px] md:text-xs text-stone-500 font-medium">Proposez vos ressources à la communauté</p>
              </div>
            </div>

            <form onSubmit={handlePublishProduct} className="space-y-4 md:space-y-6">
              <div>
                <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Nom du produit *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Ex: Résumé de Cours d'Électrotechnique"
                  required
                  className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Catégorie *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                >
                  <option value="Vente digital (PDF)">Vente digital (PDF)</option>
                  <option value="Vente de documents (livre) à la livraison">Vente de documents (livre) à la livraison</option>
                  <option value="Matériel scolaire">Matériel scolaire</option>
                  <option value="Autre">Autre</option>
                </select>
                {newCategory === 'Autre' && (
                  <div className="mt-2 md:mt-3">
                    <input
                      type="text"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      placeholder="Écrivez votre catégorie..."
                      required
                      className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Prix (Chiffres uniquement) *</label>
                <div className="flex gap-2 md:gap-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newPrice}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewPrice(val);
                    }}
                    placeholder="Ex: 5000"
                    required
                    className="flex-1 bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                  <select
                    value={newCurrency}
                    onChange={(e) => setNewCurrency(e.target.value)}
                    className="bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl px-3 md:px-5 py-3 md:py-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
                  >
                    <option value="FCFA">FCFA</option>
                    <option value="$">($) Dollars</option>
                    <option value="€">(€) Euros</option>
                    <option value="£">(£) Livres</option>
                    <option value="CHF">CHF</option>
                    <option value="CAD">CAD</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1 md:mb-1.5">
                  <label className="block text-xs md:text-sm font-bold text-stone-700">Images du produit (Max 3) *</label>
                  <span className="text-[11px] md:text-xs font-bold text-stone-500">{newImageUrls.length}/3 importées</span>
                </div>
                <input
                  type="file"
                  ref={imageInputRef}
                  onChange={handleImageChange}
                  accept="image/*"
                  className="hidden"
                />
                
                <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-2">
                  {newImageUrls.map((imgUrl, idx) => (
                    <div key={idx} className="relative w-16 h-16 md:w-24 md:h-24 rounded-xl md:rounded-2xl border-2 border-stone-800 overflow-hidden shadow-[2px_2px_0px_0px_#1c1917] bg-white">
                      <img src={imgUrl} alt={`Aperçu ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1.5 md:p-2 text-[9px] shadow cursor-pointer hover:bg-red-700"
                        title="Supprimer cette image"
                      >
                        <X className="w-3 h-3 md:w-4 md:h-4" />
                      </button>
                    </div>
                  ))}

                  {newImageUrls.length < 3 && (
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="w-16 h-16 md:w-24 md:h-24 rounded-xl md:rounded-2xl border-2 border-stone-800 border-dashed bg-white hover:bg-purple-50 text-purple-700 font-extrabold text-xs md:text-sm flex flex-col items-center justify-center gap-1 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                    >
                      <Upload className="w-4 h-4 md:w-6 md:h-6" />
                      <span className="text-[9px] md:text-[11px]">Ajouter</span>
                    </button>
                  )}
                </div>
                {newImageUrls.length === 0 && (
                  <p className="text-[10px] md:text-xs text-red-600 font-bold mt-1.5">Veuillez importer au moins 1 image (Max 3).</p>
                )}
              </div>

              <div>
                <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Description détaillée *</label>
                <textarea
                  rows={5}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Décrivez votre offre..."
                  required
                  className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917] resize-none"
                />
              </div>

              <div className="pt-3 md:pt-5">
                <button
                  type="submit"
                  disabled={!newTitle.trim() || !newPrice.trim() || !newDesc.trim() || newImageUrls.length === 0 || (newCategory === 'Autre' && !customCategory.trim())}
                  className={`w-full py-3.5 md:py-4 font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 border-stone-800 transition-all ${
                    newTitle.trim() && newPrice.trim() && newDesc.trim() && newImageUrls.length > 0 && (newCategory !== 'Autre' || customCategory.trim() !== '')
                      ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-[3px_3px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer'
                      : 'bg-stone-200 text-stone-400 shadow-none cursor-not-allowed'
                  }`}
                >
                  Publier
                </button>
              </div>
            </form>
          </div>
        )}

        {/* 2. List Products Page */}
        {activePage === 'list' && (
          <div className="w-full animate-fadeIn">
            {/* Sticky Top Switcher: Mes publications & Boutique */}
            <div className="sticky top-[51px] z-30 bg-[#FDFBF7]/95 dark:bg-[#070a13] backdrop-blur-xs px-4 py-2 md:py-4 border-b border-stone-200/60 dark:border-[#1e293b] shadow-xs">
              <div className="max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-2 bg-stone-100 dark:bg-[#111a2e] p-1.5 md:p-2 rounded-2xl border-2 border-stone-800 dark:border-[#1e293b] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none">
                <button
                  type="button"
                  onClick={() => setListSubView('publications')}
                  className={`flex-1 py-2 md:py-3 font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer ${
                    listSubView === 'publications'
                      ? 'bg-stone-900 text-white border-stone-800 dark:border-emerald-500 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none'
                      : 'bg-white dark:bg-[#1e293b] text-stone-700 dark:text-slate-200 border-stone-300 dark:border-[#334155] hover:bg-stone-50 dark:hover:bg-[#283852]'
                  }`}
                >
                  Mes publications
                </button>
                <button
                  type="button"
                  onClick={() => setListSubView('boutique')}
                  className={`flex-1 py-2 md:py-3 font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer ${
                    listSubView === 'boutique'
                      ? 'bg-stone-900 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                      : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Boutique
                </button>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 md:py-8 space-y-4 md:space-y-6">
              {listSubView === 'publications' ? (
                <div className="space-y-4 md:space-y-6">
                  {showPubSearchInput && (
                    <div className="animate-fadeIn max-w-xl mx-auto">
                      <input
                        type="text"
                        value={pubSearchQuery}
                        onChange={(e) => setPubSearchQuery(e.target.value)}
                        placeholder="Rechercher un produit..."
                        className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Produits en cours de publication (avec barre de progression qui se remplit en direct) */}
                  {publishingItems.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs font-black text-purple-700 uppercase tracking-wider">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                        <span>En cours de publication ({publishingItems.length})</span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {publishingItems.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white rounded-2xl border-2 border-dashed border-purple-400 p-3.5 shadow-sm space-y-2.5 text-left"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 overflow-hidden shrink-0 flex items-center justify-center">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-5 h-5 text-purple-400" />
                                )}
                              </div>
                              <div className="truncate flex-1">
                                <h4 className="font-extrabold text-xs text-stone-900 truncate">{item.title}</h4>
                                <span className="text-[10px] font-bold text-orange-600">{item.price}</span>
                                <span className="text-[9px] text-stone-400 font-medium block truncate">{item.category}</span>
                              </div>
                            </div>

                            {/* Barre de progression animée */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px] font-extrabold text-purple-700">
                                <span>Publication en cours...</span>
                                <span>{item.progress}%</span>
                              </div>
                              <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-purple-500 to-indigo-600 h-full rounded-full transition-all duration-300"
                                  style={{ width: `${item.progress}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {products.filter(item => 
                    item.title.toLowerCase().includes(pubSearchQuery.toLowerCase()) ||
                    (item.category && item.category.toLowerCase().includes(pubSearchQuery.toLowerCase()))
                  ).length === 0 && publishingItems.length === 0 ? (
                    <div className="text-center py-12 space-y-3 bg-white rounded-2xl border border-stone-200 p-6">
                      <Package className="w-10 h-10 text-stone-400 mx-auto" />
                      <p className="text-xs font-bold text-stone-700">Aucun produit trouvé.</p>
                      {products.length === 0 && (
                        <button
                          type="button"
                          onClick={() => setActivePage('publish')}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                        >
                          Publier mon premier produit
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                      {products.filter(item => 
                        item.title.toLowerCase().includes(pubSearchQuery.toLowerCase()) ||
                        (item.category && item.category.toLowerCase().includes(pubSearchQuery.toLowerCase()))
                      ).map((item) => {
                        const displayImages = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
                        return (
                          <div
                            key={item.id}
                            onClick={() => { setSelectedDetailProduct(item); setActiveDetailImageIndex(0); setIsDescriptionExpanded(false); }}
                            className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer"
                          >
                            <div>
                              {/* Top Image */}
                              <div className="w-full h-36 md:h-48 bg-stone-100 relative overflow-hidden">
                                {displayImages.length > 0 ? (
                                  <img src={displayImages[0]} alt={item.title} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-stone-400">
                                    <Package className="w-8 h-8 md:w-12 md:h-12" />
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div className="p-3 md:p-4 space-y-1 md:space-y-1.5">
                                <h4 className="font-bold text-xs md:text-sm text-stone-900 line-clamp-2">{item.title}</h4>
                                {item.description && (
                                  <p className="text-[11px] md:text-xs text-stone-500 line-clamp-1">{item.description}</p>
                                )}
                              </div>
                            </div>

                            <div className="p-3 md:p-4 pt-0 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-black text-xs md:text-sm text-orange-600">{item.price}</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteProduct(item.id);
                                  }}
                                  className="text-red-500 hover:text-red-700 p-1 md:p-1.5 cursor-pointer"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Boutique Storefront View */
                <div className="space-y-4 md:space-y-6 text-left max-w-7xl mx-auto">
                  <div className="bg-white rounded-2xl md:rounded-3xl border border-stone-200 p-5 md:p-8 shadow-sm space-y-4 md:space-y-6">
                    <div className="flex items-center gap-3 md:gap-5">
                      <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-amber-100 border-2 border-stone-800 overflow-hidden shrink-0 shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center font-black text-amber-900 text-base md:text-2xl">
                        {shopAvatarUrl ? (
                          <img src={shopAvatarUrl} alt={shopName} className="w-full h-full object-cover" />
                        ) : (
                          shopName ? shopName.substring(0, 2).toUpperCase() : 'DK'
                        )}
                      </div>
                      <div className="overflow-hidden space-y-1">
                        <h3 className="font-extrabold text-sm md:text-xl text-stone-900 truncate">{shopName || 'Ma Boutique'}</h3>
                        <p className="text-xs md:text-sm text-stone-500 font-medium truncate">{shopPhone || '+225 00 00 00 00 00'}</p>
                        {shopWhatsapp && shopWhatsapp !== shopPhone && (
                          <p className="text-[10px] md:text-xs text-emerald-700 font-bold truncate">WhatsApp: {shopWhatsapp}</p>
                        )}
                        {shopCategory && (
                          <span className="inline-block bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 rounded-md border border-orange-200">
                            {shopCategory}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Nombre d'abonnés affiché au-dessus des boutons */}
                    <div className="flex items-center gap-2 px-1">
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-blue-700 text-xs font-black shadow-xs">
                        <Users className="w-3.5 h-3.5" />
                        <span>{subscribersCount} abonné{subscribersCount > 1 ? 's' : ''}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-4 pt-1 md:pt-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
                          const willSubscribe = !isSubscribed;
                          setIsSubscribed(willSubscribe);
                          setSubscribersCount(prev => Math.max(0, willSubscribe ? prev + 1 : prev - 1));
                          triggerToast(willSubscribe ? "Vous êtes abonné à votre propre boutique !" : "Vous êtes désabonné de votre boutique.");
                          try {
                            await StudyCloudAPI.toggleSellerFollow(userId, userId, willSubscribe ? 'follow' : 'unfollow');
                          } catch(e) {}
                        }}
                        className={`flex-1 py-2 md:py-3 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 transition-all cursor-pointer ${
                          isSubscribed
                            ? 'bg-stone-100 text-stone-800 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                            : 'bg-blue-600 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-blue-700'
                        }`}
                      >
                        {isSubscribed ? "Abonné ✓" : "S'abonner"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const userId = localStorage.getItem('unifolder_user_id') || 'default-user';
                          const link = `${window.location.origin}/?shop=${encodeURIComponent(userId)}`;
                          if (navigator.clipboard) {
                            navigator.clipboard.writeText(link).then(() => {
                              triggerToast("Lien d'invitation de votre boutique copié !");
                            }).catch(() => {
                              triggerToast("Lien de votre boutique copié !");
                            });
                          } else {
                            triggerToast("Lien de votre boutique copié !");
                          }
                        }}
                        className="flex-1 py-2 md:py-3 bg-white text-stone-800 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] hover:bg-stone-50 cursor-pointer transition-all flex items-center justify-center gap-1.5 md:gap-2"
                      >
                        <Share2 className="w-3.5 h-3.5 md:w-5 md:h-5" />
                        <span>Partager</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    {products.length === 0 ? (
                      <div className="text-center py-10 space-y-2 bg-white border border-stone-200 rounded-2xl p-6">
                        <Package className="w-8 h-8 text-stone-400 mx-auto" />
                        <p className="text-xs font-bold text-stone-700">Aucun produit dans la boutique.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                        {products.map((item) => {
                          const displayImages = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
                          return (
                            <div
                              key={item.id}
                              onClick={() => { setSelectedDetailProduct(item); setActiveDetailImageIndex(0); setIsDescriptionExpanded(false); }}
                              className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer"
                            >
                              <div>
                                {/* Top Image */}
                                <div className="w-full h-36 md:h-48 bg-stone-100 relative overflow-hidden">
                                  {displayImages.length > 0 ? (
                                    <img src={displayImages[0]} alt={item.title} className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-stone-400">
                                      <Package className="w-8 h-8 md:w-12 md:h-12" />
                                    </div>
                                  )}
                                </div>

                                {/* Details */}
                                <div className="p-3 md:p-4 space-y-1 md:space-y-1.5">
                                  <h4 className="font-bold text-xs md:text-sm text-stone-900 line-clamp-2">{item.title}</h4>
                                  {item.description && (
                                    <p className="text-[11px] md:text-xs text-stone-500 line-clamp-1">{item.description}</p>
                                  )}
                                </div>
                              </div>

                              <div className="p-3 md:p-4 pt-0 space-y-2 md:space-y-3">
                                <div className="font-black text-sm md:text-base text-orange-600">{item.price}</div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerToast(`Commande initiée pour "${item.title}" !`);
                                  }}
                                  className="w-full py-1.5 md:py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] md:text-sm rounded-xl md:rounded-2xl shadow-xs cursor-pointer transition-all"
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
                </div>
              )}
          </div>
        </div>
      )}

        {/* 3. Advertise Page */}
        {activePage === 'advertise' && (
          <div className="w-full max-w-5xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-6 md:py-10 animate-fadeIn space-y-6 md:space-y-10 text-left">
            <div className="space-y-2 md:space-y-3">
              <h2 className="font-serif font-black text-xl md:text-3xl lg:text-4xl text-stone-900 dark:text-white">Services de Publicité</h2>
              <p className="text-xs md:text-sm lg:text-base text-stone-600 dark:text-slate-300 font-medium">Choisissez une formule pour booster la visibilité de vos produits et atteindre plus de clients.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
              {/* Card 1: Basique */}
              <div className="bg-[#FAF7F2] dark:bg-[#111a2e] rounded-3xl border border-stone-200/80 dark:border-[#1e293b] p-6 md:p-8 lg:p-10 shadow-sm space-y-5 md:space-y-8">
                <div className="space-y-2">
                  <h3 className="font-serif font-black text-xl md:text-2xl lg:text-3xl text-stone-900 dark:text-white">Basique (Sur l'application)</h3>
                  <p className="text-xs md:text-sm text-stone-600 dark:text-slate-300 font-medium">La publication sera faite exclusivement sur l'application. Choisissez votre budget pour définir le nombre de vues et booster votre visibilité.</p>
                </div>

                <div className="bg-stone-100 dark:bg-[#162033] rounded-2xl p-4 md:p-6 border border-stone-200 dark:border-[#1e293b] text-xs md:text-sm text-stone-700 dark:text-slate-200 font-medium leading-relaxed">
                  Diffusion ciblée au sein de la communauté DKD Technologies. Sélectionnez votre budget lors du lancement.
                </div>

                <button
                  type="button"
                  onClick={() => setShowBasiqueModal(true)}
                  className="w-full py-3 md:py-4 bg-[#D4C5B9] dark:bg-[#1e293b] hover:bg-[#C5B5A8] dark:hover:bg-[#283852] text-stone-900 dark:text-white border dark:border-[#334155] font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-xs transition-all cursor-pointer"
                >
                  Commencer
                </button>
              </div>

              {/* Card 2: Pro */}
              <div className="bg-[#1C3B32] dark:bg-[#0f2d24] text-white rounded-3xl border border-stone-800 dark:border-emerald-500/30 p-6 md:p-8 lg:p-10 shadow-md space-y-5 md:space-y-8">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <h3 className="font-serif font-black text-xl md:text-2xl lg:text-3xl text-white">Pro (App &amp; Réseaux Sociaux)</h3>
                    <p className="text-xs md:text-sm text-stone-300 font-medium">La publication sera faite sur l'application et partagée sur les réseaux sociaux partenaires de DKD Technologies.</p>
                  </div>
                  <span className="px-2.5 md:px-3 py-1 md:py-1.5 bg-amber-400 text-stone-900 font-black text-[9px] md:text-[11px] rounded-full md:rounded-lg tracking-wider uppercase shrink-0">
                    Populaire
                  </span>
                </div>

                <div className="bg-stone-800/60 rounded-2xl p-4 md:p-6 border border-stone-700 text-xs md:text-sm text-stone-200 font-medium leading-relaxed">
                  Diffusion multi-plateforme maximale (App + Facebook, Instagram &amp; TikTok). Choisissez votre budget lors du lancement.
                </div>

                <button
                  type="button"
                  onClick={() => setShowProModal(true)}
                  className="w-full py-3 md:py-4 bg-amber-400 hover:bg-amber-500 text-stone-900 font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl shadow-md transition-all cursor-pointer"
                >
                  Commencer
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. Sales Analytics Page */}
        {activePage === 'analytics' && (
          <div className="w-full max-w-4xl lg:max-w-6xl mx-auto px-4 sm:px-8 py-6 md:py-10 animate-fadeIn space-y-6 text-left">
            <div className="flex items-center justify-between gap-2 pb-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-100 border-2 border-stone-800 flex items-center justify-center text-blue-700 shadow-[2px_2px_0px_0px_#1c1917] shrink-0">
                  <BarChart2 className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-extrabold text-sm text-stone-900 leading-snug">Analyse de vente &amp; Performances</h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePage('boosted-products')}
                className="px-3 py-2 bg-amber-400 hover:bg-amber-500 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all active:translate-x-0.5 active:translate-y-0.5 active:shadow-none flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Zap className="w-3.5 h-3.5 fill-stone-900 text-stone-900" />
                <span>Produits booster</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white border-2 border-stone-800 rounded-2xl p-3 text-center shadow-[3px_3px_0px_0px_#1c1917] flex flex-col justify-between">
                <p className="text-[10px] text-stone-500 font-bold mb-1 leading-tight">Nombre de clics sur commandé</p>
                <p className="font-black text-xs sm:text-sm text-emerald-600">{totalSalesCount}</p>
              </div>

              <div className="bg-white border-2 border-stone-800 rounded-2xl p-3 text-center shadow-[3px_3px_0px_0px_#1c1917] flex flex-col justify-between">
                <p className="text-[10px] text-stone-500 font-bold mb-1 leading-tight">Nombre d'abonnés</p>
                <p className="font-black text-xs sm:text-sm text-purple-600">0</p>
              </div>

              <div className="bg-white border-2 border-stone-800 rounded-2xl p-3 text-center shadow-[3px_3px_0px_0px_#1c1917] flex flex-col justify-between">
                <p className="text-[10px] text-stone-500 font-bold mb-1 leading-tight">Nombre de vues total</p>
                <p className="font-black text-xs sm:text-sm text-blue-600">{totalViews}</p>
              </div>
            </div>

            <div className="space-y-3 pt-3">
              <h4 className="font-extrabold text-sm text-stone-900">Produits les plus performants</h4>
              {products.length === 0 ? (
                <p className="text-xs text-stone-500 text-center py-4">Aucune donnée disponible</p>
              ) : (
                <div className="space-y-3">
                  {products.map((p) => {
                    const firstImg = p.imageUrls?.[0] || p.imageUrl;
                    const clickCount = p.sales || 0;
                    return (
                      <div key={p.id} className="bg-white border border-stone-200/80 rounded-2xl p-4 flex items-center justify-between shadow-xs hover:shadow-sm transition-all">
                        <div className="flex items-center gap-3.5 min-w-0">
                          {firstImg ? (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-stone-200 overflow-hidden shrink-0 bg-stone-100">
                              <img src={firstImg} alt={p.title} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl border border-amber-200/80 bg-amber-50 flex items-center justify-center shrink-0">
                              <Package className="w-7 h-7 text-amber-800" />
                            </div>
                          )}
                          <div className="overflow-hidden pr-2">
                            <p className="font-extrabold text-sm sm:text-base text-stone-900 truncate leading-snug">{p.title}</p>
                            <p className="text-xs text-stone-500 font-bold mt-0.5">
                              {p.views || 0} vues et {clickCount} nombre de clics
                            </p>
                          </div>
                        </div>
                        <span className="font-black text-xs sm:text-sm text-orange-600 bg-orange-50 px-3.5 py-1.5 rounded-xl border border-orange-200/80 shrink-0">
                          {p.price}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Boosted Products Page */}
        {activePage === 'boosted-products' && (
          <div className="w-full animate-fadeIn">
            {/* Sticky Top Switcher: En cours de boost & Terminé */}
            <div className="sticky top-[51px] z-30 bg-[#FDFBF7]/95 dark:bg-[#070a13] backdrop-blur-xs px-4 py-2 border-b border-stone-200/60 dark:border-[#1e293b] shadow-xs">
              <div className="max-w-3xl lg:max-w-4xl mx-auto flex items-center gap-2 bg-stone-100 dark:bg-[#111a2e] p-1.5 md:p-2 rounded-2xl border-2 border-stone-800 dark:border-[#1e293b] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none">
                <button
                  type="button"
                  onClick={() => setBoostSubView('active')}
                  className={`flex-1 py-2 font-extrabold text-xs rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    boostSubView === 'active'
                      ? 'bg-amber-400 text-stone-900 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none'
                      : 'bg-white dark:bg-[#1e293b] text-stone-700 dark:text-slate-200 border-stone-300 dark:border-[#334155] hover:bg-stone-50 dark:hover:bg-[#283852]'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 fill-stone-900" />
                  <span>En cours ({products.filter(p => p.isBoosted && p.boostStatus === 'active').length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBoostSubView('completed')}
                  className={`flex-1 py-2 font-extrabold text-xs rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    boostSubView === 'completed'
                      ? 'bg-stone-900 text-white border-stone-800 dark:border-emerald-500 shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none'
                      : 'bg-white dark:bg-[#1e293b] text-stone-700 dark:text-slate-200 border-stone-300 dark:border-[#334155] hover:bg-stone-50 dark:hover:bg-[#283852]'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terminé ({products.filter(p => p.isBoosted && p.boostStatus === 'completed').length})</span>
                </button>
              </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 md:py-8 space-y-4 md:space-y-6 text-left">
              {(() => {
                const filtered = products.filter(p => 
                  p.isBoosted && (boostSubView === 'active' ? p.boostStatus === 'active' : p.boostStatus === 'completed')
                );

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-12 space-y-3 bg-white rounded-2xl border border-stone-200 p-6">
                      <div className="w-12 h-12 bg-amber-100 rounded-2xl border-2 border-stone-800 flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_#1c1917]">
                        <Zap className="w-6 h-6 text-amber-700" />
                      </div>
                      <p className="text-xs font-extrabold text-stone-800">
                        {boostSubView === 'active' ? 'Aucun produit en cours de boost.' : 'Aucun boost terminé.'}
                      </p>
                      <p className="text-[11px] text-stone-500 max-w-xs mx-auto">
                        {boostSubView === 'active'
                          ? 'Boostez vos produits pour multiplier vos vues et vos ventes.'
                          : 'Vos campagnes de boost terminées s\'afficheront ici.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActivePage('advertise')}
                        className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-stone-900 font-extrabold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all inline-flex items-center gap-1.5"
                      >
                        <Zap className="w-4 h-4 fill-stone-900" />
                        <span>Booster un produit</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
                    {filtered.map((item) => {
                      const displayImages = item.imageUrls && item.imageUrls.length > 0 ? item.imageUrls : (item.imageUrl ? [item.imageUrl] : []);
                      return (
                        <div
                          key={item.id}
                          onClick={() => { setSelectedDetailProduct(item); setActiveDetailImageIndex(0); setIsDescriptionExpanded(false); }}
                          className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between text-left cursor-pointer group"
                        >
                          <div>
                            {/* Top Image */}
                            <div className="w-full h-36 bg-stone-100 relative overflow-hidden">
                              {displayImages.length > 0 ? (
                                <img src={displayImages[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-stone-400">
                                  <Package className="w-8 h-8" />
                                </div>
                              )}

                              {/* Status Tag Overlay */}
                              {item.boostStatus === 'active' ? (
                                <span className="absolute top-2 left-2 bg-amber-400 text-stone-900 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-stone-800 shadow-[1px_1px_0px_0px_#1c1917] flex items-center gap-1">
                                  <Zap className="w-3 h-3 fill-stone-900" />
                                  <span>En cours</span>
                                </span>
                              ) : (
                                <span className="absolute top-2 left-2 bg-stone-200 text-stone-700 font-extrabold text-[10px] px-2 py-0.5 rounded-full border border-stone-400 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Terminé</span>
                                </span>
                              )}
                            </div>

                            {/* Details */}
                            <div className="p-3 space-y-1">
                              <h4 className="font-bold text-xs text-stone-900 line-clamp-2">{item.title}</h4>
                              {item.description && (
                                <p className="text-[11px] text-stone-500 line-clamp-1">{item.description}</p>
                              )}
                            </div>
                          </div>

                          <div className="p-3 pt-0 space-y-2">
                            <div className="font-black text-xs text-orange-600">{item.price}</div>
                            {item.boostStatus === 'active' ? (
                              <div className="bg-amber-50 border border-amber-300 rounded-xl p-2 text-[10px] space-y-1">
                                <div className="flex items-center justify-between font-extrabold text-amber-900">
                                  <span>Formule {item.boostFormula || 'Basique'}</span>
                                  <span>{item.boostViewsCurrent || 0}/{item.boostViewsTarget || 500} vues</span>
                                </div>
                                <div className="w-full bg-amber-200 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className="bg-amber-500 h-full rounded-full transition-all"
                                    style={{ width: `${Math.min(100, ((item.boostViewsCurrent || 0) / (item.boostViewsTarget || 500)) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="bg-stone-100 border border-stone-300 rounded-xl p-2 text-[10px]">
                                <div className="flex items-center justify-between font-extrabold text-stone-700">
                                  <span>Formule {item.boostFormula || 'Pro'}</span>
                                  <span className="text-emerald-700 font-black">✓ {item.boostViewsTarget || 2000} vues</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
          </>
        )}
      </div>

      {/* Right Sidebar Drawer: Profil Boutique / Paramètres */}
      <AnimatePresence>
        {isRightDrawerOpen && (
          <div className="fixed inset-0 z-[100000] pointer-events-none">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 pointer-events-auto bg-black/30 backdrop-blur-xs cursor-pointer"
              onClick={() => setIsRightDrawerOpen(false)}
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.25 }}
              className="absolute top-0 right-0 bottom-0 w-72 sm:w-80 md:w-96 bg-[#FDFBF7] dark:bg-[#0b0f19] border-l-3 border-stone-800 dark:border-[#1e293b] shadow-2xl p-5 flex flex-col justify-between pointer-events-auto overflow-y-auto text-left"
            >
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-3 border-b-2 border-stone-200 dark:border-[#1e293b]">
                  <div>
                    <h2 className="font-extrabold text-sm text-stone-900 dark:text-white">Profil Boutique</h2>
                    <p className="text-[10px] text-stone-500 dark:text-slate-400 font-medium">Gérer vos coordonnées</p>
                  </div>
                  <button
                    onClick={() => setIsRightDrawerOpen(false)}
                    className="p-1.5 hover:bg-stone-200 dark:hover:bg-[#1e293b] rounded-lg border-2 border-stone-800 dark:border-[#334155] bg-[#E8DFD0] dark:bg-[#111a2e] text-stone-900 dark:text-white shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* The 4 configuration items */}
                <div className="space-y-2.5 text-xs font-bold">
                  {/* 1. Nom de la boutique */}
                  <button
                    onClick={() => handleOpenFieldEdit('name')}
                    className="w-full text-left p-3 bg-white hover:bg-stone-50 border-2 border-stone-800 rounded-2xl shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between text-stone-900 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-100 border border-stone-800 flex items-center justify-center text-amber-900 shrink-0">
                        <Store className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] uppercase font-extrabold text-stone-400">Nom de la boutique</p>
                        <p className="font-extrabold text-xs text-stone-900 truncate">{shopName}</p>
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>

                  {/* 2. Numéro de téléphone */}
                  <button
                    onClick={() => handleOpenFieldEdit('phone')}
                    className="w-full text-left p-3 bg-white hover:bg-stone-50 border-2 border-stone-800 rounded-2xl shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between text-stone-900 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-blue-100 border border-stone-800 flex items-center justify-center text-blue-800 shrink-0">
                        <Phone className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] uppercase font-extrabold text-stone-400">Téléphone</p>
                        <p className="font-extrabold text-xs text-stone-900 truncate">{shopPhone}</p>
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>

                  {/* 3. Numéro WhatsApp */}
                  <button
                    onClick={() => handleOpenFieldEdit('whatsapp')}
                    className="w-full text-left p-3 bg-white hover:bg-stone-50 border-2 border-stone-800 rounded-2xl shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between text-stone-900 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-stone-800 flex items-center justify-center text-emerald-800 shrink-0">
                        <MessageCircle className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] uppercase font-extrabold text-stone-400">Numéro WhatsApp</p>
                        <p className="font-extrabold text-xs text-stone-900 truncate">{shopWhatsapp}</p>
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>

                  {/* 4. Photo de profil */}
                  <button
                    onClick={() => handleOpenFieldEdit('avatar')}
                    className="w-full text-left p-3 bg-white hover:bg-stone-50 border-2 border-stone-800 rounded-2xl shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between text-stone-900 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-purple-100 border border-stone-800 flex items-center justify-center text-purple-800 shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] uppercase font-extrabold text-stone-400">Photo de profil</p>
                        <p className="font-extrabold text-xs text-stone-900 truncate">
                          {shopAvatarUrl ? "Image configurée" : "Ajouter une image"}
                        </p>
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>

                  {/* 5. Catégorie de vente */}
                  <button
                    onClick={() => handleOpenFieldEdit('category')}
                    className="w-full text-left p-3 bg-white hover:bg-stone-50 border-2 border-stone-800 rounded-2xl shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between text-stone-900 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-orange-100 border border-stone-800 flex items-center justify-center text-orange-800 shrink-0">
                        <Tag className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <p className="text-[10px] uppercase font-extrabold text-stone-400">Ce que vous vendez</p>
                        <p className="font-extrabold text-xs text-stone-900 truncate">{shopCategory}</p>
                      </div>
                    </div>
                    <Edit3 className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  </button>
                </div>
              </div>

              <div className="pt-3 border-t-2 border-stone-200 text-center mt-4">
                <p className="text-[10px] font-bold text-stone-400">StudyCloud Services • Profil Boutique</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single Field Edit Modal Popup */}
      {editingField && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-3xl border-3 border-stone-800 p-6 md:p-8 max-w-sm md:max-w-lg w-full shadow-[5px_5px_0px_0px_#1c1917] space-y-5 md:space-y-7 text-left relative">
            <div className="flex items-center justify-between pb-3 md:pb-4 border-b-2 border-stone-200">
              <div>
                <h3 className="font-extrabold text-sm md:text-lg text-stone-900">
                  {editingField === 'name' && "Nom de la boutique"}
                  {editingField === 'phone' && "Numéro de téléphone"}
                  {editingField === 'whatsapp' && "Numéro WhatsApp"}
                  {editingField === 'avatar' && "Photo de profil"}
                  {editingField === 'category' && "Ce que vous vendez"}
                </h3>
                <p className="text-[11px] md:text-xs text-stone-500 font-medium">
                  Modifiez cette information pour votre boutique
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingField(null)}
                className="w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl bg-stone-100 hover:bg-stone-200 border-2 border-stone-800 flex items-center justify-center text-stone-900 font-bold text-xs cursor-pointer shadow-[2px_2px_0px_0px_#1c1917]"
              >
                <X className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>

            <form onSubmit={handleApplyFieldEdit} className="space-y-4 md:space-y-6">
              {editingField === 'name' && (
                <div>
                  <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Nom de la boutique *</label>
                  <input
                    type="text"
                    value={tempFieldValue}
                    onChange={(e) => setTempFieldValue(e.target.value)}
                    placeholder="Ex: DKD Technologies"
                    required
                    autoFocus
                    className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                </div>
              )}

              {editingField === 'phone' && (
                <div>
                  <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Numéro de téléphone *</label>
                  <input
                    type="text"
                    value={tempFieldValue}
                    onChange={(e) => setTempFieldValue(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    required
                    autoFocus
                    className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                </div>
              )}

              {editingField === 'whatsapp' && (
                <div>
                  <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Numéro WhatsApp *</label>
                  <input
                    type="text"
                    value={tempFieldValue}
                    onChange={(e) => setTempFieldValue(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    required
                    autoFocus
                    className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  />
                </div>
              )}

              {editingField === 'avatar' && (
                <div className="flex flex-col items-center justify-center gap-3 md:gap-4 py-2 md:py-4">
                  <div className="relative w-24 h-24 md:w-32 md:h-32 rounded-full bg-amber-100 border-2 border-stone-800 overflow-hidden shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-center text-amber-900 font-black text-2xl md:text-4xl">
                    {tempFieldValue ? (
                      <img src={tempFieldValue} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                      shopName ? shopName.substring(0, 2).toUpperCase() : 'DK'
                    )}
                    <button
                      type="button"
                      onClick={() => avatarInputRef.current?.click()}
                      className="absolute inset-0 bg-black/30 hover:bg-black/40 text-white flex items-center justify-center transition-all cursor-pointer opacity-80 hover:opacity-100"
                      title="Changer la photo de profil"
                    >
                      <Camera className="w-7 h-7 md:w-10 md:h-10" />
                    </button>
                  </div>
                  <input
                    type="file"
                    ref={avatarInputRef}
                    onChange={handleAvatarChange}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => avatarInputRef.current?.click()}
                    className="text-xs md:text-sm font-bold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                  >
                    {tempFieldValue ? "Changer la photo" : "Ajouter une photo"}
                  </button>
                </div>
              )}

              {editingField === 'category' && (
                <div className="space-y-3">
                  <label className="block text-xs md:text-sm font-bold text-stone-700 mb-1 md:mb-1.5">Ce que vous vendez (Catégorie principale) *</label>
                  <select
                    value={tempFieldValue}
                    onChange={(e) => setTempFieldValue(e.target.value)}
                    className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                  >
                    <option value="Vente digital (PDF)">Vente digital (PDF)</option>
                    <option value="Vente de documents (livre) à la livraison">Vente de documents (livre) à la livraison</option>
                    <option value="Matériel scolaire & Électronique">Matériel scolaire & Électronique</option>
                    <option value="Formations & Cours particuliers">Formations & Cours particuliers</option>
                    <option value="Services d'études & Tutorat">Services d'études & Tutorat</option>
                    <option value="Autre">Autre</option>
                  </select>

                  {tempFieldValue === 'Autre' && (
                    <div className="pt-1">
                      <label className="block text-[11px] font-bold text-stone-600 mb-1">Précisez votre catégorie :</label>
                      <input
                        type="text"
                        value={customEditCategory}
                        onChange={(e) => setCustomEditCategory(e.target.value)}
                        placeholder="Écrivez ce que vous vendez..."
                        required
                        autoFocus
                        className="w-full bg-white border-2 border-stone-800 rounded-xl md:rounded-2xl p-3 md:p-4 text-xs md:text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 md:gap-5 pt-2 md:pt-4">
                <button
                  type="button"
                  onClick={() => setEditingField(null)}
                  className="flex-1 py-3 md:py-4 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={!isFieldModified}
                  className={`flex-1 py-3 md:py-4 font-extrabold text-xs md:text-sm rounded-xl md:rounded-2xl border-2 transition-all ${
                    isFieldModified
                      ? 'bg-orange-600 hover:bg-orange-700 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer active:translate-x-0.5 active:translate-y-0.5'
                      : 'bg-stone-200 text-stone-400 border-stone-300 cursor-not-allowed opacity-70'
                  }`}
                >
                  Appliquer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl border-2 border-stone-800 p-6 max-w-sm w-full shadow-[4px_4px_0px_0px_#1c1917] space-y-4 text-left">
            {isDeleting || deleteSuccess ? (
              <div className="py-6 text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center transition-all">
                  {isDeleting ? (
                    <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                  ) : (
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white mx-auto shadow-[2px_2px_0px_0px_#1c1917] border-2 border-stone-800">
                      <Check className="w-6 h-6 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="font-extrabold text-xs text-stone-800">
                  {isDeleting ? "Suppression en cours..." : "Supprimé avec succès !"}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-100 border-2 border-stone-800 flex items-center justify-center text-red-600 shrink-0 shadow-[2px_2px_0px_0px_#1c1917]">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-stone-900">Confirmer la suppression</h3>
                    <p className="text-xs text-stone-500">Voulez-vous retirer ce produit ?</p>
                  </div>
                </div>

                <div className="bg-stone-50 rounded-xl p-3 border border-stone-200 text-xs font-bold text-stone-800 line-clamp-1">
                  {productToDelete.title}
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setProductToDelete(null)}
                    className="flex-1 py-2.5 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteProduct}
                    className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all"
                  >
                    Confirmer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Basique Campaign Modal */}
      {showBasiqueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-sm sm:rounded-2xl rounded-none p-5 sm:p-6 pb-28 sm:pb-6 sm:border-2 border-0 border-stone-800 sm:shadow-[4px_4px_0px_0px_#1c1917] shadow-none space-y-4 text-left flex flex-col justify-between sm:justify-start overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 sm:pb-0 border-b sm:border-b-0 border-stone-200">
                <h3 className="font-extrabold text-sm text-stone-900">Formule Basique - Lancement</h3>
                <button
                  type="button"
                  onClick={() => setShowBasiqueModal(false)}
                  className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 font-bold text-xs border border-stone-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">Produit à booster :</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCampaignTypeTarget('basique');
                      setShowBasiqueModal(false);
                      setActivePage('product-picker');
                    }}
                    className="w-full bg-stone-50 border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between cursor-pointer hover:bg-stone-100 transition-all"
                  >
                    {selectedProductForAd ? (
                      <div className="flex items-center gap-2 truncate">
                        {(() => {
                          const p = products.find(item => item.id === selectedProductForAd);
                          const img = p?.imageUrls?.[0] || p?.imageUrl;
                          return (
                            <>
                              {img ? (
                                <img src={img} alt="" className="w-6 h-6 rounded-md object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-stone-400" />
                              )}
                              <span className="truncate">{p ? `${p.title} (${p.price})` : 'Produit sélectionné'}</span>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-stone-400 font-medium">-- Choisir un produit (Mes publications) --</span>
                    )}
                    <span className="text-[10px] font-extrabold bg-stone-200 px-2 py-1 rounded-md text-stone-700 shrink-0">Parcourir</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">Nombre de vues souhaité :</label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={basiqueViews}
                    onChange={(e) => setBasiqueViews(Math.max(100, parseInt(e.target.value) || 0))}
                    className="w-full bg-stone-50 border-2 border-stone-800 rounded-xl p-3 text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                    placeholder="Ex: 1000"
                  />
                </div>

                <div className="bg-stone-100 rounded-2xl p-4 border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Vues ciblées</span>
                    <p className="font-serif font-black text-lg text-stone-900">{basiqueViews.toLocaleString()} vues</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Somme à payer</span>
                    <p className="font-serif font-black text-lg text-emerald-700">{basiqueBudget.toLocaleString()} F</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 sm:pt-2">
              <button
                type="button"
                onClick={() => setShowBasiqueModal(false)}
                className="flex-1 py-3 sm:py-2.5 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedProductForAd}
                onClick={() => {
                  if (!selectedProductForAd) {
                    triggerToast("Veuillez d'abord sélectionner un produit à booster !");
                    return;
                  }
                  const prod = products.find(p => p.id === selectedProductForAd);
                  setProducts(prev => prev.map(p => {
                    if (p.id === selectedProductForAd) {
                      return {
                        ...p,
                        isBoosted: true,
                        boostStatus: 'active',
                        boostFormula: 'Basique',
                        boostViewsTarget: basiqueViews,
                        boostViewsCurrent: 0,
                        boostEndDate: 'Dans 7 jours'
                      };
                    }
                    return p;
                  }));
                  triggerToast(`Paiement réussi ! Campagne Basique lancée pour "${prod?.title || 'Produit'}" !`);
                  setShowBasiqueModal(false);
                  setActivePage('boosted-products');
                  setBoostSubView('active');
                }}
                className={`flex-1 py-3 sm:py-2.5 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer ${
                  selectedProductForAd
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                Payer et lancer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pro Campaign Modal */}
      {showProModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/40 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white w-full h-full sm:h-auto sm:max-w-sm sm:rounded-2xl rounded-none p-5 sm:p-6 pb-28 sm:pb-6 sm:border-2 border-0 border-stone-800 sm:shadow-[4px_4px_0px_0px_#1c1917] shadow-none space-y-4 text-left flex flex-col justify-between sm:justify-start overflow-y-auto">
            <div>
              <div className="flex items-center justify-between pb-3 sm:pb-0 border-b sm:border-b-0 border-stone-200">
                <h3 className="font-extrabold text-sm text-stone-900">Formule Pro - Lancement</h3>
                <button
                  type="button"
                  onClick={() => setShowProModal(false)}
                  className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center text-stone-700 font-bold text-xs border border-stone-300 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">Produit à booster :</label>
                  <button
                    type="button"
                    onClick={() => {
                      setCampaignTypeTarget('pro');
                      setShowProModal(false);
                      setActivePage('product-picker');
                    }}
                    className="w-full bg-stone-50 border-2 border-stone-800 rounded-xl p-3 text-xs font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917] flex items-center justify-between cursor-pointer hover:bg-stone-100 transition-all"
                  >
                    {selectedProductForAd ? (
                      <div className="flex items-center gap-2 truncate">
                        {(() => {
                          const p = products.find(item => item.id === selectedProductForAd);
                          const img = p?.imageUrls?.[0] || p?.imageUrl;
                          return (
                            <>
                              {img ? (
                                <img src={img} alt="" className="w-6 h-6 rounded-md object-cover" />
                              ) : (
                                <Package className="w-4 h-4 text-stone-400" />
                              )}
                              <span className="truncate">{p ? `${p.title} (${p.price})` : 'Produit sélectionné'}</span>
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <span className="text-stone-400 font-medium">-- Choisir un produit (Mes publications) --</span>
                    )}
                    <span className="text-[10px] font-extrabold bg-stone-200 px-2 py-1 rounded-md text-stone-700 shrink-0">Parcourir</span>
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-stone-700">Nombre de vues souhaité (App &amp; Réseaux) :</label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={proViews}
                    onChange={(e) => setProViews(Math.max(500, parseInt(e.target.value) || 0))}
                    className="w-full bg-stone-50 border-2 border-stone-800 rounded-xl p-3 text-sm font-bold text-stone-900 outline-none shadow-[2px_2px_0px_0px_#1c1917]"
                    placeholder="Ex: 5000"
                  />
                </div>

                <div className="bg-stone-100 rounded-2xl p-4 border border-stone-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Vues ciblées</span>
                    <p className="font-serif font-black text-lg text-stone-900">{proViews.toLocaleString()} vues</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">Somme à payer</span>
                    <p className="font-serif font-black text-lg text-emerald-700">{proBudget.toLocaleString()} F</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 sm:pt-2">
              <button
                type="button"
                onClick={() => setShowProModal(false)}
                className="flex-1 py-3 sm:py-2.5 bg-white hover:bg-stone-100 text-stone-800 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer transition-all"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!selectedProductForAd}
                onClick={() => {
                  if (!selectedProductForAd) {
                    triggerToast("Veuillez d'abord sélectionner un produit à booster !");
                    return;
                  }
                  const prod = products.find(p => p.id === selectedProductForAd);
                  setProducts(prev => prev.map(p => {
                    if (p.id === selectedProductForAd) {
                      return {
                        ...p,
                        isBoosted: true,
                        boostStatus: 'active',
                        boostFormula: 'Pro',
                        boostViewsTarget: proViews,
                        boostViewsCurrent: 0,
                        boostEndDate: 'Dans 14 jours'
                      };
                    }
                    return p;
                  }));
                  triggerToast(`Paiement réussi ! Campagne Pro lancée pour "${prod?.title || 'Produit'}" !`);
                  setShowProModal(false);
                  setActivePage('boosted-products');
                  setBoostSubView('active');
                }}
                className={`flex-1 py-3 sm:py-2.5 font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] transition-all cursor-pointer ${
                  selectedProductForAd
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                }`}
              >
                Payer et lancer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Detail Full Screen View */}
      {selectedDetailProduct && (
        <div className="fixed inset-0 md:left-64 z-[100000] bg-[#FAF8F5] flex flex-col animate-fadeIn overflow-y-auto text-left">
          {/* Top Sticky Header */}
          <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-stone-200/80 shadow-2xs">
            <button
              type="button"
              onClick={() => { setSelectedDetailProduct(null); setActiveDetailImageIndex(0); setIsDescriptionExpanded(false); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-bold text-xs rounded-xl transition-all cursor-pointer border border-stone-200"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retour</span>
            </button>
          </div>

          {/* Body Content */}
          <div className="flex-1 max-w-md w-full mx-auto space-y-5 pb-12">
            {/* Horizontal Image Gallery Slider (3 Images) */}
            {(() => {
              const rawImages = selectedDetailProduct.imageUrls && selectedDetailProduct.imageUrls.length > 0
                ? selectedDetailProduct.imageUrls
                : (selectedDetailProduct.imageUrl ? [selectedDetailProduct.imageUrl] : []);

              // Ensure exactly 3 swipable image slides for full gallery experience
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
                          <div className="w-full h-full bg-stone-50 flex flex-col items-center justify-center text-stone-400 gap-2 rounded-xl border border-dashed border-stone-200">
                            <Package className="w-12 h-12 stroke-1" />
                            <span className="text-xs font-medium">Image {idx + 1} / 3</span>
                          </div>
                        )}
                        <span className="absolute bottom-3 right-4 px-2 py-0.5 bg-stone-900/80 text-white font-bold text-[10px] rounded-md backdrop-blur-xs">
                          {idx + 1} / 3
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Slider Indicator Dots for 3 images */}
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

            {/* Title & Price */}
            <div className="px-4 space-y-1">
              <h1 className="font-serif font-black text-xl text-stone-900 leading-snug">
                {selectedDetailProduct.title}
              </h1>
              <div className="font-black text-2xl text-orange-600 pt-1">
                {selectedDetailProduct.price}
              </div>
            </div>

            {/* Description without border box, directly on page with expand toggle */}
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

            {/* Commander Button directly in page flow */}
            <div className="px-4 pt-3">
              <button
                type="button"
                onClick={() => {
                  triggerToast(`Commande initiée pour "${selectedDetailProduct.title}" !`);
                }}
                className="w-full py-3.5 bg-orange-600 hover:bg-orange-700 active:bg-orange-800 text-white font-extrabold text-sm rounded-xl transition-all cursor-pointer text-center shadow-md active:scale-98"
              >
                Commander
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
