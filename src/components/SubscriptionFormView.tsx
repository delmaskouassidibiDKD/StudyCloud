import React, { useState, useRef } from 'react';
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
  Image as ImageIcon, 
  Sparkles, 
  HelpCircle, 
  ShieldCheck
} from 'lucide-react';
import { requestStorageUpgrade } from '../services/api';

export interface SelectedPlan {
  name: string;
  type: 'storage' | 'ai';
  storageDisplay: string; // ex: "50 Go supplémentaires (+ 51 200 Mo)"
  priceDisplay: string;   // ex: "29 $ / an (≈ 18 000 FCFA)"
  price: number;
  priceFcfa: number;
  currency: string;
  billingCycle: 'annual' | 'monthly';
  mb?: number;
  words?: number;
}

interface SubscriptionFormViewProps {
  plan: SelectedPlan;
  onBack: () => void;
  onSuccess?: () => void;
}

export const SubscriptionFormView: React.FC<SubscriptionFormViewProps> = ({ 
  plan, 
  onBack, 
  onSuccess 
}) => {
  // Pré-remplissage avec les informations locales si existantes
  const initialName = localStorage.getItem('unifolder_user_name') || '';
  const initialPhone = localStorage.getItem('unifolder_user_phone') || '';

  const [fullName, setFullName] = useState(initialName);
  const [contactPhone, setContactPhone] = useState(initialPhone);
  const [whatsappNumber, setWhatsappNumber] = useState('');
  
  // Reçu de paiement (Fichier Image en Base64)
  const [receiptImage, setReceiptImage] = useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = useState<string>('');
  const [receiptFileSize, setReceiptFileSize] = useState<string>('');
  
  // État de soumission et succès
  const [submitting, setSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [submittedRequestId, setSubmittedRequestId] = useState<string>('');
  
  // Outil de copie des numéros de paiement
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Validation : Nom, Contact et Reçu sont obligatoires. WhatsApp est facultatif.
  const isFormValid = 
    fullName.trim().length >= 2 && 
    contactPhone.trim().length >= 6 && 
    receiptImage !== null;

  // Gestion de l'import de l'image du reçu
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide (JPG, PNG, WEBP).');
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("L'image est trop volumineuse. Veuillez choisir une image de moins de 8 Mo.");
      return;
    }

    const sizeFormatted = file.size > 1024 * 1024 
      ? (file.size / (1024 * 1024)).toFixed(1) + ' Mo' 
      : Math.round(file.size / 1024) + ' Ko';

    const reader = new FileReader();
    reader.onload = (event) => {
      setReceiptImage(event.target?.result as string);
      setReceiptFileName(file.name);
      setReceiptFileSize(sizeFormatted);
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

  // Soumission de la demande à l'API / Cloudflare D1
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || submitting) return;
    setSubmitting(true);

    try {
      const res = await requestStorageUpgrade({
        packId: plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
        packName: plan.name,
        additionalMb: plan.mb || 51200,
        additionalWords: plan.words || 0,
        userName: fullName.trim(),
        contactPhone: contactPhone.trim(),
        whatsappNumber: whatsappNumber.trim(),
        pricePaid: plan.priceFcfa || plan.price,
        currency: 'FCFA',
        paymentMethod: 'Mobile Money (Wave / Orange / MTN / Moov)',
        receiptImageUrl: receiptImage || '',
        notes: `Demande de souscription à ${plan.name} (${plan.storageDisplay}). Contact: ${contactPhone.trim()}${whatsappNumber.trim() ? ` | WhatsApp: ${whatsappNumber.trim()}` : ''}`
      });

      if (res.success) {
        setSubmittedRequestId(res.requestId || 'REQ-' + Math.floor(100000 + Math.random() * 900000));
        setIsSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        alert(res.message || "Une erreur est survenue lors de l'enregistrement de votre demande.");
      }
    } catch (err: any) {
      alert(err?.message || "Erreur réseau lors de la validation de la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full min-h-full">
      {/* ========================================================================= */}
      {/* BARRE SUPÉRIEURE FIXE COLLÉE EN HAUT                                     */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-[#F5F0E8]/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-3 border-b-2 border-[#2D4A3E]/15 dark:border-[#1e293b] shadow-xs">
        {/* Bouton Retour aux formules */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span>Retour aux formules</span>
        </button>

        {/* Titre central */}
        <div className="flex items-center gap-2 overflow-hidden text-center">
          <span className="hidden sm:inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <h2 className="text-xs sm:text-sm font-extrabold text-[#2D4A3E] dark:text-white truncate">
            Souscription : <span className="text-emerald-700 dark:text-emerald-400">{plan.name}</span>
          </h2>
        </div>

        {/* Badge récapitulatif */}
        <div className="shrink-0 bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg">
          {plan.billingCycle === 'annual' ? 'Annuel' : 'Mensuel'}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CONTENU PRINCIPAL                                                        */}
      {/* ========================================================================= */}
      <div className="w-full max-w-[1250px] mx-auto px-4 py-6 sm:py-8">
        
        {/* En-tête de page */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Étape finale de souscription</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-2">
            Finalisez votre abonnement
          </h1>
          <p className="text-xs sm:text-sm text-[#5C6B5A] dark:text-slate-400 max-w-2xl leading-relaxed">
            Remplissez le formulaire de confirmation et joignez votre capture de paiement. Dès validation par l'administration, votre espace sera immédiatement crédité.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* ÉCRAN DE SUCCÈS APRÈS CONFIRMATION                                        */}
        {/* ========================================================================= */}
        {isSuccess ? (
          <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl p-6 sm:p-10 border-2 border-[#2D4A3E] dark:border-emerald-500 shadow-xl max-w-2xl mx-auto text-center space-y-6 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-12 h-12" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase">
                Demande envoyée avec succès
              </span>
              <h2 className="text-2xl sm:text-3xl font-serif text-[#2D4A3E] dark:text-white pt-2">
                Merci, {fullName} !
              </h2>
              <p className="text-xs sm:text-sm text-[#5C6B5A] dark:text-slate-300 max-w-md mx-auto">
                Votre demande d'abonnement a été transmise au tableau de bord administrateur avec votre preuve de paiement.
              </p>
            </div>

            {/* Récapitulatif de la commande */}
            <div className="bg-[#F5F0E8] dark:bg-[#0b0f19] p-4 sm:p-5 rounded-2xl border border-[#D4C9B5] dark:border-slate-800 text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Référence demande :</span>
                <span className="font-mono font-bold text-[#2D4A3E] dark:text-white">#{submittedRequestId}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Formule souscrite :</span>
                <span className="font-bold text-[#2D4A3E] dark:text-white">{plan.name}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Stockage / Capacité :</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400">{plan.storageDisplay}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Montant transmis :</span>
                <span className="font-bold text-[#2D4A3E] dark:text-white">{plan.priceDisplay}</span>
              </div>
              <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                <span className="text-[#5C6B5A] dark:text-slate-400">Numéro de contact :</span>
                <span className="font-mono text-[#2D4A3E] dark:text-white">{contactPhone}</span>
              </div>
              {whatsappNumber && (
                <div className="flex justify-between border-b border-[#D4C9B5]/60 dark:border-slate-800 pb-2">
                  <span className="text-[#5C6B5A] dark:text-slate-400">WhatsApp :</span>
                  <span className="font-mono text-[#2D4A3E] dark:text-white">{whatsappNumber}</span>
                </div>
              )}
              <div className="flex justify-between pt-1">
                <span className="text-[#5C6B5A] dark:text-slate-400">Statut actuel :</span>
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold text-[11px]">
                  ⏳ En attente de validation (15-30 min)
                </span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onBack}
                className="w-full sm:w-auto px-8 py-3 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20362d] dark:hover:bg-emerald-700 text-[#F5F0E8] dark:text-white font-extrabold text-sm rounded-xl shadow-md cursor-pointer transition active:scale-95"
              >
                Retourner aux formules d'abonnement
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
            {/* CÔTÉ GAUCHE : FORMULAIRE À REMPLIR                                    */}
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

              {/* Champ 1 : Le nom */}
              <div>
                <label className="text-xs font-extrabold text-[#2D4A3E] dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#5C6B5A] dark:text-slate-400" />
                  <span>Nom et Prénoms *</span>
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ex: Kouassi Jean-Marc"
                  className="w-full bg-[#E8DFD0] dark:bg-[#111a2e] text-[#2D4A3E] dark:text-white text-xs sm:text-sm rounded-xl px-3.5 py-3 border-2 border-[#D4C9B5] dark:border-slate-800 focus:border-[#2D4A3E] dark:focus:border-emerald-500 focus:outline-none transition-all placeholder:text-[#5C6B5A]/60"
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
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="Ex: 07 01 02 03 04 ou +225 07 01 02 03 04"
                  className="w-full bg-[#E8DFD0] dark:bg-[#111a2e] text-[#2D4A3E] dark:text-white font-mono text-xs sm:text-sm rounded-xl px-3.5 py-3 border-2 border-[#D4C9B5] dark:border-slate-800 focus:border-[#2D4A3E] dark:focus:border-emerald-500 focus:outline-none transition-all placeholder:text-[#5C6B5A]/60"
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
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="Ex: +225 05 00 00 00 00 (optionnel)"
                  className="w-full bg-[#E8DFD0] dark:bg-[#111a2e] text-[#2D4A3E] dark:text-white font-mono text-xs sm:text-sm rounded-xl px-3.5 py-3 border-2 border-[#D4C9B5] dark:border-slate-800 focus:border-[#2D4A3E] dark:focus:border-emerald-500 focus:outline-none transition-all placeholder:text-[#5C6B5A]/60"
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
                      {plan.storageDisplay}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 bg-blue-500/15 text-blue-800 dark:text-blue-300 rounded font-extrabold">
                    {plan.name}
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
                      {plan.priceDisplay}
                    </span>
                    <span className="block text-[10px] text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                      Cycle : {plan.billingCycle === 'annual' ? 'Facturation annuelle (-10%)' : 'Facturation mensuelle'}
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
                    <ImageIcon className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                    <span>Image du reçu de paiement (Capture d'écran) *</span>
                  </label>
                  <span className="text-[10px] font-bold text-red-600 dark:text-red-400">
                    Obligatoire
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
                      Formats supportés : JPG, PNG, WEBP (Max 8 Mo)
                    </p>
                    <span className="inline-block mt-3 px-3 py-1 bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white text-[10px] font-bold rounded-lg shadow-xs">
                      Parcourir les fichiers
                    </span>
                  </div>
                )}
              </div>

              {/* Champ 7 : Bouton pour confirmer qui devient cliquable si tout est rempli */}
              <div className="pt-2">
                {isFormValid ? (
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 px-6 rounded-2xl bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#20362d] dark:hover:bg-emerald-700 text-[#F5F0E8] dark:text-white font-extrabold text-sm shadow-xl shadow-[#2D4A3E]/20 dark:shadow-emerald-900/30 cursor-pointer flex items-center justify-center gap-2.5 transition-all transform hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Transmission de votre demande en cours...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        <span>Confirmer ma demande d'abonnement</span>
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
                      <span>Confirmer (Veuillez compléter le formulaire)</span>
                    </button>
                    <p className="text-[11px] text-[#5C6B5A] dark:text-slate-400 text-center flex items-center justify-center gap-1.5">
                      <span>⚠️</span>
                      <span>Renseignez votre nom, votre numéro de contact et importez le reçu pour valider.</span>
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
                  Procédure rapide d'activation de votre abonnement StudyCloud.
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
                  Transférez le montant exact de <strong className="text-[#2D4A3E] dark:text-white font-mono">{plan.priceDisplay}</strong> sur l'un de nos numéros officiels ci-dessous :
                </p>

                {/* Comptes Marchands avec boutons copier */}
                <div className="space-y-2 pt-1">
                  {/* WAVE */}
                  <div className="bg-[#F5F0E8] dark:bg-[#0b0f19] p-2.5 rounded-xl border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-400 mr-2">
                        Wave
                      </span>
                      <span className="font-mono font-bold text-xs text-[#2D4A3E] dark:text-white">
                        +225 07 00 00 00 00
                      </span>
                      <span className="block text-[10px] text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                        Titulaire : StudyCloud CI
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber('+2250700000000', 'wave')}
                      className="px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey === 'wave' ? (
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

                  {/* ORANGE MONEY */}
                  <div className="bg-[#F5F0E8] dark:bg-[#0b0f19] p-2.5 rounded-xl border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-700 dark:text-orange-400 mr-2">
                        Orange
                      </span>
                      <span className="font-mono font-bold text-xs text-[#2D4A3E] dark:text-white">
                        +225 07 00 00 00 00
                      </span>
                      <span className="block text-[10px] text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                        Orange Money Côte d'Ivoire
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber('+2250700000000', 'orange')}
                      className="px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey === 'orange' ? (
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

                  {/* MTN / MOOV */}
                  <div className="bg-[#F5F0E8] dark:bg-[#0b0f19] p-2.5 rounded-xl border border-[#D4C9B5] dark:border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 mr-2">
                        MTN / Moov
                      </span>
                      <span className="font-mono font-bold text-xs text-[#2D4A3E] dark:text-white">
                        +225 05 00 00 00 00
                      </span>
                      <span className="block text-[10px] text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                        Paiement Mobile National
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopyNumber('+2250500000000', 'mtn')}
                      className="px-2.5 py-1 bg-[#E8DFD0] hover:bg-[#D4C9B5] dark:bg-slate-800 text-xs font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {copiedKey === 'mtn' ? (
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
                </div>
              </div>

              {/* Étape 2 : Capturer la preuve */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-5 rounded-2xl border-2 border-[#D4C9B5] dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#2D4A3E] dark:text-white">
                  <span className="w-6 h-6 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center text-xs shrink-0">
                    2
                  </span>
                  <span>Étape 2 : Prenez une capture d'écran du reçu</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Une fois la transaction effectuée, réalisez une capture d'écran claire de votre reçu de transfert affichant la date, le montant et le numéro de transaction.
                </p>
              </div>

              {/* Étape 3 : Remplir et valider */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-5 rounded-2xl border-2 border-[#D4C9B5] dark:border-slate-800 space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-[#2D4A3E] dark:text-white">
                  <span className="w-6 h-6 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center text-xs shrink-0">
                    3
                  </span>
                  <span>Étape 3 : Renseignez le formulaire & confirmez</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Indiquez votre nom, votre numéro de téléphone (le numéro WhatsApp est facultatif) et importez votre reçu. Cliquez ensuite sur <strong>Confirmer ma demande</strong>.
                </p>
              </div>

              {/* Étape 4 : Activation par l'administration */}
              <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-5 rounded-2xl border-2 border-emerald-600/40 dark:border-emerald-500/40 space-y-2">
                <div className="flex items-center gap-2.5 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs shrink-0">
                    4
                  </span>
                  <span>Étape 4 : Activation rapide en 15 à 30 minutes</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-300 leading-relaxed">
                  Dès réception, l'administrateur vérifie votre reçu et approuve votre demande. Votre quota supplémentaire de <strong className="text-emerald-700 dark:text-emerald-400">{plan.storageDisplay}</strong> s'activera immédiatement sur votre compte !
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
                    En cas de question ou de délai inhabituel, notre service client est disponible 7j/7 pour vous assister directement.
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
