import React, { useState } from 'react';
import { ArrowLeft, Check, HardDrive, Bot, RotateCw, Sparkles } from 'lucide-react';
import { SubscriptionFormView, SelectedPlan } from './SubscriptionFormView';
import { RenewalFormView } from './RenewalFormView';
import { RenewalSectionView } from './RenewalSectionView';

interface SettingsPricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
  initialTab?: 'storage' | 'ai' | 'renewal';
}

export const SettingsPricingView: React.FC<SettingsPricingViewProps> = ({ onBack, onSelectPlan, initialTab = 'storage' }) => {
  const [activeTab, setActiveTab] = useState<'storage' | 'ai' | 'renewal'>(initialTab);
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  // État du plan sélectionné pour afficher le nouveau menu de souscription
  const [selectedPlanForSubscription, setSelectedPlanForSubscription] = useState<SelectedPlan | null>(null);

  // État pour afficher le vrai menu complet de renouvellement (à l'identique de SubscriptionFormView)
  const [selectedPlanForRenewal, setSelectedPlanForRenewal] = useState<any | null>(null);
  const [renewalRefreshKey, setRenewalRefreshKey] = useState<number>(0);

  // Si l'utilisateur clique sur "Commencer" ou choisit un plan, on affiche le NOUVEAU MENU
  // (Pas une popup/modal, mais une vue complète divisée en deux avec formulaire et explications)
  if (selectedPlanForSubscription) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-white overflow-y-auto animate-fadeIn pb-24">
        <SubscriptionFormView
          plan={selectedPlanForSubscription}
          onBack={() => setSelectedPlanForSubscription(null)}
          onSuccess={() => onSelectPlan(selectedPlanForSubscription.name)}
          onGoToRenewal={() => {
            setSelectedPlanForSubscription(null);
            setActiveTab('renewal');
          }}
        />
      </div>
    );
  }

  // Si l'utilisateur clique sur "Renouveler l'abonnement", on affiche le VRAI MENU COMPLET DE RENOUVELLEMENT
  if (selectedPlanForRenewal) {
    return (
      <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-white overflow-y-auto animate-fadeIn pb-24">
        <RenewalFormView
          subscription={selectedPlanForRenewal}
          onBack={() => {
            setSelectedPlanForRenewal(null);
            setRenewalRefreshKey(k => k + 1);
          }}
          onSuccess={() => {
            setSelectedPlanForRenewal(null);
            setActiveTab('renewal');
            setRenewalRefreshKey(k => k + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-x-0 bottom-0 top-0 md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-white overflow-y-auto animate-fadeIn pb-24">
      
      {/* ========================================================================= */}
      {/* BARRE SUPÉRIEURE FIXE / COLLÉE AU HAUT : RETOUR, MENUS ET FACTURATION     */}
      {/* Ne bouge pas quand on défile la page                                      */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-[#F5F0E8]/95 dark:bg-[#070a13]/95 backdrop-blur-md px-3 sm:px-6 py-2.5 flex items-center justify-between gap-2 sm:gap-4 border-b-2 border-[#2D4A3E]/15 dark:border-[#1e293b] shadow-xs">
        
        {/* Bouton Retour (Gauche) */}
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 bg-[#E8DFD0] dark:bg-[#1e293b] hover:bg-[#D4C9B5] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 shrink-0"
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
        {/* Header Section (Uniquement sur Stockage et IA) */}
        {activeTab !== 'renewal' && (
          <div className="text-center pb-8 max-w-5xl mx-auto">
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-3 leading-tight">
              Choisissez votre formule
            </h1>
            <p className="text-sm sm:text-lg md:text-xl font-sans text-[#5C6B5A] dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
              Des tarifs abordables et adaptés à vos objectifs.
            </p>
          </div>
        )}

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
                onClick={() => setSelectedPlanForSubscription({
                  name: 'Basique Stockage',
                  type: 'storage',
                  storageDisplay: '10 Go supplémentaires (+ 10 240 Mo)',
                  priceDisplay: billingCycle === 'annual' ? '9 $ / an (≈ 5 500 FCFA)' : '10 $ / mois (≈ 6 500 FCFA)',
                  price: billingCycle === 'annual' ? 9 : 10,
                  priceFcfa: billingCycle === 'annual' ? 5500 : 6500,
                  currency: '$',
                  billingCycle,
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
                onClick={() => setSelectedPlanForSubscription({
                  name: 'Pro Stockage',
                  type: 'storage',
                  storageDisplay: '50 Go supplémentaires (+ 51 200 Mo)',
                  priceDisplay: billingCycle === 'annual' ? '29 $ / an (≈ 18 000 FCFA)' : '32 $ / mois (≈ 20 000 FCFA)',
                  price: billingCycle === 'annual' ? 29 : 32,
                  priceFcfa: billingCycle === 'annual' ? 18000 : 20000,
                  currency: '$',
                  billingCycle,
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
                onClick={() => setSelectedPlanForSubscription({
                  name: 'Entreprise Stockage',
                  type: 'storage',
                  storageDisplay: '200 Go supplémentaires (+ 204 800 Mo)',
                  priceDisplay: billingCycle === 'annual' ? '79 $ / an (≈ 49 000 FCFA)' : '89 $ / mois (≈ 55 000 FCFA)',
                  price: billingCycle === 'annual' ? 79 : 89,
                  priceFcfa: billingCycle === 'annual' ? 49000 : 55000,
                  currency: '$',
                  billingCycle,
                  mb: 204800
                })}
                className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Commencer
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
                onClick={() => setSelectedPlanForSubscription({
                  name: 'IA Basique Étudiant',
                  type: 'ai',
                  storageDisplay: '100 000 mots IA générés / mois',
                  priceDisplay: billingCycle === 'annual' ? '9 $ / an (≈ 5 500 FCFA)' : '10 $ / mois (≈ 6 500 FCFA)',
                  price: billingCycle === 'annual' ? 9 : 10,
                  priceFcfa: billingCycle === 'annual' ? 5500 : 6500,
                  currency: '$',
                  billingCycle,
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
                onClick={() => setSelectedPlanForSubscription({
                  name: 'IA Pro Étudiant',
                  type: 'ai',
                  storageDisplay: '1 000 000 mots IA illimités / mois',
                  priceDisplay: billingCycle === 'annual' ? '29 $ / an (≈ 18 000 FCFA)' : '32 $ / mois (≈ 20 000 FCFA)',
                  price: billingCycle === 'annual' ? 29 : 32,
                  priceFcfa: billingCycle === 'annual' ? 18000 : 20000,
                  currency: '$',
                  billingCycle,
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
                onClick={() => setSelectedPlanForSubscription({
                  name: 'IA Recherche & Master',
                  type: 'ai',
                  storageDisplay: '5 000 000 mots IA Recherche / mois',
                  priceDisplay: billingCycle === 'annual' ? '79 $ / an (≈ 49 000 FCFA)' : '89 $ / mois (≈ 55 000 FCFA)',
                  price: billingCycle === 'annual' ? 79 : 89,
                  priceFcfa: billingCycle === 'annual' ? 49000 : 55000,
                  currency: '$',
                  billingCycle,
                  words: 5000000
                })}
                className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
              >
                Commencer
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. SECTION : RENOUVELER MON ABONNEMENT (DIVISÉE EN 2 VOLETS)               */}
        {/* ========================================================================= */}
        {activeTab === 'renewal' && (
          <RenewalSectionView
            key={renewalRefreshKey}
            onGoToStorage={() => setActiveTab('storage')}
            onSelectPlan={onSelectPlan}
            onStartRenewal={(sub) => setSelectedPlanForRenewal(sub)}
          />
        )}
      </div>
    </div>
  );
};
