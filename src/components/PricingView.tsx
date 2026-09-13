import React, { useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';

interface PricingViewProps {
  onBack: () => void;
  onSelectPlan: (planName: string) => void;
}

export const PricingView: React.FC<PricingViewProps> = ({ onBack, onSelectPlan }) => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  return (
    <div className="absolute inset-x-0 bottom-0 top-[72px] md:top-[76px] md:left-64 z-30 w-full md:w-[calc(100%-16rem)] min-h-screen bg-[#F5F0E8] dark:bg-[#0b0f19] text-[#2D4A3E] dark:text-slate-100 overflow-y-auto animate-fadeIn pb-24 transition-colors duration-300">
      {/* Fixed floating buttons directly below the top header */}
      <div className="fixed top-[84px] md:top-[88px] left-4 right-4 md:left-[17.5rem] flex items-center justify-between z-40 pointer-events-none gap-2">
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-[#E8DFD0] hover:bg-[#D4C9B5] text-[#2D4A3E] dark:bg-[#1e293b] dark:hover:bg-[#283852] dark:text-white font-bold text-xs rounded-xl border-2 border-[#2D4A3E] dark:border-[#334155] shadow-[2px_2px_0px_0px_#1c1917] dark:shadow-none transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
        >
          <ArrowLeft className="w-4 h-4 text-[#2D4A3E] dark:text-white" />
          <span>Retour</span>
        </button>

        {/* Compact Billing Toggle (Ans / Mois) */}
        <div className="pointer-events-auto bg-[#E8DFD0] dark:bg-[#1e293b] rounded-full p-1 flex items-center shadow-xs border-2 border-[#1c1917] dark:border-[#334155]">
          <button
            onClick={() => setBillingCycle('annual')}
            className={`flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
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
            className={`flex items-center gap-1 px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              billingCycle === 'monthly'
                ? 'bg-[#F5F0E8] dark:bg-[#283852] text-[#2D4A3E] dark:text-white shadow-xs'
                : 'bg-transparent text-[#5C6B5A] dark:text-slate-400 hover:text-[#2D4A3E] dark:hover:text-white'
            }`}
          >
            <span>Mois</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-[1250px] mx-auto px-4 pt-20 sm:pt-24">
        {/* Header Section */}
        <div className="text-center pt-2 pb-8 max-w-5xl mx-auto">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-serif font-normal text-[#2D4A3E] dark:text-white mb-3 leading-tight">
            Choisissez votre formule
          </h1>
          <p className="text-sm sm:text-lg md:text-xl font-sans text-[#5C6B5A] dark:text-slate-400 max-w-xl mx-auto leading-relaxed px-2">
            Des tarifs abordables et adaptés à vos objectifs.
          </p>
        </div>

        {/* Pricing Cards Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch pb-20 w-full max-w-[1250px] mx-auto px-2">
          {/* Basic Card */}
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
              onClick={() => onSelectPlan('Basique')}
              className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
            >
              Commencer
            </button>
          </div>

          {/* Pro Card */}
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
              onClick={() => onSelectPlan('Pro')}
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
              onClick={() => onSelectPlan('Entreprise')}
              className="w-full py-3 bg-[#C9B896] dark:bg-[#1e293b] hover:bg-[#B8A785] dark:hover:bg-[#283852] text-[#2D4A3E] dark:text-white border dark:border-[#334155] font-medium text-sm rounded-lg transition-all cursor-pointer shadow-sm text-center"
            >
              Contactez-nous
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
