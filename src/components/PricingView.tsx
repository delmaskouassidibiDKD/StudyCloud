import React, { useState } from 'react';
import { ArrowLeft, Check, HardDrive, Bot, RotateCw, Zap, X, CheckCircle2, Phone, Sparkles } from 'lucide-react';
import { requestStorageUpgrade } from '../services/api';

interface PricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
  initialTab?: 'storage' | 'ai' | 'renewal';
}

export const PricingView: React.FC<PricingViewProps> = ({ onBack, onSelectPlan, initialTab = 'storage' }) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'ai' | 'renewal'>(initialTab);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  // État de souscription / confirmation pour l'étudiant
  const [selectedPlanForModal, setSelectedPlanForModal] = useState<{
    name: string;
    type: 'storage' | 'ai';
    price: number;
    currency: string;
    mb?: number;
    words?: number;
  } | null>(null);
  const [contactPhone, setContactPhone] = useState('');
  const [upgradeNotes, setUpgradeNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Soumission de la demande vers Cloudflare D1 via l'API
  const handleConfirmSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanForModal) return;
    setSubmitting(true);

    try {
      const res = await requestStorageUpgrade({
        packId: selectedPlanForModal.name.toLowerCase().replace(/\s+/g, '_'),
        packName: selectedPlanForModal.name,
        additionalMb: selectedPlanForModal.mb || (selectedPlanForModal.type === 'storage' ? 51200 : 1024),
        additionalWords: selectedPlanForModal.words || (selectedPlanForModal.type === 'ai' ? 500000 : 100000),
        contactPhone: contactPhone.trim(),
        notes: upgradeNotes.trim()
      });

      if (res.success) {
        setSubmitSuccess(true);
        onSelectPlan(selectedPlanForModal.name);
        setTimeout(() => {
          setSelectedPlanForModal(null);
          setSubmitSuccess(false);
        }, 2500);
      } else {
        alert(res.message || "Erreur lors de l'envoi de la demande.");
      }
    } catch (err: any) {
      alert(err?.message || "Erreur réseau lors de la validation.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="absolute inset-x-0 bottom-0 top-[62px] md:top-[66px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300">
      
      {/* ========================================================================= */}
      {/* BARRE SUPÉRIEURE FIXE / COLLÉE AU HAUT : RETOUR, MENUS ET FACTURATION     */}
      {/* Ne bouge pas quand on défile la page                                      */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-[#F5F0E8]/95 dark:bg-[#0b0f19]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 border-b-2 border-[#2D4A3E]/15 dark:border-[#1e293b] shadow-xs">
        
        {/* Bouton Retour (Gauche) */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span className="hidden sm:inline">Retour</span>
        </button>

        {/* Boutons pour changer de menu au centre (Collés sur la ligne horizontale) */}
        <div className="bg-[#E8DFD0] dark:bg-[#111a2e] p-1 rounded-2xl border-2 border-[#D4C9B5] dark:border-[#1e293b] flex items-center gap-1 shadow-sm overflow-x-auto no-scrollbar max-w-full">
          <button
            onClick={() => setActiveTab('storage')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'storage'
                ? 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white shadow-sm'
                : 'text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white hover:bg-[#D4C9B5]/40 dark:hover:bg-slate-800'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Abonnements stockage</span>
            <span className="md:hidden">Stockage</span>
          </button>

          <button
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'ai'
                ? 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white shadow-sm'
                : 'text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white hover:bg-[#D4C9B5]/40 dark:hover:bg-slate-800'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Abonnement assistante StudyCloud</span>
            <span className="md:hidden">Assistante IA</span>
          </button>

          <button
            onClick={() => setActiveTab('renewal')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 ${
              activeTab === 'renewal'
                ? 'bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white shadow-sm'
                : 'text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white hover:bg-[#D4C9B5]/40 dark:hover:bg-slate-800'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Renouveler mon abonnement</span>
            <span className="md:hidden">Renouveler</span>
          </button>
        </div>

        {/* Toggle Facturation Ans / Mois (Droite) */}
        <div className="shrink-0">
          {activeTab !== 'renewal' ? (
            <div className="bg-[#E8DFD0] dark:bg-[#1e293b] rounded-full p-1 flex items-center shadow-xs border-2 border-[#1c1917] dark:border-[#334155]">
              <button
                onClick={() => setBillingCycle('annual')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'annual'
                    ? 'bg-[#F5F0E8] dark:bg-[#283852] text-[#2D4A3E] dark:text-white shadow-xs'
                    : 'bg-transparent text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white'
                }`}
              >
                <span>Ans</span>
                <span className="bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] text-[9px] font-bold uppercase px-1.5 py-0.5 rounded">
                  -10%
                </span>
              </button>
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-[#F5F0E8] dark:bg-[#283852] text-[#2D4A3E] dark:text-white shadow-xs'
                    : 'bg-transparent text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white'
                }`}
              >
                <span>Mois</span>
              </button>
            </div>
          ) : (
            <div className="w-6 sm:w-16"></div>
          )}
        </div>
      </div>

      <div className="w-full max-w-[1250px] mx-auto px-4 pt-6 sm:pt-8">
        {/* Header Section */}
        <div className="text-center pb-8 max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-3 leading-tight">
            Choisissez votre formule
          </h1>
          <p className="text-sm sm:text-lg md:text-xl font-sans text-[#5C6B5A] dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
            Des tarifs abordables et adaptés à vos objectifs.
          </p>
        </div>

        {/* ========================================================================= */}
        {/* 1. SECTION : ABONNEMENTS STOCKAGE (DISPOSITION HORIZONTALE SUR ORDINATEUR)*/}
        {/* ========================================================================= */}
        {activeTab === 'storage' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
            {/* Basique Card */}
            <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-[#D4C9B5] dark:border-[#1e293b] relative max-w-[380px] w-full mx-auto shadow-sm">
              <div>
                <h3 className="text-2xl sm:text-3xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-2 sm:mb-3">Basique</h3>
                <p className="text-xs sm:text-sm font-sans text-[#5C6B5A] dark:text-slate-400 mb-4 sm:mb-6 leading-relaxed">
                  Pour les particuliers et petites équipes qui débutent.
                </p>
                <div className="flex items-baseline mb-4 sm:mb-6">
                  <span className="text-5xl sm:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white">
                    ${billingCycle === 'annual' ? '9' : '10'}
                  </span>
                  <span className="text-lg sm:text-xl font-sans text-[#2D4A3E] dark:text-slate-300 ml-1">{billingCycle === 'annual' ? '/an' : '/mois'}</span>
                </div>
                <div className="h-0.5 w-full bg-gradient-to-r from-[#C9B896] to-[#D4C9B5] dark:from-[#1e293b] dark:to-[#334155] mb-4 sm:mb-6"></div>
                <p className="text-xs sm:text-sm font-semibold text-[#2D4A3E] dark:text-slate-200 mb-3 sm:mb-4">Ce qui est inclus :</p>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {[
                    "Essentiels de gestion des tâches",
                    "Messagerie d'équipe et partage de fichiers",
                    "Fil d'activité et aperçu des projets",
                    "Accès mobile et bureau",
                    "Support par e-mail"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#F5F0E8] dark:text-white" />
                      </div>
                      <span className="text-xs sm:text-sm text-[#2D4A3E] dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedPlanForModal({
                  name: 'Basique Stockage',
                  type: 'storage',
                  price: billingCycle === 'annual' ? 9 : 10,
                  currency: '$',
                  mb: 10240
                })}
                className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Commencer
              </button>
            </div>

            {/* Pro Card (POPULAIRE) */}
            <div className="bg-[#2D4A3E] dark:bg-[#16382b] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border-2 border-[#2D4A3E] dark:border-emerald-500 relative max-w-[380px] w-full mx-auto shadow-md">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl sm:text-3xl font-serif font-normal text-[#F5F0E8]">Pro</h3>
                  <span className="bg-[#C9B896] dark:bg-emerald-500 text-[#2D4A3E] dark:text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Populaire
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-sans text-[#E8DFD0]/80 mb-4 sm:mb-6 leading-relaxed">
                  Pour les professionnels et étudiants avancés.
                </p>
                <div className="flex items-baseline mb-4 sm:mb-6 text-[#F5F0E8]">
                  <span className="text-5xl sm:text-6xl font-serif font-normal">
                    ${billingCycle === 'annual' ? '29' : '32'}
                  </span>
                  <span className="text-lg sm:text-xl font-sans ml-1">{billingCycle === 'annual' ? '/an' : '/mois'}</span>
                </div>
                <div className="h-0.5 w-full bg-[#E8DFD0]/20 mb-4 sm:mb-6"></div>
                <p className="text-xs sm:text-sm font-semibold text-[#F5F0E8] mb-3 sm:mb-4">Tout dans Basique, plus :</p>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 text-[#F5F0E8]">
                  {[
                    "Stockage illimité haute vitesse",
                    "Support prioritaire 24/7",
                    "Analyses avancées et rapports",
                    "Collaboration en temps réel illimitée",
                    "Domaine personnalisé"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#C9B896] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#2D4A3E]" />
                      </div>
                      <span className="text-xs sm:text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedPlanForModal({
                  name: 'Pro Stockage',
                  type: 'storage',
                  price: billingCycle === 'annual' ? 29 : 32,
                  currency: '$',
                  mb: 51200
                })}
                className="w-full py-3 bg-[#C9B896] hover:bg-[#B8A785] text-[#2D4A3E] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Commencer
              </button>
            </div>

            {/* Enterprise Card */}
            <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-[#D4C9B5] dark:border-[#1e293b] relative max-w-[380px] w-full mx-auto shadow-sm">
              <div>
                <h3 className="text-2xl sm:text-3xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-2 sm:mb-3">Entreprise</h3>
                <p className="text-xs sm:text-sm font-sans text-[#5C6B5A] dark:text-slate-400 mb-4 sm:mb-6 leading-relaxed">
                  Pour les universités, laboratoires et grandes équipes.
                </p>
                <div className="flex items-baseline mb-4 sm:mb-6">
                  <span className="text-5xl sm:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white">
                    ${billingCycle === 'annual' ? '79' : '89'}
                  </span>
                  <span className="text-lg sm:text-xl font-sans text-[#2D4A3E] dark:text-slate-300 ml-1">{billingCycle === 'annual' ? '/an' : '/mois'}</span>
                </div>
                <div className="h-0.5 w-full bg-gradient-to-r from-[#C9B896] to-[#D4C9B5] dark:from-[#1e293b] dark:to-[#334155] mb-4 sm:mb-6"></div>
                <p className="text-xs sm:text-sm font-semibold text-[#2D4A3E] dark:text-slate-200 mb-3 sm:mb-4">Tout dans Pro, plus :</p>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {[
                    "Sécurité renforcée et SSO",
                    "Gestionnaire de compte dédié",
                    "SLA garanti 99.9%",
                    "Formations personnalisées",
                    "Facturation centralisée"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#F5F0E8] dark:text-white" />
                      </div>
                      <span className="text-xs sm:text-sm text-[#2D4A3E] dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedPlanForModal({
                  name: 'Entreprise Stockage',
                  type: 'storage',
                  price: billingCycle === 'annual' ? 79 : 89,
                  currency: '$',
                  mb: 204800
                })}
                className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Contactez-nous
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. SECTION : ASSISTANTE STUDYCLOUD (DISPOSITION HORIZONTALE SUR ORDINATEUR)*/}
        {/* ========================================================================= */}
        {activeTab === 'ai' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
            {/* IA Basique Card */}
            <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-[#D4C9B5] dark:border-[#1e293b] relative max-w-[380px] w-full mx-auto shadow-sm">
              <div>
                <h3 className="text-2xl sm:text-3xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-2 sm:mb-3">IA Basique</h3>
                <p className="text-xs sm:text-sm font-sans text-[#5C6B5A] dark:text-slate-400 mb-4 sm:mb-6 leading-relaxed">
                  Pour réviser, poser des questions et comprendre rapidement vos cours au quotidien.
                </p>
                <div className="flex items-baseline mb-4 sm:mb-6">
                  <span className="text-5xl sm:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white">
                    ${billingCycle === 'annual' ? '9' : '10'}
                  </span>
                  <span className="text-lg sm:text-xl font-sans text-[#2D4A3E] dark:text-slate-300 ml-1">{billingCycle === 'annual' ? '/an' : '/mois'}</span>
                </div>
                <div className="h-0.5 w-full bg-gradient-to-r from-[#C9B896] to-[#D4C9B5] dark:from-[#1e293b] dark:to-[#334155] mb-4 sm:mb-6"></div>
                <p className="text-xs sm:text-sm font-semibold text-[#2D4A3E] dark:text-slate-200 mb-3 sm:mb-4">Ce qui est inclus :</p>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {[
                    "100 000 mots générés par mois",
                    "Résumés automatiques de cours et PDF",
                    "Création instantanée de cartes mémoires (Flashcards)",
                    "Aide aux devoirs et explications pas à pas",
                    "Support par e-mail"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#F5F0E8] dark:text-white" />
                      </div>
                      <span className="text-xs sm:text-sm text-[#2D4A3E] dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedPlanForModal({
                  name: 'IA Basique Étudiant',
                  type: 'ai',
                  price: billingCycle === 'annual' ? 9 : 10,
                  currency: '$',
                  words: 100000
                })}
                className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Commencer
              </button>
            </div>

            {/* IA Pro Card (POPULAIRE) */}
            <div className="bg-[#2D4A3E] dark:bg-[#16382b] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border-2 border-[#2D4A3E] dark:border-emerald-500 relative max-w-[380px] w-full mx-auto shadow-md">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-2xl sm:text-3xl font-serif font-normal text-[#F5F0E8]">IA Pro Étudiant</h3>
                  <span className="bg-[#C9B896] dark:bg-emerald-500 text-[#2D4A3E] dark:text-white text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Populaire
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-sans text-[#E8DFD0]/80 mb-4 sm:mb-6 leading-relaxed">
                  L'assistant d'apprentissage complet pour exceller et réussir tous vos examens.
                </p>
                <div className="flex items-baseline mb-4 sm:mb-6 text-[#F5F0E8]">
                  <span className="text-5xl sm:text-6xl font-serif font-normal">
                    ${billingCycle === 'annual' ? '29' : '32'}
                  </span>
                  <span className="text-lg sm:text-xl font-sans ml-1">{billingCycle === 'annual' ? '/an' : '/mois'}</span>
                </div>
                <div className="h-0.5 w-full bg-[#E8DFD0]/20 mb-4 sm:mb-6"></div>
                <p className="text-xs sm:text-sm font-semibold text-[#F5F0E8] mb-3 sm:mb-4">Tout dans IA Basique, plus :</p>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8 text-[#F5F0E8]">
                  {[
                    "Mots IA illimités avec priorité maximale",
                    "Génération de Quiz interactifs & examens blancs",
                    "Synthèse vocale & lecture audio de vos fiches",
                    "Analyse intelligente de documents scannés et photos",
                    "Support prioritaire 24/7"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#C9B896] flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#2D4A3E]" />
                      </div>
                      <span className="text-xs sm:text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedPlanForModal({
                  name: 'IA Pro Étudiant',
                  type: 'ai',
                  price: billingCycle === 'annual' ? 29 : 32,
                  currency: '$',
                  words: 1000000
                })}
                className="w-full py-3 bg-[#C9B896] hover:bg-[#B8A785] text-[#2D4A3E] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Commencer
              </button>
            </div>

            {/* IA Recherche & Master Card */}
            <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-2xl p-6 sm:p-7 flex flex-col justify-between border border-[#D4C9B5] dark:border-[#1e293b] relative max-w-[380px] w-full mx-auto shadow-sm">
              <div>
                <h3 className="text-2xl sm:text-3xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-2 sm:mb-3">IA Recherche & Master</h3>
                <p className="text-xs sm:text-sm font-sans text-[#5C6B5A] dark:text-slate-400 mb-4 sm:mb-6 leading-relaxed">
                  Pour les doctorants, thèses, mémoires volumineux et laboratoires universitaires.
                </p>
                <div className="flex items-baseline mb-4 sm:mb-6">
                  <span className="text-5xl sm:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white">
                    ${billingCycle === 'annual' ? '79' : '89'}
                  </span>
                  <span className="text-lg sm:text-xl font-sans text-[#2D4A3E] dark:text-slate-300 ml-1">{billingCycle === 'annual' ? '/an' : '/mois'}</span>
                </div>
                <div className="h-0.5 w-full bg-gradient-to-r from-[#C9B896] to-[#D4C9B5] dark:from-[#1e293b] dark:to-[#334155] mb-4 sm:mb-6"></div>
                <p className="text-xs sm:text-sm font-semibold text-[#2D4A3E] dark:text-slate-200 mb-3 sm:mb-4">Tout dans IA Pro, plus :</p>
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {[
                    "Accès au modèle StudyCloud AI v2 le plus puissant",
                    "Analyse de thèses et projets de recherche de 500+ pages",
                    "Exportation certifiée des synthèses en PDF et Word",
                    "Accompagnement pédagogique dédié",
                    "Facturation annuelle universitaire & SLA garanti"
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3">
                      <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-[#2D4A3E] dark:bg-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#F5F0E8] dark:text-white" />
                      </div>
                      <span className="text-xs sm:text-sm text-[#2D4A3E] dark:text-slate-300">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={() => setSelectedPlanForModal({
                  name: 'IA Recherche & Master',
                  type: 'ai',
                  price: billingCycle === 'annual' ? 79 : 89,
                  currency: '$',
                  words: 5000000
                })}
                className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Contactez-nous
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. SECTION : RENOUVELER MON ABONNEMENT                                    */}
        {/* ========================================================================= */}
        {activeTab === 'renewal' && (
          <div className="w-full max-w-[650px] mx-auto px-2 pb-20">
            <div className="bg-[#E8DFD0] dark:bg-[#111a2e] rounded-3xl p-6 sm:p-8 border-2 border-[#D4C9B5] dark:border-[#1e293b] shadow-md space-y-6">
              <div className="flex items-center gap-3.5 pb-4 border-b border-[#D4C9B5] dark:border-slate-800">
                <div className="w-12 h-12 rounded-2xl bg-[#2D4A3E] dark:bg-emerald-600 text-[#F5F0E8] dark:text-white flex items-center justify-center shadow-md shrink-0">
                  <RotateCw className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#2D4A3E] dark:text-white">
                    Renouveler mon abonnement
                  </h3>
                  <p className="text-xs text-[#5C6B5A] dark:text-slate-400 mt-0.5">
                    Réabonnement & Prolongation de votre formule active
                  </p>
                </div>
              </div>

              {/* État actuel du compte */}
              <div className="p-4 rounded-2xl bg-[#F5F0E8] dark:bg-slate-900/80 border border-[#D4C9B5] dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5C6B5A] dark:text-slate-400 font-bold uppercase text-[10px]">Statut de votre compte :</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#2D4A3E]/15 dark:bg-emerald-500/20 text-[#2D4A3E] dark:text-emerald-400 font-bold text-xs">
                    Compte Étudiant Connecté
                  </span>
                </div>
                <div className="text-sm font-extrabold text-[#2D4A3E] dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500 fill-current" />
                  <span>Prêt pour le renouvellement</span>
                </div>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 leading-relaxed">
                  Cette section dédiée vous permettra très prochainement de prolonger votre formule active d'un simple clic et de régler vos échéances sans interruption de service.
                </p>
              </div>

              {/* Actions de redirection immédiate */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold text-[#2D4A3E] dark:text-slate-300 block">
                  En attendant, choisissez la formule que vous souhaitez renouveler :
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    onClick={() => setActiveTab('storage')}
                    className="p-4 rounded-2xl bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#233b31] text-white font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-md transition cursor-pointer active:scale-95"
                  >
                    <HardDrive className="w-5 h-5" />
                    <span>Renouveler mon Stockage</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('ai')}
                    className="p-4 rounded-2xl bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#b8a785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border border-[#2D4A3E]/20 dark:border-slate-700 font-bold text-xs flex flex-col items-center justify-center gap-2 shadow-sm transition cursor-pointer active:scale-95"
                  >
                    <Bot className="w-5 h-5" />
                    <span>Renouveler l'Assistante IA</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALE DE SOUSCRIPTION / ENREGISTREMENT DE DEMANDE                        */}
      {/* ========================================================================= */}
      {selectedPlanForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#F5F0E8] dark:bg-[#131b2e] rounded-3xl border-2 border-[#2D4A3E] dark:border-slate-800 shadow-2xl max-w-md w-full p-6 relative overflow-hidden">
            <button
              onClick={() => setSelectedPlanForModal(null)}
              className="absolute top-4 right-4 p-2 text-[#5C6B5A] hover:text-[#2D4A3E] dark:hover:text-white rounded-xl transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <span className="p-2.5 rounded-2xl bg-[#2D4A3E] text-white dark:bg-emerald-600">
                <Zap className="w-6 h-6 fill-current" />
              </span>
              <div>
                <h3 className="text-lg font-black text-[#2D4A3E] dark:text-white">
                  Souscrire à {selectedPlanForModal.name}
                </h3>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400">
                  Tarif : {selectedPlanForModal.price} {selectedPlanForModal.currency} {billingCycle === 'annual' ? '/an' : '/mois'}
                </p>
              </div>
            </div>

            {submitSuccess ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h4 className="text-base font-extrabold text-[#2D4A3E] dark:text-white">
                  Demande transmise avec succès !
                </h4>
                <p className="text-xs text-[#5C6B5A] dark:text-slate-400 max-w-xs mx-auto">
                  Votre demande est désormais en attente de confirmation dans le tableau de bord d'administration.
                </p>
              </div>
            ) : (
              <form onSubmit={handleConfirmSubscription} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-[#2D4A3E] dark:text-slate-300 block mb-1">
                    Votre numéro de téléphone (Wave / Orange / MTN) :
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      placeholder="Ex: +225 07 00 00 00 00"
                      className="w-full bg-[#E8DFD0] dark:bg-slate-900 text-[#2D4A3E] dark:text-white font-mono text-xs rounded-xl px-3 py-2.5 pl-9 border border-[#D4C9B5] dark:border-slate-700 focus:outline-none focus:border-[#2D4A3E]"
                    />
                    <Phone className="w-4 h-4 text-[#5C6B5A] dark:text-slate-500 absolute left-3 top-3" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2D4A3E] dark:text-slate-300 block mb-1">
                    Note ou référence de paiement (facultatif) :
                  </label>
                  <textarea
                    rows={2}
                    value={upgradeNotes}
                    onChange={(e) => setUpgradeNotes(e.target.value)}
                    placeholder="Ex: Virement Wave effectué ce matin..."
                    className="w-full bg-[#E8DFD0] dark:bg-slate-900 text-[#2D4A3E] dark:text-white text-xs rounded-xl p-3 border border-[#D4C9B5] dark:border-slate-700 focus:outline-none focus:border-[#2D4A3E]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPlanForModal(null)}
                    className="px-4 py-2 bg-transparent hover:bg-[#E8DFD0] text-[#5C6B5A] font-bold text-xs rounded-xl transition cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 bg-[#2D4A3E] dark:bg-emerald-600 hover:bg-[#233b31] text-white font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                  >
                    {submitting ? 'Transmission...' : 'Confirmer la demande'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
