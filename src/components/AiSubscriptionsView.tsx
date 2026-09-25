import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Bot, Zap, CheckCircle2, AlertCircle, Clock, ShieldCheck, 
  ArrowRight, ThumbsUp, ThumbsDown, CreditCard, RefreshCw, Upload, Eye, Check, X, Search, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { StudyCloudAPI, getWorkerApiUrl } from '../services/api';

export interface AiCreditPack {
  id: string;
  name: string;
  credits: number;
  tokensEstimate: string;
  priceFcfa: number;
  badge?: string;
  highlight?: boolean;
  features: string[];
}

export const AI_CREDIT_PACKS: AiCreditPack[] = [
  {
    id: 'pack_decouverte_100',
    name: 'Pack Découverte',
    credits: 100,
    tokensEstimate: '~100 000 mots IA',
    priceFcfa: 1000,
    badge: 'DÉMARRAGE',
    features: [
      '100 Crédits de création IA',
      'Résumés, Quiz & Fiches mémoires',
      'Analyse de vos documents PDF joints',
      'Accès modèle Llama 3.3 70B Rapide',
      'Crédits valables sans limite de temps'
    ]
  },
  {
    id: 'pack_revision_300',
    name: 'Pack Révision & Devoirs',
    credits: 300,
    tokensEstimate: '~350 000 mots IA',
    priceFcfa: 2500,
    badge: 'POPULAIRE',
    highlight: true,
    features: [
      '300 Crédits de création IA',
      'Créations illimitées de questionnaires',
      'Cartes mentales & devoirs complets',
      'Traitement prioritaire de gros documents',
      'Support pédagogique complet 7j/7'
    ]
  },
  {
    id: 'pack_examen_750',
    name: 'Pack Réussite Examen',
    credits: 750,
    tokensEstimate: '~1 000 000 mots IA',
    priceFcfa: 5000,
    badge: 'MEILLEUR RAPPORT',
    features: [
      '750 Crédits de création IA intensive',
      'Idéal pour tout un semestre universitaire',
      'Analyse de livres et fascicules complets',
      'Explications pas à pas & formules LaTeX',
      'Assistance prioritaire DKD Technologies'
    ]
  }
];

