import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Clock, 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  Sparkles, 
  HardDrive, 
  Eye, 
  X, 
  FileText,
  Download,
  Trash2,
  Info,
  Lock,
  User,
  Phone,
  MessageCircle,
  CheckCheck,
  Copy,
  ImageIcon,
  ArrowRight
} from 'lucide-react';
import { 
  getUserSubscriptions, 
  getUserStorageRequests, 
  getUserPurchasesHistory,
  deleteUserRequestHistory,
  requestStorageUpgrade,
  getCompanyProfile,
  CompanyProfile
} from '../services/api';
import { useAuth } from '../context/AuthContext';

interface RenewalSectionViewProps {
  onGoToStorage: () => void;
  onSelectPlan?: (planName: string) => void;
}

// Fonction de formatage complet en français : Jour, Mois, Année et Heure exacte
function formatFullDateTimeFrench(dateStr?: string | null): { datePart: string; timePart: string; full: string } {
  if (!dateStr) return { datePart: 'Date non définie', timePart: '', full: 'Date non définie' };
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return { datePart: dateStr, timePart: '', full: dateStr };

    const dayName = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
    const day = d.getDate();
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long' }).format(d);
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');

    const capDayName = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    const capMonth = month.charAt(0).toUpperCase() + month.slice(1);
    const datePart = `${capDayName} ${day} ${capMonth} ${year}`;
    const timePart = `${hours}h${minutes}`;
    return {
      datePart,
      timePart,
      full: `${datePart} à ${timePart}`
    };
  } catch {
    return { datePart: dateStr, timePart: '', full: dateStr };
  }
}

/**
 * Génère et télécharge la fiche officielle / reçu de paiement de l'utilisateur
 * Ne contient que les informations le concernant (aucune information interne)
 */
