import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  UploadCloud, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  MessageCircle, 
  User, 
  HardDrive, 
  CreditCard, 
  Copy, 
  CheckCheck, 
  Trash2, 
  RotateCw, 
  HelpCircle, 
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { requestStorageUpgrade, getCompanyProfile, CompanyProfile } from '../services/api';
import { useAuth } from '../context/AuthContext';

export interface RenewalSubscriptionData {
  id?: string;
  plan_name?: string;
  pack_name?: string;
  user_name?: string;
  user_phone?: string;
  user_whatsapp?: string;
  monthly_price?: number;
  price_paid?: number;
  currency?: string;
  billing_cycle?: string;
  total_storage_mb?: number;
  storage_added_mb?: number;
  storage_display?: string;
  words_count?: number;
  plan_type?: string;
  user_id?: string;
}

interface RenewalFormViewProps {
  subscription: RenewalSubscriptionData | null;
  onBack: () => void;
  onSuccess?: (requestId: string) => void;
}

export const RenewalFormView: React.FC<RenewalFormViewProps> = ({
  subscription,
  onBack,
  onSuccess
}) => {
  const { user } = useAuth();

  // Profil entreprise & comptes marchands chargés dynamiquement
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);

  useEffect(() => {
    let isMounted = true;
    getCompanyProfile().then((prof) => {
      if (isMounted && prof && prof.company_name) {
        setCompanyProfile(prof);
      }
    }).catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // Reçu de paiement (Fichier Image en Base64)
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileSize, setReceiptFileSize] = useState<string>('');

  // États de soumission et succès
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string>('');

  // Outil de copie des numéros de paiement
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [zoomedPaymentImage, setZoomedPaymentImage] = useState<{ url: string; title: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Identifiant utilisateur individuel garanti
  const currentUserId = subscription?.user_id || user?.id || (typeof localStorage !== 'undefined'
    ? localStorage.getItem('unifolder_user_id') || 'default-user'
    : 'default-user');

  // Extraction et calcul des données d'abonnement
  const studentName = 
    subscription?.user_name || 
    user?.name ||
    (user as any)?.full_name ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_user_name') || localStorage.getItem('unifolder_user_name') : '') || 
    'Étudiant StudyCloud';

  const studentPhone = 
    subscription?.user_phone || 
    user?.phone ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_user_phone') || localStorage.getItem('unifolder_user_phone') : '') || 
    '+225 0101007978';

  const studentWhatsapp = 
    subscription?.user_whatsapp || 
    (user as any)?.whatsapp ||
    (typeof localStorage !== 'undefined' ? localStorage.getItem('studycloud_user_whatsapp') : '') || 
    studentPhone;

  const planName = subscription?.plan_name || subscription?.pack_name || 'Basique Stockage';
  const pricePaid = Number(subscription?.monthly_price || subscription?.price_paid || 5500);
  const currency = subscription?.currency || 'FCFA';
  const isYearly = subscription?.billing_cycle === 'yearly' || subscription?.billing_cycle === 'annual';
  const cycleBadge = isYearly ? 'Annuel' : 'Mensuel';
  const cycleDescription = isYearly ? 'Facturation annuelle (-10%)' : 'Facturation mensuelle (+1 mois)';

  // Calcul de la capacité de stockage
  const freeBaseStorageMb = 30;
  const totalStorageMb = Number(subscription?.total_storage_mb) || 10240;
  const purchasedStorageMb = subscription?.storage_added_mb 
    ? Number(subscription?.storage_added_mb) 
    : Math.max(0, totalStorageMb - freeBaseStorageMb);

  const purchasedStorageDisplay = purchasedStorageMb >= 1024 
    ? `${(purchasedStorageMb / 1024).toFixed(0)} Go` 
    : `${purchasedStorageMb} Mo`;

  const storageDisplay = subscription?.storage_display || (purchasedStorageMb > 0 
    ? `+${purchasedStorageDisplay} (Total: ${(totalStorageMb / 1024).toFixed(1)} Go)`
    : `${totalStorageMb} Mo`);

  const priceDisplay = `${pricePaid.toLocaleString('fr-FR')} ${currency}`;

  // Seul le reçu est requis pour le renouvellement car le reste est pré-rempli et verrouillé
  const isFormValid = receiptImage !== null;

  // Gestion de l'import et de la compression du reçu de paiement
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP).');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptImage || submitting) return;

    setSubmitting(true);

    try {
      const res = await requestStorageUpgrade({
        userId: currentUserId,
        packId: planName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        packName: `Renouvellement des abonnements - ${planName}`,
        requestType: 'renewal',
        isRenewal: true,
        additionalMb: purchasedStorageMb,
        storageDisplay: storageDisplay,
        pricePaid: pricePaid,
        priceDisplay: priceDisplay,
        billingCycle: isYearly ? 'annual' : 'monthly',
        currency: currency,
        userName: studentName,
        contactPhone: studentPhone,
        whatsappNumber: studentWhatsapp,
        paymentMethod: 'Mobile Money (Wave / Orange / MTN / Moov)',
        receiptImageUrl: receiptImage,
        notes: `Demande de renouvellement de l'abonnement ${planName} (${storageDisplay} pour ${priceDisplay}). Contact: ${studentPhone}`
      });

      if (res.success) {
        const reqId = res.requestId || 'REN-' + Math.floor(100000 + Math.random() * 900000);
        setSubmittedRequestId(reqId);
        setIsSuccess(true);

        try {
          const newReqObj = {
            id: reqId,
            user_id: currentUserId,
            pack_id: planName.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            pack_name: `Renouvellement des abonnements - ${planName}`,
            request_type: 'renewal',
            is_renewal: true,
            additional_mb: purchasedStorageMb,
            storage_display: storageDisplay,
            price_display: priceDisplay,
            billing_cycle: isYearly ? 'yearly' : 'monthly',
            price_paid: pricePaid,
            currency: currency,
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

        // ATTENTION : On n'appelle PAS onSuccess ici immédiatement !
        // On laisse l'écran de succès affiché pour que l'étudiant voie son récapitulatif
        // et le message de confirmation avec le numéro de référence.
      } else {
        alert(res.message || "Une erreur est survenue lors de l'enregistrement de votre renouvellement.");
      }
    } catch (err: any) {
      alert(err?.message || "Erreur réseau lors de la validation du renouvellement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full pb-16 animate-fadeIn">
      {/* ========================================================================= */}
      {/* 1. BARRE FIXE EN HAUT COLLÉE AU DESIGN GLOBAL                             */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-[#F5F0E8]/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 border-b-2 border-[#2D4A3E]/15 dark:border-[#1e293b] shadow-xs">
        {/* Bouton retour */}
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span className="hidden sm:inline">Retour aux abonnements</span>
        </button>

        {/* Titre central avec breadcrumb */}
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-orange-500 animate-pulse shrink-0"></span>
          <h2 className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white truncate">
            Renouvellement : <span className="text-orange-600 dark:text-orange-400">{planName}</span>
          </h2>
        </div>

        {/* Badge récapitulatif */}
        <div className="shrink-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg shadow-sm">
          {cycleBadge}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CONTENU PRINCIPAL DE LA PAGE DE RENOUVELLEMENT                         */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[1250px] mx-auto px-4 py-6 sm:py-8">
        
        {/* En-tête de page */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-orange-600 dark:text-orange-400 text-xs font-bold uppercase tracking-wider">
            <RotateCw className="w-4 h-4" />
            <span>Étape de renouvellement d'abonnement</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-2">
            Renouvellement de l'abonnement
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6B5A] dark:text-slate-400 max-w-2xl leading-relaxed">
            Confirmez la prolongation de votre formule actuelle et transmettez votre capture de paiement. Dès validation par l'administration, votre abonnement sera immédiatement prolongé sans interruption.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* ÉCRAN DE SUCCÈS APRÈS CONFIRMATION DU RENOUVELLEMENT                      */}
        {/* ========================================================================= */}
        {isSuccess ? (
          <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl p-6 sm:p-10 border-2 border-orange-500 dark:border-orange-400 shadow-xl max-w-2xl mx-auto text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase">
                Demande de renouvellement envoyée avec succès
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#2D4A3E] dark:text-white pt-2">
                Merci, {studentName} !
              </h2>
              <div className="space-y-1.5 max-w-md mx-auto">
                <p className="text-xs sm:text-sm text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Votre demande de renouvellement d'abonnement a bien été transmise à <strong className="text-[#2D4A3E] dark:text-white font-semibold">l'équipe StudyCloud</strong> et sera traitée rapidement.
                </p>
                <p className="text-[11px] sm:text-xs text-[#5C6B5A]/90 dark:text-slate-400 leading-relaxed">
                  Vous pouvez suivre son avancement et vos échéances à tout moment dans votre espace abonnement.
                </p>
              </div>
            </div>

            {/* Récapitulatif de la commande */}
            <div className="bg-[#F5F0E8] dark:bg-[#0b0f19] p-4 sm:p-5 rounded-2xl border border-[#D4C9B5] dark:border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Référence demande :</span>
                <span className="font-mono font-bold text-[#2D4A3E] dark:text-white">#{submittedRequestId}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Formule à renouveler :</span>
                <span className="font-bold text-[#2D4A3E] dark:text-white">{planName}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Stockage / Capacité :</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{storageDisplay}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Montant transmis :</span>
                <span className="font-bold text-[#2D4A3E] dark:text-white">{priceDisplay}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Numéro de contact :</span>
                <span className="font-mono text-[#2D4A3E] dark:text-white">{studentPhone}</span>
              </div>
              {studentWhatsapp && (
                <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                  <span className="text-[#5C6B5A] dark:text-slate-400">WhatsApp :</span>
                  <span className="font-mono text-[#2D4A3E] dark:text-white">{studentWhatsapp}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-[#5C6B5A] dark:text-slate-400">Statut actuel :</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                  ⏳ En attente de validation (15-30 min)
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (onSuccess) {
                    onSuccess(submittedRequestId);
                  }
                  onBack();
                }}
                className="w-full sm:w-auto px-6 py-3 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20362d] dark:hover:bg-emerald-700 text-[#F5F0E8] dark:text-white font-bold text-xs sm:text-sm rounded-xl shadow-md cursor-pointer transition flex items-center justify-center gap-2 active:scale-95 group"
              >
                <span>Retourner au suivi de l'abonnement</span>
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        ) : (
          /* ======================================================================= */
          /* MISE EN PAGE SCINDÉE EN DEUX PAR UNE LIGNE VERTICALE                    */
          /* ======================================================================= */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative items-start">
            
            {/* LIGNE VERTICALE DE SÉPARATION SUR ORDINATEUR */}
            <div className="hidden lg:block absolute top-0 bottom-0 left-1/2 w-[2px] bg-[#2D4A3E]/20 dark:bg-[#1e293b] transform -translate-x-1/2"></div>

            {/* ===================================================================== */}
            {/* CÔTÉ GAUCHE : FORMULAIRE PRÉ-REMPLI & REÇU                            */}
            {/* ===================================================================== */}
            <form onSubmit={handleSubmit} className="space-y-5 lg:pr-6">
              <div className="border-b border-[#2D4A3E]/15 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-[#2D4A3E] dark:text-white flex items-center gap-2">
                  <span>📝</span>
                  <span>Vos coordonnées & Justificatif</span>
                </h3>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400">
                  Tous les champs marqués d'une étoile (*) sont obligatoires.
                </p>
              </div>

              {/* Champ 1 : Nom et Prénoms */}
              <div>
                <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5C6B5A] dark:text-slate-400" />
                  <span>Nom et Prénoms *</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={studentName}
                  className="w-full bg-[#E8DFD0]/60 dark:bg-[#111a2e]/60 text-[#2D4A3E] dark:text-white text-xs sm:text-sm rounded-xl px-3.5 py-3 border-2 border-[#D4C9B5] dark:border-slate-800 focus:outline-none cursor-not-allowed font-medium"
                />
              </div>

              {/* Champ 2 : Le numéro de contact */}
              <div>
                <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#5C6B5A] dark:text-slate-400" />
                  <span>Numéro de contact (Appel / SMS) *</span>
                </label>
                <input
                  type="tel"
                  readOnly
                  value={studentPhone}
                  className="w-full bg-[#E8DFD0]/60 dark:bg-[#111a2e]/60 text-[#2D4A3E] dark:text-white font-mono text-xs sm:text-sm rounded-xl px-3.5 py-3 border-2 border-[#D4C9B5] dark:border-slate-800 focus:outline-none cursor-not-allowed"
                />
              </div>

              {/* Champ 3 : Le numéro WhatsApp (FACULTATIF) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 flex items-center gap-1.5">
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Numéro WhatsApp</span>
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#D4C9B5]/60 dark:bg-slate-800 text-[#5C6B5A] dark:text-slate-400">
                    Facultatif
                  </span>
                </div>
                <input
                  type="tel"
                  readOnly
                  value={studentWhatsapp}
                  className="w-full bg-[#E8DFD0]/60 dark:bg-[#111a2e]/60 text-[#2D4A3E] dark:text-white font-mono text-xs sm:text-sm rounded-xl px-3.5 py-3 border-2 border-[#D4C9B5] dark:border-slate-800 focus:outline-none cursor-not-allowed"
                />
              </div>

              {/* Champ 4 : Champ où est affiché le Mo ou Go choisi */}
              <div>
                <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Espace de stockage / Capacité choisie</span>
                </label>
                <div className="w-full bg-[#E8DFD0]/60 dark:bg-[#152138] border-2 border-[#D4C9B5] dark:border-slate-800 rounded-xl px-3.5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span className="text-xs sm:text-sm font-bold text-[#2D4A3E] dark:text-white">
                      {storageDisplay}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-blue-500/15 text-blue-800 dark:text-blue-300 rounded font-extrabold">
                    {planName}
                  </span>
                </div>
              </div>

              {/* Champ 5 : Champ où est affichée la somme à payer selon la formule choisie */}
              <div>
                <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Somme à payer (selon la formule sélectionnée)</span>
                </label>
                <div className="w-full bg-[#E8DFD0]/60 dark:bg-[#152138] border-2 border-[#D4C9B5] dark:border-slate-800 rounded-xl px-3.5 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm sm:text-base font-extrabold text-emerald-800 dark:text-emerald-400">
                      {priceDisplay}
                    </span>
                    <span className="block text-[10px] text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                      Cycle : {cycleDescription}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase px-2 py-1 bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 rounded-md font-extrabold shrink-0">
                    Montant exact
                  </span>
                </div>
              </div>

              {/* Champ 6 : Importer ou mettre l'image du reçu du paiement */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 flex items-center gap-1.5">
                    <UploadCloud className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span>Image du reçu de paiement (Capture d'écran) *</span>
                  </label>
                  <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded">
                    ★ Seul champ à fournir
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
                  /* Aperçu de l'image du reçu importé */
                  <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-2xl border-2 border-emerald-600/60 dark:border-emerald-500/60 p-3 sm:p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
                        <span className="text-xs font-bold text-[#2D4A3E] dark:text-white truncate">
                          {receiptFileName}
                        </span>
                        <span className="text-[10px] font-mono text-[#5C6B5A] dark:text-slate-400 shrink-0">
                          ({receiptFileSize})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveReceipt}
                        className="p-1.5 text-red-600 hover:bg-red-500/10 rounded-lg transition cursor-pointer"
                        title="Supprimer cette image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="relative rounded-xl overflow-hidden bg-black/5 dark:bg-black/40 border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-center max-h-[220px]">
                      <img 
                        src={receiptImage} 
                        alt="Aperçu du reçu" 
                        className="max-h-[200px] w-auto max-w-full object-contain rounded-lg shadow-sm"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Reçu prêt pour validation
                      </span>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-[#2D4A3E] dark:text-white underline hover:opacity-80 cursor-pointer font-bold"
                      >
                        Changer l'image
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Zone de sélection / import du reçu */
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#2D4A3E]/30 dark:border-slate-700 hover:border-[#2D4A3E] dark:hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-all bg-[#E8DFD0]/40 dark:bg-[#111a2e]/60 hover:bg-[#E8DFD0] dark:hover:bg-[#111a2e] group"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-[#C9B896]/50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 group-hover:scale-105 transition-transform text-[#2D4A3E] dark:text-white">
                      <UploadCloud className="w-6 h-6" />
                    </div>
                    <p className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white mb-1">
                      Cliquez pour importer la capture du reçu
                    </p>
                    <p className="text-[11px] text-[#5C6B5A] dark:text-slate-400">
                      Formats supportés : JPG, PNG, WEBP (Max 20 Mo)
                    </p>
                    <span className="inline-block mt-3 px-3 py-1 bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white text-[10px] font-bold rounded-lg shadow-xs">
                      Parcourir les fichiers
                    </span>
                  </div>
                )}
              </div>

              {/* Champ 7 : Bouton pour confirmer le renouvellement */}
              <div className="pt-2">
                {isFormValid ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className={`w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold text-sm shadow-xl shadow-orange-500/25 flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] ${
                      submitting ? 'cursor-wait opacity-90' : 'cursor-pointer'
                    }`}
                  >
                    {submitting ? (
                      <>
                        <RotateCw className="w-5 h-5 animate-spin text-white" />
                        <span className="animate-pulse">Transmission de votre renouvellement en cours...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Confirmer le renouvellement de mon abonnement</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      type="button"
                      disabled
                      className="w-full py-3.5 px-6 rounded-2xl bg-[#D4C9B5]/60 dark:bg-slate-800 text-[#5C6B5A]/60 dark:text-slate-500 font-extrabold text-xs sm:text-sm border-2 border-[#D4C9B5] dark:border-slate-700 cursor-not-allowed opacity-60 flex items-center justify-center gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      <span>Confirmer (Veuillez joindre votre reçu de paiement)</span>
                    </button>
                    <p className="text-[11px] text-[#5C6B5A] dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                      <span>⚠️</span>
                      <span>Les paramètres de votre forfait sont pré-remplis. Importez votre reçu pour valider.</span>
                    </p>
                  </div>
                )}
              </div>
            </form>

            {/* ===================================================================== */}
            {/* CÔTÉ DROIT : INFORMATIONS & EXPLICATIONS "COMMENT ÇA SE PASSE"       */}
            {/* ===================================================================== */}
            <div className="space-y-6 lg:pl-6 border-t-2 lg:border-t-0 border-[#2D4A3E]/15 dark:border-slate-800 pt-6 lg:pt-0">
              
              <div className="border-b border-[#2D4A3E]/15 dark:border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-[#2D4A3E] dark:text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                  <span>Comment ça se passe ?</span>
                </h3>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400">
                  Procédure rapide de renouvellement de votre abonnement StudyCloud.
                </p>
              </div>

              {/* Étape 1 : Effectuer le paiement */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-5 rounded-2xl border-2 border-[#D4C9B5] dark:border-slate-800 space-y-3">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#2D4A3E] dark:text-white">
                  <span className="w-6 h-6 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center text-xs shrink-0">
                    1
                  </span>
                  <span>Étape 1 : Effectuez le paiement mobile</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Transférez le montant exact de <strong className="text-[#2D4A3E] dark:text-white font-mono">{priceDisplay}</strong> sur l'un de nos numéros officiels ci-dessous :
                </p>

                {/* Comptes Marchands avec boutons copier et cartes QR */}
                <div className="space-y-3 pt-1">
                  {(() => {
                    const isNetworkActive = (val: any) => val === 1 || val === '1' || val === true;

                    const networks = [
                      {
                        id: 'wave',
                        name: 'Wave',
                        badgeColor: 'bg-blue-500/20 text-blue-700 dark:text-blue-400',
                        borderAccent: 'border-l-4 border-l-blue-500',
                        enabled: isNetworkActive(companyProfile?.wave_enabled),
                        showNumber: isNetworkActive(companyProfile?.wave_show_number),
                        showImage: isNetworkActive(companyProfile?.wave_show_image),
                        number: companyProfile?.wave_number || '+225 07 00 00 00 00',
                        titulaire: companyProfile?.wave_name || 'StudyCloud CI',
                        imageUrl: companyProfile?.wave_image_url || ''
                      },
                      {
                        id: 'orange',
                        name: 'Orange',
                        badgeColor: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
                        borderAccent: 'border-l-4 border-l-orange-500',
                        enabled: isNetworkActive(companyProfile?.orange_enabled),
                        showNumber: isNetworkActive(companyProfile?.orange_show_number),
                        showImage: isNetworkActive(companyProfile?.orange_show_image),
                        number: companyProfile?.orange_number || '+225 07 00 00 00 00',
                        titulaire: companyProfile?.orange_name || "Orange Money Côte d'Ivoire",
                        imageUrl: companyProfile?.orange_image_url || ''
                      },
                      {
                        id: 'mtn',
                        name: 'MTN',
                        badgeColor: 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-400',
                        borderAccent: 'border-l-4 border-l-yellow-500',
                        enabled: isNetworkActive(companyProfile?.mtn_enabled),
                        showNumber: isNetworkActive(companyProfile?.mtn_show_number),
                        showImage: isNetworkActive(companyProfile?.mtn_show_image),
                        number: companyProfile?.mtn_number || '+225 05 00 00 00 00',
                        titulaire: companyProfile?.mtn_name || 'MTN Mobile Money CI',
                        imageUrl: companyProfile?.mtn_image_url || ''
                      },
                      {
                        id: 'moov',
                        name: 'Moov',
                        badgeColor: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400',
                        borderAccent: 'border-l-4 border-l-emerald-500',
                        enabled: isNetworkActive(companyProfile?.moov_enabled),
                        showNumber: isNetworkActive(companyProfile?.moov_show_number),
                        showImage: isNetworkActive(companyProfile?.moov_show_image),
                        number: companyProfile?.moov_number || '+225 01 00 00 00 00',
                        titulaire: companyProfile?.moov_name || "Moov Money Côte d'Ivoire",
                        imageUrl: companyProfile?.moov_image_url || ''
                      }
                    ];

                    const active = networks.filter(net => net.enabled && (net.showNumber || (net.showImage && net.imageUrl)));

                    if (active.length === 0) {
                      return (
                        <div className="p-3 text-center text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-xl border border-amber-500/20">
                          Aucun réseau de paiement mobile actif pour le moment.
                        </div>
                      );
                    }

                    return active.map(net => {
                      const isUrl = net.number.startsWith('http://') || net.number.startsWith('https://');
                      return (
                      <div 
                        key={net.id} 
                        className={`bg-[#F5F0E8] dark:bg-[#0b0f19] p-3 rounded-xl border border-[#D4C9B5] dark:border-slate-800 ${net.borderAccent} space-y-2.5 transition-all shadow-sm`}
                      >
                        {/* Numéro et Titulaire si showNumber activé */}
                        {net.showNumber && (
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${net.badgeColor} mr-2`}>
                                {net.name}
                              </span>
                              {isUrl ? (
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                  <a
                                    href={net.number}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition shadow-sm"
                                  >
                                    <span>Payer avec Wave ↗</span>
                                  </a>
                                  <span className="font-mono text-[10px] text-[#5C6B5A] dark:text-slate-400 truncate max-w-[220px]" title={net.number}>
                                    {net.number}
                                  </span>
                                </div>
                              ) : (
                                <span className="font-mono font-bold text-xs text-[#2D4A3E] dark:text-white">
                                  {net.number}
                                </span>
                              )}
                              <span className="block text-[10px] text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                                Titulaire : {net.titulaire}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleCopyNumber(net.number, net.id)}
                              className="px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                            >
                              {copiedKey === net.id ? (
                                <>
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-[11px] text-emerald-600">Copié</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span className="text-[11px]">Copier</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}

                        {/* Si le numéro est masqué mais l'image est active, afficher l'en-tête du réseau */}
                        {!net.showNumber && (
                          <div className="flex items-center justify-between">
                            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${net.badgeColor}`}>
                              {net.name}
                            </span>
                            <span className="text-[10px] text-[#5C6B5A] dark:text-slate-400 font-medium">
                              Titulaire : {net.titulaire}
                            </span>
                          </div>
                        )}

                        {/* Carte commerçant / QR Code si showImage et imageUrl */}
                        {net.showImage && net.imageUrl && (
                          <div className="pt-2 border-t border-[#D4C9B5]/60 dark:border-slate-800/80">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-bold text-[#2D4A3E] dark:text-slate-300 flex items-center gap-1">
                                <span>📱</span>
                                <span>Carte Commerçant / QR {net.name} (Scannez pour payer) :</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setZoomedPaymentImage({ url: net.imageUrl, title: `Carte Commerçant ${net.name} • ${net.titulaire}` })}
                                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                              >
                                <span>🔍 Agrandir</span>
                              </button>
                            </div>
                            <div 
                              onClick={() => setZoomedPaymentImage({ url: net.imageUrl, title: `Carte Commerçant ${net.name} • ${net.titulaire}` })}
                              className="relative group cursor-pointer bg-white dark:bg-slate-950 p-2 rounded-xl border border-[#D4C9B5] dark:border-slate-800 flex flex-col items-center justify-center overflow-hidden hover:border-blue-500/50 transition shadow-inner"
                            >
                              <img 
                                src={net.imageUrl} 
                                alt={`Carte Commerçant ${net.name}`} 
                                className="max-h-36 w-auto object-contain rounded-lg transition-transform group-hover:scale-[1.02]"
                              />
                              <span className="mt-1 text-[9px] text-[#5C6B5A] dark:text-slate-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 font-medium">
                                Cliquez pour afficher en grand et scanner
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
                </div>

                {/* Consigne de paiement */}
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-800 dark:text-emerald-300">
                  💡 <strong>Consigne :</strong> {companyProfile?.payment_instructions || "Transférez le montant exact sur l'un de nos numéros officiels ci-dessus, puis joignez la capture d'écran claire de votre reçu avec la date et le numéro de transaction."}
                </div>
              </div>

              {/* Étape 2 : Capturer la preuve */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-4 sm:p-5 rounded-2xl border-2 border-[#D4C9B5] dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#2D4A3E] dark:text-white">
                  <span className="w-6 h-6 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center text-xs shrink-0 font-mono font-bold">
                    2
                  </span>
                  <span>Étape 2 : Prenez une capture d'écran du reçu</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Une fois la transaction effectuée, réalisez une capture d'écran claire de votre reçu de transfert affichant la date, le montant et le numéro de transaction.
                </p>
              </div>

              {/* Étape 3 : Renseigner le formulaire */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-4 sm:p-5 rounded-2xl border-2 border-[#D4C9B5] dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#2D4A3E] dark:text-white">
                  <span className="w-6 h-6 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center text-xs shrink-0 font-mono font-bold">
                    3
                  </span>
                  <span>Étape 3 : Joignez votre reçu & confirmez</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Les paramètres de votre forfait sont déjà pré-remplis à gauche. Importez simplement votre capture d'écran et cliquez sur <strong>Confirmer le renouvellement</strong>.
                </p>
              </div>

              {/* Étape 4 : Prolongation immédiate de l'abonnement */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-4 sm:p-5 rounded-2xl border-2 border-emerald-600/40 dark:border-emerald-500/40 space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0 font-mono font-bold">
                    4
                  </span>
                  <span>Étape 4 : Prolongation rapide de votre abonnement</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Dès réception, l'administrateur vérifie votre reçu et approuve la demande. Votre abonnement <strong className="text-emerald-700 dark:text-emerald-400">{planName}</strong> est immédiatement prolongé pour une nouvelle période sans interruption de vos services !
                </p>
              </div>

              {/* Encadré d'assurance et de support */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs space-y-1">
                  <span className="font-extrabold text-[#2D4A3E] dark:text-emerald-300 block">
                    Paiement 100% sécurisé & Garanti
                  </span>
                  <p className="text-[#5C6B5A] dark:text-slate-400">
                    En cas de question ou de besoin d'assistance, notre équipe est disponible 7j/7 pour vous assister directement.
                  </p>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Modale de zoom plein écran de la carte commerçant / QR */}
        {zoomedPaymentImage && (
          <div 
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
            onClick={() => setZoomedPaymentImage(null)}
          >
            <div 
              className="relative max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-2xl overflow-hidden shadow-2xl p-4 flex flex-col items-center gap-3"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-full flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5 truncate">
                  <span>💳</span>
                  <span className="truncate">{zoomedPaymentImage.title}</span>
                </span>
                <button 
                  type="button" 
                  onClick={() => setZoomedPaymentImage(null)}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-bold flex items-center justify-center text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-2 rounded-xl">
                <img 
                  src={zoomedPaymentImage.url} 
                  alt="Carte QR agrandie" 
                  className="max-h-[65vh] max-w-full object-contain rounded-lg shadow-md"
                />
              </div>
              <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                Scannez directement avec votre application mobile de paiement pour renouveler instantanément.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