export const AiSubscriptionsView: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.email?.toLowerCase().includes('delmaskouassidibi') || 
                  user?.email?.toLowerCase().includes('dkd-technologies') ||
                  (user as any)?.role === 'admin';

  const [activeTab, setActiveTab] = useState<'packs' | 'my-usage' | 'admin-requests'>('packs');
  const [selectedPack, setSelectedPack] = useState<AiCreditPack | null>(null);
  
  // États de demande manuelle d'achat (Wave / Orange Money)
  const [studentPhone, setStudentPhone] = useState(user?.phone || '');
  const [studentWhatsapp, setStudentWhatsapp] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [paymentRef, setPaymentRef] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Solde et statistiques de l'utilisateur
  const [userCredits, setUserCredits] = useState<{
    balance: number;
    tokensUsed: number;
    totalPurchased: number;
    plan: string;
  }>(() => {
    try {
      const saved = localStorage.getItem(`studycloud_user_credits_${user?.id}`);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { balance: 50, tokensUsed: 1250, totalPurchased: 0, plan: 'gratuit' };
  });

  // Liste des demandes d'achat (synchronisée en local / API)
  const [requestsList, setRequestsList] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('studycloud_ai_credit_requests');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [];
  });

  // Sauvegarder les demandes
  const saveRequests = (newList: any[]) => {
    setRequestsList(newList);
    localStorage.setItem('studycloud_ai_credit_requests', JSON.stringify(newList));
  };

  // Traitement d'une demande par l'admin
  const handleApproveRequest = (reqId: string) => {
    const req = requestsList.find(r => r.id === reqId);
    if (!req) return;

    const updated = requestsList.map(r => 
      r.id === reqId 
        ? { ...r, status: 'completed', approved_at: new Date().toISOString() } 
        : r
    );
    saveRequests(updated);

    // Mettre à jour les crédits du compte cible
    if (req.user_id === user?.id) {
      setUserCredits(prev => {
        const next = {
          ...prev,
          balance: prev.balance + (req.credits_amount || 0),
          totalPurchased: prev.totalPurchased + (req.credits_amount || 0),
          plan: 'étudiant'
        };
        localStorage.setItem(`studycloud_user_credits_${user?.id}`, JSON.stringify(next));
        return next;
      });
    }
  };

  const handleRejectRequest = (reqId: string) => {
    const updated = requestsList.map(r => 
      r.id === reqId 
        ? { ...r, status: 'rejected', updated_at: new Date().toISOString() } 
        : r
    );
    saveRequests(updated);
  };

  // Envoi de la demande d'achat avec preuve
  const handleSubmitPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPack) return;

    setIsSubmitting(true);
    setTimeout(() => {
      const newReq = {
        id: `aicp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: user?.id || 'anonymous',
        user_name: user?.name || 'Étudiant StudyCloud',
        user_email: user?.email || '',
        user_phone: studentPhone.trim(),
        user_whatsapp: studentWhatsapp.trim(),
        pack_id: selectedPack.id,
        pack_name: selectedPack.name,
        credits_amount: selectedPack.credits,
        price_paid: selectedPack.priceFcfa,
        currency: 'FCFA',
        payment_method: 'Mobile Money (Wave / Orange Money / MTN)',
        payment_reference: paymentRef.trim(),
        receipt_image_url: receiptImage,
        status: 'pending',
        created_at: new Date().toISOString()
      };

      saveRequests([newReq, ...requestsList]);
      setIsSubmitting(false);
      setSubmitSuccess(true);
    }, 600);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 animate-fadeIn">
      {/* En-tête principal */}
      <div className="bg-white dark:bg-[#111827] border-2 border-stone-800 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-[4px_4px_0px_0px_#1c1917] dark:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-100 dark:bg-orange-950/60 border border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-orange-600" />
              <span>Cerveau Pédagogique DKD & Monétisation IA</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-stone-900 dark:text-white tracking-tight">
              Abonnements & Crédits IA StudyCloud
            </h1>
            <p className="text-sm text-stone-600 dark:text-slate-300 max-w-2xl">
              Chaque utilisateur dispose de son propre portefeuille de crédits étanche. Recharger des crédits permet de débloquer la génération illimitée de modules pédagogiques et la discussion avec Delmas IA.
            </p>
          </div>

          {/* Badge Solde Actuel */}
          <div className="bg-gradient-to-br from-orange-50 to-amber-100 dark:from-[#1e293b] dark:to-[#0f172a] border-2 border-stone-800 dark:border-orange-500/40 rounded-2xl p-4 sm:p-5 shadow-[3px_3px_0px_0px_#1c1917] shrink-0 text-center min-w-[200px]">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-600 dark:text-slate-400">
              Votre Solde Actuel
            </div>
            <div className="text-3xl sm:text-4xl font-black text-orange-600 dark:text-orange-400 mt-1">
              {userCredits.balance} <span className="text-sm font-bold text-stone-700 dark:text-slate-300">Crédits</span>
            </div>
            <div className="text-[11px] text-stone-500 dark:text-slate-400 mt-1 font-medium">
              ~{userCredits.tokensUsed.toLocaleString()} tokens Llama consommés
            </div>
          </div>
        </div>

        {/* Onglets de navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-6 pt-6 border-t border-stone-200 dark:border-slate-800">
          <button
            onClick={() => { setActiveTab('packs'); setSelectedPack(null); setSubmitSuccess(false); }}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border-2 ${
              activeTab === 'packs'
                ? 'bg-orange-500 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-transparent hover:bg-stone-200'
            }`}
          >
            Formules & Packs de Crédits
          </button>
          <button
            onClick={() => setActiveTab('my-usage')}
            className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border-2 ${
              activeTab === 'my-usage'
                ? 'bg-orange-500 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                : 'bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-transparent hover:bg-stone-200'
            }`}
          >
            Historique & Mes Demandes
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin-requests')}
              className={`px-4 py-2 rounded-xl font-bold text-xs transition-all border-2 flex items-center gap-1.5 ${
                activeTab === 'admin-requests'
                  ? 'bg-emerald-600 text-white border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 hover:bg-emerald-100'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Gestion Admin ({requestsList.filter(r => r.status === 'pending').length} en attente)</span>
            </button>
          )}
        </div>
      </div>

      {/* VUE 1 : GRILLE DES PACKS DE CRÉDITS */}
      {activeTab === 'packs' && !selectedPack && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {AI_CREDIT_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative bg-white dark:bg-[#111827] border-3 border-stone-800 dark:border-slate-700 rounded-3xl p-6 flex flex-col justify-between transition-all hover:scale-[1.02] shadow-[5px_5px_0px_0px_#1c1917] ${
                pack.highlight ? 'ring-3 ring-orange-500 ring-offset-2' : ''
              }`}
            >
              {pack.badge && (
                <div className="absolute -top-3.5 right-6 px-3 py-1 bg-orange-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917]">
                  {pack.badge}
                </div>
              )}

              <div className="space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-orange-100 dark:bg-orange-950/80 border-2 border-stone-800 flex items-center justify-center text-orange-600 shadow-[2px_2px_0px_0px_#1c1917]">
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-stone-900 dark:text-white">
                    {pack.name}
                  </h3>
                  <div className="text-xs text-orange-600 dark:text-orange-400 font-bold mt-0.5">
                    {pack.tokensEstimate}
                  </div>
                </div>

                <div className="flex items-baseline gap-1 py-2 border-y border-stone-100 dark:border-slate-800">
                  <span className="text-3xl font-black text-stone-900 dark:text-white">
                    {pack.priceFcfa.toLocaleString()}
                  </span>
                  <span className="text-sm font-bold text-stone-500">FCFA</span>
                  <span className="text-xs text-stone-400 ml-auto">/ {pack.credits} crédits</span>
                </div>

                <ul className="space-y-2.5 pt-2">
                  {pack.features.map((feat, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-stone-700 dark:text-slate-300 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-4">
                <button
                  onClick={() => setSelectedPack(pack)}
                  className={`w-full py-3 px-4 rounded-xl border-2 border-stone-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[3px_3px_0px_0px_#1c1917] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer ${
                    pack.highlight
                      ? 'bg-orange-500 hover:bg-orange-600 text-white'
                      : 'bg-[#F5F1E9] dark:bg-slate-800 hover:bg-stone-200 text-stone-900 dark:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Acheter ce pack</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FORMULAIRE DE PAIEMENT SUR DEMANDE (WAVE / ORANGE MONEY) */}
      {activeTab === 'packs' && selectedPack && (
        <div className="bg-white dark:bg-[#111827] border-3 border-stone-800 dark:border-slate-700 rounded-3xl p-6 sm:p-8 shadow-[6px_6px_0px_0px_#1c1917] max-w-2xl mx-auto space-y-6">
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-slate-800 pb-4">
            <div>
              <div className="text-xs uppercase font-bold text-orange-600 tracking-wider">Souscription par Mobile Money</div>
              <h2 className="text-xl font-black text-stone-900 dark:text-white mt-0.5">
                Commander le {selectedPack.name} ({selectedPack.priceFcfa.toLocaleString()} FCFA)
              </h2>
            </div>
            <button
              onClick={() => setSelectedPack(null)}
              className="p-2 hover:bg-stone-100 dark:hover:bg-slate-800 rounded-xl text-stone-600 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {submitSuccess ? (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 border-2 border-stone-800 flex items-center justify-center mx-auto shadow-[3px_3px_0px_0px_#1c1917]">
                <Check className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-stone-900 dark:text-white">Demande envoyée avec succès !</h3>
              <p className="text-xs text-stone-600 dark:text-slate-300 max-w-md mx-auto">
                Votre reçu a été transmis à l'équipe DKD Technologies. Dès validation par l'administration, vos <strong>{selectedPack.credits} crédits</strong> seront immédiatement ajoutés à votre compte.
              </p>
              <button
                onClick={() => { setSelectedPack(null); setActiveTab('my-usage'); }}
                className="px-6 py-2.5 bg-orange-500 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer"
              >
                Voir mes demandes
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmitPurchase} className="space-y-5">
              {/* Instructions de paiement */}
              <div className="bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800 rounded-2xl p-4 text-xs space-y-2 text-stone-800 dark:text-slate-200">
                <div className="font-black flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4" />
                  <span>Instructions pour le paiement manuel (Wave / Orange Money) :</span>
                </div>
                <p>1. Effectuez le transfert de <strong>{selectedPack.priceFcfa.toLocaleString()} FCFA</strong> vers l'un des numéros officiels :</p>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-stone-300 dark:border-slate-700 space-y-1 font-mono text-[11px]">
                  <div>🔵 <strong>Wave :</strong> +225 07 00 00 00 00 (StudyCloud / DKD)</div>
                  <div>🟠 <strong>Orange Money :</strong> +225 07 00 00 00 00</div>
                  <div>🟡 <strong>MTN / Moov :</strong> +225 05 00 00 00 00</div>
                </div>
                <p>2. Prenez une capture d'écran du reçu avec la date et le numéro de transaction et joignez-la ci-dessous.</p>
              </div>

              {/* Téléphone & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                    Numéro de téléphone émetteur *
                  </label>
                  <input
                    type="text"
                    required
                    value={studentPhone}
                    onChange={(e) => setStudentPhone(e.target.value)}
                    placeholder="Ex: 0701020304"
                    className="w-full bg-[#F5F1E9] dark:bg-slate-800 border-2 border-stone-800 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                    WhatsApp pour confirmation (optionnel)
                  </label>
                  <input
                    type="text"
                    value={studentWhatsapp}
                    onChange={(e) => setStudentWhatsapp(e.target.value)}
                    placeholder="Ex: +225 0701020304"
                    className="w-full bg-[#F5F1E9] dark:bg-slate-800 border-2 border-stone-800 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white outline-none font-medium"
                  />
                </div>
              </div>

              {/* Référence ou ID de transaction */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                  ID de Transaction ou Référence Wave / Orange (optionnel)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="Ex: TX-98471203"
                  className="w-full bg-[#F5F1E9] dark:bg-slate-800 border-2 border-stone-800 dark:border-slate-700 rounded-xl px-3 py-2 text-xs text-stone-900 dark:text-white outline-none font-mono"
                />
              </div>

              {/* Capture du Reçu */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">
                  Capture d'écran du reçu de paiement *
                </label>
                <div className="border-2 border-dashed border-stone-800 dark:border-slate-700 rounded-2xl p-4 text-center bg-stone-50 dark:bg-slate-900">
                  {receiptImage ? (
                    <div className="space-y-2">
                      <img src={receiptImage} alt="Reçu" className="max-h-40 mx-auto rounded-xl border border-stone-300" />
                      <button
                        type="button"
                        onClick={() => setReceiptImage('')}
                        className="text-xs text-red-500 font-bold hover:underline"
                      >
                        Changer de reçu
                      </button>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center gap-2 py-4">
                      <Upload className="w-8 h-8 text-orange-500" />
                      <span className="text-xs font-bold text-stone-700 dark:text-slate-300">
                        Cliquez pour joindre la capture du reçu Mobile Money
                      </span>
                      <span className="text-[10px] text-stone-400">PNG, JPG, JPEG</span>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = () => setReceiptImage(reader.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Bouton d'envoi */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedPack(null)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 dark:text-slate-300 hover:bg-stone-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1c1917] cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Transmission en cours...' : 'Envoyer ma demande pour validation'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* VUE 2 : HISTORIQUE DE L'UTILISATEUR */}
      {activeTab === 'my-usage' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111827] border-2 border-stone-800 dark:border-slate-700 rounded-3xl p-6 shadow-[4px_4px_0px_0px_#1c1917]">
            <h3 className="text-lg font-black text-stone-900 dark:text-white mb-4">Mes Demandes de Crédits</h3>
            {requestsList.filter(r => r.user_id === user?.id).length === 0 ? (
              <p className="text-xs text-stone-500 italic py-6 text-center">
                Vous n'avez aucune demande d'achat en cours. Choisissez un pack pour recharger vos crédits.
              </p>
            ) : (
              <div className="space-y-3">
                {requestsList.filter(r => r.user_id === user?.id).map((req) => (
                  <div key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-stone-50 dark:bg-slate-800 rounded-2xl border border-stone-200 dark:border-slate-700 gap-3">
                    <div>
                      <div className="font-bold text-sm text-stone-900 dark:text-white">{req.pack_name} ({req.credits_amount} crédits)</div>
                      <div className="text-xs text-stone-500 mt-0.5">
                        {req.price_paid} {req.currency} via {req.payment_method} • {new Date(req.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider self-start sm:self-auto ${
                      req.status === 'completed'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                        : req.status === 'rejected'
                        ? 'bg-red-100 text-red-700 border border-red-300'
                        : 'bg-amber-100 text-amber-700 border border-amber-300'
                    }`}>
                      {req.status === 'completed' ? 'Validé & Crédité' : req.status === 'rejected' ? 'Rejeté' : 'En attente de vérification'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VUE 3 : PANNEAU ADMINISTRATEUR (DELMAS) */}
      {activeTab === 'admin-requests' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#111827] border-2 border-stone-800 dark:border-slate-700 rounded-3xl p-6 shadow-[4px_4px_0px_0px_#1c1917]">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-xl font-black text-stone-900 dark:text-white">Panneau Administrateur : Validation des Paiements</h3>
                <p className="text-xs text-stone-500">Vérifiez les reçus Mobile Money envoyés par les étudiants et créditez leurs comptes en 1 clic.</p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 text-emerald-800 font-bold text-xs rounded-xl border border-emerald-300">
                Mode Gérant DKD Actif
              </span>
            </div>

            {requestsList.length === 0 ? (
              <p className="text-xs text-stone-500 italic py-8 text-center">Aucune demande reçue pour le moment.</p>
            ) : (
              <div className="space-y-4">
                {requestsList.map((req) => (
                  <div key={req.id} className="p-5 bg-stone-50 dark:bg-slate-800 rounded-2xl border-2 border-stone-200 dark:border-slate-700 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200 dark:border-slate-700 pb-3">
                      <div>
                        <span className="text-xs font-mono font-bold text-orange-600">{req.id}</span>
                        <h4 className="text-base font-black text-stone-900 dark:text-white">{req.user_name} ({req.user_email || 'Sans email'})</h4>
                        <div className="text-xs text-stone-500">
                          Tél : <strong>{req.user_phone}</strong> {req.user_whatsapp ? `• WhatsApp : ${req.user_whatsapp}` : ''}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-base font-black text-emerald-600">{req.price_paid} {req.currency}</div>
                        <div className="text-xs font-bold text-stone-600 dark:text-slate-300">{req.pack_name} (+{req.credits_amount} crédits)</div>
                      </div>
                    </div>

                    {/* Reçu et informations */}
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      {req.receipt_image_url && (
                        <div className="w-full md:w-48 shrink-0">
                          <div className="text-[10px] font-bold uppercase text-stone-500 mb-1">Preuve de paiement :</div>
                          <img
                            src={req.receipt_image_url}
                            alt="Preuve"
                            className="w-full max-h-48 object-cover rounded-xl border-2 border-stone-300 dark:border-slate-600 cursor-pointer"
                            onClick={() => window.open(req.receipt_image_url, '_blank')}
                          />
                        </div>
                      )}

                      <div className="flex-1 space-y-2 text-xs text-stone-700 dark:text-slate-300">
                        <div><strong>Méthode déclarée :</strong> {req.payment_method}</div>
                        <div><strong>Réf de transaction :</strong> {req.payment_reference || 'Non renseignée'}</div>
                        <div><strong>Date de réception :</strong> {new Date(req.created_at).toLocaleString()}</div>
                        <div><strong>Statut actuel :</strong> <span className="font-bold uppercase">{req.status}</span></div>
                      </div>

                      {/* Boutons d'action pour l'admin */}
                      {req.status === 'pending' && (
                        <div className="flex sm:flex-col gap-2 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => handleApproveRequest(req.id)}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl border border-emerald-800 shadow-[2px_2px_0px_0px_#1c1917] flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>Valider & Créditer</span>
                          </button>
                          <button
                            onClick={() => handleRejectRequest(req.id)}
                            className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs rounded-xl border border-red-300 flex items-center gap-1.5 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                            <span>Rejeter</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