function downloadReceiptSlip(item: any, activeSub: any, user: any) {
  const ref = item.payment_reference || item.id || ('SC-REC-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const studentName = user?.name || user?.full_name || item.user_name || localStorage.getItem('studycloud_user_name') || 'Étudiant StudyCloud';
  const planName = item.pack_name || item.plan_name || activeSub?.plan_name || 'Abonnement Stockage StudyCloud';
  const validationDate = formatFullDateTimeFrench(item.confirmed_at || item.purchased_at || item.start_date || item.updated_at || item.created_at).full;
  const renewalDate = formatFullDateTimeFrench(item.renewal_date || item.end_date || activeSub?.end_date || activeSub?.payment_due_date).full;

  // Calcul du stockage acheté
  let storagePurchased = item.storage_display || '';
  if (!storagePurchased && item.storage_bought_mb) {
    storagePurchased = item.storage_bought_mb >= 1024 
      ? `${(item.storage_bought_mb / 1024).toFixed(0)} Go` 
      : `${item.storage_bought_mb} Mo`;
  }
  if (!storagePurchased && item.storage_added_mb) {
    storagePurchased = item.storage_added_mb >= 1024 
      ? `${(item.storage_added_mb / 1024).toFixed(0)} Go` 
      : `${item.storage_added_mb} Mo`;
  }
  if (!storagePurchased && item.total_storage_mb) {
    const calcBought = Math.max(0, Number(item.total_storage_mb) - 30);
    storagePurchased = calcBought >= 1024 ? `${(calcBought / 1024).toFixed(0)} Go` : `${calcBought} Mo`;
  }
  if (!storagePurchased && activeSub?.total_storage_mb) {
    storagePurchased = `${Math.max(0, activeSub.total_storage_mb - 30)} Mo`;
  }

  // Calcul du stockage total
  let totalStorage = '';
  if (item.total_storage_mb) {
    totalStorage = item.total_storage_mb >= 1024
      ? `${(item.total_storage_mb / 1024).toFixed(1)} Go (${item.total_storage_mb} Mo)`
      : `${item.total_storage_mb} Mo`;
  } else if (activeSub?.total_storage_mb) {
    totalStorage = activeSub.total_storage_mb >= 1024
      ? `${(activeSub.total_storage_mb / 1024).toFixed(1)} Go (${activeSub.total_storage_mb} Mo)`
      : `${activeSub.total_storage_mb} Mo`;
  } else if (item.storage_bought_mb || item.storage_added_mb) {
    const sum = Number(item.storage_bought_mb || item.storage_added_mb) + 30;
    totalStorage = sum >= 1024 ? `${(sum / 1024).toFixed(1)} Go (${sum} Mo)` : `${sum} Mo`;
  } else {
    totalStorage = storagePurchased || 'Espace actif';
  }

  const pricePaid = item.price_display || (item.price_paid 
    ? `${Number(item.price_paid).toLocaleString('fr-FR')} ${item.currency || 'FCFA'}` 
    : (item.monthly_price ? `${Number(item.monthly_price).toLocaleString('fr-FR')} FCFA` : (activeSub?.monthly_price ? `${Number(activeSub.monthly_price).toLocaleString('fr-FR')} FCFA` : '1 000 FCFA')));
  const paymentMethod = item.payment_method || 'Mobile Money';
  const cycle = (item.billing_cycle === 'yearly' || item.billing_cycle === 'annual') ? 'Annuel' : 'Mensuel';

  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche de Paiement & Reçu Officiel - StudyCloud - ${ref}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 30px 15px;
      background: #f8fafc;
      color: #0f172a;
    }
    .receipt-container {
      max-width: 650px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 12px 30px rgba(0, 0, 0, 0.08);
      overflow: hidden;
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #1e3a2f 0%, #2D4A3E 100%);
      color: white;
      padding: 32px 28px;
      text-align: center;
      position: relative;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .header p {
      margin: 6px 0 0;
      opacity: 0.9;
      font-size: 13px;
    }
    .badge-approved {
      display: inline-block;
      margin-top: 14px;
      background: rgba(16, 185, 129, 0.25);
      border: 1px solid #10b981;
      color: #a7f3d0;
      padding: 5px 16px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .body {
      padding: 28px;
    }
    .section-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 12px;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 22px;
    }
    .box {
      background: #f8fafc;
      padding: 12px 14px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .box-label {
      font-size: 10px;
      color: #64748b;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .box-val {
      font-size: 13px;
      font-weight: 700;
      color: #0f172a;
      margin-top: 4px;
      word-break: break-word;
    }
    .highlight-card {
      background: #ecfdf5;
      border: 1.5px solid #10b981;
      border-radius: 14px;
      padding: 18px 20px;
      margin-bottom: 22px;
    }
    .highlight-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .highlight-row:last-child {
      margin-bottom: 0;
    }
    .hl-label {
      font-size: 12px;
      color: #065f46;
      font-weight: 600;
    }
    .hl-val {
      font-size: 15px;
      font-weight: 800;
      color: #047857;
      font-family: monospace;
    }
    .actions {
      text-align: center;
      margin-top: 20px;
    }
    .btn-print {
      background: #2D4A3E;
      color: white;
      border: none;
      padding: 10px 22px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-print:hover {
      background: #1e332a;
    }
    .footer {
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
      padding: 18px 28px;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.5;
    }
    @media print {
      body { background: white; padding: 0; }
      .receipt-container { box-shadow: none; border: 1px solid #ccc; }
      .actions { display: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <h1>StudyCloud — Reçu Officiel</h1>
      <p>Attestation de Paiement & Confirmation d'Attribution de Stockage</p>
      <div class="badge-approved">✓ Paiement Enregistré & Stockage Validé</div>
    </div>

    <div class="body">
      <div class="section-title">Informations de la Transaction</div>
      <div class="grid">
        <div class="box">
          <div class="box-label">Référence du Reçu</div>
          <div class="box-val" style="font-family: monospace;">${ref}</div>
        </div>
        <div class="box">
          <div class="box-label">Date & Heure du Paiement</div>
          <div class="box-val">${validationDate}</div>
        </div>
        <div class="box">
          <div class="box-label">Étudiant Titulaire</div>
          <div class="box-val">${studentName}</div>
        </div>
        <div class="box">
          <div class="box-label">Mode de Règlement</div>
          <div class="box-val">${paymentMethod}</div>
        </div>
      </div>

      <div class="section-title">Détails de l'Abonnement & Stockage Attribué</div>
      <div class="highlight-card">
        <div class="highlight-row">
          <span class="hl-label">Formule / Forfait</span>
          <span class="hl-val">${planName}</span>
        </div>
        <div class="highlight-row">
          <span class="hl-label">Stockage Acheté</span>
          <span class="hl-val">${storagePurchased}</span>
        </div>
        <div class="highlight-row">
          <span class="hl-label">Somme du Stockage Total Disponible</span>
          <span class="hl-val">${totalStorage}</span>
        </div>
        <div class="highlight-row">
          <span class="hl-label">Montant Réglé</span>
          <span class="hl-val">${pricePaid}</span>
        </div>
        <div class="highlight-row">
          <span class="hl-label">Cycle d'abonnement</span>
          <span class="hl-val">${cycle}</span>
        </div>
        <div class="highlight-row">
          <span class="hl-label">Date de Fin & Renouvellement</span>
          <span class="hl-val">${renewalDate}</span>
        </div>
      </div>

      <div class="actions">
        <button class="btn-print" onclick="window.print()">🖨️ Imprimer ou Enregistrer en PDF</button>
      </div>
    </div>

    <div class="footer">
      StudyCloud Côte d'Ivoire — Plateforme Académique Sécurisée.<br>
      Ce reçu certifie votre droit d'accès et votre quota de stockage conformément aux conditions générales d'utilisation.
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Recu_Paiement_StudyCloud_${ref}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const RenewalSectionView: React.FC<RenewalSectionViewProps> = ({ onGoToStorage }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [zoomedReceiptUrl, setZoomedReceiptUrl] = useState<string | null>(null);

  // État de la modale d'historique des achats
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);

  // État de la modale de renouvellement d'abonnement
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState('');
  const [receiptFileSize, setReceiptFileSize] = useState('');
  const [submittingRenewal, setSubmittingRenewal] = useState(false);
  const [renewalSuccess, setRenewalSuccess] = useState(false);
  const [renewalSuccessReqId, setRenewalSuccessReqId] = useState<string | null>(null);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const currentUserId = user?.id || (typeof localStorage !== 'undefined'
    ? localStorage.getItem('unifolder_user_id') || 'default-user'
    : 'default-user');

  const fetchData = async () => {
    try {
      // 1. Récupération des abonnements depuis l'API BDD
      const subRes = await getUserSubscriptions(currentUserId);
      let subs = (subRes.success && Array.isArray(subRes.subscriptions)) ? subRes.subscriptions : [];

      // 2. Récupération des demandes depuis l'API BDD
      const reqRes = await getUserStorageRequests(currentUserId);
      let serverReqs = (reqRes.success && Array.isArray(reqRes.requests)) ? reqRes.requests : [];

      // 3. Récupération de l'historique officiel des achats depuis la table BDD user_purchases_history
      const purRes = await getUserPurchasesHistory(currentUserId);
      let dbPurchases = (purRes.success && Array.isArray(purRes.purchases)) ? purRes.purchases : [];

      // 4. Fusion complète et déduplication de tous les achats de l'utilisateur
      const allPurchasesMap = new Map<string, any>();

      // A) Ingestion des achats depuis la table BDD user_purchases_history
      dbPurchases.forEach(p => {
        if (p && p.id && !p.user_deleted_at) {
          allPurchasesMap.set(p.id, p);
        }
      });

      // B) Ingestion des demandes validées/approuvées
      serverReqs.forEach(r => {
        if (r && (r.status === 'approved' || r.status === 'confirmed') && !r.user_deleted_at) {
          const key = r.id;
          if (!allPurchasesMap.has(key)) {
            allPurchasesMap.set(key, {
              ...r,
              id: r.id,
              pack_name: r.pack_name || 'Demande de Stockage',
              purchased_at: r.confirmed_start_date || r.confirmed_at || r.updated_at || r.created_at,
              confirmed_at: r.confirmed_start_date || r.confirmed_at || r.updated_at || r.created_at,
              price_paid: r.price_paid,
              price_display: r.price_display,
              storage_bought_mb: r.additional_mb || 1024,
              storage_display: r.storage_display,
              total_storage_mb: (r.additional_mb || 1024) + 30,
              payment_reference: r.id,
              payment_method: r.payment_method || 'Mobile Money',
              renewal_date: r.confirmed_end_date || ''
            });
          }
        }
      });

      // C) Ingestion des abonnements actifs ou passés (afin qu'un abonnement payant ne manque jamais)
      subs.forEach(s => {
        if (s && s.status !== 'free' && Number(s.total_storage_mb || 0) > 30 && !s.user_deleted_at) {
          const key = s.request_id || s.id;
          if (!allPurchasesMap.has(key)) {
            allPurchasesMap.set(key, {
              ...s,
              id: s.id,
              pack_name: s.plan_name || 'Abonnement StudyCloud',
              purchased_at: s.start_date || s.created_at,
              confirmed_at: s.start_date || s.created_at,
              price_paid: s.monthly_price,
              currency: s.currency || 'FCFA',
              storage_bought_mb: Math.max(0, Number(s.total_storage_mb) - 30),
              total_storage_mb: s.total_storage_mb,
              renewal_date: s.end_date,
              payment_reference: s.id,
              payment_method: 'Mobile Money'
            });
          }
        }
      });

      // D) Fusion de secours local si présent
      try {
        const local = JSON.parse(localStorage.getItem('studycloud_local_requests') || '[]');
        local.forEach((r: any) => {
          if (r && (r.status === 'approved' || r.status === 'confirmed') && !r.user_deleted_at && !allPurchasesMap.has(r.id)) {
            allPurchasesMap.set(r.id, r);
          }
        });
      } catch {}

      const mergedPurchases = Array.from(allPurchasesMap.values()).sort((a, b) => {
        const tA = new Date(a.purchased_at || a.confirmed_at || a.created_at || 0).getTime();
        const tB = new Date(b.purchased_at || b.confirmed_at || b.created_at || 0).getTime();
        return tB - tA;
      });

      // Filtrer les demandes actives pour le panneau de droite
      const activeRequests = serverReqs.filter(r => !r.user_deleted_at);

      setSubscriptions(subs);
      setRequests(activeRequests);
      setPurchases(mergedPurchases);

      // Ouvrir automatiquement la première demande si elle existe
      if (activeRequests.length > 0 && !expandedRequestId) {
        setExpandedRequestId(activeRequests[0].id);
      }
    } catch (err) {
      console.error('Erreur chargement données de renouvellement:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const toggleExpand = (id: string) => {
    setExpandedRequestId(prev => (prev === id ? null : id));
  };

  // Suppression d'un historique avec le délai de 1 mois
  const handleDeleteHistoryItem = async (itemId: string) => {
    if (!window.confirm('Voulez-vous supprimer cet achat de votre historique ?\n\n⚠️ Note : La suppression définitive de cet historique sera effective après 1 mois (30 jours).')) {
      return;
    }

    setDeletingId(itemId);
    try {
      const res = await deleteUserRequestHistory(itemId, currentUserId);
      
      // Retirer immédiatement de la vue locale des achats et des demandes
      setPurchases(prev => prev.filter(p => p.id !== itemId));
      setRequests(prev => prev.filter(r => r.id !== itemId));
      
      // Mettre à jour le localStorage
      try {
        const local = JSON.parse(localStorage.getItem('studycloud_local_requests') || '[]');
        const updated = local.filter((r: any) => r.id !== itemId);
        localStorage.setItem('studycloud_local_requests', JSON.stringify(updated));
      } catch {}

      setHistoryNotice(res.message || 'Achat retiré de l\'affichage. La suppression définitive de cet historique sera effective après 1 mois (30 jours).');
      setTimeout(() => setHistoryNotice(null), 8000);
    } catch (err) {
      console.error('Erreur suppression historique:', err);
      alert('Une erreur est survenue lors de la suppression.');
    } finally {
      setDeletingId(null);
    }
  };
  useEffect(() => {
    getCompanyProfile().then(res => {
      if (res && res.success && res.profile) {
        setCompanyProfile(res.profile);
      }
    }).catch(() => {});
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image valide (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir une image de moins de 20 Mo.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawDataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const maxDim = 1280;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          const approxBytes = Math.round((compressedDataUrl.length * 3) / 4);
          const formatted = approxBytes > 1024 * 1024
            ? (approxBytes / (1024 * 1024)).toFixed(1) + ' Mo'
            : Math.round(approxBytes / 1024) + ' Ko';
          setReceiptImage(compressedDataUrl);
          setReceiptFileName(file.name);
          setReceiptFileSize(formatted);
        } else {
          setReceiptImage(rawDataUrl);
          setReceiptFileName(file.name);
          setReceiptFileSize(Math.round(file.size / 1024) + ' Ko');
        }
      };
      img.onerror = () => {
        setReceiptImage(rawDataUrl);
        setReceiptFileName(file.name);
        setReceiptFileSize(Math.round(file.size / 1024) + ' Ko');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptImage(null);
    setReceiptFileName('');
    setReceiptFileSize('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCopyNumber = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const activeSubscription = subscriptions.find(s => s.status === 'active') || null;

  // Calcul du stockage acheté et du stockage total pour la partie gauche
  const freeBaseStorageMb = 30;
  const totalStorageMb = activeSubscription ? (Number(activeSubscription.total_storage_mb) || freeBaseStorageMb) : freeBaseStorageMb;
  const purchasedStorageMb = activeSubscription 
    ? (activeSubscription.storage_added_mb ? Number(activeSubscription.storage_added_mb) : Math.max(0, totalStorageMb - freeBaseStorageMb))
    : 0;

  const purchasedStorageDisplay = purchasedStorageMb >= 1024 
    ? `${(purchasedStorageMb / 1024).toFixed(0)} Go` 
    : `${purchasedStorageMb} Mo`;

  const totalStorageDisplay = totalStorageMb >= 1024 
    ? `${(totalStorageMb / 1024).toFixed(1)} Go (${totalStorageMb} Mo)` 
    : `${totalStorageMb} Mo`;

  const studentName = user?.name || user?.full_name || (typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_user_name') : '') || 'Étudiant StudyCloud';
  const studentPhone = user?.phone || activeSubscription?.user_phone || (typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_user_phone') : '') || '';
  const studentWhatsapp = user?.whatsapp || activeSubscription?.user_whatsapp || studentPhone;

  const handleRenewalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptImage || submittingRenewal || !activeSubscription) return;
    setSubmittingRenewal(true);

    const planName = activeSubscription.plan_name || 'Abonnement StudyCloud';
    const pricePaid = Number(activeSubscription.monthly_price || 0);

    try {
      const res = await requestStorageUpgrade({
        packId: planName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        packName: `Renouvellement des abonnements - ${planName}`,
        requestType: 'renewal',
        isRenewal: true,
        additionalMb: purchasedStorageMb,
        storageDisplay: `+${purchasedStorageDisplay}`,
        pricePaid: pricePaid,
        priceDisplay: `${pricePaid.toLocaleString('fr-FR')} ${activeSubscription.currency || 'FCFA'}`,
        billingCycle: 'monthly',
        currency: activeSubscription.currency || 'FCFA',
        userName: studentName,
        contactPhone: studentPhone,
        whatsappNumber: studentWhatsapp,
        paymentMethod: 'Mobile Money (Wave / Orange / MTN / Moov)',
        receiptImageUrl: receiptImage,
        notes: `Demande de renouvellement de l'abonnement ${planName} (+${purchasedStorageDisplay} pour ${pricePaid.toLocaleString('fr-FR')} FCFA). Contact: ${studentPhone}`
      });

      if (res.success) {
        const reqId = res.requestId || 'REQ-' + Math.floor(100000 + Math.random() * 900000);
        setRenewalSuccessReqId(reqId);
        setRenewalSuccess(true);

        try {
          const newReqObj = {
            id: reqId,
            user_id: currentUserId,
            pack_id: planName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            pack_name: `Renouvellement des abonnements - ${planName}`,
            request_type: 'renewal',
            is_renewal: true,
            additional_mb: purchasedStorageMb,
            storage_display: `+${purchasedStorageDisplay}`,
            price_display: `${pricePaid.toLocaleString('fr-FR')} ${activeSubscription.currency || 'FCFA'}`,
            billing_cycle: 'monthly',
            price_paid: pricePaid,
            currency: activeSubscription.currency || 'FCFA',
            payment_method: 'Mobile Money (Wave / Orange / MTN / Moov)',
            receipt_image_url: receiptImage,
            contact_phone: studentPhone,
            user_whatsapp: studentWhatsapp,
            notes: `Demande de renouvellement de l'abonnement ${planName}`,
            status: 'pending',
            created_at: new Date().toISOString()
          };
          const existing = JSON.parse(localStorage.getItem('studycloud_local_requests') || '[]');
          localStorage.setItem('studycloud_local_requests', JSON.stringify([newReqObj, ...existing.filter((x: any) => x.id !== reqId)]));
        } catch {}

        fetchData();
      } else {
        alert(res.message || "Une erreur est survenue lors de l'enregistrement de votre demande de renouvellement.");
      }
    } catch (err: any) {
      alert(err?.message || "Erreur réseau lors de la validation du renouvellement.");
    } finally {
      setSubmittingRenewal(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-2 sm:px-4 pb-20 animate-fadeIn">
      {/* ========================================================================= */}
      {/* BARRE D'ACTIONS SUPÉRIEURE (HISTORIQUE DES ACHATS & ACTUALISER)           */}
      {/* ========================================================================= */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <button
          type="button"
          onClick={() => setShowHistoryModal(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-[#111a2e] dark:hover:bg-[#1e293b] text-[#2D4A3E] dark:text-emerald-400 border border-[#2D4A3E]/20 dark:border-emerald-500/30 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
        >
          <FileText className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Historique des achats & paiements</span>
          {purchases.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white font-mono shadow-xs">
              {purchases.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-[#111a2e] dark:hover:bg-[#1e293b] text-[#2D4A3E] dark:text-slate-200 border border-[#2D4A3E]/20 dark:border-slate-700 text-xs font-bold transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-50"
          title="Actualiser les informations"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Message de notification (ex: suppression différée à 1 mois) */}
      {historyNotice && (
        <div className="mb-4 p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 text-xs flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="font-medium">{historyNotice}</span>
          </div>
          <button 
            onClick={() => setHistoryNotice(null)}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-300 cursor-pointer p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MENU CONTINU UNIQUE SÉPARÉ EN DEUX PAR UNE LIGNE VERTICALE                */}
      {/* GAUCHE : Abonnements en cours | DROITE : Demandes en cours                */}
      {/* ========================================================================= */}
      <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl border-2 border-[#D4C9B5] dark:border-[#1e293b] shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#D4C9B5] dark:divide-slate-800 items-stretch">
          
          {/* --------------------------------------------------------------------- */}
          {/* CÔTÉ GAUCHE : ABONNEMENTS EN COURS                                    */}
          {/* --------------------------------------------------------------------- */}
          <div className="p-5 sm:p-7 space-y-5 flex flex-col justify-between">
            <div>
              {/* En-tête côté gauche */}
              <div className="flex items-center justify-between border-b border-[#D4C9B5] dark:border-slate-800 pb-3.5 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#2D4A3E]/10 dark:bg-emerald-500/20 text-[#2D4A3E] dark:text-emerald-400 flex items-center justify-center font-bold">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#2D4A3E] dark:text-white">
                      Abonnements en cours
                    </h3>
                    <span className="text-[11px] text-[#5C6B5A] dark:text-slate-400">
                      Formule active, dates et détails de stockage
                    </span>
                  </div>
                </div>

                {activeSubscription ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Formule Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#5C6B5A]/15 text-[#5C6B5A] dark:text-slate-400 border border-[#5C6B5A]/20">
                    Mode Gratuit
                  </span>
                )}
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-[#5C6B5A] dark:text-slate-400 flex flex-col items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-[#2D4A3E] dark:text-emerald-400" />
                  <span>Chargement de vos informations d'abonnement...</span>
                </div>
              ) : activeSubscription ? (
                /* CARTE DE L'ABONNEMENT ACTIF */
                <div className="space-y-4">
                  {/* Titre de la formule et référence */}
                  <div className="p-4 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/90 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2D4A3E] to-[#1c3027] dark:from-emerald-600 dark:to-emerald-800 text-white flex items-center justify-center shadow-sm">
                        <HardDrive className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm sm:text-base font-extrabold text-[#2D4A3E] dark:text-white">
                          {activeSubscription.plan_name || 'Abonnement StudyCloud'}
                        </h4>
                        <span className="text-[11px] font-mono text-[#5C6B5A] dark:text-slate-400">
                          Réf: {activeSubscription.id || 'SUB-ACTIF'}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 font-mono block">
                        +{purchasedStorageDisplay}
                      </span>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-400">Stockage acheté</span>
                    </div>
                  </div>

                  {/* Date de commencement (Heure, Jour, Mois, Année) */}
                  <div className="p-3.5 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/70 border border-[#D4C9B5] dark:border-slate-800 flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                      <Calendar className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block tracking-wider">
                        Date & Heure de commencement :
                      </span>
                      <div className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white font-mono">
                        {formatFullDateTimeFrench(activeSubscription.start_date || activeSubscription.created_at).full}
                      </div>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500 block">
                        Début effectif de la validité de votre abonnement
                      </span>
                    </div>
                  </div>

                  {/* Date de fin (Heure, Jour, Mois, Année) */}
                  <div className="p-3.5 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/70 border border-[#D4C9B5] dark:border-slate-800 flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block tracking-wider">
                        Date & Heure de fin :
                      </span>
                      <div className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white font-mono">
                        {activeSubscription.end_date 
                          ? formatFullDateTimeFrench(activeSubscription.end_date).full 
                          : 'Non définie (Permanent)'}
                      </div>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500 block">
                        Échéance de la période contractuelle actuelle
                      </span>
                    </div>
                  </div>

                  {/* Grille : Prix à payer chaque mois & Stockage Total */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Prix à payer chaque mois */}
                    <div className="p-3.5 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block tracking-wider">
                        Prix à payer chaque mois :
                      </span>
                      <div className="text-base sm:text-lg font-black text-[#2D4A3E] dark:text-emerald-400 font-mono">
                        {Number(activeSubscription.monthly_price || 0).toLocaleString('fr-FR')} {activeSubscription.currency || 'FCFA'}
                      </div>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500 block">
                        Tarif régulier de la mensualité
                      </span>
                    </div>

                    {/* Somme de son stockage */}
                    <div className="p-3.5 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 space-y-1">
                      <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block tracking-wider">
                        Somme de votre stockage :
                      </span>
                      <div className="text-base sm:text-lg font-black text-[#2D4A3E] dark:text-white font-mono">
                        {totalStorageDisplay}
                      </div>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500 block">
                        30 Mo gratuits + {purchasedStorageDisplay} achetés
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                /* ÉCRAN SI MODE GRATUIT SANS ABONNEMENT */
                <div className="p-6 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/60 border border-[#D4C9B5] dark:border-slate-800 text-center space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#2D4A3E]/10 dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-300 mx-auto flex items-center justify-center">
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-[#2D4A3E] dark:text-white">
                      Formule Actuelle : Mode Gratuit de Bienvenue
                    </h4>
                    <p className="text-xs text-[#5C6B5A] dark:text-slate-400 max-w-sm mx-auto">
                      Vous disposez de votre espace cloud gratuit de <strong>30 Mo</strong>. Vous n'avez aucun abonnement mensuel actif pour l'instant.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-white/70 dark:bg-slate-950/60 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-around text-xs">
                    <div>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-400 block">Stockage Total :</span>
                      <strong className="text-[#2D4A3E] dark:text-white font-mono">30 Mo</strong>
                    </div>
                    <div className="h-6 w-px bg-[#D4C9B5] dark:bg-slate-800"></div>
                    <div>
                      <span className="text-[10px] text-[#5C6B5A] dark:text-slate-400 block">Mensualité :</span>
                      <strong className="text-emerald-700 dark:text-emerald-400 font-mono">0 FCFA</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton d'action en bas de la partie gauche */}
            <div className="pt-4">
              {activeSubscription ? (
                <button
                  type="button"
                  onClick={() => {
                    setRenewalSuccess(false);
                    setReceiptImage(null);
                    setReceiptFileName('');
                    setReceiptFileSize('');
                    setShowRenewalModal(true);
                  }}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 active:scale-95 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 transition cursor-pointer"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Renouveler l'abonnement</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onGoToStorage}
                  className="w-full py-3 px-4 rounded-xl bg-[#2D4A3E] hover:bg-[#233b31] dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Découvrir les formules & Souscrire</span>
                </button>
              )}
            </div>
          </div>

          {/* --------------------------------------------------------------------- */}
          {/* CÔTÉ DROIT : DEMANDES EN COURS                                        */}
          {/* --------------------------------------------------------------------- */}
          <div className="p-5 sm:p-7 space-y-5 flex flex-col justify-between">
            <div>
              {/* En-tête côté droit */}
              <div className="flex items-center justify-between border-b border-[#D4C9B5] dark:border-slate-800 pb-3.5 mb-5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/15 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-[#2D4A3E] dark:text-white">
                      Demandes en cours
                    </h3>
                    <span className="text-[11px] text-[#5C6B5A] dark:text-slate-400">
                      Suivi en temps réel de vos commandes et activations
                    </span>
                  </div>
                </div>

                <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#2D4A3E]/15 dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-200 border border-[#2D4A3E]/20 dark:border-slate-700">
                  {requests.length} demande{requests.length > 1 ? 's' : ''}
                </span>
              </div>

              {loading ? (
                <div className="py-12 text-center text-xs text-[#5C6B5A] dark:text-slate-400 flex flex-col items-center gap-2">
                  <RotateCw className="w-5 h-5 animate-spin text-orange-500" />
                  <span>Chargement de vos demandes...</span>
                </div>
              ) : requests.length > 0 ? (
                /* LISTE DES DEMANDES EN COURS */
                <div className="space-y-3.5">
                  {requests.map((req) => {
                    const isExpanded = expandedRequestId === req.id;
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved' || req.status === 'confirmed';
                    const isRejected = req.status === 'rejected';

                    const reqDate = formatFullDateTimeFrench(req.created_at);

                    // Si la demande est confirmée, elle devient VERTE avec les éléments spécifiés
                    if (isApproved) {
                      return (
                        <div
                          key={req.id}
                          className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/90 dark:bg-emerald-950/40 p-4 sm:p-5 shadow-sm space-y-3 transition-all duration-200"
                        >
                          {/* Message de confirmation en vert */}
                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-black text-emerald-900 dark:text-emerald-300">
                                  Votre demande a été acceptée !
                                </span>
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-600 text-white font-mono">
                                  Validée
                                </span>
                              </div>
                              <p className="text-xs text-emerald-800 dark:text-emerald-200 font-medium">
                                Vous disposez désormais du stockage demandé sur votre compte StudyCloud.
                              </p>
                            </div>
                          </div>

                          {/* Informations synthétiques sur l'abonnement validé */}
                          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/30">
                              <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block">Stockage ajouté :</span>
                              <div className="text-xs sm:text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                                +{req.storage_display || `${req.storage_added_mb || req.additional_mb || 0} Mo`}
                              </div>
                            </div>
                            <div className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-emerald-500/30">
                              <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block">Montant réglé :</span>
                              <div className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white font-mono">
                                {req.price_display || `${Number(req.price_paid || 0).toLocaleString('fr-FR')} FCFA`}
                              </div>
                            </div>
                          </div>

                          {/* Date de validation & référence */}
                          <div className="flex items-center justify-between text-[11px] text-emerald-800/80 dark:text-emerald-300/80 font-mono flex-wrap gap-2 pt-1 border-t border-emerald-500/20">
                            <span>📅 Validé le : {formatFullDateTimeFrench(req.confirmed_at || req.updated_at || req.created_at).full}</span>
                            <span>Réf: {req.id}</span>
                          </div>

                          {/* BOUTON FLÈCHE TÉLÉCHARGER LE REÇU */}
                          <div className="pt-2 flex items-center justify-end">
                            <button
                              type="button"
                              onClick={() => downloadReceiptSlip(req, activeSubscription, user)}
                              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-95"
                              title="Télécharger la fiche de reçu officiel"
                            >
                              <Download className="w-4 h-4" />
                              <span>Télécharger le reçu</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    // Si la demande est en attente ou rejetée
                    return (
                      <div
                        key={req.id}
                        className={`rounded-2xl border-2 transition-all duration-200 overflow-hidden ${
                          isExpanded
                            ? 'border-[#2D4A3E] dark:border-emerald-500 bg-[#F5F0E8] dark:bg-slate-900 shadow-md'
                            : 'border-[#D4C9B5] dark:border-slate-800 bg-[#F5F0E8]/70 dark:bg-slate-900/60 hover:border-[#2D4A3E]/50 dark:hover:border-slate-700'
                        }`}
                      >
                        {/* En-tête cliquable */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(req.id)}
                          className="w-full p-3.5 sm:p-4 text-left flex items-center justify-between gap-3 cursor-pointer transition select-none"
                        >
                          <div className="flex items-start gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 font-bold ${
                                isPending
                                  ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                  : 'bg-red-500/20 text-red-600 dark:text-red-400'
                              }`}
                            >
                              {isPending ? (
                                <Clock className="w-4 h-4 animate-pulse" />
                              ) : (
                                <AlertCircle className="w-4 h-4" />
                              )}
                            </div>

                            <div className="min-w-0 space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white truncate">
                                  {req.pack_name || 'Demande de Stockage'}
                                </span>
                                {req.storage_display && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-[#2D4A3E]/10 dark:bg-slate-800 text-[#2D4A3E] dark:text-emerald-400">
                                    {req.storage_display}
                                  </span>
                                )}
                              </div>
                              
                              <div className="text-[11px] text-[#5C6B5A] dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                                <span>📅 {reqDate.full}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isPending && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                                En attente
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-red-500/20 text-red-700 dark:text-red-300 border border-red-500/30">
                                Rejetée
                              </span>
                            )}

                            <div className="w-7 h-7 rounded-lg bg-[#D4C9B5]/40 dark:bg-slate-800 text-[#2D4A3E] dark:text-slate-300 flex items-center justify-center transition-transform duration-200">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </div>
                          </div>
                        </button>

                        {/* Détails dépliés */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-[#D4C9B5] dark:border-slate-800 space-y-3.5 animate-fadeIn">
                            <div className="flex items-center justify-between text-[11px] text-[#5C6B5A] dark:text-slate-400 pt-2 flex-wrap gap-2">
                              <span>Numéro de référence : <strong className="font-mono text-[#2D4A3E] dark:text-slate-200">{req.id}</strong></span>
                              <span>Cycle : <strong className="text-[#2D4A3E] dark:text-slate-200">{req.billing_cycle === 'monthly' ? 'Mensuel' : 'Annuel (-10%)'}</strong></span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-950/70 border border-[#D4C9B5] dark:border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block mb-0.5">Montant :</span>
                                <div className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400 font-mono">
                                  {req.price_display || `${Number(req.price_paid || 0).toLocaleString('fr-FR')} ${req.currency || 'FCFA'}`}
                                </div>
                                <span className="text-[10px] text-[#5C6B5A] dark:text-slate-500">Moyen : {req.payment_method || 'Mobile Money'}</span>
                              </div>

                              <div className="p-2.5 rounded-xl bg-white/70 dark:bg-slate-950/70 border border-[#D4C9B5] dark:border-slate-800">
                                <span className="text-[10px] uppercase font-bold text-[#5C6B5A] dark:text-slate-400 block mb-0.5">Contact transmis :</span>
                                <div className="text-xs font-mono font-bold text-[#2D4A3E] dark:text-slate-200 truncate">
                                  📞 {req.contact_phone || 'Non renseigné'}
                                </div>
                              </div>
                            </div>

                            {/* Reçu joint pour aperçu */}
                            {req.receipt_image_url && (
                              <div className="p-3 rounded-2xl bg-white/80 dark:bg-slate-950/80 border border-[#D4C9B5] dark:border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-[#2D4A3E] dark:text-slate-200 flex items-center gap-1.5">
                                    <FileText className="w-3.5 h-3.5 text-orange-500" />
                                    Preuve de transfert transmise :
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setZoomedReceiptUrl(req.receipt_image_url)}
                                    className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Agrandir</span>
                                  </button>
                                </div>

                                <div 
                                  onClick={() => setZoomedReceiptUrl(req.receipt_image_url)}
                                  className="relative group cursor-pointer max-h-40 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-center p-1.5"
                                >
                                  <img
                                    src={req.receipt_image_url}
                                    alt="Reçu"
                                    className="max-h-36 w-auto object-contain rounded-lg"
                                  />
                                </div>
                              </div>
                            )}

                            {/* Message pour la demande en attente */}
                            <div className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                              isPending 
                                ? 'bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-500/20' 
                                : 'bg-red-500/10 text-red-900 dark:text-red-300 border border-red-500/20'
                            }`}>
                              <span className="text-sm mt-0.5">ℹ️</span>
                              <span className="leading-relaxed">
                                {isPending && "Votre demande ainsi que votre preuve de paiement sont en cours de vérification par l'équipe administrative. Dès confirmation, cette case deviendra verte avec votre reçu téléchargeable."}
                                {isRejected && "Cette demande n'a pas pu être validée. Veuillez contacter l'assistance ou renouveler votre démarche."}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ÉCRAN SI AUCUNE DEMANDE ENREGISTRÉE */
                <div className="p-6 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/60 border border-[#D4C9B5] dark:border-slate-800 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-orange-500/10 text-orange-600 dark:text-orange-400 mx-auto flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm sm:text-base font-bold text-[#2D4A3E] dark:text-white">
                      Aucune demande en attente
                    </h4>
                    <p className="text-xs text-[#5C6B5A] dark:text-slate-400 max-w-sm mx-auto">
                      Vos commandes ou renouvellements de stockage apparaîtront ici dès leur envoi.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Note informative discrète en bas de la partie droite */}
            <div className="pt-4 text-center">
              <span className="text-[11px] text-[#5C6B5A] dark:text-slate-500">
                ⚡ Validation rapide par nos administrateurs 7j/7
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALE HISTORIQUE OFFICIEL DES ACHATS ET PAIEMENTS                        */}
      {/* ========================================================================= */}
      {showHistoryModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setShowHistoryModal(false)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-7 max-w-2xl w-full max-h-[88vh] flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header de la modale */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-[#2D4A3E] dark:text-white">
                    Historique des Achats & Paiements
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Consultez vos transactions enregistrées et téléchargez vos reçus officiels
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowHistoryModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avertissement sur le délai de suppression de 1 mois */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <span>
                <strong>Information légale :</strong> La suppression d'un élément de l'historique sera effective après un délai de <strong>1 mois (30 jours)</strong> afin de préserver vos reçus en cas de besoin.
              </span>
            </div>

            {/* Liste des achats et paiements */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {purchases.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p>Aucun achat enregistré dans votre historique pour le moment.</p>
                </div>
              ) : (
                purchases.map((item) => {
                  const confDate = formatFullDateTimeFrench(item.purchased_at || item.confirmed_at || item.start_date || item.created_at);
                  const isDeleting = deletingId === item.id;
                  const storageBoughtText = item.storage_display || (item.storage_bought_mb ? (item.storage_bought_mb >= 1024 ? `+${(item.storage_bought_mb / 1024).toFixed(0)} Go` : `+${item.storage_bought_mb} Mo`) : (item.storage_added_mb ? `+${item.storage_added_mb} Mo` : ''));
                  const totalStorageText = item.total_storage_mb ? (item.total_storage_mb >= 1024 ? `${(item.total_storage_mb / 1024).toFixed(1)} Go` : `${item.total_storage_mb} Mo`) : '';

                  return (
                    <div 
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-emerald-500/40 transition"
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white">
                            {item.pack_name || item.plan_name || 'Abonnement Stockage'}
                          </span>
                          {storageBoughtText && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 font-bold">
                              {storageBoughtText}
                            </span>
                          )}
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                            Confirmé
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 pt-1">
                          <div>📅 <strong>Date du paiement :</strong> {confDate.full}</div>
                          <div>💰 <strong>Montant réglé :</strong> <span className="font-bold text-[#2D4A3E] dark:text-emerald-400 font-mono">{item.price_display || `${Number(item.price_paid || item.monthly_price || 0).toLocaleString('fr-FR')} FCFA`}</span> ({item.payment_method || 'Mobile Money'})</div>
                          {totalStorageText && <div>💾 <strong>Stockage total :</strong> {totalStorageText}</div>}
                          {item.renewal_date && <div>🗓️ <strong>Date de renouvellement :</strong> {formatFullDateTimeFrench(item.renewal_date).full}</div>}
                          <div>🔖 <strong>Réf reçu :</strong> <span className="font-mono">{item.payment_reference || item.id}</span></div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {/* Bouton Télécharger le reçu avec la flèche */}
                        <button
                          type="button"
                          onClick={() => downloadReceiptSlip(item, activeSubscription, user)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                          title="Télécharger la fiche de reçu officiel"
                        >
                          <Download className="w-4 h-4" />
                          <span>Télécharger le reçu</span>
                        </button>

                        {/* Bouton Poubelle pour supprimer l'historique */}
                        <button
                          type="button"
                          disabled={isDeleting}
                          onClick={() => handleDeleteHistoryItem(item.id)}
                          className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 flex items-center justify-center transition cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Supprimer cet achat de l'historique (effectif après 1 mois)"
                        >
                          {isDeleting ? (
                            <RotateCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pied de la modale */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DE RENOUVELLEMENT DE L'ABONNEMENT (FORMULAIRE PRÉ-REMPLI VERROUILLÉ) */}
      {/* ========================================================================= */}
      {showRenewalModal && activeSubscription && (
        <div 
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fadeIn"
          onClick={() => setShowRenewalModal(false)}
        >
          <div 
            className="relative bg-[#F5F0E8] dark:bg-[#0f172a] rounded-3xl border-2 border-orange-500/40 shadow-2xl max-w-2xl w-full my-auto overflow-hidden text-slate-900 dark:text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {/* En-tête de la modale */}
            <div className="bg-[#E8DFD0] dark:bg-[#11192e] px-5 py-4 border-b-2 border-orange-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold shrink-0">
                  <RotateCw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-[#2D4A3E] dark:text-white tracking-tight">
                    Renouvellement de l'abonnement
                  </h3>
                  <p className="text-[11px] text-[#5C6B5A] dark:text-slate-400">
                    Paramètres pré-remplis de votre forfait • Seul le reçu de paiement est à fournir
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRenewalModal(false)}
                className="w-8 h-8 rounded-full bg-[#D4C9B5]/60 hover:bg-[#D4C9B5] dark:bg-slate-800 dark:hover:bg-slate-700 text-[#2D4A3E] dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 max-h-[80vh] overflow-y-auto space-y-5">
              {renewalSuccess ? (
                /* Confirmation après soumission */
                <div className="text-center py-6 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 text-[11px] font-bold uppercase tracking-wider">
                      Demande de renouvellement transmise
                    </span>
                    <h4 className="text-xl sm:text-2xl font-black text-[#2D4A3E] dark:text-white pt-1">
                      Merci, {studentName} !
                    </h4>
                    <p className="text-xs text-[#5C6B5A] dark:text-slate-300 max-w-md mx-auto">
                      Votre demande de renouvellement pour l'abonnement <strong>{activeSubscription.plan_name}</strong> a bien été transmise avec votre reçu. Elle apparaîtra dans votre suivi et sera validée rapidement.
                    </p>
                    <div className="inline-block p-2 rounded-xl bg-white dark:bg-slate-900 border border-[#D4C9B5] dark:border-slate-800 font-mono text-xs text-[#2D4A3E] dark:text-white mt-2">
                      Réf : #{renewalSuccessReqId}
                    </div>
                  </div>
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => setShowRenewalModal(false)}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      Fermer et suivre la validation
                    </button>
                  </div>
                </div>
              ) : (
                /* Formulaire de renouvellement */
                <form onSubmit={handleRenewalSubmit} className="space-y-4 text-xs">
                  {/* Avertissement / Notice verrouillage */}
                  <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/25 flex items-center gap-2.5 text-[#2D4A3E] dark:text-orange-300">
                    <Lock className="w-4 h-4 text-orange-600 shrink-0" />
                    <span className="text-[11px] font-medium leading-tight">
                      Tous les champs ci-dessous sont automatiquement renseignés et verrouillés. Vous avez seulement besoin de téléverser la capture d'écran du reçu de paiement.
                    </span>
                  </div>

                  {/* Champs pré-remplis verrouillés */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Nom et Prénoms (readOnly) */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C6B5A] dark:text-slate-400 block mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><User className="w-3 h-3" /> Nom & Prénoms</span>
                          <span className="text-[10px] text-slate-500 font-normal">🔒 Verrouillé</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={studentName}
                          className="w-full bg-[#E8DFD0]/60 dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 text-[#2D4A3E] dark:text-white font-bold px-3 py-2 rounded-xl cursor-not-allowed select-none focus:outline-none"
                        />
                      </div>

                      {/* Numéro de contact (readOnly) */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C6B5A] dark:text-slate-400 block mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> Numéro de contact</span>
                          <span className="text-[10px] text-slate-500 font-normal">🔒 Verrouillé</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={studentPhone || 'Non renseigné'}
                          className="w-full bg-[#E8DFD0]/60 dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 text-[#2D4A3E] dark:text-white font-mono font-bold px-3 py-2 rounded-xl cursor-not-allowed select-none focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Formule & Stockage */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Formule d'abonnement (readOnly) */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C6B5A] dark:text-slate-400 block mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><HardDrive className="w-3 h-3 text-orange-600" /> Formule à renouveler</span>
                          <span className="text-[10px] text-slate-500 font-normal">🔒 Verrouillé</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={activeSubscription.plan_name || 'Abonnement StudyCloud'}
                          className="w-full bg-[#E8DFD0]/60 dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 text-orange-700 dark:text-orange-400 font-extrabold px-3 py-2 rounded-xl cursor-not-allowed select-none focus:outline-none"
                        />
                      </div>

                      {/* Stockage / Capacité (readOnly) */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C6B5A] dark:text-slate-400 block mb-1 flex items-center justify-between">
                          <span>📦 Capacité de stockage</span>
                          <span className="text-[10px] text-slate-500 font-normal">🔒 Verrouillé</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`+${purchasedStorageDisplay} (Total: ${totalStorageDisplay})`}
                          className="w-full bg-[#E8DFD0]/60 dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 text-emerald-700 dark:text-emerald-400 font-mono font-bold px-3 py-2 rounded-xl cursor-not-allowed select-none focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Prix à payer chaque mois & Cycle (readOnly) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Prix à payer chaque mois */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C6B5A] dark:text-slate-400 block mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><CreditCard className="w-3 h-3 text-emerald-600" /> Somme à régler</span>
                          <span className="text-[10px] text-slate-500 font-normal">🔒 Verrouillé</span>
                        </label>
                        <div className="w-full bg-[#E8DFD0]/60 dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 px-3 py-2 rounded-xl flex items-center justify-between">
                          <span className="font-mono font-black text-sm text-[#2D4A3E] dark:text-emerald-400">
                            {Number(activeSubscription.monthly_price || 0).toLocaleString('fr-FR')} {activeSubscription.currency || 'FCFA'}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-500">Tarif régulier</span>
                        </div>
                      </div>

                      {/* Cycle */}
                      <div>
                        <label className="text-[11px] font-bold text-[#5C6B5A] dark:text-slate-400 block mb-1 flex items-center justify-between">
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3 text-blue-600" /> Période d'abonnement</span>
                          <span className="text-[10px] text-slate-500 font-normal">🔒 Verrouillé</span>
                        </label>
                        <input
                          type="text"
                          readOnly
                          value="Facturation mensuelle (+1 mois)"
                          className="w-full bg-[#E8DFD0]/60 dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 text-[#2D4A3E] dark:text-white font-bold px-3 py-2 rounded-xl cursor-not-allowed select-none focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Numéros pour le paiement mobile */}
                  <div className="p-3.5 rounded-2xl bg-white/70 dark:bg-slate-900/70 border border-[#D4C9B5] dark:border-slate-800 space-y-2.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5C6B5A] dark:text-slate-400 block">
                      Comptes de transfert officiel StudyCloud :
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {/* Wave */}
                      <div className="p-2 rounded-xl bg-[#F5F0E8] dark:bg-slate-950 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between gap-1">
                        <div className="truncate">
                          <span className="text-[9px] font-extrabold text-blue-600 dark:text-blue-400 block uppercase">Wave</span>
                          <span className="font-mono font-bold text-xs truncate block">{companyProfile?.wave_number || '+225 07 00 00 00 00'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(companyProfile?.wave_number || '+2250700000000', 'wave')}
                          className="p-1.5 rounded-lg bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'wave' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* Orange */}
                      <div className="p-2 rounded-xl bg-[#F5F0E8] dark:bg-slate-950 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between gap-1">
                        <div className="truncate">
                          <span className="text-[9px] font-extrabold text-orange-600 dark:text-orange-400 block uppercase">Orange</span>
                          <span className="font-mono font-bold text-xs truncate block">{companyProfile?.orange_number || '+225 07 00 00 00 00'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(companyProfile?.orange_number || '+2250700000000', 'orange')}
                          className="p-1.5 rounded-lg bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'orange' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>

                      {/* MTN */}
                      <div className="p-2 rounded-xl bg-[#F5F0E8] dark:bg-slate-950 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between gap-1">
                        <div className="truncate">
                          <span className="text-[9px] font-extrabold text-yellow-600 dark:text-yellow-400 block uppercase">MTN / Moov</span>
                          <span className="font-mono font-bold text-xs truncate block">{companyProfile?.mtn_number || '+225 05 00 00 00 00'}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleCopyNumber(companyProfile?.mtn_number || '+2250500000000', 'mtn')}
                          className="p-1.5 rounded-lg bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs shrink-0 cursor-pointer"
                        >
                          {copiedKey === 'mtn' ? <CheckCheck className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* SEUL CHAMP MODIFIABLE : IMAGE DU REÇU DE PAIEMENT */}
                  <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-orange-500/50 dark:border-orange-500/50 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-[#2D4A3E] dark:text-white flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        <span>Image du reçu de paiement (Capture d'écran) *</span>
                      </label>
                      <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                        Seul champ modifiable
                      </span>
                    </div>

                    <input
                      type="file"
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />

                    {receiptImage ? (
                      /* Aperçu du reçu */
                      <div className="bg-[#F5F0E8] dark:bg-slate-950 rounded-xl border border-emerald-500/50 p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                            <span className="text-xs font-bold truncate">{receiptFileName}</span>
                            <span className="text-[10px] font-mono text-slate-500 shrink-0">({receiptFileSize})</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveReceipt}
                            className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                            title="Supprimer cette capture"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="relative rounded-lg overflow-hidden bg-black/5 dark:bg-black/40 border border-slate-700 flex items-center justify-center max-h-[180px]">
                          <img
                            src={receiptImage}
                            alt="Reçu de paiement"
                            className="max-h-[170px] w-auto max-w-full object-contain rounded"
                          />
                        </div>

                        <div className="flex items-center justify-between text-[11px] pt-1">
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Reçu prêt pour renouvellement
                          </span>
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-orange-600 dark:text-orange-400 font-bold underline cursor-pointer"
                          >
                            Changer l'image
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Zone de clic pour téléverser */
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-orange-500/50 hover:border-orange-500 dark:border-orange-500/40 dark:hover:border-orange-400 rounded-xl p-5 text-center cursor-pointer transition hover:bg-orange-500/5 group"
                      >
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="text-xs font-bold text-[#2D4A3E] dark:text-white">
                          Cliquez ici pour joindre votre capture d'écran de paiement
                        </div>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                          Formats acceptés : JPG, PNG, WEBP (Max 20 Mo)
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Bouton de confirmation */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={!receiptImage || submittingRenewal}
                      className={`w-full py-3.5 px-6 rounded-2xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
                        receiptImage && !submittingRenewal
                          ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-500/30 cursor-pointer active:scale-95'
                          : 'bg-[#D4C9B5]/60 dark:bg-slate-800 text-slate-400 dark:text-slate-600 border border-[#D4C9B5] dark:border-slate-700 cursor-not-allowed opacity-60'
                      }`}
                    >
                      {submittingRenewal ? (
                        <>
                          <RotateCw className="w-4 h-4 animate-spin" />
                          <span>Envoi de votre demande de renouvellement...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{receiptImage ? 'Confirmer le renouvellement' : 'Joignez le reçu pour renouveler'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALE DE ZOOM SUR LE REÇU DE PAIEMENT (IMAGE)                           */}
      {/* ========================================================================= */}
      {zoomedReceiptUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
          onClick={() => setZoomedReceiptUrl(null)}
        >
          <div 
            className="relative bg-white dark:bg-slate-900 rounded-3xl p-3 sm:p-4 max-w-3xl max-h-[90vh] w-full flex flex-col border border-slate-700 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800 px-2">
              <span className="text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white flex items-center gap-2">
                <span>🧾</span> Preuve de paiement enregistrée
              </span>
              <button
                onClick={() => setZoomedReceiptUrl(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-2 flex items-center justify-center">
              <img
                src={zoomedReceiptUrl}
                alt="Reçu agrandi"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
